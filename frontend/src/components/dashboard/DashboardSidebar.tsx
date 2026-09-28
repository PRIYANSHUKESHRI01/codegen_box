"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ShieldAlert,
  Building2,
  Users2,
  Activity,
  FileCode2,
  CheckCircle2,
  GraduationCap,
  Briefcase,
  LogOut,
  Swords,
  ChevronDown,
  Cpu,
  BarChart3,
  Sliders,
  Crown,
  Terminal,
  Settings,
  BookOpen,
  LineChart,
  Megaphone,
  UserSearch,
  UserCog,
  Mic,
  Newspaper,
  Award,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { getRatingTier } from "@/lib/rating";
import { useMyStats } from "@/lib/useMyStats";
import type { MySubscriptionResponse, SubscriptionCoverage } from "@/types/subscription";
import { useAdminOverviewCounts } from "@/lib/useAdminOverviewCounts";
import { LogoBadge, Wordmark } from "@/components/brand/Logo";
import { LogoutConfirmModal } from "@/components/dashboard/LogoutConfirmModal";

export type DashboardRole = "superadmin" | "admin_internal" | "admin_tpo" | "admin_marketing" | "user" | "section_coordinator" | "admin_company";

interface NavItem {
  label: string;
  href: string;
  icon: any;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

interface DashboardSidebarProps {
  currentRole: DashboardRole;
  currentTpoView?: "mellow" | "tpo";
  onSwitchTpoView?: (view: "mellow" | "tpo") => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DashboardSidebar({
  currentRole,
  currentTpoView = "mellow",
  onSwitchTpoView,
  mobileOpen = false,
  onCloseMobile,
  collapsed: controlledCollapsed,
  onToggleCollapse,
}: DashboardSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  // While collapsed, hovering the rail temporarily reveals full labels —
  // a floating "peek" over the content (the content's own left padding
  // stays keyed to `collapsed`, so it never reflows just from a hover).
  // Moving the pointer away snaps it back to icon-only, after a short
  // delay so briefly crossing the edge doesn't flicker it open and shut.
  const [hoverPeek, setHoverPeek] = useState(false);
  const expanded = !collapsed || hoverPeek;
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRailMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (collapsed) setHoverPeek(true);
  };

  const handleRailMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => setHoverPeek(false), 200);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  // The actually signed-in account (from the verified session), not a
  // switchable persona. Declared this early (rather than down by the
  // identity-card/footer code that reads it) so getNavSections() below can
  // also see it — a superadmin visiting a page shaped for another role
  // (e.g. /admin's Mellow Ops console, where `currentRole` is deliberately
  // "admin_internal" so the page's content matches) must still get their
  // OWN full nav, not the narrower admin_internal-only section list, or
  // they'd lose the sidebar's way back to their other superadmin sections
  // while browsing.
  const storedUser = getStoredUser();

  const { stats: myStats } = useMyStats(currentRole === "user");

  // Plan shown in the footer, ChatGPT-style ("<plan> · Upgrade" under the
  // name instead of the email). A student sees their own personal plan with
  // a self-serve Upgrade link; a TPO sees their college's plan, read-only
  // (coverage.source === "institution" hides the Upgrade link below — same
  // "only Mellow staff can change it" rule as Settings' Billing tab). No
  // other role has a plan concept at all, so this never fetches for them.
  const [coverage, setCoverage] = useState<SubscriptionCoverage | null>(null);
  useEffect(() => {
    if (currentRole !== "user" && currentRole !== "admin_tpo") return;
    let cancelled = false;
    api
      .get<MySubscriptionResponse>("/me/subscription")
      .then((res) => {
        if (!cancelled) setCoverage(res.coverage);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentRole]);

  // Real segment counts for Mellow Ops nav badges (Partner Colleges/Problem
  // Bank) — same source of truth as the tabs they link to, via
  // AdminController::overview(). Never fetched for any other role. Called
  // here (not lower in the component) so getNavSections(), which reads
  // `adminOverview`, is invoked after this hook has actually run.
  const { overview: adminOverview } = useAdminOverviewCounts(
    currentRole === "admin_internal" || currentRole === "superadmin"
  );

  // Query-string changes made via next/navigation (Link clicks,
  // router.push/replace — how every ?tab=/?status= sidebar item navigates)
  // never fire "popstate", so a window.location-based listener for this
  // goes stale the instant a soft client-side navigation happens; that
  // used to leave every query-based item highlighted "active" at once.
  // useSearchParams() re-renders correctly on those navigations instead.
  const searchParams = useSearchParams();
  const currentSearch = searchParams?.toString() ?? "";

  // Hash changes are still native browser events (real anchor clicks),
  // so this tracking is correct as-is for the remaining #-based items.
  const [currentHash, setCurrentHash] = useState("");

  useEffect(() => {
    const updateHash = () => {
      if (typeof window !== "undefined") setCurrentHash(window.location.hash || "");
    };
    updateHash();
    window.addEventListener("hashchange", updateHash);
    window.addEventListener("popstate", updateHash);
    return () => {
      window.removeEventListener("hashchange", updateHash);
      window.removeEventListener("popstate", updateHash);
    };
  }, []);

  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const handleSignOut = () => {
    setConfirmingLogout(false);
    api.post("/logout").catch(() => {});
    logout();
    router.push("/login");
  };

  // Determine if a specific navigation item is active
  const isItemActive = (href: string) => {
    const [pathAndQuery, itemHashPart] = href.split("#");
    const [itemPath, itemQueryPart] = pathAndQuery.split("?");
    const itemHash = itemHashPart ? `#${itemHashPart}` : "";
    const itemQuery = itemQueryPart ? `?${itemQueryPart}` : "";

    // 1. Pathname check
    if (pathname !== itemPath) return false;

    // 2. Query parameter check (e.g. view=mellow vs view=tpo)
    if (itemQuery && currentSearch && !currentSearch.includes(itemQueryPart)) {
      return false;
    }

    // 3. Anchor hash check
    if (itemHash) {
      return currentHash === itemHash;
    }

    // 4. Default root of current page is active only when no hash is present
    return !currentHash || currentHash === "#";
  };

  // Define navigation links dynamically based on role
  const getNavSections = (): NavSection[] => {
    // Shared by admin_internal and superadmin below — a superadmin is a
    // trust tier above admin_internal (see User::canManageColleges()) and
    // the backend already lets superadmin call every one of these routes
    // (role:admin_internal,superadmin — see routes/api.php), so the nav
    // must offer the same links, not just the API. Defined once so the two
    // branches can never drift out of sync with each other.
    const mellowOpsSections: NavSection[] = [
      {
        title: "Mellow Ops",
        items: [
          { label: "Overview", href: "/admin?view=mellow&tab=overview", icon: LayoutDashboard },
          {
            label: "Partner Colleges & TPOs",
            href: "/admin?view=mellow&tab=colleges",
            icon: Building2,
            badge: adminOverview ? `${adminOverview.segments.colleges}` : undefined,
            badgeColor: "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30",
          },
          {
            label: "Platform Users",
            href: "/admin?view=mellow&tab=users",
            icon: Users2,
            badge: adminOverview ? `${adminOverview.segments.platform_users}` : undefined,
            badgeColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
          },
          {
            label: "Problem Bank",
            href: "/admin?view=mellow&tab=problems",
            icon: FileCode2,
            badge: adminOverview ? `${adminOverview.segments.problems}` : undefined,
            badgeColor: "bg-accent-primary/15 text-accent-primary border-accent-primary/30",
          },
          {
            label: "Placement Drives",
            href: "/admin/placements",
            icon: Briefcase,
            badge: adminOverview ? `${adminOverview.segments.placement_drives}` : undefined,
            badgeColor: "bg-accent-primary/15 text-accent-primary border-accent-primary/30",
          },
          {
            label: "Contests",
            href: "/admin/contests",
            icon: Swords,
            badge: adminOverview ? `${adminOverview.segments.contests}` : undefined,
            badgeColor: "bg-accent-primary/15 text-accent-primary border-accent-primary/30",
          },
          {
            label: "AI Interviews",
            href: "/admin/interviews",
            icon: Mic,
            badge: adminOverview ? `${adminOverview.segments.interviews}` : undefined,
            badgeColor: "bg-accent-primary/15 text-accent-primary border-accent-primary/30",
          },
          {
            label: "Articles",
            href: "/admin/articles",
            icon: Newspaper,
            badge: adminOverview ? `${adminOverview.segments.articles}` : undefined,
            badgeColor: "bg-accent-primary/15 text-accent-primary border-accent-primary/30",
          },
          {
            label: "Talent Pool",
            href: "/admin/talent-pool",
            icon: Award,
            badge: "New",
            badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
          },
        ],
      },
      {
        title: "Customer Success",
        items: [
          {
            label: "My Customers",
            href: "/admin/customers",
            icon: UserSearch,
            badge: "Converted",
            badgeColor: "bg-status-success/15 text-status-success border-status-success/30",
          },
        ],
      },
    ];

    // storedUser?.role, not currentRole: a superadmin browsing a page
    // shaped for another role (e.g. /admin's Mellow Ops console, where
    // currentRole is deliberately "admin_internal" so that page's own
    // content/tabs render correctly) must still get their full nav here —
    // otherwise the sidebar "shrinks" to just the admin_internal-only
    // section list and they lose their way back to Students/Leads/Audit/etc
    // without typing a URL. Checked before the admin_internal branch below
    // for the same reason the identity-card override above is.
    if (currentRole === "superadmin" || storedUser?.role === "superadmin") {
      // One item per real tab on the (client-side tab-shell) superadmin
      // page — matches ?tab= exactly as superadmin/page.tsx reads it,
      // same query-param convention the admin_marketing section below
      // already uses for /marketing?status=. Judge Infrastructure and
      // Feature Flags are one merged "Infrastructure & Flags" tab now, and
      // "Users & Roles" is three real tabs (Students/Leads/Mellow Staff),
      // not one — every link here must land somewhere real.
      //
      // Below that, superadmin also gets the Mellow Ops toolset — but with
      // "Overview" and "Partner Colleges & TPOs" dropped: those are near-
      // duplicates of "Overview & KPI" and "Partner Universities" above
      // (different components — admin/mellow/{OpsOverviewPanel,
      // PartnerCollegesPanel} vs admin/superadmin/{OverviewPanel,
      // CollegesPanel} — but the same ground from a nav's perspective).
      // Including both made the sidebar read as two dashboards stapled
      // together, which is exactly what was reported as a bug. What's left
      // (Problem Bank, Placement Drives, Contests, AI Interviews, Articles,
      // Talent Pool, Platform Users, Customer Success) has no superadmin-
      // console equivalent at all, so it stays reachable, clearly labeled
      // as a distinct toolset rather than folded into Executive/Governance.
      const mellowOpsExtrasForSuperadmin = mellowOpsSections.map((section) =>
        section.title === "Mellow Ops"
          ? {
              ...section,
              items: section.items.filter(
                (item) => item.label !== "Overview" && item.label !== "Partner Colleges & TPOs"
              ),
            }
          : section
      );

      return [
        {
          title: "Executive",
          items: [
            { label: "Overview & KPI", href: "/superadmin?tab=overview", icon: LayoutDashboard },
            { label: "Partner Universities", href: "/superadmin?tab=colleges", icon: Building2 },
          ],
        },
        {
          title: "Governance",
          items: [
            { label: "Students", href: "/superadmin?tab=students", icon: GraduationCap },
            { label: "Leads", href: "/superadmin?tab=leads", icon: UserSearch },
            { label: "Marketing Performance", href: "/superadmin?tab=marketing", icon: Megaphone },
            { label: "Mellow Staff", href: "/superadmin?tab=staff", icon: Users2 },
            {
              label: "Audit & Security",
              href: "/superadmin?tab=audit",
              icon: ShieldAlert,
              badge: "Live",
              badgeColor: "bg-status-warning/15 text-status-warning border-status-warning/30",
            },
            {
              label: "Infrastructure & Flags",
              href: "/superadmin?tab=infrastructure",
              icon: Cpu,
              badge: "99.99%",
              badgeColor: "bg-status-success/15 text-status-success border-status-success/30",
            },
          ],
        },
        ...mellowOpsExtrasForSuperadmin,
      ];
    }

    if (
      currentRole === "admin_internal" ||
      (currentRole === "admin_tpo" && currentTpoView === "mellow")
    ) {
      return mellowOpsSections;
    }

    if (currentRole === "admin_tpo" || currentTpoView === "tpo") {
      return [
        {
          title: "Placement Hub",
          items: [
            { label: "TPO Command Center", href: "/admin", icon: LayoutDashboard },
            {
              label: "Campus Drives",
              href: "/admin/drives",
              icon: Briefcase,
            },
            {
              label: "Student Cohort",
              href: "/admin/students",
              icon: GraduationCap,
              badge: "1,450",
              badgeColor: "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30",
            },
            {
              label: "Section Coordinators",
              href: "/admin/coordinators",
              icon: UserCog,
            },
            {
              label: "Mock Contests",
              href: "/admin/mock-contests",
              icon: Swords,
            },
            {
              label: "Mock Interviews",
              href: "/admin/mock-interviews",
              icon: Mic,
            },
          ],
        },
        {
          title: "Intelligence",
          items: [
            { label: "Readiness Analytics", href: "/admin/analytics", icon: BarChart3 },
            { label: "Placement Reports", href: "/admin/reports", icon: CheckCircle2 },
            { label: "Proctoring", href: "/admin/proctoring", icon: ShieldAlert },
          ],
        },
      ];
    }

    if (currentRole === "admin_company") {
      // A company hiring tenant's own dashboard — reuses the exact same
      // shell/pattern as the TPO's "Placement Hub" above, minus anything
      // section-shaped (no Section Coordinators-equivalent item exists here
      // at all — a company has no sections to coordinate).
      return [
        {
          title: "Hiring Hub",
          items: [
            { label: "Hiring Command Center", href: "/admin", icon: LayoutDashboard },
            { label: "Partner Colleges", href: "/admin/company/colleges", icon: GraduationCap },
            { label: "Job Openings", href: "/admin/company/drives", icon: Briefcase },
            { label: "Candidates", href: "/admin/company/candidates", icon: Users2 },
            { label: "Assessments", href: "/admin/company/assessments", icon: Swords },
            { label: "AI Interviews", href: "/admin/company/interviews", icon: Mic },
            {
              label: "Talent Pool",
              href: "/admin/company/talent-pool",
              icon: Award,
              badge: "New",
              badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
            },
          ],
        },
        {
          title: "Intelligence",
          items: [
            { label: "Hiring Reports", href: "/admin/company/reports", icon: CheckCircle2 },
            { label: "Proctoring", href: "/admin/company/proctoring", icon: ShieldAlert },
          ],
        },
      ];
    }

    if (currentRole === "section_coordinator") {
      return [
        {
          title: "My Section",
          items: [
            { label: "Section Roster", href: "/coordinator", icon: Users2 },
            { label: "Section Reports", href: "/coordinator/reports", icon: CheckCircle2 },
            { label: "Proctoring", href: "/coordinator/proctoring", icon: ShieldAlert },
          ],
        },
      ];
    }

    if (currentRole === "admin_marketing") {
      return [
        {
          title: "Lead Management",
          items: [
            { label: "All Leads", href: "/marketing", icon: LayoutDashboard },
            { label: "New Leads", href: "/marketing?status=new", icon: UserSearch },
            { label: "Converted", href: "/marketing?status=converted", icon: CheckCircle2 },
            { label: "Inquiries", href: "/marketing/inquiries", icon: Inbox },
          ],
        },
      ];
    }

    // Default: User / Student
    return [
      {
        title: "Your Arena",
        items: [
          { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
          {
            label: "Practice Arena",
            href: "/dashboard/practice",
            icon: BookOpen,
          },
          {
            label: "Performance Report",
            href: "/dashboard/reports",
            icon: LineChart,
            badge: "New",
            badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
          },
          {
            label: "Articles",
            href: "/dashboard/articles",
            icon: Newspaper,
          },
        ],
      },
      {
        title: "Competition",
        items: [
          {
            label: "Upcoming & Drives",
            href: "/dashboard#placement-drives",
            icon: Briefcase,
          },
          { label: "Contests", href: "/dashboard/contests", icon: Swords },
          {
            label: "AI Interviews",
            href: "/dashboard/interviews",
            icon: Mic,
            badge: "New",
            badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
          },
          {
            label: "Talent Pool",
            href: "/dashboard/talent-pool",
            icon: Award,
            badge: "New",
            badgeColor: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
          },
          { label: "Submissions", href: "/dashboard#submissions", icon: Activity },
          { label: "Global Leaderboard", href: "/dashboard/leaderboard", icon: Swords },
        ],
      },
    ];
  };

  // Every role gets the same account section — profile settings live at one
  // shared route rather than being duplicated per dashboard.
  const navSections: NavSection[] = [
    ...getNavSections(),
    {
      title: "Account",
      items: [{ label: "Profile Settings", href: "/settings", icon: Settings }],
    },
  ];

  const roleMeta = {
    superadmin: {
      label: "Super Admin",
      badge: "Master Access",
      icon: Crown,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-500/15 border-amber-500/30",
      activeBadge: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      name: "Aryan Varma",
      email: "aryan@mellow.ai",
      subtext: "Master Console",
    },
    admin_internal: {
      label: "Mellow Staff",
      badge: "Platform Ops",
      icon: Sliders,
      iconColor: "text-indigo-400",
      iconBg: "bg-indigo-500/15 border-indigo-500/30",
      activeBadge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      name: "Priya Sundaram",
      email: "priya@mellow.ai",
      subtext: "Platform Ops",
    },
    admin_tpo: {
      label: "College TPO",
      badge: "Apex Inst.",
      icon: GraduationCap,
      iconColor: "text-cyan-400",
      iconBg: "bg-cyan-500/15 border-cyan-500/30",
      activeBadge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      name: "Dr. Rajeshwar Sharma",
      email: "tpo@apex.edu.in",
      subtext: "Placement Hub",
    },
    admin_marketing: {
      label: "Mellow Marketing",
      badge: "Lead Growth",
      icon: Megaphone,
      iconColor: "text-rose-400",
      iconBg: "bg-rose-500/15 border-rose-500/30",
      activeBadge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      name: "Marketing Team",
      email: "marketing@mellow.ai",
      subtext: "Lead Management",
    },
    user: {
      label: "Student Coder",
      badge: "Candidate Master",
      icon: Terminal,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/15 border-emerald-500/30",
      activeBadge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      name: "Alex Chen",
      email: "alex_coder",
      subtext: "Student Arena",
    },
    section_coordinator: {
      label: "Section Coordinator",
      badge: "Section Lead",
      icon: UserCog,
      iconColor: "text-sky-400",
      iconBg: "bg-sky-500/15 border-sky-500/30",
      activeBadge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      name: "Section Coordinator",
      email: "coordinator@apex.edu.in",
      subtext: "Section Roster",
    },
    admin_company: {
      label: "Hiring Partner",
      badge: "Hiring Tenant",
      icon: Briefcase,
      iconColor: "text-teal-400",
      iconBg: "bg-teal-500/15 border-teal-500/30",
      activeBadge: "bg-teal-500/10 text-teal-400 border-teal-500/20",
      name: "Hiring Team",
      email: "hiring@company.example",
      subtext: "Hiring Hub",
    },
  };

  // (storedUser is declared near the top of the component — see that
  // comment for why.) A superadmin visiting a page shaped for another role
  // must still see their OWN identity here, not a "Mellow Staff" badge —
  // checked before the admin_internal/TPO-view branches below (which exist
  // for the same "content role ≠ identity role" reason, just for TPO
  // pages), so it wins regardless of what `currentRole` says.
  const currentRoleInfo =
    storedUser?.role === "superadmin"
      ? roleMeta.superadmin
      : currentRole === "admin_internal" || (currentRole === "admin_tpo" && currentTpoView === "mellow")
      ? roleMeta.admin_internal
      : currentRole === "admin_tpo"
      ? roleMeta.admin_tpo
      : roleMeta[currentRole];

  const RoleIcon = currentRoleInfo.icon;
  const displayName = storedUser?.name ?? currentRoleInfo.name;
  const displayEmail = storedUser?.email ?? currentRoleInfo.email;
  const isRatedStudent = (myStats?.rating.rated_contests_count ?? 0) > 0;
  const studentTier = isRatedStudent ? getRatingTier(myStats!.rating.current_rating) : null;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-surface border-r border-border-subtle relative select-none">
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-border-subtle flex items-center justify-between gap-2.5 h-16 flex-shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 overflow-hidden group focus-visible:outline-none min-w-0"
        >
          {/* Bespoke Production Brand Emblem */}
          <LogoBadge className="w-9 h-9 transition-all duration-200 group-hover:drop-shadow-[0_0_10px_rgba(99,102,241,0.4)]" />

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col min-w-0 whitespace-nowrap"
              >
                <div className="flex items-center gap-1.5">
                  <Wordmark className="font-extrabold text-base tracking-tight text-primary leading-none truncate" />
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded uppercase bg-accent-primary/10 text-accent-primary border border-accent-primary/25 tracking-wider">
                    PRO
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-text-muted tracking-wider uppercase mt-1 truncate">
                  {currentRoleInfo.subtext}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>

        {/* Desktop Collapse Toggle */}
        <button
          onClick={toggleCollapse}
          className="hidden lg:flex w-7 h-7 rounded-control border border-border-subtle hover:border-border-strong bg-surface hover:bg-surface-hover text-text-muted hover:text-primary items-center justify-center transition-all flex-shrink-0 shadow-subtle"
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Signed-in Account (read-only — no persona/role switching) */}
      <div className="p-3 border-b border-border-subtle flex-shrink-0">
        <div className="w-full flex items-center gap-2.5 p-2 rounded-control border border-border-subtle bg-surface-hover/40 shadow-subtle">
          <div
            className={cn(
              "w-7 h-7 rounded-control border flex items-center justify-center flex-shrink-0 shadow-subtle",
              currentRoleInfo.iconBg
            )}
          >
            <RoleIcon className={cn("w-3.5 h-3.5", currentRoleInfo.iconColor)} strokeWidth={2.2} />
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0 whitespace-nowrap"
              >
                <span className="text-xs font-semibold text-primary truncate block leading-tight">
                  {displayName}
                </span>
                {currentRole === "user" && myStats ? (
                  <span className="flex items-center gap-1.5 mt-0.5 text-[10px] font-medium">
                    {studentTier ? (
                      <>
                        <span className={cn("font-black", studentTier.text)}>{studentTier.label}</span>
                        <span className="text-text-muted font-mono">{myStats.rating.current_rating}</span>
                        <span className="text-text-muted">· Div {studentTier.division}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-text-muted font-mono">{myStats.rating.solved_score} pts</span>
                        <span className="text-text-muted">· Unrated</span>
                      </>
                    )}
                  </span>
                ) : currentRole !== "user" ? (
                  <span className="text-[10px] text-text-muted font-medium truncate block mt-0.5">
                    {currentRoleInfo.label}
                  </span>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {navSections.map((section, idx) => (
          <div key={idx} className="space-y-1">
            {expanded && section.title && (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted/75">
                {section.title}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href);

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => {
                    if (item.href.includes("#")) {
                      setCurrentHash("#" + item.href.split("#")[1]);
                    } else {
                      setCurrentHash("");
                    }
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-2 rounded-control text-xs font-medium transition-all group relative",
                    active
                      ? "bg-accent-primary/10 text-accent-primary font-semibold shadow-subtle border border-accent-primary/20"
                      : "text-text-secondary hover:text-primary hover:bg-surface-hover/70"
                  )}
                  title={expanded ? undefined : item.label}
                >
                  {/* High-end active indicator pill */}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-accent-primary shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  )}
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-105",
                      active ? "text-accent-primary" : "text-text-muted group-hover:text-primary"
                    )}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="flex-1 flex items-center justify-between overflow-hidden whitespace-nowrap"
                      >
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              "ml-2 px-2 py-0.5 text-[10px] font-bold rounded-full border tracking-wide",
                              item.badgeColor ||
                                "bg-accent-primary/10 text-accent-primary border-accent-primary/20"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Link>
              );
            })}
          </div>
        ))}

      </div>

      {/* Production Profile & Sign Out Footer (Theme selector removed per user instructions) */}
      <div className="p-3 border-t border-border-subtle bg-surface/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <AnimatePresence mode="wait" initial={false}>
          {expanded ? (
            <motion.div
              key="footer-expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="flex items-center justify-between gap-2 w-full"
            >
              {/* User Profile Information */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary/20 via-accent-secondary/15 to-accent-primary/10 border border-accent-primary/30 flex items-center justify-center text-xs font-bold text-accent-primary shadow-subtle">
                    {displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-status-success ring-2 ring-surface" />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-semibold text-primary truncate leading-tight">
                    {displayName}
                  </span>
                  {currentRole === "user" || currentRole === "admin_tpo" ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-text-muted truncate">
                        {coverage === null ? "..." : coverage.plan?.name ? `${coverage.plan.name} Plan` : "No active plan"}
                      </span>
                      {coverage?.source === "individual" && (
                        <Link
                          href="/dashboard/billing"
                          className="text-[10px] font-bold text-accent-primary hover:underline shrink-0"
                        >
                          Upgrade
                        </Link>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-text-muted truncate mt-0.5">
                      {displayEmail}
                    </span>
                  )}
                </div>
              </div>

              {/* Sign Out Action */}
              <button
                onClick={() => setConfirmingLogout(true)}
                className="p-1.5 rounded-control text-text-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors flex-shrink-0"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="footer-collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="relative mx-auto flex flex-col items-center gap-2"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-primary/20 via-accent-secondary/15 to-accent-primary/10 border border-accent-primary/30 flex items-center justify-center text-xs font-bold text-accent-primary shadow-subtle">
                  {displayName.charAt(0)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-status-success ring-2 ring-surface" />
              </div>
              <button
                onClick={() => setConfirmingLogout(true)}
                className="p-1.5 rounded-control text-text-muted hover:text-status-danger hover:bg-status-danger/10 transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar — while collapsed, hovering it "peeks"
          open over the content (see `expanded` above) without shifting the
          page layout, since the content's own padding stays keyed to the
          real `collapsed` value below in DashboardShell. A spring — not a
          linear tween — is what actually reads as "smooth" here. */}
      <motion.aside
        onMouseEnter={handleRailMouseEnter}
        onMouseLeave={handleRailMouseLeave}
        animate={{
          // Widened from 256 -> 280 so the full "CodeGen Box" wordmark + PRO
          // badge fit on one line without truncating (CodeForge, at 9
          // characters, fit at 256; CodeGen Box needs the extra room).
          width: expanded ? 280 : 80,
          boxShadow:
            collapsed && hoverPeek
              ? "0 25px 50px -12px rgba(0,0,0,0.35)"
              : "0 0px 0px 0 rgba(0,0,0,0)",
        }}
        transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.7 }}
        className="hidden md:block fixed inset-y-0 left-0 z-30 overflow-hidden"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            {/* Slide-over Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <LogoutConfirmModal
        open={confirmingLogout}
        onCancel={() => setConfirmingLogout(false)}
        onConfirm={handleSignOut}
      />
    </>
  );
}
