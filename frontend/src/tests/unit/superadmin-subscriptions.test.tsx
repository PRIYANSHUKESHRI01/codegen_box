import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { AdminSubscriptionRow, AdminSubscriptionsResponse } from "@/types/adminSubscriptions";
import type { AdminPlan, AdminPlansResponse } from "@/types/pricing";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: vi.fn(), delete: vi.fn() } };
});

import { SubscriptionsPanel } from "@/components/admin/superadmin/SubscriptionsPanel";

const toast = vi.fn();

const ENT = { practice_problems_per_day: null, mock_interviews_per_day: null, free_trial_uses: null, drive_access: true, hackathon_access: true, vault_access: true, project_lab_access: true, workspace_hours_per_month: null, active_projects: null };
const LIMITS = {
  max_practice_problems_per_day: null,
  max_mock_interviews_per_day: null,
  max_learning_centre_ai_attempts_per_day: null,
  feature_trial_uses: null,
  drive_access: true,
  hackathon_access: true,
  vault_access: true,
  project_lab_access: true,
  max_workspace_hours_per_month: null,
  max_active_projects: null,
};

const plan = (code: string, name: string, list: number, sale: number, over: Partial<AdminPlan> = {}): AdminPlan => ({
  id: 1, code, name, list_price: list, discount_percent: 0, discount_amount: list - sale, sale_price: sale,
  term_days: list === 0 ? null : 365, term_unit: list === 0 ? null : "year", is_free: list === 0, contact_only: false, is_editable: list > 0, is_active: true,
  active_subscribers: 0, pricing_updated_by_name: null, pricing_updated_at: null, version: "v", entitlements: ENT, limits: LIMITS, limits_version: "lv",
  ...over,
});

const PLANS: AdminPlansResponse = {
  currency: "INR",
  limits: { max_list_price: 500000, max_discount_percent: 90 },
  plans: [
    plan("coder", "Coder", 0, 0),
    plan("expert", "Expert", 4999, 2999),
    // Mellow Academy: sold by the team, no price, three years.
    plan("grandmaster", "Grandmaster", 0, 0, { contact_only: true, is_free: false, is_editable: false, term_days: 1095, term_unit: "3 years" }),
  ],
};

const row = (over: Partial<AdminSubscriptionRow> & { id: number }): AdminSubscriptionRow => ({
  state: "active",
  plan: { code: "grandmaster", name: "Grandmaster", audience: "individual", kind: "base", is_free: false },
  subscriber: { type: "user", id: 10 + over.id, name: `Student ${over.id}`, email: `s${over.id}@example.com`, detail: null },
  source: "purchase",
  is_trial: false,
  started_at: "2026-10-01T00:00:00Z",
  current_period_end: "2027-10-01T00:00:00Z",
  days_remaining: 351,
  canceled_at: null,
  price_paid: 2999,
  complimentary: false,
  paid_through_gateway: true,
  payment_reference: null,
  granted_by: null,
  reason: null,
  canceled_by: null,
  cancel_reason: null,
  extensions: 0,
  can_extend: true,
  can_cancel: true,
  ...over,
});

const COLLEGE_ROW = row({
  id: 3,
  plan: { code: "pro-campus", name: "Pro Campus", audience: "institution", kind: "base", is_free: false },
  subscriber: { type: "college", id: 7, name: "Tulas University", email: null, detail: "TU" },
  source: "admin_assigned",
  price_paid: null,
  paid_through_gateway: false,
});

const GIFT_ROW = row({ id: 2, source: "admin_grant", complimentary: true, price_paid: 0, paid_through_gateway: false, reason: "October contest winner", granted_by: "Aryan Varma" });

const LIST = (rows: AdminSubscriptionRow[] = [row({ id: 1 }), GIFT_ROW, COLLEGE_ROW]): AdminSubscriptionsResponse => ({
  summary: { paid_individual: 41, complimentary: 3, colleges: 5, companies: 1, ending_7_days: 2, canceled_30_days: 4 },
  subscriptions: rows,
  pagination: { current_page: 1, last_page: 1, total: rows.length },
});

const respond = (rows?: AdminSubscriptionRow[]) =>
  get.mockImplementation((path: string) => {
    if (path.startsWith("/superadmin/subscriptions")) return Promise.resolve(LIST(rows));
    if (path === "/superadmin/plans") return Promise.resolve(PLANS);
    if (path.startsWith("/superadmin/students/search")) {
      return Promise.resolve({
        students: [{ id: 55, name: "Anika Rao", email: "anika@example.com", college: null, is_blocked: false, plan_name: "Coder", plan_source: "individual", days_remaining: null }],
      });
    }
    return Promise.resolve({});
  });

const open = async (rows?: AdminSubscriptionRow[]) => {
  respond(rows);
  render(<SubscriptionsPanel triggerToast={toast} />);
  await screen.findByText("Student 1");
};

const lastListUrl = () => [...get.mock.calls].map((c) => String(c[0])).reverse().find((p) => p.startsWith("/superadmin/subscriptions")) ?? "";

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  toast.mockReset();
});

afterEach(cleanup);

describe("Superadmin → Subscriptions", () => {
  it("lists every holder with the plan, how they got it, its state, when it ends and what was paid", async () => {
    await open();

    expect(screen.getByText("Tulas University")).toBeTruthy();
    expect(screen.getByText("Given free by admin")).toBeTruthy();
    expect(screen.getByText("October contest winner")).toBeTruthy();
    expect(screen.getByText("by Aryan Varma")).toBeTruthy();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    // ₹2,999 paid by one, "Free" for the gift.
    expect(screen.getByText(/2,999/)).toBeTruthy();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(lastListUrl()).toBe("/superadmin/subscriptions?state=active");
  });

  it("shows the headline numbers, including how many were given free", async () => {
    await open();

    expect(screen.getByText("Paid students").nextSibling?.textContent).toBe("41");
    expect(screen.getByText("Given free").nextSibling?.textContent).toBe("3");
    expect(screen.getByText("Colleges").nextSibling?.textContent).toBe("5");
  });

  it("asks the server for exactly what the filters say", async () => {
    await open();

    fireEvent.click(screen.getByRole("button", { name: "Ended" }));
    await waitFor(() => expect(lastListUrl()).toBe("/superadmin/subscriptions?state=expired"));

    fireEvent.change(screen.getByLabelText("Filter by holder"), { target: { value: "institution" } });
    await waitFor(() => expect(lastListUrl()).toContain("audience=institution"));

    fireEvent.change(screen.getByLabelText("Filter by how it was obtained"), { target: { value: "admin_grant" } });
    await waitFor(() => expect(lastListUrl()).toContain("source=admin_grant"));

    fireEvent.click(screen.getByLabelText("Show free plans"));
    await waitFor(() => expect(lastListUrl()).toContain("include_free=1"));

    fireEvent.change(screen.getByLabelText("Search subscriptions"), { target: { value: "anika" } });
    await waitFor(() => expect(lastListUrl()).toContain("q=anika"));
  });

  it("lists the plans ending within a week when that tile is pressed", async () => {
    await open();

    fireEvent.click(screen.getByRole("button", { name: /ending in 7 days/i }));

    await waitFor(() => expect(lastListUrl()).toContain("ending_within=7"));
  });

  it("only offers Extend and End where they can work", async () => {
    await open([row({ id: 1 }), row({ id: 2, state: "canceled", can_extend: false, can_cancel: false })]);

    expect(screen.getAllByRole("button", { name: /^Extend /i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^End /i })).toHaveLength(1);
  });

  it("says plainly when nothing matches, and when it can't load at all", async () => {
    await open();
    respond([]);
    fireEvent.click(screen.getByRole("button", { name: "Cancelled" }));
    expect(await screen.findByText("No subscriptions match.")).toBeTruthy();

    cleanup();
    get.mockReset();
    get.mockRejectedValue(new ApiError("Server Error", 500));
    render(<SubscriptionsPanel triggerToast={toast} />);
    expect((await screen.findByRole("alert")).textContent).toContain("Server Error");
  });
});

describe("Superadmin → Subscriptions — paging and racing requests", () => {
  const listCalls = () => get.mock.calls.map((c) => String(c[0])).filter((p) => p.startsWith("/superadmin/subscriptions"));

  const paged = (current: number, rows: AdminSubscriptionRow[] = [row({ id: 1 })]): AdminSubscriptionsResponse => ({
    ...LIST(rows),
    pagination: { current_page: current, last_page: 4, total: 100 },
  });

  it("starts again from page 1 with ONE request when a filter changes from a later page", async () => {
    get.mockImplementation((path: string) => Promise.resolve(path.startsWith("/superadmin/subscriptions") ? paged(path.includes("page=3") ? 3 : 1, [row({ id: path.includes("page=3") ? 33 : 1 })]) : {}));
    render(<SubscriptionsPanel triggerToast={toast} />);
    await screen.findByText("Student 1");

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(listCalls().some((p) => p.includes("page=2"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(listCalls().some((p) => p.includes("page=3"))).toBe(true));
    await screen.findByText("Student 33");

    get.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Ended" }));
    await screen.findByText("Student 1");

    // The old behaviour: a request for page 3 under the new filter, then a second for page 1 — and whichever answered last won.
    expect(listCalls()).toEqual(["/superadmin/subscriptions?state=expired"]);
  });

  it("does not let a slow answer for an old filter land on top of the current one", async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    get.mockImplementation((path: string) => {
      if (!path.startsWith("/superadmin/subscriptions")) return Promise.resolve({});
      if (path === "/superadmin/subscriptions?state=active") return Promise.resolve(LIST([row({ id: 1 })]));
      return new Promise((resolve) => (pending[new URL(path, "http://x").searchParams.get("state") ?? ""] = resolve));
    });
    render(<SubscriptionsPanel triggerToast={toast} />);
    await screen.findByText("Student 1");

    fireEvent.click(screen.getByRole("button", { name: "Cancelled" }));
    await waitFor(() => expect(pending["canceled"]).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Ended" }));
    await waitFor(() => expect(pending["expired"]).toBeTruthy());

    pending["expired"](LIST([row({ id: 5, state: "expired" })]));
    await screen.findByText("Student 5");
    pending["canceled"](LIST([row({ id: 6, state: "canceled" })]));
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.getByText("Student 5")).toBeTruthy();
    expect(screen.queryByText("Student 6")).toBeNull();
  });

  it("switches 'Ending in 7 days' off when Ended or Cancelled is chosen — it lists running plans only and could only be empty", async () => {
    await open();

    fireEvent.click(screen.getByRole("button", { name: /ending in 7 days/i }));
    await waitFor(() => expect(lastListUrl()).toContain("ending_within=7"));

    fireEvent.click(screen.getByRole("button", { name: "Ended" }));
    await waitFor(() => expect(lastListUrl()).toBe("/superadmin/subscriptions?state=expired"));
    expect(screen.getByRole("button", { name: /ending in 7 days/i }).getAttribute("aria-pressed")).toBe("false");
  });

  it("says how many subscriptions there are even when they fit on one page", async () => {
    await open();
    expect(screen.getByText("3 subscriptions")).toBeTruthy();
  });
});

describe("Give a plan", () => {
  const openGrant = async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /give a plan/i }));
    return await screen.findByRole("dialog");
  };

  const chooseAnika = async (dialog: HTMLElement) => {
    fireEvent.change(within(dialog).getByLabelText("Student"), { target: { value: "anika" } });
    fireEvent.click(await within(dialog).findByRole("button", { name: /Anika Rao/ }));
  };

  it("finds a student, defaults to Expert for its full year, and needs a reason before it will go", async () => {
    const dialog = await openGrant();
    await chooseAnika(dialog);

    const submit = within(dialog).getByRole("button", { name: /give plan now/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect((within(dialog).getByRole("radio", { name: /^expert/i }) as HTMLButtonElement).getAttribute("aria-checked")).toBe("true");
    expect((within(dialog).getByLabelText("Term (days)") as HTMLInputElement).value).toBe("365");

    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: "Won the October contest" } });
    expect(submit.disabled).toBe(false);
  });

  it("offers Grandmaster as Mellow Academy — no price, a three-year term — and gives it for that term", async () => {
    post.mockResolvedValue({ subscription: row({ id: 9, source: "admin_grant", complimentary: false, price_paid: 60000 }) });
    const dialog = await openGrant();
    await chooseAnika(dialog);

    const academy = within(dialog).getByRole("radio", { name: /grandmaster/i });
    expect(within(academy).getByText(/mellow academy — arranged by our team, 3 years term/i)).toBeTruthy();
    expect(within(academy).queryByText(/₹/)).toBeNull();

    fireEvent.click(academy);
    // The term follows the plan until the superadmin types their own.
    expect((within(dialog).getByLabelText("Term (days)") as HTMLInputElement).value).toBe("1095");
    expect(within(dialog).getByRole("button", { name: "3 years" })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("radio", { name: /paid outside the gateway/i }));
    fireEvent.change(within(dialog).getByLabelText(/amount received/i), { target: { value: "60000" } });
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: "Mellow Academy fee received" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /give plan now/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith("/superadmin/users/55/subscription", expect.objectContaining({ plan_code: "grandmaster", days: 1095, kind: "offline_payment", amount: 60000 }));
  });

  it("gives a complimentary plan: sends the plan, term and reason, then tells the superadmin it is live", async () => {
    post.mockResolvedValue({
      subscription: row({ id: 9, source: "admin_grant", complimentary: true, price_paid: 0, plan: { code: "expert", name: "Expert", audience: "individual", kind: "base", is_free: false } }),
    });
    const dialog = await openGrant();
    await chooseAnika(dialog);

    fireEvent.click(within(dialog).getByRole("button", { name: "90 days" }));
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: "Won the October contest" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /give plan now/i }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith("/superadmin/users/55/subscription", {
      plan_code: "expert",
      days: 90,
      kind: "complimentary",
      reason: "Won the October contest",
    });
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining("Anika Rao is now on Expert")));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("records an offline payment with its amount and reference, and will not go without the amount", async () => {
    post.mockResolvedValue({ subscription: row({ id: 9 }) });
    const dialog = await openGrant();
    await chooseAnika(dialog);
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: "Paid by bank transfer" } });
    fireEvent.click(within(dialog).getByRole("radio", { name: /paid outside the gateway/i }));

    const submit = within(dialog).getByRole("button", { name: /give plan now/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/amount received/i), { target: { value: "2999" } });
    fireEvent.change(within(dialog).getByLabelText(/reference/i), { target: { value: "UPI 4081" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith("/superadmin/users/55/subscription", expect.objectContaining({ kind: "offline_payment", amount: 2999, reference: "UPI 4081" }));
  });

  it("shows the server's refusal next to the field and lets them correct it", async () => {
    post.mockRejectedValue(new ApiError("The given data was invalid.", 422, { days: ["They already have 300 days of Grandmaster left. Use Extend to add time, or choose a longer term."] }));
    const dialog = await openGrant();
    await chooseAnika(dialog);
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: "Top-up" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /give plan now/i }));

    expect((await within(dialog).findByText(/Use Extend to add time/)).textContent).toContain("300 days");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: /give plan now/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Extend and end", () => {
  it("extends a running plan by the days entered, with a reason", async () => {
    post.mockResolvedValue({ subscription: row({ id: 1, current_period_end: "2027-11-01T00:00:00Z", extensions: 1 }) });
    await open();

    fireEvent.click(screen.getByRole("button", { name: /extend student 1's grandmaster/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "30 days" }));
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: "Contest outage" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /extend plan/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/subscriptions/1/extend", { days: 30, reason: "Contest outage" }));
  });

  it("ends a student's plan with just a reason — no password for one student's plan", async () => {
    post.mockResolvedValue({ subscription: row({ id: 1, state: "canceled" }) });
    await open();

    fireEvent.click(screen.getByRole("button", { name: /^end student 1's grandmaster/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText(/your password/i)).toBeNull();
    expect(within(dialog).getByText(/back to the free Coder plan/i)).toBeTruthy();
    // It was paid for online, so the dialog says plainly that ending it does not return the money.
    expect(within(dialog).getByText(/paid for online/i).textContent).toContain("refund from the payment gateway");

    const end = within(dialog).getByRole("button", { name: /end plan now/i }) as HTMLButtonElement;
    expect(end.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: "Wrong account" } });
    fireEvent.click(end);

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/subscriptions/1/cancel", { reason: "Wrong account" }));
  });

  it("asks a college's plan for the superadmin's password and says who it switches off", async () => {
    post.mockResolvedValue({ subscription: { ...COLLEGE_ROW, state: "canceled" } });
    await open();

    fireEvent.click(screen.getByRole("button", { name: /^end tulas university's pro campus/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/every student at this college stops being covered/i)).toBeTruthy();

    const end = within(dialog).getByRole("button", { name: /end plan now/i }) as HTMLButtonElement;
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: "Contract ended" } });
    expect(end.disabled).toBe(true); // still no password

    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "my-password" } });
    expect(end.disabled).toBe(false);
    fireEvent.click(end);

    await waitFor(() => expect(post).toHaveBeenCalledWith("/superadmin/subscriptions/3/cancel", { reason: "Contract ended", password: "my-password" }));
  });

  it("keeps the dialog open with the server's reason when it is refused", async () => {
    post.mockRejectedValue(new ApiError("The given data was invalid.", 422, { password: ["That is not your password. Enter the password you sign in with."] }));
    await open();

    fireEvent.click(screen.getByRole("button", { name: /^end tulas university's pro campus/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(/reason/i), { target: { value: "Contract ended" } });
    fireEvent.change(within(dialog).getByLabelText(/your password/i), { target: { value: "typo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /end plan now/i }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("not your password");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
