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

import { PricingPlans } from "@/components/pricing/PricingPlans";
import { readPayuAttempt, rememberPayuAttempt } from "@/lib/payu";
import { __resetPublicPlansForTests } from "@/lib/usePublicPlans";

const E = {
  coder: { practice_problems_per_day: 1, mock_interviews_per_day: null, free_trial_uses: 1, drive_access: false, hackathon_access: false, vault_access: false, project_lab_access: false, workspace_hours_per_month: null, active_projects: null },
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

const LAUNCH: PublicPlan[] = [
  { code: "coder", name: "Coder", list_price: 0, discount_percent: 0, discount_amount: 0, sale_price: 0, term_days: null, term_unit: null, is_free: true, contact_only: false, entitlements: E.coder },
  paid("expert", "Expert", 4999, 2000, E.full),
  // Mellow Academy: sold by the team, so it has no price and no Buy button.
  { code: "grandmaster", name: "Grandmaster", list_price: 0, discount_percent: 0, discount_amount: 0, sale_price: 0, term_days: 1095, term_unit: "3 years", is_free: false, contact_only: true, entitlements: E.full },
];

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
const coverage = coverageOn("coder", "Coder");
const checkoutOn = { available: true, test_mode: true, gateway: "payu" as const, gateway_name: "PayU" };

const REFERENCE = "01JREFERENCE00000000000000";

const payuForm = {
  gateway: "payu" as const,
  action: "https://test.payu.in/_payment",
  method: "POST" as const,
  fields: { key: "gtKFFx", txnid: "01JREFERENCE0000000000000", amount: "2999.00", productinfo: "AptRun Expert - 1 year", firstname: "Asha", email: "asha@example.com", phone: "9876543210", hash: "b".repeat(128) },
  amount: 299900,
  currency: "INR",
  reference: REFERENCE,
  test_mode: true,
};

const paidReceipt = { id: REFERENCE, status: "paid", amount: 2999, description: "Expert", failure_reason: null };

let submitted: HTMLFormElement | null;

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  auth = { user: student, status: "ready" };
  submitted = null;
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/dashboard/billing");
  __resetPublicPlansForTests();
  vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (this: HTMLFormElement) {
    submitted = this;
  });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

/** The plans endpoint, the status endpoint and the subscription endpoint, by path — like the real server. */
const serverGet = (receipt: Record<string, unknown> | Error | null = null) =>
  get.mockImplementation(async (path: string) => {
    if (path === "/public/plans") return { currency: "INR", plans: LAUNCH };
    if (path === "/me/subscription") return { scope: "individual", coverage: coverageOn("expert", "Expert", 365) };
    if (path.startsWith("/me/payments/")) {
      if (receipt instanceof Error) throw receipt;
      return { payment: receipt };
    }
    throw new Error(`unexpected GET ${path}`);
  });

const mount = async (props: Partial<React.ComponentProps<typeof PricingPlans>> = {}) => {
  render(<PricingPlans coverage={coverage} checkout={checkoutOn} {...props} />);
  await flush();
  await flush();
};

const landOnBilling = (query: string) => window.history.replaceState(null, "", `/dashboard/billing${query}`);

describe("buying a plan on PayU", () => {
  const clickBuy = async (name: RegExp) => {
    fireEvent.click(screen.getByRole("button", { name }));
    await flush();
    await flush();
  };

  it("sends the student to PayU's page for the price on the card, and keeps the buttons locked while the page leaves", async () => {
    serverGet();
    post.mockResolvedValue({ checkout: payuForm, quote: { total: 2999, currency: "INR" } });
    await mount();

    await clickBuy(/upgrade to expert/i);

    expect(post).toHaveBeenCalledWith("/me/checkout", { plan_code: "expert", expected_total: 2999 });
    expect(submitted).not.toBeNull();
    expect(submitted!.action).toBe("https://test.payu.in/_payment");
    expect(Object.fromEntries(new FormData(submitted!).entries())).toEqual(payuForm.fields);

    // Mid-redirect: a second click must not open a second transaction.
    const buttons = screen.getAllByRole("button", { name: /taking you to the payment page|upgrade to|go grandmaster|grandmaster/i });
    expect(screen.getByText(/taking you to the payment page/i)).toBeTruthy();
    buttons.forEach((b) => expect((b as HTMLButtonElement).disabled).toBe(true));
    expect(post).toHaveBeenCalledTimes(1);
    expect(readPayuAttempt()).toMatchObject({ reference: REFERENCE, planName: "Expert" });
  });

  it("names PayU as who the student is paying", async () => {
    serverGet();
    await mount();

    expect(screen.getByText(/secure payment by payu/i)).toBeTruthy();
  });

  it("unlocks the buttons when the page is restored from the browser's back/forward cache", async () => {
    serverGet();
    post.mockResolvedValue({ checkout: payuForm, quote: { total: 2999, currency: "INR" } });
    await mount();
    await clickBuy(/upgrade to expert/i);
    expect(screen.getByText(/taking you to the payment page/i)).toBeTruthy();

    await act(async () => {
      const event = new Event("pageshow") as PageTransitionEvent;
      Object.defineProperty(event, "persisted", { value: true });
      window.dispatchEvent(event);
    });

    expect(screen.queryByText(/taking you to the payment page/i)).toBeNull();
    expect((screen.getByRole("button", { name: /upgrade to expert/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  describe("when PayU needs a mobile number the student has not given", () => {
    const phoneRequired = () => new ApiError("Please add your mobile number.", 422, undefined, "phone_required");

    it("asks for one, checks it before sending, and carries on to PayU with it", async () => {
      serverGet();
      post.mockRejectedValueOnce(phoneRequired());
      await mount();

      await clickBuy(/upgrade to expert/i);

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText(/one more thing before you pay/i)).toBeTruthy();
      expect(submitted).toBeNull();

      // A typo is caught here, with no round trip.
      fireEvent.change(within(dialog).getByLabelText(/mobile number/i), { target: { value: "12345" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /continue to payu/i }));
      await flush();
      expect(within(dialog).getByRole("alert").textContent).toMatch(/valid mobile number/i);
      expect(post).toHaveBeenCalledTimes(1);

      // A real number goes to the server (normalised), and the redirect happens.
      post.mockResolvedValueOnce({ checkout: payuForm, quote: { total: 2999, currency: "INR" } });
      fireEvent.change(within(dialog).getByLabelText(/mobile number/i), { target: { value: "+91 98765-43210" } });
      fireEvent.click(within(dialog).getByRole("button", { name: /continue to payu/i }));
      await flush();
      await flush();

      expect(post).toHaveBeenLastCalledWith("/me/checkout", { plan_code: "expert", expected_total: 2999, phone: "9876543210" });
      expect(submitted).not.toBeNull();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("can be cancelled without charging or opening anything", async () => {
      serverGet();
      post.mockRejectedValueOnce(phoneRequired());
      await mount();
      await clickBuy(/upgrade to expert/i);

      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: /^cancel$/i }));
      await flush();

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(submitted).toBeNull();
      expect(post).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the server's reason when it refuses to open a checkout, and never leaves for PayU", async () => {
    serverGet();
    post.mockRejectedValueOnce(new ApiError("Your college already includes full access for you.", 409, undefined, "covered_by_institution"));
    await mount();

    await clickBuy(/upgrade to expert/i);

    expect(screen.getByText(/already includes full access/i)).toBeTruthy();
    expect(submitted).toBeNull();
    expect(readPayuAttempt()).toBeNull();
  });

  it("tells the student, calmly, when the payment page could not be opened", async () => {
    serverGet();
    post.mockResolvedValue({ checkout: { ...payuForm, action: "http://payments.evil.example/_payment" }, quote: { total: 2999, currency: "INR" } });
    await mount();

    await clickBuy(/upgrade to expert/i);

    expect(screen.getByText(/couldn't open the secure payment page/i)).toBeTruthy();
    expect(submitted).toBeNull();
    expect((screen.getByRole("button", { name: /upgrade to expert/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("landing back on the billing page after PayU", () => {
  it("activates the plan the student paid for, says so, and cleans the address bar", async () => {
    serverGet(paidReceipt);
    landOnBilling(`?payment=${REFERENCE}&result=paid`);
    rememberPayuAttempt({ reference: REFERENCE, planName: "Expert" });
    const onSubscribed = vi.fn();

    await mount({ onSubscribed });
    await waitFor(() => expect(onSubscribed).toHaveBeenCalledTimes(1));

    expect(onSubscribed).toHaveBeenCalledWith(expect.objectContaining({ plan: expect.objectContaining({ code: "expert" }) }), "Expert");
    expect(window.location.search).toBe("");
    expect(readPayuAttempt()).toBeNull();
    expect(get).toHaveBeenCalledWith(`/me/payments/${REFERENCE}`);
  });

  it("falls back to the receipt's plan name when this tab does not remember the purchase", async () => {
    serverGet(paidReceipt);
    landOnBilling(`?payment=${REFERENCE}&result=paid`);
    const onSubscribed = vi.fn();

    await mount({ onSubscribed });
    await waitFor(() => expect(onSubscribed).toHaveBeenCalledTimes(1));

    expect(onSubscribed.mock.calls[0][1]).toBe("Expert");
  });

  it("holds the screen on 'confirming your payment' while it asks", async () => {
    let release: (value: unknown) => void = () => {};
    get.mockImplementation(async (path: string) => {
      if (path === "/public/plans") return { currency: "INR", plans: LAUNCH };
      if (path === "/me/subscription") return { coverage: coverageOn("expert", "Expert", 365) };
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    landOnBilling(`?payment=${REFERENCE}&result=pending`);

    await mount();

    expect(await screen.findByText(/confirming your payment/i)).toBeTruthy();
    expect(screen.getByText(/please don.t close or refresh this page/i)).toBeTruthy();

    await act(async () => release({ payment: paidReceipt }));
    await waitFor(() => expect(screen.queryByText(/confirming your payment/i)).toBeNull());
  });

  it("explains a cancelled payment kindly and without an error", async () => {
    serverGet({ ...paidReceipt, status: "pending" });
    landOnBilling(`?payment=${REFERENCE}&result=cancelled`);
    const onSubscribed = vi.fn();

    await mount({ onSubscribed });

    expect(await screen.findByText(/you cancelled the payment, so you haven't been charged/i)).toBeTruthy();
    expect(onSubscribed).not.toHaveBeenCalled();
    expect(screen.queryByText(/confirming your payment/i)).toBeNull();
  });

  it("shows the bank's reason when the payment failed, and lets the student try again", async () => {
    serverGet({ ...paidReceipt, status: "failed", failure_reason: "Insufficient funds in the account." });
    landOnBilling(`?payment=${REFERENCE}&result=failed`);

    await mount();

    expect(await screen.findByText(/insufficient funds in the account/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /upgrade to expert/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("tells a student whose payment is awaiting a person that their money is safe and not to pay again", async () => {
    serverGet({ ...paidReceipt, status: "processing" });
    landOnBilling(`?payment=${REFERENCE}&result=processing`);

    await mount();

    const dialog = await screen.findByRole("status");
    expect(dialog.textContent).toMatch(/couldn't activate your plan automatically/i);
    expect(screen.getByText(/don.t pay again/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /check again/i })).toBeTruthy();
  });

  it("copes with a return it cannot match to an order", async () => {
    serverGet();
    landOnBilling("?result=unknown");

    await mount();

    expect(await screen.findByText(/couldn't match that payment to an order/i)).toBeTruthy();
    expect(window.location.search).toBe("");
    expect(get).not.toHaveBeenCalledWith(expect.stringContaining("/me/payments/"));
  });

  it("ignores a made-up result hint rather than acting on it", async () => {
    serverGet({ ...paidReceipt, status: "pending" });
    landOnBilling(`?payment=${REFERENCE}&result=<script>`);
    const onSubscribed = vi.fn();

    await mount({ onSubscribed });
    await flush();

    expect(onSubscribed).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toContain("<script>");
  });

  it("does nothing for a visitor who is not a signed-in student, and never touches the payment endpoints", async () => {
    auth = { user: null, status: "ready" };
    serverGet(paidReceipt);
    landOnBilling(`?payment=${REFERENCE}&result=paid`);

    await mount();

    expect(get).not.toHaveBeenCalledWith(expect.stringContaining("/me/payments/"));
  });

  it("handles the return only once per page load", async () => {
    serverGet(paidReceipt);
    landOnBilling(`?payment=${REFERENCE}&result=paid`);
    const onSubscribed = vi.fn();

    const view = render(<PricingPlans coverage={coverage} checkout={checkoutOn} onSubscribed={onSubscribed} />);
    await flush();
    await waitFor(() => expect(onSubscribed).toHaveBeenCalledTimes(1));

    view.rerender(<PricingPlans coverage={coverage} checkout={checkoutOn} onSubscribed={onSubscribed} />);
    await flush();

    expect(onSubscribed).toHaveBeenCalledTimes(1);
  });
});

describe("coming back without PayU's redirect (the Back button, or paying in another window)", () => {
  it("quietly notices a payment that went through and tells the student", async () => {
    serverGet(paidReceipt);
    rememberPayuAttempt({ reference: REFERENCE, planName: "Expert" });
    const onSubscribed = vi.fn();

    await mount({ onSubscribed });
    await waitFor(() => expect(onSubscribed).toHaveBeenCalledTimes(1));

    expect(onSubscribed.mock.calls[0][1]).toBe("Expert");
    expect(readPayuAttempt()).toBeNull();
  });

  it("says nothing, and shows no waiting screen, when the student simply did not pay", async () => {
    serverGet({ ...paidReceipt, status: "pending" });
    rememberPayuAttempt({ reference: REFERENCE, planName: "Expert" });
    const onSubscribed = vi.fn();

    await mount({ onSubscribed });
    await flush();

    expect(onSubscribed).not.toHaveBeenCalled();
    expect(screen.queryByText(/confirming your payment/i)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(readPayuAttempt()).not.toBeNull();   // still looked at next time, until it is two hours old
  });

  it("survives the status check failing", async () => {
    serverGet(new TypeError("Failed to fetch"));
    rememberPayuAttempt({ reference: REFERENCE, planName: "Expert" });

    await mount();
    await flush();

    expect(screen.queryByRole("alert")).toBeNull();
  });
});
