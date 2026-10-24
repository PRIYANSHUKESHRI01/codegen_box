import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { AdminPlan, PlanLimits } from "@/types/pricing";
import type { MySubscriptionResponse } from "@/types/subscription";

const get = vi.fn();
const put = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), put: (path: string, body?: unknown) => put(path, body), post: vi.fn(), delete: vi.fn() } };
});

import { PlanChip, isPlanEnded } from "@/components/billing/PlanChip";
import { PlanStatusCard } from "@/components/billing/PlanStatusCard";
import { PlanLimitsModal } from "@/components/admin/superadmin/PlanLimitsModal";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/projectLab";

// ───────────────────────────── the student's plan card & chip ─────────────────────────────

const coverage = (over: Partial<NonNullable<MySubscriptionResponse["coverage"]>> = {}): NonNullable<MySubscriptionResponse["coverage"]> => ({
  source: "individual",
  days_remaining: 120,
  is_trial: false,
  status: "active",
  started_at: "2026-06-15T00:00:00Z",
  current_period_end: "2027-02-15T00:00:00Z",
  plan: { code: "expert", name: "Expert", audience: "individual" },
  ...over,
});

const entitlements = (over: Partial<NonNullable<MySubscriptionResponse["entitlements"]>> = {}): NonNullable<MySubscriptionResponse["entitlements"]> => ({
  max_practice_problems_per_day: 10,
  practice_problems_used_today: 4,
  max_mock_interviews_per_day: 3,
  mock_interviews_used_today: 3,
  drive_access: true,
  hackathon_access: false,
  vault_access: false,
  feature_trial: null,
  ...over,
});

const lab = (enabled: boolean) => ({ enabled, source: enabled ? "plan" : "none", plan: null, days_remaining: null, period_ends_at: null, hours: { limit: 80, used: 20, remaining: 60 }, projects: { limit: 3, active: 1 }, upgrade: null }) as unknown as MySubscriptionResponse["project_lab"];

const response = (c = coverage(), e = entitlements(), labEnabled = false): MySubscriptionResponse => ({
  scope: "individual",
  coverage: c,
  entitlements: e,
  addons: [],
  project_lab: lab(labEnabled),
  checkout: { available: true, test_mode: true },
});

describe("PlanStatusCard — where the student stands", () => {
  afterEach(cleanup);

  it("shows the paid plan, how long is left, how much of today they have used and what is locked", () => {
    // A paid plan below the top one (what an old subscriber to a since-retired plan may still hold).
    render(<PlanStatusCard subscription={response(coverage({ plan: { code: "pro", name: "Pro", audience: "individual" } }))} />);

    expect(screen.getByRole("heading", { name: "Pro" })).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText(/120 days left/)).toBeTruthy();
    expect(screen.getByText("4 of 10 used")).toBeTruthy();
    // 3 of 3 interviews today: the meter says it is full.
    expect(screen.getByText("3 of 3 used").className).toContain("text-status-warning");
    expect(screen.getByRole("progressbar", { name: "Plan term used" })).toBeTruthy();

    const access = screen.getAllByRole("listitem");
    const text = (label: string) => access.find((li) => li.textContent?.includes(label))!.textContent;
    expect(text("Placement drives")).toContain("included");
    expect(text("Hack Arena")).toContain("not on your plan");
    expect(text("Project Lab")).toContain("not on your plan");
    expect(text("The Vault")).toContain("not on your plan");
    expect(screen.getByRole("link", { name: /compare plans/i }).getAttribute("href")).toBe("#plans");
  });

  it("shows the free plan's one-time tries and invites an upgrade", () => {
    const free = response(
      coverage({ days_remaining: null, current_period_end: null, plan: { code: "coder", name: "Coder", audience: "individual" } }),
      entitlements({ max_practice_problems_per_day: 1, practice_problems_used_today: 0, drive_access: false, feature_trial: { uses_per_feature: 1, used: { mock_interview: 1, speaking: 0, listening: 0, vocabulary: 0 } } })
    );
    render(<PlanStatusCard subscription={free} />);

    expect(screen.getByText("Free plan")).toBeTruthy();
    expect(screen.getByText("Your free tries")).toBeTruthy();
    expect(screen.getByText("Used — part of Expert")).toBeTruthy();
    expect(screen.getAllByText("0 of 1 used")).toHaveLength(4); // problems today + speaking, listening, vocabulary
    expect(screen.getByRole("link", { name: /see plans & upgrade/i })).toBeTruthy();
  });

  it("says an ended plan has ended and offers to renew it", () => {
    render(<PlanStatusCard subscription={response(coverage({ days_remaining: 0, current_period_end: "2026-10-01T00:00:00Z" }))} />);

    expect(screen.getByRole("heading", { name: "Your Expert plan has ended" })).toBeTruthy();
    expect(screen.getByText("Ended")).toBeTruthy();
    expect(screen.getByRole("link", { name: /renew your plan/i })).toBeTruthy();
  });

  it("says a college covers them and offers nothing to buy", () => {
    render(<PlanStatusCard subscription={response(coverage({ source: "institution", plan: { code: "pro-campus", name: "Pro Campus", audience: "institution" } }))} />);

    expect(screen.getByText("Covered by college")).toBeTruthy();
    expect(screen.getByText(/nothing to buy/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /upgrade|compare|renew/i })).toBeNull();
  });

  it("has nothing left to sell an Expert, who is shown Mellow Academy instead, and shows Project Lab hours", () => {
    render(<PlanStatusCard subscription={response(coverage(), entitlements({ hackathon_access: true, vault_access: true }), true)} />);

    expect(screen.getByRole("heading", { name: "Expert" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /upgrade|compare|renew/i })).toBeNull();
    expect(screen.getByRole("link", { name: /explore mellow academy/i }).getAttribute("href")).toBe("#plans");
    expect(screen.getByText(/60 of 80 workspace hours left/)).toBeTruthy();
  });

  it("labels a Grandmaster student as a Mellow Academy student and offers them nothing to buy", () => {
    render(<PlanStatusCard subscription={response(coverage({ days_remaining: 900, plan: { code: "grandmaster", name: "Grandmaster", audience: "individual" } }), entitlements({ hackathon_access: true, vault_access: true }), true)} />);

    expect(screen.getByRole("heading", { name: "Grandmaster" })).toBeTruthy();
    expect(screen.getByText("Mellow Academy")).toBeTruthy();
    expect(screen.getByText(/900 days left/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /upgrade|compare|renew|explore/i })).toBeNull();
  });

  it("tells a not-yet-ended paid plan from an ended one", () => {
    expect(isPlanEnded(coverage())).toBe(false);
    expect(isPlanEnded(coverage({ days_remaining: 0 }))).toBe(true);
    expect(isPlanEnded(coverage({ days_remaining: 0, plan: { code: "coder", name: "Coder", audience: "individual" } }))).toBe(false);
    expect(isPlanEnded(coverage({ source: "institution", days_remaining: 0 }))).toBe(false);
    expect(isPlanEnded(null)).toBe(false);
  });
});

describe("PlanChip — the plan, always on screen", () => {
  beforeEach(() => get.mockReset());
  afterEach(cleanup);

  const chip = async (c: MySubscriptionResponse["coverage"]) => {
    get.mockResolvedValue(response(c as NonNullable<typeof c>));
    render(<PlanChip />);
    return await screen.findByTestId("plan-chip");
  };

  it("points a free student at pricing, with the upgrade nudge", async () => {
    const el = await chip(coverage({ days_remaining: null, plan: { code: "coder", name: "Coder", audience: "individual" } }));

    expect(el.getAttribute("href")).toBe("/dashboard/billing");
    expect(el.textContent).toContain("Coder");
    expect(el.textContent).toContain("Upgrade");
  });

  it("shows the top plans without a nudge, an ended plan with a renew warning, and a college plan as read-only", async () => {
    expect((await chip(coverage())).textContent).toBe("Expert");
    cleanup();
    expect((await chip(coverage({ plan: { code: "grandmaster", name: "Grandmaster", audience: "individual" } }))).textContent).toBe("Grandmaster");
    cleanup();
    const ended = await chip(coverage({ days_remaining: 0 }));
    expect(ended.textContent).toContain("Expert plan ended");
    expect(ended.textContent).toContain("Renew");
    cleanup();
    expect((await chip(coverage({ source: "institution", plan: { code: "pro-campus", name: "Pro Campus", audience: "institution" } }))).textContent).toBe("Campus plan");
  });

  it("shows nothing until it knows, rather than a wrong plan — then shows the real one", async () => {
    let answer!: (value: MySubscriptionResponse) => void;
    get.mockReturnValue(new Promise<MySubscriptionResponse>((resolve) => (answer = resolve)));
    render(<PlanChip />);

    expect(screen.queryByTestId("plan-chip")).toBeNull();

    answer(response(coverage({ plan: { code: "grandmaster", name: "Grandmaster", audience: "individual" } })));
    expect((await screen.findByTestId("plan-chip")).textContent).toBe("Grandmaster");
  });

  it("follows the plan when something announces a change", async () => {
    const el = await chip(coverage({ days_remaining: null, plan: { code: "coder", name: "Coder", audience: "individual" } }));
    expect(el.textContent).toContain("Coder");

    get.mockResolvedValue(response(coverage({ plan: { code: "grandmaster", name: "Grandmaster", audience: "individual" } })));
    window.dispatchEvent(new Event(SUBSCRIPTION_CHANGED_EVENT));

    await waitFor(() => expect(screen.getByTestId("plan-chip").textContent).toBe("Grandmaster"));
  });
});

// ───────────────────────────── the superadmin's limits editor ─────────────────────────────

const LIMITS: PlanLimits = {
  max_practice_problems_per_day: 10,
  max_mock_interviews_per_day: 3,
  max_learning_centre_ai_attempts_per_day: null,
  feature_trial_uses: null,
  drive_access: true,
  hackathon_access: false,
  vault_access: false,
  project_lab_access: false,
  max_workspace_hours_per_month: null,
  max_active_projects: null,
  max_core_practice_per_day: null,
  core_tests_access: false,
};

const PLAN = (over: Partial<AdminPlan> = {}): AdminPlan =>
  ({
    id: 2, code: "expert", name: "Expert", list_price: 4999, discount_percent: 40, discount_amount: 2000, sale_price: 2999, term_days: 365, term_unit: "year", is_free: false, contact_only: false,
    is_editable: true, is_active: true, active_subscribers: 7, pricing_updated_by_name: null, pricing_updated_at: null, version: "v", entitlements: {} as AdminPlan["entitlements"],
    limits: LIMITS, limits_version: "lv-1", ...over,
  }) as AdminPlan;

describe("PlanLimitsModal — what a plan includes", () => {
  const onClose = vi.fn();
  const onSaved = vi.fn();

  beforeEach(() => {
    put.mockReset();
    onClose.mockReset();
    onSaved.mockReset();
  });
  afterEach(cleanup);

  const mount = (plan = PLAN()) => {
    render(<PlanLimitsModal plan={plan} onClose={onClose} onSaved={onSaved} />);
    return screen.getByRole("dialog");
  };
  const save = () => screen.getByRole("button", { name: /save & apply now/i }) as HTMLButtonElement;

  it("says who is affected and starts with nothing to save", () => {
    const dialog = mount();

    expect(within(dialog).getByText("7 students are on this plan now")).toBeTruthy();
    expect(within(dialog).getByText(/everyone already on Expert/i)).toBeTruthy();
    expect(save().disabled).toBe(true);
    expect((within(dialog).getByLabelText("Coding problems per day") as HTMLInputElement).value).toBe("10");
  });

  it("sends the COMPLETE set of limits, with the version it started from, when one thing changes", async () => {
    put.mockResolvedValue({ plan: PLAN({ limits: { ...LIMITS, max_practice_problems_per_day: 25 } }) });
    const dialog = mount();

    fireEvent.change(within(dialog).getByLabelText("Coding problems per day"), { target: { value: "25" } });
    fireEvent.click(save());

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/plans/expert/entitlements", { ...LIMITS, max_practice_problems_per_day: 25, version: "lv-1" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("says 'unlimited' with null, never by leaving a number blank", async () => {
    put.mockResolvedValue({ plan: PLAN() });
    const dialog = mount();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /coding problems per day: unlimited/i }));
    expect((within(dialog).getByLabelText("Coding problems per day") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(save());

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/plans/expert/entitlements", expect.objectContaining({ max_practice_problems_per_day: null })));
  });

  it("switches access on and off", async () => {
    put.mockResolvedValue({ plan: PLAN() });
    const dialog = mount();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /hack arena/i }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /the vault/i }));
    fireEvent.click(save());

    await waitFor(() => expect(put).toHaveBeenCalledWith("/superadmin/plans/expert/entitlements", expect.objectContaining({ hackathon_access: true, vault_access: true })));
  });

  it("refuses out-of-range and non-numeric values before they leave the browser", () => {
    const dialog = mount();

    fireEvent.change(within(dialog).getByLabelText("Coding problems per day"), { target: { value: "0" } });
    expect(within(dialog).getByText("Between 1 and 1000.")).toBeTruthy();
    expect(save().disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Coding problems per day"), { target: { value: "lots" } });
    expect(within(dialog).getByText("Enter a whole number.")).toBeTruthy();
    expect(save().disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText("Coding problems per day"), { target: { value: "12" } });
    expect(save().disabled).toBe(false);
  });

  it("only shows the Project Lab numbers while Project Lab is on, and a bad hidden value cannot block a save", async () => {
    put.mockResolvedValue({ plan: PLAN() });
    const dialog = mount();
    expect(within(dialog).queryByLabelText("Project Lab hours per month")).toBeNull();

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /^project lab build guided/i }));
    const hours = within(dialog).getByLabelText("Project Lab hours per month");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /project lab hours per month: unlimited/i })); // untick: back to a typed value
    fireEvent.change(hours, { target: { value: "oops" } });
    expect(save().disabled).toBe(true);

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /^project lab build guided/i })); // off again: the field is gone, so it cannot block
    expect(within(dialog).queryByLabelText("Project Lab hours per month")).toBeNull();
    // (Back at the original values, so there is rightly nothing to save yet.)
    expect(save().disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Coding problems per day"), { target: { value: "12" } });
    expect(save().disabled).toBe(false);
  });

  it("warns — without blocking — when a change would give the free plan away", () => {
    const dialog = mount(PLAN({ id: 1, code: "coder", name: "Coder", is_free: true, list_price: 0, limits: { ...LIMITS, max_practice_problems_per_day: 1, feature_trial_uses: 1 } }));

    fireEvent.click(within(dialog).getByRole("checkbox", { name: /coding problems per day: unlimited/i }));

    expect(within(dialog).getByRole("status").textContent).toContain("free plan would have unlimited practice problems");
    expect(save().disabled).toBe(false);
  });

  it("shows the server's refusal — such as someone else having changed the plan — and keeps the editor open", async () => {
    put.mockRejectedValue(new ApiError("The given data was invalid.", 422, { version: ["The Expert plan was changed by someone else while you were editing. Reload to see the latest."] }));
    const dialog = mount();

    fireEvent.change(within(dialog).getByLabelText("Coding problems per day"), { target: { value: "30" } });
    fireEvent.click(save());

    expect((await within(dialog).findByRole("alert")).textContent).toContain("changed by someone else");
    expect(onSaved).not.toHaveBeenCalled();
    expect(save().disabled).toBe(false);
  });
});
