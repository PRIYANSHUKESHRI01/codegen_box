import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { AccountsPanel } from "@/components/admin/superadmin/AccountsPanel";
import { DeleteCollegeModal } from "@/components/admin/superadmin/DeleteCollegeModal";
import { PartnerCollegesPanel } from "@/components/admin/mellow/PartnerCollegesPanel";

const get = vi.fn();
const post = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (path: string) => get(path),
      post: (path: string, body?: unknown) => post(path, body),
      put: vi.fn(),
      delete: (path: string, body?: unknown) => del(path, body),
    },
  };
});

const toast = vi.fn();

const IMPACT = {
  tpos: 1,
  coordinators: 0,
  students: 340,
  accounts_kept_detached: 2,
  drives: 4,
  contests: 0,
  interviews: 0,
  interview_tracks: 0,
  interview_role_templates: 0,
  soft_skill_assessments: 0,
  drive_applications: 1,
};

const COLLEGE = { id: 9, name: "Tulas University" };

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
  toast.mockReset();
});

afterEach(cleanup);

describe("DeleteCollegeModal", () => {
  const mount = (onDeleted = vi.fn(), onClose = vi.fn()) => {
    get.mockResolvedValue({ impact: IMPACT });
    render(<DeleteCollegeModal college={COLLEGE} onClose={onClose} onDeleted={onDeleted} />);
    return { onDeleted, onClose };
  };
  const deleteButton = () => screen.getByRole("button", { name: /permanently delete/i }) as HTMLButtonElement;
  const typeName = (v: string) => fireEvent.change(screen.getByLabelText(/^type .* to confirm$/i), { target: { value: v } });
  const typePassword = (v: string) => fireEvent.change(screen.getByLabelText(/your password/i), { target: { value: v } });

  it("shows exactly what will be destroyed, skipping things that are zero", async () => {
    mount();

    expect(await screen.findByText(/340/)).toBeTruthy();
    expect(screen.getByText(/student accounts/i)).toBeTruthy();
    expect(screen.getByText(/placement drives the college created/i)).toBeTruthy();
    expect(screen.queryByText(/mock contest/i)).toBeNull();
    expect(screen.getByText(/2 Mellow staff \/ company account\(s\)/i)).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/superadmin/colleges/9/deletion-preview");
  });

  it("stays disabled until the name is typed exactly AND a password is entered", async () => {
    mount();
    await screen.findByText(/340/);

    expect(deleteButton().disabled).toBe(true);
    typePassword("my-password");
    expect(deleteButton().disabled).toBe(true);
    typeName("tulas university"); // wrong case
    expect(deleteButton().disabled).toBe(true);
    typeName("Tulas University");
    expect(deleteButton().disabled).toBe(false);
    typePassword("");
    expect(deleteButton().disabled).toBe(true);
  });

  it("accepts the name with stray spaces from copy-paste (the server trims it too) and sends it trimmed", async () => {
    del.mockResolvedValue({ deleted: true });
    const { onDeleted } = mount();
    await screen.findByText(/340/);

    typeName("  Tulas University \n");
    typePassword("my-password");
    expect(deleteButton().disabled).toBe(false);
    fireEvent.click(deleteButton());

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(del).toHaveBeenCalledWith("/superadmin/colleges/9", { password: "my-password", confirm_name: "Tulas University" });
  });

  it("says why the button is still locked while the typed name doesn't match, and clears the hint once it does", async () => {
    mount();
    await screen.findByText(/340/);

    expect(screen.queryByText(/doesn.t match yet/i)).toBeNull(); // nothing typed yet: no nagging
    typeName("tulas university");
    expect(screen.getByText(/doesn.t match yet/i)).toBeTruthy();
    typeName("Tulas University");
    expect(screen.queryByText(/doesn.t match yet/i)).toBeNull();
  });

  it("does not tell them to retry when the server never answered — a big delete may still be running", async () => {
    del.mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    await screen.findByText(/340/);

    typeName("Tulas University");
    typePassword("pw");
    fireEvent.click(deleteButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/may still be deleting/i);
    expect(alert.textContent).toMatch(/refresh the list/i);
  });

  it("sends the confirmation to the server and reports success", async () => {
    del.mockResolvedValue({ deleted: true });
    const { onDeleted } = mount();
    await screen.findByText(/340/);

    typeName("Tulas University");
    typePassword("my-password");
    fireEvent.click(deleteButton());

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("Tulas University"));
    expect(del).toHaveBeenCalledWith("/superadmin/colleges/9", { password: "my-password", confirm_name: "Tulas University" });
  });

  it("shows the server's refusal in the dialog and lets them try again", async () => {
    del.mockRejectedValue(new ApiError("That is not your password. Enter the password you sign in with.", 422));
    const { onDeleted } = mount();
    await screen.findByText(/340/);

    typeName("Tulas University");
    typePassword("typo");
    fireEvent.click(deleteButton());

    expect((await screen.findByRole("alert")).textContent).toContain("not your password");
    expect(onDeleted).not.toHaveBeenCalled();
    expect(deleteButton().disabled).toBe(false);
  });

  it("will not offer the delete if it could not load what the delete would do", async () => {
    get.mockRejectedValue(new ApiError("Server Error", 500));
    render(<DeleteCollegeModal college={COLLEGE} onClose={vi.fn()} onDeleted={vi.fn()} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Server Error");
    typeName("Tulas University");
    typePassword("pw");
    expect(deleteButton().disabled).toBe(true);
  });
});

describe("PartnerCollegesPanel delete button", () => {
  const college = {
    id: 9, name: "Tulas University", short_code: "TU", tier: "Standard", placement_rate: "0", is_active: true, active_students_count: 0,
    created_at: "2026-10-01T00:00:00Z", users: [], subscription_days_remaining: 30, subscription_status: "active", subscription_is_trial: false, plan_max_students: 500,
  };

  it("is shown only when the superadmin page asks for it (the panel is shared with Mellow Ops staff)", async () => {
    get.mockResolvedValue({ colleges: [college] });

    const { unmount } = render(<PartnerCollegesPanel triggerToast={toast} />);
    await screen.findByText("Tulas University");
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
    unmount();

    render(<PartnerCollegesPanel triggerToast={toast} canDeleteColleges />);
    await screen.findByText("Tulas University");
    expect(screen.getByRole("button", { name: /delete/i })).toBeTruthy();
  });
});

describe("AccountsPanel", () => {
  const accounts = [
    { id: 1, name: "Super Admin", email: "root@mellow.test", handle: "root", role: "superadmin", is_blocked: false, must_change_password: false, college: null },
    { id: 2, name: "Dr. Arun Kumar", email: "arun@tulas.test", handle: "arun", role: "admin_tpo", is_blocked: false, must_change_password: true, credentials_email_sent_at: null, college: { id: 9, name: "Tulas University" } },
    { id: 3, name: "Riya", email: "riya@tulas.test", handle: "riya", role: "user", is_blocked: false, must_change_password: false, credentials_email_sent_at: "2026-10-01T10:00:00Z", college: { id: 9, name: "Tulas University" } },
  ];

  const FACETS = {
    roles: { superadmin: 1, admin_tpo: 1, user: 1 },
    colleges: [
      { id: 9, name: "Tulas University", short_code: "TUL", city: "Dehradun", accounts: 2 },
      { id: 12, name: "Sharda University", short_code: "SHA", city: "Greater Noida", accounts: 0 },
    ],
    without_college: 1,
  };

  const respond = (rows: unknown[] = accounts) =>
    get.mockImplementation((path: string) => {
      if (path.startsWith("/superadmin/users/facets")) return Promise.resolve(FACETS);
      if (path.startsWith("/superadmin/credentials/status")) return Promise.resolve({ unlocked: false });
      return Promise.resolve({ data: rows, current_page: 1, last_page: 1, total: rows.length });
    });

  const open = async () => {
    respond();
    render(<AccountsPanel triggerToast={toast} />);
    await screen.findByText("Dr. Arun Kumar");
  };
  const resetButtons = () => screen.getAllByRole("button", { name: /^change password$/i });

  it("lists every account with its login ID and whether it is still on the temporary password", async () => {
    await open();

    expect(screen.getByText("arun@tulas.test")).toBeTruthy();
    expect(screen.getByText(/temporary — not changed yet/i)).toBeTruthy();
    expect(screen.getAllByText(/set by user/i)).toHaveLength(2); // the superadmin and the student
  });

  it("offers no reset for a superadmin account", async () => {
    await open();

    expect(resetButtons()).toHaveLength(2); // the TPO and the student, not the superadmin
    expect(screen.getByText(/managed by owner/i)).toBeTruthy();
  });

  it("resets after confirming with the superadmin's password, then shows the new login once", async () => {
    post.mockResolvedValue({ temporary_password: "Temp-Pass-123!", credentials_email_sent: true });
    await open();

    fireEvent.click(resetButtons()[0]);
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: /reset & show password/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "my-password" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    expect(await within(dialog).findByText("Temp-Pass-123!")).toBeTruthy();
    expect(within(dialog).getByText("arun@tulas.test")).toBeTruthy();
    expect(within(dialog).getByText(/emailed to arun@tulas.test/i)).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/superadmin/users/2/reset-password", { password: "my-password", send_email: true });
  });

  it("says plainly when the email could not be sent, and when it wasn't asked for", async () => {
    post.mockResolvedValueOnce({ temporary_password: "A-1", credentials_email_sent: false });
    await open();
    fireEvent.click(resetButtons()[0]);
    let dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "pw" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /reset & show password/i }));
    expect(await within(dialog).findByText(/could not be sent — pass the password on yourself/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /^done$/i }));

    post.mockResolvedValueOnce({ temporary_password: "B-2", credentials_email_sent: null });
    fireEvent.click(resetButtons()[1]);
    dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("checkbox")); // untick "also email it"
    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "pw" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /reset & show password/i }));
    expect(await within(dialog).findByText(/not emailed/i)).toBeTruthy();
    expect(post).toHaveBeenLastCalledWith("/superadmin/users/3/reset-password", { password: "pw", send_email: false });
  });

  it("keeps the dialog on the confirm step with an inline error when the password is wrong", async () => {
    post.mockRejectedValue(new ApiError("That is not your password. Enter the password you sign in with.", 422));
    await open();

    fireEvent.click(resetButtons()[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "typo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /reset & show password/i }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("not your password");
    expect(within(dialog).queryByText(/new temporary password/i)).toBeNull();
  });
});
