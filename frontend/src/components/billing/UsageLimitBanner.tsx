"use client";

import Link from "next/link";
import { Zap, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageLimitBannerProps {
  /** e.g. "practice problems" or "mock interviews" — used in "N of M {label} used today". */
  label: string;
  used: number;
  /** null = unlimited on this plan — the banner renders nothing at all. */
  max: number | null;
}

/**
 * The first "X of Y used today" pattern in this codebase (confirmed
 * greenfield by audit — the only prior usage-adjacent UI was a
 * days-remaining subscription countdown). Renders nothing for an unlimited
 * plan, a neutral progress bar while under the limit, and a clear
 * upgrade-prompt state once exhausted.
 */
export function UsageLimitBanner({ label, used, max }: UsageLimitBannerProps) {
  if (max === null) return null;

  const atLimit = used >= max;
  const percent = Math.min(100, (used / max) * 100);

  return (
    <div
      className={cn(
        "p-3 rounded-control border flex items-center gap-3",
        atLimit ? "bg-status-warning/10 border-status-warning/25" : "bg-elevated/60 border-border-subtle"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
          atLimit ? "bg-status-warning/15 text-status-warning" : "bg-accent-primary/10 text-accent-primary"
        )}
      >
        {atLimit ? <Lock className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-primary">
            {used} of {max} {label} used today
          </span>
          {atLimit && (
            <Link href="/pricing" className="text-[10.5px] font-bold text-accent-primary hover:underline shrink-0">
              Upgrade →
            </Link>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-elevated overflow-hidden mt-1.5">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", atLimit ? "bg-status-warning" : "bg-accent-primary")}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
