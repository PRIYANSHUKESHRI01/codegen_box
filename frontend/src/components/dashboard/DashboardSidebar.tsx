"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
  Sparkles,
  Brain,
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

/**
 * Rail geometry, in px.
 *
 * Mirrored by the `rail` / `rail-collapsed` spacing tokens in
 * tailwind.config.ts, which DashboardShell consumes as `md:pl-rail` /
 * `md:pl-rail-collapsed` for the content offset and the SSR placeholder.
 * Change these and those together — they had already drifted: the panel
 * animated to 280px while the content was offset by `pl-64` (256px), so the
 * rail sat on top of the first 24px of every dashboard page's content column.
 */
const RAIL_WIDTH = 280;
const RAIL_COLLAPSED_WIDTH = 80;

export type DashboardRole = "superadmin" | "admin_internal" | "admin_tpo" | "admin_marketing" | "user" | "section_coordinator" | "admin_company";

/**
 * Semantic meaning of a nav badge, not a colour.
 *
 * Every badge used to carry its own hand-written Tailwind colour string,
 * which meant a plain record count ("1,450 students") shouted in saturated
 * cyan with exactly the same urgency as a real alert ("Live"). On a nav rail
 * that inverts the hierarchy — the eye is pulled to the least actionable
 * thing on screen. Counts are now neutral chips and only genuine status
 * earns colour, which is also why the tone is declared at the call site
 * rather than a class list: a new item can't invent a seventh badge style.
 */
type BadgeTone = "count" | "new" | "live" | "ok";

interface NavItem {
  label: string;
  href: string;
  icon: any;
  badge?: string;
  badgeTone?: BadgeTone;
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

  // Bound to focus as well as hover (onFocusCapture/onBlurCapture on the
  // panel). Keyboard users never generate a mouseenter, so a hover-only peek
  // left them tabbing through a column of unlabelled icons with no way to
  // find out what any of them were — the collapsed rail was effectively
  // keyboard-inaccessible.
  const openPeek = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (collapsed) setHoverPeek(true);
  };

  const closePeekSoon = () => {
    closeTimeoutRef.current = setTimeout(() => setHoverPeek(false), 200);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // The rail's width spring is a transform-adjacent layout animation, which
  // is exactly the class of motion the global prefers-reduced-motion rule in
  // globals.css cannot reach — that rule caps CSS transitions, and this one
  // is driven by framer-motion in JS.
  const prefersReducedMotion = useReducedMotion();

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
            badgeTone: "count",
          },
          {
            label: "Platform Users",
            href: "/admin?view=mellow&tab=users",
            icon: Users2,
            badge: adminOverview ? `${adminOverview.segments.platform_users}` : undefined,
            badgeTone: "count",
          },
          {
            label: "Problem Bank",
            href: "/admin?view=mellow&tab=problems",
            icon: FileCode2,
            badge: adminOverview ? `${adminOverview.segments.problems}` : undefined,
            badgeTone: "count",
          },
          {
            label: "Placement Drives",
            href: "/admin/placements",
            icon: Briefcase,
            badge: adminOverview ? `${adminOverview.segments.placement_drives}` : undefined,
            badgeTone: "count",
          },
          {
            label: "Contests",
            href: "/admin/contests",
            icon: Swords,
            badge: adminOverview ? `${adminOverview.segments.contests}` : undefined,
            badgeTone: "count",
          },
          {
            label: "AI Interviews",
            href: "/admin/interviews",
            icon: Mic,
            badge: adminOverview ? `${adminOverview.segments.interviews}` : undefined,
            badgeTone: "count",
          },
          {
            label: "Soft Skills",
            href: "/admin/soft-skills",
            icon: Brain,
            badge: "New",
            badgeTone: "new",
          },
          {
            label: "Articles",
            href: "/admin/articles",
            icon: Newspaper,
            badge: adminOverview ? `${adminOverview.segments.articles}` : undefined,
            badgeTone: "count",
          },
          {
            label: "Talent Pool",
            href: "/admin/talent-pool",
            icon: Award,
            badge: "New",
            badgeTone: "new",
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
            badgeTone: "ok",
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
              badgeTone: "live",
            },
            {
              label: "Infrastructure & Flags",
              href: "/superadmin?tab=infrastructure",
              icon: Cpu,
              badge: "99.99%",
              badgeTone: "ok",
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
              badgeTone: "count",
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
            {
              label: "Soft Skills",
              href: "/admin/mock-soft-skills",
              icon: Brain,
              badge: "New",
              badgeTone: "new",
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
              label: "Soft Skills",
              href: "/admin/company/soft-skills",
              icon: Brain,
              badge: "New",
              badgeTone: "new",
            },
            {
              label: "Talent Pool",
              href: "/admin/company/talent-pool",
              icon: Award,
              badge: "New",
              badgeTone: "new",
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
            badgeTone: "new",
          },
          {
            label: "Learning Centre",
            href: "/dashboard/learning-centre",
            icon: Sparkles,
            badge: "AI",
            badgeTone: "new",
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
            badgeTone: "new",
          },
          {
            label: "Soft Skills",
            href: "/dashboard/soft-skills",
            icon: Brain,
            badge: "New",
            badgeTone: "new",
          },
          {
            label: "Talent Pool",
            href: "/dashboard/talent-pool",
            icon: Award,
            badge: "New",
            badgeTone: "new",
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

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Badge presentation, keyed to the semantic tone declared at each call
  // site. Tuned for the graphite rail specifically rather than reusing the
  // app-wide status-*/accent-* tokens: those flip with the page theme, and
  // several of them (accent-primary is #4F46E5 under html.light) land well
  // under 4.5:1 on the rail's fixed #0E1117 background.
  //
  // The `onActive` variant exists because a neutral white/7% chip sitting on
  // the active row's indigo wash all but disappears — a badge has to survive
  // being on the selected item, which is exactly where it's most likely to
  // be looked at.
  const badgeToneClass: Record<BadgeTone, { idle: string; onActive: string }> = {
    // A count is reference information, not an alert. Neutral chip, and
    // tabular figures so a column of them doesn't visibly jitter in width.
    count: {
      idle: "bg-sidebar-chip text-sidebar-chip-text tabular-nums",
      onActive: "bg-white/[0.14] text-white tabular-nums",
    },
    new: {
      idle: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/25",
      onActive: "bg-emerald-400/20 text-emerald-200 ring-1 ring-inset ring-emerald-300/40",
    },
    ok: {
      idle: "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/25",
      onActive: "bg-emerald-400/20 text-emerald-200 ring-1 ring-inset ring-emerald-300/40",
    },
    live: {
      idle: "bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/25",
      onActive: "bg-amber-400/20 text-amber-200 ring-1 ring-inset ring-amber-300/40",
    },
  };

  // The secondary line under the account name in the footer.
  //
  // The rail used to print the signed-in user TWICE — a bordered identity
  // card directly beneath the brand header AND a profile row in the footer,
  // both leading with the same name. That was ~120px of a finite-height rail
  // spent saying one thing twice, and it's the single biggest reason the old
  // sidebar didn't read as a shipped product. The card is gone; nothing it
  // showed is lost, because both things it carried (the role label, and a
  // student's rating tier) resolve here.
  const accountMeta =
    currentRole === "user" && myStats ? (
      studentTier ? (
        <>
          <span className={cn("font-extrabold", studentTier.text)}>{studentTier.label}</span>
          <span className="font-mono text-sidebar-dim">{myStats.rating.current_rating}</span>
          <span className="text-sidebar-faint">Div {studentTier.division}</span>
        </>
      ) : (
        <>
          <span className="font-mono text-sidebar-dim">{myStats.rating.solved_score} pts</span>
          <span className="text-sidebar-faint">Unrated</span>
        </>
      )
    ) : (
      <span className="text-sidebar-dim">{currentRoleInfo.label}</span>
    );

  const showsPlan = currentRole === "user" || currentRole === "admin_tpo";

  /**
   * One rail, rendered at a caller-chosen width.
   *
   * `isExpanded` is a parameter rather than the closed-over `expanded`
   * because the mobile drawer has no collapsed mode — it is always a full
   * 300px panel. Reading the desktop state in there meant that collapsing
   * the rail on a laptop and then narrowing the window (or opening the
   * drawer on a phone in the same session) produced a 300px-wide drawer
   * showing nothing but a column of unlabelled icons.
   */
  const renderRail = (isExpanded: boolean) => (
    <div className="relative flex h-full flex-col overflow-hidden bg-sidebar select-none">
      {/* A single soft accent wash bled down from the top edge. Keeps a tall
          flat panel from reading as a dead rectangle without resorting to
          per-element gradients or glows on the nav rows themselves. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(99,102,241,0.13),transparent_72%)]"
      />

      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "relative z-10 flex h-16 flex-shrink-0 items-center border-b border-sidebar-border bg-sidebar-raised",
          isExpanded ? "justify-between gap-3 px-4" : "justify-center px-0"
        )}
      >
        <Link
          href="/"
          className="sb-focus group flex min-w-0 items-center gap-2.5 outline-none"
          aria-label="CodeGen Box home"
        >
          <LogoBadge className="h-9 w-9 shrink-0 transition-transform duration-200 group-hover:scale-[1.04]" />

          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="flex min-w-0 flex-col whitespace-nowrap"
              >
                <span className="flex items-center gap-1.5">
                  {/* text-15's own paired line-height (20px, see
                      tailwind.config.ts) — not leading-none. A 1.0 line-box
                      combined with `truncate`'s overflow:hidden was clipping
                      the descender off "Codegen"'s "g"; same fix applied to
                      every other leading-none+truncate label below. */}
                  <Wordmark className="truncate text-15 font-extrabold tracking-tight text-sidebar-strong" />
                  <span className="rounded bg-sidebar-accent-soft px-1.5 py-[3px] text-3xs font-extrabold uppercase leading-none tracking-[0.1em] text-sidebar-accent ring-1 ring-inset ring-[rgba(129,140,248,0.3)]">
                    Pro
                  </span>
                </span>
                {/* The portal context ("Placement Hub", "Master Console"…).
                    Deliberately the quietest thing in the header: it labels
                    the rail, it isn't a destination. */}
                <span className="mt-1.5 truncate text-[9.5px] font-bold uppercase leading-[13px] tracking-[0.14em] text-sidebar-faint">
                  {currentRoleInfo.subtext}
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Rendered only while expanded — at 80px the rail cannot fit a 36px
            mark, a 32px button and their padding, so the old always-on
            toggle was simply clipped away by the panel's overflow. It needs
            no collapsed-state equivalent: pointing at the rail (or tabbing
            into it) peeks it open, which brings this button back with it. */}
        {isExpanded && (
          <button
            onClick={toggleCollapse}
            className="sb-focus hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border bg-white/[0.03] text-sidebar-dim transition-colors hover:border-sidebar-border-strong hover:bg-white/[0.07] hover:text-sidebar-strong md:flex"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav
        aria-label="Dashboard sections"
        className="sb-scroll relative z-10 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4"
      >
        {navSections.map((section, idx) => (
          <div key={section.title ?? idx} className={idx > 0 ? "mt-6" : undefined}>
            {section.title && (
              <>
                {/* Kept in the accessibility tree at every width — collapsing
                    the rail is a visual affordance and must not silently
                    delete the grouping a screen-reader user navigates by. */}
                <h2
                  className={cn(
                    "px-3 pb-2 text-[10.5px] font-bold uppercase leading-none tracking-[0.1em] text-sidebar-faint",
                    !isExpanded && "sr-only"
                  )}
                >
                  {section.title}
                </h2>
                {/* Stands in for the hidden eyebrow so groups stay legible
                    in the icon rail. Skipped above the first group, which
                    already has the brand header's border over it — a rule
                    directly under a rule just looks like a mistake. */}
                {!isExpanded && idx > 0 && (
                  <div aria-hidden className="mx-auto mb-3 h-px w-8 bg-sidebar-border" />
                )}
              </>
            )}

            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);
                const tone = badgeToneClass[item.badgeTone ?? "count"];

                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => {
                        if (item.href.includes("#")) {
                          setCurrentHash("#" + item.href.split("#")[1]);
                        } else {
                          setCurrentHash("");
                        }
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={cn(
                        "sb-focus group relative flex h-[38px] items-center rounded-[10px] outline-none transition-colors duration-150",
                        isExpanded ? "gap-3 px-3" : "justify-center px-0",
                        active
                          ? "bg-sidebar-active text-sidebar-strong"
                          : "text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-strong"
                      )}
                      title={isExpanded ? undefined : item.label}
                    >
                      {/* Selection rule: one 3px bar flush to the rail's inner
                          edge. The cheapest unambiguous "you are here" there
                          is, and the only part of the active treatment that
                          still works in the collapsed rail, where the label
                          and its weight change are both gone. */}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-accent"
                        />
                      )}

                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active ? "text-sidebar-accent" : "text-sidebar-icon group-hover:text-sidebar-strong"
                        )}
                        strokeWidth={active ? 2.3 : 1.9}
                      />

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap"
                          >
                            {/* 13px semibold idle / bold active. The old rail
                                was 12px at weight 500 in a mid grey, which is
                                caption typography — it went soft the moment
                                you sat back from a large monitor.

                                `flex-1 truncate` is load-bearing, not
                                decoration: bold glyphs are wider than
                                semibold ones, so a label sized to its own
                                content would shove the badge sideways every
                                time the active row changed. Owning the free
                                space pins the badge regardless of weight.

                                Line-height is text-13's own paired 18px (see
                                tailwind.config.ts), not leading-none — a 1.0
                                line-box left no room for descenders (g/j/p/
                                q/y), and `truncate`'s overflow:hidden on this
                                same element clipped them clean off ("Job
                                Openings"' "g" being the one that got
                                reported). The row's own height is a fixed
                                h-[38px] with items-center, so this doesn't
                                move anything — it only gives the glyphs the
                                vertical room they always needed. */}
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-13 tracking-[-0.003em]",
                                active ? "font-bold" : "font-semibold"
                              )}
                            >
                              {item.label}
                            </span>

                            {item.badge && (
                              <span
                                className={cn(
                                  "flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-3xs font-bold leading-none",
                                  active ? tone.onActive : tone.idle
                                )}
                              >
                                {item.badgeTone === "live" && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300 motion-safe:animate-pulse-subtle" />
                                )}
                                {item.badge}
                              </span>
                            )}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Account ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-shrink-0 border-t border-sidebar-border bg-sidebar-raised p-3">
        {isExpanded ? (
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#0EA5E9] text-2xs font-black text-white ring-1 ring-inset ring-white/20">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[color:var(--sb-bg-raised)]" />
            </div>

            <div className="min-w-0 flex-1">
              {/* The e-mail moves to the tooltip rather than the second line:
                  at this width a real address truncates to noise, and the
                  role/plan below is what someone actually scans for when
                  checking which account they're operating as. */}
              <p
                className="truncate text-13 font-bold leading-tight text-sidebar-strong"
                title={displayEmail}
              >
                {displayName}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-2xs font-semibold leading-tight">
                {accountMeta}
              </p>
              {showsPlan && (
                <p className="mt-0.5 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-2xs leading-tight text-sidebar-faint">
                  <span className="truncate font-medium">
                    {coverage === null
                      ? "…"
                      : coverage.plan?.name
                      ? `${coverage.plan.name} Plan`
                      : "No active plan"}
                  </span>
                  {coverage?.source === "individual" && (
                    <Link
                      href="/dashboard/billing"
                      className="sb-focus shrink-0 font-bold text-sidebar-accent hover:underline"
                    >
                      Upgrade
                    </Link>
                  )}
                </p>
              )}
            </div>

            <button
              onClick={() => setConfirmingLogout(true)}
              className="sb-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-dim transition-colors hover:bg-red-500/15 hover:text-red-300"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#0EA5E9] text-2xs font-black text-white ring-1 ring-inset ring-white/20">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[color:var(--sb-bg-raised)]" />
            </div>
            <button
              onClick={() => setConfirmingLogout(true)}
              className="sb-focus flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-dim transition-colors hover:bg-red-500/15 hover:text-red-300"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent rail. While collapsed, pointing at it (or tabbing
          into it) "peeks" it open over the content without shifting the page
          layout, since the content's own padding stays keyed to the real
          `collapsed` value in DashboardShell. A spring — not a linear tween —
          is what actually reads as smooth at this width delta. */}
      <motion.aside
        onMouseEnter={openPeek}
        onMouseLeave={closePeekSoon}
        onFocusCapture={openPeek}
        onBlurCapture={closePeekSoon}
        initial={false}
        animate={{ width: expanded ? RAIL_WIDTH : RAIL_COLLAPSED_WIDTH }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 360, damping: 34, mass: 0.7 }
        }
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-sidebar-border transition-shadow duration-200 md:block",
          // Always-on soft edge shadow. Near-invisible against the dark
          // theme's #08090D page, but under html.light it's what stops a
          // near-black rail from looking pasted onto the layout.
          collapsed && hoverPeek
            ? "shadow-[0_24px_60px_-12px_rgba(0,0,0,0.55)]"
            : "shadow-[6px_0_24px_-16px_rgba(2,6,23,0.55)]"
        )}
      >
        {renderRail(expanded)}
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="relative z-10 h-full w-[300px] max-w-[86vw] shadow-[0_0_60px_-10px_rgba(0,0,0,0.8)]"
            >
              {/* Always full-width — a drawer has no icon-only mode. */}
              {renderRail(true)}
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
