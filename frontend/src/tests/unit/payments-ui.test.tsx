import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { AdminPayment, AdminPaymentsResponse, PaymentReceipt } from "@/types/payments";

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: (path: string) => get(path), post: (path: string, body?: unknown) => post(path, body), put: vi.fn(), delete: vi.fn() } };
});

import { PaymentHistory } from "@/components/billing/PaymentHistory";
import { PaymentsPanel } from "@/components/admin/superadmin/PaymentsPanel";
import { notifySubscriptionChanged } from "@/lib/projectLab";

const flush = () => act(async () => { await Promise.resolve(); });

const receipt = (overrides: Partial<PaymentReceipt> = {}): PaymentReceipt => ({
  id: "01JABC",
  status: "paid",
  description: "Grandmaster",
  plan_code: "grandmaster",
  currency: "INR",
  amount: 2999,
  list_price: 4999,
  discount: 2000,
  method: "upi",
  payment_id: "pay_ABC123",
  failure_reason: null,
  refunded_amount: 0,
  test_mode: false,
  created_at: "2026-10-14T10:00:00Z",
  paid_at: "2026-10-14T10:01:00Z",
  refunded_at: null,
  ...overrides,
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

afterEach(cleanup);

describe("payment history", () => {
  it("lists what the student paid, how, and what became of each payment", async () => {
    get.mockResolvedValue({
      payments: [
        receipt(),
        receipt({ id: "01JDEF", status: "failed", description: "Expert", amount: 1199, method: "card", payment_id: null, failure_reason: "Your card was declined.", paid_at: null }),
        receipt({ id: "01JGHI", status: "refunded", description: "Expert", amount: 1199, refunded_amount: 1199, payment_id: "pay_REF" }),
        receipt({ id: "01JJKL", status: "processing", description: "Expert", amount: 1199, payment_id: "pay_PROC" }),
      ],
      checkout: { available: true, test_mode: false },
    });
    render(<PaymentHistory />);
    await flush();

    const row = (text: string) => screen.getByText(text).closest("tr") as HTMLElement;

    expect(within(row("pay_ABC123")).getByText("₹2,999")).toBeTruthy();
    expect(within(row("pay_ABC123")).getByText("UPI")).toBeTruthy();
    expect(within(row("pay_ABC123")).getByText("Paid")).toBeTruthy();

    expect(screen.getByText("Your card was declined.")).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();

    expect(within(row("pay_REF")).getByText("Refunded")).toBeTruthy();
    expect(within(row("pay_REF")).getByText("₹1,199 refunded")).toBeTruthy();

    expect(within(row("pay_PROC")).getByText("Processing")).toBeTruthy();
    expect(screen.getByText(/finishing your activation/i)).toBeTruthy();
  });

  it("marks test-mode payments so nobody mistakes them for real money", async () => {
    get.mockResolvedValue({ payments: [receipt({ test_mode: true })], checkout: { available: true, test_mode: true } });
    render(<PaymentHistory />);
    await flush();

    expect(screen.getByText("Test")).toBeTruthy();
  });

  it("shows nothing at all until there is something to show", async () => {
    get.mockResolvedValue({ payments: [], checkout: { available: true, test_mode: false } });
    const { container } = render(<PaymentHistory />);
    await flush();

    expect(container.querySelector("section")).toBeNull();
  });

  it("never gets in the way of buying when it cannot load", async () => {
    get.mockRejectedValue(new Error("down"));
    const { container } = render(<PaymentHistory />);
    await flush();

    expect(container.innerHTML).toBe("");
  });

  it("re-reads itself right after a purchase", async () => {
    get.mockResolvedValue({ payments: [], checkout: { available: true, test_mode: false } });
    render(<PaymentHistory />);
    await flush();
    expect(screen.queryByText("Payment history")).toBeNull();

    get.mockResolvedValue({ payments: [receipt()], checkout: { available: true, test_mode: false } });
    act(() => notifySubscriptionChanged());
    await flush();

    await waitFor(() => expect(screen.getByText("Payment history")).toBeTruthy());
  });
});

// ───────────────────────────── superadmin ─────────────────────────────

const adminPayment = (overrides: Partial<AdminPayment> = {}): AdminPayment => ({
  ...receipt(),
  raw_status: "paid",
  payer_name: "Asha Rao",
  payer_email: "asha@example.com",
  user_id: 7,
  gateway: "razorpay",
  gateway_order_id: "order_ABC",
  attempts: 0,
  failure_code: null,
  refund_reason: null,
  fulfilled_at: "2026-10-14T10:01:00Z",
  ...overrides,
});

const adminResponse = (overrides: Partial<AdminPaymentsResponse> = {}): AdminPaymentsResponse => ({
  mode: "live",
  gateway: "razorpay",
  gateway_name: "Razorpay",
  configured: true,
  webhook_configured: true,
  last_webhook_at: "2026-10-14T10:05:00Z",
  summary: { gross: 10000, refunded: 1000, net: 9000, last_30_days: 4000, orders_paid: 5, needs_review: 0 },
  payments: [adminPayment()],
  pagination: { current_page: 1, last_page: 1, total: 1 },
  ...overrides,
});

describe("superadmin → Payments", () => {
  it("shows revenue, the mode, and every payment with who paid for what", async () => {
    get.mockResolvedValue(adminResponse());
    render(<PaymentsPanel triggerToast={vi.fn()} />);
    await flush();

    expect(screen.getByText("live mode")).toBeTruthy();
    expect(screen.getByText("Net revenue").nextSibling?.textContent).toBe("₹9,000");
    expect(screen.getByText("Last 30 days").nextSibling?.textContent).toBe("₹4,000");
    expect(screen.getByText("Paid orders").nextSibling?.textContent).toBe("5");
    // "Refunded" is also a status filter button, so pick the stat tile.
    expect(screen.getAllByText("Refunded").some((el) => el.nextSibling?.textContent === "₹1,000")).toBe(true);

    const row = screen.getByText("asha@example.com").closest("tr") as HTMLElement;
    expect(within(row).getByText("Asha Rao")).toBeTruthy();
    expect(within(row).getByText("Grandmaster")).toBeTruthy();
    expect(within(row).getByText("₹2,999")).toBeTruthy();
    expect(within(row).getByText("order_ABC")).toBeTruthy();
    expect(within(row).queryByRole("button", { name: /re-check/i })).toBeNull(); // already paid: nothing to re-check
  });

  it("says plainly that nobody can buy yet when Razorpay is not configured", async () => {
    get.mockResolvedValue(adminResponse({ mode: "test", configured: false, webhook_configured: false, payments: [] }));
    render(<PaymentsPanel triggerToast={vi.fn()} />);
    await flush();

    expect(screen.getByText(/isn.t configured yet/i)).toBeTruthy();
    expect(screen.getByText("No payments match.")).toBeTruthy();
    expect(screen.getByText("test mode")).toBeTruthy();
  });

  it("warns about a missing webhook secret without crying wolf about the keys", async () => {
    get.mockResolvedValue(adminResponse({ webhook_configured: false }));
    render(<PaymentsPanel triggerToast={vi.fn()} />);
    await flush();

    expect(screen.getByText(/webhook secret isn.t set/i)).toBeTruthy();
    expect(screen.queryByText(/isn.t configured yet/i)).toBeNull();
  });

  it("raises an alert for payments needing a person, who can re-check one with Razorpay", async () => {
    const stuck = adminPayment({ id: "01JSTUCK", status: "processing", raw_status: "needs_review", payer_email: "stuck@example.com", payment_id: "pay_STUCK", failure_reason: "The buyer no longer has an account." });
    get.mockResolvedValue(adminResponse({ summary: { gross: 0, refunded: 0, net: 0, last_30_days: 0, orders_paid: 0, needs_review: 1 }, payments: [stuck] }));
    post.mockResolvedValue({ payment: { ...stuck, status: "paid", raw_status: "paid" } });
    const toast = vi.fn();
    render(<PaymentsPanel triggerToast={toast} />);
    await flush();

    expect(screen.getByRole("alert").textContent).toMatch(/1 payment need review/);
    expect(screen.getByText("The buyer no longer has an account.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /re-check/i }));
    await flush();
    await flush();

    expect(post).toHaveBeenCalledWith("/superadmin/payments/01JSTUCK/reconcile", undefined);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining("stuck@example.com"));
  });

  it("filters by status and searches, asking the server rather than guessing", async () => {
    get.mockResolvedValue(adminResponse());
    render(<PaymentsPanel triggerToast={vi.fn()} />);
    await flush();
    get.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Needs review" }));
    await waitFor(() => expect(get).toHaveBeenCalledWith("/superadmin/payments?status=needs_review"));

    fireEvent.change(screen.getByPlaceholderText(/search name, email/i), { target: { value: "asha@" } });
    await waitFor(() => expect(get).toHaveBeenCalledWith("/superadmin/payments?status=needs_review&q=asha%40"), { timeout: 2000 });
  });

  it("pages through a long list", async () => {
    get.mockResolvedValue(adminResponse({ pagination: { current_page: 1, last_page: 3, total: 61 } }));
    render(<PaymentsPanel triggerToast={vi.fn()} />);
    await flush();
    expect(screen.getByText(/Page 1 of 3 · 61 payments/)).toBeTruthy();
    get.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(get).toHaveBeenCalledWith("/superadmin/payments?page=2"));
  });

  it("offers a retry when the list cannot be loaded", async () => {
    get.mockRejectedValueOnce(new ApiError("Server error", 500));
    render(<PaymentsPanel triggerToast={vi.fn()} />);
    await flush();

    expect(screen.getByRole("alert").textContent).toContain("Server error");

    get.mockResolvedValue(adminResponse());
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await flush();

    await waitFor(() => expect(screen.getByText("asha@example.com")).toBeTruthy());
  });
});
