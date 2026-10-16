import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { RAZORPAY_SCRIPT_URL, RazorpayLoadError, __resetRazorpayLoaderForTests, loadRazorpay, type RazorpayCheckoutOptions } from "@/lib/razorpay";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body) } };
});

import { checkPayment, runCheckout, waitForPayment } from "@/lib/checkout";

const request = { planCode: "expert", expectedTotal: 1199 };
const fast = { intervalMs: 1, maxMs: 60 };

const created = {
  checkout: { key: "rzp_test_abc", order_id: "order_1", amount: 119900, currency: "INR", name: "AptRun", description: "Expert", theme_color: "#4F46E5", prefill: {}, reference: "REF1", test_mode: true },
  quote: { total: 1199, currency: "INR" },
};
const callback = { razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", razorpay_signature: "sig" };
const paidReceipt = { id: "REF1", status: "paid", amount: 1199 };

/** A Razorpay whose window the test controls: it records the options and the payment.failed hook. */
class FakeRazorpay {
  static last: FakeRazorpay;
  handlers: Record<string, (payload: unknown) => void> = {};
  open = vi.fn();
  constructor(public options: RazorpayCheckoutOptions) {
    FakeRazorpay.last = this;
  }
  on(event: string, cb: (payload: unknown) => void) {
    this.handlers[event] = cb;
  }
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  window.Razorpay = FakeRazorpay as unknown as typeof window.Razorpay;
});

afterEach(() => {
  delete window.Razorpay;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Opens a checkout and returns the pending outcome plus the fake window to drive. */
async function open() {
  post.mockResolvedValueOnce(created);
  const outcome = runCheckout(request, {}, fast);
  await vi.waitFor(() => expect(FakeRazorpay.last?.open).toHaveBeenCalled());
  return { outcome, rzp: FakeRazorpay.last };
}

describe("paying through Razorpay Checkout", () => {
  it("activates once the server has verified the signed callback", async () => {
    const { outcome, rzp } = await open();
    post.mockResolvedValueOnce({ coverage: { source: "individual" }, payment: paidReceipt });

    rzp.options.handler(callback);

    expect(await outcome).toMatchObject({ kind: "paid", state: { payment: paidReceipt } });
    expect(post).toHaveBeenLastCalledWith("/me/checkout/verify", callback);
  });

  it("reports closing the window as a plain dismissal, and asks the server for nothing", async () => {
    const { outcome, rzp } = await open();

    rzp.options.modal!.ondismiss!();

    expect(await outcome).toEqual({ kind: "dismissed" });
    expect(post).toHaveBeenCalledTimes(1); // only the checkout creation
  });

  it("remembers the bank's reason if the student gives up after a decline", async () => {
    const { outcome, rzp } = await open();

    rzp.handlers["payment.failed"]({ error: { description: "Insufficient funds." } });
    rzp.options.modal!.ondismiss!();

    expect(await outcome).toEqual({ kind: "failed", message: "Insufficient funds." });
  });

  it("quietly has the server record a failed attempt, and a server that cannot be reached changes nothing", async () => {
    get.mockRejectedValue(new TypeError("Failed to fetch"));
    const { outcome, rzp } = await open();

    rzp.handlers["payment.failed"]({ error: { description: "Card declined." } });
    rzp.options.modal!.ondismiss!();

    expect(await outcome).toEqual({ kind: "failed", message: "Card declined." });
    await vi.waitFor(() => expect(get).toHaveBeenCalledWith("/me/payments/REF1"));
  });

  it("ignores the window closing after a successful payment (Razorpay closes it itself)", async () => {
    const { outcome, rzp } = await open();
    post.mockResolvedValueOnce({ coverage: null, payment: paidReceipt });

    rzp.options.handler(callback);
    rzp.options.modal!.ondismiss!();

    expect((await outcome).kind).toBe("paid");
  });

  it("reports the phase it is in, so the screen can lock and say what is happening", async () => {
    const phases: string[] = [];
    post.mockResolvedValueOnce(created);
    const outcome = runCheckout(request, { onPhase: (p) => phases.push(p) }, fast);
    await vi.waitFor(() => expect(FakeRazorpay.last?.open).toHaveBeenCalled());
    post.mockResolvedValueOnce({ coverage: null, payment: paidReceipt });

    FakeRazorpay.last.options.handler(callback);
    await outcome;

    expect(phases).toEqual(["creating", "awaiting_payment", "confirming", "idle"]);
  });

  it("sends the server's price to Checkout, never one of its own", async () => {
    const { outcome, rzp } = await open();

    expect(rzp.options).toMatchObject({ key: "rzp_test_abc", order_id: "order_1", amount: 119900, currency: "INR" });
    expect(post).toHaveBeenCalledWith("/me/checkout", { plan_code: "expert", expected_total: 1199 });

    rzp.options.modal!.ondismiss!();
    await outcome;
  });

  it("lets the server's refusal to open a checkout reach the caller untouched", async () => {
    post.mockRejectedValueOnce(new ApiError("Already covered.", 409, undefined, "covered_by_institution"));

    await expect(runCheckout(request, {}, fast)).rejects.toMatchObject({ code: "covered_by_institution" });
    expect(FakeRazorpay.last?.open).not.toHaveBeenCalled();
  });
});

describe("when the confirmation cannot complete, the student has still paid", () => {
  it.each([
    ["signature_invalid", 422],
    ["payment_not_complete", 409],
    ["order_not_found", 404],
    ["payment_refunded", 409],
  ])("a definitive refusal (%s) is a failure, not something to wait on", async (code, status) => {
    const { outcome, rzp } = await open();
    post.mockRejectedValueOnce(new ApiError("We could not verify that payment.", status, undefined, code));

    rzp.options.handler(callback);

    expect(await outcome).toEqual({ kind: "failed", message: "We could not verify that payment." });
    expect(get).not.toHaveBeenCalled();
  });

  it("a payment the server flagged for a person is 'pending' — money moved, so never 'failed'", async () => {
    const { outcome, rzp } = await open();
    post.mockRejectedValueOnce(new ApiError("We received your payment but couldn't activate your plan.", 409, undefined, "payment_mismatch"));

    rzp.options.handler(callback);

    expect(await outcome).toMatchObject({ kind: "pending", reference: "REF1", message: expect.stringContaining("received your payment") });
  });

  it.each([
    ["a network drop", new TypeError("Failed to fetch")],
    ["the server being busy", new ApiError("busy", 503, undefined, "activation_delayed")],
    ["a server error", new ApiError("boom", 500)],
    ["throttling", new ApiError("slow down", 429)],
  ])("%s is waited out by asking the status endpoint, and ends paid", async (_name, error) => {
    const { outcome, rzp } = await open();
    post.mockRejectedValueOnce(error);
    get.mockImplementation(async (path: string) =>
      path === "/me/payments/REF1" ? { payment: paidReceipt } : { scope: "individual", coverage: { source: "individual" } }
    );

    rzp.options.handler(callback);

    expect(await outcome).toMatchObject({ kind: "paid", state: { payment: paidReceipt, coverage: { source: "individual" } } });
  });

  it("keeps asking through a flaky network, then reports 'pending' — never 'failed', never 'pay again'", async () => {
    get.mockRejectedValue(new TypeError("Failed to fetch"));

    const outcome = await waitForPayment("REF1", fast);

    expect(outcome).toMatchObject({ kind: "pending", reference: "REF1", message: expect.stringContaining("don't need to pay again") });
    expect(get.mock.calls.length).toBeGreaterThan(1);
  });
});

describe("checking on one payment", () => {
  it.each([
    ["pending", null],
    ["created", null],
    ["failed", null],
  ])("a %s payment is not an answer yet", async (status) => {
    get.mockResolvedValue({ payment: { id: "REF1", status } });

    expect(await checkPayment("REF1")).toBeNull();
  });

  it("a payment held for review is pending, with the reassurance", async () => {
    get.mockResolvedValue({ payment: { id: "REF1", status: "processing" } });

    expect(await checkPayment("REF1")).toMatchObject({ kind: "pending", message: expect.stringContaining("Our team has been notified") });
  });

  it("a refunded payment never becomes a plan", async () => {
    get.mockResolvedValue({ payment: { id: "REF1", status: "refunded" } });

    expect(await checkPayment("REF1")).toMatchObject({ kind: "failed" });
  });
});

describe("loading checkout.js", () => {
  const scripts = () => Array.from(document.head.querySelectorAll(`script[src="${RAZORPAY_SCRIPT_URL}"]`)) as HTMLScriptElement[];

  beforeEach(() => {
    delete window.Razorpay;
    __resetRazorpayLoaderForTests();
    scripts().forEach((s) => s.remove());
  });

  it("fetches Razorpay's own script once, however many purchases are started", async () => {
    const first = loadRazorpay();
    const second = loadRazorpay();

    expect(scripts()).toHaveLength(1);
    window.Razorpay = FakeRazorpay as unknown as typeof window.Razorpay;
    scripts()[0].onload?.(new Event("load"));

    expect(await first).toBe(FakeRazorpay);
    expect(await second).toBe(FakeRazorpay);
  });

  it("does not touch the network when it is already loaded", async () => {
    window.Razorpay = FakeRazorpay as unknown as typeof window.Razorpay;

    expect(await loadRazorpay()).toBe(FakeRazorpay);
    expect(scripts()).toHaveLength(0);
  });

  it("says so plainly when it is blocked, and a retry really retries", async () => {
    const blocked = loadRazorpay();
    scripts()[0].onerror?.(new Event("error"));

    await expect(blocked).rejects.toBeInstanceOf(RazorpayLoadError);
    await expect(blocked).rejects.toThrow(/haven't been charged/);
    expect(scripts()).toHaveLength(0); // the dead tag is gone, so the next attempt is not "already loading"

    const retry = loadRazorpay();
    expect(scripts()).toHaveLength(1);
    window.Razorpay = FakeRazorpay as unknown as typeof window.Razorpay;
    scripts()[0].onload?.(new Event("load"));
    expect(await retry).toBe(FakeRazorpay);
  });

  it("gives up with the same explanation when the script never arrives", async () => {
    vi.useFakeTimers();
    const pending = loadRazorpay();
    const assertion = expect(pending).rejects.toBeInstanceOf(RazorpayLoadError);

    await vi.advanceTimersByTimeAsync(16_000);

    await assertion;
  });

  it("treats a script that loaded but did not define Razorpay as a failure", async () => {
    const pending = loadRazorpay();
    scripts()[0].onload?.(new Event("load")); // a captive portal answered with an HTML page

    await expect(pending).rejects.toBeInstanceOf(RazorpayLoadError);
  });
});
