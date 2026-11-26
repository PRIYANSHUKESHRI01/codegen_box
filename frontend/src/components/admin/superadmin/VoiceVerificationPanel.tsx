"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Mic,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  Ban,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type ToastTrigger } from "@/lib/toast";

interface VoiceLogItem {
  id: number;
  verdict: string;
  similarity_score: number | null;
  reason: string | null;
  checked_at: string | null;
}

interface AdminVoiceProfileRow {
  id: number;
  user_id: number;
  user: {
    id: number;
    name: string;
    email: string;
    college: string | null;
  } | null;
  status: "not_started" | "in_progress" | "verified" | "blocked";
  proctoring_status: string;
  enrollment_lock_count: number;
  max_enrollment_attempts: number;
  remaining_enrollment_attempts: number;
  total_duration_seconds: number;
  samples_count: number;
  last_match_score: number | null;
  mismatch_strikes: number;
  blocked_at: string | null;
  blocked_reason: string | null;
  completed_at: string | null;
  last_verified_at: string | null;
  voice_summary: string | null;
  recent_logs: VoiceLogItem[];
}

interface SummaryCounts {
  total: number;
  blocked: number;
  retry_locked: number;
  verified: number;
  in_progress: number;
}

type StatusFilter = "all" | "blocked" | "retry_locked" | "verified" | "in_progress";

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VoiceVerificationPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [summary, setSummary] = useState<SummaryCounts>({
    total: 0,
    blocked: 0,
    retry_locked: 0,
    verified: 0,
    in_progress: 0,
  });
  const [profiles, setProfiles] = useState<AdminVoiceProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter !== "all") qs.set("status", statusFilter);
      if (search.trim()) qs.set("search", search.trim());
      const res = await api.get<{ summary: SummaryCounts; profiles: AdminVoiceProfileRow[] }>(
        `/superadmin/voice-verification${qs.toString() ? `?${qs.toString()}` : ""}`
      );
      setSummary(res.summary);
      setProfiles(res.profiles);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load voice verification profiles.", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, triggerToast]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(t);
  }, [load]);

  const handleUnblock = async (row: AdminVoiceProfileRow) => {
    if (!row.user_id || busyUserId !== null) return;
    setBusyUserId(row.user_id);
    try {
      await api.post(`/superadmin/voice-verification/${row.user_id}/unblock`, {});
      triggerToast(`Reinstated voice verification access for ${row.user?.name ?? "student"}.`);
      await load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to unblock student.", "error");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleReset = async (row: AdminVoiceProfileRow) => {
    if (!row.user_id || busyUserId !== null) return;
    setBusyUserId(row.user_id);
    try {
      await api.post(`/superadmin/voice-verification/${row.user_id}/reset`, {});
      triggerToast(`Reset 5-minute voice baseline for ${row.user?.name ?? "student"}.`);
      await load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to reset voice baseline.", "error");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleBlock = async (row: AdminVoiceProfileRow) => {
    if (!row.user_id || busyUserId !== null) return;
    setBusyUserId(row.user_id);
    try {
      await api.post(`/superadmin/voice-verification/${row.user_id}/block`, {
        reason: "Voice verification access blocked by SuperAdmin.",
      });
      triggerToast(`Blocked voice verification access for ${row.user?.name ?? "student"}.`);
      await load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to block student.", "error");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-primary">
            <Mic className="h-4 w-4 text-accent-primary" aria-hidden />
            Voice Identity Verification Management
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Manage 5-minute baseline voice profiles, review voice mismatch or 3-strike blocks, reinstate access, or reset a student&apos;s baseline.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-3.5 py-2 text-xs font-bold text-primary hover:border-border-strong disabled:opacity-60"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
          Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
          <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">Total Profiles</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-primary">{summary.total}</p>
        </div>
        <div className="rounded-panel border border-status-danger/30 bg-status-danger/[0.06] p-4 shadow-subtle">
          <p className="text-3xs font-bold uppercase tracking-wider text-status-danger">Blocked</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-status-danger">{summary.blocked}</p>
        </div>
        <div className="rounded-panel border border-amber-500/30 bg-amber-500/[0.06] p-4 shadow-subtle">
          <p className="text-3xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">Retry Locked</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-600 dark:text-amber-300">{summary.retry_locked}</p>
        </div>
        <div className="rounded-panel border border-emerald-500/30 bg-emerald-500/[0.06] p-4 shadow-subtle">
          <p className="text-3xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">Verified</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">{summary.verified}</p>
        </div>
        <div className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
          <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">In Progress</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-primary">{summary.in_progress}</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-border-subtle bg-elevated p-1">
          {(
            [
              { id: "all", label: "All" },
              { id: "blocked", label: `Blocked (${summary.blocked})` },
              { id: "retry_locked", label: `Retry Locked (${summary.retry_locked})` },
              { id: "verified", label: `Verified (${summary.verified})` },
              { id: "in_progress", label: `In Progress (${summary.in_progress})` },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "rounded-control px-3 py-1.5 text-2xs font-bold transition-all",
                statusFilter === f.id ? "bg-accent-primary text-white shadow-sm" : "text-text-secondary hover:text-primary"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name or email..."
            className="w-full rounded-control border border-border-subtle bg-surface py-2 pl-9 pr-3 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Table / List */}
      <div className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading voice verification records...
          </div>
        ) : profiles.length === 0 ? (
          <div className="p-10 text-center text-xs text-text-muted">
            No voice verification profiles match your current filter.
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {profiles.map((row) => {
              const isBusy = busyUserId === row.user_id;
              const isBlocked = row.status === "blocked";
              const isRetryLocked = !isBlocked && row.proctoring_status === "locked";

              return (
                <div key={row.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-primary">{row.user?.name ?? `User #${row.user_id}`}</span>
                      <span className="text-xs text-text-muted">{row.user?.email}</span>
                      {row.user?.college && (
                        <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-semibold text-text-secondary">
                          {row.user.college}
                        </span>
                      )}
                      {isBlocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-status-danger/15 px-2.5 py-0.5 text-3xs font-extrabold uppercase text-status-danger">
                          <ShieldAlert className="h-3 w-3" /> Blocked
                        </span>
                      ) : isRetryLocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-3xs font-extrabold uppercase text-amber-700 dark:text-amber-300">
                          Retry Locked ({row.remaining_enrollment_attempts}/{row.max_enrollment_attempts} left)
                        </span>
                      ) : row.status === "verified" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-3xs font-extrabold uppercase text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Verified
                        </span>
                      ) : (
                        <span className="rounded-full bg-elevated px-2.5 py-0.5 text-3xs font-bold uppercase text-text-secondary">
                          {row.status.replace("_", " ")}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-text-secondary">
                      <span>Samples: <strong className="text-primary">{row.samples_count}/5</strong> ({formatClock(row.total_duration_seconds)})</span>
                      <span>Enrollment locks: <strong className="text-primary">{row.enrollment_lock_count}/{row.max_enrollment_attempts}</strong></span>
                      {row.last_match_score !== null && (
                        <span>Last voice match: <strong className="text-primary">{Math.round(row.last_match_score)}%</strong></span>
                      )}
                      <span>Mismatch strikes: <strong className="text-primary">{row.mismatch_strikes}</strong></span>
                    </div>

                    {row.blocked_reason && (
                      <p className="rounded-lg border border-status-danger/25 bg-status-danger/[0.05] px-3 py-1.5 text-2xs text-status-danger">
                        {row.blocked_reason}
                      </p>
                    )}
                    {row.voice_summary && !row.blocked_reason && (
                      <p className="text-2xs text-text-muted">{row.voice_summary}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {(isBlocked || isRetryLocked) && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleUnblock(row)}
                        className="inline-flex items-center gap-1.5 rounded-control bg-emerald-600 px-3 py-1.5 text-2xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
                      >
                        <Unlock className="h-3.5 w-3.5" aria-hidden />
                        Unblock &amp; Reinstate
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleReset(row)}
                      className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-3 py-1.5 text-2xs font-bold text-primary hover:border-accent-primary/40 disabled:opacity-60"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      Reset Baseline
                    </button>
                    {!isBlocked && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleBlock(row)}
                        className="inline-flex items-center gap-1.5 rounded-control border border-status-danger/35 bg-status-danger/10 px-3 py-1.5 text-2xs font-bold text-status-danger hover:bg-status-danger/20 disabled:opacity-60"
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden />
                        Block
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
