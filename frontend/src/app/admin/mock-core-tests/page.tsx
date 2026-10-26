"use client";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { CoreTestsPanel } from "@/components/admin/core/CoreTestsPanel";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useToast } from "@/lib/toast";

/**
 * A college TPO's own timed technical mock tests for its ECE / EEE / Mechanical / Civil students — built from a
 * blueprint or from a copy of one of Mellow's papers, visible only to this college's students. Mirrors Mock
 * Contests / Mock Interviews / Soft Skills; the sidebar shows it once Mellow has switched a branch family live.
 */
export default function MockCoreTestsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const showToast = useToast();

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Core Tests"
      subtitle="Private timed technical tests for your Electronics, Electrical, Mechanical and Civil students — only your own college sees them."
    >
      <CoreTestsPanel mode="tpo" onToast={showToast} />
    </DashboardShell>
  );
}
