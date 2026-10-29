// Mirrors the JSON of the payment endpoints (backend CheckoutController, SuperAdminPaymentController).
// All amounts are whole rupees, except the checkout payloads' `amount`, which is paise — the unit both gateways speak.
// Two gateways take the money (PayU, Razorpay); the server says which one is active and what the browser must do.

import type { MySubscriptionResponse } from "./subscription";

/** The payment gateways the backend can use. The server's `PAYMENT_GATEWAY` setting picks the active one. */
export type PaymentGatewayCode = "payu" | "razorpay";

/** Whether the Buy buttons can work at all, which gateway is behind them, and whether it is in test mode. Part of GET /me/subscription. */
export interface CheckoutInfo {
  /** False until the active gateway's credentials are set on the server. */
  available: boolean;
  /** Test credentials: nothing real is charged. */
  test_mode: boolean;
  /** The gateway new checkouts go to (null when the server is misconfigured and payments are off). Optional for older servers. */
  gateway?: PaymentGatewayCode | null;
  /** "PayU" / "Razorpay" — for "Secure payment by …". */
  gateway_name?: string | null;
}

/** What `new Razorpay(options)` is opened with — built by the server from its own price. */
export interface RazorpayCheckoutOptions {
  /** Absent on servers from before PayU existed: that means Razorpay. */
  gateway?: "razorpay";
  key: string;
  order_id: string;
  /** Paise. */
  amount: number;
  currency: string;
  name: string;
  description: string;
  theme_color: string;
  prefill: { name?: string; email?: string; contact?: string };
  /** Our id for this purchase; what the status endpoint is asked about. */
  reference: string;
  test_mode: boolean;
}

/**
 * PayU Hosted Checkout: not a window over our page but a form the browser POSTs to PayU's own page. The server
 * signed it (the hash covers the amount and buyer), so the browser can submit it but not change it.
 */
export interface PayuCheckoutOptions {
  gateway: "payu";
  /** PayU's `_payment` URL (test or production). */
  action: string;
  method: "POST";
  /** Every field of the form, including the server-computed `hash`. Never contains the salt. */
  fields: Record<string, string>;
  /** Paise. */
  amount: number;
  currency: string;
  /** Our id for this purchase; what the status endpoint is asked about. */
  reference: string;
  test_mode: boolean;
}

export type CheckoutOptions = RazorpayCheckoutOptions | PayuCheckoutOptions;

export interface CreateCheckoutResponse {
  checkout: CheckoutOptions;
  quote: { total: number; currency: string };
}

/** How the student's browser came back from PayU — a hint for wording only; the page asks the API for the truth. */
export type PaymentReturnResult = "paid" | "processing" | "failed" | "cancelled" | "pending" | "invalid" | "unknown";

/** Razorpay Checkout's success callback — sent to the server, which checks the signature. */
export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "processing" | "partially_refunded" | "refunded";

/** One payment as the student sees it (their history, and the status poll). */
export interface PaymentReceipt {
  id: string;
  status: PaymentStatus;
  description: string;
  plan_code: string | null;
  currency: string;
  amount: number;
  list_price: number | null;
  discount: number | null;
  method: string | null;
  payment_id: string | null;
  failure_reason: string | null;
  refunded_amount: number;
  test_mode: boolean;
  created_at: string;
  paid_at: string | null;
  refunded_at: string | null;
}

export interface PaymentsResponse {
  payments: PaymentReceipt[];
  checkout: CheckoutInfo;
}

/** POST /me/checkout/verify: the new subscription state, plus the payment that produced it. */
export type VerifyPaymentResponse = MySubscriptionResponse & { payment: PaymentReceipt };

/** POST /me/checkout/redeem: a free offer claimed — the new subscription state, plus what was redeemed. No payment exists. */
export type RedeemOfferResponse = MySubscriptionResponse & {
  redemption: { plan_code: string; plan_name: string; current_period_end: string | null; days_remaining: number | null };
};

// ───────────────────────────── superadmin ─────────────────────────────

/** A chargeback PayU reported against a payment — someone must respond before `due_date`. */
export interface PaymentDispute {
  status: string;
  amount: string;
  reason: string;
  due_date: string;
  updated_at: string;
}

export interface AdminPayment extends PaymentReceipt {
  raw_status: string;
  /** Which gateway the order was opened on. */
  gateway: string;
  /** Chargebacks by id; null when there are none. */
  disputes?: Record<string, PaymentDispute> | null;
  payer_name: string;
  payer_email: string;
  user_id: number | null;
  gateway_order_id: string;
  attempts: number;
  failure_code: string | null;
  refund_reason: string | null;
  fulfilled_at: string | null;
}

export interface AdminPaymentsResponse {
  mode: "test" | "live";
  /** The gateway new checkouts go to, and what to call it. Null when PAYMENT_GATEWAY names something unknown. */
  gateway: PaymentGatewayCode | null;
  gateway_name: string | null;
  configured: boolean;
  webhook_configured: boolean;
  /** When the active gateway last called our webhook; null if it never has. */
  last_webhook_at: string | null;
  summary: { gross: number; refunded: number; net: number; last_30_days: number; orders_paid: number; needs_review: number };
  payments: AdminPayment[];
  pagination: { current_page: number; last_page: number; total: number };
}
