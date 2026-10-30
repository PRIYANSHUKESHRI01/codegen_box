import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { PartnerCollegesPanel } from "@/components/admin/mellow/PartnerCollegesPanel";
import { EditCollegeModal } from "@/components/admin/mellow/EditCollegeModal";
import { mapCollegeFromApi } from "@/components/admin/mellow/partnerColleges";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: (path: string, body?: unknown) => put(path, body), delete: vi.fn() },
  };
});

const API_COLLEGE = {
  id: 9,
  name: "Tulas Institute",
  short_code: "TUL",
  city: "Dehradun",
  state: "Uttarakhand",
  tier: "Standard" as const,
  placement_rate: "42.5",
  is_active: true,
  active_students_count: 120,
  created_at: "2026-10-01T00:00:00Z",
  users: [{ id: 77, name: "Dr Arun", email: "arun@tulas.test", is_blocked: false }],
  subscription_days_remaining: 200,
  subscription_status: "active",
  subscription_is_trial: false,
  plan_max_students: 500,
};

const toast = vi.fn();

beforeEach(() => {
  get.mockReset().mockResolvedValue({ colleges: [API_COLLEGE] });
  post.mockReset();
  put.mockReset();
  toast.mockReset();
});
afterEach(cleanup);

describe("EditCollegeModal", () => {
  const college = mapCollegeFromApi(API_COLLEGE);
  const saveButton = () => screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement;

  it("keeps Save off until something actually changed", () => {
    render(<EditCollegeModal college={college} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(saveButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/university \/ college name/i), { target: { value: "Tulas University" } });
    expect(saveButton().disabled).toBe(false);
  });

  it("saves a rename + code change, upper-casing the code, and asks for no password", async () => {
    put.mockResolvedValue({ changed: true });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<EditCollegeModal college={college} onClose={onClose} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText(/university \/ college name/i), { target: { value: "  Tulas   University " } });
    fireEvent.change(screen.getByLabelText(/short code/i), { target: { value: "tu" } });
    expect(screen.queryByLabelText(/your password/i)).toBeNull();
    fireEvent.click(saveButton());

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const [path, body] = put.mock.calls[0];
    expect(path).toBe("/superadmin/colleges/9");
    expect(body).toMatchObject({ name: "Tulas University", short_code: "TU", tpo_user_id: 77, tpo_name: "Dr Arun", tpo_email: "arun@tulas.test" });
    expect(body).not.toHaveProperty("password");
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onSaved.mock.calls[0][0]).toMatch(/Tulas University \(TU\)/);
    expect(onClose).toHaveBeenCalled();
  });

  it("will not send a new TPO login email until the superadmin's password is entered, then sends it", async () => {
    put.mockResolvedValue({ changed: true });
    render(<EditCollegeModal college={college} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/tpo login email/i), { target: { value: "new.tpo@tulas.test" } });
    expect(screen.getByLabelText(/your password/i)).toBeTruthy();
    expect(saveButton().disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: "hunter2-hunter2" } });
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0][1]).toMatchObject({ tpo_email: "new.tpo@tulas.test", password: "hunter2-hunter2" });
  });

  it("shows the server's reason next to the field and keeps the dialog open", async () => {
    put.mockRejectedValue(new ApiError("The given data was invalid.", 422, { short_code: ["That short code is already used by another college. Pick a different one."] }));
    const onClose = vi.fn();
    render(<EditCollegeModal college={college} onClose={onClose} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/short code/i), { target: { value: "SHA" } });
    fireEvent.click(saveButton());

    expect(await screen.findByText(/already used by another college/i)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("explains a college with no TPO yet instead of showing empty TPO fields", () => {
    const orphan = mapCollegeFromApi({ ...API_COLLEGE, users: [] });
    render(<EditCollegeModal college={orphan} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByLabelText(/tpo login email/i)).toBeNull();
    expect(screen.getByText(/no TPO account yet/i)).toBeTruthy();
  });
});

describe("PartnerCollegesPanel superadmin tools", () => {
  it("offers Edit details and TPO password only when the superadmin page asks for them (Ops staff share this panel)", async () => {
    const { unmount } = render(<PartnerCollegesPanel triggerToast={toast} />);
    await screen.findByText("Tulas Institute");
    fireEvent.click(screen.getByRole("button", { name: /manage tulas institute/i }));
    expect(screen.queryByRole("menuitem", { name: /edit details/i })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /tpo password/i })).toBeNull();
    unmount();

    render(<PartnerCollegesPanel triggerToast={toast} canManageDetails />);
    await screen.findByText("Tulas Institute");
    fireEvent.click(screen.getByRole("button", { name: /manage tulas institute/i }));
    expect(screen.getByRole("menuitem", { name: /edit details/i })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /tpo password/i })).toBeTruthy();
  });

  it("opens the password dialog for the TPO of that college", async () => {
    render(<PartnerCollegesPanel triggerToast={toast} canManageDetails />);
    await screen.findByText("Tulas Institute");

    fireEvent.click(screen.getByRole("button", { name: /manage tulas institute/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /tpo password/i }));
    expect(await screen.findByText(/replaces/i)).toBeTruthy();
    expect(screen.getByText("Dr Arun", { selector: "strong" })).toBeTruthy();
  });

  it("filters by plan state and says so when nothing matches", async () => {
    get.mockResolvedValue({ colleges: [API_COLLEGE, { ...API_COLLEGE, id: 10, name: "Sharda University", short_code: "SHA", subscription_days_remaining: null, users: [] }] });
    render(<PartnerCollegesPanel triggerToast={toast} />);
    await screen.findByText("Sharda University");

    fireEvent.click(screen.getByRole("button", { name: /no plan/i }));
    expect(screen.queryByText("Tulas Institute")).toBeNull();
    expect(screen.getByText("Sharda University")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /suspended/i }));
    expect(await screen.findByText(/no university matches/i)).toBeTruthy();
  });
});
