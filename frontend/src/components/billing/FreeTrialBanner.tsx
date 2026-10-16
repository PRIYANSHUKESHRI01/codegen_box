"use client";

import Link from "next/link";
import { Gift, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntitlements } from "@/lib/useEntitlements";
import type { FeatureTrial } from "@/types/subscription";

export type TrialFeature = keyof FeatureTrial["used"];

const LABEL: Record<TrialFeature, string> = {
  mock_interview: "AI mock interview",
  speaking: "Speaking Lab recording",
  listening: "AI listening lesson",
  vocabulary: "AI vocabulary quiz",
};

/**
 * The free plan's "one try of everything" made visible where it matters: on the
 * page of the feature, before the student presses the button that spends it.
 * Renders nothing for any plan without a trial cap, and nothing until the plan
 * is known (no flash). The server is what actually refuses a second try
 * (HTTP 402 `trial_used`); this is the explanation that comes before that
 * refusal instead of after it.
 */
export function FreeTrialBanner({ feature, className }: { feature: TrialFeature; className?: string }) {
  const trial = useEntitlements()?.feature_trial;

  if (!trial) return null;

  const used = trial.used[feature];
  const total = trial.uses_per_feature;
  const spent = used >= total;
  const tries = total === 1 ? "free try" : `${total} free tries`;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 rounded-control border p-3",
        spent ? "border-status-warning/25 bg-status-warning/10" : "border-accent-primary/20 bg-accent-primary/5",
        className
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          spent ? "bg-status-warning/15 text-status-warning" : "bg-accent-primary/10 text-accent-primary"
        )}
      >
        {spent ? <Lock className="h-4 w-4" aria-hidden /> : <Gift className="h-4 w-4" aria-hidden />}
      </span>

      <p className="min-w-0 flex-1 text-2xs font-semibold text-primary">
        {spent ? (
          <>
            You&apos;ve used your {tries} of the {LABEL[feature]} on the Coder plan.
          </>
        ) : (
          <>
            Your {tries} of the {LABEL[feature]} — {used} of {total} used. After that it is part of Expert.
          </>
        )}
      </p>

      <Link href="/dashboard/billing" className="shrink-0 text-3xs font-bold text-accent-primary hover:underline">
        {spent ? "Upgrade to keep practising →" : "See plans →"}
      </Link>
    </div>
  );
}
