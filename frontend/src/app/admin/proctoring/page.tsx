"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ProctoringSessionList } from "@/components/proctoring/ProctoringSessionList";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { ProctoringSessionSummary } from "@/types/proctoring";

/**
 * College-TPO view of every flagged proctoring session across the WHOLE
 * college (every section) — see /coordinator/proctoring for the
 * section-scoped equivalent a Section Coordinator sees. Reached from the
 * "Review in Dashboard" link in ProctoringViolationReportMail.
 */
export default function TpoProctoringPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [sessions, setSessions] = useState<ProctoringSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ sessions: ProctoringSessionSummary[] }>("/tpo/proctoring");
      setSessions(res.sessions);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load proctoring activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadSessions();
  }, [status, loadSessions]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const lockedCount = sessions.filter((s) => s.status === "locked").length;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Proctoring Activity"
      subtitle="Every contest attempt flagged for a fullscreen exit, tab switch, or blocked action — across your whole college."
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {lockedCount > 0 && (
        <div className="p-3.5 rounded-panel bg-status-danger/10 border border-status-danger/25 flex items-center gap-2.5 text-xs text-status-danger font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{lockedCount} student{lockedCount === 1 ? " has" : "s have"} been locked out of a live contest due to repeated violations.</span>
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          Loading...
        </div>
      ) : (
        <ProctoringSessionList sessions={sessions} apiBasePath="/tpo/proctoring" onToast={triggerToast} onReinstated={loadSessions} />
      )}
    </DashboardShell>
  );
}
