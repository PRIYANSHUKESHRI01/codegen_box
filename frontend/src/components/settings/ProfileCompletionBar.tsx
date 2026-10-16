"use client";

import { motion } from "framer-motion";
import type { AuthUser } from "@/lib/auth";

/**
 * Honest, weighted copy tiers matching User::computeProfileCompletion()'s
 * real thresholds. A hiring partner's Vault search ranks by readiness first and
 * uses profile completeness to break ties (CompanyVaultController::index()), so a
 * fuller profile is what puts you ahead of someone with the same readiness.
 */
function tierCopy(percent: number): string {
  if (percent >= 100) return "Your profile is complete — among students with the same readiness, you show up first when recruiters search.";
  if (percent >= 70) return "Almost recruiter-ready — finish the last few details to move to the front among equally ready students.";
  if (percent >= 40) return "You're halfway there. Complete profiles get opened first.";
  return "Recruiters skim dozens of profiles a day — an empty one gets skipped. Add a few details so yours gets opened.";
}

/** Deliberately just a bar + one line, not a checklist — the fields below it already show what's filled in vs. empty, so listing them twice was more clutter than help. */
export function ProfileCompletionBar({ user }: { user: AuthUser }) {
  const percent = Math.max(0, Math.min(100, user.profile_completion_percent));

  return (
    <div className="p-4 rounded-panel bg-gradient-to-br from-accent-primary/[0.07] to-accent-secondary/[0.04] border border-accent-primary/20 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-primary">Profile Strength</span>
        <span className="text-sm font-black text-accent-primary tabular-nums">{percent}%</span>
      </div>

      <div className="h-2.5 rounded-full bg-elevated overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      <p className="text-2xs text-text-secondary leading-relaxed">{tierCopy(percent)}</p>
    </div>
  );
}
