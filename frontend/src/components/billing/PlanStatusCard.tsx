"use client";

import { Building2, CheckCircle2, Clock, Crown, Gift, Lock, Sparkles, TimerOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPlanEnded } from "@/components/billing/PlanChip";
import { ACADEMY_PLAN_CODE, isTopPlan } from "@/lib/pricing";
import type { FeatureTrial, MySubscriptionResponse } from "@/types/subscription";

const TRIAL_LABEL: Record<keyof FeatureTrial["used"], string> = {
  mock_interview: "AI mock interview",
  speaking: "Speaking Lab recording",
  listening: "AI listening lesson",
  vocabulary: "AI vocabulary quiz",
};

function formatDay(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
}

/** How much of the paid term has gone, 0–100, from the real start and end dates. null when either is unknown. */
function termElapsedPercent(startedAt: string | null, endsAt: string | null): number | null {
  if (!startedAt || !endsAt) return null;

  const start = new Date(startedAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!(end > start)) return null;

  return Math.min(100, Math.max(0, Math.round(((Date.now() - start) / (end - start)) * 100)));
}

function Meter({ label, used, limit, note }: { label: string; used: number; limit: number | null; note?: string }) {
  const full = limit !== null && used >= limit;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-semibold text-primary">{label}</span>
        <span className={cn("font-mono tabular-nums", full ? "font-bold text-status-warning" : "text-text-secondary")}>
          {limit === null ? "Unlimited" : `${Math.min(used, limit)} of ${limit} used`}
        </span>
      </div>
      {limit !== null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)}>
          <div className={cn("h-full rounded-full transition-all", full ? "bg-status-warning" : "bg-accent-primary")} style={{ width: `${limit === 0 ? 100 : Math.min(100, (used / limit) * 100)}%` }} />
        </div>
      )}
      {note && <p className="mt-1 text-3xs text-text-muted">{note}</p>}
    </div>
  );
}

function Access({ label, on }: { label: string; on: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-control border px-2.5 py-2 text-xs font-semibold",
        on ? "border-status-success/25 bg-status-success/5 text-primary" : "border-border-subtle bg-elevated/50 text-text-muted"
      )}
    >
      {on ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" aria-hidden /> : <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="sr-only">{on ? "included" : "not on your plan"}</span>
    </li>
  );
}

/**
 * The first thing on the "Plans & Billing" page: where the student stands right
 * now — which plan, whether it is running, when it ends — and what that plan means
 * in practice: how much of today's limits they have used, what the free plan's
 * one-time tries have left, and what is locked behind a higher plan. Everything
 * comes from the server's own answer (GET /me/subscription), so it can't promise
 * something the plan doesn't do; and the page re-reads it whenever the plan
 * changes, so a plan granted or ended by support shows here by itself.
 */
export function PlanStatusCard({ subscription }: { subscription: MySubscriptionResponse }) {
  const { coverage, entitlements: ent, project_lab: lab } = subscription;
  if (!coverage) return null;

  const viaCollege = coverage.source === "institution";
  const ended = isPlanEnded(coverage);
  const planName = coverage.plan?.name ?? "No plan";
  const isFree = !viaCollege && (ended || !coverage.plan || coverage.plan.code === "coder");
  const top = !viaCollege && !ended && isTopPlan(coverage.plan?.code);
  const academy = !viaCollege && !ended && coverage.plan?.code === ACADEMY_PLAN_CODE;
  // Expert is the top of what is bought online, so there is nothing to upgrade to — but Mellow Academy sits one step further, arranged with our team.
  const exploreAcademy = top && !academy;
  const daysLeft = coverage.days_remaining;
  const elapsed = !isFree && !viaCollege ? termElapsedPercent(coverage.started_at, coverage.current_period_end) : null;
  const trial = ent?.feature_trial ?? null;
  const renewSoon = !viaCollege && !isFree && daysLeft !== null && daysLeft <= 30;

  const heading = ended ? `Your ${planName} plan has ended` : viaCollege ? `${planName} — through your college` : planName;
  const Icon = ended ? TimerOff : top ? Crown : viaCollege ? Building2 : isFree ? Gift : Sparkles;

  const status = ended
    ? { label: "Ended", className: "border-status-warning/40 bg-status-warning/10 text-status-warning" }
    : viaCollege
      ? { label: "Covered by college", className: "border-accent-primary/30 bg-accent-primary/10 text-accent-primary" }
      : isFree
        ? { label: "Free plan", className: "border-border-subtle bg-elevated text-text-secondary" }
        : { label: "Active", className: "border-status-success/30 bg-status-success/10 text-status-success" };

  const sub = ended
    ? `It ended on ${formatDay(coverage.current_period_end)}. You're on the free Coder limits until you renew.`
    : viaCollege
      ? "Everything your college's plan includes is open to you. There's nothing to buy."
      : isFree
        ? "A free taste of AptRun. Upgrade for higher daily limits, AI practice, the Hack Arena, the Vault and Project Lab."
        : daysLeft === null
          ? "Never expires."
          : `Runs until ${formatDay(coverage.current_period_end)} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;

  return (
    <section aria-labelledby="your-plan-heading" className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6" data-testid="plan-status-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-control border",
              ended ? "border-status-warning/30 bg-status-warning/10 text-status-warning" : top ? "border-amber-500/30 bg-amber-500/10 text-amber-500" : "border-accent-primary/30 bg-accent-primary/10 text-accent-primary"
            )}
          >
            <Icon className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">
              Your plan{academy && <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-600 dark:text-amber-400">Mellow Academy</span>}
            </p>
            <h2 id="your-plan-heading" className="mt-0.5 text-xl font-extrabold tracking-tight text-primary">
              {heading}
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-text-secondary">{sub}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={cn("rounded-full border px-2.5 py-1 text-3xs font-bold uppercase tracking-wide", status.className)}>{status.label}</span>
          {!viaCollege && !top && (
            <a href="#plans" className="rounded-btn bg-accent-primary px-4 py-2 text-xs font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover">
              {ended ? "Renew your plan" : isFree ? "See plans & upgrade" : "Compare plans"}
            </a>
          )}
          {exploreAcademy && (
            <a href="#plans" className="text-xs font-bold text-accent-primary hover:underline">
              Explore Mellow Academy
            </a>
          )}
          {renewSoon && !ended && !top && (
            <span className="flex items-center gap-1 text-3xs font-semibold text-status-warning">
              <Clock className="h-3 w-3" aria-hidden /> Renewing early adds to the days you have left
            </span>
          )}
        </div>
      </div>

      {elapsed !== null && (
        <div className="mt-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label="Plan term used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={elapsed}>
            <div className="h-full rounded-full bg-accent-primary transition-all" style={{ width: `${elapsed}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-3xs text-text-muted">
            <span>Started {formatDay(coverage.started_at)}</span>
            <span>Ends {formatDay(coverage.current_period_end)}</span>
          </div>
        </div>
      )}

      {ent && (
        <div className="mt-6 grid gap-6 border-t border-border-subtle pt-5 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-2xs font-bold uppercase tracking-wider text-text-muted">{trial ? "Your free tries" : "Today"}</h3>

            <Meter label="Coding problems today" used={ent.practice_problems_used_today} limit={ent.max_practice_problems_per_day} />

            {trial ? (
              <>
                {(Object.keys(trial.used) as (keyof FeatureTrial["used"])[]).map((key) => (
                  <Meter key={key} label={TRIAL_LABEL[key]} used={trial.used[key]} limit={trial.uses_per_feature} note={trial.used[key] >= trial.uses_per_feature ? "Used — part of Expert" : undefined} />
                ))}
              </>
            ) : (
              <Meter label="AI mock interviews today" used={ent.mock_interviews_used_today} limit={ent.max_mock_interviews_per_day} />
            )}
          </div>

          <div>
            <h3 className="mb-3 text-2xs font-bold uppercase tracking-wider text-text-muted">What your plan includes</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              <Access label="Placement drives" on={ent.drive_access} />
              <Access label="Hack Arena" on={ent.hackathon_access} />
              <Access label="The Vault (direct hiring)" on={ent.vault_access} />
              <Access label="Project Lab" on={lab?.enabled ?? false} />
            </ul>
            {lab?.enabled && (
              <p className="mt-2 text-3xs text-text-muted">
                Project Lab: {lab.hours.limit === null ? "unlimited workspace hours" : `${lab.hours.remaining ?? 0} of ${lab.hours.limit} workspace hours left this month`}
                {lab.projects.limit !== null ? ` · ${lab.projects.active} of ${lab.projects.limit} active projects` : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

