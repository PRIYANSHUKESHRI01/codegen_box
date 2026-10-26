"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { IntegrityReview } from "@/components/proctoring/IntegrityReview";
import { ProctoringSessionList } from "@/components/proctoring/ProctoringSessionList";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { ProctoringSessionSummary } from "@/types/proctoring";
import { useToast } from "@/lib/toast";

/**
 * Section Coordinator view of flagged proctoring sessions — scoped to
 * exactly their own section server-side (see CoordinatorProctoringController),
 * same "never see another section's students" posture as the rest of the
 * coordinator surface. See /admin/proctoring for the TPO's college-wide view.
 */
export default function CoordinatorProctoringPage() {
  const { status } = useAuthGuard(["section_coordinator"]);
  const [sessions, setSessions] = useState<ProctoringSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const triggerToast = useToast();

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ sessions: ProctoringSessionSummary[] }>("/coordinator/proctoring");
      setSessions(res.sessions);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load proctoring activity.", "error");
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
      role="section_coordinator"
      title="Proctoring Activity"
      subtitle="Every contest attempt flagged for a fullscreen exit, tab switch, or blocked action — in your section only."
    >
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
        <ProctoringSessionList sessions={sessions} apiBasePath="/coordinator/proctoring" onToast={triggerToast} onReinstated={loadSessions} />
      )}

      {/* Every proctored attempt of your students, with its tamper-evident log, pictures and network. */}
      <IntegrityReview apiBase="/coordinator/integrity" />
    </DashboardShell>
  );
}
