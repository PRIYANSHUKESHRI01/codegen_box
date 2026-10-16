"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, CreditCard, Loader2, RefreshCw, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/pricing";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { AdminPayment, AdminPaymentsResponse, PaymentStatus } from "@/types/payments";

const STATUS_STYLE: Record<PaymentStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-status-success/15 text-status-success border-status-success/30" },
  pending: { label: "Pending", className: "bg-elevated text-text-muted border-border-subtle" },
  processing: { label: "Needs review", className: "bg-status-danger/15 text-status-danger border-status-danger/30" },
  failed: { label: "Failed", className: "bg-status-danger/15 text-status-danger border-status-danger/30" },
  expired: { label: "Expired", className: "bg-elevated text-text-muted border-border-subtle" },
  partially_refunded: { label: "Partly refunded", className: "bg-status-warning/15 text-status-warning border-status-warning/30" },
  refunded: { label: "Refunded", className: "bg-elevated text-text-secondary border-border-strong" },
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "needs_review", label: "Needs review" },
  { value: "created", label: "Awaiting payment" },
  { value: "expired", label: "Expired" },
  { value: "partially_refunded", label: "Partly refunded" },
  { value: "refunded", label: "Refunded" },
];

/** What the gateway codes the API sends are called on screen. */
const GATEWAY_LABEL: Record<string, string> = { payu: "PayU", razorpay: "Razorpay" };

/** The backend settings that switch each gateway on — shown to the superadmin when payments are not set up. */
const SETUP_HINT: Record<string, string> = {
  payu: "PAYU_KEY and PAYU_SALT (and PAYU_MODE=live for real money)",
  razorpay: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET",
};

const gatewayLabel = (code: string | null | undefined): string => (code ? (GATEWAY_LABEL[code] ?? code) : "The payment gateway");

function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
      <div className="text-3xs font-bold uppercase tracking-wide text-text-muted">{label}</div>
      <div className={cn("mt-1.5 font-mono text-xl font-extrabold", tone === "danger" ? "text-status-danger" : "text-primary")}>{value}</div>
    </div>
  );
}

/**
 * Superadmin → Payments. Every plan purchase and what it is worth, so the question "did the money
 * arrive and did the student get their plan?" has one answer.
 *
 * Money and plans are reconciled automatically (the browser's return, the gateway's webhook, and a job
 * every five minutes all land on the same order). What this screen is FOR is the exception: an order
 * where money moved but the plan could not be handed over is flagged "Needs review" and the student
 * has usually been refunded automatically; "Re-check" asks the order's gateway again for one order.
 * Refunds are issued from the gateway's own dashboard and flow back here (and into the student's access)
 * by webhook. Orders from both gateways (PayU, Razorpay) share this list, so switching gateways loses nothing.
 */
export function PaymentsPanel({ triggerToast }: { triggerToast: (msg: string) => void }) {
  const [data, setData] = useState<AdminPaymentsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [checking, setChecking] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 350);

  const load = useCallback(async () => {
    setLoadError(null);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    if (page > 1) params.set("page", String(page));

    try {
      setData(await api.get<AdminPaymentsResponse>(`/superadmin/payments${params.size ? `?${params}` : ""}`));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load the payments.");
    }
  }, [status, debouncedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // A new filter or search always starts from the first page.
  useEffect(() => setPage(1), [status, debouncedSearch]);

  const recheck = async (payment: AdminPayment) => {
    setChecking(payment.id);
    try {
      const res = await api.post<{ payment: AdminPayment }>(`/superadmin/payments/${payment.id}/reconcile`);
      triggerToast(
        res.payment.status === "paid"
          ? `Payment confirmed: ${res.payment.payer_email} is now on their plan.`
          : `Checked with ${gatewayLabel(res.payment.gateway)}: no completed payment found for that order.`
      );
      await load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't re-check that payment.");
    } finally {
      setChecking(null);
    }
  };

  if (loadError && !data) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
        <span>{loadError}</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-panel border border-border-subtle bg-surface" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-panel border border-border-subtle bg-surface" />
      </div>
    );
  }

  const { summary } = data;
  const name = gatewayLabel(data.gateway);
  // PayU has no separate webhook secret to forget — its webhooks are signed with the same salt — so "is it set up?" is
  // answered by whether PayU has ever called us. Razorpay's webhook secret is a separate setting.
  const webhookMissing = data.gateway === "payu" ? data.configured && data.last_webhook_at === null : data.configured && !data.webhook_configured;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-primary">
            <CreditCard className="h-4 w-4 text-accent-primary" /> Payments
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide",
                data.mode === "live" ? "border-status-success/30 bg-status-success/10 text-status-success" : "border-status-warning/30 bg-status-warning/10 text-status-warning"
              )}
            >
              {data.mode} mode
            </span>
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Every plan purchase.{data.gateway ? <> New checkouts go through <strong className="text-primary">{name}</strong>; an order stays with the gateway it was opened on.</> : null} Plans activate automatically the moment a payment is confirmed. Refunds are issued from that gateway&apos;s dashboard and take the plan back here by themselves.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {data.gateway === null && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-text-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" />
          PAYMENT_GATEWAY in the backend .env names a gateway that doesn&apos;t exist (use &ldquo;payu&rdquo; or &ldquo;razorpay&rdquo;). Until it is fixed nobody can buy a paid plan.
        </div>
      )}
      {data.gateway !== null && !data.configured && (
        <div role="status" className="flex items-start gap-2 rounded-control border border-status-warning/30 bg-status-warning/10 p-3 text-xs text-text-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          {name} isn&apos;t configured yet — set {SETUP_HINT[data.gateway] ?? "its credentials"} in the backend .env. Until then students see &ldquo;payments launching soon&rdquo; and nobody can buy a paid plan.
        </div>
      )}
      {webhookMissing && data.gateway !== "payu" && data.gateway !== null && (
        <div role="status" className="flex items-start gap-2 rounded-control border border-status-warning/30 bg-status-warning/10 p-3 text-xs text-text-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          The webhook secret isn&apos;t set (RAZORPAY_WEBHOOK_SECRET). Payments still activate from the student&apos;s browser and the 5-minute reconcile job, but a student who pays and closes the tab waits for that job, and dashboard refunds won&apos;t reach here.
        </div>
      )}
      {webhookMissing && data.gateway === "payu" && (
        <div role="status" className="flex items-start gap-2 rounded-control border border-status-warning/30 bg-status-warning/10 p-3 text-xs text-text-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" />
          PayU hasn&apos;t called our webhook yet. Add <span className="font-mono">/api/webhooks/payu</span> in PayU Dashboard → Developers → Webhooks (Successful, Failed, Refund and Dispute). Payments still activate when the student returns from PayU and from the 5-minute reconcile job, but a student who pays and closes the tab waits for that job, and dashboard refunds and chargebacks won&apos;t reach here.
        </div>
      )}
      {summary.needs_review > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-text-secondary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" />
          <span>
            <strong className="text-status-danger">{summary.needs_review} payment{summary.needs_review === 1 ? "" : "s"} need review</strong> — money was taken but the plan couldn&apos;t be activated. Filter by &ldquo;Needs review&rdquo; and use Re-check, or refund from the {name} dashboard.
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Net revenue" value={formatInr(summary.net)} />
        <Stat label="Last 30 days" value={formatInr(summary.last_30_days)} />
        <Stat label="Paid orders" value={String(summary.orders_paid)} />
        <Stat label="Refunded" value={formatInr(summary.refunded)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-border-subtle bg-elevated p-1" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              aria-pressed={status === f.value}
              className={cn(
                "rounded-control px-3 py-1 text-2xs font-bold transition-all",
                status === f.value ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full max-w-xs">
          <span className="sr-only">Search payments</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or payment id"
            className="w-full rounded-control border border-border-subtle bg-elevated py-2 pl-9 pr-3 text-xs text-primary outline-none focus:border-accent-primary"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border-subtle text-3xs font-bold uppercase tracking-wide text-text-muted">
              <th scope="col" className="p-3">Date</th>
              <th scope="col" className="p-3">Student</th>
              <th scope="col" className="p-3">Plan</th>
              <th scope="col" className="p-3">Amount</th>
              <th scope="col" className="p-3">Status</th>
              <th scope="col" className="p-3">Gateway reference</th>
              <th scope="col" className="p-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.payments.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-muted">
                  No payments match.
                </td>
              </tr>
            )}
            {data.payments.map((payment) => {
              const style = STATUS_STYLE[payment.status] ?? STATUS_STYLE.pending;
              const canRecheck = ["created", "expired", "needs_review"].includes(payment.raw_status);
              return (
                <tr key={payment.id} className="border-b border-border-subtle align-top last:border-b-0">
                  <td className="whitespace-nowrap p-3 text-text-secondary">{formatWhen(payment.paid_at ?? payment.created_at)}</td>
                  <td className="p-3">
                    <div className="font-semibold text-primary">{payment.payer_name}</div>
                    <div className="text-text-muted">{payment.payer_email}</div>
                  </td>
                  <td className="p-3 font-semibold text-primary">{payment.description}</td>
                  <td className="whitespace-nowrap p-3 font-mono text-primary">
                    {formatInr(payment.amount)}
                    {payment.refunded_amount > 0 && <div className="text-text-muted">−{formatInr(payment.refunded_amount)} refunded</div>}
                  </td>
                  <td className="p-3">
                    <span className={cn("inline-block rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", style.className)}>{style.label}</span>
                    {payment.failure_reason && <div className="mt-1 max-w-[260px] text-text-muted">{payment.failure_reason}</div>}
                    {payment.refund_reason && payment.refunded_amount > 0 && <div className="mt-1 max-w-[260px] text-text-muted">{payment.refund_reason}</div>}
                    {Object.entries(payment.disputes ?? {}).map(([id, dispute]) => (
                      <div key={id} className="mt-1 max-w-[260px] font-semibold text-status-danger">
                        Chargeback: {dispute.status}
                        {dispute.due_date ? ` · respond by ${dispute.due_date}` : ""}
                      </div>
                    ))}
                  </td>
                  <td className="p-3 font-mono text-3xs text-text-muted">
                    <div className="mb-0.5 font-sans font-bold uppercase tracking-wide text-text-secondary">{gatewayLabel(payment.gateway)}</div>
                    <div>{payment.gateway_order_id}</div>
                    {payment.payment_id && <div>{payment.payment_id}</div>}
                    {payment.test_mode && <div className="mt-0.5 font-sans font-bold uppercase text-status-warning">test</div>}
                  </td>
                  <td className="p-3 text-right">
                    {canRecheck && (
                      <button
                        type="button"
                        onClick={() => void recheck(payment)}
                        disabled={checking === payment.id}
                        className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover disabled:opacity-60"
                      >
                        {checking === payment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Re-check
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.pagination.last_page > 1 && (
        <div className="flex items-center justify-between text-2xs text-text-muted">
          <span>
            Page {data.pagination.current_page} of {data.pagination.last_page} · {data.pagination.total} payments
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 font-bold text-primary disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(data.pagination.last_page, p + 1))}
              disabled={page >= data.pagination.last_page}
              className="inline-flex items-center gap-1 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 font-bold text-primary disabled:opacity-50"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
