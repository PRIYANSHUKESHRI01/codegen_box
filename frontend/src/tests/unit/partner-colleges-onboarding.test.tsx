import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { PartnerCollegesPanel } from "@/components/admin/mellow/PartnerCollegesPanel";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: vi.fn(), delete: vi.fn() },
  };
});

const SUBMIT = "Provision TPO & Partner University";
const toast = vi.fn();

function openModalAndFill(email = "arunkumarbbu00@gmail.com") {
  render(<PartnerCollegesPanel triggerToast={toast} />);
  fireEvent.click(screen.getByText("Onboard University"));
  fireEvent.change(screen.getByPlaceholderText("e.g. Indian Institute of Technology Bombay"), { target: { value: "Tulas University" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. Dr. Ananya Sen"), { target: { value: "Dr. Arun Kumar" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. tpo@iitb.ac.in"), { target: { value: email } });
}

const submit = () => fireEvent.click(screen.getByText(SUBMIT, { selector: "button" }));

beforeEach(() => {
  get.mockReset().mockResolvedValue({ colleges: [] });
  post.mockReset();
  toast.mockReset();
});

afterEach(cleanup);

describe("onboarding a partner university + TPO", () => {
  it("shows the server's reason inside the modal when it refuses (the toast sits behind the overlay)", async () => {
    post.mockRejectedValue(new ApiError("That email already belongs to an existing AptRun account. Use a different email for this TPO.", 422));
    openModalAndFill();
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("already belongs to an existing AptRun account");

    // Still open with the admin's input intact, and ready to retry.
    expect((screen.getByPlaceholderText("e.g. tpo@iitb.ac.in") as HTMLInputElement).value).toBe("arunkumarbbu00@gmail.com");
    expect((screen.getByText(SUBMIT, { selector: "button" }) as HTMLButtonElement).disabled).toBe(false);
    expect(toast).not.toHaveBeenCalled();
  });

  it("falls back to a plain message when the request fails without a server reason", async () => {
    post.mockRejectedValue(new TypeError("Failed to fetch"));
    openModalAndFill();
    submit();

    expect((await screen.findByRole("alert")).textContent).toMatch(/failed to onboard/i);
  });

  it("clears the error when the modal is closed, so it isn't stale next time", async () => {
    post.mockRejectedValue(new ApiError("Nope.", 422));
    openModalAndFill();
    submit();
    await screen.findByRole("alert");

    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("Onboard University"));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("locks the button while the request runs, so a second click can't send a duplicate", async () => {
    let finish!: (v: unknown) => void;
    post.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    openModalAndFill();

    submit();
    const busy = await screen.findByText("Provisioning…", { selector: "button" });
    expect((busy as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(busy);
    expect(post).toHaveBeenCalledTimes(1);

    finish({ college: { name: "Tulas University" }, tpo: { id: 1, name: "Dr. Arun Kumar", email: "x@y.com" }, temporary_password: "pw" });
    await waitFor(() => expect(toast).toHaveBeenCalled());
  });

  it.each([
    [true, "Login details were emailed to tpo@tulas.edu"],
    [false, "The email to tpo@tulas.edu could not be sent, so pass the password on yourself."],
  ])("tells the admin whether the credentials email went out (sent=%s)", async (sent, expected) => {
    post.mockResolvedValue({
      college: { name: "Tulas University" },
      tpo: { id: 1, name: "Dr. Arun Kumar", email: "tpo@tulas.edu" },
      temporary_password: "Temp-Pass-123",
      credentials_email_sent: sent,
    });
    openModalAndFill("tpo@tulas.edu");
    submit();

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    const message = toast.mock.calls[0][0] as string;
    expect(message).toContain("Temp-Pass-123");
    expect(message).toContain(expected);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
