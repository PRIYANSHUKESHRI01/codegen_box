"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  Search,
  Bell,
  Shield,
  Briefcase,
  Trophy,
  ChevronRight,
  Terminal,
  Building2,
  Cpu,
  CheckCircle2,
  Settings,
  BookOpen,
  LineChart,
  Megaphone,
} from "lucide-react";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { DashboardRole } from "./DashboardSidebar";

interface DashboardHeaderProps {
  title: string;
  /** Accepted (DashboardShell passes it) but rendered by the page heading, not the bar. */
  subtitle?: string;
  role: DashboardRole;
  /** Accepted for API compatibility; the header no longer varies by TPO view. */
  currentTpoView?: "mellow" | "tpo";
  onOpenMobile?: () => void;
  actionButton?: {
    label: string;
    icon?: any;
    onClick?: () => void;
  };
}

interface NotificationItem {
  id: number;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  category: "Security" | "Drive" | "Infrastructure";
}

export function DashboardHeader({
  title,
  role,
  onOpenMobile,
  actionButton,
}: DashboardHeaderProps) {
  const router = useRouter();
  const { user } = useAuth();

  // No useMyStats() here any more. The header's only consumer of it was the
  // student rating badge, which the sidebar footer now owns — and because
  // useMyStats is a plain per-mount fetch with no cache or dedupe, the header
  // and the sidebar were each firing their own identical GET /me/stats on
  // every student page load. Dropping this halves that.

  // A superadmin visiting a page shaped for another role (e.g. the Mellow
  // Ops console at /admin, where `role` is deliberately "admin_internal" so
  // the page's content/nav matches) must still see their real identity in
  // the header breadcrumb/title/badge below — same bug and same fix as
  // DashboardSidebar's currentRoleInfo. Only used for identity display;
  // `role` itself still drives content-shaping checks (currentTpoView, the
  // useMyStats call above) so the page's actual content is unaffected.
  const identityRole = user?.role === "superadmin" ? "superadmin" : role;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsRead, setNotificationsRead] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // No real notification system exists yet (no backend table, no events) —
  // this used to ship 3 permanently-hardcoded fake alerts to every role,
  // including one about a Plagiarism Radar feature that has since been
  // removed entirely (see AdminController/ProblemBankPanel). Left empty
  // and honest until a real notifications feature is built, rather than
  // fabricating more placeholder content.
  const [notifications] = useState<NotificationItem[]>([]);

  // Which command-palette row Enter will run. Arrow-key navigation, because
  // the palette's own footer has always advertised "↑ ↓ to navigate" while
  // only the mouse actually worked — a keyboard-first affordance (it opens on
  // ⌘K) that couldn't be driven from the keyboard.
  const [activeIndex, setActiveIndex] = useState(0);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  // The shortcut hint is rendered per-platform: this app is mostly used on
  // Windows, where a ⌘ glyph names a key the keyboard doesn't have. Resolved
  // after mount (never during render) so the server and first client render
  // agree; the slot around it is width-reserved so nothing shifts when it
  // resolves.
  const [isMac, setIsMac] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  // Global keyboard shortcut for Command Palette (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
        setNotificationsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Dismiss the notifications popover on an outside click. Escape already
  // closed it, but a popover that survives clicking the page behind it reads
  // as stuck — and this one sits over content people are trying to reach.
  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!notificationsRef.current?.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [notificationsOpen]);

  // Opening the palette, or narrowing the query, always re-aims at the first
  // result — otherwise Enter fires whatever row the previous search left
  // highlighted, which may not even be on screen any more.
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery, commandOpen]);

  const markAllNotificationsRead = () => {
    setNotificationsRead(true);
  };

  const unreadCount = notifications.filter((n) => n.unread).length;

  // The portal this role works inside — the breadcrumb's parent crumb, and a
  // real link back to that portal's root rather than a decorative label.
  //
  // Role first, so a student is never labelled with the Mellow-internal
  // context just because currentTpoView defaults to it. section_coordinator
  // is listed explicitly: it used to fall through to the student default and
  // label a coordinator's console "Developer Arena".
  const portal: { label: string; href: string } = (() => {
    if (identityRole === "superadmin") return { label: "Executive", href: "/superadmin" };
    if (identityRole === "admin_internal") return { label: "Platform Ops", href: "/admin?view=mellow" };
    if (identityRole === "admin_tpo") return { label: "Placement Cell", href: "/admin" };
    if (identityRole === "admin_marketing") return { label: "Lead Growth", href: "/marketing" };
    if (identityRole === "admin_company") return { label: "Hiring Cell", href: "/admin" };
    if (identityRole === "section_coordinator") return { label: "Section Cell", href: "/coordinator" };
    return { label: "Developer Arena", href: "/dashboard" };
  })();

  // A portal's own root gets ONE crumb, not a parent plus a child.
  //
  // Not just tidiness — several landing pages pass a greeting as their
  // `title` ("Good evening, Dr. Rajeshwar Sharma"), which is a fine <h1> for
  // a dashboard home but nonsense as the tail of a navigational trail. At the
  // root there is nothing to descend from, so the trail is simply the portal.
  // Compared on pathname only, since admin_internal's portal href carries a
  // ?view=mellow query that pathname never includes.
  const pathname = usePathname();
  const atPortalRoot = pathname === portal.href.split("?")[0];

  // The organisation being operated on, and the only chip left in the header.
  //
  // The header used to carry a per-role badge ("Master Access", "Internal
  // Ops", "Marketing Team", or the student's own rating) — but the sidebar
  // footer already states who you are, so each of those was the same fact
  // printed twice, a metre apart. The split now is: the SIDEBAR says who you
  // are, the HEADER says where you are. A college or company name is the one
  // thing that survives that rule, because it's the tenant you're acting on
  // and the sidebar never names it.
  const tenant =
    identityRole === "admin_tpo"
      ? user?.college?.name ?? null
      : identityRole === "admin_company"
      ? user?.company?.name ?? null
      : null;

  // Command palette items — only ever surface destinations this role can
  // actually open, since every dashboard route is now auth-guarded.
  const allCommandItems: {
    id: string;
    title: string;
    subtext: string;
    icon: typeof Terminal;
    category: string;
    roles: DashboardRole[];
    action: () => void;
  }[] = [
    {
      id: "candidate",
      title: "Candidate Overview",
      subtext: "Rating, streak, readiness and upcoming assessments",
      icon: Terminal,
      category: "Navigation",
      roles: ["user"],
      action: () => router.push("/dashboard"),
    },
    {
      id: "practice",
      title: "Practice Arena",
      subtext: "Learning tracks, daily challenge and curated sets",
      icon: BookOpen,
      category: "Navigation",
      roles: ["user"],
      action: () => router.push("/dashboard/practice"),
    },
    {
      id: "reports",
      title: "Performance Report",
      subtext: "Contest history, accuracy and placement eligibility",
      icon: LineChart,
      category: "Navigation",
      roles: ["user"],
      action: () => router.push("/dashboard/reports"),
    },
    {
      id: "drives",
      title: "Upcoming & Campus Drives",
      subtext: "Scheduled corporate placement assessments",
      icon: Briefcase,
      category: "Navigation",
      roles: ["user"],
      action: () => router.push("/dashboard#placement-drives"),
    },
    {
      id: "superadmin",
      title: "Superadmin Master Console",
      subtext: "Platform metrics, judge nodes & user governance",
      icon: Shield,
      category: "Administration",
      roles: ["superadmin"],
      action: () => router.push("/superadmin"),
    },
    {
      id: "mellow_ops",
      title: "Mellow Operations Center",
      subtext: "Problem review, testcase runs & plagiarism radar",
      icon: Cpu,
      category: "Administration",
      roles: ["admin_internal", "superadmin"],
      action: () => router.push("/admin?view=mellow"),
    },
    {
      id: "tpo_hub",
      title: "College TPO Placement Hub",
      subtext: "Student cohort management & placement reports",
      icon: Building2,
      category: "Administration",
      roles: ["admin_tpo"],
      action: () => router.push("/admin?view=tpo"),
    },
    {
      id: "placement_content",
      title: "Placement Drives & Companies",
      subtext: "Manage the shared company catalog and drive prep content",
      icon: Briefcase,
      category: "Administration",
      roles: ["admin_internal", "superadmin"],
      action: () => router.push("/admin/placements"),
    },
    {
      id: "marketing_leads",
      title: "Lead Management",
      subtext: "Mellow Direct leads — status, notes and outreach",
      icon: Megaphone,
      category: "Administration",
      roles: ["admin_marketing", "superadmin"],
      action: () => router.push("/marketing"),
    },
    {
      id: "hiring_hub",
      title: "Hiring Command Center",
      subtext: "Job openings, candidate pipeline & assessments",
      icon: Briefcase,
      category: "Administration",
      roles: ["admin_company"],
      action: () => router.push("/admin"),
    },
    {
      id: "hiring_reports",
      title: "Hiring Reports",
      subtext: "Funnel, time-to-hire and offer-accept analytics",
      icon: CheckCircle2,
      category: "Administration",
      roles: ["admin_company"],
      action: () => router.push("/admin/company/reports"),
    },
    {
      id: "settings",
      title: "Profile Settings",
      subtext: "Identity, security, preferences and notifications",
      icon: Settings,
      category: "Account",
      roles: ["user", "admin_internal", "admin_tpo", "admin_marketing", "superadmin", "admin_company"],
      action: () => router.push("/settings"),
    },
    {
      id: "leaderboard",
      title: "Global Competitive Leaderboard",
      subtext: "Overall developer rankings and contest standing",
      icon: Trophy,
      category: "Community",
      roles: ["user", "admin_internal", "admin_tpo", "superadmin"],
      action: () => router.push("/dashboard/leaderboard"),
    },
  ];

  const commandItems = allCommandItems.filter((item) => item.roles.includes(role));

  const filteredCommands = commandItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtext.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="sticky top-0 z-20 flex h-16 w-full select-none items-center gap-3 overflow-hidden border-b border-border-subtle bg-surface/80 px-4 backdrop-blur-xl transition-colors sm:px-6"
      >
        {/* The one place in the chrome allowed a touch of colour — the
            sidebar rail already carries the saturated surfaces, so this is
            just a faint two-tone wash plus a soft glowing hairline along the
            bottom edge, enough to stop the topbar reading as a flat,
            uncoloured strip without competing with actual content.
            pointer-events-none (same pattern as DashboardSidebar's own top
            wash) so it never intercepts clicks on the real controls below,
            regardless of paint order. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-accent-primary/[0.05] via-transparent to-accent-secondary/[0.04]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent-primary/25 to-transparent"
        />

        {/* Left: mobile trigger + breadcrumb + tenant */}
        <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
          <button
            onClick={onOpenMobile}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] border border-border-subtle text-text-muted transition-all duration-200 hover:scale-105 hover:border-accent-primary/30 hover:bg-surface-hover hover:text-accent-primary active:scale-95 md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/*
            A breadcrumb that actually tracks where you are.

            This used to read "CodeGen Box / <role context> / <portal name>" —
            three crumbs, none of which changed as you navigated, because the
            last one was the role's portal name rather than the page. Every
            screen in a role rendered an identical header. The product name
            was also its own root crumb while the sidebar's wordmark said the
            same thing two centimetres to the left.

            `title` is the real page name and was already being passed into
            this component by DashboardShell — it was simply discarded in
            favour of the static portal string. The page <h1> repeating it is
            correct and deliberate: a trail and a heading are different jobs
            (GitHub, Stripe and Linear all do exactly this), and in fullBleed
            pages, which render no <h1> at all, this is the only place the
            page is named.
          */}
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-2">
              {!atPortalRoot && (
                <li className="hidden flex-shrink-0 items-center gap-2 sm:flex">
                  <Link
                    href={portal.href}
                    className="rounded text-13 font-semibold text-text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                  >
                    {portal.label}
                  </Link>
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-text-muted/50" aria-hidden />
                </li>
              )}
              <li className="min-w-0">
                <span
                  aria-current="page"
                  className="block truncate text-15 font-extrabold tracking-tight text-primary"
                >
                  {atPortalRoot ? portal.label : title}
                </span>
              </li>
            </ol>
          </nav>

          {/* Tenant. No pulsing dot: a college's name is not a live signal,
              and animating it spent the one motion cue the header has on the
              least time-sensitive thing in it. Held back until useAuth()
              resolves rather than flashing a "Loading..." chip. Tinted with
              the same accent used everywhere else rather than flat grey, so
              it reads as "designed" rather than a leftover system chip. */}
          {tenant && (
            <span
              className={cn(
                "hidden flex-shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold text-text-secondary lg:inline-flex",
                identityRole === "admin_company"
                  ? "border-teal-500/25 bg-gradient-to-r from-teal-500/10 to-cyan-500/5"
                  : identityRole === "admin_tpo"
                  ? "border-sky-500/25 bg-gradient-to-r from-sky-500/10 to-indigo-500/5"
                  : "border-accent-primary/15 bg-accent-primary/5"
              )}
            >
              <Building2 className={cn("h-3 w-3 flex-shrink-0", identityRole === "admin_company" ? "text-teal-500" : identityRole === "admin_tpo" ? "text-sky-500" : "text-accent-primary")} />
              <span className="max-w-[220px] truncate">{tenant}</span>
            </span>
          )}
        </div>

        {/* Right: search + alerts + theme | primary action */}
        <div className="relative z-10 flex flex-shrink-0 items-center gap-2">
          {/* Command palette trigger — the widest, most prominent utility on
              the bar (it's the fastest way to get anywhere in the app), so
              it gets a growing min-width and the header's one colour-glow
              interaction rather than sitting flush like every other icon
              button. */}
          <button
            onClick={() => setCommandOpen(true)}
            className="group flex h-9 items-center gap-2 rounded-[10px] border border-border-subtle bg-surface-hover/50 px-2.5 text-text-muted ring-0 ring-accent-primary/0 transition-all duration-200 hover:border-accent-primary/40 hover:bg-surface-hover hover:ring-[6px] hover:ring-accent-primary/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary md:min-w-[180px] xl:min-w-[240px]"
            aria-label="Open command palette"
          >
            <Search className="h-4 w-4 flex-shrink-0 transition-colors duration-200 group-hover:text-accent-primary" />
            <span className="hidden text-13 font-medium xl:inline">Search or jump to…</span>
            <span className="hidden text-13 font-medium md:inline xl:hidden">Search…</span>
            {/* Width-reserved so resolving ⌘ vs Ctrl after mount can't nudge
                the rest of the header sideways. Sized for the wider of the
                two labels ("Ctrl K"), with nowrap — at 42px the Windows hint
                broke across two lines inside its own keycap. */}
            <span className="ml-auto hidden w-[54px] justify-end sm:flex">
              {mounted && (
                <kbd className="inline-flex items-center whitespace-nowrap rounded-[6px] border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-3xs leading-none text-text-muted shadow-subtle transition-colors duration-200 group-hover:border-accent-primary/30 group-hover:text-accent-primary">
                  {isMac ? "⌘K" : "Ctrl K"}
                </kbd>
              )}
            </span>
          </button>

          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center rounded-[10px] border transition-all duration-200 hover:scale-105 hover:border-accent-primary/40 hover:bg-surface-hover hover:text-accent-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                notificationsOpen
                  ? "border-accent-primary/40 bg-accent-primary/5 text-accent-primary ring-[6px] ring-accent-primary/[0.07]"
                  : "border-border-subtle bg-surface text-text-muted"
              )}
              title="Notifications"
              aria-label="View notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && !notificationsRead && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] animate-pulse-subtle items-center justify-center rounded-full bg-status-danger px-1 text-3xs font-bold text-white ring-2 ring-surface">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover Card */}
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-panel bg-surface/95 backdrop-blur-xl border border-border-strong shadow-card p-3.5 z-50"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-border-subtle">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Notifications
                      </span>
                      {unreadCount > 0 && !notificationsRead && (
                        <span className="px-1.5 py-0.5 rounded-full text-3xs font-bold bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-2xs text-accent-primary hover:underline font-semibold transition-colors"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="py-2 space-y-2 max-h-72 overflow-y-auto">
                    {notifications.length === 0 && (
                      <p className="text-2xs text-text-muted text-center py-4">No new notifications.</p>
                    )}
                    {notifications.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "p-2.5 rounded-control border text-xs transition-all",
                          item.unread
                            ? "bg-accent-primary/5 border-accent-primary/25"
                            : "bg-surface-hover/50 hover:bg-surface-hover border-border-subtle"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-primary truncate leading-tight">
                            {item.title}
                          </span>
                          <span className="text-3xs text-text-muted whitespace-nowrap">
                            {item.time}
                          </span>
                        </div>
                        <p className="text-text-secondary mt-1 text-2xs leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme. h-9 to match the controls either side of it — the compact
              toggle is a 32px pill by default, which left it sitting a
              visible 4px short of the search field and bell next to it. */}
          <ThemeToggle compact className="h-9 flex-shrink-0 rounded-[10px]" />

          {/* Hairline separating reversible utilities from the one control on
              this bar that actually does something to the data. */}
          {actionButton && (
            <span aria-hidden className="mx-0.5 hidden h-5 w-px bg-border-subtle sm:block" />
          )}

          {/* Primary action — the only saturated surface on the bar, so it
              gets the header's full colour treatment: a two-tone brand
              gradient that visibly sweeps on hover (background-position
              transition, not a new element) plus a small icon flourish.
              Everything else on this bar is reversible chrome; this is the
              one thing that actually does something, and it should look
              like it. */}
          {actionButton && (
            <button
              onClick={actionButton.onClick}
              title={actionButton.label}
              aria-label={actionButton.label}
              className={cn("group flex h-9 flex-shrink-0 items-center gap-1.5 rounded-[10px] bg-gradient-to-r bg-[length:160%_100%] bg-left px-2.5 text-13 font-bold text-white shadow-subtle transition-all duration-300 hover:bg-right hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-95 sm:px-3.5",
                identityRole === "admin_company" || identityRole === "admin_tpo" ? "from-indigo-500 to-violet-600" : "from-accent-primary to-accent-secondary"
              )}
            >
              {actionButton.icon && (
                <actionButton.icon
                  className="h-4 w-4 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                  strokeWidth={2.2}
                />
              )}
              {/* Icon-only on phones so the title never gets squeezed out */}
              <span className="hidden whitespace-nowrap md:inline">{actionButton.label}</span>
            </button>
          )}
        </div>
      </motion.header>

      {/* Modern Command Palette Modal (⌘K) */}
      <AnimatePresence>
        {commandOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommandOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{ duration: 0.16 }}
              className="relative w-full max-w-xl rounded-panel bg-surface/95 backdrop-blur-xl border border-border-strong shadow-card overflow-hidden z-10 flex flex-col"
            >
              {/* Search Input Bar */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle">
                <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (filteredCommands.length === 0) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      // Wraps, so holding ArrowDown cycles rather than
                      // dead-ending at the last row.
                      setActiveIndex((i) => (i + 1) % filteredCommands.length);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActiveIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      setCommandOpen(false);
                      filteredCommands[activeIndex]?.action();
                    }
                  }}
                  placeholder="Type a command or jump to page..."
                  className="flex-1 bg-transparent border-none outline-none text-primary placeholder-text-muted text-sm"
                  autoFocus
                  role="combobox"
                  aria-expanded
                  aria-controls="command-palette-results"
                  aria-activedescendant={filteredCommands[activeIndex] ? `cmd-${filteredCommands[activeIndex].id}` : undefined}
                />
                <kbd className="px-1.5 py-0.5 text-3xs font-mono bg-elevated border border-border-subtle rounded text-text-muted">
                  ESC
                </kbd>
              </div>

              {/* Filtered Command Results */}
              <div
                id="command-palette-results"
                role="listbox"
                ref={resultsRef}
                className="max-h-80 overflow-y-auto p-2 space-y-1"
              >
                {filteredCommands.length > 0 ? (
                  filteredCommands.map((cmd, i) => {
                    const Icon = cmd.icon;
                    const active = i === activeIndex;
                    return (
                      <button
                        key={cmd.id}
                        id={`cmd-${cmd.id}`}
                        role="option"
                        aria-selected={active}
                        // Keeps the keyboard selection and the mouse in sync:
                        // hovering re-aims Enter at the row under the cursor,
                        // so the two input methods can't disagree about which
                        // row is "the" one.
                        onMouseMove={() => setActiveIndex(i)}
                        ref={
                          active
                            ? (el) => el?.scrollIntoView({ block: "nearest" })
                            : undefined
                        }
                        onClick={() => {
                          setCommandOpen(false);
                          cmd.action();
                        }}
                        className={cn(
                          "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-control transition-colors text-left group",
                          active && "bg-surface-hover"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              "w-8 h-8 rounded-control bg-surface border flex items-center justify-center flex-shrink-0 transition-colors shadow-subtle",
                              active
                                ? "border-accent-primary/40 text-accent-primary"
                                : "border-border-subtle text-text-muted"
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span
                              className={cn(
                                "text-xs font-semibold truncate transition-colors",
                                active ? "text-accent-primary" : "text-primary"
                              )}
                            >
                              {cmd.title}
                            </span>
                            <span className="text-2xs text-text-muted truncate mt-0.5">
                              {cmd.subtext}
                            </span>
                          </div>
                        </div>
                        <span className="text-3xs font-semibold text-text-muted px-2 py-0.5 rounded bg-elevated border border-border-subtle uppercase tracking-wider flex-shrink-0">
                          {cmd.category}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-xs text-text-muted">
                    No results found for &ldquo;{searchQuery}&rdquo;. Try searching for dashboard, problems, or drives.
                  </div>
                )}
              </div>

              {/* Command Palette Keyboard Hints */}
              <div className="px-4 py-2 border-t border-border-subtle bg-elevated/40 flex items-center justify-between text-2xs text-text-muted">
                <div className="flex items-center gap-3">
                  <span>
                    <kbd className="px-1 py-0.5 rounded bg-surface border border-border-subtle font-mono text-3xs">
                      ↑
                    </kbd>{" "}
                    <kbd className="px-1 py-0.5 rounded bg-surface border border-border-subtle font-mono text-3xs">
                      ↓
                    </kbd>{" "}
                    to navigate
                  </span>
                  <span>
                    <kbd className="px-1 py-0.5 rounded bg-surface border border-border-subtle font-mono text-3xs">
                      ↵
                    </kbd>{" "}
                    to select
                  </span>
                </div>
                <span>Quick Palette</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
