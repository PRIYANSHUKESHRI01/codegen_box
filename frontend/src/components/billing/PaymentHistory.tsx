"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/pricing";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/projectLab";
import type { PaymentReceipt, PaymentStatus, PaymentsResponse } from "@/types/payments";

const STATUS_STYLE: Record<PaymentStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-status-success/15 text-status-success border-status-success/30" },
  pending: { label: "Pending", className: "bg-elevated text-text-muted border-border-subtle" },
  processing: { label: "Processing", className: "bg-status-warning/15 text-status-warning border-status-warning/30" },
  failed: { label: "Failed", className: "bg-status-danger/15 text-status-danger border-status-danger/30" },
  expired: { label: "Expired", className: "bg-elevated text-text-muted border-border-subtle" },
  partially_refunded: { label: "Partly refunded", className: "bg-status-warning/15 text-status-warning border-status-warning/30" },
  refunded: { label: "Refunded", className: "bg-elevated text-text-secondary border-border-strong" },
};

const METHOD_LABEL: Record<string, string> = {
  card: "Card",
  upi: "UPI",
  netbanking: "Netbanking",
  wallet: "Wallet",
  emi: "EMI",
  paylater: "Pay Later",
  bank_transfer: "Bank transfer",
  qr: "QR code",
};

function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

/** The student's own payments: what they paid, when, how, and what happened to each — the receipts. Hidden until they have one. */
export function PaymentHistory() {
  const [payments, setPayments] = useState<PaymentReceipt[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    api
      .get<PaymentsResponse>("/me/payments")
      .then((res) => {
        setPayments(res.payments);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
    // A purchase just completed (or was refunded under us): re-read.
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, load);
    return () => window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, load);
  }, [load]);

  if (failed && payments === null) return null; // a billing history that can't load must never get in the way of buying
  if (payments === null || payments.length === 0) return null;

  return (
    <section aria-labelledby="payment-history-heading" className="pb-10 sm:pb-14">
      <Container size="xl">
        <div className="mx-auto max-w-6xl">
          <h2 id="payment-history-heading" className="mb-5 flex items-center justify-center gap-2 text-center text-xl font-extrabold tracking-tight text-primary sm:text-2xl">
            <Receipt className="h-5 w-5 text-accent-primary" aria-hidden /> Payment history
          </h2>

          <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs font-bold uppercase tracking-wide text-text-muted">
                  <th scope="col" className="p-4">Date</th>
                  <th scope="col" className="p-4">Plan</th>
                  <th scope="col" className="p-4">Amount</th>
                  <th scope="col" className="p-4">Method</th>
                  <th scope="col" className="p-4">Status</th>
                  <th scope="col" className="p-4">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const style = STATUS_STYLE[payment.status] ?? STATUS_STYLE.pending;
                  return (
                    <tr key={payment.id} className="border-b border-border-subtle last:border-b-0 align-top">
                      <td className="whitespace-nowrap p-4 text-text-secondary">{formatWhen(payment.paid_at ?? payment.created_at)}</td>
                      <td className="p-4 font-semibold text-primary">
                        {payment.description}
                        {payment.test_mode && <span className="ml-2 rounded-full border border-status-warning/30 bg-status-warning/10 px-2 py-0.5 text-3xs font-bold uppercase text-status-warning">Test</span>}
                      </td>
                      <td className="whitespace-nowrap p-4 font-mono text-primary">
                        {formatInr(payment.amount)}
                        {payment.refunded_amount > 0 && <div className="text-xs text-text-muted">{formatInr(payment.refunded_amount)} refunded</div>}
                      </td>
                      <td className="p-4 text-text-secondary">{payment.method ? (METHOD_LABEL[payment.method] ?? payment.method) : "—"}</td>
                      <td className="p-4">
                        <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wide", style.className)}>{style.label}</span>
                        {payment.status === "failed" && payment.failure_reason && <div className="mt-1 max-w-[240px] text-xs text-text-muted">{payment.failure_reason}</div>}
                        {payment.status === "processing" && <div className="mt-1 max-w-[240px] text-xs text-text-muted">Paid — we&apos;re finishing your activation.</div>}
                      </td>
                      <td className="p-4 font-mono text-xs text-text-muted">
                        {payment.payment_id ?? payment.id}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </section>
  );
}
