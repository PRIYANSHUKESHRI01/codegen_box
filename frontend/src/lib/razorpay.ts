// Razorpay Standard Checkout, loaded on demand.
//
// checkout.js is Razorpay's own script (https://checkout.razorpay.com/v1/checkout.js): it draws the
// payment window and talks to the bank, so card, UPI and netbanking details never touch this app or
// our server. The docs ask for it to be loaded from Razorpay directly rather than bundled — it is the
// part that is kept up to date (new UPI apps, RBI rule changes) without a release of ours — so it is
// fetched the first time a student clicks Buy, not on every page.

export const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

/** How long the script gets to arrive before the student is told something is wrong with their connection. */
const LOAD_TIMEOUT_MS = 15_000;

export interface RazorpayFailureResponse {
  error: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: { order_id?: string; payment_id?: string };
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  /** Paise. */
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  retry?: { enabled?: boolean };
  modal?: { ondismiss?: () => void; confirm_close?: boolean; escape?: boolean; backdropclose?: boolean };
  handler: (response: import("@/types/payments").RazorpaySuccessResponse) => void;
}

export interface RazorpayInstance {
  open(): void;
  close(): void;
  on(event: "payment.failed", callback: (response: RazorpayFailureResponse) => void): void;
}

export type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/** The payment window could not be loaded (offline, blocked by an ad-blocker or a network filter). */
export class RazorpayLoadError extends Error {
  constructor() {
    super("We couldn't load the secure payment window. Check your connection (or disable any ad-blocker for this page) and try again. You haven't been charged.");
    this.name = "RazorpayLoadError";
  }
}

let loading: Promise<RazorpayConstructor> | null = null;

/** Resolves with Razorpay's constructor, loading the script once; a failed load can be retried by calling again. */
export function loadRazorpay(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined") return Promise.reject(new RazorpayLoadError());
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;

  loading = new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;

    const fail = () => {
      window.clearTimeout(timer);
      script.remove(); // a stale failed tag would make the next attempt look "already loading"
      loading = null;
      reject(new RazorpayLoadError());
    };

    const timer = window.setTimeout(fail, LOAD_TIMEOUT_MS);

    script.onload = () => {
      window.clearTimeout(timer);
      if (window.Razorpay) resolve(window.Razorpay);
      else fail();
    };
    script.onerror = fail;

    document.head.appendChild(script);
  });

  return loading;
}

/** Test seam: forgets a load in flight so the next test starts clean. */
export function __resetRazorpayLoaderForTests(): void {
  loading = null;
}
