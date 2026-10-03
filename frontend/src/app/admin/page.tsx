"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCode2,
  Plus,
  Users2,
  Building2,
  LayoutDashboard,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CompanyCommandCenter } from "@/components/dashboard/company/CompanyCommandCenter";
import { TpoCommandCenter } from "@/components/dashboard/tpo/TpoCommandCenter";
import { OpsOverviewPanel } from "@/components/admin/mellow/OpsOverviewPanel";
import { PartnerCollegesPanel } from "@/components/admin/mellow/PartnerCollegesPanel";
import { PlatformUsersPanel } from "@/components/admin/mellow/PlatformUsersPanel";
import { ProblemBankPanel } from "@/components/admin/mellow/ProblemBankPanel";
import { cn, greeting } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api } from "@/lib/api";
import type { CompanyReportsData } from "@/types/hiring";

type MellowTab = "overview" | "colleges" | "users" | "problems";

/** null means "no permission required" — Overview is real, harmless aggregate data every admin_internal account sees regardless of what superadmin granted them. */
const MELLOW_TAB_PERMISSION: Record<MellowTab, string | null> = {
  overview: null,
  colleges: "colleges",
  users: "platform_users",
  problems: "problem_bank",
};

const MELLOW_TABS: { id: MellowTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "colleges", label: "Partner Colleges & TPOs", icon: Building2 },
  { id: "users", label: "Platform Users", icon: Users2 },
  { id: "problems", label: "Problem Bank", icon: FileCode2 },
];

const MELLOW_TAB_IDS = MELLOW_TABS.map((t) => t.id);

function isMellowTab(value: string | null): value is MellowTab {
  return value !== null && (MELLOW_TAB_IDS as string[]).includes(value);
}

function AdminPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The real authenticated role, verified server-side via /api/me — a
  // college_tpo session can never flip this to admin_internal from the
  // client, unlike the old localStorage-based persona switch.
  const { user, status } = useAuthGuard(["admin_internal", "admin_tpo", "superadmin", "admin_company"]);
  const userRole: "admin_internal" | "admin_tpo" | "admin_company" =
    user?.role === "admin_tpo" ? "admin_tpo" : user?.role === "admin_company" ? "admin_company" : "admin_internal";

  // Mellow staff only ever see the Platform Ops view now — there is no
  // "supervise a TPO's dashboard" mode to switch into. The view is simply
  // whichever one matches the real authenticated role; nothing to toggle,
  // and no query param can override it.
  const activeTab: "mellow" | "tpo" = userRole === "admin_tpo" ? "tpo" : "mellow";

  // Mellow Ops' own sub-navigation — a real tab-shell (mirrors
  // superadmin/page.tsx's ?tab= convention exactly) so every sidebar item
  // is a real, bookmarkable destination instead of a same-page #anchor.
  const mellowTabParam = searchParams?.get("tab") ?? null;
  const [mellowTab, setMellowTab] = useState<MellowTab>(isMellowTab(mellowTabParam) ? mellowTabParam : "overview");

  const goToMellowTab = (tab: MellowTab) => {
    setMellowTab(tab);
    router.replace(`/admin?view=mellow&tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    if (isMellowTab(mellowTabParam) && mellowTabParam !== mellowTab) setMellowTab(mellowTabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mellowTabParam]);

  // Real per-employee access, granted by superadmin (see MellowStaffPanel's
  // "Manage Access") — the backend is the actual enforcement (every /admin/*
  // route this maps to is gated by the matching `permission:` middleware),
  // this is purely so a restricted employee never even sees a tab, or a
  // stale URL for one, they'd just get a 403 from anyway.
  const allowedMellowTabs = MELLOW_TABS.filter((tab) => {
    const perm = MELLOW_TAB_PERMISSION[tab.id];
    return perm === null || userHasPermission(user, perm);
  });

  useEffect(() => {
    if (status !== "ready" || userRole !== "admin_internal") return;
    if (!allowedMellowTabs.some((t) => t.id === mellowTab)) goToMellowTab("overview");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userRole, mellowTab, user?.permissions]);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // TPO VIEW: its real cohort + placement pipeline data, subscription status
  // and placement-target editor now live in TpoCommandCenter (rendered
  // below for admin_tpo only), mirroring CompanyCommandCenter.

  // -----------------------------------------------------------------
  // COMPANY VIEW: real hiring pipeline data (CompanyReportsController) —
  // the Phase 1 shell rendered a static empty state; this replaces it with
  // the same live-data pattern the TPO view above already uses.
  // -----------------------------------------------------------------
  const [companyReportsData, setCompanyReportsData] = useState<CompanyReportsData | null>(null);
  const [companyDataLoading, setCompanyDataLoading] = useState(true);
  interface CompanyDrive {
    id: number;
    title: string;
    role_title: string;
    ctc_range: string | null;
    drive_date: string;
    status: "draft" | "published" | "completed" | "cancelled";
    applications_count: number;
  }
  const [companyDrives, setCompanyDrives] = useState<CompanyDrive[]>([]);

  useEffect(() => {
    if (userRole !== "admin_company" || status !== "ready") return;
    setCompanyDataLoading(true);
    api
      .get<CompanyReportsData>("/company/reports/data")
      .then(setCompanyReportsData)
      .catch(() => setCompanyReportsData(null))
      .finally(() => setCompanyDataLoading(false));

    api
      .get<{ drives: CompanyDrive[] }>("/company/drives")
      .then((res) => setCompanyDrives(res.drives))
      .catch(() => setCompanyDrives([]));
  }, [userRole, status]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  return (
    <DashboardShell
      role={userRole}
      currentTpoView={activeTab}
      title={
        userRole === "admin_company"
          ? `${greeting()}, ${user?.name ?? "there"}`
          : userRole === "admin_tpo" || activeTab === "tpo"
          ? `${greeting()}, ${user?.name ?? "there"}`
          : "Mellow Internal Operations"
      }
      subtitle={
        userRole === "admin_company"
          ? `${user?.company?.name ?? "Your company"} — Job openings, candidate pipeline & hiring assessments.`
          : userRole === "admin_tpo" || activeTab === "tpo"
          ? `${user?.college?.name ?? "Your institution"} — Campus placement readiness & recruitment drives.`
          : "Platform curation, partner college governance, and platform-user management."
      }
      actionButton={
        userRole === "admin_company"
          ? {
              label: "Post a Job Opening",
              icon: Plus,
              onClick: () => router.push("/admin/company/drives"),
            }
          : userRole === "admin_tpo" || activeTab === "tpo"
          ? {
              label: "Manage Campus Drives",
              icon: Plus,
              onClick: () => router.push("/admin/drives"),
            }
          : undefined
      }
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary"
          >
            <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mellow Internal Staff: a lightweight "who's signed in" status strip.
          TPOs don't get an equivalent banner here — their institution/name/
          role identity is already the whole point of the Institutional
          Banner further down (see VIEW 2 below), and a second banner
          repeating the same institute name and TPO name right above it
          just to say "you can't reach the Mellow portal" was leftover
          messaging from the old persona-switcher (see project history) that
          no longer applies now that each role only ever renders its own view. */}
      {userRole === "admin_internal" && (
        <div className="p-2 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 w-full md:w-auto">
            <div className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-btn text-xs font-bold bg-indigo-600 text-white shadow-glow">
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Mellow Platform Ops</span>
              <span className="px-1.5 py-0.2 rounded-full text-3xs bg-white/20 text-white font-mono">
                Internal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-2 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
              <span className="text-text-secondary font-medium">Staff: {user?.name} ({user?.email})</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1: MELLOW INTERNAL EMPLOYEE — real tab-shell (mirrors              */}
      {/* superadmin/page.tsx exactly): every tab is a real, database-backed      */}
      {/* panel and a real ?tab= destination, not a same-page #anchor into a      */}
      {/* mix of real sections and hardcoded mock data.                           */}
      {/* ========================================================================= */}
      {userRole === "admin_internal" && activeTab === "mellow" && (
        <motion.div
          key="mellow-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit flex-wrap">
            {allowedMellowTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => goToMellowTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-control text-2xs font-bold transition-all whitespace-nowrap",
                    mellowTab === tab.id ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {allowedMellowTabs.length === 1 && (
            <div className="p-4 rounded-panel bg-status-warning/10 border border-status-warning/25 text-xs text-status-warning">
              You haven&apos;t been granted access to any Mellow Ops section yet — ask your superadmin to grant access from the Mellow Staff tab.
            </div>
          )}

          {mellowTab === "overview" && <OpsOverviewPanel />}
          {mellowTab === "colleges" && allowedMellowTabs.some((t) => t.id === "colleges") && <PartnerCollegesPanel triggerToast={triggerToast} />}
          {mellowTab === "users" && allowedMellowTabs.some((t) => t.id === "users") && <PlatformUsersPanel triggerToast={triggerToast} />}
          {mellowTab === "problems" && allowedMellowTabs.some((t) => t.id === "problems") && <ProblemBankPanel triggerToast={triggerToast} />}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: COLLEGE TPO PORTAL (PLACEMENT COMMAND CENTER) — see TpoCommandCenter. */}
      {/* ========================================================================= */}
      {activeTab === "tpo" && <TpoCommandCenter user={user} />}

      {/* VIEW 3: COMPANY HIRING PORTAL — see CompanyCommandCenter. */}
      {userRole === "admin_company" && (
        <CompanyCommandCenter user={user} drives={companyDrives} reports={companyReportsData} loading={companyDataLoading} />
      )}
    </DashboardShell>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-xs text-text-muted">
          Loading Admin Portal...
        </div>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
