"use client";

import { useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, Loader2, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ProctoringSessionSummary, ProctoringViolationDetail } from "@/types/proctoring";

const STATUS_STYLE: Record<ProctoringSessionSummary["status"], string> = {
  active: "bg-status-warning/15 text-status-warning",
  locked: "bg-status-danger/15 text-status-danger",
  completed: "bg-elevated text-text-muted",
};

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
}: {
  sessions: ProctoringSessionSummary[];
  apiBasePath: string;
  onToast: (msg: string) => void;
  onReinstated: () => void;
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
