"use client";

/**
 * College TPO "Placement Command Center" — the admin_tpo landing view of
 * /admin, extracted from app/admin/page.tsx (same pattern as
 * CompanyCommandCenter). It owns the TPO-only data loading and the placement
 * target editor that used to live inline in that page; the API calls, state
 * and handlers are carried over unchanged.
 *
 * Every figure rendered here is a real value from TpoReportsController (or
 * the mapped-drives / coordinators / subscription endpoints), or a direct
 * arithmetic derivation of those values — nothing is padded or fabricated.
 */

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Gauge,
  GraduationCap,
  HeartHandshake,
  Hourglass,
  IndianRupee,
  Mail,
  MapPin,
  Mic,
  PartyPopper,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  Trophy,
  Upload,
  UserCog,
  UserPlus,
  Users2,
  UserX,
  type LucideIcon,
} from "lucide-react";
import {
  HP_TONES,
  HpAvatar,
  HpButton,
  HpCard,
  HpCompanyLogo,
  HpFunnel,
  HpHero,
  HpIconTile,
  HpItem,
  HpPill,
  HpProgress,
  HpRing,
  HpSectionHeader,
  HpSkeleton,
  HpSkeletonCards,
  HpStagger,
  HpStatCard,
  HpToast,
  hpBtn,
  hpEase,
  hpInput,
  hpLabel,
  type HpTone,
} from "@/components/portal/kit";
import { HpErrorCard } from "@/components/portal/pipeline-kit";
import { ScCollapse, ScDateTile, ScMetric, ScNotice } from "@/components/portal/screeningKit";
import { api, ApiError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { TpoReportStudent, TpoReportsData } from "@/lib/generateTpoReports";
import { computeSectionStats, type SectionCoordinatorInfo } from "@/lib/sectionBreakdown";
import type { SubscriptionCoverage } from "@/types/subscription";
import { cn } from "@/lib/utils";

/* ── Data shapes (moved verbatim from app/admin/page.tsx) ───────────────── */

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

type TpoCoordinator = SectionCoordinatorInfo & { section: string };

interface Props {
  user: AuthUser | null;
}

/* ── Static config ──────────────────────────────────────────────────────── */

const QUICK_LINKS: { label: string; hint: string; href: string; icon: LucideIcon; tone: HpTone }[] = [
  { label: "Student cohort", hint: "Roster, readiness & eligibility", href: "/admin/students", icon: GraduationCap, tone: "sky" },
  { label: "Section coordinators", hint: "Who runs each section", href: "/admin/coordinators", icon: UserCog, tone: "indigo" },
  { label: "Mock contests", hint: "Private coding practice rounds", href: "/admin/mock-contests", icon: Swords, tone: "violet" },
  { label: "Mock interviews", hint: "AI voice-interview practice", href: "/admin/mock-interviews", icon: Mic, tone: "teal" },
  { label: "Soft skills", hint: "Aptitude, reasoning & English tests", href: "/admin/mock-soft-skills", icon: HeartHandshake, tone: "amber" },
  { label: "Proctoring", hint: "Flagged contest attempts", href: "/admin/proctoring", icon: ShieldCheck, tone: "sky" },
];

const GETTING_STARTED: { step: string; title: string; body: string; href: string; icon: LucideIcon; tone: HpTone }[] = [
  { step: "01", title: "Import your roster", body: "Bring in your batch with roll numbers, branches, sections and CGPA.", href: "/admin/students", icon: Upload, tone: "sky" },
  { step: "02", title: "Assign coordinators", body: "Give every section a coordinator your students can reach.", href: "/admin/coordinators", icon: UserCog, tone: "indigo" },
  { step: "03", title: "Map campus drives", body: "Bring published drives into your catalog and register eligible students.", href: "/admin/drives", icon: Briefcase, tone: "violet" },
];

/** Keyed by PlacementReportService::actionItems() `type` — unknown types still render, just without a shortcut. */
const ATTENTION_META: Record<string, { icon: LucideIcon; cta: string; href: string }> = {
  stale_applications: { icon: Clock3, cta: "Update stages", href: "/admin/drives" },
  pending_offers: { icon: Hourglass, cta: "Follow up", href: "/admin/drives" },
  unregistered_eligible: { icon: UserPlus, cta: "Register students", href: "/admin/drives" },
};

const TIERS: { id: TpoReportStudent["readiness_tier"]; tone: HpTone }[] = [
  { id: "Placement Ready", tone: "emerald" },
  { id: "In Progress", tone: "sky" },
  { id: "Needs Training", tone: "amber" },
];

/* ── Helpers ────────────────────────────────────────────────────────────── */

const DAY_MS = 86400000;

/** Trims a trailing ".0" so 12.5 stays "12.5" and 75 reads "75". */
function fmtPct(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** LPA figures: at most two decimals, no trailing zeros (21 → "21", 7.25 → "7.25"). */
function fmtLpa(n: number): string {
  return String(Number(n.toFixed(2)));
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Whole calendar days from today to `iso` (negative = in the past), or null for an unparseable date. */
function daysFromToday(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.round(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / DAY_MS
  );
}

function formatDate(iso: string, withYear = true) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

/** Readiness bands — the same 75 / 45 cut-offs the dashboard has always used. */
function readinessTone(score: number): HpTone {
  return score >= 75 ? "emerald" : score >= 45 ? "sky" : "amber";
}

function driveWhen(days: number | null): { label: string; tone: HpTone; soon: boolean } {
  if (days === null) return { label: "Date TBA", tone: "slate", soon: false };
  if (days === 0) return { label: "Today", tone: "amber", soon: true };
  if (days === 1) return { label: "Tomorrow", tone: "amber", soon: true };
  if (days > 1 && days <= 7) return { label: `In ${days} days`, tone: "amber", soon: true };
  if (days > 7) return { label: `In ${days} days`, tone: "sky", soon: false };
  return { label: `${plural(-days, "day")} ago`, tone: "slate", soon: false };
}

type SubscriptionView = {
  pill: { label: string; tone: HpTone; pulse?: boolean };
  notice: { tone: "rose" | "amber"; title: string; body: ReactNode } | null;
};

/** Same three conditions (and copy) the old subscription strip used, plus a calm chip for a healthy plan. */
function describeSubscription(c: SubscriptionCoverage, tier: string | null): SubscriptionView {
  if (c.days_remaining === null) {
    return {
      pill: { label: "No active plan", tone: "rose" },
      notice: {
        tone: "rose",
        title: "No active subscription",
        body: <>New students can&apos;t be imported or added. Contact Mellow Vault to renew.</>,
      },
    };
  }
  const days = `${c.days_remaining} day${c.days_remaining === 1 ? "" : "s"}`;
  if (c.is_trial) {
    return {
      pill: { label: `Demo · ${days} left`, tone: "amber", pulse: true },
      notice: { tone: "amber", title: "Demo plan", body: <>{days} remaining before you&apos;ll need to subscribe.</> },
    };
  }
  if (c.days_remaining <= 14) {
    return {
      pill: { label: `Renews in ${days}`, tone: "amber" },
      notice: { tone: "amber", title: "Renewing soon", body: <>{days} left on your current plan.</> },
    };
  }
  // The plan is usually named after the college's tier, which the hero already shows — don't say it twice.
  const named = c.plan?.name && c.plan.name !== tier ? c.plan.name : null;
  return { pill: { label: named ? `${named} · active` : "Plan active", tone: "emerald" }, notice: null };
}

/* ── Small local pieces ─────────────────────────────────────────────────── */

function SectionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Compact in-card empty state (with an optional next step). */
function PanelEmpty({
  icon,
  tone = "slate",
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  tone?: HpTone;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-border-strong bg-elevated/30 px-6 py-10 text-center", className)}>
      <div aria-hidden className="hp-dots pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(55%_70%_at_50%_35%,#000,transparent)]" />
      <HpIconTile icon={icon} tone={tone} size="lg" className="relative" />
      <p className="relative mt-4 text-sm font-bold tracking-tight text-primary">{title}</p>
      {description && <p className="relative mt-1 max-w-sm text-2xs leading-relaxed text-text-muted">{description}</p>}
      {action && <div className="relative mt-4">{action}</div>}
    </div>
  );
}

const iconLink =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-indigo-500/10 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-indigo-300";

/**
 * Placement-rate donut with a tick at the target — the one visual that
 * answers "where are we vs. where we said we'd be". Turns emerald once the
 * target is met.
 */
function TargetRing({
  current,
  target,
  size = 124,
  stroke = 10,
  children,
}: {
  current: number;
  target: number | null;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const gid = `tpo-ring-${useId().replace(/:/g, "")}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;
  const pct = Math.max(0, Math.min(100, current));
  const reached = target !== null && current >= target;
  const offset = c - (c * pct) / 100;

  let marker: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (target !== null) {
    const theta = (Math.max(0, Math.min(100, target)) / 100) * Math.PI * 2;
    const inner = r - stroke / 2 - 3;
    const outer = r + stroke / 2 + 3;
    marker = {
      x1: center + inner * Math.cos(theta),
      y1: center + inner * Math.sin(theta),
      x2: center + outer * Math.cos(theta),
      y2: center + outer * Math.sin(theta),
    };
  }

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={reached ? "#34D399" : "#38BDF8"} />
            <stop offset="1" stopColor={reached ? "#059669" : "#4F46E5"} />
          </linearGradient>
        </defs>
        <circle cx={center} cy={center} r={r} fill="none" strokeWidth={stroke} className="stroke-border-subtle" />
        <motion.circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${gid})`}
          strokeDasharray={c}
          opacity={pct > 0 ? 1 : 0}
          initial={{ strokeDashoffset: reduce ? offset : c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduce ? 0 : 1.2, ease: hpEase, delay: reduce ? 0 : 0.2 }}
        />
        {marker && <line {...marker} strokeWidth={3} strokeLinecap="round" className="stroke-primary" />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className={cn("tabular mt-0.5 truncate text-13 font-bold text-primary", className)}>{children}</dd>
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function TpoCommandCenter({ user }: Props) {
  const reduce = useReducedMotion();
  const editorId = useId();
  const targetInputId = useId();
  const deadlineInputId = useId();

  // -----------------------------------------------------------------
  // Real cohort + placement pipeline data (TpoReportsController) —
  // replaces the TPO dashboard's previously-fictional
  // PLACEMENT_FUNNEL/RECENT_PLACEMENTS/CAMPUS_DRIVES/etc mock data.
  // -----------------------------------------------------------------
  const [tpoReportsData, setTpoReportsData] = useState<TpoReportsData | null>(null);
  const [tpoDataLoading, setTpoDataLoading] = useState(true);
  const [tpoCoordinators, setTpoCoordinators] = useState<TpoCoordinator[]>([]);
  const [tpoMappedDrives, setTpoMappedDrives] = useState<TpoMappedDrive[]>([]);
  // Presentation-only: lets the drives panel shimmer instead of flashing
  // its empty state while /tpo/drives/mapped is still in flight.
  const [drivesLoading, setDrivesLoading] = useState(true);
  // Institutional subscription status — GET /me/subscription already
  // returns this correctly (isActive()-aware) for admin_tpo, so a TPO sees
  // their own college's demo countdown or an expired subscription before an
  // import/add silently starts failing.
  const [subscriptionCoverage, setSubscriptionCoverage] = useState<SubscriptionCoverage | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetPercentInput, setTargetPercentInput] = useState("");
  const [targetDeadlineInput, setTargetDeadlineInput] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  // Toast — same 3.5s lifetime the page-level toast had; tone is cosmetic.
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"emerald" | "rose">("emerald");
  const triggerToast = (msg: string, tone: "emerald" | "rose" = "emerald") => {
    setToastTone(tone);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

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
      triggerToast(err instanceof ApiError ? err.message : "Failed to update target.", "rose");
    } finally {
      setSavingTarget(false);
    }
  };

  // This component only mounts for a ready admin_tpo session (see
  // app/admin/page.tsx), which is exactly the condition the original
  // effect gated on — so it loads once on mount.
  useEffect(() => {
    setTpoDataLoading(true);
    api
      .get<TpoReportsData>("/tpo/reports/data")
      .then(setTpoReportsData)
      .catch(() => setTpoReportsData(null))
      .finally(() => setTpoDataLoading(false));

    api
      .get<{ mappings: TpoMappedDrive[] }>("/tpo/drives/mapped")
      .then((res) => setTpoMappedDrives((res.mappings ?? []).filter((m) => m.is_active && m.placement_drive.status === "published")))
      .catch(() => setTpoMappedDrives([]))
      .finally(() => setDrivesLoading(false));

    api
      .get<{ coordinators: TpoCoordinator[] }>("/tpo/coordinators")
      .then((res) => setTpoCoordinators(res.coordinators))
      .catch(() => setTpoCoordinators([]));

    api
      .get<{ scope: string; coverage: SubscriptionCoverage }>("/me/subscription")
      .then((res) => setSubscriptionCoverage(res.coverage))
      .catch(() => setSubscriptionCoverage(null));
  }, []);

  /* ── Derived view model ──────────────────────────────────────────────── */

  const college = user?.college ?? null;
  const collegeName = college?.name ?? "Your College";
  const location = [college?.city, college?.state].filter(Boolean).join(", ");
  const sub = subscriptionCoverage ? describeSubscription(subscriptionCoverage, college?.tier ?? null) : null;

  const data = tpoReportsData;
  const placements = data?.placements;
  const funnel = placements?.funnel;
  const target = placements?.target;
  const students = data?.students ?? [];

  const enrolled = funnel?.batch_enrolled ?? 0;
  const accepted = funnel?.accepted ?? 0;
  const registered = funnel?.registered ?? 0;
  const currentPct = target?.current_percent ?? 0;
  const hasTarget = !!target?.target_percent;
  const targetPct = hasTarget ? Number(target?.target_percent) : null;
  const reached = targetPct !== null && currentPct >= targetPct;
  const progressToGoal = targetPct !== null ? (targetPct > 0 ? Math.min(100, (currentPct / targetPct) * 100) : 100) : 0;
  // current_percent is accepted offers / cohort size (PlacementReportService), so this is the same arithmetic in reverse.
  const offersToGo = targetPct !== null && enrolled > 0 ? Math.max(0, Math.ceil((targetPct / 100) * enrolled - 1e-9) - accepted) : null;
  const deadlineDays = target?.target_deadline ? daysFromToday(target.target_deadline) : null;

  const avgReadiness =
    students.length > 0 ? Math.round(students.reduce((s, st) => s + st.readiness_score, 0) / students.length) : 0;

  const tierCounts = TIERS.map((t) => ({ ...t, count: students.filter((s) => s.readiness_tier === t.id).length }));
  const readyCount = tierCounts[0].count;

  const branchMap = students.reduce((map, s) => {
    if (!s.branch) return map;
    const g = map.get(s.branch) ?? { readiness: [] as number[], count: 0 };
    g.readiness.push(s.readiness_score);
    g.count++;
    map.set(s.branch, g);
    return map;
  }, new Map<string, { readiness: number[]; count: number }>());
  const branches = Array.from(branchMap)
    .map(([branch, g]) => ({ branch, count: g.count, avg: Math.round(g.readiness.reduce((a, b) => a + b, 0) / g.readiness.length) }))
    .sort((a, b) => b.avg - a.avg);

  const sectionStats = computeSectionStats(students, tpoCoordinators);
  const actionItems = placements?.action_items ?? [];
  const recentPlacements = placements?.recent_placements ?? [];
  const recruiters = placements?.company_summary ?? [];
  const companiesHired = recruiters.length;
  const sectionsCovered = sectionStats.filter((s) => s.coordinator !== null).length;

  // Season-so-far package figures: exact aggregates of companySummary.
  const offerCount = recruiters.reduce((s, c) => s + c.offers_accepted, 0);
  const pricedRecruiters = recruiters.filter((c) => c.avg_ctc !== null);
  const pricedOffers = pricedRecruiters.reduce((s, c) => s + c.offers_accepted, 0);
  const avgPackage = pricedOffers > 0 ? pricedRecruiters.reduce((s, c) => s + (c.avg_ctc ?? 0) * c.offers_accepted, 0) / pricedOffers : null;
  const maxCtcs = recruiters.map((c) => c.max_ctc).filter((v): v is number => v !== null);
  const topPackage = maxCtcs.length > 0 ? Math.max(...maxCtcs) : null;
  const packages = placements?.package_distribution ?? [];
  const packageTotal = packages.reduce((s, p) => s + p.count, 0);
  const packageMax = Math.max(1, ...packages.map((p) => p.count));

  // Join a mapped drive to its eligibility snapshot in the same reports payload (same drive id).
  const reportDriveById = new Map((data?.drives ?? []).map((d) => [d.id, d] as const));
  const logoByCompany = new Map<string, string | null>();
  (data?.drives ?? []).forEach((d) => logoByCompany.set(d.company.name, d.company.logo));
  tpoMappedDrives.forEach((m) => {
    if (!logoByCompany.get(m.placement_drive.company.name)) logoByCompany.set(m.placement_drive.company.name, m.placement_drive.company.logo);
  });

  // Upcoming first (soonest first), then drives whose date has passed (most recent first).
  const rankedDrives = tpoMappedDrives
    .map((m) => ({ m, days: daysFromToday(m.placement_drive.drive_date) }))
    .sort((a, b) => {
      const key = (d: number | null): [number, number] => (d === null ? [2, 0] : d >= 0 ? [0, d] : [1, -d]);
      const [ga, va] = key(a.days);
      const [gb, vb] = key(b.days);
      return ga - gb || va - vb;
    });
  const upcomingCount = rankedDrives.filter((d) => d.days !== null && d.days >= 0).length;

  const funnelStages = [
    { label: "Registered", value: registered, tone: "sky" as HpTone },
    { label: "Shortlisted", value: funnel?.shortlisted ?? 0, tone: "indigo" as HpTone },
    { label: "Interviewed", value: funnel?.interviewed ?? 0, tone: "violet" as HpTone },
    { label: "Offered", value: funnel?.offered ?? 0, tone: "amber" as HpTone },
    { label: "Accepted", value: accepted, tone: "emerald" as HpTone },
  ];
  const appToPlaced = registered > 0 ? Math.round((accepted / registered) * 100) : 0;
  let dropOff: { from: string; to: string; rate: number } | null = null;
  for (let i = 1; i < funnelStages.length; i++) {
    const prev = funnelStages[i - 1].value;
    if (prev <= 0) continue;
    const rate = Math.round((funnelStages[i].value / prev) * 100);
    if (!dropOff || rate < dropOff.rate) dropOff = { from: funnelStages[i - 1].label, to: funnelStages[i].label, rate };
  }

  const openTargetEditor = () => {
    setTargetPercentInput(tpoReportsData?.placements.target.target_percent ?? "");
    setTargetDeadlineInput(tpoReportsData?.placements.target.target_deadline?.slice(0, 10) ?? "");
    setEditingTarget(true);
  };

  /* ── Sections ────────────────────────────────────────────────────────── */

  const toast = <HpToast message={toastMessage} tone={toastTone} />;

  const hero = (
    <HpHero
      leading={<HpCompanyLogo name={collegeName} size="xl" />}
      eyebrow={
        <>
          <span>Your institution</span>
          {college?.tier && (
            <HpPill tone="sky" size="sm" icon={Award} className="normal-case tracking-normal">
              {college.tier}
            </HpPill>
          )}
          {sub && (
            <HpPill tone={sub.pill.tone} size="sm" dot pulse={sub.pill.pulse} className="normal-case tracking-normal">
              {sub.pill.label}
            </HpPill>
          )}
        </>
      }
      // Long institution names wrap on phones instead of truncating; the kit's single-line truncate applies from md up.
      title={<span className="whitespace-normal md:whitespace-nowrap">{collegeName}</span>}
      description={
        <>
          <span className="inline-flex items-center gap-1 align-middle">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
            {location || "Location not on file"}
          </span>
          <span aria-hidden className="mx-1.5 text-text-muted">
            ·
          </span>
          Head of placements <span className="font-semibold text-primary">{user?.name}</span>
        </>
      }
      actions={
        <>
          <Link href="/admin/reports" className={hpBtn("secondary", "md")}>
            <Download className="h-4 w-4" />
            Reports
          </Link>
          <Link href="/admin/drives" className={hpBtn("primary", "md")}>
            <Plus className="h-4 w-4" />
            Manage Drives
          </Link>
        </>
      }
    >
      {sub?.notice ? (
        <ScNotice tone={sub.notice.tone} title={sub.notice.title}>
          {sub.notice.body}
        </ScNotice>
      ) : null}
    </HpHero>
  );

  const quickLinks = (
    <div className="space-y-4">
      <HpSectionHeader icon={Sparkles} tone="violet" title="Jump back in" subtitle="Everything else in your placement hub" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {QUICK_LINKS.map((a) => (
          <Link key={a.href} href={a.href} className="group block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <HpCard interactive className="flex items-center gap-4 p-4">
              <HpIconTile icon={a.icon} tone={a.tone} size="md" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-13 font-bold text-primary">{a.label}</div>
                <div className="truncate text-2xs text-text-muted">{a.hint}</div>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-indigo-500" />
            </HpCard>
          </Link>
        ))}
      </div>
    </div>
  );

  /* ── Loading ─────────────────────────────────────────────────────────── */

  // The toast is always rendered last: it's position:fixed, but as a child of
  // a space-y stack, mounting it first would push every sibling down.
  if (tpoDataLoading) {
    return (
      <div className="space-y-8">
        {hero}
        <div className="space-y-8" role="status" aria-label="Loading your cohort and placement data">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <HpCard key={i} spotlight={false} className="space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <HpSkeleton className="h-3 w-24" />
                  <HpSkeleton className="h-10 w-10 rounded-xl" />
                </div>
                <HpSkeleton className="h-8 w-16" />
                <HpSkeleton className="h-3 w-32" />
              </HpCard>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <HpCard spotlight={false} className="space-y-5 p-6">
              <div className="flex items-center gap-3">
                <HpSkeleton className="h-8 w-8 rounded-[10px]" />
                <HpSkeleton className="h-4 w-32" />
              </div>
              <div className="flex items-center gap-5">
                <HpSkeleton className="h-[124px] w-[124px] rounded-full" />
                <div className="flex-1 space-y-3">
                  <HpSkeleton className="h-3 w-2/3" />
                  <HpSkeleton className="h-3 w-1/2" />
                  <HpSkeleton className="h-3 w-3/4" />
                </div>
              </div>
            </HpCard>
            <HpCard spotlight={false} className="space-y-4 p-6 lg:col-span-2">
              <div className="flex items-center gap-3">
                <HpSkeleton className="h-8 w-8 rounded-[10px]" />
                <HpSkeleton className="h-4 w-40" />
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <HpSkeleton className="h-3 w-24" />
                  <HpSkeleton className="h-2.5 rounded-full" />
                </div>
              ))}
            </HpCard>
          </div>
          <HpSkeletonCards count={3} />
        </div>
        {toast}
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────────────────────── */

  if (!data || !funnel || !target) {
    return (
      <HpStagger className="space-y-8">
        <HpItem>{hero}</HpItem>
        <HpItem>
          <HpErrorCard message="Couldn't load your cohort data. Please refresh." />
        </HpItem>
        <HpItem>{quickLinks}</HpItem>
        {toast}
      </HpStagger>
    );
  }

  /* ── Ready ───────────────────────────────────────────────────────────── */

  const noRoster = enrolled === 0 && students.length === 0;

  return (
    <HpStagger className="space-y-8">
      <HpItem>{hero}</HpItem>

      {/* KPI strip — every figure is a real TpoReportsController / mapped-drives value. */}
      <HpItem>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HpStatCard
            label="Cohort size"
            value={enrolled}
            icon={Users2}
            tone="sky"
            hint={branches.length > 0 ? `Across ${plural(branches.length, "branch", "branches")}` : "Students on your roster"}
          />
          <HpStatCard
            label="Students placed"
            value={accepted}
            icon={CheckCircle2}
            tone="emerald"
            hint={
              <>
                <span className="tabular font-semibold text-text-secondary">{fmtPct(currentPct)}%</span> placement rate
                {targetPct !== null && <> · goal {fmtPct(targetPct)}%</>}
              </>
            }
          />
          <HpStatCard
            label="Avg. readiness"
            value={avgReadiness}
            icon={Gauge}
            tone="violet"
            hint={students.length > 0 ? `of 100 · ${readyCount} placement-ready` : "of 100 · across your whole cohort"}
          />
          <HpStatCard
            label="Live drives"
            value={tpoMappedDrives.length}
            icon={Briefcase}
            tone="indigo"
            loading={drivesLoading}
            hint={`${plural(companiesHired, "company", "companies")} hired this season`}
          />
        </div>
      </HpItem>

      {/* Fresh college: a guided start instead of a wall of zeros. */}
      {noRoster && (
        <HpItem>
          <div className="space-y-4">
            <HpSectionHeader icon={Sparkles} tone="sky" title="Get your placement season started" subtitle="Three steps and this command center comes alive" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {GETTING_STARTED.map((s) => (
                <Link key={s.step} href={s.href} className="group block rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <HpCard interactive className="h-full p-5">
                    <div className="flex items-start justify-between">
                      <HpIconTile icon={s.icon} tone={s.tone} size="md" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
                      <span className="tabular text-2xl font-black text-border-strong">{s.step}</span>
                    </div>
                    <h3 className="mt-4 text-sm font-bold text-primary">{s.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-text-muted">{s.body}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      Get started
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </span>
                  </HpCard>
                </Link>
              ))}
            </div>
          </div>
        </HpItem>
      )}

      {/* Target + funnel */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Placement target — a real, TPO-set goal (POST /tpo/placement-target), never a fabricated number. */}
          <HpCard featured className="flex flex-col p-5 sm:p-6">
            <HpSectionHeader
              icon={Target}
              tone="sky"
              title="Placement target"
              subtitle={
                hasTarget
                  ? target.target_deadline
                    ? `Goal by ${formatDate(target.target_deadline)}`
                    : "No deadline set"
                  : "Set a goal for this season"
              }
              action={
                hasTarget && !editingTarget ? (
                  <HpButton
                    variant="soft"
                    size="sm"
                    onClick={openTargetEditor}
                    aria-expanded={false}
                    aria-controls={editorId}
                    aria-label="Change target"
                    leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Change
                  </HpButton>
                ) : undefined
              }
            />

            <div className="mt-5 flex items-center gap-5">
              <div
                role="img"
                aria-label={`${fmtPct(currentPct)}% of your cohort placed${targetPct !== null ? `, against a ${fmtPct(targetPct)}% target` : ""}`}
              >
                <TargetRing current={currentPct} target={targetPct}>
                  <span className="tabular text-[26px] font-extrabold leading-none tracking-tight text-primary">
                    {fmtPct(currentPct)}
                    <span className="text-base font-bold text-text-muted">%</span>
                  </span>
                  <span className="mt-1.5 text-3xs font-bold uppercase tracking-[0.12em] text-text-muted">placed</span>
                </TargetRing>
              </div>

              {targetPct !== null ? (
                <dl className="min-w-0 flex-1 space-y-3">
                  <Fact label="Target">{fmtPct(targetPct)}%</Fact>
                  <Fact label="To go" className={reached ? "text-emerald-600 dark:text-emerald-300" : undefined}>
                    {reached
                      ? "Target reached"
                      : offersToGo !== null
                      ? `${plural(offersToGo, "more placement")}`
                      : `${fmtPct(Math.max(0, targetPct - currentPct))} pts`}
                  </Fact>
                  <Fact
                    label="Deadline"
                    className={deadlineDays !== null && deadlineDays < 0 && !reached ? "text-amber-600 dark:text-amber-300" : undefined}
                  >
                    {deadlineDays === null
                      ? "Not set"
                      : deadlineDays > 0
                      ? `${plural(deadlineDays, "day")} left`
                      : deadlineDays === 0
                      ? "Due today"
                      : "Passed"}
                  </Fact>
                </dl>
              ) : (
                <dl className="min-w-0 flex-1 space-y-3">
                  <Fact label="Placed">
                    {accepted} <span className="font-semibold text-text-muted">of {enrolled}</span>
                  </Fact>
                  <Fact label="Target" className="text-text-muted">
                    Not set
                  </Fact>
                  <Fact label="Deadline" className="text-text-muted">
                    Not set
                  </Fact>
                </dl>
              )}
            </div>

            {!hasTarget && !editingTarget && (
              <div className="mt-5 flex flex-1 flex-col justify-center rounded-2xl border border-dashed border-sky-500/30 bg-sky-500/[0.04] p-4">
                <p className="text-13 font-bold text-primary">No placement target set yet</p>
                <p className="mt-1 text-2xs leading-relaxed text-text-muted">
                  Set a season goal and a deadline — progress is tracked here against your live placement rate.
                </p>
                <HpButton
                  variant="primary"
                  size="sm"
                  className="mt-3 self-start"
                  onClick={openTargetEditor}
                  aria-expanded={false}
                  aria-controls={editorId}
                  leftIcon={<Target className="h-3.5 w-3.5" />}
                >
                  Set a target
                </HpButton>
              </div>
            )}

            {targetPct !== null && (
              <div className="mt-5">
                <div className="mb-1.5 flex items-baseline justify-between text-2xs">
                  <span className="font-semibold text-text-secondary">Progress to goal</span>
                  <span className="tabular font-bold text-primary">{Math.round(progressToGoal)}%</span>
                </div>
                <HpProgress value={progressToGoal} tone={reached ? "emerald" : "sky"} />
                <div className="tabular mt-1.5 flex justify-between text-3xs font-medium text-text-muted">
                  <span>0%</span>
                  <span>Target {fmtPct(targetPct)}%</span>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {editingTarget && (
                <ScCollapse key="target-editor" id={editorId}>
                  <div className="mt-5 rounded-2xl border border-sky-500/25 bg-gradient-to-br from-sky-500/[0.08] via-indigo-500/[0.04] to-transparent p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <CalendarClock className="h-4 w-4 text-sky-600 dark:text-sky-300" aria-hidden />
                      {hasTarget ? "Update your target" : "Set your target"}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                      <div>
                        <label htmlFor={targetInputId} className={hpLabel}>
                          Placement rate
                        </label>
                        <div className="relative">
                          <input
                            id={targetInputId}
                            type="number"
                            min={0}
                            max={100}
                            value={targetPercentInput}
                            onChange={(e) => setTargetPercentInput(e.target.value)}
                            placeholder="Target %"
                            className={cn(hpInput, "tabular pr-9")}
                          />
                          <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-13 font-semibold text-text-muted">
                            %
                          </span>
                        </div>
                      </div>
                      <div>
                        <label htmlFor={deadlineInputId} className={hpLabel}>
                          Deadline
                        </label>
                        <input
                          id={deadlineInputId}
                          type="date"
                          value={targetDeadlineInput}
                          onChange={(e) => setTargetDeadlineInput(e.target.value)}
                          className={cn(hpInput, "tabular")}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <HpButton variant="ghost" size="sm" onClick={() => setEditingTarget(false)}>
                        Cancel
                      </HpButton>
                      <HpButton
                        variant="primary"
                        size="sm"
                        onClick={handleSaveTarget}
                        disabled={savingTarget}
                        isLoading={savingTarget}
                        leftIcon={<Check className="h-3.5 w-3.5" />}
                      >
                        Save target
                      </HpButton>
                    </div>
                  </div>
                </ScCollapse>
              )}
            </AnimatePresence>
          </HpCard>

          {/* Placement funnel — real application counts per stage. */}
          <HpCard className="p-5 sm:p-6 lg:col-span-2">
            <HpSectionHeader
              icon={Filter}
              tone="indigo"
              title="Placement funnel"
              subtitle={`${plural(enrolled, "student")} enrolled · ${plural(registered, "drive application")}`}
              action={<SectionLink href="/admin/analytics">Full analytics</SectionLink>}
            />
            {registered === 0 ? (
              <PanelEmpty
                icon={Filter}
                tone="indigo"
                className="mt-6"
                title="No drive applications yet"
                description="The funnel fills in as you register eligible students for your mapped campus drives."
                action={
                  <Link href="/admin/drives" className={hpBtn("soft", "sm")}>
                    Go to Campus Drives
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_13rem]">
                <HpFunnel stages={funnelStages} />
                <div className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-5 sm:grid-cols-2 sm:items-center md:flex md:flex-col md:items-stretch md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <div className="flex items-center gap-4 md:flex-col md:items-start">
                    <HpRing value={appToPlaced} size={92} stroke={8} tone="emerald">
                      <span className="tabular text-lg font-extrabold text-primary">{appToPlaced}%</span>
                    </HpRing>
                    <div>
                      <div className="text-xs font-bold text-primary">Application → placed</div>
                      <p className="tabular mt-0.5 text-2xs leading-relaxed text-text-muted">
                        {accepted} of {plural(registered, "application")} ended in an accepted offer.
                      </p>
                    </div>
                  </div>
                  {dropOff && dropOff.rate < 100 && (
                    <div className="rounded-2xl bg-elevated/60 p-3 ring-1 ring-inset ring-border-subtle">
                      <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                        <TrendingDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" aria-hidden />
                        Biggest drop-off
                      </div>
                      <div className="mt-1 text-xs font-bold text-primary">
                        {dropOff.from} → {dropOff.to}
                      </div>
                      <div className="tabular text-2xs text-text-muted">{dropOff.rate}% carried through</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </HpCard>
        </div>
      </HpItem>

      {/* Drives + attention */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2" aria-label="Campus drives">
            <HpSectionHeader
              icon={Briefcase}
              tone="indigo"
              title="Campus drives"
              subtitle={drivesLoading ? "Loading your mapped drives…" : `${upcomingCount} upcoming · ${tpoMappedDrives.length} live on your campus`}
              action={<SectionLink href="/admin/drives">Manage all</SectionLink>}
            />
            {drivesLoading ? (
              <HpSkeletonCards count={2} className="md:grid-cols-2 xl:grid-cols-2" />
            ) : rankedDrives.length === 0 ? (
              <PanelEmpty
                icon={Briefcase}
                tone="indigo"
                className="bg-surface/60"
                title="No live drives mapped yet"
                description="Map a published drive into your campus catalog so students can see it and you can register them."
                action={
                  <Link href="/admin/drives" className={hpBtn("primary", "sm")}>
                    <Plus className="h-3.5 w-3.5" />
                    Map a drive
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {rankedDrives.slice(0, 4).map(({ m, days }) => {
                  const d = m.placement_drive;
                  const when = driveWhen(days);
                  const rd = reportDriveById.get(m.placement_drive_id);
                  const eligiblePct = rd && rd.funnel.total > 0 ? (rd.funnel.fully_eligible / rd.funnel.total) * 100 : 0;
                  return (
                    <Link
                      key={m.placement_drive_id}
                      href="/admin/drives"
                      className="group block h-full rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      <HpCard interactive className="flex h-full flex-col p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <HpCompanyLogo name={d.company.name} logo={d.company.logo} size="md" />
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-bold text-primary">{d.company.name}</h3>
                              <p className="truncate text-2xs text-text-muted">{d.role_title}</p>
                            </div>
                          </div>
                          {days !== null && <ScDateTile date={new Date(d.drive_date)} tone={when.soon ? "amber" : "sky"} />}
                        </div>
                        <p className="mt-3 truncate text-xs font-medium text-text-secondary" title={d.title}>
                          {d.title}
                        </p>
                        {rd && (
                          <div className="mt-3">
                            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-2xs">
                              <span className="text-text-muted">Eligible students</span>
                              <span className="tabular font-bold text-primary">
                                {rd.funnel.fully_eligible}
                                <span className="font-semibold text-text-muted"> / {rd.funnel.total}</span>
                              </span>
                            </div>
                            <HpProgress value={eligiblePct} tone="sky" />
                          </div>
                        )}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                          <HpPill tone={when.tone} size="sm" dot={when.soon} pulse={when.soon}>
                            {when.label}
                          </HpPill>
                          {rd?.ctc_range && <span className="tabular truncate text-2xs font-semibold text-text-secondary">{rd.ctc_range}</span>}
                        </div>
                      </HpCard>
                    </Link>
                  );
                })}
              </div>
            )}
            {!drivesLoading && rankedDrives.length > 4 && (
              <Link href="/admin/drives" className={hpBtn("ghost", "sm", "w-full")}>
                View all {rankedDrives.length} live drives
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </section>

          <div className="flex min-w-0 flex-col gap-6">
          <HpCard className="p-5 sm:p-6">
            <HpSectionHeader
              icon={AlertTriangle}
              tone="amber"
              title="Needs your attention"
              subtitle="Open items across your drives"
              action={
                actionItems.length > 0 ? (
                  <HpPill tone="rose" size="sm" dot pulse>
                    <span className="tabular">{actionItems.length}</span>
                    <span className="sr-only"> open items</span>
                  </HpPill>
                ) : undefined
              }
            />
            <ul className="mt-5 space-y-2.5 overflow-y-auto pr-1 [max-height:340px]">
              {actionItems.length === 0 ? (
                <li className="flex min-h-[150px] flex-col items-center justify-center gap-3 text-center">
                  <HpIconTile icon={PartyPopper} tone="emerald" size="lg" />
                  <div>
                    <p className="text-sm font-bold text-primary">You&apos;re all caught up</p>
                    <p className="mt-0.5 text-2xs text-text-muted">Nothing needs your attention right now.</p>
                  </div>
                </li>
              ) : (
                actionItems.map((item, i) => {
                  const meta = ATTENTION_META[item.type];
                  const Icon = meta?.icon ?? Hourglass;
                  return (
                    <li
                      key={i}
                      className="group rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-relaxed text-text-secondary">{item.message}</p>
                          {meta && (
                            <Link
                              href={meta.href}
                              className="mt-1.5 inline-flex items-center gap-0.5 rounded text-2xs font-bold text-amber-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-amber-300"
                            >
                              {meta.cta}
                              <ChevronRight className="h-3 w-3" aria-hidden />
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </HpCard>

          {/* Recruiters — PlacementReportService::companySummary (accepted offers only). */}
          <HpCard spotlight={false} className="p-5 sm:p-6">
            <HpSectionHeader
              icon={Building2}
              tone="teal"
              title="Recruiters this season"
              subtitle={`${plural(companiesHired, "company", "companies")} with accepted offers`}
            />
            {recruiters.length === 0 ? (
              <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-elevated/30 px-4 py-8 text-center">
                <HpIconTile icon={Building2} tone="slate" size="md" />
                <div>
                  <p className="text-13 font-bold text-primary">No recruiters have hired yet</p>
                  <p className="mt-0.5 text-2xs text-text-muted">Companies show up here with their first accepted offer.</p>
                </div>
              </div>
            ) : (
              <ul className="-mx-2 mt-4 space-y-0.5">
                {recruiters.slice(0, 5).map((c) => (
                  <li key={c.company} className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-elevated/60">
                    <HpCompanyLogo name={c.company} logo={logoByCompany.get(c.company) ?? null} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-13 font-bold text-primary">{c.company}</div>
                      <div className="tabular truncate text-2xs text-text-muted">{plural(c.offers_accepted, "offer")} accepted</div>
                    </div>
                    {c.max_ctc !== null && (
                      <div className="shrink-0 text-right">
                        <div className="tabular text-xs font-extrabold text-primary">{fmtLpa(c.max_ctc)} LPA</div>
                        <div className="tabular text-3xs text-text-muted">{c.avg_ctc !== null ? `avg ${fmtLpa(c.avg_ctc)}` : "top offer"}</div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </HpCard>
          </div>
        </div>
      </HpItem>

      {/* Sections + readiness */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Section Performance — ranked best-average-readiness first, same
              computeSectionStats as Placement Reports and Student Cohort, so
              the ranking is identical everywhere; the coordinator's contact
              sits right on the row. */}
          <HpCard spotlight={false} className="flex flex-col overflow-hidden lg:col-span-3">
            <div className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
              <HpSectionHeader
                icon={Trophy}
                tone="indigo"
                title="Section performance"
                subtitle="Ranked by average readiness, with each section's coordinator"
                action={<SectionLink href="/admin/reports">Full reports</SectionLink>}
              />
            </div>
            {sectionStats.length === 0 ? (
              <div className="px-5 pb-6 sm:px-6">
                <PanelEmpty
                  icon={Users2}
                  tone="sky"
                  title="No sections yet"
                  description="Sections appear here once students are on your roster."
                  action={
                    <Link href="/admin/students" className={hpBtn("soft", "sm")}>
                      Open Student Cohort
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                />
              </div>
            ) : (
              <ol className="divide-y divide-border-subtle border-t border-border-subtle">
                {sectionStats.map((s, i) => {
                  const label = s.section === "Unassigned" ? "No Section" : `Section ${s.section}`;
                  return (
                    <li
                      key={s.section}
                      className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5 transition-colors hover:bg-elevated/50 sm:flex-nowrap sm:px-6"
                    >
                      <span
                        className={cn(
                          "tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-black",
                          i === 0
                            ? "bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-[0_6px_14px_-6px_rgba(245,158,11,0.8)]"
                            : "bg-elevated text-text-muted ring-1 ring-inset ring-border-subtle"
                        )}
                        aria-label={`Rank ${i + 1}`}
                      >
                        {i + 1}
                      </span>
                      <div className="w-24 min-w-0 shrink-0">
                        <div className="truncate text-13 font-bold text-primary">{label}</div>
                        <div className="tabular text-2xs text-text-muted">{plural(s.studentCount, "student")}</div>
                      </div>
                      <div className="flex min-w-[8rem] flex-1 items-center gap-3">
                        <HpProgress value={s.avgReadiness} tone={readinessTone(s.avgReadiness)} className="flex-1" />
                        <span className="tabular w-14 shrink-0 text-right text-xs font-bold text-primary">
                          {s.avgReadiness}
                          <span className="text-3xs font-semibold text-text-muted">/100</span>
                        </span>
                      </div>
                      <div className="flex w-full min-w-0 items-center gap-2 sm:w-52 sm:shrink-0 sm:justify-end">
                        {s.coordinator ? (
                          <>
                            <HpAvatar name={s.coordinator.name} size="xs" />
                            <span className="min-w-0 truncate text-2xs font-semibold text-text-secondary">{s.coordinator.name}</span>
                            <a href={`mailto:${s.coordinator.email}`} title={`Email ${s.coordinator.name}`} aria-label={`Email ${s.coordinator.name}`} className={iconLink}>
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                            {s.coordinator.phone && (
                              <a href={`tel:${s.coordinator.phone}`} title={`Call ${s.coordinator.name}`} aria-label={`Call ${s.coordinator.name}`} className={iconLink}>
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </>
                        ) : (
                          <Link
                            href="/admin/coordinators"
                            aria-label={`No coordinator for ${label} — assign one`}
                            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            <HpPill tone="amber" size="sm" icon={UserX}>
                              No coordinator
                            </HpPill>
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {sectionStats.length > 0 && (
              <div className="mt-auto flex flex-col gap-3 border-t border-border-subtle bg-elevated/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <HpIconTile icon={UserCog} tone={sectionsCovered === sectionStats.length ? "sky" : "amber"} size="sm" />
                  <div className="min-w-0">
                    <div className="tabular text-xs font-bold text-primary">
                      {sectionsCovered} of {plural(sectionStats.length, "section")} have a coordinator
                    </div>
                    <div className="text-2xs text-text-muted">
                      {sectionsCovered === sectionStats.length
                        ? "Every section has someone students can reach."
                        : "Students in uncovered sections have no coordinator to reach."}
                    </div>
                  </div>
                </div>
                <Link href="/admin/coordinators" className={hpBtn("secondary", "sm", "self-start sm:self-auto")}>
                  <UserCog className="h-3.5 w-3.5" />
                  Manage coordinators
                </Link>
              </div>
            )}
          </HpCard>

          {/* Cohort readiness — tiers + branch averages, from per-student readiness_score. */}
          <HpCard className="p-5 sm:p-6 lg:col-span-2">
            <HpSectionHeader
              icon={BarChart3}
              tone="violet"
              title="Cohort readiness"
              subtitle="Readiness tiers and branch averages"
              action={<SectionLink href="/admin/analytics">Analytics</SectionLink>}
            />
            {students.length === 0 ? (
              <PanelEmpty
                icon={Gauge}
                tone="violet"
                className="mt-6"
                title="No readiness data yet"
                description="Scores appear as soon as students are on your roster and start practising."
              />
            ) : (
              <>
                <div className="mt-5">
                  <div
                    className="flex h-2.5 gap-[3px] overflow-hidden rounded-full bg-elevated"
                    role="img"
                    aria-label={tierCounts.map((t) => `${t.id}: ${t.count}`).join(", ")}
                  >
                    {tierCounts
                      .filter((t) => t.count > 0)
                      .map((t, i) => (
                        <motion.span
                          key={t.id}
                          className={cn("h-full rounded-full", HP_TONES[t.tone].bar)}
                          initial={reduce ? false : { width: 0 }}
                          animate={{ width: `${(t.count / students.length) * 100}%` }}
                          transition={{ duration: 0.9, ease: hpEase, delay: 0.15 + i * 0.08 }}
                        />
                      ))}
                  </div>
                  <ul className="mt-3 grid grid-cols-3 gap-2">
                    {tierCounts.map((t) => (
                      <li key={t.id} className="min-w-0 rounded-xl bg-elevated/50 px-2.5 py-2 ring-1 ring-inset ring-border-subtle">
                        <div className="flex items-start gap-1.5">
                          <span className={cn("mt-[3px] h-2 w-2 shrink-0 rounded-full", HP_TONES[t.tone].fill)} aria-hidden />
                          <span className="text-3xs font-bold uppercase leading-tight tracking-[0.06em] text-text-muted">{t.id}</span>
                        </div>
                        <div className="tabular mt-1 text-base font-extrabold leading-none text-primary">
                          {t.count}
                          <span className="ml-1 text-3xs font-semibold text-text-muted">{Math.round((t.count / students.length) * 100)}%</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6">
                  <h3 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">By branch</h3>
                  {branches.length === 0 ? (
                    <p className="mt-2 text-2xs text-text-muted">No branch on file for your students yet.</p>
                  ) : (
                    <ul className="mt-3 space-y-3.5">
                      {branches.map((b) => (
                        <li key={b.branch}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-3">
                            <span className="min-w-0 truncate text-xs font-semibold text-text-secondary" title={b.branch}>
                              {b.branch}
                            </span>
                            <span className="tabular shrink-0 text-2xs text-text-muted">
                              {plural(b.count, "student")} ·{" "}
                              <span className="font-bold text-primary">
                                {b.avg}
                                <span className="font-semibold text-text-muted">/100</span>
                              </span>
                            </span>
                          </div>
                          <HpProgress value={b.avg} tone={readinessTone(b.avg)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </HpCard>
        </div>
      </HpItem>

      {/* Wins + packages */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <HpCard spotlight={false} className="flex flex-col overflow-hidden lg:col-span-3">
            <div className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
              <HpSectionHeader
                icon={Sparkles}
                tone="emerald"
                title="Recent placement wins"
                subtitle="Latest accepted offers"
                action={<SectionLink href="/admin/students">View cohort</SectionLink>}
              />
            </div>
            {recentPlacements.length === 0 ? (
              <div className="px-5 pb-6 sm:px-6">
                <PanelEmpty
                  icon={Trophy}
                  tone="slate"
                  title="No offers accepted yet this season"
                  description="Your first placement will be celebrated here."
                />
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                  {recentPlacements.slice(0, 6).map((p, i) => (
                    <li key={i} className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-elevated/60 sm:px-6">
                      <HpAvatar name={p.student_name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-13 font-bold text-primary">{p.student_name}</div>
                        <div className="truncate text-2xs text-text-muted">
                          {p.company} · {p.role_title}
                          {p.branch && <span className="hidden sm:inline"> · {p.branch}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <HpPill tone="emerald" size="sm" icon={CheckCircle2}>
                          <span className="tabular">{p.ctc_offered} LPA</span>
                        </HpPill>
                        <span className="tabular text-3xs text-text-muted">{formatDate(p.placed_at, false)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {recentPlacements.length > 6 && (
                  <div className="border-t border-border-subtle px-4 py-2.5 sm:px-5">
                    <Link href="/admin/reports" className={hpBtn("ghost", "sm", "w-full")}>
                      See all {recentPlacements.length} recent placements
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
                {/* Season so far — exact aggregates of companySummary (avg is offer-weighted). */}
                <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border-subtle bg-elevated/30 px-4 py-4 sm:gap-3 sm:px-6">
                  <ScMetric icon={CheckCircle2} tone="emerald" label="Offers" value={offerCount} />
                  <ScMetric icon={Trophy} tone="amber" label="Highest" value={topPackage !== null ? `${fmtLpa(topPackage)} LPA` : "—"} />
                  <ScMetric icon={IndianRupee} tone="sky" label="Average" value={avgPackage !== null ? `${fmtLpa(avgPackage)} LPA` : "—"} />
                </div>
              </>
            )}
          </HpCard>

          {/* Offer packages — PlacementReportService::packageDistribution. */}
          <HpCard className="p-5 sm:p-6 lg:col-span-2">
            <HpSectionHeader
              icon={IndianRupee}
              tone="sky"
              title="Offer packages"
              subtitle="Accepted offers by CTC bracket"
              action={
                packageTotal > 0 ? <span className="tabular text-2xs font-semibold text-text-muted">{plural(packageTotal, "offer")}</span> : undefined
              }
            />
            {packageTotal === 0 ? (
              <PanelEmpty
                icon={IndianRupee}
                tone="sky"
                className="mt-6"
                title="No accepted offers yet"
                description="The package spread appears once offers are accepted."
              />
            ) : (
              <>
                <div
                  className="mt-6 flex h-40 items-end gap-2 border-b border-border-subtle sm:gap-3"
                  role="img"
                  aria-label={`Accepted offers by CTC bracket: ${packages.map((p) => `${p.bracket} ${p.count}`).join(", ")}`}
                >
                  {packages.map((p, i) => {
                    const height = p.count > 0 ? Math.max(6, (p.count / packageMax) * 100) : 0;
                    return (
                      <div key={p.bracket} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                        {p.count > 0 && <span className="tabular mb-1 text-2xs font-bold text-primary">{p.count}</span>}
                        <motion.div
                          className="w-full max-w-[44px] rounded-t-[5px] bg-gradient-to-t from-sky-500 to-sky-400 transition-[filter] duration-200 group-hover:brightness-110"
                          initial={{ height: reduce ? `${height}%` : 0 }}
                          whileInView={{ height: `${height}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, ease: hpEase, delay: i * 0.06 }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2 sm:gap-3" aria-hidden>
                  {packages.map((p) => (
                    <span key={p.bracket} className="flex-1 text-center text-3xs font-semibold leading-tight text-text-muted">
                      {p.bracket}
                    </span>
                  ))}
                </div>
              </>
            )}
          </HpCard>
        </div>
      </HpItem>

      <HpItem>{quickLinks}</HpItem>
      {toast}
    </HpStagger>
  );
}
