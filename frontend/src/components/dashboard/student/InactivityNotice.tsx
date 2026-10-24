"use client";

import Link from "next/link";
import { CheckCircle2, Flame, TimerReset } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessDecay } from "@/types/studentStats";

interface InactivityNoticeProps {
  decay?: ReadinessDecay | null;
  /** The score with the loss already taken off, and what it would be without. */
  score: number;
  baseScore?: number;
  className?: string;
}

const pts = (n: number) => `${n} ${n === 1 ? "point" : "points"}`;

/**
 * Staying ready is a daily habit, and this says so plainly: what missed days have cost, whether today is already
 * covered, and what one more day away would cost. Renders nothing until the student is being tracked (nothing is
 * charged before that) or when the penalty is switched off.
 */
export function InactivityNotice({ decay, score, baseScore, className }: InactivityNoticeProps) {
  if (!decay || !decay.enabled || !decay.tracking) return null;

  const losing = decay.points > 0;
  const capped = decay.max_points > 0 && decay.points >= decay.max_points;

  return (
    <div
      className={cn(
        "rounded-control border px-3.5 py-3",
        losing ? "border-status-warning/40 bg-status-warning/10" : "border-status-success/30 bg-status-success/10",
        className
      )}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        {losing ? (
          <TimerReset className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden />
        ) : (
          <Flame className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-bold text-primary">
            {losing
              ? `Missed days have cost you ${pts(decay.points)}${baseScore !== undefined ? ` (${baseScore} earned → ${score})` : ""}`
              : "No points lost to missed days"}
          </p>
          <p className="text-3xs leading-relaxed text-text-secondary">
            {losing
              ? `You skipped ${decay.missed_days} of the last ${decay.window_days} days. Each skipped day takes ${pts(decay.per_day)} off, and it drops out of the count ${decay.window_days} days later${capped ? " — you're at the most it can take" : ""}.`
              : `Do something on AptRun every day — a problem, a lab, an interview. Each day you skip takes ${pts(decay.per_day)} off your score.`}
          </p>
          <p className={cn("flex items-center gap-1.5 text-3xs font-bold", decay.practised_today ? "text-status-success" : "text-status-warning")}>
            {decay.practised_today ? (
              <>
                <CheckCircle2 className="h-3 w-3" aria-hidden /> You&apos;re active today — nothing more is lost today.
              </>
            ) : (
              <>
                Not active yet today — <Link href="/dashboard/practice" className="underline underline-offset-2 hover:text-primary">practise now</Link> to protect your score.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
