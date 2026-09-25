"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, GraduationCap, UserSearch, Building2, Users2, Cpu, ShieldAlert, Megaphone } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { cn } from "@/lib/utils";
import { OverviewPanel } from "@/components/admin/superadmin/OverviewPanel";
import { StudentsPanel } from "@/components/admin/superadmin/StudentsPanel";
import { LeadsPanel } from "@/components/admin/superadmin/LeadsPanel";
import { MarketingPerformancePanel } from "@/components/admin/superadmin/MarketingPerformancePanel";
import { CollegesPanel } from "@/components/admin/superadmin/CollegesPanel";
import { MellowStaffPanel } from "@/components/admin/superadmin/MellowStaffPanel";
import { InfrastructurePanel } from "@/components/admin/superadmin/InfrastructurePanel";
import { AuditLogPanel } from "@/components/admin/superadmin/AuditLogPanel";

type Tab = "overview" | "students" | "leads" | "marketing" | "colleges" | "staff" | "infrastructure" | "audit";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "students", label: "Students", icon: GraduationCap },
  { id: "leads", label: "Leads", icon: UserSearch },
  { id: "marketing", label: "Marketing Performance", icon: Megaphone },
  { id: "colleges", label: "Colleges & TPOs", icon: Building2 },
  { id: "staff", label: "Mellow Staff", icon: Users2 },
  { id: "infrastructure", label: "Infrastructure & Flags", icon: Cpu },
  { id: "audit", label: "Audit Log", icon: ShieldAlert },
];

const TAB_IDS = TABS.map((t) => t.id);

function isTab(value: string | null): value is Tab {
  return value !== null && (TAB_IDS as string[]).includes(value);
}

/**
 * Every account type used to share one flat table on this page — this is
 * now a segmented tab shell (mirrors admin/placements/page.tsx's TABS
 * convention) so Students/Leads/Colleges/Staff each get purpose-built
 * columns and actions instead of one column set trying to fit everyone.
 * Each tab owns its own data fetch and its own action button; nothing here
 * is fabricated — see each panel for where its numbers come from.
 */
function SuperAdminPageContent() {
  const { user: me, status } = useAuthGuard(["superadmin"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") ?? null;
  const [activeTab, setActiveTab] = useState<Tab>(isTab(tabParam) ? tabParam : "overview");

  // Sidebar links (DashboardSidebar's superadmin section) point at
  // /superadmin?tab=... — without this, clicking any of them just landed
  // back on this same client-side tab-shell with activeTab stuck at its
  // useState default ("overview"), since nothing here ever read the URL.
  const goToTab = (tab: Tab) => {
    setActiveTab(tab);
    router.replace(`/superadmin?tab=${tab}`, { scroll: false });
  };

  // The sidebar's links (and browser back/forward) change the URL without
  // remounting this component, so useState's initial value alone won't
  // catch them — this keeps activeTab in sync whenever ?tab= changes out
  // from under us.
  useEffect(() => {
    if (isTab(tabParam) && tabParam !== activeTab) setActiveTab(tabParam);
  }, [tabParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // A bare /superadmin visit (no ?tab= at all) has no real query for the
  // sidebar's isItemActive() to compare against, which otherwise highlights
  // every item as "active" at once — canonicalize to the real default tab
  // immediately so there's always something concrete in the URL.
  useEffect(() => {
    if (!isTab(tabParam)) router.replace("/superadmin?tab=overview", { scroll: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  if (status !== "ready" || !me) {
    return (
      <SessionLoader />
    );
  }

  return (
    <DashboardShell
      role="superadmin"
      title="Superadmin Master Control"
      subtitle="Complete bird's-eye management of users, partner universities, infrastructure, and security."
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit flex-wrap">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => goToTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-control text-[11px] font-bold transition-all whitespace-nowrap",
                activeTab === tab.id ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && <OverviewPanel onViewAuditLog={() => goToTab("audit")} />}
      {activeTab === "students" && <StudentsPanel triggerToast={triggerToast} />}
      {activeTab === "leads" && <LeadsPanel triggerToast={triggerToast} />}
      {activeTab === "marketing" && <MarketingPerformancePanel />}
      {activeTab === "colleges" && <CollegesPanel triggerToast={triggerToast} />}
      {activeTab === "staff" && <MellowStaffPanel meId={me.id} triggerToast={triggerToast} />}
      {activeTab === "infrastructure" && <InfrastructurePanel triggerToast={triggerToast} />}
      {activeTab === "audit" && <AuditLogPanel />}
    </DashboardShell>
  );
}

/**
 * useSearchParams() forces this whole tree to opt out of static
 * prerendering unless wrapped in Suspense — without this, `next build`
 * fails outright on this route (not just a dev warning). Same fix as
 * admin/page.tsx's AdminPage/AdminPageContent split.
 */
export default function SuperAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-xs text-text-muted">
          Loading Super Admin Console...
        </div>
      }
    >
      <SuperAdminPageContent />
    </Suspense>
  );
}
