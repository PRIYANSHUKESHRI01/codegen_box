"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { formatInr } from "@/lib/pricing";
import { countdownTo, landingFacts, useLandingData, useNow } from "@/lib/useLandingData";
import type { LandingData } from "@/types/landing";

/** "starts in 3h 12m", "starts in 12m", or "starts tomorrow 8 PM" — how soon the next challenge opens, in the words a student would use. */
function startsIn(data: LandingData, now: number | null): string {
  const contest = data.contest;
  if (!contest) return `every night at ${landingFacts(data).dailyTime}`;
  if (contest.is_live) return "is live now";
  if (now === null) return `on ${landingFacts(data).dailyTime}`;

  const c = countdownTo(contest.start_at, now);
  if (c.days > 0 || c.hours >= 24) return `starts ${landingFacts(data).dailyTime}`;
  if (c.hours > 0) return `starts in ${c.hours}h ${c.minutes}m`;
  return `starts in ${Math.max(1, c.minutes)}m`;
}

/**
 * A slim strip above the header, and the only thing on the page that is "news": tonight's challenge and, while there is one, the
 * voucher on offer this week. Both come from the backend. While the answer is on its way the strip holds its height (so the page does
 * not jump when it arrives); if the answer never comes the strip is simply not drawn, rather than saying something stale.
 */
export function AnnouncementBar() {
  const { data, status } = useLandingData();
  const now = useNow(30_000);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || status === "error") return null;

  const top = data?.rewards?.live ? data.rewards.prizes[0] : null;
  const live = !!data?.contest?.is_live;

  return (
    <div className="relative z-50 border-b border-accent-primary/15 bg-accent-primary/[0.07] px-4 py-2 text-center text-13">
      <div className="mx-auto flex min-h-[1.5rem] max-w-7xl items-center justify-center gap-2 pr-8 text-text-primary sm:gap-3 sm:pr-0">
        {data ? (
          <>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-3xs font-bold uppercase tracking-wider text-status-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              {live ? "Live" : "Tonight"}
            </span>
            <span className="truncate font-medium">
              <span className="sm:hidden">
                Daily Challenge {startsIn(data, now)}
              </span>
              <span className="hidden sm:inline">
                {data.policy.daily.name} {startsIn(data, now)}
                {top && (
                  <>
                    {" "}
                    &middot; the top of this week&apos;s board wins a {top.brand} {formatInr(top.amount)} voucher
                  </>
                )}
              </span>
            </span>
            <Link
              href="/signup"
              className="group inline-flex shrink-0 items-center gap-1 font-semibold text-accent-primary underline-offset-4 transition-colors duration-200 hover:text-accent-primary-hover hover:underline"
            >
              <span className="whitespace-nowrap">
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Play free</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </>
        ) : (
          <span className="h-4 w-64 max-w-full animate-pulse rounded bg-accent-primary/15" aria-hidden="true" />
        )}
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-control p-1 text-text-muted transition-all duration-200 hover:bg-black/5 hover:text-primary active:scale-90 dark:hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
