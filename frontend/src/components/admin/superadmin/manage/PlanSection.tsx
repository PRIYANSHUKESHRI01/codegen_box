"use client";

import { useState } from "react";
import { Ban, CalendarPlus, Gift, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/pricing";
import type { AdminSubscriptionRow, SubscriptionChangeResponse } from "@/types/adminSubscriptions";
import { GrantPlanModal } from "../GrantPlanModal";
import { PlanActionModal } from "../PlanActionModal";
import { SourceBadge, StateBadge, describeEnd, formatDay } from "../planUi";
import { Card, Row, SectionTitle, dangerButton, ghostButton, primaryButton, type SectionProps } from "./shared";

const PAYMENT_TONE: Record<string, string> = {
  paid: "text-status-success",
  refunded: "text-text-muted",
  partially_refunded: "text-status-warning",
  failed: "text-status-danger",
};

/**
 * One student's plan: what they hold now and where it comes from, the hand tools
 * (give, extend, end) and the whole history — including what they actually paid.
 * Everything here is live, so what the student sees follows within seconds.
 */
export function PlanSection({ data, reload, triggerToast }: SectionProps) {
  const { user, plan, payments, capabilities } = data;
  const [granting, setGranting] = useState(false);
  const [action, setAction] = useState<{ mode: "extend" | "cancel"; row: AdminSubscriptionRow } | null>(null);

  if (!plan) {
    return (
      <Card>
        <p className="flex items-start gap-2 leading-relaxed text-text-secondary">
          <Info className="mt-px h-4 w-4 shrink-0 text-text-muted" aria-hidden />
          Personal plans belong to students. {user.college ? `${user.name}'s access follows ${user.college.name}'s plan — manage it from Colleges & TPOs.` : "This account has no plan of its own."}
        </p>
      </Card>
    );
  }

  const coverage = plan.coverage;
  // The free plan is replaced by every plan a student gets and recreated whenever one ends, so its finished rows
  // would only be noise ("Coder · cancelled" after every change). Paid plans and the running free one stay.
  const visibleHistory = plan.history.filter((row) => !(row.plan?.is_free && row.state !== "active"));
  // The running plan THIS student holds themselves (a college may be what actually governs them).
  const own = plan.history.find((row) => row.state === "active" && row.plan?.kind === "base") ?? null;
  const covered = plan.covered_by_college;

  const changed = async (result: SubscriptionChangeResponse, message: string) => {
    triggerToast(message);
    if (result.warning) triggerToast(result.warning);
    await reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Plan right now</SectionTitle>
        <Card className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base font-extrabold text-primary">{coverage.plan?.name ?? "No active plan"}</div>
              <div className="mt-0.5 text-2xs text-text-secondary">
                {covered
                  ? `Included through ${plan.college_name}`
                  : coverage.days_remaining === null
                    ? "Never expires"
                    : coverage.days_remaining <= 0
                      ? "Ended — they are on the free plan's limits"
                      : `${coverage.days_remaining} day${coverage.days_remaining === 1 ? "" : "s"} left · until ${formatDay(coverage.current_period_end)}`}
              </div>
            </div>
            {own && <SourceBadge row={own} />}
          </div>

          {covered && (
            <p className="flex items-start gap-2 rounded-control border border-border-subtle bg-surface p-2.5 text-2xs leading-relaxed text-text-secondary">
              <Info className="mt-px h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />
              {user.name}&apos;s college plan governs what they can do. A plan given to them personally is kept on file and applies only once the college&apos;s plan ends.
            </p>
          )}

          {plan.addons.length > 0 && (
            <div className="text-2xs text-text-secondary">
              Add-ons: {plan.addons.map((a) => `${a.name}${a.days_remaining !== null ? ` (${a.days_remaining}d left)` : ""}`).join(", ")}
            </div>
          )}

          {capabilities.grant_plan && (
            <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3">
              <button type="button" onClick={() => setGranting(true)} className={primaryButton}>
                <Gift className="h-3 w-3" /> {own && !own.plan?.is_free ? "Change plan" : "Give a plan"}
              </button>
              {own?.can_extend && (
                <button type="button" onClick={() => setAction({ mode: "extend", row: own })} className={ghostButton}>
                  <CalendarPlus className="h-3 w-3" /> Extend
                </button>
              )}
              {own?.can_cancel && (
                <button type="button" onClick={() => setAction({ mode: "cancel", row: own })} className={dangerButton}>
                  <Ban className="h-3 w-3" /> End plan
                </button>
              )}
            </div>
          )}
        </Card>
      </div>

      <div>
        <SectionTitle>Plan history</SectionTitle>
        {visibleHistory.length === 0 ? (
          <p className="text-xs text-text-muted">No plans on record.</p>
        ) : (
          <ol className="space-y-2">
            {visibleHistory.map((row) => (
              <li key={row.id} className="rounded-control border border-border-subtle bg-elevated/60 p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold text-primary">{row.plan?.name ?? "Plan"}</div>
                  <StateBadge state={row.state} />
                </div>
                <div className="mt-1 text-text-secondary">
                  {formatDay(row.started_at)} → {describeEnd(row)}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <SourceBadge row={row} />
                  {row.granted_by && <span className="text-3xs text-text-muted">by {row.granted_by}</span>}
                </div>
                {row.reason && <div className="mt-1 text-text-muted">“{row.reason}”</div>}
                {row.cancel_reason && (
                  <div className="mt-1 text-text-muted">
                    Ended{row.canceled_by ? ` by ${row.canceled_by}` : ""}: “{row.cancel_reason}”
                  </div>
                )}
                {row.payment_reference && <div className="mt-1 font-mono text-3xs text-text-muted">Ref {row.payment_reference}</div>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <SectionTitle>Online payments</SectionTitle>
        {payments.length === 0 ? (
          <p className="text-xs text-text-muted">No online payments. (A plan given by an admin doesn&apos;t appear here — it is in the history above.)</p>
        ) : (
          <Card>
            <dl className="divide-y divide-border-subtle">
              {payments.map((p) => (
                <div key={p.id} className="py-2 first:pt-0 last:pb-0">
                  <Row label={p.description}>
                    <span className="font-mono">{formatInr(p.amount)}</span>
                  </Row>
                  <div className="flex justify-between text-3xs text-text-muted">
                    <span>{formatDay(p.paid_at ?? p.created_at)}</span>
                    <span className={cn("font-bold uppercase", PAYMENT_TONE[p.status] ?? "text-text-muted")}>{p.status.replace("_", " ")}</span>
                  </div>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>

      {granting && (
        <GrantPlanModal
          student={{ id: user.id, name: user.name, email: user.email, college: user.college?.name ?? null }}
          onClose={() => setGranting(false)}
          onGranted={(result) => {
            setGranting(false);
            void changed(result, `${user.name} is now on ${result.subscription.plan?.name}${result.subscription.current_period_end ? ` until ${formatDay(result.subscription.current_period_end)}` : ""}.`);
          }}
        />
      )}
      {action && (
        <PlanActionModal
          mode={action.mode}
          row={action.row}
          onClose={() => setAction(null)}
          onDone={(result, mode) => {
            setAction(null);
            void changed(result, mode === "extend" ? `${user.name}'s plan now runs until ${formatDay(result.subscription.current_period_end)}.` : `${user.name} is back on the free plan.`);
          }}
        />
      )}
    </div>
  );
}
