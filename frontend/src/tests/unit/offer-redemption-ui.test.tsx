import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { PublicPlan } from "@/types/pricing";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: vi.fn(), delete: vi.fn() },
  };
});

let auth: { user: unknown; status: string } = { user: null, status: "ready" };
vi.mock("@/lib/AuthContext", () => ({ useAuth: () => auth }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PricingPlans } from "@/components/pricing/PricingPlans";
import { PriceTag } from "@/components/pricing/PriceTag";
import { redeemOffer } from "@/lib/checkout";
import { isRedeemable } from "@/lib/pricing";
import { __resetPublicPlansForTests } from "@/lib/usePublicPlans";

const FULL = { practice_problems_per_day: null, mock_interviews_per_day: 10, free_trial_uses: null, drive_access: true, hackathon_access: true, vault_access: true, project_lab_access: true, workspace_hours_per_month: 80, active_projects: 3 };
const CODER = { practice_problems_per_day: 1, mock_interviews_per_day: null, free_trial_uses: 1, drive_access: false, hackathon_access: false, vault_access: false, project_lab_access: false, workspace_hours_per_month: null, active_projects: null };

const COIN: PublicPlan = { code: "coder", name: "Coder", list_price: 0, discount_percent: 0, discount_amount: 0, sale_price: 0, term_days: null, term_unit: null, is_free: true, contact_only: false, entitlements: CODER };
const ACADEMY: PublicPlan = { code: "grandmaster", name: "Grandmaster", list_price: 0, discount_percent: 0, discount_amount: 0, sale_price: 0, term_days: 1095, term_unit: "3 years", is_free: false, contact_only: true, entitlements: FULL };
const EXPERT_PAID: PublicPlan = { code: "expert", name: "Expert", list_price: 4999, discount_percent: 40, discount_amount: 2000, sale_price: 2999, term_days: 365, term_unit: "year", is_free: false, contact_only: false, redeemable: false, entitlements: FULL };
const EXPERT_FREE: PublicPlan = { ...EXPERT_PAID, discount_percent: 100, discount_amount: 4999, sale_price: 0, redeemable: true };

let plansOnServer: PublicPlan[];

const flush = () => act(async () => { await Promise.resolve(); });

const student = { id: 1, role: "user", college: null };
const coverageOn = (code: string, name: string, daysRemaining: number | null = null) => ({
  source: "individual" as const,
  days_remaining: daysRemaining,
  is_trial: false,
  status: "active" as const,
  started_at: null,
  current_period_end: null,
  plan: { code, name, audience: "individual" as const },
});
const onCoder = coverageOn("coder", "Coder");
const gatewayReady = { available: true, test_mode: true, gateway: "payu" as const, gateway_name: "PayU" };
const gatewayNotSetUp = { available: false, test_mode: true, gateway: null, gateway_name: null };

const REDEEMED = {
  scope: "individual",
  coverage: coverageOn("expert", "Expert", 365),
  redemption: { plan_code: "expert", plan_name: "Expert", current_period_end: "2027-10-28T00:00:00Z", days_remaining: 365 },
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  auth = { user: student, status: "ready" };
  plansOnServer = [COIN, EXPERT_FREE, ACADEMY];
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/dashboard/billing");
  __resetPublicPlansForTests();
  get.mockImplementation(async (path: string) => {
    if (path === "/public/plans") return { currency: "INR", plans: plansOnServer };
    throw new Error(`unexpected GET ${path}`);
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const mount = async (props: Partial<React.ComponentProps<typeof PricingPlans>> = {}) => {
  render(<PricingPlans coverage={onCoder} checkout={gatewayReady} {...props} />);
  await flush();
  await flush();
};

describe("a plan discounted by 100% is shown as free, not as ₹0", () => {
  it("the price tag says Free with the real price struck through", () => {
    const { container } = render(<PriceTag plan={EXPERT_FREE} />);

    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("₹4,999").tagName).toBe("DEL");
    expect(screen.getByText(/100% off/i)).toBeTruthy();
    expect(screen.getByText(/for a year/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/₹0\b/);
    expect(container.textContent).not.toMatch(/a month/i);
  });

  it("a plan that still costs something is untouched", () => {
    render(<PriceTag plan={EXPERT_PAID} />);

    expect(screen.getByText("₹2,999")).toBeTruthy();
    expect(screen.queryByText("Free")).toBeNull();
  });

  it("the free Coder plan and the team-sold plan are never read as an offer", () => {
    expect(isRedeemable(COIN)).toBe(false);
    expect(isRedeemable(ACADEMY)).toBe(false);
    expect(isRedeemable(EXPERT_PAID)).toBe(false);
    expect(isRedeemable(EXPERT_FREE)).toBe(true);
    // A price that has reached ₹0 on a priced plan is an offer even if the server's flag is missing (an older server / a stale poll).
    expect(isRedeemable({ ...EXPERT_FREE, redeemable: undefined })).toBe(true);
  });
});

describe("redeeming a free plan", () => {
  it("shows Redeem offer instead of a payment button", async () => {
    await mount();

    expect(screen.getByRole("button", { name: /redeem offer/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /upgrade to expert/i })).toBeNull();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText(/activated instantly — no payment details needed/i)).toBeTruthy();
    // Nothing on the page promises a payment that will not happen.
    expect(screen.queryByText(/secure payment by/i)).toBeNull();
  });

  it("one click activates the plan: no gateway, no redirect, no payment request", async () => {
    post.mockResolvedValue(REDEEMED);
    const onSubscribed = vi.fn();
    const submit = vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    await mount({ onSubscribed });

    fireEvent.click(screen.getByRole("button", { name: /redeem offer/i }));
    await flush();
    await flush();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/me/checkout/redeem", { plan_code: "expert", expected_total: 0 });
    expect(post).not.toHaveBeenCalledWith("/me/checkout", expect.anything());
    expect(submit).not.toHaveBeenCalled();
    expect(onSubscribed).toHaveBeenCalledWith(REDEEMED.coverage, "Expert");
  });

  it("works while the payment gateway is not set up yet", async () => {
    post.mockResolvedValue(REDEEMED);
    const onSubscribed = vi.fn();
    await mount({ checkout: gatewayNotSetUp, onSubscribed });

    // The "payments are being switched on" notice is about paid plans; here there is nothing to wait for.
    expect(screen.queryByText(/online payments are being switched on/i)).toBeNull();
    expect(screen.queryByText(/payments launching soon/i)).toBeNull();

    const redeem = screen.getByRole("button", { name: /redeem offer/i }) as HTMLButtonElement;
    expect(redeem.disabled).toBe(false);

    fireEvent.click(redeem);
    await flush();
    await flush();

    expect(onSubscribed).toHaveBeenCalledTimes(1);
  });

  it("a second click while the first is in flight sends nothing more", async () => {
    let finish: (value: unknown) => void = () => {};
    post.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await mount();

    const button = screen.getByRole("button", { name: /redeem offer/i });
    fireEvent.click(button);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /redeeming your offer/i }));
    await flush();

    expect(post).toHaveBeenCalledTimes(1);

    finish(REDEEMED);
    await flush();
    await flush();
  });

  it("a price that moved since the page loaded activates nothing and shows the fresh price", async () => {
    post.mockRejectedValue(new ApiError("The price changed.", 409, undefined, "price_changed"));
    const onSubscribed = vi.fn();
    await mount({ onSubscribed });

    // By the time they click, the superadmin has put the price back.
    plansOnServer = [COIN, EXPERT_PAID, ACADEMY];
    fireEvent.click(screen.getByRole("button", { name: /redeem offer/i }));
    await flush();
    await flush();
    await flush();

    expect(onSubscribed).not.toHaveBeenCalled();
    expect(screen.getByText(/this offer just changed, so nothing was activated/i)).toBeTruthy();
    expect(screen.getByText("₹2,999")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /redeem offer/i })).toBeNull();
  });

  it("says plainly when they already have the plan, instead of failing", async () => {
    post.mockRejectedValue(new ApiError("You already have Expert until 3 Nov 2027.", 409, undefined, "already_on_plan"));
    const onSubscribed = vi.fn();
    await mount({ onSubscribed });

    fireEvent.click(screen.getByRole("button", { name: /redeem offer/i }));
    await flush();
    await flush();

    expect(screen.getByText(/you already have expert until 3 nov 2027/i)).toBeTruthy();
    expect(onSubscribed).not.toHaveBeenCalled();
  });

  it("any other refusal is shown in the server's own words and the button works again", async () => {
    post.mockRejectedValueOnce(new ApiError("Your college already includes full access for you.", 409, undefined, "covered_by_institution"));
    await mount();

    fireEvent.click(screen.getByRole("button", { name: /redeem offer/i }));
    await flush();
    await flush();

    expect(screen.getByText(/your college already includes full access/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /redeem offer/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a student with days to spare sees no redeem button, only their current plan", async () => {
    await mount({ coverage: coverageOn("expert", "Expert", 200) });

    expect(screen.queryByRole("button", { name: /redeem offer/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /renew/i })).toBeNull();
    expect(screen.getByText(/your current plan/i)).toBeTruthy();
  });

  it("inside the last 30 days they can renew free, which redeems again", async () => {
    post.mockResolvedValue(REDEEMED);
    await mount({ coverage: coverageOn("expert", "Expert", 12) });

    fireEvent.click(screen.getByRole("button", { name: /renew free for another year/i }));
    await flush();
    await flush();

    expect(post).toHaveBeenCalledWith("/me/checkout/redeem", { plan_code: "expert", expected_total: 0 });
  });
});

describe("redeemOffer", () => {
  it("makes exactly one request for the free total and reports the new state", async () => {
    post.mockResolvedValue(REDEEMED);
    const phases: string[] = [];

    const outcome = await redeemOffer("expert", { onPhase: (p) => phases.push(p) });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/me/checkout/redeem", { plan_code: "expert", expected_total: 0 });
    expect(outcome).toEqual({ kind: "redeemed", state: REDEEMED });
    expect(phases).toEqual(["redeeming"]);
  });

  it("lets a refusal through for the screen to word — there is no payment that might have happened", async () => {
    post.mockRejectedValue(new ApiError("not free", 409, undefined, "payment_required"));

    await expect(redeemOffer("expert")).rejects.toMatchObject({ code: "payment_required" });
  });
});

describe("a plan with a price still goes to the payment gateway", () => {
  beforeEach(() => {
    plansOnServer = [COIN, EXPERT_PAID, ACADEMY];
  });

  it("keeps the payment button, the secure-payment note and never offers a redemption", async () => {
    await mount();

    expect(screen.queryByRole("button", { name: /redeem offer/i })).toBeNull();
    expect(screen.getByText(/secure payment by payu/i)).toBeTruthy();
    expect(screen.queryByText(/free offers are activated/i)).toBeNull();
    expect(screen.getByText("₹2,999")).toBeTruthy();
  });

  it("the buy click opens a checkout, not a redemption", async () => {
    post.mockResolvedValue({ checkout: { gateway: "payu", action: "https://test.payu.in/_payment", method: "POST", fields: { txnid: "T" }, amount: 299900, currency: "INR", reference: "R", test_mode: true }, quote: { total: 2999, currency: "INR" } });
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(() => {});
    await mount();

    fireEvent.click(screen.getByRole("button", { name: /expert/i }));
    await flush();
    await flush();

    expect(post).toHaveBeenCalledWith("/me/checkout", expect.objectContaining({ plan_code: "expert", expected_total: 2999 }));
    expect(post).not.toHaveBeenCalledWith("/me/checkout/redeem", expect.anything());
  });

  it("when payments are not set up the paid plan still waits, as before", async () => {
    await mount({ checkout: gatewayNotSetUp });

    expect(screen.getByText(/online payments are being switched on/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /payments launching soon/i })).toBeTruthy();
  });
});
