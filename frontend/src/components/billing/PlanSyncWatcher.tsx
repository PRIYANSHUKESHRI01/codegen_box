"use client";

import { useEffect } from "react";
import { ArrowUpCircle, Info, TimerOff } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { startPlanSync, subscribeToPlanNotices, type PlanChangeNotice } from "@/lib/planSync";
import { toast, type ToastTone } from "@/lib/toast";

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
 * change silently. It draws nothing itself: the notice goes through the shared
 * toast layer (lib/toast), like every other message popup in the app.
 */
export function PlanSyncWatcher({ audience }: { audience: "student" | "college" }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (userId === null) return;

    const stop = startPlanSync(userId);
    const off = subscribeToPlanNotices((notice) => {
      const text = wording(notice, audience);
      const tone: ToastTone = notice.kind === "ended" ? "warning" : notice.kind === "upgraded" || notice.kind === "extended" ? "success" : "info";

      // One fixed id: a second change while the first is still up replaces it rather than stacking two plan notices.
      toast(text.body, {
        id: "plan-sync",
        tone,
        title: text.title,
        duration: NOTICE_MS,
        icon: notice.kind === "upgraded" || notice.kind === "extended" ? ArrowUpCircle : notice.kind === "ended" ? TimerOff : Info,
        action: audience === "student" ? { label: "See what's included", href: "/dashboard/billing" } : undefined,
      });
    });

    return () => {
      off();
      stop();
    };
  }, [userId, audience]);

  return null;
}
