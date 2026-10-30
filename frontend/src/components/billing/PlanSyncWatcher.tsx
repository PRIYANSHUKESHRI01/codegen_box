"use client";

import { useEffect } from "react";
import { Anchor, ArrowUpCircle, EyeOff, Info, TimerOff } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { ACADEMIC_CHANGED_EVENT, MODULES_CHANGED_EVENT, PROFILE_CHANGED_EVENT, startPlanSync, subscribeToPlanNotices, type ModulesChangedDetail, type PlanChangeNotice } from "@/lib/planSync";
import { toast, type ToastTone } from "@/lib/toast";

const NOTICE_MS = 14_000;

/** How the superadmin's whole-section switches are named to a student. */
const MODULE_NAMES: Record<string, string> = { merchant_navy: "Merchant Navy" };

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
  const { user, refresh } = useAuth();
  const userId = user?.id ?? null;

  // A student's college changed their year or section: reload the signed-in user (so their own year/section are right everywhere)
  // and say so once. What the year unlocks (the Vault AI Interview) refreshes itself on the same event.
  useEffect(() => {
    if (audience !== "student" || userId === null) return;

    const onAcademicChange = () => {
      void refresh();
      toast("Your year or section was updated, and what unlocks for you has been refreshed.", {
        id: "academic-sync",
        tone: "info",
        title: "Your college updated your details",
        duration: NOTICE_MS,
        icon: Info,
      });
    };

    window.addEventListener(ACADEMIC_CHANGED_EVENT, onAcademicChange);
    return () => window.removeEventListener(ACADEMIC_CHANGED_EVENT, onAcademicChange);
  }, [audience, userId, refresh]);

  // The superadmin switched a whole section (Merchant Navy) on or off: reload the signed-in user so the sidebar follows at once (the open
  // Mock AI Interview catalogue listens to the same event), and say so once. Staff and hiring partners never see these sections.
  useEffect(() => {
    if (audience !== "student" || userId === null) return;

    const onModulesChange = (event: Event) => {
      void refresh();
      const { modules, previous } = (event as CustomEvent<ModulesChangedDetail>).detail;

      for (const key of Object.keys(MODULE_NAMES)) {
        if (modules[key] === previous[key] || modules[key] === undefined) continue;
        const name = MODULE_NAMES[key];
        const on = modules[key];

        toast(on ? `${name} practice is open — find it in the sidebar and in Mock AI Interview.` : `${name} practice has been switched off for now. Anything you were in can be finished; it will be back when it is switched on again.`, {
          id: `module-${key}`,
          tone: on ? "success" : "info",
          title: on ? `${name} is now available` : `${name} is unavailable`,
          duration: NOTICE_MS,
          icon: on ? Anchor : EyeOff,
          action: on ? { label: "Open it", href: "/dashboard/merchant-navy" } : undefined,
        });
      }
    };

    window.addEventListener(MODULES_CHANGED_EVENT, onModulesChange);
    return () => window.removeEventListener(MODULES_CHANGED_EVENT, onModulesChange);
  }, [audience, userId, refresh]);

  // Mellow corrected the college's name / code (or the TPO's own details): reload the signed-in user so the sidebar, the hero and every
  // college label change in place, and say so once.
  useEffect(() => {
    if (userId === null) return;

    const onProfileChange = () => {
      void refresh();
      toast(audience === "college" ? "Your college's name or details were corrected by the AptRun team. Everything on screen is up to date." : "Your college's details were corrected by the AptRun team.", {
        id: "profile-sync",
        tone: "info",
        title: "Details updated",
        duration: NOTICE_MS,
        icon: Info,
      });
    };

    window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChange);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChange);
  }, [audience, userId, refresh]);

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
