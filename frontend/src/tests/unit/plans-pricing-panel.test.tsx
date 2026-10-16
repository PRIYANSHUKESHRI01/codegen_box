import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { AdminPlan, AdminPlansResponse } from "@/types/pricing";

const get = vi.fn();
const put = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), put: (path: string, body?: unknown) => put(path, body), post: vi.fn(), delete: vi.fn() } };
});

import { PlansPricingPanel } from "@/components/admin/superadmin/PlansPricingPanel";
import { __resetPublicPlansForTests } from "@/lib/usePublicPlans";

const ENT = { practice_problems_per_day: null, mock_interviews_per_day: null, free_trial_uses: null, drive_access: true, hackathon_access: true, vault_access: true, project_lab_access: true, workspace_hours_per_month: null, active_projects: null };

const LIMITS = {
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
};

const plan = (code: string, name: string, list: number, pct: number, over: Partial<AdminPlan> = {}): AdminPlan => {
  const discount = pct === 0 ? 0 : list - Math.round((list * (100 - pct)) / 100);
  return {
    id: code === "coder" ? 1 : code === "expert" ? 2 : 3,
    code,
    name,
    list_price: list,
    discount_percent: pct,
    discount_amount: discount,
    sale_price: list - discount,
    term_days: list === 0 ? null : 365,
    term_unit: list === 0 ? null : "year",
    is_free: list === 0,
    contact_only: false,
    is_editable: list > 0,
    is_active: true,
    active_subscribers: 0,
    pricing_updated_by_name: null,
    pricing_updated_at: null,
    version: `${list}-${pct}`,
    entitlements: ENT,
    limits: LIMITS,
    limits_version: "limits-v1",
    ...over,
  };
};

const RESPONSE = (): AdminPlansResponse => ({
  currency: "INR",
  limits: { max_list_price: 500000, max_discount_percent: 90 },
  plans: [plan("coder", "Coder", 0, 0, { active_subscribers: 120 }), plan("expert", "Expert", 1999, 40, { active_subscribers: 7 }), plan("grandmaster", "Grandmaster", 0, 0, { active_subscribers: 2, contact_only: true, is_free: false, is_editable: false, term_days: 1095, term_unit: "3 years" })],
});

const toast = vi.fn();
const flush = () => act(async () => { await Promise.resolve(); });

const mount = async () => {
  get.mockImplementation((path: string) => (path === "/superadmin/plans" ? Promise.resolve(RESPONSE()) : Promise.resolve({ currency: "INR", plans: [] })));
  render(<PlansPricingPanel triggerToast={toast} />);
  await screen.findByRole("heading", { name: "Expert" });
};

const card = (name: string) => screen.getByRole("heading", { name }).closest("section") as HTMLElement;
const type = (label: RegExp, value: string, within_: HTMLElement) => fireEvent.change(within(within_).getByLabelText(label), { target: { value } });

beforeEach(() => {
  get.mockReset();
  put.mockReset();
  toast.mockReset();
  __resetPublicPlansForTests();
});

afterEach(cleanup);

describe("Superadmin → Plans & Pricing", () => {
  it("shows the three plans with who is on each and what students currently see", async () => {
    await mount();

    expect(within(card("Coder")).getByText("120 students on this plan")).toBeTruthy();
    expect(within(card("Expert")).getByText("7 students on this plan")).toBeTruthy();
    expect(within(card("Grandmaster")).getByText("2 students on this plan")).toBeTruthy();

    expect(within(card("Expert")).getByText("₹1,999").tagName).toBe("DEL");
    expect(within(card("Expert")).getByText("₹1,199")).toBeTruthy();
    expect(within(card("Expert")).getByText("Not changed since launch")).toBeTruthy();
  });

  it("shows Grandmaster as Mellow Academy: no price to set, and how to enrol someone", async () => {
    await mount();
    const academy = card("Grandmaster");

    expect(within(academy).getByText("Sold by our team")).toBeTruthy();
    expect(within(academy).getByText(/let.s talk/i)).toBeTruthy();
    expect(within(academy).queryByText(/₹/)).toBeNull();
    expect(within(academy).queryByLabelText(/list price/i)).toBeNull();
    expect(within(academy).queryByLabelText(/discount \(%\)/i)).toBeNull();
    expect(within(academy).queryByRole("button", { name: /review & save/i })).toBeNull();
    expect(within(academy).getByText(/no online price to set/i)).toBeTruthy();
    expect(within(academy).getByText(/Subscriptions → Give plan/)).toBeTruthy();
    expect(within(academy).getByText("No online price")).toBeTruthy();
    // What it includes is still the superadmin's to change.
    expect(within(academy).getByRole("button", { name: /edit limits/i })).toBeTruthy();
  });

  it("keeps the free plan read-only", async () => {
    await mount();

    expect(within(card("Coder")).queryByLabelText(/list price/i)).toBeNull();
    expect(within(card("Coder")).getByText("Always free")).toBeTruthy();
  });

  it("previews the new price as the superadmin types, before anything is saved", async () => {
    await mount();

    type(/list price/i, "2499", card("Expert"));
    type(/discount \(%\)/i, "20", card("Expert"));

    expect(within(card("Expert")).getByText("₹2,499").tagName).toBe("DEL");
    expect(within(card("Expert")).getByText("₹1,999")).toBeTruthy(); // 2,499 − 20%
    expect(within(card("Expert")).getByText(/20% off/i)).toBeTruthy();
    expect(put).not.toHaveBeenCalled();
  });

  it("has quick discount buttons, including one to remove the discount", async () => {
    await mount();

    fireEvent.click(within(card("Expert")).getByRole("button", { name: "None" }));

    expect((within(card("Expert")).getByLabelText(/discount \(%\)/i) as HTMLInputElement).value).toBe("0");
    expect(within(card("Expert")).getByText("₹1,999")).toBeTruthy();
    expect(within(card("Expert")).queryByText(/% off/i)).toBeNull();
  });

  it("will not let nonsense through, and says why", async () => {
    await mount();
    const review = () => within(card("Expert")).getByRole("button", { name: /review & save/i }) as HTMLButtonElement;

    expect(review().disabled).toBe(true); // nothing changed

    type(/list price/i, "abc", card("Expert"));
    expect(within(card("Expert")).getByText(/whole number of rupees/i)).toBeTruthy();
    expect(review().disabled).toBe(true);

    type(/list price/i, "0", card("Expert"));
    expect(review().disabled).toBe(true);

    type(/list price/i, "5000000", card("Expert"));
    expect(within(card("Expert")).getByText(/extra zero/i)).toBeTruthy();

    type(/list price/i, "1999", card("Expert"));
    type(/discount \(%\)/i, "400", card("Expert")); // meant 40
    expect(within(card("Expert")).getByText(/at most 90%/i)).toBeTruthy();
    expect(review().disabled).toBe(true);

    type(/discount \(%\)/i, "40", card("Expert"));
    expect(review().disabled).toBe(true); // back to what is live: nothing to save
  });

  it("asks for confirmation, showing exactly what changes, then goes live and tells every pricing page", async () => {
    await mount();
    put.mockResolvedValue({
      plan: plan("expert", "Expert", 2499, 20, { active_subscribers: 7, pricing_updated_by_name: "Asha Rao", pricing_updated_at: "2026-10-14T10:30:00+05:30" }),
    });

    type(/list price/i, "2499", card("Expert"));
    type(/discount \(%\)/i, "20", card("Expert"));
    fireEvent.click(within(card("Expert")).getByRole("button", { name: /review & save/i }));

    // The confirmation lays out before → after, and says what happens to current subscribers.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/go live with the new expert price/i)).toBeTruthy();
    const listRow = within(dialog).getByText("List price").closest("div") as HTMLElement;
    expect(within(listRow).getByText("₹1,999")).toBeTruthy();
    expect(within(listRow).getByText("₹2,499")).toBeTruthy();
    const payRow = within(dialog).getByText("Students pay").closest("div") as HTMLElement;
    expect(within(payRow).getByText("₹1,199")).toBeTruthy();
    expect(within(payRow).getByText("₹1,999")).toBeTruthy();
    expect(within(dialog).getByText(/7 students are on Expert now; they keep what they paid/i)).toBeTruthy();
    expect(put).not.toHaveBeenCalled();

    get.mockClear();
    fireEvent.click(within(dialog).getByRole("button", { name: /save & go live/i }));
    await flush();
    await flush();

    // The version the editor started from travels with the change, so a concurrent edit is refused, not overwritten.
    expect(put).toHaveBeenCalledWith("/superadmin/plans/expert", { list_price: 2499, discount_percent: 20, version: "1999-40" });
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/Expert pricing is live: ₹1,999 a year/));
    // Every open pricing page is told to re-read now.
    expect(get).toHaveBeenCalledWith("/public/plans");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(card("Expert")).getByText(/Last changed .* by Asha Rao/)).toBeTruthy();
  });

  it("refuses to overwrite a change someone else saved in the meantime, and offers a reload", async () => {
    await mount();
    put.mockRejectedValue(
      new ApiError("The given data was invalid.", 422, { version: ["The Expert plan was changed by someone else while you were editing. Reload to see the latest price."] })
    );

    type(/list price/i, "2200", card("Expert"));
    fireEvent.click(within(card("Expert")).getByRole("button", { name: /review & save/i }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /save & go live/i }));
    await flush();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toMatch(/changed by someone else/i);

    get.mockClear();
    fireEvent.click(within(dialog).getByRole("button", { name: /reload prices/i }));
    await flush();
    expect(get).toHaveBeenCalledWith("/superadmin/plans");
  });

  it("no longer warns about one plan undercutting another — Grandmaster has no price to compare", async () => {
    await mount();

    type(/list price/i, "100", card("Expert"));

    expect(screen.queryByText(/would cost less than/i)).toBeNull();
    expect((within(card("Expert")).getByRole("button", { name: /review & save/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("reset puts a card back to what is live", async () => {
    await mount();

    type(/list price/i, "3000", card("Expert"));
    fireEvent.click(within(card("Expert")).getByRole("button", { name: "Reset" }));

    expect((within(card("Expert")).getByLabelText(/list price/i) as HTMLInputElement).value).toBe("1999");
  });

  it("shows a retry when the plans can't be loaded", async () => {
    get.mockRejectedValue(new ApiError("Server error", 500));
    render(<PlansPricingPanel triggerToast={toast} />);

    expect((await screen.findByRole("alert")).textContent).toMatch(/server error/i);

    get.mockResolvedValue(RESPONSE());
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByRole("heading", { name: "Expert" })).toBeTruthy();
  });
});
