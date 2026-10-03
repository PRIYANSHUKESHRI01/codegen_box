"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, Hash, Loader2, Lock, ShieldCheck, Swords, Users, type LucideIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProctoringSessionSummary, ProctoringViolationDetail } from "@/types/proctoring";
import { HP_TONES, HpAvatar, HpButton, HpCard, HpEmptyState, HpPill, HpSkeleton, type HpTone } from "@/components/portal/kit";
import { ScCollapse, ScMeta, ScReveal, ScRiskMeter, formatRelative } from "@/components/portal/screeningKit";

const STATUS_STYLE: Record<ProctoringSessionSummary["status"], string> = {
  active: "bg-status-warning/15 text-status-warning",
  locked: "bg-status-danger/15 text-status-danger",
  completed: "bg-elevated text-text-muted",
};

/* Premium (hiring-portal) presentation — only used when variant="premium". */
const PREMIUM_STATUS: Record<ProctoringSessionSummary["status"], { label: string; tone: HpTone; icon?: LucideIcon; dot?: boolean; pulse?: boolean }> = {
  locked: { label: "Locked", tone: "rose", icon: Ban },
  active: { label: "In progress", tone: "amber", dot: true, pulse: true },
  completed: { label: "Completed", tone: "slate", icon: CheckCircle2 },
};

/** Qualitative severity for the meter — locked is always the top tier; otherwise it scales with strikes on record. */
function riskOf(session: ProctoringSessionSummary): { level: 1 | 2 | 3; tone: HpTone; label: string } {
  if (session.status === "locked") return { level: 3, tone: "rose", label: "High risk" };
  if (session.violation_count >= 2) return { level: 2, tone: "amber", label: "Elevated" };
  return { level: 1, tone: "sky", label: "Low risk" };
}

/**
 * Shared between the TPO's (`/tpo/proctoring`) and Section Coordinator's
 * (`/coordinator/proctoring`) review pages — same shape either way, just a
 * different `apiBasePath` (the backend independently scopes each to the
 * caller's college or section, so no client-side filtering is needed here).
 * Only ever lists FLAGGED sessions (violation_count > 0) — a clean run
 * never shows up, by design (see ProctoringService::flaggedSessionsForCollege).
 */
export function ProctoringSessionList({
  sessions,
  apiBasePath,
  onToast,
  onReinstated,
  variant = "default",
}: {
  sessions: ProctoringSessionSummary[];
  apiBasePath: string;
  onToast: (msg: string) => void;
  onReinstated: () => void;
  /** "premium" is the hiring-portal look (avatar rows, severity meter, animated timeline). Default leaves the TPO/coordinator markup exactly as before. */
  variant?: "default" | "premium";
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [violations, setViolations] = useState<Record<number, ProctoringViolationDetail[]>>({});
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [reinstatingId, setReinstatingId] = useState<number | null>(null);

  const toggleExpand = async (session: ProctoringSessionSummary) => {
    if (expandedId === session.id) {
      setExpandedId(null);
      return;
    }

    setExpandedId(session.id);
    if (violations[session.id]) return;

    setLoadingId(session.id);
    try {
      const res = await api.get<{ violations: ProctoringViolationDetail[] }>(`${apiBasePath}/${session.id}`);
      setViolations((prev) => ({ ...prev, [session.id]: res.violations }));
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load the violation timeline.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleReinstate = async (session: ProctoringSessionSummary) => {
    setReinstatingId(session.id);
    try {
      await api.post(`${apiBasePath}/${session.id}/reinstate`);
      onToast(`${session.student.name}'s contest access has been reinstated.`);
      onReinstated();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to reinstate this session.");
    } finally {
      setReinstatingId(null);
    }
  };

  if (variant === "premium") {
    if (sessions.length === 0) {
      return (
        <HpEmptyState
          icon={ShieldCheck}
          tone="emerald"
          title="All clear"
          description="No proctoring violations on record — every contest attempt has been clean."
        />
      );
    }

    return (
      <div className="relative space-y-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {sessions.map((session, index) => {
            const expanded = expandedId === session.id;
            const meta = PREMIUM_STATUS[session.status];
            const risk = riskOf(session);
            const panelId = `proctoring-timeline-${session.id}`;
            const timeline = violations[session.id] ?? [];
            return (
              <ScReveal key={session.id} index={index}>
                <HpCard
                  spotlight={false}
                  className={cn("overflow-hidden", expanded ? "!border-indigo-500/30" : "hover:border-indigo-500/20")}
                >
                  {session.status === "locked" && (
                    <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-400 to-red-600" />
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpand(session)}
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    className="group flex w-full cursor-pointer items-center gap-3.5 p-4 text-left transition-colors duration-200 hover:bg-elevated/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:gap-4 sm:p-5"
                  >
                    <span className="relative shrink-0">
                      <HpAvatar name={session.student.name} size="md" />
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full text-white ring-2 ring-[rgb(var(--bg-surface-rgb))]",
                          session.status === "locked" ? "bg-rose-500" : session.status === "active" ? "bg-amber-500" : "bg-slate-500"
                        )}
                      >
                        {session.status === "locked" ? <Ban className="h-2.5 w-2.5" strokeWidth={3} /> : <AlertTriangle className="h-2.5 w-2.5" strokeWidth={3} />}
                      </span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 truncate text-sm font-bold text-primary">{session.student.name}</span>
                        <HpPill tone={meta.tone} icon={meta.icon} dot={meta.dot} pulse={meta.pulse} size="sm">
                          {meta.label}
                        </HpPill>
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        <ScMeta icon={Swords} className="max-w-full">
                          {session.contest.title}
                        </ScMeta>
                        {session.student.section && <ScMeta icon={Users}>Section {session.student.section}</ScMeta>}
                        {session.student.roll_number && (
                          <ScMeta icon={Hash}>
                            <span className="font-mono">{session.student.roll_number}</span>
                          </ScMeta>
                        )}
                        {session.status === "locked" && session.locked_at && (
                          <ScMeta icon={Lock} className="text-rose-600 dark:text-rose-300">
                            Locked {formatRelative(new Date(session.locked_at))}
                          </ScMeta>
                        )}
                      </div>
                    </div>

                    <div className="hidden shrink-0 flex-col items-end gap-1.5 md:flex">
                      <ScRiskMeter level={risk.level} tone={risk.tone} />
                      <span className={cn("text-3xs font-bold uppercase tracking-[0.08em]", HP_TONES[risk.tone].text)}>{risk.label}</span>
                    </div>

                    <div className="tabular flex min-w-[52px] shrink-0 flex-col items-center rounded-xl border border-border-subtle bg-elevated/50 px-2.5 py-1.5 transition-colors duration-200 group-hover:bg-elevated">
                      <span className={cn("text-base font-extrabold leading-none", session.status === "locked" ? HP_TONES.rose.text : "text-primary")}>
                        {session.violation_count}
                      </span>
                      <span className="mt-0.5 text-3xs font-semibold text-text-muted">strike{session.violation_count === 1 ? "" : "s"}</span>
                    </div>

                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-text-muted transition-transform duration-300 group-hover:text-primary", expanded && "rotate-180")}
                      aria-hidden
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <ScCollapse id={panelId}>
                        <div className="space-y-4 border-t border-border-subtle px-4 py-4 sm:px-5">
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <h4 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Violation timeline</h4>
                            <span className="min-w-0 truncate text-2xs text-text-muted">{session.student.email}</span>
                          </div>

                          {loadingId === session.id ? (
                            <div className="space-y-3" role="status" aria-label="Loading timeline">
                              {[0, 1, 2].map((i) => (
                                <div key={i} className="flex items-center gap-3">
                                  <HpSkeleton className="h-3 w-3 rounded-full" />
                                  <HpSkeleton className="h-9 flex-1 rounded-xl" />
                                </div>
                              ))}
                            </div>
                          ) : timeline.length === 0 ? (
                            <p className="text-2xs text-text-muted">No timeline entries to show.</p>
                          ) : (
                            <ol className="relative space-y-2.5 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-border-strong">
                              {timeline.map((v) => (
                                <li key={v.id} className="relative flex items-center gap-3">
                                  <span
                                    aria-hidden
                                    className={cn(
                                      "relative z-[1] h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-[rgb(var(--bg-surface-rgb))]",
                                      v.counted_toward_lock ? "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]" : "bg-slate-400"
                                    )}
                                  />
                                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-border-subtle bg-elevated/30 px-3 py-2 transition-colors duration-200 hover:border-indigo-500/20 hover:bg-elevated/60">
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-primary">{v.label}</p>
                                      {(v.problem || v.ip_address) && (
                                        <p className="mt-0.5 truncate text-3xs text-text-muted">
                                          {v.problem}
                                          {v.problem && v.ip_address && " · "}
                                          {v.ip_address && <span className="font-mono">{v.ip_address}</span>}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      {v.counted_toward_lock && (
                                        <HpPill tone="rose" size="sm">
                                          Strike
                                        </HpPill>
                                      )}
                                      <span className="tabular font-mono text-3xs text-text-muted">
                                        {new Date(v.occurred_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                                      </span>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          )}

                          {session.status === "locked" && (
                            <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/[0.05] p-3.5 sm:flex-row sm:items-center sm:justify-between">
                              <p className="text-2xs leading-relaxed text-text-secondary">
                                <span className="font-bold text-primary">Locked out of this attempt.</span> If this was a false alarm, reinstate
                                their access.
                              </p>
                              <HpButton
                                variant="success"
                                size="sm"
                                onClick={() => handleReinstate(session)}
                                isLoading={reinstatingId === session.id}
                                leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                                className="shrink-0"
                              >
                                {reinstatingId === session.id ? "Reinstating..." : "Reinstate (false alarm)"}
                              </HpButton>
                            </div>
                          )}
                        </div>
                      </ScCollapse>
                    )}
                  </AnimatePresence>
                </HpCard>
              </ScReveal>
            );
          })}
        </AnimatePresence>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle flex flex-col items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-status-success" />
        <span>No proctoring violations on record — every contest attempt has been clean.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const expanded = expandedId === session.id;
        return (
          <div key={session.id} className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden">
            <button
              onClick={() => toggleExpand(session)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-hover/50 transition-colors flex-wrap"
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-control flex items-center justify-center shrink-0",
                  session.status === "locked" ? "bg-status-danger/10 text-status-danger" : "bg-status-warning/10 text-status-warning"
                )}
              >
                {session.status === "locked" ? <Ban className="w-4.5 h-4.5" /> : <AlertTriangle className="w-4.5 h-4.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-primary">{session.student.name}</span>
                  <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded", STATUS_STYLE[session.status])}>
                    {session.status}
                  </span>
                  {session.student.section && (
                    <span className="text-3xs text-text-muted">Section {session.student.section}</span>
                  )}
                </div>
                <p className="text-2xs text-text-muted mt-0.5">
                  {session.contest.title} · {session.violation_count} strike{session.violation_count === 1 ? "" : "s"}
                  {session.student.roll_number && <> · {session.student.roll_number}</>}
                </p>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-text-muted transition-transform shrink-0", expanded && "rotate-180")} />
            </button>

            {expanded && (
              <div className="px-4 pb-4 border-t border-border-subtle pt-3 space-y-3">
                {loadingId === session.id ? (
                  <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading timeline...
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {(violations[session.id] ?? []).map((v) => (
                      <li key={v.id} className="flex items-center justify-between text-2xs px-2.5 py-1.5 rounded bg-elevated/50">
                        <span className="text-text-secondary">
                          {v.label}
                          {v.problem && <span className="text-text-muted"> · {v.problem}</span>}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {v.counted_toward_lock && (
                            <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-status-danger/15 text-status-danger">
                              Strike
                            </span>
                          )}
                          <span className="text-text-muted font-mono">
                            {new Date(v.occurred_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {session.status === "locked" && (
                  <button
                    onClick={() => handleReinstate(session)}
                    disabled={reinstatingId === session.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 text-2xs font-bold text-status-success transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {reinstatingId === session.id ? "Reinstating..." : "Reinstate (false alarm)"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
