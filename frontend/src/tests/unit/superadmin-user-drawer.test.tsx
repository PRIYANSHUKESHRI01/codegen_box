import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { AdminSubscriptionRow, ManagedUserResponse } from "@/types/adminSubscriptions";

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      get: (path: string) => get(path),
      post: (path: string, body?: unknown) => post(path, body),
      put: (path: string, body?: unknown) => put(path, body),
      delete: (path: string, body?: unknown) => del(path, body),
    },
  };
});

const beginImpersonation = vi.fn();
vi.mock("@/lib/impersonation", async () => {
  const actual = await vi.importActual<typeof import("@/lib/impersonation")>("@/lib/impersonation");
  return { ...actual, beginImpersonation: (...args: unknown[]) => beginImpersonation(...args) };
});

import { UserManageDrawer } from "@/components/admin/superadmin/UserManageDrawer";

const toast = vi.fn();
const onClose = vi.fn();
const onChanged = vi.fn();

const sub = (over: Partial<AdminSubscriptionRow> & { id: number }): AdminSubscriptionRow => ({
  state: "active",
  plan: { code: "grandmaster", name: "Grandmaster", audience: "individual", kind: "base", is_free: false },
  subscriber: { type: "user", id: 5, name: "Anika Rao", email: "anika@example.com", detail: null },
  source: "admin_grant",
  is_trial: false,
  started_at: "2026-10-01T00:00:00Z",
  current_period_end: "2027-01-01T00:00:00Z",
  days_remaining: 80,
  canceled_at: null,
  price_paid: 0,
  complimentary: true,
  paid_through_gateway: false,
  payment_reference: null,
  granted_by: "Aryan Varma",
  reason: "October contest winner",
  canceled_by: null,
  cancel_reason: null,
  extensions: 0,
  can_extend: true,
  can_cancel: true,
  ...over,
});

const ALL = { edit: true, reset_password: true, revoke_sessions: true, view_as: true, delete: true, grant_plan: true, block: true };

const managed = (over: Partial<ManagedUserResponse> = {}): ManagedUserResponse => ({
  user: {
    id: 5, name: "Anika Rao", email: "anika@example.com", handle: "anika", phone: "9000000001", phone_verified: true, role: "user",
    college: null, company: null, section: null, roll_number: "21CS001", branch: "CSE", cgpa: "8.40", backlogs: 0, permissions: null,
    is_blocked: false, blocked_reason: null, blocked_at: null, blocked_by: null, created_at: "2026-09-01T00:00:00Z", last_seen_at: null, lead_status: "new", is_lead: true,
  },
  login: { login_id: "anika@example.com", password_state: "set_by_user", credentials_email_sent_at: null, last_seen_at: null, active_sessions: 2 },
  plan: {
    coverage: { source: "individual", days_remaining: 80, is_trial: false, status: "active", started_at: "2026-10-01T00:00:00Z", current_period_end: "2027-01-01T00:00:00Z", plan: { code: "grandmaster", name: "Grandmaster", audience: "individual" } },
    covered_by_college: false,
    college_name: null,
    history: [sub({ id: 1 }), sub({ id: 2, state: "canceled", source: "purchase", complimentary: false, price_paid: 1199, granted_by: null, reason: null, cancel_reason: "Refunded", canceled_by: "Aryan Varma", can_extend: false, can_cancel: false, plan: { code: "expert", name: "Expert", audience: "individual", kind: "base", is_free: false } })],
    addons: [],
  },
  payments: [],
  activity: [
    { id: 1, action: "Granted a complimentary plan", by: "Aryan Varma", by_role: "superadmin", meta: { plan_code: "grandmaster", days: 90, reason: "October contest winner" }, created_at: new Date().toISOString() },
    { id: 2, action: "Subscribed to a plan", by: "self", by_role: "user", meta: null, created_at: "2026-10-01T00:00:00Z" },
  ],
  capabilities: ALL,
  ...over,
});

const DETAIL = {
  user: { readiness_score: 72, readiness_tier: "In Progress" },
  stats: { solved_by_difficulty: { total_solved: 41 }, solved_score: 120, streak: { current: 4, max: 9 } },
};

const open = async (data: ManagedUserResponse = managed(), tab?: "overview" | "plan" | "security" | "activity") => {
  get.mockImplementation((path: string) => {
    if (path === `/superadmin/users/${data.user.id}/manage`) return Promise.resolve(data);
    if (path === `/superadmin/users/${data.user.id}/detail`) return Promise.resolve(DETAIL);
    if (path === "/superadmin/plans") return Promise.resolve({ currency: "INR", limits: { max_list_price: 1, max_discount_percent: 1 }, plans: [] });
    if (path === "/admin/colleges") return Promise.resolve({ colleges: [{ id: 1, name: "Apex Institute" }, { id: 2, name: "Meridian College" }] });
    if (path.endsWith("/deletion-preview")) return Promise.resolve({ user: { id: 5, name: "Anika Rao", email: "anika@example.com", role: "user" }, impact: { practice_submissions: 12, contest_entries: 1, interview_sessions: 0, drive_applications: 0, subscriptions: 2, payments_kept: 1 } });
    return Promise.resolve({});
  });
  render(<UserManageDrawer userId={data.user.id} onClose={onClose} onChanged={onChanged} triggerToast={toast} initialTab={tab} />);
  await screen.findByRole("heading", { name: data.user.name });
};

const tab = (name: RegExp) => fireEvent.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  [get, post, put, del, toast, onClose, onChanged, beginImpersonation].forEach((m) => m.mockReset());
});

afterEach(cleanup);

describe("Manage account — the drawer", () => {
  it("shows who they are, their role, plan and status at the top, and loads a student's numbers", async () => {
    await open();

    expect(screen.getByText("anika@example.com", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("Student / Coder")).toBeTruthy();
    expect(screen.getByText("Grandmaster")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(await screen.findByText("In Progress")).toBeTruthy();
    expect(screen.getByText("41")).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/superadmin/users/5/manage");
    expect(get).toHaveBeenCalledWith("/superadmin/users/5/detail");
  });

  it("does not ask for a student's performance numbers for a non-student", async () => {
    const tpo = managed({ plan: null, user: { ...managed().user, id: 8, name: "Dr. Arun Kumar", role: "admin_tpo", college: { id: 1, name: "Apex Institute" } }, capabilities: { ...ALL, grant_plan: false, delete: false } });
    await open(tpo);

    expect(get).not.toHaveBeenCalledWith("/superadmin/users/8/detail");
    expect(screen.getByText("College TPO")).toBeTruthy();
  });

  it("says plainly when the account can't be loaded and lets them retry", async () => {
    get.mockRejectedValue(new ApiError("Server Error", 500));
    render(<UserManageDrawer userId={5} onClose={onClose} onChanged={onChanged} triggerToast={toast} />);

    expect((await screen.findByRole("alert")).textContent).toContain("Server Error");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("closes on Escape and from the close button", async () => {
    await open();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("Overview — correcting details", () => {
  it("sends only the fields that changed", async () => {
    put.mockResolvedValue({ user: managed().user });
    await open();

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    const form = await screen.findByRole("form", { name: /edit account details/i });
    fireEvent.change(within(form).getByLabelText("Roll number"), { target: { value: "21CS002" } });
    fireEvent.click(within(form).getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/users/5", { roll_number: "21CS002" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining("updated")));
    expect(onChanged).toHaveBeenCalled();
  });

  it("has nothing to save until something changes, and warns that an email is a login", async () => {
    await open();

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    const form = await screen.findByRole("form", { name: /edit account details/i });
    const save = within(form).getByRole("button", { name: /save changes/i }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(within(form).getByLabelText(/email/i), { target: { value: "anika@new.test" } });
    expect(save.disabled).toBe(false);
    expect(within(form).getByText(/this is their login/i)).toBeTruthy();
  });

  it("shows the server's reason next to the field when it is refused", async () => {
    put.mockRejectedValue(new ApiError("The given data was invalid.", 422, { email: ["The email has already been taken."] }));
    await open();

    fireEvent.click(screen.getByRole("button", { name: /edit details/i }));
    const form = await screen.findByRole("form", { name: /edit account details/i });
    fireEvent.change(within(form).getByLabelText(/email/i), { target: { value: "taken@example.com" } });
    fireEvent.click(within(form).getByRole("button", { name: /save changes/i }));

    expect((await within(form).findByText("The email has already been taken.")).getAttribute("role")).toBe("alert");
    expect(toast).not.toHaveBeenCalled();
  });

  it("offers no editing for an account that can't be edited", async () => {
    await open(managed({ capabilities: { ...ALL, edit: false } }));

    expect(screen.queryByRole("button", { name: /edit details/i })).toBeNull();
  });
});

describe("Plan & billing tab", () => {
  it("shows the plan, its history with who gave it and why, and what was paid", async () => {
    await open(managed(), "plan");

    expect(screen.getByText("80 days left · until 1 Jan 2027")).toBeTruthy();
    expect(screen.getByText(/October contest winner/)).toBeTruthy();
    expect(screen.getByText(/Refunded/)).toBeTruthy();
    expect(screen.getAllByText("Given free by admin").length).toBeGreaterThan(0);
  });

  it("leaves the free plan's finished rows out of the history, since they only ever say 'Coder · cancelled'", async () => {
    const data = managed();
    data.plan!.history.push(
      sub({ id: 8, state: "canceled", source: "system", complimentary: false, price_paid: null, granted_by: null, reason: null, can_extend: false, can_cancel: false, plan: { code: "coder", name: "Coder", audience: "individual", kind: "base", is_free: true } })
    );
    await open(data, "plan");

    expect(screen.queryAllByText("Coder")).toHaveLength(0);
    // …while the paid plans, including the cancelled one, are still there.
    expect(screen.getByText("Expert")).toBeTruthy();
  });

  it("opens the give-a-plan dialog already pointed at this student, with no search to do", async () => {
    await open(managed(), "plan");

    fireEvent.click(screen.getByRole("button", { name: /change plan/i }));
    const dialog = await screen.findByRole("dialog", { name: /give a plan/i, hidden: false }).catch(() => screen.getAllByRole("dialog").at(-1)!);

    expect(within(dialog).getByText("Anika Rao · anika@example.com")).toBeTruthy();
    expect(within(dialog).queryByLabelText("Student")).toBeNull();
  });

  it("only offers Extend and End on a plan that is theirs and running", async () => {
    await open(managed(), "plan");
    expect(screen.getByRole("button", { name: /^extend$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /end plan/i })).toBeTruthy();

    cleanup();
    const free = managed();
    free.plan!.history = [sub({ id: 3, plan: { code: "coder", name: "Coder", audience: "individual", kind: "base", is_free: true }, source: "system", complimentary: false, price_paid: null, can_extend: false, can_cancel: false, granted_by: null, reason: null, current_period_end: null, days_remaining: null })];
    free.plan!.coverage = { ...free.plan!.coverage, plan: { code: "coder", name: "Coder", audience: "individual" }, days_remaining: null, current_period_end: null };
    await open(free, "plan");

    expect(screen.queryByRole("button", { name: /^extend$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /end plan/i })).toBeNull();
    expect(screen.getByRole("button", { name: /give a plan/i })).toBeTruthy();
  });

  it("explains that a college's plan governs a student it covers", async () => {
    const covered = managed();
    covered.plan!.covered_by_college = true;
    covered.plan!.college_name = "Apex Institute";
    await open(covered, "plan");

    expect(screen.getByText(/Included through Apex Institute/)).toBeTruthy();
    expect(screen.getByText(/applies only once the college's plan ends/i)).toBeTruthy();
  });

  it("says personal plans belong to students when the account isn't one", async () => {
    await open(managed({ plan: null, user: { ...managed().user, role: "admin_tpo", college: { id: 1, name: "Apex Institute" } }, capabilities: { ...ALL, grant_plan: false } }), "plan");

    expect(screen.getByText(/Personal plans belong to students/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /give a plan/i })).toBeNull();
  });
});

describe("Sign-in & access tab", () => {
  it("shows the login, never a password, and says why", async () => {
    await open(managed(), "security");

    expect(screen.getByText("anika@example.com", { selector: "dd" })).toBeTruthy();
    expect(screen.getByText("Set by user")).toBeTruthy();
    expect(screen.getByText(/can't be read back/i)).toBeTruthy();
    expect(screen.queryByText(/hash/i, { selector: "code, input" })).toBeNull();
  });

  it("flags an account that has never signed in with its temporary password", async () => {
    const fresh = managed();
    fresh.login.password_state = "temporary";
    await open(fresh, "security");

    expect(screen.getByText(/Temporary — not changed yet/)).toBeTruthy();
  });

  it("signs the account out of every device after one confirmation", async () => {
    post.mockResolvedValue({ revoked: 2 });
    await open(managed(), "security");

    fireEvent.click(screen.getByRole("button", { name: /sign out of all devices/i }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /sign them out/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/users/5/revoke-sessions", undefined));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Anika Rao was signed out of 2 devices."));
  });

  it("blocks with a reason and says it takes effect on their very next request", async () => {
    post.mockResolvedValue({ user: { is_blocked: true } });
    await open(managed(), "security");

    fireEvent.click(screen.getByRole("button", { name: /block account…/i }));
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: "Cheating in the contest" } });
    expect(screen.getByText(/very next request/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^block account$/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/users/5/toggle-block", { reason: "Cheating in the contest" }));
  });

  it("unblocks a blocked account, showing who blocked it and why", async () => {
    post.mockResolvedValue({ user: { is_blocked: false } });
    const blocked = managed();
    blocked.user = { ...blocked.user, is_blocked: true, blocked_reason: "Cheating", blocked_by: "Aryan Varma", blocked_at: new Date().toISOString() };
    await open(blocked, "security");

    expect(screen.getByText(/Cheating/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /unblock account/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/users/5/toggle-block", undefined));
  });

  it("resets the password through the existing confirm-then-reveal dialog", async () => {
    post.mockResolvedValue({ temporary_password: "Temp-Pass-123!", credentials_email_sent: null });
    await open(managed(), "security");

    fireEvent.click(screen.getByRole("button", { name: /reset password & show it/i }));
    const dialog = await screen.findAllByRole("dialog").then((all) => all.at(-1)!);
    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "my-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /reset & show password/i }));

    expect(await within(dialog).findByText("Temp-Pass-123!")).toBeTruthy();
    expect(post).toHaveBeenCalledWith("/superadmin/users/5/reset-password", { password: "my-password", send_email: true });
  });

  it("hides every tool the server says it won't allow", async () => {
    await open(managed({ capabilities: { edit: false, reset_password: false, revoke_sessions: false, view_as: false, delete: false, grant_plan: false, block: false } }), "security");

    for (const name of [/view as this user/i, /reset password/i, /sign out of all devices/i, /block account/i, /delete…/i]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });
});

describe("View as", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", { value: { ...window.location, assign: vi.fn() }, writable: true });
  });

  const openViewAs = async () => {
    await open(managed(), "security");
    fireEvent.click(screen.getByRole("button", { name: /view as this user/i }));
    return (await screen.findAllByRole("dialog")).at(-1)!;
  };

  it("spells out that it is read-only and asks for the superadmin's password", async () => {
    const dialog = await openViewAs();

    expect(within(dialog).getByText(/read-only/i)).toBeTruthy();
    expect(within(dialog).getByText(/60 minutes/)).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: /start viewing/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("starts the view and sends the browser to that account's own home", async () => {
    const res = { token: "viewing-token", user: { id: 5, name: "Anika Rao", role: "user" }, expires_at: "2026-10-15T12:00:00Z", minutes: 60 };
    post.mockResolvedValue(res);
    beginImpersonation.mockReturnValue("/dashboard");
    const dialog = await openViewAs();

    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "my-password" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /start viewing/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/users/5/impersonate", { password: "my-password" }));
    await waitFor(() => expect(beginImpersonation).toHaveBeenCalledWith(res));
    expect(window.location.assign).toHaveBeenCalledWith("/dashboard");
  });

  it("stays put with the server's reason when the password is wrong", async () => {
    post.mockRejectedValue(new ApiError("The given data was invalid.", 422, { password: ["That is not your password. Enter the password you sign in with."] }));
    const dialog = await openViewAs();

    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "typo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /start viewing/i }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("not your password");
    expect(beginImpersonation).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});

describe("Delete account", () => {
  const openDelete = async () => {
    await open(managed(), "security");
    fireEvent.click(screen.getByRole("button", { name: /delete…/i }));
    return (await screen.findAllByRole("dialog")).at(-1)!;
  };

  it("shows what will go and what is kept, and stays disabled until the email is typed AND the password entered", async () => {
    const dialog = await openDelete();

    expect(await within(dialog).findByText(/12/)).toBeTruthy();
    expect(within(dialog).getByText(/practice submissions/)).toBeTruthy();
    expect(within(dialog).getByText(/kept/i)).toBeTruthy();

    const submit = within(dialog).getByRole("button", { name: /permanently delete/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "my-password" } });
    expect(submit.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/to confirm$/i), { target: { value: "someone@else.com" } });
    expect(submit.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/to confirm$/i), { target: { value: "ANIKA@example.com" } });
    expect(submit.disabled).toBe(false);
  });

  it("deletes with the confirmation, tells the superadmin, and closes the drawer", async () => {
    del.mockResolvedValue({ deleted: true });
    const dialog = await openDelete();
    await within(dialog).findByText(/practice submissions/);

    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "my-password" } });
    fireEvent.change(within(dialog).getByLabelText(/to confirm$/i), { target: { value: "anika@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /permanently delete/i }));

    await waitFor(() => expect(del).toHaveBeenCalledWith("/superadmin/users/5", { password: "my-password", confirm_email: "anika@example.com" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Anika Rao's account was permanently deleted."));
    expect(onChanged).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("offers no delete for an account the server won't delete", async () => {
    await open(managed({ capabilities: { ...ALL, delete: false } }), "security");

    expect(screen.queryByRole("button", { name: /delete…/i })).toBeNull();
  });
});

describe("Activity tab", () => {
  it("lists what happened, who did it and the useful details", async () => {
    await open(managed(), "activity");

    expect(screen.getByText("Granted a complimentary plan")).toBeTruthy();
    expect(screen.getByText("By Aryan Varma")).toBeTruthy();
    expect(screen.getByText("Plan: grandmaster")).toBeTruthy();
    expect(screen.getByText("90 days")).toBeTruthy();
    expect(screen.getByText("By the account itself")).toBeTruthy();
  });

  it("says so when there is nothing yet", async () => {
    await open(managed({ activity: [] }), "activity");

    expect(screen.getByText(/nothing has been recorded/i)).toBeTruthy();
  });
});
