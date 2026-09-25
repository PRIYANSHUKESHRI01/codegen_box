"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Building2, BookOpen, Code2, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { CompaniesPanel } from "@/components/admin/placements/CompaniesPanel";
import { DrivesPanel } from "@/components/admin/placements/DrivesPanel";
import { PrepQuestionsPanel } from "@/components/admin/placements/PrepQuestionsPanel";
import { RecommendedProblemsPanel } from "@/components/admin/placements/RecommendedProblemsPanel";
import type { AdminCompanyRow } from "@/components/admin/placements/types";
import { cn } from "@/lib/utils";

type Tab = "companies" | "drives" | "prep" | "problems";

const TABS: { id: Tab; label: string; icon: typeof Building2 }[] = [
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "drives", label: "Drives", icon: Briefcase },
  { id: "prep", label: "Prep Questions", icon: BookOpen },
  { id: "problems", label: "Recommended Problems", icon: Code2 },
];

export default function PlacementsAdminPage() {
  // admin_internal and superadmin share this screen — same posture as
  // admin/page.tsx, which always renders its Mellow-ops chrome as
  // "admin_internal" regardless of which of the two roles is actually
  // signed in, since it's the same underlying content either way.
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "placements");
  const [activeTab, setActiveTab] = useState<Tab>("companies");
  const [companies, setCompanies] = useState<AdminCompanyRow[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ companies: AdminCompanyRow[] }>("/admin/companies");
      setCompanies(res.companies);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load companies.");
    } finally {
      setCompaniesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready" && hasAccess) loadCompanies();
  }, [status, hasAccess, loadCompanies]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="Placement Drives & Companies">
        <AccessDeniedNotice section="Companies & Placement Drives" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role="admin_internal"
      title="Placement Drives & Companies"
      subtitle="Manage the shared company catalog, scheduled drives, and prep content TPOs map into their college."
    >
      <div className="flex items-center gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-control text-[11px] font-bold transition-all",
                activeTab === tab.id ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loadError && (
        <div className="p-4 rounded-panel bg-status-danger/10 border border-status-danger/25 flex items-center justify-between gap-3 text-xs text-status-danger">
          <span>{loadError}</span>
          <button onClick={loadCompanies} className="font-bold underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {companiesLoading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading companies...
        </div>
      ) : (
        <>
          {activeTab === "companies" && <CompaniesPanel companies={companies} onChanged={loadCompanies} />}
          {activeTab === "drives" && <DrivesPanel companies={companies} />}
          {activeTab === "prep" && <PrepQuestionsPanel companies={companies} onCompaniesChanged={loadCompanies} />}
          {activeTab === "problems" && <RecommendedProblemsPanel companies={companies} onCompaniesChanged={loadCompanies} />}
        </>
      )}
    </DashboardShell>
  );
}
