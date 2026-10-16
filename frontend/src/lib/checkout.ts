// Paying for a plan: our server prices and opens the order, a payment gateway takes the payment on its own
// page or window, our server confirms it. This module is that conversation, with every way it can go wrong
// turned into one of a few outcomes the UI can word kindly. Two gateways are supported and the SERVER says
// which one is in use (POST /me/checkout answers with the shape to use):
//
//   PayU (the default)                              Razorpay
//   1. POST /me/checkout  prices the cart,          1. POST /me/checkout  prices the cart and creates
//      signs a PayU form                               the Razorpay order
//   2. the browser POSTs the form to PayU's page    2. Razorpay Checkout opens over our page
//      — the whole window leaves our app               — card / UPI / netbanking happen in its window
//   3. PayU sends the browser back to the API,      3. POST /me/checkout/verify  the signed success
//      which settles the order and redirects to        callback — the plan activates on the server's say-so
//      /dashboard/billing?payment=…&result=…
//   4. resumeAfterRedirect() reads the order's      4. if 3 cannot complete (network drop, server busy,
//      real status from the API                        bank slow) we ask the status endpoint until it can
//
// Either way the student may have paid when something below fails, so "it failed" would be a lie and "pay
// again" a disaster: those cases poll the status endpoint instead. The browser never decides a price or a
// result: the amount comes from the server's order, and a payment counts only when the server (which asked
// the gateway) says so.

import { api, ApiError } from "@/lib/api";
import { PayuRedirectError, forgetPayuAttempt, rememberPayuAttempt, submitToPayu } from "@/lib/payu";
import { loadRazorpay, type RazorpayFailureResponse } from "@/lib/razorpay";
import type {
  CreateCheckoutResponse,
  PaymentReceipt,
  PaymentReturnResult,
  PayuCheckoutOptions,
  RazorpayCheckoutOptions,
  RazorpaySuccessResponse,
  VerifyPaymentResponse,
} from "@/types/payments";
import type { MySubscriptionResponse } from "@/types/subscription";

export type CheckoutPhase = "idle" | "creating" | "awaiting_payment" | "redirecting" | "confirming";

export type CheckoutOutcome =
  /** Paid and activated: the new subscription state. */
  | { kind: "paid"; state: VerifyPaymentResponse }
  /** The student closed the payment window (or cancelled on the gateway's page) without paying. Not an error. */
  | { kind: "dismissed" }
  /** Definitely not paid (declined, or the confirmation was refused). Safe to try again. */
  | { kind: "failed"; message: string }
  /** Paid at the gateway, but we could not confirm yet. Do not ask them to pay again; check on `reference`. */
  | { kind: "pending"; reference: string; message: string }
  /** The window is on its way to the gateway's page; nothing more happens here — the student returns via the app's billing page. */
  | { kind: "redirecting"; reference: string };

export interface CheckoutRequest {
  planCode: string;
  /** The total the student was shown, in rupees; the server refuses (409 price_changed) if it moved. */
  expectedTotal: number;
  /** A mobile number, for gateways that need one when the profile has none (PayU) — the server asks for it with `phone_required`. */
  phone?: string;
  /** What to call the purchase when the student returns from the gateway's page. */
  planName?: string;
}

export interface CheckoutHooks {
  onPhase?: (phase: CheckoutPhase) => void;
}

export interface PollOptions {
  intervalMs?: number;
  /** Stop asking after this long and report "pending". */
  maxMs?: number;
}

const DEFAULT_POLL: Required<PollOptions> = { intervalMs: 3000, maxMs: 90_000 };

/** Statuses of POST /me/checkout/verify that mean "this payment will not become a plan" rather than "ask again later". */
const DEFINITIVE_REFUSALS = new Set(["signature_invalid", "payment_not_complete", "order_not_found", "payment_mismatch", "payment_refunded"]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isPayu = (checkout: CreateCheckoutResponse["checkout"]): checkout is PayuCheckoutOptions => checkout.gateway === "payu";

export async function runCheckout(request: CheckoutRequest, hooks: CheckoutHooks = {}, poll: PollOptions = {}): Promise<CheckoutOutcome> {
  hooks.onPhase?.("creating");

  // Throws ApiError (price_changed, payments_unavailable, downgrade_blocked, phone_required, …) — the caller words those.
  const created = await api.post<CreateCheckoutResponse>("/me/checkout", {
    plan_code: request.planCode,
    expected_total: request.expectedTotal,
    ...(request.phone ? { phone: request.phone } : {}),
  });

  if (isPayu(created.checkout)) {
    return redirectToPayu(created.checkout, request, hooks);
  }

  return payWithRazorpay(created.checkout, hooks, poll);
}

// ───────────────────────────── PayU: leave for its page, come back later ─────────────────────────────

function redirectToPayu(checkout: PayuCheckoutOptions, request: CheckoutRequest, hooks: CheckoutHooks): CheckoutOutcome {
  // Written down BEFORE leaving: if the student comes back by the Back button instead of through PayU's redirect,
  // the billing page still knows what to ask about.
  rememberPayuAttempt({ reference: checkout.reference, planName: request.planName ?? "" });

  hooks.onPhase?.("redirecting");

  try {
    submitToPayu(checkout);
  } catch (err) {
    forgetPayuAttempt();
    hooks.onPhase?.("idle");

    // Nothing left our app, so nothing was charged and the student can simply try again.
    throw err instanceof PayuRedirectError ? err : new PayuRedirectError();
  }

  return { kind: "redirecting", reference: checkout.reference };
}

/**
 * The student is back from PayU's page, on /dashboard/billing?payment=<reference>&result=<hint>.
 *
 * The API already settled the order while handling PayU's return (it asked PayU what happened), so the first look
 * normally says "paid". `hint` is only how the server read the return — it words the failure and cancel cases and
 * spares the student a long wait for a payment that visibly did not happen — but a PAID answer from the API always
 * wins, whatever the hint said, and nothing is ever treated as paid on the hint's say-so.
 */
export async function resumeAfterRedirect(reference: string, hint: PaymentReturnResult | null, poll: PollOptions = {}): Promise<CheckoutOutcome> {
  let receipt: PaymentReceipt | null = null;

  try {
    receipt = (await api.get<{ payment: PaymentReceipt }>(`/me/payments/${reference}`)).payment;
  } catch {
    /* the network is flaky; the polling below tries again */
  }

  if (receipt) {
    const settled = await outcomeFor(receipt, reference);
    if (settled) return settled;
  }

  if (hint === "cancelled") return { kind: "dismissed" };

  if (hint === "failed") {
    return {
      kind: "failed",
      message: receipt?.failure_reason ?? "The payment didn't go through. You haven't been charged — you can try again.",
    };
  }

  return waitForPayment(reference, poll);
}

// ───────────────────────────── Razorpay: a window over our page ─────────────────────────────

async function payWithRazorpay(checkout: RazorpayCheckoutOptions, hooks: CheckoutHooks, poll: PollOptions): Promise<CheckoutOutcome> {
  const Razorpay = await loadRazorpay(); // throws RazorpayLoadError

  return new Promise<CheckoutOutcome>((resolve) => {
    let finished = false;
    let handedOver = false; // the success callback has fired: closing the window after that is not "dismissing"
    let lastFailure: string | null = null;

    const finish = (outcome: CheckoutOutcome) => {
      if (finished) return;
      finished = true;
      hooks.onPhase?.("idle");
      resolve(outcome);
    };

    const instance = new Razorpay({
      key: checkout.key,
      order_id: checkout.order_id,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      image: typeof window !== "undefined" ? `${window.location.origin}/brand/icon-192.png` : undefined,
      prefill: checkout.prefill,
      notes: { reference: checkout.reference },
      theme: { color: checkout.theme_color },
      retry: { enabled: true },
      modal: {
        // A student who taps outside by accident should not lose the window mid-payment.
        confirm_close: true,
        backdropclose: false,
        ondismiss: () => {
          if (handedOver) return;
          finish(lastFailure ? { kind: "failed", message: lastFailure } : { kind: "dismissed" });
        },
      },
      handler: (response: RazorpaySuccessResponse) => {
        handedOver = true;
        hooks.onPhase?.("confirming");
        void confirmPayment(response, checkout.reference, poll).then(finish);
      },
    });

    // Razorpay shows the failure and lets the student retry inside its own window; we only remember
    // the reason, for the case where they give up and close it.
    instance.on("payment.failed", (failure: RazorpayFailureResponse) => {
      lastFailure = failure.error?.description ?? "The payment didn't go through.";

      // Best effort, and invisible to the student: asking for the order's status makes the server check with
      // Razorpay and write down why this attempt failed, so it is in their payment history (and the support
      // trail) even where no webhook can reach us — local development, or a webhook that is switched off.
      void Promise.resolve()
        .then(() => api.get(`/me/payments/${checkout.reference}`))
        .catch(() => {});
    });

    hooks.onPhase?.("awaiting_payment");
    instance.open();
  });
}

/** Step 3, and step 4 when 3 cannot be answered. */
async function confirmPayment(response: RazorpaySuccessResponse, reference: string, poll: PollOptions): Promise<CheckoutOutcome> {
  try {
    const state = await api.post<VerifyPaymentResponse>("/me/checkout/verify", response);

    return { kind: "paid", state };
  } catch (err) {
    if (err instanceof ApiError && err.code && DEFINITIVE_REFUSALS.has(err.code)) {
      // "payment_mismatch" means money moved but the plan could not be handed over: the server has flagged
      // it for a person, which is not the same as the student's attempt having failed.
      return err.code === "payment_mismatch"
        ? { kind: "pending", reference, message: err.message }
        : { kind: "failed", message: err.message };
    }

    // Network drop, 5xx, "activation_delayed", throttled: the payment exists, so keep asking.
    return waitForPayment(reference, poll);
  }
}

// ───────────────────────────── asking the server how a payment stands ─────────────────────────────

/** What a payment's status means for the student, or null while it is still unknown (awaiting payment). */
async function outcomeFor(payment: PaymentReceipt, reference: string): Promise<CheckoutOutcome | null> {
  if (payment.status === "paid" || payment.status === "partially_refunded") {
    const state = await api.get<MySubscriptionResponse>("/me/subscription");

    return { kind: "paid", state: { ...state, payment } };
  }

  if (payment.status === "processing") {
    return {
      kind: "pending",
      reference,
      message: "We received your payment but couldn't activate your plan automatically. Our team has been notified — you'll be activated or refunded shortly.",
    };
  }

  if (payment.status === "refunded") {
    return { kind: "failed", message: "This payment was refunded, so the plan was not activated." };
  }

  return null; // still unknown
}

/** One look at a payment's status; "paid" comes back with the full new subscription state. */
export async function checkPayment(reference: string): Promise<CheckoutOutcome | null> {
  const { payment } = await api.get<{ payment: PaymentReceipt }>(`/me/payments/${reference}`);

  return outcomeFor(payment, reference);
}

/** Asks about `reference` until it is paid or the time is up. */
export async function waitForPayment(reference: string, poll: PollOptions = {}): Promise<CheckoutOutcome> {
  const { intervalMs, maxMs } = { ...DEFAULT_POLL, ...poll };
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    await sleep(intervalMs);

    try {
      const outcome = await checkPayment(reference);
      if (outcome) return outcome;
    } catch {
      /* the network is still flaky; the next round tries again */
    }
  }

  return {
    kind: "pending",
    reference,
    message: "Your payment went through and we're finishing the activation. You don't need to pay again — your plan will appear within a few minutes, and we'll email a receipt.",
  };
}
