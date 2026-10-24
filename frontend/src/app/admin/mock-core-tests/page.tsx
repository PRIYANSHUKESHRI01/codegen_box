"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { CoreTestsPanel } from "@/components/admin/core/CoreTestsPanel";
import { useAuthGuard } from "@/lib/useAuthGuard";

/**
 * A college TPO's own timed technical mock tests for its ECE / EEE / Mechanical / Civil students — built from a
 * blueprint or from a copy of one of Mellow's papers, visible only to this college's students. Mirrors Mock
 * Contests / Mock Interviews / Soft Skills; the sidebar shows it once Mellow has switched a branch family live.
 */
export default function MockCoreTestsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Core Tests"
      subtitle="Private timed technical tests for your Electronics, Electrical, Mechanical and Civil students — only your own college sees them."
    >
      {toast && (
        <div role="status" className="fixed right-6 top-20 z-[100] max-w-sm rounded-panel border border-accent-primary/40 bg-surface px-4 py-3 text-xs font-semibold text-primary shadow-card">
          {toast}
        </div>
      )}
      <CoreTestsPanel mode="tpo" onToast={showToast} />
    </DashboardShell>
  );
}
