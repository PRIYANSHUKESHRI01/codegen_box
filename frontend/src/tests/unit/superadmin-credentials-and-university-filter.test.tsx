import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { AccountsPanel } from "@/components/admin/superadmin/AccountsPanel";
import { credentialAccess } from "@/components/admin/superadmin/credentialAccess";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (path: string) => get(path),
      post: (path: string, body?: unknown) => post(path, body),
      put: vi.fn(),
      delete: vi.fn(),
    },
  };
});

const toast = vi.fn();

const ACCOUNTS = [
  { id: 2, name: "Dr. Arun Kumar", email: "arun@tulas.test", handle: "arun", role: "admin_tpo", is_blocked: false, must_change_password: true, credential_state: "viewable", college: { id: 9, name: "Tulas University" } },
  { id: 3, name: "Riya Sharma", email: "riya@tulas.test", handle: "riya", role: "user", is_blocked: false, must_change_password: false, credential_state: "owner_set", college: { id: 9, name: "Tulas University" } },
  { id: 4, name: "Old Coordinator", email: "old@tulas.test", handle: "old", role: "section_coordinator", is_blocked: false, must_change_password: true, credential_state: "not_recorded", college: { id: 9, name: "Tulas University" } },
  { id: 1, name: "Super Admin", email: "root@mellow.test", handle: "root", role: "superadmin", is_blocked: false, must_change_password: false, credential_state: "protected", college: null },
];

const FACETS = {
  roles: { admin_tpo: 1, user: 230, section_coordinator: 4, superadmin: 1, admin_marketing: 2, admin_internal: 1, admin_company: 3 },
  colleges: [
    { id: 9, name: "Tulas University", short_code: "TUL", city: "Dehradun", accounts: 235 },
    { id: 12, name: "Sharda University", short_code: "SHA", city: "Greater Noida", accounts: 0 },
  ],
  without_college: 7,
};

const usersCalls = () => get.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith("/superadmin/users?"));
const lastUsersCall = () => usersCalls().at(-1)!;

beforeEach(async () => {
  get.mockReset();
  post.mockReset();
  toast.mockReset();
  post.mockResolvedValue(undefined);
  await credentialAccess.lock();
  post.mockReset();

  get.mockImplementation((path: string) => {
    if (path.startsWith("/superadmin/users/facets")) return Promise.resolve(FACETS);
    if (path.startsWith("/superadmin/credentials/status")) return Promise.resolve({ unlocked: false });
    return Promise.resolve({ data: ACCOUNTS, current_page: 1, last_page: 1, total: ACCOUNTS.length });
  });
});

afterEach(cleanup);

const open = async () => {
  render(<AccountsPanel triggerToast={toast} />);
  await screen.findByText("Dr. Arun Kumar");
};

const unlockWith = async (password: string) => {
  const dialog = await screen.findByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: password } });
  fireEvent.click(within(dialog).getByRole("button", { name: /^unlock$/i }));
  return dialog;
};

describe("issued logins", () => {
  it("starts locked: no password anywhere on the page, and the list payload never carried one", async () => {
    await open();

    expect(screen.getByText(/login details are locked/i)).toBeTruthy();
    expect(screen.queryByTestId("revealed-password-2")).toBeNull();
    expect(screen.getByRole("button", { name: /show dr\. arun kumar's password/i })).toBeTruthy();
  });

  it("asks for the superadmin's password, then shows the issued password and nothing else", async () => {
    post.mockImplementation((path: string) => {
      if (path === "/superadmin/credentials/unlock") return Promise.resolve({ unlocked: true, expires_at: new Date(Date.now() + 600_000).toISOString() });
      if (path === "/superadmin/users/2/credentials") return Promise.resolve({ login_id: "arun@tulas.test", password: "Issued-Pass-9!", state: "viewable", source: "created", issued_at: null, expires_at: null });
      return Promise.resolve(undefined);
    });
    await open();

    fireEvent.click(screen.getByRole("button", { name: /show dr\. arun kumar's password/i }));
    await unlockWith("my-own-password");

    expect((await screen.findByTestId("revealed-password-2")).textContent).toBe("Issued-Pass-9!");
    expect(post).toHaveBeenCalledWith("/superadmin/credentials/unlock", { password: "my-own-password" });
    expect(post).toHaveBeenCalledWith("/superadmin/users/2/credentials", undefined);
    expect(screen.getByText(/unlocked — closes in/i)).toBeTruthy();
  });

  it("keeps it locked and says why when the password is wrong", async () => {
    post.mockRejectedValue(new ApiError("That is not your password.", 422, { password: ["That is not your password. Enter the password you sign in with."] }));
    await open();

    fireEvent.click(screen.getByRole("button", { name: /show dr\. arun kumar's password/i }));
    const dialog = await unlockWith("typo");

    expect((await within(dialog).findByRole("alert")).textContent).toContain("not your password");
    expect(screen.queryByTestId("revealed-password-2")).toBeNull();
    expect(post).not.toHaveBeenCalledWith("/superadmin/users/2/credentials", undefined);
  });

  it("hides the password again on request", async () => {
    post.mockImplementation((path: string) =>
      path === "/superadmin/credentials/unlock"
        ? Promise.resolve({ unlocked: true, expires_at: new Date(Date.now() + 600_000).toISOString() })
        : Promise.resolve({ login_id: "arun@tulas.test", password: "Issued-Pass-9!", state: "viewable", source: "reset", issued_at: null, expires_at: null })
    );
    await open();
    fireEvent.click(screen.getByRole("button", { name: /show dr\. arun kumar's password/i }));
    await unlockWith("pw");
    await screen.findByTestId("revealed-password-2");

    fireEvent.click(screen.getByRole("button", { name: /hide dr\. arun kumar's password/i }));

    expect(screen.queryByTestId("revealed-password-2")).toBeNull();
  });

  it("locking closes every revealed password at once", async () => {
    post.mockImplementation((path: string) =>
      path === "/superadmin/credentials/unlock"
        ? Promise.resolve({ unlocked: true, expires_at: new Date(Date.now() + 600_000).toISOString() })
        : Promise.resolve({ login_id: "arun@tulas.test", password: "Issued-Pass-9!", state: "viewable", source: "created", issued_at: null, expires_at: null })
    );
    await open();
    fireEvent.click(screen.getByRole("button", { name: /show dr\. arun kumar's password/i }));
    await unlockWith("pw");
    await screen.findByTestId("revealed-password-2");

    fireEvent.click(screen.getByRole("button", { name: /lock now/i }));

    await waitFor(() => expect(screen.queryByTestId("revealed-password-2")).toBeNull());
    expect(screen.getByText(/login details are locked/i)).toBeTruthy();
  });

  it("asks again when the server says the unlock has lapsed", async () => {
    await credentialAccess.sync();
    post.mockImplementation((path: string) => {
      if (path === "/superadmin/credentials/unlock") return Promise.resolve({ unlocked: true, expires_at: new Date(Date.now() + 600_000).toISOString() });
      return Promise.reject(new ApiError("Enter your password to view login details.", 428, undefined, "credentials_locked"));
    });
    await open();

    // Unlock locally, as if it had been done a moment ago…
    await credentialAccess.unlock("pw");
    fireEvent.click(await screen.findByRole("button", { name: /show dr\. arun kumar's password/i }));

    // …but the server has forgotten: the prompt comes back instead of an error.
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("says a password the owner chose is private, and offers no way to look at it", async () => {
    await open();

    expect(screen.getByText(/private — user chose it/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /show riya sharma's password/i })).toBeNull();
  });

  it("tells you to reset an old temporary password that has no copy on file", async () => {
    await open();

    expect(screen.getByText(/not on file — reset to issue one/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /show old coordinator's password/i })).toBeNull();
  });

  it("never offers to show a superadmin's password", async () => {
    await open();

    expect(screen.getByText(/^protected$/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /show super admin's password/i })).toBeNull();
  });
});

describe("change password", () => {
  const openDialogFor = async (name: string) => {
    await open();
    const row = screen.getByText(name).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: /^change password$/i }));
    return screen.findByRole("dialog");
  };

  it("lets the superadmin type the new password and sends it with the confirmation", async () => {
    post.mockResolvedValue({ temporary_password: "Typed-By-Boss-1", credentials_email_sent: null, must_change_password: true });
    const dialog = await openDialogFor("Dr. Arun Kumar");

    fireEvent.click(within(dialog).getByLabelText(/i.ll type one/i));
    fireEvent.change(within(dialog).getByLabelText(/new password for/i), { target: { value: "Typed-By-Boss-1" } });
    fireEvent.change(within(dialog).getByLabelText(/your password \(to confirm/i), { target: { value: "my-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^set password$/i }));

    expect(await within(dialog).findByText("Typed-By-Boss-1")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/superadmin/users/2/reset-password", { password: "my-password", send_email: true, new_password: "Typed-By-Boss-1", require_change: true });
  });

  it("refuses a too-short password before calling the server", async () => {
    const dialog = await openDialogFor("Dr. Arun Kumar");

    fireEvent.click(within(dialog).getByLabelText(/i.ll type one/i));
    fireEvent.change(within(dialog).getByLabelText(/new password for/i), { target: { value: "short" } });
    fireEvent.change(within(dialog).getByLabelText(/your password \(to confirm/i), { target: { value: "my-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^set password$/i }));

    expect((await within(dialog).findByRole("alert")).textContent).toMatch(/at least 8/i);
    expect(post).not.toHaveBeenCalled();
  });

  it("says plainly when a permanent password was set and no copy is kept", async () => {
    post.mockResolvedValue({ temporary_password: "Forever-Pass-1", credentials_email_sent: null, must_change_password: false });
    const dialog = await openDialogFor("Riya Sharma");

    fireEvent.click(within(dialog).getByLabelText(/i.ll type one/i));
    fireEvent.change(within(dialog).getByLabelText(/new password for/i), { target: { value: "Forever-Pass-1" } });
    const boxes = within(dialog).getAllByRole("checkbox");
    fireEvent.click(boxes.find((b) => b.closest("label")?.textContent?.match(/ask them to choose/i))!);
    fireEvent.change(within(dialog).getByLabelText(/your password \(to confirm/i), { target: { value: "my-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^set password$/i }));

    expect(await within(dialog).findByText(/no copy is kept/i)).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/superadmin/users/3/reset-password", expect.objectContaining({ new_password: "Forever-Pass-1", require_change: false }));
  });
});

describe("university and role filters", () => {
  const pickUniversity = async (typed: string, optionName: RegExp) => {
    fireEvent.click(screen.getByRole("combobox", { name: /filter by university/i }));
    if (typed) fireEvent.change(screen.getByLabelText(/search universities/i), { target: { value: typed } });
    fireEvent.click(await screen.findByRole("button", { name: optionName }));
  };

  it("shows how many accounts of each kind there are", async () => {
    await open();

    const students = await screen.findByRole("button", { name: /students & coders/i });
    expect(students.textContent).toContain("230");
    expect(screen.getByRole("button", { name: /mellow staff/i }).textContent).toContain("3"); // ops 1 + marketing 2
    expect(screen.getByRole("button", { name: /all accounts/i }).textContent).toContain("242");
  });

  it("filters to one university by typing part of its name", async () => {
    await open();
    await screen.findByRole("button", { name: /students & coders/i });

    await pickUniversity("shar", /sharda university/i);

    await waitFor(() => expect(lastUsersCall()).toContain("college_id=12"));
    // …and narrows the other universities out of the list while typing.
    fireEvent.click(screen.getByRole("combobox", { name: /filter by university/i }));
    fireEvent.change(screen.getByLabelText(/search universities/i), { target: { value: "zzz" } });
    expect(screen.getByText(/no university matches/i)).toBeTruthy();
  });

  it("can pick the accounts that belong to no university", async () => {
    await open();
    await screen.findByRole("button", { name: /students & coders/i });

    await pickUniversity("", /no university/i);

    await waitFor(() => expect(lastUsersCall()).toContain("college_id=none"));
  });

  it("combines a university with an account type", async () => {
    await open();
    await screen.findByRole("button", { name: /students & coders/i });

    await pickUniversity("", /tulas university/i);
    fireEvent.click(screen.getByRole("button", { name: /college tpos/i }));

    await waitFor(() => {
      expect(lastUsersCall()).toContain("college_id=9");
      expect(lastUsersCall()).toContain("role=admin_tpo");
    });
  });

  it("drops the university when switching to an account type that never has one", async () => {
    await open();
    await screen.findByRole("button", { name: /students & coders/i });
    await pickUniversity("", /tulas university/i);
    await waitFor(() => expect(lastUsersCall()).toContain("college_id=9"));

    fireEvent.click(screen.getByRole("button", { name: /hiring companies/i }));

    await waitFor(() => {
      expect(lastUsersCall()).toContain("role=admin_company");
      expect(lastUsersCall()).not.toContain("college_id");
    });
  });

  it("clears every filter in one click", async () => {
    await open();
    await screen.findByRole("button", { name: /students & coders/i });
    await pickUniversity("", /tulas university/i);
    fireEvent.click(screen.getByRole("button", { name: /college tpos/i }));
    await waitFor(() => expect(lastUsersCall()).toContain("role=admin_tpo"));

    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));

    await waitFor(() => expect(lastUsersCall()).not.toMatch(/role=|college_id/));
  });
});
