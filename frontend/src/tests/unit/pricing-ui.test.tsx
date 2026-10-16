import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

import { PriceTag } from "@/components/pricing/PriceTag";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { PlanComparison } from "@/components/pricing/PlanComparison";
import { UpgradePanel } from "@/components/billing/UpgradePanel";
import { __resetPublicPlansForTests } from "@/lib/usePublicPlans";

const E = {
  coder: { practice_problems_per_day: 1, mock_interviews_per_day: null, free_trial_uses: 1, drive_access: false, hackathon_access: false, vault_access: false, project_lab_access: false, workspace_hours_per_month: null, active_projects: null },
  // Expert and Grandmaster (Mellow Academy) carry the very same access.
  full: { practice_problems_per_day: null, mock_interviews_per_day: 10, free_trial_uses: null, drive_access: true, hackathon_access: true, vault_access: true, project_lab_access: true, workspace_hours_per_month: 80, active_projects: 3 },
};

const paid = (code: string, name: string, list: number, discountAmount: number, entitlements: PublicPlan["entitlements"]): PublicPlan => ({
  code,
  name,
  list_price: list,
  discount_percent: discountAmount ? 40 : 0,
  discount_amount: discountAmount,
  sale_price: list - discountAmount,
  term_days: 365,
  term_unit: "year",
  is_free: false,
  contact_only: false,
  entitlements,
});

/** Mellow Academy: sold by the team, so the price figures are zero and mean nothing. */
const ACADEMY: PublicPlan = {
  code: "grandmaster",
  name: "Grandmaster",
  list_price: 0,
  discount_percent: 0,
  discount_amount: 0,
  sale_price: 0,
  term_days: 1095,
  term_unit: "3 years",
  is_free: false,
  contact_only: true,
  entitlements: E.full,
};

const LAUNCH: PublicPlan[] = [
  { code: "coder", name: "Coder", list_price: 0, discount_percent: 0, discount_amount: 0, sale_price: 0, term_days: null, term_unit: null, is_free: true, contact_only: false, entitlements: E.coder },
  paid("expert", "Expert", 4999, 2000, E.full),
  ACADEMY,
];

const flush = () => act(async () => { await Promise.resolve(); });

/** Razorpay's checkout.js, reduced to what the app touches: the options it was opened with, open(), and the payment.failed hook. */
class FakeRazorpay {
  static last: FakeRazorpay | null = null;
  options: import("@/lib/razorpay").RazorpayCheckoutOptions;
  handlers: Record<string, (payload: unknown) => void> = {};
  open = vi.fn();
  close = vi.fn();

  constructor(options: import("@/lib/razorpay").RazorpayCheckoutOptions) {
    this.options = options;
    FakeRazorpay.last = this;
  }

  on(event: string, callback: (payload: unknown) => void) {
    this.handlers[event] = callback;
  }
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  auth = { user: null, status: "ready" };
  __resetPublicPlansForTests();
});

afterEach(cleanup);

describe("PriceTag", () => {
  it("shows the real price struck through, what is charged, and how much is saved", () => {
    render(<PriceTag plan={LAUNCH[1]} />);

    expect(screen.getByText("₹4,999").tagName).toBe("DEL");
    expect(screen.getByText("₹2,999")).toBeTruthy();
    expect(screen.getByText(/40% off/i)).toBeTruthy();
    expect(screen.getByText("/ year")).toBeTruthy();
    expect(screen.getByText("₹250")).toBeTruthy(); // the per-month equivalent
  });

  it("shows a single plain price when there is no discount", () => {
    render(<PriceTag plan={paid("expert", "Expert", 4999, 0, E.full)} />);

    expect(screen.getByText("₹4,999")).toBeTruthy();
    expect(document.querySelector("del")).toBeNull();
    expect(screen.queryByText(/% off/i)).toBeNull();
  });

  it("never draws a plan sold by the team as ₹0 or as a price at all", () => {
    render(<PriceTag plan={ACADEMY} />);

    expect(screen.getByText(/let.s talk/i)).toBeTruthy();
    expect(screen.getByText(/priced by our team/i)).toBeTruthy();
    expect(screen.queryByText(/₹/)).toBeNull();
    expect(screen.queryByText("forever")).toBeNull();
    expect(document.querySelector("del")).toBeNull();
  });

  it("shows the free plan as ₹0 forever", () => {
    render(<PriceTag plan={LAUNCH[0]} />);

    expect(screen.getByText("₹0")).toBeTruthy();
    expect(screen.getByText("forever")).toBeTruthy();
    expect(document.querySelector("del")).toBeNull();
  });
});

describe("the individual pricing cards", () => {
  const mount = async (plans = LAUNCH, props: Partial<React.ComponentProps<typeof PricingPlans>> = {}) => {
    get.mockResolvedValue({ currency: "INR", plans });
    render(<PricingPlans {...props} />);
    await flush();
  };

  it("shows exactly three plans, with the discounted prices and no Project Lab add-on", async () => {
    await mount();

    for (const name of ["Coder", "Expert", "Grandmaster"]) expect(screen.getByRole("heading", { name })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(3);

    // Expert: real price struck through, discounted price shown. It is the only plan with a price.
    expect(screen.getByText("₹4,999").tagName).toBe("DEL");
    expect(screen.getByText("₹2,999")).toBeTruthy();
    expect(screen.getAllByText(/40% off/i)).toHaveLength(1);
    expect(screen.queryByText("₹1,999")).toBeNull();
    expect(screen.queryByText("₹1,199")).toBeNull();

    // Grandmaster (Mellow Academy) has no price on the page at all.
    const grandmaster = screen.getByRole("heading", { name: "Grandmaster" }).closest("div.flex-col") as HTMLElement;
    expect(within(grandmaster).queryByText(/₹/)).toBeNull();
    expect(within(grandmaster).queryByText(/% off/i)).toBeNull();

    // Project Lab is part of Expert, not sold on its own.
    expect(screen.queryByText(/add-on/i)).toBeNull();
    expect(screen.queryByText("₹499")).toBeNull();
  });

  it("spells out what each plan has and does not have", async () => {
    await mount();

    const card = (name: string) => screen.getByRole("heading", { name }).closest("div.flex-col") as HTMLElement;

    // Free: one problem a day, one try of everything, and the three Expert features are shown as missing.
    expect(within(card("Coder")).getByText("Solve 1 coding problem every day")).toBeTruthy();
    expect(within(card("Coder")).getByText(/Try every AI feature once/)).toBeTruthy();
    expect(within(card("Coder")).getByText("Hack Arena hackathons & prizes")).toBeTruthy();
    expect(within(card("Coder")).getByText("Project Lab")).toBeTruthy();
    expect(within(card("Coder")).getByText("The Vault — get hired directly through Mellow Vault")).toBeTruthy();

    // Expert: everything, so nothing is listed as missing — and the numbers come from the plan's real limits.
    expect(within(card("Expert")).getByText("Unlimited coding problems — no daily cap")).toBeTruthy();
    expect(within(card("Expert")).getByText("10 AI mock interviews per day, scored instantly")).toBeTruthy();
    expect(within(card("Expert")).getByText(/Hack Arena — compete in hackathons, win prizes/)).toBeTruthy();
    expect(within(card("Expert")).getByText(/Project Lab — build real full-stack projects/)).toBeTruthy();
    expect(within(card("Expert")).getByText(/The Vault — get hired directly by employers on Mellow Vault/)).toBeTruthy();
    expect(within(card("Expert")).queryByText(/not included/i)).toBeNull();
    expect(within(card("Expert")).queryByText(/Mellow Academy/i)).toBeNull();
  });

  it("presents Grandmaster as Mellow Academy: the programmes, the placement, three years — and a way to contact the team instead of a price", async () => {
    await mount();

    const card = screen.getByTestId("academy-card");

    expect(within(card).getByText("Mellow Academy")).toBeTruthy();
    for (const programme of ["MERN Stack", "Laravel", "Full Stack Development", "Mobile App Development"]) {
      expect(within(card).getByText(programme)).toBeTruthy();
    }
    expect(within(card).getByText("Assured placement")).toBeTruthy();
    expect(within(card).getByText(/3 years of the Vault & AptRun/)).toBeTruthy();
    expect(within(card).getByText("Every AptRun feature")).toBeTruthy();

    // No price, no Buy button: the team is the call to action.
    expect(within(card).queryByText(/₹/)).toBeNull();
    expect(within(card).getByRole("button", { name: /contact our team/i })).toBeTruthy();
    expect(within(card).queryByRole("button", { name: /upgrade|buy|renew|payments/i })).toBeNull();
    expect(within(card).getByRole("link", { name: "support@mellowvault.com" }).getAttribute("href")).toMatch(/^mailto:support@mellowvault\.com/);
    expect(within(card).getByText(/terms are explained by our team/i)).toBeTruthy();
  });

  it("opens the Mellow Academy enquiry form from the Grandmaster card and sends it to the team", async () => {
    post.mockResolvedValue({ message: "Thanks" });
    await mount();

    fireEvent.click(within(screen.getByTestId("academy-card")).getByRole("button", { name: /contact our team/i }));

    expect(screen.getByRole("heading", { name: /talk to the mellow academy team/i })).toBeTruthy();
    // A student asking about the Academy is not offered the college/employer switch.
    expect(screen.queryByRole("button", { name: /college \/ tpo/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^employer$/i })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText("Your name"), { target: { value: "Asha Rao" } });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "asha@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/where do you study/i), { target: { value: "Apex Institute" } });
    fireEvent.change(screen.getByPlaceholderText(/which programme interests you/i), { target: { value: "MERN and Mobile" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await flush();
    await flush();

    expect(post).toHaveBeenCalledWith("/contact-requests", {
      name: "Asha Rao",
      email: "asha@example.com",
      phone: undefined,
      audience: "academy",
      organization_name: "Apex Institute",
      message: "MERN and Mobile",
    });
    expect(screen.getByText(/thanks, asha/i)).toBeTruthy();
    // Asking about the Academy never touches checkout.
    expect(post).not.toHaveBeenCalledWith("/me/checkout", expect.anything());
  });

  it("starts the enquiry form filled in for a signed-in student", async () => {
    auth = { user: { id: 1, role: "user", college: null, name: "Asha Rao", email: "asha@example.com", phone: "9876543210" }, status: "ready" };
    await mount(LAUNCH, { coverage: { source: "individual", days_remaining: null, is_trial: false, status: "active", started_at: null, current_period_end: null, plan: { code: "coder", name: "Coder", audience: "individual" } }, checkout: null });

    fireEvent.click(within(screen.getByTestId("academy-card")).getByRole("button", { name: /contact our team/i }));

    expect((screen.getByPlaceholderText("Your name") as HTMLInputElement).value).toBe("Asha Rao");
    expect((screen.getByPlaceholderText("you@example.com") as HTMLInputElement).value).toBe("asha@example.com");
  });

  it("follows a plan that is switched off", async () => {
    await mount(LAUNCH.filter((p) => p.code !== "expert"));

    expect(screen.queryByRole("heading", { name: "Expert" })).toBeNull();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);

    cleanup();
    __resetPublicPlansForTests();

    // Switching Mellow Academy off removes its card too.
    await mount(LAUNCH.filter((p) => p.code !== "grandmaster"));
    expect(screen.queryByTestId("academy-card")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("says so, with a retry, when the live prices can't be loaded", async () => {
    get.mockRejectedValue(new Error("down"));
    render(<PricingPlans />);
    await flush();

    // Coder and Expert each need a price; the Mellow Academy card has none to be missing.
    expect(screen.getAllByText("Price unavailable")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /retry/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("₹2,999")).toBeNull();
    expect(screen.getByRole("button", { name: /contact our team/i })).toBeTruthy();
  });

  describe("buying, signed in as a student", () => {
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
    const coverage = coverageOn("coder", "Coder");
    const checkoutOn = { available: true, test_mode: true, gateway: "razorpay" as const, gateway_name: "Razorpay" };

    const checkoutResponse = {
      checkout: {
        key: "rzp_test_abc",
        order_id: "order_123",
        amount: 299900,
        currency: "INR",
        name: "AptRun",
        description: "Expert · 1 year",
        theme_color: "#4F46E5",
        prefill: { name: "Asha", email: "asha@example.com" },
        reference: "01JREFERENCE",
        test_mode: true,
      },
      quote: { total: 2999, currency: "INR" },
    };
    const verifyResponse = {
      scope: "individual",
      coverage: coverageOn("expert", "Expert", 365),
      payment: { id: "01JREFERENCE", status: "paid", amount: 2999 },
    };

    /** The server answers by path, like the real one. */
    const serverAnswers = (overrides: Record<string, unknown> = {}) =>
      post.mockImplementation(async (path: string) => {
        const answer = overrides[path] ?? (path === "/me/checkout" ? checkoutResponse : path === "/me/checkout/verify" ? verifyResponse : undefined);
        if (answer instanceof Error) throw answer;
        return answer;
      });

    beforeEach(() => {
      auth = { user: student, status: "ready" };
      FakeRazorpay.last = null;
      window.Razorpay = FakeRazorpay as unknown as typeof window.Razorpay;
    });

    afterEach(() => {
      delete window.Razorpay;
    });

    const clickBuy = async (name: RegExp) => {
      fireEvent.click(screen.getByRole("button", { name }));
      await flush();
      await flush();
    };

    it("opens Razorpay Checkout for the price the student is looking at, then activates the plan once the server confirms the payment", async () => {
      serverAnswers();
      const onSubscribed = vi.fn();
      await mount(LAUNCH, { coverage, checkout: checkoutOn, onSubscribed });

      await clickBuy(/upgrade to expert/i);

      // The price on screen goes with the request, so a changed price is refused rather than charged.
      expect(post).toHaveBeenCalledWith("/me/checkout", { plan_code: "expert", expected_total: 2999 });

      // Checkout opens against the server's order — key, order id and amount all come from the server.
      const rzp = FakeRazorpay.last!;
      expect(rzp.open).toHaveBeenCalledTimes(1);
      expect(rzp.options).toMatchObject({ key: "rzp_test_abc", order_id: "order_123", amount: 299900, currency: "INR", name: "AptRun" });
      expect(onSubscribed).not.toHaveBeenCalled();

      // The bank says yes: Checkout hands back its three fields, which go to the server to be verified.
      await act(async () => {
        rzp.options.handler({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_123", razorpay_signature: "sig" });
      });
      await flush();

      expect(post).toHaveBeenCalledWith("/me/checkout/verify", { razorpay_payment_id: "pay_1", razorpay_order_id: "order_123", razorpay_signature: "sig" });
      await waitFor(() => expect(onSubscribed).toHaveBeenCalledWith(expect.objectContaining({ source: "individual" }), "Expert"));
    });

    it("holds the screen with a 'confirming your payment' notice between the payment window closing and the plan activating", async () => {
      let finishVerify: (value: unknown) => void = () => {};
      post.mockImplementation((path: string) => (path === "/me/checkout" ? Promise.resolve(checkoutResponse) : new Promise((resolve) => (finishVerify = resolve))));
      await mount(LAUNCH, { coverage, checkout: checkoutOn, onSubscribed: vi.fn() });

      await clickBuy(/upgrade to expert/i);
      await act(async () => {
        FakeRazorpay.last!.options.handler({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_123", razorpay_signature: "sig" });
      });

      expect(screen.getByText("Confirming your payment")).toBeTruthy();
      expect(screen.getByText(/don.t close or refresh this page/i)).toBeTruthy();

      await act(async () => finishVerify(verifyResponse));
      await waitFor(() => expect(screen.queryByText("Confirming your payment")).toBeNull());
    });

    it("says nothing and charges nothing when the student just closes the payment window", async () => {
      serverAnswers();
      const onSubscribed = vi.fn();
      await mount(LAUNCH, { coverage, checkout: checkoutOn, onSubscribed });

      await clickBuy(/upgrade to expert/i);
      await act(async () => FakeRazorpay.last!.options.modal!.ondismiss!());
      await flush();

      expect(post).not.toHaveBeenCalledWith("/me/checkout/verify", expect.anything());
      expect(onSubscribed).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
      // And they can open it again.
      expect((screen.getByRole("button", { name: /upgrade to expert/i }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("tells the student why when the bank declined and they gave up", async () => {
      serverAnswers();
      await mount(LAUNCH, { coverage, checkout: checkoutOn });

      await clickBuy(/upgrade to expert/i);
      await act(async () => FakeRazorpay.last!.handlers["payment.failed"]({ error: { description: "Your card was declined by the bank." } }));
      await act(async () => FakeRazorpay.last!.options.modal!.ondismiss!());
      await flush();

      expect(screen.getByText("Your card was declined by the bank.")).toBeTruthy();
    });

    it("shows the server's reason when it refuses to open a checkout, and never opens one", async () => {
      serverAnswers({ "/me/checkout": new ApiError("You're on the Grandmaster plan until 1 Jan 2027.", 409, undefined, "downgrade_blocked") });
      await mount(LAUNCH, { coverage, checkout: checkoutOn });

      await clickBuy(/upgrade to expert/i);

      expect(screen.getByText(/you.re on the grandmaster plan until 1 jan 2027/i)).toBeTruthy();
      expect(FakeRazorpay.last).toBeNull();
    });

    it("explains a blocked or missing payment window instead of failing silently", async () => {
      delete window.Razorpay; // checkout.js never loads (an ad-blocker, an offline phone)
      serverAnswers();
      const realAppend = document.head.appendChild.bind(document.head);
      vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
        queueMicrotask(() => (node as HTMLScriptElement).onerror?.(new Event("error")));
        return realAppend(node);
      });
      await mount(LAUNCH, { coverage, checkout: checkoutOn });

      await clickBuy(/upgrade to expert/i);

      expect(screen.getByText(/couldn.t load the secure payment window/i)).toBeTruthy();
      vi.restoreAllMocks();
    });

    it("re-reads the prices and asks the student to look again when the server says the price moved", async () => {
      serverAnswers({ "/me/checkout": new ApiError("The price changed since you opened this page.", 409, undefined, "price_changed") });
      await mount(LAUNCH, { coverage, checkout: checkoutOn });
      get.mockClear();

      // By the time they click, the superadmin has made Expert ₹1,000.
      get.mockResolvedValue({ currency: "INR", plans: [LAUNCH[0], paid("expert", "Expert", 1999, 999, E.full), LAUNCH[2]] });
      await clickBuy(/upgrade to expert/i);

      expect(screen.getByText(/price just changed/i)).toBeTruthy();
      expect(get).toHaveBeenCalledWith("/public/plans");
      await waitFor(() => expect(screen.getByText("₹1,000")).toBeTruthy());
      expect(FakeRazorpay.last).toBeNull();
    });

    it("keeps the Buy buttons off, with a plain explanation, until payments are switched on", async () => {
      await mount(LAUNCH, { coverage, checkout: { available: false, test_mode: true } });

      expect(screen.getByText(/online payments are being switched on/i)).toBeTruthy();
      const buy = screen.getAllByRole("button", { name: /payments launching soon/i });
      expect(buy).toHaveLength(1); // Expert — the only plan bought online
      buy.forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
      // …and the Mellow Academy card is not a payment, so it is not switched off with them.
      expect((screen.getByRole("button", { name: /contact our team/i }) as HTMLButtonElement).disabled).toBe(false);
      expect(post).not.toHaveBeenCalled();
    });

    it("says it is test mode when the Razorpay keys are test keys, so nobody thinks real money moved", async () => {
      await mount(LAUNCH, { coverage, checkout: checkoutOn });
      expect(screen.getByText(/test mode/i)).toBeTruthy();

      cleanup();
      __resetPublicPlansForTests();
      await mount(LAUNCH, { coverage, checkout: { available: true, test_mode: false, gateway: "razorpay", gateway_name: "Razorpay" } });
      expect(screen.queryByText(/test mode/i)).toBeNull();
      expect(screen.getByText(/secure payment by razorpay/i)).toBeTruthy();
    });

    it("marks the plan the student is already on", async () => {
      await mount(LAUNCH, { coverage, checkout: checkoutOn });

      expect(screen.getByText("Your Current Plan")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /get started free/i })).toBeNull();
    });

    it("never offers a cheaper plan over a higher one the student still has time on", async () => {
      await mount(LAUNCH, { coverage: coverageOn("grandmaster", "Grandmaster", 200), checkout: checkoutOn });

      expect(screen.getAllByText("Available when your plan ends")).toHaveLength(2); // Coder and Expert
      expect(screen.queryByRole("button", { name: /upgrade to expert/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /renew/i })).toBeNull(); // 200 days left is too early to nag

      // They are on Mellow Academy: the card says so, and the team is still one click away.
      const academy = screen.getByTestId("academy-card");
      expect(within(academy).getByText("Current Plan")).toBeTruthy();
      expect(within(academy).getByText(/200 days of access left/)).toBeTruthy();
      expect(within(academy).getByRole("button", { name: /ask our team/i })).toBeTruthy();
    });

    it("never offers an Academy student a purchase, and an Expert has no Buy button on the Academy card", async () => {
      await mount(LAUNCH, { coverage: coverageOn("expert", "Expert", 200), checkout: checkoutOn });

      expect(screen.queryByRole("button", { name: /upgrade to grandmaster|go grandmaster|buy/i })).toBeNull();
      expect(within(screen.getByTestId("academy-card")).getByRole("button", { name: /contact our team/i })).toBeTruthy();
      expect(screen.getByText("Your Current Plan")).toBeTruthy(); // Expert's own card
    });

    it("offers a renewal when the plan is close to ending, and a Renew button once it has ended", async () => {
      await mount(LAUNCH, { coverage: coverageOn("expert", "Expert", 12), checkout: checkoutOn });
      expect(screen.getByRole("button", { name: /renew for another year/i })).toBeTruthy();

      cleanup();
      __resetPublicPlansForTests();

      // Ended: the server already treats them as free, so Coder is current and Expert is a Renew button.
      await mount(LAUNCH, { coverage: coverageOn("expert", "Expert", 0), checkout: checkoutOn });
      expect(screen.getByRole("button", { name: /renew expert/i })).toBeTruthy();
      expect(screen.getByText("Your Current Plan")).toBeTruthy();
    });

    it("does not guess a student's plan before it knows it", async () => {
      await mount(LAUNCH, { coverage: null, checkout: null });

      expect(screen.queryByRole("button", { name: /upgrade to expert/i })).toBeNull();
      expect(screen.queryByText("Your Current Plan")).toBeNull();
      expect(screen.getAllByLabelText("Checking your current plan").length).toBeGreaterThan(0);
    });

    it("does not let a student buy for themselves when their college already covers them", async () => {
      const covered = { ...coverage, source: "institution" as const, days_remaining: 90 };
      await mount(LAUNCH, { coverage: covered, checkout: checkoutOn });

      expect(screen.getAllByText(/your college/i).length).toBeGreaterThan(0);
      expect(screen.queryByRole("button", { name: /upgrade to expert/i })).toBeNull();
      expect(screen.getAllByText("Included via your college").length).toBeGreaterThan(0);
    });
  });

  it("sends a signed-out visitor to sign up rather than buying", async () => {
    await mount();

    expect(screen.getByRole("link", { name: /upgrade to expert/i }).getAttribute("href")).toBe("/signup");
    // Mellow Academy is a conversation, not a sign-up button.
    expect(screen.queryByRole("link", { name: /go grandmaster/i })).toBeNull();
    expect(screen.getByRole("button", { name: /contact our team/i })).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });
});

describe("the comparison table", () => {
  it("is built from each plan's real entitlements", async () => {
    get.mockResolvedValue({ currency: "INR", plans: LAUNCH });
    render(<PlanComparison />);
    await flush();

    const row = (label: string) => screen.getByRole("row", { name: new RegExp(label, "i") });

    expect(within(row("Coding problems")).getByText("1 per day")).toBeTruthy();
    expect(within(row("Coding problems")).getAllByText("Unlimited")).toHaveLength(2); // Expert and Grandmaster
    expect(within(row("AI mock interviews")).getByText(/1 free try, one time/)).toBeTruthy();
    expect(within(row("AI mock interviews")).getAllByText("10 per day")).toHaveLength(2);

    // Hack Arena and the Vault: Expert and Grandmaster, not the free plan.
    expect(within(row("Hack Arena")).getAllByText("Not included")).toHaveLength(1);
    expect(within(row("Hack Arena")).getAllByText("Included")).toHaveLength(2);
    expect(within(row("The Vault")).getAllByText("Not included")).toHaveLength(1);
    expect(within(row("The Vault")).getAllByText("Included")).toHaveLength(2);
    expect(within(row("Project Lab")).getAllByText(/80 workspace-hours a month · 3 projects at once/)).toHaveLength(2);
  });

  it("shows how long each plan lasts, and that only Grandmaster brings the Mellow Academy programme and assured placement", async () => {
    get.mockResolvedValue({ currency: "INR", plans: LAUNCH });
    render(<PlanComparison />);
    await flush();

    const row = (label: string) => screen.getByRole("row", { name: new RegExp(label, "i") });

    expect(within(row("Access for")).getByText("No expiry")).toBeTruthy();
    expect(within(row("Access for")).getByText("1 year")).toBeTruthy();
    expect(within(row("Access for")).getByText("3 years")).toBeTruthy();
    expect(within(row("Mellow Academy programme")).getAllByText("Included")).toHaveLength(1);
    expect(within(row("Mellow Academy programme")).getAllByText("Not included")).toHaveLength(2);
    expect(within(row("Assured placement")).getAllByText("Included")).toHaveLength(1);
  });

  it("puts no price over the Grandmaster column", async () => {
    get.mockResolvedValue({ currency: "INR", plans: LAUNCH });
    render(<PlanComparison />);
    await flush();

    const header = screen.getByRole("columnheader", { name: /grandmaster/i });
    expect(within(header).queryByText(/₹/)).toBeNull();
    expect(within(header).getByText(/let.s talk/i)).toBeTruthy();
  });
});

describe("UpgradePanel", () => {
  it("offers Expert at the live price and points at Your Plan", async () => {
    get.mockResolvedValue({ currency: "INR", plans: LAUNCH });
    render(<UpgradePanel feature="vault" />);
    await flush();

    expect(screen.getByText("₹2,999")).toBeTruthy();
    expect(screen.getByText("₹4,999").tagName).toBe("DEL");
    expect(screen.getByRole("link", { name: /upgrade to expert/i }).getAttribute("href")).toBe("/dashboard/billing");
    expect(screen.queryByText(/grandmaster/i)).toBeNull();
  });

  it("shows the price it was given straight away, before the live one arrives", () => {
    get.mockReturnValue(new Promise(() => {})); // never answers
    render(<UpgradePanel feature="project_lab" initialPlan={LAUNCH[1]} />);

    expect(screen.getByText("₹2,999")).toBeTruthy();
  });
});
