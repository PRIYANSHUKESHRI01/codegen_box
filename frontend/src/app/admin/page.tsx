"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCode2,
  Briefcase,
  Sparkles,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  Filter,
  Users2,
  Trophy,
  Building2,
  BarChart3,
  TrendingUp,
  Target,
  Loader2,
  LayoutDashboard,
  Mail,
  Phone,
  UserX,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { OpsOverviewPanel } from "@/components/admin/mellow/OpsOverviewPanel";
import { PartnerCollegesPanel } from "@/components/admin/mellow/PartnerCollegesPanel";
import { PlatformUsersPanel } from "@/components/admin/mellow/PlatformUsersPanel";
import { ProblemBankPanel } from "@/components/admin/mellow/ProblemBankPanel";
import { cn, greeting } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { TpoReportsData } from "@/lib/generateTpoReports";
import { computeSectionStats, type SectionCoordinatorInfo } from "@/lib/sectionBreakdown";
import type { CompanyReportsData } from "@/types/hiring";
import type { SubscriptionCoverage } from "@/types/subscription";

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

  // -----------------------------------------------------------------
  // TPO VIEW: real cohort + placement pipeline data (TpoReportsController)
  // — replaces the TPO dashboard's previously-fictional
  // PLACEMENT_FUNNEL/RECENT_PLACEMENTS/CAMPUS_DRIVES/etc mock data.
  // -----------------------------------------------------------------
  const [tpoReportsData, setTpoReportsData] = useState<TpoReportsData | null>(null);
  const [tpoDataLoading, setTpoDataLoading] = useState(true);
  const [tpoCoordinators, setTpoCoordinators] = useState<(SectionCoordinatorInfo & { section: string })[]>([]);
  interface TpoMappedDrive {
    placement_drive_id: number;
    is_active: boolean;
    placement_drive: {
      title: string;
      role_title: string;
      drive_date: string;
      status: string;
      company: { name: string; logo: string | null };
    };
  }
  const [tpoMappedDrives, setTpoMappedDrives] = useState<TpoMappedDrive[]>([]);
  // Institutional subscription status — GET /me/subscription already
  // returns this correctly (isActive()-aware) for admin_tpo, but nothing in
  // this dashboard rendered it before now, so a TPO had zero visibility
  // into their own college's demo countdown or an expired subscription
  // until an import/add silently started failing.
  const [subscriptionCoverage, setSubscriptionCoverage] = useState<SubscriptionCoverage | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetPercentInput, setTargetPercentInput] = useState("");
  const [targetDeadlineInput, setTargetDeadlineInput] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  const handleSaveTarget = async () => {
    setSavingTarget(true);
    try {
      await api.post("/tpo/placement-target", {
        target_percent: targetPercentInput ? Number(targetPercentInput) : null,
        target_deadline: targetDeadlineInput || null,
      });
      const res = await api.get<TpoReportsData>("/tpo/reports/data");
      setTpoReportsData(res);
      setEditingTarget(false);
      triggerToast("Placement target updated.");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update target.");
    } finally {
      setSavingTarget(false);
    }
  };

  useEffect(() => {
    if (userRole !== "admin_tpo" || status !== "ready") return;
    setTpoDataLoading(true);
    api
      .get<TpoReportsData>("/tpo/reports/data")
      .then(setTpoReportsData)
      .catch(() => setTpoReportsData(null))
      .finally(() => setTpoDataLoading(false));

    api
      .get<{ mappings: TpoMappedDrive[] }>("/tpo/drives/mapped")
      .then((res) => setTpoMappedDrives((res.mappings ?? []).filter((m) => m.is_active && m.placement_drive.status === "published")))
      .catch(() => setTpoMappedDrives([]));

    api
      .get<{ coordinators: (SectionCoordinatorInfo & { section: string })[] }>("/tpo/coordinators")
      .then((res) => setTpoCoordinators(res.coordinators))
      .catch(() => setTpoCoordinators([]));

    api
      .get<{ scope: string; coverage: SubscriptionCoverage }>("/me/subscription")
      .then((res) => setSubscriptionCoverage(res.coverage))
      .catch(() => setSubscriptionCoverage(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, status]);

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
      {/* VIEW 2: COLLEGE TPO PORTAL (PLACEMENT COMMAND CENTER) */}
      {/* ========================================================================= */}
      {activeTab === "tpo" && (
        <motion.div
          key="tpo-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-8"
        >
          {/* Institutional Banner — every field real, no fabricated college/TPO stand-ins */}
          <div className="p-6 rounded-panel bg-gradient-to-br from-surface to-elevated border border-border-subtle shadow-subtle relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-accent-secondary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-panel bg-accent-secondary/15 border border-accent-secondary/30 flex items-center justify-center text-3xl shadow-subtle flex-shrink-0">
                  ⚡
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-primary">{user?.college?.name ?? "Your College"}</h2>
                    {user?.college?.tier && (
                      <span className="px-2 py-0.5 text-3xs font-bold rounded-full bg-status-success/15 text-status-success border border-status-success/30">
                        {user.college.tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {[user?.college?.city, user?.college?.state].filter(Boolean).join(", ") || "Location not on file"} • Head:{" "}
                    <strong className="text-primary">{user?.name}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/admin/reports"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-surface hover:bg-surface-hover border border-border-subtle text-primary text-xs font-semibold transition-colors shadow-subtle"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Reports</span>
                </Link>
                <Link
                  href="/admin/drives"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-accent-secondary hover:bg-accent-secondary-hover text-white text-xs font-semibold transition-colors shadow-subtle"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Manage Drives</span>
                </Link>
              </div>
            </div>

            {/* Subscription status strip — closes the gap where a TPO
                previously had zero visibility into their own college's
                demo countdown or an expired subscription; GET
                /me/subscription already resolved this correctly, nothing
                here rendered it. */}
            {subscriptionCoverage && (() => {
              if (subscriptionCoverage.days_remaining === null) {
                return (
                  <div className="relative z-10 mt-4 pt-4 border-t border-border-subtle flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-status-danger shrink-0" />
                    <span className="text-status-danger font-semibold">
                      No active subscription — new students can&apos;t be imported or added. Contact Mellow Vault to renew.
                    </span>
                  </div>
                );
              }
              if (subscriptionCoverage.is_trial) {
                return (
                  <div className="relative z-10 mt-4 pt-4 border-t border-border-subtle flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-status-warning shrink-0" />
                    <span className="text-status-warning font-semibold">
                      Demo plan — {subscriptionCoverage.days_remaining} day{subscriptionCoverage.days_remaining === 1 ? "" : "s"} remaining
                      before you&apos;ll need to subscribe.
                    </span>
                  </div>
                );
              }
              if (subscriptionCoverage.days_remaining <= 14) {
                return (
                  <div className="relative z-10 mt-4 pt-4 border-t border-border-subtle flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-status-warning shrink-0" />
                    <span className="text-status-warning font-semibold">
                      Renewing soon — {subscriptionCoverage.days_remaining} day{subscriptionCoverage.days_remaining === 1 ? "" : "s"} left on
                      your current plan.
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {tpoDataLoading ? (
            <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your cohort and placement data...
            </div>
          ) : tpoReportsData ? (
            <>
              {/* TPO Cohort Stats — real, from TpoReportsController */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Batch Enrollment</span>
                    <Users2 className="w-4 h-4 text-accent-secondary" />
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                      {tpoReportsData.placements.funnel.batch_enrolled.toLocaleString()}
                    </div>
                    <div className="text-xs text-text-muted mt-1">Students on your roster</div>
                  </div>
                </div>

                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Students Placed</span>
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl sm:text-3xl font-extrabold text-status-success">
                      {tpoReportsData.placements.funnel.accepted} ({tpoReportsData.placements.target.current_percent}%)
                    </div>
                    <div className="text-xs text-text-muted mt-1 font-medium">Offers accepted this season</div>
                  </div>
                </div>

                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Avg Readiness</span>
                    <Trophy className="w-4 h-4 text-accent-primary" />
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                      {tpoReportsData.students.length > 0
                        ? Math.round(tpoReportsData.students.reduce((s, st) => s + st.readiness_score, 0) / tpoReportsData.students.length)
                        : 0}
                      <span className="text-sm text-text-muted">/100</span>
                    </div>
                    <div className="text-xs text-text-muted mt-1 font-medium">Across your whole cohort</div>
                  </div>
                </div>

                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Companies Hired</span>
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl sm:text-3xl font-extrabold text-amber-500">{tpoReportsData.placements.company_summary.length}</div>
                    <div className="text-xs text-text-muted mt-1">This placement season</div>
                  </div>
                </div>
              </div>

              {/* Placement Target — a real, TPO-set goal (POST /tpo/placement-target), not a fabricated number */}
              <section className="p-5 sm:p-6 rounded-panel bg-gradient-to-br from-accent-secondary/10 via-surface to-surface border border-accent-secondary/25 shadow-subtle">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-control bg-accent-secondary/15 border border-accent-secondary/30 flex items-center justify-center text-accent-secondary shrink-0">
                      <Target className="w-5 h-5" />
                    </div>
                    <div>
                      {editingTarget ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={targetPercentInput}
                            onChange={(e) => setTargetPercentInput(e.target.value)}
                            placeholder="Target %"
                            className="w-24 px-2 py-1.5 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary"
                          />
                          <input
                            type="date"
                            value={targetDeadlineInput}
                            onChange={(e) => setTargetDeadlineInput(e.target.value)}
                            className="px-2 py-1.5 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary"
                          />
                          <button
                            onClick={handleSaveTarget}
                            disabled={savingTarget}
                            className="px-3 py-1.5 rounded-control bg-accent-primary text-white text-2xs font-bold disabled:opacity-60"
                          >
                            Save
                          </button>
                          <button onClick={() => setEditingTarget(false)} className="px-3 py-1.5 rounded-control border border-border-subtle text-text-muted text-2xs font-bold">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-sm font-bold text-primary">
                            {tpoReportsData.placements.target.target_percent
                              ? `Placement Target: ${tpoReportsData.placements.target.target_percent}%${
                                  tpoReportsData.placements.target.target_deadline
                                    ? ` by ${new Date(tpoReportsData.placements.target.target_deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                                    : ""
                                }`
                              : "No placement target set yet"}
                          </h3>
                          <button
                            onClick={() => {
                              setTargetPercentInput(tpoReportsData.placements.target.target_percent ?? "");
                              setTargetDeadlineInput(tpoReportsData.placements.target.target_deadline?.slice(0, 10) ?? "");
                              setEditingTarget(true);
                            }}
                            className="text-2xs font-bold text-accent-primary hover:underline mt-0.5"
                          >
                            {tpoReportsData.placements.target.target_percent ? "Change target" : "Set a target"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-black text-primary font-mono">{tpoReportsData.placements.target.current_percent}%</div>
                    <div className="text-3xs text-text-muted uppercase tracking-wider">Current</div>
                  </div>
                </div>
                {tpoReportsData.placements.target.target_percent && (
                  <>
                    <div className="mt-4 relative w-full h-3 rounded-full bg-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-secondary to-accent-primary transition-all duration-700"
                        style={{
                          width: `${Math.min(100, (tpoReportsData.placements.target.current_percent / Number(tpoReportsData.placements.target.target_percent)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-3xs text-text-muted font-mono">
                      <span>0%</span>
                      <span>Target: {tpoReportsData.placements.target.target_percent}%</span>
                    </div>
                  </>
                )}
              </section>

              {/* Funnel + Action Items — real */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
                      <Filter className="w-4 h-4 text-accent-primary" />
                      <span>Placement Funnel</span>
                    </h3>
                    <Link href="/admin/analytics" className="text-2xs font-semibold text-accent-primary hover:underline flex items-center gap-1">
                      <span>Full analytics</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                    {([
                      ["Enrolled", tpoReportsData.placements.funnel.batch_enrolled],
                      ["Registered", tpoReportsData.placements.funnel.registered],
                      ["Shortlisted", tpoReportsData.placements.funnel.shortlisted],
                      ["Interviewed", tpoReportsData.placements.funnel.interviewed],
                      ["Offered", tpoReportsData.placements.funnel.offered],
                      ["Accepted", tpoReportsData.placements.funnel.accepted],
                    ] as [string, number][]).map(([label, value]) => (
                      <div key={label} className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                        <div className="text-base font-black text-primary font-mono">{value}</div>
                        <div className="text-3xs text-text-muted uppercase tracking-wider mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-primary flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-status-warning" />
                      <span>Needs Your Attention</span>
                    </h3>
                    <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger border border-status-danger/25">
                      {tpoReportsData.placements.action_items.length}
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {tpoReportsData.placements.action_items.length === 0 ? (
                      <p className="text-2xs text-text-muted text-center py-4">Nothing needs your attention right now.</p>
                    ) : (
                      tpoReportsData.placements.action_items.map((item, i) => (
                        <div key={i} className="p-3 rounded-control border text-xs space-y-1.5 bg-elevated/60 border-border-subtle">
                          <p className="text-text-secondary leading-relaxed">{item.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Mapped Drives + Recent Placements — real */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-primary flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-accent-secondary" />
                      <span>Active Campus Drives</span>
                    </h2>
                    <Link href="/admin/drives" className="text-2xs font-semibold text-accent-primary hover:underline flex items-center gap-1">
                      <span>Manage all</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {tpoMappedDrives.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                      No drives mapped yet — map one from Manage Drives.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tpoMappedDrives.slice(0, 3).map((m) => (
                        <div
                          key={m.placement_drive_id}
                          className="p-4 rounded-panel bg-surface border border-border-subtle hover:border-border-strong transition-all shadow-subtle space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xl">{m.placement_drive.company.logo ?? "🏢"}</span>
                              <div>
                                <h3 className="font-bold text-sm text-primary">{m.placement_drive.company.name}</h3>
                                <div className="text-2xs text-text-muted">{m.placement_drive.role_title}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-2xs text-text-muted pt-1">
                            <span>📅 {new Date(m.placement_drive.drive_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-primary flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-status-success" />
                      <span>Recent Placement Wins</span>
                    </h2>
                    <Link href="/admin/students" className="text-2xs font-semibold text-accent-primary hover:underline flex items-center gap-1">
                      <span>View cohort</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {tpoReportsData.placements.recent_placements.length === 0 ? (
                    <div className="p-6 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                      No offers accepted yet this season.
                    </div>
                  ) : (
                    <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle divide-y divide-border-subtle overflow-hidden">
                      {tpoReportsData.placements.recent_placements.map((p, i) => (
                        <div key={i} className="p-3.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-primary truncate">{p.student_name}</div>
                            <div className="text-3xs text-text-muted truncate">
                              {p.company} · {p.role_title}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-bold text-status-success">{p.ctc_offered} LPA</div>
                            <div className="text-3xs text-text-muted">
                              {new Date(p.placed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Branch Performance Snapshot — real, from per-student readiness_score */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-primary flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-accent-secondary" />
                    <span>Branch-wise Readiness Snapshot</span>
                  </h2>
                  <Link href="/admin/analytics" className="text-2xs font-semibold text-accent-primary hover:underline flex items-center gap-1">
                    <span>Full analytics</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from(
                    tpoReportsData.students.reduce((map, s) => {
                      if (!s.branch) return map;
                      const g = map.get(s.branch) ?? { readiness: [] as number[], count: 0 };
                      g.readiness.push(s.readiness_score);
                      g.count++;
                      map.set(s.branch, g);
                      return map;
                    }, new Map<string, { readiness: number[]; count: number }>())
                  ).map(([branch, g]) => (
                    <div key={branch} className="p-4 rounded-control bg-surface border border-border-subtle space-y-3 shadow-subtle">
                      <div className="font-bold text-xs text-primary">{branch}</div>
                      <div className="space-y-1 text-2xs">
                        <div className="flex justify-between text-text-secondary">
                          <span>Avg Readiness:</span>
                          <strong className="text-primary font-mono">
                            {Math.round(g.readiness.reduce((a, b) => a + b, 0) / g.readiness.length)}/100
                          </strong>
                        </div>
                      </div>
                      <div className="text-3xs text-text-muted font-mono pt-2 border-t border-border-subtle">{g.count} Candidates</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Section Performance — ranked best-average-readiness first,
                  same computeSectionStats used on Placement Reports and the
                  Student Cohort page, so the ranking is identical everywhere.
                  Surfaces the coordinator's contact right on the dashboard
                  so a TPO doesn't need to open Reports to see who to contact
                  about an underperforming section. */}
              {(() => {
                const sectionStats = computeSectionStats(tpoReportsData.students, tpoCoordinators);
                if (sectionStats.length === 0) return null;

                return (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold text-primary flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-accent-primary" />
                        <span>Section Performance</span>
                      </h2>
                      <Link href="/admin/reports" className="text-2xs font-semibold text-accent-primary hover:underline flex items-center gap-1">
                        <span>Full reports</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle divide-y divide-border-subtle overflow-hidden">
                      {sectionStats.map((s, i) => (
                        <div key={s.section} className="flex items-center gap-3 p-3.5 flex-wrap sm:flex-nowrap">
                          <span
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-3xs font-black shrink-0",
                              i === 0 ? "bg-amber-500/20 text-amber-500" : "bg-elevated text-text-muted"
                            )}
                          >
                            {i + 1}
                          </span>
                          <span className="text-xs font-bold text-primary w-28 shrink-0">
                            {s.section === "Unassigned" ? "No Section" : `Section ${s.section}`}
                          </span>
                          <span className="text-2xs text-text-muted font-mono w-20 shrink-0">{s.studentCount} students</span>
                          <span className="flex-1 flex items-center gap-2 min-w-[100px]">
                            <span className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
                              <span
                                className={cn(
                                  "block h-full rounded-full",
                                  s.avgReadiness >= 75 ? "bg-status-success" : s.avgReadiness >= 45 ? "bg-accent-secondary" : "bg-status-warning"
                                )}
                                style={{ width: `${s.avgReadiness}%` }}
                              />
                            </span>
                            <span className="text-2xs font-mono font-bold text-text-secondary w-14 text-right shrink-0">
                              {s.avgReadiness}/100
                            </span>
                          </span>
                          <span className="w-56 shrink-0 flex items-center justify-end gap-2 text-2xs">
                            {s.coordinator ? (
                              <>
                                <span className="font-semibold text-text-secondary truncate">{s.coordinator.name}</span>
                                <a
                                  href={`mailto:${s.coordinator.email}`}
                                  title={`Email ${s.coordinator.name}`}
                                  className="p-1 rounded text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors shrink-0"
                                >
                                  <Mail className="w-3 h-3" />
                                </a>
                                {s.coordinator.phone && (
                                  <a
                                    href={`tel:${s.coordinator.phone}`}
                                    title={`Call ${s.coordinator.name}`}
                                    className="p-1 rounded text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors shrink-0"
                                  >
                                    <Phone className="w-3 h-3" />
                                  </a>
                                )}
                              </>
                            ) : (
                              <span className="flex items-center gap-1 text-status-warning font-semibold">
                                <UserX className="w-3 h-3" />
                                No coordinator
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })()}
            </>
          ) : (
            <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
              Couldn&apos;t load your cohort data. Please refresh.
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: COMPANY HIRING PORTAL — Phase 1 ships the shell only (empty     */}
      {/* state, no live data fetch yet). Job openings/candidates/assessments/    */}
      {/* reports land in later phases and will populate this view in place.      */}
      {/* ========================================================================= */}
      {userRole === "admin_company" && (
        <motion.div
          key="company-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-8"
        >
          {/* Institutional Banner — mirrors VIEW 2's, real company/admin identity, no fabricated stand-ins */}
          <div className="p-6 rounded-panel bg-gradient-to-br from-surface to-elevated border border-border-subtle shadow-subtle relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-panel bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-3xl shadow-subtle flex-shrink-0">
                  {user?.company?.logo ?? "🏢"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-primary">{user?.company?.name ?? "Your Company"}</h2>
                    {user?.company?.industry && (
                      <span className="px-2 py-0.5 text-3xs font-bold rounded-full bg-teal-500/15 text-teal-500 border border-teal-500/30">
                        {user.company.industry}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Hiring Team • Lead: <strong className="text-primary">{user?.name}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/admin/company/drives"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors shadow-subtle"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Post a Job Opening</span>
                </Link>
              </div>
            </div>
          </div>

          {companyDataLoading ? (
            <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your hiring pipeline...
            </div>
          ) : companyDrives.length === 0 ? (
            <div className="p-10 sm:p-14 rounded-panel bg-surface border border-border-subtle shadow-subtle text-center flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-teal-500/10 border border-teal-500/25 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-teal-500" />
              </div>
              <h3 className="text-base font-bold text-primary">Your Hiring Command Center</h3>
              <p className="text-xs text-text-muted max-w-md leading-relaxed">
                Job openings, your candidate pipeline, and proctored assessments will appear here as soon as you start hiring.
                Post your first job opening to get started.
              </p>
              <Link
                href="/admin/company/drives"
                className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors shadow-subtle"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Post a Job Opening</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Stat cards — real, from HiringReportService */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Open Job Openings</span>
                    <Briefcase className="w-4 h-4 text-teal-500" />
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                      {companyDrives.filter((d) => d.status === "published").length}
                    </div>
                    <div className="text-xs text-text-muted mt-1">Currently accepting candidates</div>
                  </div>
                </div>

                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Active Pipeline</span>
                    <Users2 className="w-4 h-4 text-accent-secondary" />
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                      {companyReportsData?.hiring.funnel.total_candidates ?? 0}
                    </div>
                    <div className="text-xs text-text-muted mt-1">Candidates across all openings</div>
                  </div>
                </div>

                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Hired</span>
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl sm:text-3xl font-extrabold text-status-success">
                      {companyReportsData?.hiring.funnel.accepted ?? 0}
                    </div>
                    <div className="text-xs text-text-muted mt-1 font-medium">Offers accepted</div>
                  </div>
                </div>

                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Avg. Time to Hire</span>
                    <TrendingUp className="w-4 h-4 text-teal-500" />
                  </div>
                  <div className="mt-4">
                    <div className="text-2xl sm:text-3xl font-extrabold text-primary">
                      {companyReportsData?.hiring.time_to_hire_days !== null && companyReportsData?.hiring.time_to_hire_days !== undefined
                        ? `${companyReportsData.hiring.time_to_hire_days}d`
                        : "—"}
                    </div>
                    <div className="text-xs text-text-muted mt-1">From pipeline entry to offer</div>
                  </div>
                </div>
              </div>

              {/* Funnel + action items */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
                      <Filter className="w-4 h-4 text-teal-500" />
                      <span>Hiring Funnel</span>
                    </h3>
                    <Link href="/admin/company/reports" className="text-2xs font-semibold text-teal-500 hover:underline flex items-center gap-1">
                      <span>Full reports</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
                    {([
                      ["Registered", companyReportsData?.hiring.funnel.registered ?? 0],
                      ["Shortlisted", companyReportsData?.hiring.funnel.shortlisted ?? 0],
                      ["Interviewed", companyReportsData?.hiring.funnel.interviewed ?? 0],
                      ["Offered", companyReportsData?.hiring.funnel.offered ?? 0],
                      ["Accepted", companyReportsData?.hiring.funnel.accepted ?? 0],
                    ] as [string, number][]).map(([label, value]) => (
                      <div key={label} className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                        <div className="text-base font-black text-primary font-mono">{value}</div>
                        <div className="text-3xs text-text-muted uppercase tracking-wider mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-sm text-primary flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-status-warning" />
                      <span>Needs Your Attention</span>
                    </h3>
                    <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger border border-status-danger/25">
                      {companyReportsData?.hiring.action_items.length ?? 0}
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                    {(companyReportsData?.hiring.action_items.length ?? 0) === 0 ? (
                      <p className="text-2xs text-text-muted text-center py-4">Nothing needs your attention right now.</p>
                    ) : (
                      companyReportsData!.hiring.action_items.map((item, i) => (
                        <div key={i} className="p-3 rounded-control border text-xs space-y-1.5 bg-elevated/60 border-border-subtle">
                          <p className="text-text-secondary leading-relaxed">{item.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Job openings + recent hires */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-primary flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-teal-500" />
                      <span>Job Openings</span>
                    </h2>
                    <Link href="/admin/company/drives" className="text-2xs font-semibold text-teal-500 hover:underline flex items-center gap-1">
                      <span>Manage all</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {companyDrives.slice(0, 3).map((d) => (
                      <div key={d.id} className="p-4 rounded-panel bg-surface border border-border-subtle hover:border-border-strong transition-all shadow-subtle space-y-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-primary">{d.title}</h3>
                          <span className="text-3xs text-text-muted">{d.applications_count} candidates</span>
                        </div>
                        <div className="text-2xs text-text-muted">{d.role_title}</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-primary flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-status-success" />
                      <span>Recent Hires</span>
                    </h2>
                    <Link href="/admin/company/reports" className="text-2xs font-semibold text-teal-500 hover:underline flex items-center gap-1">
                      <span>View reports</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {(companyReportsData?.hiring.recent_hires.length ?? 0) === 0 ? (
                    <div className="p-6 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                      No offers accepted yet.
                    </div>
                  ) : (
                    <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle divide-y divide-border-subtle overflow-hidden">
                      {companyReportsData!.hiring.recent_hires.slice(0, 5).map((h, i) => (
                        <div key={i} className="p-3.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-primary truncate">{h.candidate_name}</div>
                            <div className="text-3xs text-text-muted truncate">
                              {h.opening} · {h.role_title}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-bold text-status-success">{h.ctc_offered} LPA</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </motion.div>
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
