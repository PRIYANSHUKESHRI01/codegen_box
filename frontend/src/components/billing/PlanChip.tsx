"use client";

import Link from "next/link";
import { AlertCircle, Building2, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyPlan } from "@/lib/useMyPlan";
import { isTopPlan } from "@/lib/pricing";
import type { SubscriptionCoverage } from "@/types/subscription";

/** A paid plan whose days have run out: the server already treats the student as free, so say so. */
export function isPlanEnded(coverage: SubscriptionCoverage | null): boolean {
  return (
    coverage?.source === "individual" &&
    !!coverage.plan &&
    coverage.plan.code !== "coder" &&
    coverage.days_remaining !== null &&
    coverage.days_remaining <= 0
  );
}

/**
 * The student's plan, always on screen: in the header of every dashboard page,
 * one click from the plans and prices. Before this the only way to the pricing
 * page was a small "Upgrade" link at the foot of the sidebar — easy to never
 * see. It follows the plan live (useMyPlan), so a plan granted, extended or
 * cancelled by support shows here without a reload.
 *
 *   Coder        "Coder · Upgrade"        (the nudge)
 *   Expert       "Expert"                 (the top of what is sold online — nothing left to sell)
 *   Grandmaster  "Grandmaster"            (Mellow Academy, arranged with the team)
 *   ended        "Plan ended · Renew"     (the warning)
 *   via college  "Campus plan"            (read-only: the college pays)
 */
export function PlanChip({ className }: { className?: string }) {
  const { plan: mine, loading } = useMyPlan(true);
  const coverage = mine?.coverage ?? null;

  // Held back until there is an answer, rather than flashing a wrong "Coder" at an Expert.
  if (loading || !coverage) return null;

  const name = coverage.plan?.name ?? "No plan";
  const viaCollege = coverage.source === "institution";
  const ended = isPlanEnded(coverage);
  const top = isTopPlan(coverage.plan?.code) && !ended;

  const tone = ended
    ? "border-status-warning/40 bg-status-warning/10 text-status-warning hover:bg-status-warning/15"
    : top
      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400"
      : viaCollege
        ? "border-border-subtle bg-surface text-text-secondary hover:border-accent-primary/40 hover:text-primary"
        : "border-accent-primary/30 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/15";

  const Icon = ended ? AlertCircle : top ? Crown : viaCollege ? Building2 : Sparkles;
  const label = ended ? `${name} plan ended` : viaCollege ? "Campus plan" : name;
  const cta = ended ? "Renew" : top || viaCollege ? null : "Upgrade";

  return (
    <Link
      href="/dashboard/billing"
      data-testid="plan-chip"
      title={viaCollege ? `Included through ${coverage.plan?.name ?? "your college"}` : ended ? "Your plan has ended — renew to get it back" : "See your plan and pricing"}
      aria-label={`Your plan: ${label}${cta ? `. ${cta}` : ""}. Open plans and billing.`}
      className={cn(
        "flex h-9 flex-shrink-0 items-center gap-1.5 rounded-[10px] border px-2.5 text-13 font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
        tone,
        className
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden />
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
      {cta && <span className="hidden whitespace-nowrap rounded-full bg-accent-primary px-2 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-white md:inline">{cta}</span>}
    </Link>
  );
}
