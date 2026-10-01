"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Mail, Phone, GraduationCap, Trophy, AlertTriangle, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "./types";

interface UserDetailResponse {
  user: {
    id: number;
    name: string;
    email: string;
    handle: string | null;
    phone: string | null;
    college: { id: number; name: string } | null;
    roll_number: string | null;
    branch: string | null;
    cgpa: string | null;
    backlogs: number | null;
    is_blocked: boolean;
    blocked_reason: string | null;
    created_at: string;
    readiness_score: number;
    readiness_tier: "Placement Ready" | "In Progress" | "Needs Training";
    subscription: { plan_name: string; source: string; days_remaining: number | null } | null;
  };
  stats: {
    solved_by_difficulty: { total_solved: number };
    solved_score: number;
    streak: { current: number; max: number };
  };
}

const TIER_STYLE: Record<string, string> = {
  "Placement Ready": "bg-status-success/10 border-status-success/25",
  "In Progress": "bg-accent-secondary/10 border-accent-secondary/25",
  "Needs Training": "bg-status-warning/10 border-status-warning/25",
};

interface StudentDetailDrawerProps {
  userId: number;
  onClose: () => void;
  onChanged: () => void;
  triggerToast: (msg: string) => void;
}

/**
 * Mirrors components/dashboard/tpo/StudentProfileDrawer.tsx's visual
 * skeleton (identity/contact/readiness/academic/account-status blocks),
 * adding what a cross-college superadmin drill-in needs that a TPO's own
 * cohort payload doesn't carry: subscription coverage, a real stats grid,
 * and a Block/Unblock action.
 */
export function StudentDetailDrawer({ userId, onClose, onChanged, triggerToast }: StudentDetailDrawerProps) {
  const [detail, setDetail] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<UserDetailResponse>(`/superadmin/users/${userId}/detail`)
      .then(setDetail)
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load student detail."))
      .finally(() => setLoading(false));
  }, [userId, triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleBlock = async () => {
    if (!detail) return;
    setToggling(true);
    try {
      await api.post(`/superadmin/users/${userId}/toggle-block`);
      triggerToast(detail.user.is_blocked ? `${detail.user.name}'s account unblocked.` : `${detail.user.name}'s account blocked.`);
      await load();
      onChanged();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update account.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        className="relative w-full max-w-md h-full bg-surface border-l border-border-strong shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 bg-surface border-b border-border-subtle p-4 flex items-center justify-between z-10">
          <h3 className="text-sm font-bold text-primary">Student Profile</h3>
          <button onClick={onClose} className="p-1.5 rounded-control text-text-muted hover:text-primary hover:bg-surface-hover transition-colors" aria-label="Close profile">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !detail ? (
          <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading student...
          </div>
        ) : (
          <div className="p-5 space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-primary/25 to-accent-secondary/15 border border-accent-primary/30 flex items-center justify-center text-lg font-black text-accent-primary shrink-0">
                {detail.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-primary">{detail.user.name}</h2>
                <p className="text-xs text-text-muted font-mono">
                  {detail.user.roll_number ?? "No roll number on file"} · {detail.user.branch ?? "Branch not on file"}
                </p>
                <p className="text-2xs text-text-muted mt-1">{detail.user.college?.name ?? "No college — Mellow Direct lead"}</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-3xs font-bold rounded-full",
                      detail.user.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success"
                    )}
                  >
                    {detail.user.is_blocked ? "Account Blocked" : "Account Active"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2 p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs">
              <div className="flex items-center gap-2 text-text-secondary">
                <Mail className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="truncate">{detail.user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary">
                <Phone className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span>{detail.user.phone ?? "Not on file"}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                <div className="text-base font-black text-primary font-mono">{detail.stats.solved_score}</div>
                <div className="text-3xs text-text-muted uppercase mt-1">Solved Score</div>
              </div>
              <div className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                <div className="text-base font-black text-primary font-mono">{detail.stats.solved_by_difficulty.total_solved}</div>
                <div className="text-3xs text-text-muted uppercase mt-1">Problems Solved</div>
              </div>
              <div className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                <div className="text-base font-black text-primary font-mono">{detail.stats.streak.current}</div>
                <div className="text-3xs text-text-muted uppercase mt-1">Day Streak</div>
              </div>
            </div>

            <div>
              <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Placement Readiness</h4>
              <div className={cn("p-3 rounded-control border text-xs", TIER_STYLE[detail.user.readiness_tier])}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-primary">{detail.user.readiness_tier}</span>
                  <span className="font-mono font-bold text-primary">{detail.user.readiness_score}/100</span>
                </div>
                <p className="text-text-secondary mt-1">
                  Computed from CGPA, active backlogs, academic profile completeness, and daily practice consistency.
                </p>
              </div>
            </div>

            <div>
              <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Academic Profile</h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="flex items-center gap-1.5 text-text-muted text-3xs mb-1">
                    <GraduationCap className="w-3 h-3" />
                    <span>CGPA</span>
                  </div>
                  <div className="text-base font-black text-primary font-mono">{detail.user.cgpa ?? "—"}</div>
                </div>
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="flex items-center gap-1.5 text-text-muted text-3xs mb-1">
                    <Trophy className="w-3 h-3" />
                    <span>Readiness</span>
                  </div>
                  <div className="text-base font-black text-primary font-mono">{detail.user.readiness_score}%</div>
                </div>
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle col-span-2">
                  <div className="flex items-center gap-1.5 text-text-muted text-3xs mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Active Backlogs</span>
                  </div>
                  <div className={cn("text-base font-black font-mono", (detail.user.backlogs ?? 0) > 0 ? "text-status-danger" : "text-status-success")}>
                    {detail.user.backlogs ?? "Not on file"}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs">
              <div className="flex justify-between text-text-secondary">
                <span>Plan</span>
                <strong className="text-primary">{detail.user.subscription?.plan_name ?? "—"}</strong>
              </div>
              <div className="flex justify-between text-text-secondary mt-1">
                <span>Coverage</span>
                <strong className="text-primary capitalize">{detail.user.subscription?.source ?? "—"}</strong>
              </div>
              <div className="flex justify-between text-text-secondary mt-1">
                <span>Joined</span>
                <strong className="text-primary">{formatDate(detail.user.created_at)}</strong>
              </div>
            </div>

            <div>
              <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-2">Account Status</h4>
              <div className="flex items-center gap-2 p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs mb-2">
                {detail.user.is_blocked ? (
                  <ShieldAlert className="w-4 h-4 text-status-danger shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-status-success shrink-0" />
                )}
                <span className={cn("font-bold", detail.user.is_blocked ? "text-status-danger" : "text-status-success")}>
                  {detail.user.is_blocked ? "Blocked" : "Active"}
                </span>
                {detail.user.blocked_reason && <span className="text-text-muted">— {detail.user.blocked_reason}</span>}
              </div>
              <button
                onClick={handleToggleBlock}
                disabled={toggling}
                className={cn(
                  "w-full px-3 py-2 rounded-control text-xs font-bold transition-colors border disabled:opacity-50",
                  detail.user.is_blocked
                    ? "bg-status-success/10 text-status-success border-status-success/30 hover:bg-status-success/20"
                    : "bg-status-danger/10 text-status-danger border-status-danger/30 hover:bg-status-danger/20"
                )}
              >
                {toggling ? "Updating..." : detail.user.is_blocked ? "Unblock Account" : "Block Account"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
