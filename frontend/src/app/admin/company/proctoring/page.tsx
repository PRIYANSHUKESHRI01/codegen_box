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
 * Company hiring tenant's view of every flagged proctoring session across
 * their own assessments — reuses ProctoringSessionList unmodified (see
 * CompanyProctoringController::summary()'s docblock for why the response
 * shape is deliberately identical to the TPO's), same "flagged sessions
 * only" convention as /admin/proctoring.
 */
export default function CompanyProctoringPage() {
  const { status } = useAuthGuard(["admin_company"]);
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
      const res = await api.get<{ sessions: ProctoringSessionSummary[] }>("/company/proctoring");
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
    return <SessionLoader />;
  }

  const lockedCount = sessions.filter((s) => s.status === "locked").length;

  return (
    <DashboardShell
      role="admin_company"
      title="Proctoring Activity"
      subtitle="Every assessment attempt flagged for a fullscreen exit, tab switch, or blocked action — across your own hiring assessments."
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-teal-500/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {lockedCount > 0 && (
        <div className="p-3.5 rounded-panel bg-status-danger/10 border border-status-danger/25 flex items-center gap-2.5 text-xs text-status-danger font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{lockedCount} candidate{lockedCount === 1 ? " has" : "s have"} been locked out of a live assessment due to repeated violations.</span>
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          Loading...
        </div>
      ) : (
        <ProctoringSessionList sessions={sessions} apiBasePath="/company/proctoring" onToast={triggerToast} onReinstated={loadSessions} />
      )}
    </DashboardShell>
  );
}
