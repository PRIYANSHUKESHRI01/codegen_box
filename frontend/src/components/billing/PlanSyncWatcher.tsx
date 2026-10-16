"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpCircle, Info, TimerOff, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { startPlanSync, subscribeToPlanNotices, type PlanChangeNotice } from "@/lib/planSync";

const NOTICE_MS = 14_000;

function wording(notice: PlanChangeNotice, audience: "student" | "college") {
  const owner = audience === "college" ? "Your college's plan" : "Your plan";

  switch (notice.kind) {
    case "upgraded":
      return {
        title: `${owner} is now ${notice.planName}`,
        body: audience === "college" ? "Everything it includes is open to your students." : "AptRun updated it — everything it includes is unlocked.",
      };
    case "extended":
      return {
        title: `${owner} was extended`,
        body: notice.daysRemaining !== null ? `${notice.planName} now has ${notice.daysRemaining} day${notice.daysRemaining === 1 ? "" : "s"} left.` : `${notice.planName} was extended.`,
      };
    case "ended":
      return {
        title: `${notice.previousName ?? "Your"} plan has ended`,
        body: notice.planName ? `You're on the ${notice.planName} plan now.` : "You no longer have an active plan.",
      };
    default:
      return {
        title: notice.planName ? `${owner} changed to ${notice.planName}` : `${owner} changed`,
        body: notice.previousName ? `It was ${notice.previousName}.` : "What's included may have changed.",
      };
  }
}

/**
 * Mounted once in the dashboard shell: keeps the page in step with the account's
 * plan (lib/planSync) and, when it changes under the student — support granted or
 * cancelled it, it ran out — says so, rather than leaving locks and limits to
 * change silently. Renders nothing at all until there is something to say.
 */
export function PlanSyncWatcher({ audience }: { audience: "student" | "college" }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notice, setNotice] = useState<PlanChangeNotice | null>(null);

  useEffect(() => {
    if (userId === null) return;

    const stop = startPlanSync(userId);
    const off = subscribeToPlanNotices(setNotice);

    return () => {
      off();
      stop();
    };
  }, [userId]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const text = notice ? wording(notice, audience) : null;
  const Icon = notice?.kind === "upgraded" || notice?.kind === "extended" ? ArrowUpCircle : notice?.kind === "ended" ? TimerOff : Info;

  return (
    <AnimatePresence>
      {notice && text && (
        <motion.div
          key={`${notice.kind}-${notice.planCode}`}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-5 right-5 z-[90] flex w-[min(24rem,calc(100vw-2.5rem))] items-start gap-3 rounded-panel border border-accent-primary/40 bg-surface p-4 shadow-card"
        >
          <span
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              notice.kind === "ended" ? "bg-status-warning/15 text-status-warning" : "bg-accent-primary/15 text-accent-primary"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-snug text-primary">{text.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{text.body}</p>
            {audience === "student" && (
              <Link href="/dashboard/billing" onClick={() => setNotice(null)} className="mt-2 inline-block text-xs font-bold text-accent-primary hover:underline">
                See what&apos;s included
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded-control p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
