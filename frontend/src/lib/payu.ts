// PayU Hosted Checkout, from the browser's side.
//
// Unlike Razorpay there is no script to load and no window over our page: the student is taken to PayU's own
// payment page by submitting a form to it. Card / UPI / netbanking details are typed there and never touch
// this app or our server. The form was built and signed by our server — its `hash` covers the amount, the
// transaction id and the buyer — so this module can submit it but cannot change what is charged: an edited
// amount makes PayU refuse the request.
//
// PayU then sends the student's browser back to our API (POST /api/payu/return), which settles the order and
// redirects to /dashboard/billing?payment=<reference>&result=<hint>. Everything after that is lib/checkout.ts.

import type { PayuCheckoutOptions } from "@/types/payments";

const STORAGE_KEY = "aptrun.payu.attempt";

/** A checkout older than this is not what the student is "in the middle of" any more. */
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** The checkout this browser tab sent to PayU, kept so the billing page can find out how it ended. */
export interface PayuAttempt {
  reference: string;
  planName: string;
  startedAt: number;
}

/** The form could not be handed to PayU (no browser, or a destination that is not a payment page). */
export class PayuRedirectError extends Error {
  constructor() {
    super("We couldn't open the secure payment page. Please try again. You haven't been charged.");
    this.name = "PayuRedirectError";
  }
}

export function rememberPayuAttempt(attempt: Omit<PayuAttempt, "startedAt">): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...attempt, startedAt: Date.now() } satisfies PayuAttempt));
  } catch {
    /* storage blocked (private window): the return redirect carries the reference anyway */
  }
}

/** The attempt this tab started and has not heard back about, or null (none, expired, unreadable). */
export function readPayuAttempt(): PayuAttempt | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const attempt = JSON.parse(raw) as Partial<PayuAttempt>;
    if (typeof attempt.reference !== "string" || typeof attempt.startedAt !== "number") return null;
    if (Date.now() - attempt.startedAt > MAX_AGE_MS) {
      forgetPayuAttempt();
      return null;
    }

    return { reference: attempt.reference, planName: typeof attempt.planName === "string" ? attempt.planName : "", startedAt: attempt.startedAt };
  } catch {
    return null;
  }
}

export function forgetPayuAttempt(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to forget */
  }
}

/** https always; plain http only for a developer's own machine (a local fake PayU). Anything else is not a payment page. */
function isAllowedDestination(action: string): boolean {
  try {
    const url = new URL(action);
    if (url.protocol === "https:") return true;

    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

/**
 * POSTs the signed form to PayU's page. The whole window navigates away, so this does not "return" in any
 * useful sense — the student comes back through our return URL, in a fresh page load.
 */
export function submitToPayu(checkout: PayuCheckoutOptions): void {
  if (typeof document === "undefined" || !isAllowedDestination(checkout.action)) throw new PayuRedirectError();

  const form = document.createElement("form");
  form.method = "POST";
  form.action = checkout.action;
  form.acceptCharset = "UTF-8";
  form.style.display = "none";

  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
