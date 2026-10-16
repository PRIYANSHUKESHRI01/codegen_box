"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import type { AdminSubscriptionRow, SubscriptionChangeResponse } from "@/types/adminSubscriptions";
import { describeEnd } from "./planUi";

const EXTEND_PRESETS = [7, 30, 90, 365];
const field = "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary";

interface PlanActionModalProps {
  mode: "extend" | "cancel";
  row: AdminSubscriptionRow;
  onClose: () => void;
  onDone: (result: SubscriptionChangeResponse, mode: "extend" | "cancel") => void;
}

/**
 * Add days to a running plan, or end it now. Both need a reason (it is kept in the
 * audit log, and "why does this student have Expert?" is exactly the
 * question that gets asked a month later).
 *
 * Ending a student's plan puts them straight back on the free plan; ending a
 * COLLEGE's or a company's switches off access for everyone under it at once, so
 * those also ask for the superadmin's own password. Neither action refunds
 * anything — money taken online is refunded from the payment gateway (PayU / Razorpay)
 * Dashboard.
 */
export function PlanActionModal({ mode, row, onClose, onDone }: PlanActionModalProps) {
  const [days, setDays] = useState("30");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStudent = row.subscriber.type === "user";
  const needsPassword = mode === "cancel" && !isStudent;
  const daysNumber = /^\d{1,4}$/.test(days.trim()) ? Number(days.trim()) : null;

  const valid =
    reason.trim().length >= 3 && (mode === "cancel" || (daysNumber !== null && daysNumber >= 1 && daysNumber <= 1825)) && (!needsPassword || password.length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || working) return;
    setWorking(true);
    setError(null);

    try {
      const result =
        mode === "extend"
          ? await api.post<SubscriptionChangeResponse>(`/superadmin/subscriptions/${row.id}/extend`, { days: daysNumber, reason: reason.trim() })
          : await api.post<SubscriptionChangeResponse>(`/superadmin/subscriptions/${row.id}/cancel`, {
              reason: reason.trim(),
              ...(needsPassword ? { password } : {}),
            });
      onDone(result, mode);
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.password?.[0] ?? err.errors?.days?.[0] ?? err.errors?.subscription?.[0] ?? err.message : "Something went wrong. Check your connection and try again.");
      setWorking(false);
    }
  };

  const who = row.subscriber.name;
  const planName = row.plan?.name ?? "plan";
  const destructive = mode === "cancel";

  return (
    <Modal
      onClose={() => !working && onClose()}
      title={destructive ? `End ${planName} now` : `Extend ${planName}`}
      subtitle={`${who} · ${describeEnd(row)}`}
      icon={destructive ? Ban : CalendarPlus}
      iconClassName={destructive ? "bg-status-danger/10 text-status-danger" : undefined}
      size="md"
      closeOnBackdrop={false}
      showCloseButton={!working}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50"
          >
            Keep as it is
          </button>
          <button
            type="submit"
            form="plan-action-form"
            disabled={!valid || working}
            className={cn(
              "inline-flex items-center gap-2 rounded-control px-4 py-2 font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              destructive ? "bg-status-danger hover:opacity-90" : "bg-accent-primary hover:bg-accent-primary-hover"
            )}
          >
            {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {destructive ? "End plan now" : "Extend plan"}
          </button>
        </>
      }
    >
      <form id="plan-action-form" onSubmit={submit} className="space-y-4">
        {mode === "extend" ? (
          <div>
            <label htmlFor="plan-action-days" className="mb-1 block text-xs font-semibold text-text-secondary">
              Add days
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input id="plan-action-days" inputMode="numeric" autoFocus value={days} onChange={(e) => setDays(e.target.value)} className={cn(field, "w-28 font-mono")} />
              {EXTEND_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDays(String(preset))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-3xs font-bold transition-colors",
                    daysNumber === preset ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-elevated text-text-secondary hover:text-primary"
                  )}
                >
                  {preset === 365 ? "1 year" : `${preset} days`}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-2xs text-text-muted">Added to the current end date. The plan, price and start date don&apos;t change.</p>
          </div>
        ) : (
          <div className="space-y-2 text-xs leading-relaxed text-text-secondary">
            {isStudent ? (
              <p>
                <strong className="text-primary">{who}</strong> goes back to the free Coder plan <strong className="text-primary">immediately</strong>: everything {planName} unlocked closes, and their open screen
                shows it within seconds.
              </p>
            ) : (
              <p>
                <strong className="text-primary">{who}</strong> loses {planName} <strong className="text-primary">immediately</strong>.{" "}
                {row.subscriber.type === "college"
                  ? "Every student at this college stops being covered by it and falls back to the plan they hold themselves, and the college can no longer add students."
                  : "The company's hiring tools follow the plan it holds."}
              </p>
            )}
            {row.paid_through_gateway && (
              <p className="rounded-control border border-status-warning/30 bg-status-warning/10 p-2.5 text-text-secondary">
                This was paid for online. Ending it does <strong className="text-primary">not</strong> refund the money — refund from the payment gateway&apos;s dashboard (PayU or Razorpay) if that&apos;s owed (the refund then syncs here by itself).
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="plan-action-reason" className="mb-1 block text-xs font-semibold text-text-secondary">
            Reason <span className="font-normal text-text-muted">(kept in the audit log)</span>
          </label>
          <textarea
            id="plan-action-reason"
            rows={2}
            maxLength={300}
            autoFocus={mode === "cancel"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={destructive ? "e.g. Given to the wrong account" : "e.g. Compensation for the contest outage"}
            className={cn(field, "resize-none")}
          />
        </div>

        {needsPassword && (
          <div>
            <label htmlFor="plan-action-password" className="mb-1 block text-xs font-semibold text-text-secondary">
              Your password (to confirm it&apos;s you)
            </label>
            <input
              id="plan-action-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={field}
            />
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
