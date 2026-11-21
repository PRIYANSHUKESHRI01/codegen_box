"use client";

import { ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { VaultAiResultsList } from "@/components/admin/vault/VaultAiResultsList";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useToast } from "@/lib/toast";

/**
 * TPO → Vault AI Results: every student of the college who has completed a Vault AI Interview series — the final average of their
 * three sets (best series kept if they sat again), the set scores, attempts, and the PDF report AptRun keeps for each.
 */
export default function TpoVaultAiResultsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const toast = useToast();

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Vault AI Interview results"
      subtitle="Your students' final averages across the three sets, their attempts, and the PDF report for each."
    >
      <p className="flex items-start gap-2 text-2xs text-text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />
        The final average is the average of the three sets of a student&apos;s best series (60% or more qualifies them for Mellow Vault). If a student sits again, the best result is kept.
      </p>
      <VaultAiResultsList scope="tpo" triggerToast={toast} />
    </DashboardShell>
  );
}
