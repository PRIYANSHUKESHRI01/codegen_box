"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Upload,
  Download,
  CheckCircle2,
  Mail,
  ShieldAlert,
  UserPlus,
  Phone,
  UserX,
  BarChart3,
  Users,
  BadgeCheck,
  GraduationCap,
  Layers,
  Gauge,
  SlidersHorizontal,
  SearchX,
  X,
  GitBranch,
  LayoutGrid,
  Check,
  Minus,
  AlertTriangle,
  UserRound,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StudentProfileDrawer } from "@/components/dashboard/tpo/StudentProfileDrawer";
import { BulkImportStudentsPanel } from "@/components/dashboard/tpo/BulkImportStudentsPanel";
import { AddStudentModal } from "@/components/dashboard/tpo/AddStudentModal";
import { BulkNotifyModal } from "@/components/dashboard/tpo/BulkNotifyModal";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { CohortStudent } from "@/types/cohort";
import { computeSectionStats, type SectionCoordinatorInfo } from "@/lib/sectionBreakdown";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import {
  HP_TONES,
  HpAvatar,
  HpButton,
  HpCard,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpSearch,
  HpSectionHeader,
  HpSkeleton,
  HpStagger,
  HpStatCard,
  HpToast,
  hpBtn,
  hpEase,
  hpTh,
  type HpTone,
} from "@/components/portal/kit";
import { HpErrorCard, HpSelect } from "@/components/portal/pipeline-kit";

const BRANCHES = ["ALL", "CSE", "IT", "ECE", "EE", "MECH", "CIVIL"] as const;
const TIERS = ["ALL", "Placement Ready", "In Progress", "Needs Training"] as const;

/** Tier → tone: emerald only for the positive outcome, sky (the TPO identity) for in-flight, amber for attention. */
const TIER_TONE: Record<CohortStudent["readiness_tier"], HpTone> = {
  "Placement Ready": "emerald",
  "In Progress": "sky",
  "Needs Training": "amber",
};

/** Same 75 / 45 cut-offs the roster's readiness bar has always used. */
const scoreTone = (score: number): HpTone => (score >= 75 ? "emerald" : score >= 45 ? "sky" : "amber");

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export default function StudentCohortPage() {
  const { user, status } = useAuthGuard(["admin_tpo"]);
  const [students, setStudents] = useState<CohortStudent[]>([]);
  const [coordinators, setCoordinators] = useState<(SectionCoordinatorInfo & { section: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  // The input itself stays instantly responsive (bound to `search` directly
  // in the JSX below) — only the actual re-filtering of the cohort array
  // uses this debounced value, so a fast typist isn't re-scanning the whole
  // list on every keystroke.
  const debouncedSearch = useDebouncedValue(search, 250);
  const [branchFilter, setBranchFilter] = useState<(typeof BRANCHES)[number]>("ALL");
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [tierFilter, setTierFilter] = useState<(typeof TIERS)[number]>("ALL");
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeStudent, setActiveStudent] = useState<CohortStudent | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notifyConfirm, setNotifyConfirm] = useState<{ ids: number[]; label: string; students: CohortStudent[] } | null>(
    null
  );
  const [exporting, setExporting] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);

  const AT_RISK_THRESHOLD = 60;

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [studentsRes, coordinatorsRes] = await Promise.all([
        api.get<{ students: CohortStudent[] }>("/tpo/students/cohort"),
        api.get<{ coordinators: (SectionCoordinatorInfo & { section: string })[] }>("/tpo/coordinators"),
      ]);
      setStudents(studentsRes.students);
      setCoordinators(coordinatorsRes.coordinators);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load the student cohort.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadStudents();
  }, [status, loadStudents]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  // Sections aren't a fixed enum like BRANCHES — every college names its own
  // (A/B/C, or CSE-1/CSE-2), so the filter's option list is derived from
  // whatever the cohort actually has on file, never hardcoded.
  const sections = Array.from(new Set(students.map((s) => s.section).filter((s): s is string => !!s))).sort();

  const filtered = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      (s.roll_number ?? "").toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchBranch = branchFilter === "ALL" || s.branch === branchFilter;
    const matchSection = sectionFilter === "ALL" || s.section === sectionFilter;
    const matchTier = tierFilter === "ALL" || s.readiness_tier === tierFilter;
    const matchEligible = !eligibleOnly || s.eligible_for_active_drive === true;
    const matchScore = s.readiness_score >= minScore && s.readiness_score <= maxScore;
    return matchSearch && matchBranch && matchSection && matchTier && matchEligible && matchScore;
  });

  const eligibleCount = students.filter((s) => s.eligible_for_active_drive === true).length;
  const needsTrainingCount = students.filter((s) => s.readiness_tier === "Needs Training").length;
  const blockedCount = students.filter((s) => s.is_blocked).length;

  // Per-section snapshot (ranked best-average-readiness first, shared with
  // the Placement Reports page's Section Performance list and the Academic
  // Report PDF — see computeSectionStats) — the "see students section-wise
  // at a glance" affordance: click a chip to filter the table down to that
  // section instead of hunting through the dropdown + scrolling. Excludes
  // the "Unassigned" bucket from the ranked chips (shown separately below,
  // same as before) since it isn't a real section a coordinator manages.
  const allSectionStats = computeSectionStats(students, coordinators);
  const sectionBreakdown = allSectionStats.filter((s) => s.section !== "Unassigned");
  const unassignedSectionCount = allSectionStats.find((s) => s.section === "Unassigned")?.studentCount ?? 0;

  // The filtered section's coordinator — surfaced so a TPO who's just
  // narrowed the table down to one section can immediately see (and
  // contact) whoever manages it, without a separate trip to Coordinators.
  const activeSectionCoordinator = sectionFilter !== "ALL" ? coordinators.find((c) => c.section === sectionFilter) ?? null : null;

  const hasActiveFilters =
    search !== "" ||
    branchFilter !== "ALL" ||
    sectionFilter !== "ALL" ||
    tierFilter !== "ALL" ||
    eligibleOnly ||
    minScore !== 0 ||
    maxScore !== 100;

  const clearFilters = () => {
    setSearch("");
    setBranchFilter("ALL");
    setSectionFilter("ALL");
    setTierFilter("ALL");
    setEligibleOnly(false);
    setMinScore(0);
    setMaxScore(100);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  };

  const handleNotifySent = (message: string) => {
    triggerToast(message);
    setSelectedIds(new Set());
    setNotifyConfirm(null);
  };

  const openNotify = (ids: number[], label: string) => {
    setNotifyConfirm({ ids, label, students: students.filter((s) => ids.includes(s.id)) });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // ExcelJS (~250kB) only ever loaded when someone actually clicks
      // Export, instead of bundled into every visit to this page.
      const { generateStudentsExcel } = await import("@/lib/generateStudentsExcel");
      await generateStudentsExcel(filtered, user?.college?.name ?? "college");
      triggerToast(`Downloaded an Excel sheet of ${filtered.length} student(s).`);
    } finally {
      setExporting(false);
    }
  };

  // ── Presentation-only derivations (all from the loaded cohort) ──
  const scrollToImport = () => document.getElementById("bulk-import")?.scrollIntoView({ behavior: "smooth" });
  const placementReadyCount = students.filter((s) => s.readiness_tier === "Placement Ready").length;
  const inProgressCount = students.filter((s) => s.readiness_tier === "In Progress").length;
  const avgReadiness = students.length ? Math.round(students.reduce((sum, s) => sum + s.readiness_score, 0) / students.length) : 0;
  const tierCounts: Record<CohortStudent["readiness_tier"], number> = {
    "Placement Ready": placementReadyCount,
    "In Progress": inProgressCount,
    "Needs Training": needsTrainingCount,
  };
  const allFilteredSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0 && !allFilteredSelected;
  const atRiskActive = maxScore === AT_RISK_THRESHOLD - 1 && minScore === 0;
  const showInsights = !loading && !loadError && students.length > 0;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Student Cohort"
      subtitle="Search, filter, and manage placement readiness across your batch."
      actionButton={{
        label: "Import Students",
        icon: Upload,
        onClick: () => document.getElementById("bulk-import")?.scrollIntoView({ behavior: "smooth" }),
      }}
    >
      <HpToast message={toastMessage} tone="indigo" />

      <HpStagger className="space-y-6">
        {/* KPI strip */}
        <HpItem>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <HpStatCard
              label="Total cohort"
              value={students.length}
              icon={Users}
              tone="sky"
              loading={loading}
              hint={loading ? undefined : `${placementReadyCount} placement ready`}
            />
            <button
              type="button"
              onClick={() => setEligibleOnly(!eligibleOnly)}
              aria-pressed={eligibleOnly}
              title="Click to filter the table to students eligible for at least one active drive"
              className="block h-full rounded-[20px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <HpStatCard
                label="Eligible · active drives"
                value={eligibleCount}
                icon={BadgeCheck}
                tone="emerald"
                loading={loading}
                hint={
                  eligibleOnly ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">Filtering roster · tap to clear</span>
                  ) : (
                    "Tap to filter the roster"
                  )
                }
                className={cn("h-full", eligibleOnly && "border-emerald-500/40 bg-emerald-500/[0.04] ring-2 ring-emerald-500/20")}
              />
            </button>
            <HpStatCard
              label="Needs training"
              value={needsTrainingCount}
              icon={GraduationCap}
              tone="amber"
              loading={loading}
              hint={loading ? undefined : `${pct(needsTrainingCount, students.length)}% of the cohort`}
            />
            <HpStatCard
              label="Blocked accounts"
              value={blockedCount}
              icon={ShieldAlert}
              tone={blockedCount > 0 ? "rose" : "slate"}
              loading={loading}
              hint={loading ? undefined : blockedCount > 0 ? "accounts locked out" : "every account active"}
            />
          </div>
        </HpItem>

        {/* Sections at a glance + readiness mix */}
        {showInsights && (
          <HpItem>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {sections.length > 0 && (
                <HpCard spotlight={false} className="flex flex-col p-4 sm:p-5 xl:col-span-2">
                  <HpSectionHeader
                    title="Sections at a glance"
                    subtitle="Ranked by average readiness — select one to focus the roster"
                    icon={Layers}
                    tone="sky"
                    action={
                      sectionFilter !== "ALL" ? (
                        <HpButton variant="ghost" size="sm" onClick={() => setSectionFilter("ALL")} leftIcon={<X className="h-3.5 w-3.5" />}>
                          <span className="hidden sm:inline">Clear section filter</span>
                          <span className="sm:hidden">Clear</span>
                        </HpButton>
                      ) : undefined
                    }
                  />

                  <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(100%,12rem),1fr))] gap-2.5">
                    {sectionBreakdown.map(({ section, studentCount, avgReadiness: sectionAvg, coordinator }) => {
                      const active = sectionFilter === section;
                      return (
                        <button
                          key={section}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSectionFilter(sectionFilter === section ? "ALL" : section)}
                          title={coordinator ? `Coordinator: ${coordinator.name}` : "No coordinator assigned"}
                          className={cn(
                            "group flex min-w-0 flex-col gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                            active
                              ? "border-indigo-500/40 bg-indigo-500/[0.07] shadow-[0_8px_20px_-12px_rgba(79,70,229,0.7)]"
                              : "border-border-subtle bg-[rgb(var(--bg-surface-rgb))] hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated/50"
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  "flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg px-1.5 text-2xs font-extrabold ring-1 ring-inset transition-colors",
                                  active
                                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white ring-white/25"
                                    : "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300"
                                )}
                                aria-hidden
                              >
                                {section.slice(0, 3).toUpperCase()}
                              </span>
                              <span className="truncate text-13 font-bold text-primary">Section {section}</span>
                            </span>
                            <span className="tabular shrink-0 text-2xs font-semibold text-text-muted">
                              {studentCount} {studentCount === 1 ? "student" : "students"}
                            </span>
                          </span>

                          <span className="block">
                            <span className="mb-1.5 flex items-baseline justify-between gap-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                              <span>Avg readiness</span>
                              <span className={cn("tabular text-xs normal-case tracking-normal", HP_TONES[scoreTone(sectionAvg)].text)}>~{sectionAvg}</span>
                            </span>
                            <MeterBar value={sectionAvg} tone={scoreTone(sectionAvg)} />
                          </span>

                          <span className="flex min-w-0 items-center gap-1.5 text-2xs">
                            {coordinator ? (
                              <>
                                <HpAvatar name={coordinator.name} size="xs" />
                                <span className="truncate font-medium text-text-secondary">{coordinator.name}</span>
                              </>
                            ) : (
                              <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-300">
                                <UserX className="h-3.5 w-3.5 shrink-0" />
                                No coordinator
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}

                    {unassignedSectionCount > 0 && (
                      <div className="flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-dashed border-border-strong bg-elevated/30 p-3.5">
                        <span className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-elevated text-text-muted ring-1 ring-inset ring-border-subtle" aria-hidden>
                              <Minus className="h-3.5 w-3.5" />
                            </span>
                            <span className="text-13 font-bold text-text-secondary">No Section</span>
                          </span>
                          <span className="tabular text-2xs font-semibold text-text-muted">{unassignedSectionCount}</span>
                        </span>
                        <span className="text-2xs leading-relaxed text-text-muted">Students without a section on file.</span>
                      </div>
                    )}
                  </div>

                  {/* Coordinator contact for the currently-filtered section — the
                      whole point of tying reports/cohort to coordinators: make it a
                      one-look, one-click action instead of a trip to Coordinators. */}
                  <AnimatePresence initial={false}>
                    {sectionFilter !== "ALL" && (
                      <motion.div
                        key="coordinator"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: hpEase }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-border-subtle bg-elevated/40 p-3.5 sm:flex-row sm:items-center">
                          <span className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted sm:w-28 sm:shrink-0">
                            Section {sectionFilter} coordinator
                          </span>
                          {activeSectionCoordinator ? (
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                              <span className="mr-1 flex min-w-0 items-center gap-2">
                                <HpAvatar name={activeSectionCoordinator.name} size="sm" />
                                <span className="truncate text-13 font-bold text-primary">{activeSectionCoordinator.name}</span>
                              </span>
                              <a href={`mailto:${activeSectionCoordinator.email}`} className={hpBtn("secondary", "sm", "min-w-0 max-w-full")}>
                                <Mail className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{activeSectionCoordinator.email}</span>
                              </a>
                              {activeSectionCoordinator.phone && (
                                <a href={`tel:${activeSectionCoordinator.phone}`} className={hpBtn("secondary", "sm")}>
                                  <Phone className="h-3.5 w-3.5" />
                                  {activeSectionCoordinator.phone}
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-300">
                              <UserX className="h-4 w-4 shrink-0" />
                              No coordinator assigned to this section yet.
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-auto pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3.5 text-2xs text-text-muted">
                    <span className="tabular">
                      <span className="font-bold text-primary">{sectionBreakdown.length}</span> {sectionBreakdown.length === 1 ? "section" : "sections"} ·{" "}
                      <span className="font-bold text-primary">{sectionBreakdown.filter((s) => s.coordinator).length}</span> with a coordinator
                    </span>
                    <Link
                      href="/admin/coordinators"
                      className="inline-flex items-center gap-1 rounded-md font-semibold text-indigo-600 transition-colors hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300 dark:hover:text-indigo-200"
                    >
                      Manage coordinators
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  </div>
                </HpCard>
              )}

              {/* Readiness mix — the cohort split by tier; a row filters the roster */}
              <HpCard spotlight={false} className={cn("flex flex-col p-4 sm:p-5", sections.length === 0 && "xl:col-span-3")}>
                <HpSectionHeader title="Readiness mix" subtitle={`Cohort average ${avgReadiness}/100`} icon={Gauge} tone="violet" />

                <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-elevated [&>*+*]:border-l-2 [&>*+*]:border-[rgb(var(--bg-surface-rgb))]" aria-hidden>
                  {(TIERS.slice(1) as CohortStudent["readiness_tier"][]).map((t) =>
                    tierCounts[t] > 0 ? (
                      <motion.div
                        key={t}
                        className={cn("h-full", HP_TONES[TIER_TONE[t]].fill)}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct(tierCounts[t], students.length)}%` }}
                        transition={{ duration: 0.8, ease: hpEase }}
                      />
                    ) : null
                  )}
                </div>

                <ul className="mt-4 space-y-1">
                  {(TIERS.slice(1) as CohortStudent["readiness_tier"][]).map((t) => {
                    const active = tierFilter === t;
                    return (
                      <li key={t}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setTierFilter(active ? "ALL" : t)}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                            active ? "bg-indigo-500/[0.08] ring-1 ring-inset ring-indigo-500/25" : "hover:bg-elevated/70"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", HP_TONES[TIER_TONE[t]].fill)} />
                            <span className="truncate text-xs font-semibold text-text-secondary">{t}</span>
                          </span>
                          <span className="flex shrink-0 items-baseline gap-2">
                            <span className="tabular text-3xs font-semibold text-text-muted">{pct(tierCounts[t], students.length)}%</span>
                            <span className="tabular w-8 text-right text-sm font-extrabold text-primary">{tierCounts[t]}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-auto pt-4 text-2xs leading-relaxed text-text-muted">
                  Select a tier to focus the roster on it.
                </p>
              </HpCard>
            </div>
          </HpItem>
        )}

        {/* Roster */}
        <HpItem>
          <HpCard spotlight={false} className="overflow-hidden">
            {/* Header + bulk actions */}
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <HpIconTile icon={Users} tone="sky" size="sm" />
                <div className="min-w-0">
                  <h2 className="text-15 font-bold tracking-tight text-primary">Roster</h2>
                  {/* Result count — every active filter is visible and
                      undoable in one click (Clear all filters, below),
                      instead of a TPO having to mentally track which
                      controls they touched. */}
                  <p className="text-2xs text-text-muted" aria-live="polite">
                    Showing <span className="tabular font-bold text-primary">{filtered.length}</span> of{" "}
                    <span className="tabular font-bold text-primary">{students.length}</span> students
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <HpButton
                  variant="secondary"
                  size="sm"
                  onClick={() => openNotify(filtered.map((s) => s.id), `all ${filtered.length} filtered student(s)`)}
                  disabled={filtered.length === 0}
                  leftIcon={<Mail className="h-3.5 w-3.5" />}
                >
                  Notify All Filtered <span className="tabular opacity-70">({filtered.length})</span>
                </HpButton>
                <HpButton
                  variant="secondary"
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting || filtered.length === 0}
                  isLoading={exporting}
                  leftIcon={<Download className="h-3.5 w-3.5" />}
                >
                  Download Excel <span className="tabular opacity-70">({filtered.length})</span>
                </HpButton>
                <HpButton size="sm" onClick={() => setShowAddStudent(true)} leftIcon={<UserPlus className="h-3.5 w-3.5" />}>
                  Add Student
                </HpButton>
              </div>
            </div>

            {/* Filter bar */}
            <div className="space-y-3 border-y border-border-subtle bg-elevated/30 px-4 py-3.5 sm:px-5">
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
                <HpSearch
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, roll no, or email..."
                  aria-label="Search students by name, roll number or email"
                  wrapperClassName="min-w-0 flex-1"
                />
                <div className="grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-3 lg:flex lg:items-center">
                  <HpSelect
                    aria-label="Filter by branch"
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value as (typeof BRANCHES)[number])}
                    leading={<GitBranch className="h-3.5 w-3.5 text-text-muted" />}
                    wrapperClassName="lg:w-40"
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b === "ALL" ? "All Branches" : b}
                      </option>
                    ))}
                  </HpSelect>
                  <HpSelect
                    aria-label="Filter by section"
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                    leading={<LayoutGrid className="h-3.5 w-3.5 text-text-muted" />}
                    wrapperClassName="lg:w-40"
                  >
                    <option value="ALL">All Sections</option>
                    {sections.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </HpSelect>
                  <HpSelect
                    aria-label="Filter by readiness status"
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value as (typeof TIERS)[number])}
                    leading={
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          tierFilter === "ALL" ? "bg-border-strong" : HP_TONES[TIER_TONE[tierFilter]].fill
                        )}
                      />
                    }
                    wrapperClassName="lg:w-48"
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t === "ALL" ? "All Statuses" : t}
                      </option>
                    ))}
                  </HpSelect>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-0.5 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                  <SlidersHorizontal className="h-3 w-3" />
                  Refine
                </span>
                <FilterChip
                  active={eligibleOnly}
                  tone="emerald"
                  icon={CheckCircle2}
                  onClick={() => setEligibleOnly(!eligibleOnly)}
                  title="Students eligible for at least one currently active drive mapped to your college"
                >
                  Eligible Only
                </FilterChip>
                <FilterChip
                  active={atRiskActive}
                  tone="rose"
                  icon={ShieldAlert}
                  onClick={() => {
                    setMinScore(0);
                    setMaxScore(AT_RISK_THRESHOLD - 1);
                  }}
                  title={`Same threshold used by the weekly readiness report (< ${AT_RISK_THRESHOLD}%)`}
                >
                  At Risk (&lt;{AT_RISK_THRESHOLD}%)
                </FilterChip>

                {/* Readiness score range filter — the TPO sets their own threshold */}
                <div
                  role="group"
                  aria-label="Readiness score range"
                  className="flex items-center gap-1.5 rounded-full bg-[rgb(var(--bg-surface-rgb))] py-0.5 pl-3 pr-1 text-2xs ring-1 ring-inset ring-border-subtle focus-within:ring-indigo-500/40"
                >
                  <Gauge className="h-3 w-3 text-text-muted" aria-hidden />
                  <span className="font-semibold text-text-muted">Readiness</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minScore}
                    aria-label="Minimum readiness score"
                    onChange={(e) => setMinScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="tabular h-6 w-12 rounded-full bg-elevated text-center text-2xs font-bold text-primary outline-none ring-1 ring-inset ring-border-subtle transition-shadow focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <span className="text-text-muted" aria-hidden>
                    –
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={maxScore}
                    aria-label="Maximum readiness score"
                    onChange={(e) => setMaxScore(Math.max(0, Math.min(100, Number(e.target.value) || 100)))}
                    className="tabular h-6 w-12 rounded-full bg-elevated text-center text-2xs font-bold text-primary outline-none ring-1 ring-inset ring-border-subtle transition-shadow focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                <AnimatePresence>
                  {hasActiveFilters && (
                    <motion.button
                      type="button"
                      onClick={clearFilters}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2, ease: hpEase }}
                      className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold text-text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-rose-300"
                    >
                      <X className="h-3 w-3" />
                      Clear all filters
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Body */}
            {loading ? (
              <RosterSkeleton />
            ) : loadError ? (
              <div className="p-4 sm:p-5">
                <HpErrorCard message={loadError} onRetry={loadStudents} />
              </div>
            ) : filtered.length === 0 ? (
              students.length === 0 ? (
                <div className="p-4 sm:p-5">
                  <HpEmptyState
                    icon={GraduationCap}
                    tone="sky"
                    title="No students imported yet"
                    description="Add a student by hand, or import your whole batch from a CSV — every new student gets an emailed login the moment their account is created."
                    action={
                      <>
                        <HpButton onClick={() => setShowAddStudent(true)} leftIcon={<UserPlus className="h-4 w-4" />}>
                          Add Student
                        </HpButton>
                        <HpButton variant="secondary" onClick={scrollToImport} leftIcon={<Upload className="h-4 w-4" />}>
                          Import Students
                        </HpButton>
                      </>
                    }
                    className="border-dashed shadow-none"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <HpIconTile icon={SearchX} tone="slate" size="lg" />
                  <p className="mt-4 text-sm font-bold text-primary">No students match your filters</p>
                  <p className="mt-1 max-w-sm text-2xs leading-relaxed text-text-muted">
                    Nobody in the cohort matches the current search and filters. Loosen one, or start over.
                  </p>
                  <HpButton variant="secondary" size="sm" className="mt-4" onClick={clearFilters} leftIcon={<X className="h-3.5 w-3.5" />}>
                    Clear all filters
                  </HpButton>
                </div>
              )
            ) : (
              <>
                {/* Wide screens: a real table */}
                <div className="hidden overflow-x-auto xl:block">
                  <table className="w-full text-left">
                    <thead className="border-b border-border-subtle bg-elevated/40">
                      <tr>
                        <th scope="col" className="w-12 py-3 pl-5 pr-1">
                          <SelectBox
                            checked={allFilteredSelected}
                            indeterminate={someSelected}
                            onChange={toggleSelectAll}
                            label={`Select all ${filtered.length} filtered students`}
                          />
                        </th>
                        <th scope="col" className={cn(hpTh, "px-4")}>
                          Student
                        </th>
                        <th scope="col" className={cn(hpTh, "px-4")}>
                          Branch · Section
                        </th>
                        <th scope="col" className={cn(hpTh, "px-4")}>
                          CGPA
                        </th>
                        <th scope="col" className={cn(hpTh, "px-4")}>
                          Readiness
                        </th>
                        <th scope="col" className={cn(hpTh, "px-4")}>
                          Status · Eligibility
                        </th>
                        <th scope="col" className={cn(hpTh, "px-4 text-right")}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {filtered.map((s) => {
                        const selected = selectedIds.has(s.id);
                        return (
                          <tr
                            key={s.id}
                            className={cn(
                              "group transition-colors duration-200",
                              selected ? "bg-indigo-500/[0.05]" : "hover:bg-sky-500/[0.035]"
                            )}
                          >
                            <td className="py-3 pl-5 pr-1">
                              <SelectBox checked={selected} onChange={() => toggleSelect(s.id)} label={`Select ${s.name}`} />
                            </td>
                            <td className="max-w-[17rem] px-4 py-3">
                              <StudentIdentity student={s} onOpen={() => setActiveStudent(s)} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-start gap-1">
                                <BranchChip branch={s.branch} className="max-w-[10rem]" />
                                <SectionChip section={s.section} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <CgpaCell student={s} />
                            </td>
                            <td className="px-4 py-3">
                              <ReadinessCell score={s.readiness_score} practice={s.practice_score} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-start gap-1.5">
                                <StatusCell student={s} />
                                <EligibilityCell student={s} />
                              </div>
                            </td>
                            <td className="py-3 pl-4 pr-5">
                              <RowActions student={s} onProfile={() => setActiveStudent(s)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Narrower screens: stacked roster cards */}
                <div className="xl:hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-elevated/40 px-4 py-2.5 sm:px-5">
                    <SelectBox
                      checked={allFilteredSelected}
                      indeterminate={someSelected}
                      onChange={toggleSelectAll}
                      label={`Select all ${filtered.length} filtered students`}
                      visibleLabel={`Select all (${filtered.length})`}
                    />
                  </div>
                  <ul className="divide-y divide-border-subtle">
                    {filtered.map((s) => {
                      const selected = selectedIds.has(s.id);
                      return (
                        <li
                          key={s.id}
                          className={cn("flex items-start gap-3 px-4 py-4 transition-colors sm:px-5", selected && "bg-indigo-500/[0.05]")}
                        >
                          <div className="pt-2.5">
                            <SelectBox checked={selected} onChange={() => toggleSelect(s.id)} label={`Select ${s.name}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <StudentIdentity student={s} onOpen={() => setActiveStudent(s)} />
                              <ScoreRing value={s.readiness_score} />
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                              <BranchChip branch={s.branch} />
                              <SectionChip section={s.section} />
                              <span className="tabular inline-flex items-center gap-1 rounded-md bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
                                <GraduationCap className="h-3 w-3" aria-hidden />
                                CGPA {s.cgpa ?? "—"}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <StatusCell student={s} />
                              <EligibilityCell student={s} />
                            </div>
                            <div className="mt-3">
                              <RowActions student={s} onProfile={() => setActiveStudent(s)} align="start" />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </HpCard>
        </HpItem>

        {/* Onboarding — the header's "Import Students" button scrolls here */}
        <HpItem>
          <section id="bulk-import" aria-labelledby="add-students-heading" className="scroll-mt-24 space-y-4">
            <HpCard spotlight={false} className="relative overflow-hidden p-4 sm:p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_140%_at_0%_0%,rgb(var(--hp-id)/0.10),transparent_60%)]"
              />
              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3.5">
                  <HpIconTile icon={UserPlus} tone="sky" size="md" />
                  <div className="min-w-0">
                    <h3 id="add-students-heading" className="text-15 font-bold tracking-tight text-primary">
                      Add Students
                    </h3>
                    <p className="mt-0.5 max-w-2xl text-2xs leading-relaxed text-text-muted">
                      Add one student by hand, or import your whole batch via CSV below — either way they get an emailed
                      login the moment their account is created.
                    </p>
                  </div>
                </div>
                <HpButton onClick={() => setShowAddStudent(true)} leftIcon={<UserPlus className="h-4 w-4" />} className="self-start sm:self-auto">
                  Add Student
                </HpButton>
              </div>
            </HpCard>

            <BulkImportStudentsPanel collegeName={user?.college?.name ?? "your college"} variant="premium" />
          </section>
        </HpItem>

        {/* Room for the floating selection bar so it never covers the last row */}
        {selectedIds.size > 0 && <div aria-hidden className="h-16" />}
      </HpStagger>

      {/* Floating selection toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 md:pl-rail">
            <motion.div
              role="region"
              aria-label="Selected students"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.28, ease: hpEase }}
              className="pointer-events-auto flex w-full max-w-lg items-center gap-2 rounded-2xl border border-border-strong bg-[rgb(var(--bg-surface-rgb))]/95 p-2 pl-3 shadow-[0_18px_50px_-12px_rgba(39,47,92,0.45)] backdrop-blur-xl"
            >
              <span className="tabular flex h-8 min-w-8 items-center justify-center rounded-[10px] bg-gradient-to-b from-indigo-500 to-violet-600 px-2 text-xs font-extrabold text-white shadow-[0_6px_14px_-6px_rgba(99,102,241,0.8)]">
                {selectedIds.size}
              </span>
              <span className="min-w-0 truncate text-13 font-semibold text-primary">selected</span>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <HpButton variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </HpButton>
                <HpButton
                  size="sm"
                  onClick={() => openNotify(Array.from(selectedIds), `${selectedIds.size} selected student(s)`)}
                  leftIcon={<Mail className="h-3.5 w-3.5" />}
                >
                  Notify Selected
                </HpButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AddStudentModal
        open={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        onAdded={(student) => {
          setStudents((prev) => [student, ...prev]);
          triggerToast(`${student.name} added — login credentials emailed to ${student.email}.`);
        }}
      />

      {/* Bulk-notify confirmation modal */}
      {notifyConfirm && (
        <BulkNotifyModal target={notifyConfirm} onClose={() => setNotifyConfirm(null)} onSent={handleNotifySent} variant="premium" />
      )}

      {/* Profile drawer */}
      <StudentProfileDrawer
        student={activeStudent}
        onClose={() => setActiveStudent(null)}
        collegeName={user?.college?.name ?? "your college"}
        variant="premium"
      />
    </DashboardShell>
  );
}

/* ── Local presentation pieces ──────────────────────────────────────────── */

/** Thin bar that fills in on mount (instant under reduced motion). `value` is 0–100. */
function MeterBar({ value, tone, className }: { value: number; tone: HpTone; className?: string }) {
  const reduce = useReducedMotion();
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-elevated", className)} aria-hidden>
      <motion.span
        className={cn("block h-full rounded-full", HP_TONES[tone].bar)}
        initial={reduce ? false : { width: 0 }}
        animate={{ width }}
        transition={{ duration: 0.8, ease: hpEase }}
      />
    </span>
  );
}

/**
 * Static SVG readiness ring for roster rows. Deliberately not the animated
 * HpRing — a cohort can run to four figures, and one motion value per row
 * isn't worth the cost in a table.
 */
function ScoreRing({ value, size = 40 }: { value: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const tone = scoreTone(v);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`Readiness score ${v}/100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border-subtle" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={HP_TONES[tone].hex}
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
        />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-2xs font-extrabold text-primary">
        <span className="sr-only">Readiness </span>
        {v}
      </span>
    </span>
  );
}

/** A real (visually hidden) checkbox with the kit's painted box — keeps keyboard + screen-reader semantics. */
function SelectBox({
  checked,
  indeterminate = false,
  onChange,
  label,
  visibleLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  visibleLabel?: string;
}) {
  const on = checked || indeterminate;
  return (
    <label className="group/check inline-flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        aria-checked={indeterminate ? "mixed" : checked}
      />
      <span
        aria-hidden
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))]",
          on
            ? "border-transparent bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-[0_4px_10px_-4px_rgba(79,70,229,0.7)]"
            : "border-border-strong bg-[rgb(var(--bg-surface-rgb))] group-hover/check:border-indigo-500/50"
        )}
      >
        {indeterminate ? (
          <Minus className="h-3 w-3" strokeWidth={3.2} />
        ) : (
          <Check className={cn("h-3 w-3 transition-transform duration-200", checked ? "scale-100" : "scale-0")} strokeWidth={3.2} />
        )}
      </span>
      {visibleLabel && <span className="text-2xs font-semibold text-text-secondary">{visibleLabel}</span>}
    </label>
  );
}

function FilterChip({
  active,
  tone,
  icon: Icon,
  onClick,
  title,
  children,
}: {
  active: boolean;
  tone: "emerald" | "rose";
  icon: LucideIcon;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-2xs font-semibold ring-1 ring-inset transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95",
        active
          ? tone === "emerald"
            ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 shadow-[0_4px_12px_-6px_rgba(16,185,129,0.6)] dark:text-emerald-300"
            : "bg-rose-500/10 text-rose-700 ring-rose-500/30 shadow-[0_4px_12px_-6px_rgba(244,63,94,0.6)] dark:text-rose-300"
          : "bg-[rgb(var(--bg-surface-rgb))] text-text-secondary ring-border-subtle hover:bg-elevated hover:text-primary hover:ring-border-strong"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function StudentIdentity({ student: s, onOpen }: { student: CohortStudent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/name flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))]"
    >
      <HpAvatar name={s.name} size="md" />
      <span className="min-w-0">
        <span className="block truncate text-13 font-bold text-primary transition-colors group-hover/name:text-indigo-600 dark:group-hover/name:text-indigo-300">
          {s.name}
        </span>
        <span className="block truncate font-mono text-3xs text-text-muted">{s.roll_number ?? s.email}</span>
      </span>
    </button>
  );
}

function BranchChip({ branch, className }: { branch: string | null; className?: string }) {
  if (!branch) {
    return <span className="text-3xs font-semibold italic text-text-muted">No branch on file</span>;
  }
  return (
    <span
      title={branch}
      className={cn(
        "inline-flex max-w-[11rem] items-center rounded-md bg-sky-500/[0.08] px-1.5 py-px text-3xs font-bold text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300",
        className
      )}
    >
      <span className="truncate">{branch}</span>
    </span>
  );
}

function SectionChip({ section }: { section: string | null }) {
  return (
    <span className="inline-flex items-center rounded-md bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
      {section ? `Sec ${section}` : "No section"}
    </span>
  );
}

function CgpaCell({ student: s }: { student: CohortStudent }) {
  return (
    <div className="min-w-[4.5rem]">
      <div className="tabular text-13 font-extrabold text-primary">
        {s.cgpa ?? <span className="font-semibold text-text-muted">—</span>}
      </div>
      {(s.backlogs ?? 0) > 0 && (
        <div className="mt-0.5 inline-flex items-center gap-1 text-3xs font-semibold text-amber-600 dark:text-amber-300">
          <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
          {s.backlogs} {s.backlogs === 1 ? "backlog" : "backlogs"}
        </div>
      )}
    </div>
  );
}

function ReadinessCell({ score, practice }: { score: number; practice: number }) {
  return (
    <div className="flex items-center gap-3">
      <ScoreRing value={score} />
      <div className="hidden min-w-[5.5rem] 2xl:block">
        <div className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">7-day practice</div>
        <div className="mt-1 flex items-center gap-2">
          <MeterBar value={practice} tone="violet" className="w-14" />
          <span className="tabular text-3xs font-bold text-text-secondary">{practice}%</span>
        </div>
      </div>
    </div>
  );
}

function EligibilityCell({ student: s }: { student: CohortStudent }) {
  if (s.eligible_for_active_drive === null) {
    return (
      <HpPill tone="slate" size="sm">
        No Active Drives
      </HpPill>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <HpPill tone={s.eligible_for_active_drive ? "emerald" : "rose"} icon={s.eligible_for_active_drive ? CheckCircle2 : AlertTriangle} size="sm">
        {s.eligible_for_active_drive ? "Eligible" : "Not eligible"}
      </HpPill>
      {s.active_drive_count > 1 && (
        <span
          className="tabular text-3xs font-semibold text-text-muted"
          title={`Eligible for ${s.eligible_drive_count} of ${s.active_drive_count} currently active drives mapped to your college`}
        >
          {s.eligible_drive_count}/{s.active_drive_count}
          <span className="sr-only"> active drives</span>
        </span>
      )}
    </span>
  );
}

function StatusCell({ student: s }: { student: CohortStudent }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <HpPill tone={TIER_TONE[s.readiness_tier]} dot size="sm">
        {s.readiness_tier}
      </HpPill>
      {s.is_blocked && (
        <HpPill tone="rose" icon={ShieldAlert} size="sm">
          Blocked
        </HpPill>
      )}
    </span>
  );
}

function RowActions({ student: s, onProfile, align = "end" }: { student: CohortStudent; onProfile: () => void; align?: "start" | "end" }) {
  return (
    <div className={cn("flex items-center gap-2", align === "end" ? "justify-end" : "justify-start")}>
      {/* One click straight into contest/interview/drive history, the
          activity calendar and submitted code — previously only reachable
          by opening the Profile drawer first and scrolling to its own
          button. */}
      <Link
        href={`/admin/students/report?studentId=${s.id}`}
        title="View full activity report"
        aria-label={`View full activity report for ${s.name}`}
        className={hpBtn("secondary", "sm", "h-8 px-2.5")}
      >
        <BarChart3 className="h-3.5 w-3.5" />
        Report
      </Link>
      <button type="button" onClick={onProfile} aria-label={`Open profile for ${s.name}`} className={hpBtn("soft", "sm", "h-8 px-2.5")}>
        <UserRound className="h-3.5 w-3.5" />
        Profile
      </button>
    </div>
  );
}

function RosterSkeleton() {
  return (
    <div className="divide-y divide-border-subtle" role="status" aria-label="Loading cohort">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <HpSkeleton className="h-[18px] w-[18px] rounded-[6px]" />
          <HpSkeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <HpSkeleton className="h-3.5 w-1/3 max-w-[12rem]" />
            <HpSkeleton className="h-3 w-1/4 max-w-[8rem]" />
          </div>
          <HpSkeleton className="hidden h-6 w-24 rounded-md md:block" />
          <HpSkeleton className="h-10 w-10 rounded-full" />
          <HpSkeleton className="hidden h-6 w-24 rounded-full sm:block" />
          <HpSkeleton className="hidden h-8 w-36 rounded-[10px] lg:block" />
        </div>
      ))}
    </div>
  );
}
