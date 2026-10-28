"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
  Minus,
  UserRound,
  ChevronRight,
  RefreshCw,
  Code2,
  Activity,
  ArrowUpDown,
  LifeBuoy,
  CalendarRange,
  Pencil,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StudentProfileDrawer } from "@/components/dashboard/tpo/StudentProfileDrawer";
import { BulkImportStudentsPanel } from "@/components/dashboard/tpo/BulkImportStudentsPanel";
import { AddStudentModal } from "@/components/dashboard/tpo/AddStudentModal";
import { BranchMappingModal } from "@/components/dashboard/tpo/BranchMappingModal";
import { departmentShort, SCOPE_ALL, useBranchCatalog } from "@/lib/branches";
import { departmentCan, useDepartmentScope } from "@/lib/departments";
import { BulkNotifyModal } from "@/components/dashboard/tpo/BulkNotifyModal";
import { NotesPanel } from "@/components/coordinator/NotesPanel";
import { CohortEngagementCard, CohortLanguagesCard, CohortPagination, SortHeader } from "@/components/dashboard/tpo/cohortPanels";
import { SetYearModal, VaultAiChip, YearBreakdown, YearChip, YearSwitcher } from "@/components/dashboard/tpo/cohortYear";
import { EditStudentModal, SetSectionModal, UnfiledStudentsPanel } from "@/components/dashboard/tpo/cohortEdit";
import { ALL_YEARS, YEAR_NOT_SET, departmentBranchBreakdown, inYear, yearName, yearTabs } from "@/lib/studyYear";
import { confirmDialog } from "@/lib/dialogs";
import { CoreCell, LanguageChips } from "@/components/dashboard/tpo/cohortProgress";
import {
  BranchChip,
  CgpaCell,
  EligibilityCell,
  FilterChip,
  MeterBar,
  PracticeCell,
  ReadinessCell,
  RosterSkeleton,
  ScoreRing,
  SectionChip,
  SelectBox,
  StatusCell,
  StudentIdentity,
  TIER_TONE,
  scoreTone,
} from "@/components/dashboard/tpo/cohortCells";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { CohortStudent } from "@/types/cohort";
import { computeSectionStats, type SectionCoordinatorInfo } from "@/lib/sectionBreakdown";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { languageLabel } from "@/lib/judgeLanguages";
import {
  ALL,
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  PAGE_SIZES,
  SORT_OPTIONS,
  branchFilterGroups,
  engagementCounts,
  hasActiveFilters,
  matchesFilters,
  paginate,
  rollupLanguages,
  sortId,
  sortStudents,
  type CohortFilters,
  type SortDir,
  type SortKey,
  type SortState,
} from "@/lib/cohortInsights";
import {
  HP_TONES,
  HpAvatar,
  HpButton,
  HpCard,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpSearch,
  HpSectionHeader,
  HpStagger,
  HpStatCard,
  hpBtn,
  hpEase,
  hpTh,
} from "@/components/portal/kit";
import { HpErrorCard, HpSelect } from "@/components/portal/pipeline-kit";
import { useToast } from "@/lib/toast";

const TIERS = ["ALL", "Placement Ready", "In Progress", "Needs Training"] as const;


const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** The filters, sort and page size a TPO has set — kept for the browser session so opening a student's report and coming back lands on the same view. */
const VIEW_STORAGE_PREFIX = "aptrun:cohort-view:v1:";

/** "just now" / "3 min ago" / "2 h ago" — how stale the loaded roster is. */
function timeAgo(timestamp: number | null, now: number): string {
  if (timestamp === null) return "";
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

/** A small tag naming the department a student belongs to — shown only when the roster mixes departments. */
function DepartmentTag({ department, catalog }: { department?: string | null; catalog: ReturnType<typeof useBranchCatalog> }) {
  return (
    <span className="inline-flex items-center rounded-md bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle" title="Department">
      {departmentShort(catalog, department ?? "engineering")}
    </span>
  );
}

export default function StudentCohortPage() {
  const { user, status } = useAuthGuard(["admin_tpo"]);
  // Everything the college has; `students` (below) is the year the TPO is looking at, and the whole page — numbers, section cards,
  // readiness mix, roster — reads that, so picking "3rd year" makes it a 3rd-year page.
  const [allStudents, setAllStudents] = useState<CohortStudent[]>([]);
  const [year, setYear] = useState<string>(ALL_YEARS);
  const [coordinators, setCoordinators] = useState<(SectionCoordinatorInfo & { section: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [filters, setFilters] = useState<CohortFilters>(DEFAULT_FILTERS);
  // The search box itself stays instantly responsive (bound to `filters.search`
  // directly in the JSX below) — only the actual re-filtering of the cohort
  // array uses this debounced value, so a fast typist isn't re-scanning the
  // whole list on every keystroke.
  const debouncedSearch = useDebouncedValue(filters.search, 250);
  const effectiveFilters = useMemo(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [viewRestored, setViewRestored] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeStudent, setActiveStudent] = useState<CohortStudent | null>(null);
  const [notifyConfirm, setNotifyConfirm] = useState<{ ids: number[]; label: string; students: CohortStudent[] } | null>(
    null
  );
  const [exporting, setExporting] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [showSetYear, setShowSetYear] = useState(false);
  const [showSetSection, setShowSetSection] = useState(false);
  const [editing, setEditing] = useState<CohortStudent | null>(null);
  const catalog = useBranchCatalog();
  // Which department the TPO is looking at (the switcher under the page title). The roster is that department's students, and the
  // coding columns and filters only exist where the department codes at all.
  const { scope: deptScope, multiple: hasDepartments } = useDepartmentScope();
  const showCoding = departmentCan(catalog, deptScope, "coding_practice");
  const showDepartmentChip = hasDepartments && deptScope === SCOPE_ALL;

  const AT_RISK_THRESHOLD = 60;

  const setFilter = <K extends keyof CohortFilters>(key: K, value: CohortFilters[K]) => setFilters((prev) => ({ ...prev, [key]: value }));

  const triggerToast = useToast();

  /**
   * `background` refreshes the numbers in place (the roster stays on screen)
   * instead of swapping the page for a skeleton — what the Refresh button uses.
   */
  const loadStudents = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);
    try {
      const [studentsRes, coordinatorsRes] = await Promise.all([
        api.get<{ students: CohortStudent[] }>(deptScope === SCOPE_ALL ? "/tpo/students/cohort" : `/tpo/students/cohort?department=${encodeURIComponent(deptScope)}`),
        api.get<{ coordinators: (SectionCoordinatorInfo & { section: string })[] }>("/tpo/coordinators"),
      ]);
      setAllStudents(studentsRes.students);
      setCoordinators(coordinatorsRes.coordinators);
      setLoadedAt(Date.now());
      // A refresh can drop students (deleted / moved) — never keep a selection that points at someone no longer here.
      const ids = new Set(studentsRes.students.map((s) => s.id));
      setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => ids.has(id))));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load the student cohort.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deptScope]);

  useEffect(() => {
    if (status === "ready") loadStudents();
  }, [status, loadStudents]);

  // Keeps "Updated 3 min ago" honest while the page stays open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Restore this session's view (filters / sort / page size) once we know whose it is…
  const viewKey = user ? `${VIEW_STORAGE_PREFIX}${user.id}` : null;
  useEffect(() => {
    if (!viewKey) return;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(viewKey) ?? "null");
      if (saved?.filters) setFilters({ ...DEFAULT_FILTERS, ...saved.filters });
      if (saved?.sort?.key && saved?.sort?.dir) setSort(saved.sort);
      if (PAGE_SIZES.includes(saved?.pageSize)) setPageSize(saved.pageSize);
      if (typeof saved?.year === "string") setYear(saved.year);
    } catch {
      // Storage blocked or a stale shape — start from the defaults.
    }
    const linked = new URLSearchParams(window.location.search).get("year");
    if (linked && /^(ALL|[1-4]|none|passed)$/.test(linked)) setYear(linked);
    setViewRestored(true);
  }, [viewKey]);

  // …and keep it saved as it changes.
  useEffect(() => {
    if (!viewKey || !viewRestored) return;
    try {
      window.sessionStorage.setItem(viewKey, JSON.stringify({ filters, sort, pageSize, year }));
    } catch {
      // Private mode — the view simply isn't remembered.
    }
  }, [viewKey, viewRestored, filters, sort, pageSize, year]);

  // Sections aren't a fixed enum like tiers — every college names its own
  // (A/B/C, or CSE-1/CSE-2), and the same goes for branches ("CSE (AI & ML)",
  // "AIDS"…) — so both filters' option lists are derived from whatever the
  // cohort actually has on file, never hardcoded.
  const students = useMemo(() => allStudents.filter((s) => inYear(s, year)), [allStudents, year]);
  const tabs = useMemo(() => yearTabs(allStudents), [allStudents]);
  const notSetCount = useMemo(() => allStudents.filter((s) => s.study_year === null || s.study_year === undefined).length, [allStudents]);
  const yearLabel = tabs.find((t) => t.value === year)?.label ?? "All years";
  const allSections = useMemo(() => Array.from(new Set(allStudents.map((s) => s.section).filter((s): s is string => !!s))).sort(), [allStudents]);
  const yearGroups = useMemo(() => departmentBranchBreakdown(students, catalog), [students, catalog]);
  const sections = useMemo(() => Array.from(new Set(students.map((s) => s.section).filter((s): s is string => !!s))).sort(), [students]);
  const branchGroups = useMemo(() => branchFilterGroups(students, catalog), [students, catalog]);
  // Labels the platform does not recognise yet: students who cannot be matched to branch-specific drives.
  const unrecognised = useMemo(() => {
    const labels = new Map<string, number>();
    for (const s of students) if (!s.branch_code && s.branch?.trim()) labels.set(s.branch.trim(), (labels.get(s.branch.trim()) ?? 0) + 1);
    return { labels: labels.size, students: Array.from(labels.values()).reduce((a, b) => a + b, 0) };
  }, [students]);
  const languageRollup = useMemo(() => rollupLanguages(students), [students]);

  useEffect(() => {
    if (loading || loadError || tabs.length === 0) return;
    if (!tabs.some((t) => t.value === year)) setYear(ALL_YEARS);
  }, [loading, loadError, tabs, year]);

  // A restored filter pointing at something that's gone (a branch nobody is in any more) would silently show an empty roster.
  useEffect(() => {
    if (loading || students.length === 0) return;
    setFilters((prev) => {
      const next = { ...prev };
      if (next.branch !== ALL && !branchGroups.some((g) => g.options.some((o) => o.value === next.branch)) && !students.some((s) => s.branch === next.branch)) next.branch = ALL;
      if (next.section !== ALL && !sections.includes(next.section)) next.section = ALL;
      if (next.language !== ALL && !languageRollup.some((l) => l.language === next.language)) next.language = ALL;
      return next.branch === prev.branch && next.section === prev.section && next.language === prev.language ? prev : next;
    });
  }, [loading, students, branchGroups, sections, languageRollup]);

  const filtered = useMemo(
    () => sortStudents(students.filter((s) => matchesFilters(s, effectiveFilters)), sort),
    [students, effectiveFilters, sort]
  );
  const pageData = useMemo(() => paginate(filtered, page, pageSize), [filtered, page, pageSize]);

  // A different set of filters, order or page size starts back at page 1, and a selection made under one view
  // must not silently carry into another (someone could "Notify Selected" people they can no longer see).
  useEffect(() => {
    setPage(1);
  }, [effectiveFilters, sort, pageSize, year]);
  useEffect(() => {
    setSelectedIds(new Set());
  }, [effectiveFilters, year]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const eligibleCount = students.filter((s) => s.eligible_for_active_drive === true).length;
  const needsTrainingCount = students.filter((s) => s.readiness_tier === "Needs Training").length;
  const blockedCount = students.filter((s) => s.is_blocked).length;
  const engagement = engagementCounts(students);

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
  const sectionFilter = filters.section;
  const activeSectionCoordinator = sectionFilter !== ALL ? coordinators.find((c) => c.section.trim().toLowerCase() === sectionFilter.trim().toLowerCase()) ?? null : null;

  const filtersActive = hasActiveFilters(filters);

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select-all works on the page you're looking at (like every inbox); a banner then offers the whole filtered list.
  const pageIds = pageData.rows.map((s) => s.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id)) && !allPageSelected;
  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAllFiltered = () => setSelectedIds(new Set(filtered.map((s) => s.id)));

  const handleSort = (key: SortKey, firstDir: SortDir) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: firstDir }));

  const handleNotifySent = (message: string) => {
    triggerToast(message);
    setSelectedIds(new Set());
    setNotifyConfirm(null);
  };

  /** Shows a change on the roster the moment the server has accepted it, before any reload. */
  const patchStudents = (ids: number[], patch: Partial<CohortStudent>) => {
    const set = new Set(ids);
    setAllStudents((prev) => prev.map((s) => (set.has(s.id) ? { ...s, ...patch } : s)));
  };

  /** Files students under a year: the roster updates at once, then refreshes quietly for what the year changes about each of them. */
  const applyYear = async (ids: number[], chosen: number) => {
    const res = await api.post<{ message: string; updated: number; graduation_year: number; study_year: number; year_label: string }>("/tpo/students/year", {
      student_ids: ids,
      year: chosen,
    });
    patchStudents(ids, { graduation_year: res.graduation_year, study_year: res.study_year, year_label: res.year_label });
    triggerToast(res.message);
    void loadStudents(true);
  };

  const handleSetYear = async (chosen: number) => {
    await applyYear(Array.from(selectedIds), chosen);
    setShowSetYear(false);
    setSelectedIds(new Set());
  };

  // "Add these students to a year": everyone currently shown (they all have no year) in one go.
  const handleAssignUnfiled = async (chosen: number) => {
    const ids = students.map((s) => s.id);
    const ok = await confirmDialog({
      title: `Move ${ids.length} ${ids.length === 1 ? "student" : "students"} to ${yearName(chosen)}?`,
      message: "You can change any of them again afterwards.",
      confirmLabel: `Move to ${yearName(chosen)}`,
    });
    if (!ok) return;
    try {
      await applyYear(ids, chosen);
      // They have a year now, so the "Year not set" tab is gone: follow them to where they went.
      setYear(String(chosen));
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't set the year. Please try again.");
    }
  };

  const handleSetSection = async (section: string | null) => {
    const ids = Array.from(selectedIds);
    const res = await api.post<{ message: string; section: string | null }>("/tpo/students/section", { student_ids: ids, section });
    patchStudents(ids, { section: res.section });
    setShowSetSection(false);
    setSelectedIds(new Set());
    triggerToast(res.message);
  };

  /** One student edited in the modal: the server sent back their refreshed row. */
  const handleStudentSaved = (row: CohortStudent) => {
    setAllStudents((prev) => prev.map((s) => (s.id === row.id ? { ...s, ...row } : s)));
    setActiveStudent((prev) => (prev && prev.id === row.id ? { ...prev, ...row } : prev));
    setEditing(null);
    triggerToast(`${row.name} updated.`);
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
  const someSelected = selectedIds.size > 0;
  const atRiskActive = filters.maxScore === AT_RISK_THRESHOLD - 1 && filters.minScore === 0;
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
      <HpStagger className="space-y-6">
        {/* Year of study — pick a year; the page becomes that year's students, department by department */}
        <HpItem>
          <div className="space-y-4">
            <YearSwitcher tabs={tabs} value={year} onChange={setYear} notSetCount={notSetCount} />
            {!loading && !loadError && allStudents.length > 0 && (
              <YearBreakdown
                groups={yearGroups}
                yearLabel={yearLabel}
                total={students.length}
                activeBranch={filters.branch}
                onPickBranch={(filter) => setFilter("branch", filter ?? ALL)}
              />
            )}
            {!loading && !loadError && year === YEAR_NOT_SET && students.length > 0 && <UnfiledStudentsPanel count={students.length} onAssign={handleAssignUnfiled} />}
          </div>
        </HpItem>

        {/* KPI strip */}
        <HpItem>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
            <HpStatCard
              label={year === ALL_YEARS ? "Total cohort" : `${yearLabel} cohort`}
              value={students.length}
              icon={Users}
              tone="sky"
              loading={loading}
              hint={loading ? undefined : `${placementReadyCount} placement ready`}
            />
            <button
              type="button"
              onClick={() => setFilter("engagement", filters.engagement === "active" ? ALL : "active")}
              aria-pressed={filters.engagement === "active"}
              title="Click to filter the roster to students who practised in the last 7 days"
              className="block h-full rounded-[20px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <HpStatCard
                label="Practising this week"
                value={engagement.active}
                icon={Activity}
                tone="violet"
                loading={loading}
                hint={
                  loading ? undefined : filters.engagement === "active" ? (
                    <span className="font-semibold text-violet-700 dark:text-violet-300">Filtering roster · tap to clear</span>
                  ) : (
                    `${pct(engagement.active, students.length)}% of the cohort`
                  )
                }
                className={cn("h-full", filters.engagement === "active" && "border-violet-500/40 bg-violet-500/[0.04] ring-2 ring-violet-500/20")}
              />
            </button>
            <button
              type="button"
              onClick={() => setFilter("eligibleOnly", !filters.eligibleOnly)}
              aria-pressed={filters.eligibleOnly}
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
                  loading ? undefined : filters.eligibleOnly ? (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">Filtering roster · tap to clear</span>
                  ) : (
                    "Tap to filter the roster"
                  )
                }
                className={cn("h-full", filters.eligibleOnly && "border-emerald-500/40 bg-emerald-500/[0.04] ring-2 ring-emerald-500/20")}
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
                      sectionFilter !== ALL ? (
                        <HpButton variant="ghost" size="sm" onClick={() => setFilter("section", ALL)} leftIcon={<X className="h-3.5 w-3.5" />}>
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
                          onClick={() => setFilter("section", sectionFilter === section ? ALL : section)}
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
                              <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
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
                    {sectionFilter !== ALL && (
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
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
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
                    const active = filters.tier === t;
                    return (
                      <li key={t}>
                        <button
                          type="button"
                          aria-pressed={active}
                          onClick={() => setFilter("tier", active ? ALL : t)}
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

        {/* Practice engagement + coding languages */}
        {showInsights && (
          <HpItem>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <CohortEngagementCard students={students} active={filters.engagement} onSelect={(e) => setFilter("engagement", e)} codes={showCoding} />
              {showCoding && (
                <CohortLanguagesCard
                  students={students}
                  activeLanguage={filters.language}
                  onSelectLanguage={(language) => setFilter("language", language)}
                  needsHelpActive={filters.needsLanguageHelp}
                  onToggleNeedsHelp={() => setFilter("needsLanguageHelp", !filters.needsLanguageHelp)}
                />
              )}
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
                    {loadedAt !== null && <span> · updated {timeAgo(loadedAt, now)}</span>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <HpButton
                  variant="ghost"
                  size="sm"
                  onClick={() => loadStudents(true)}
                  disabled={loading || refreshing}
                  aria-label="Refresh the roster"
                  title="Reload the latest numbers"
                  leftIcon={<RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />}
                >
                  Refresh
                </HpButton>
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
                <HpButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowBranches(true)}
                  title="See what each branch label in your roster means"
                  leftIcon={<GitBranch className="h-3.5 w-3.5" />}
                >
                  Branches
                  {unrecognised.students > 0 && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Some branches are not recognised" />}
                </HpButton>
                <HpButton size="sm" onClick={() => setShowAddStudent(true)} leftIcon={<UserPlus className="h-3.5 w-3.5" />}>
                  Add Student
                </HpButton>
              </div>
            </div>

            {unrecognised.students > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/20 bg-amber-500/5 px-4 py-2.5 sm:px-5">
                <p className="text-2xs text-text-secondary">
                  <strong className="text-primary">
                    {unrecognised.students} student{unrecognised.students === 1 ? "" : "s"}
                  </strong>{" "}
                  ha{unrecognised.students === 1 ? "s" : "ve"} {unrecognised.labels === 1 ? "a branch" : `${unrecognised.labels} branches`} we don&apos;t recognise yet, so they can&apos;t be matched to branch-specific drives.
                </p>
                <button type="button" onClick={() => setShowBranches(true)} className="text-2xs font-bold text-accent-primary hover:underline">
                  Map them →
                </button>
              </div>
            )}

            {/* Filter bar */}
            <div className="space-y-3 border-y border-border-subtle bg-elevated/30 px-4 py-3.5 sm:px-5">
              <div className="flex flex-col gap-2.5">
                <HpSearch
                  value={filters.search}
                  onChange={(e) => setFilter("search", e.target.value)}
                  placeholder="Search name, roll no, or email..."
                  aria-label="Search students by name, roll number or email"
                  wrapperClassName="min-w-0"
                />
                <div className="grid grid-cols-1 gap-2.5 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap xl:items-center">
                  <HpSelect
                    aria-label="Filter by branch"
                    value={filters.branch}
                    onChange={(e) => setFilter("branch", e.target.value)}
                    leading={<GitBranch className="h-3.5 w-3.5 text-text-muted" />}
                    wrapperClassName="xl:w-40"
                  >
                    <option value={ALL}>All Branches</option>
                    {branchGroups.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label} ({o.count})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </HpSelect>
                  <HpSelect
                    aria-label="Filter by section"
                    value={filters.section}
                    onChange={(e) => setFilter("section", e.target.value)}
                    leading={<LayoutGrid className="h-3.5 w-3.5 text-text-muted" />}
                    wrapperClassName="xl:w-44"
                  >
                    <option value={ALL}>All Sections</option>
                    {sections.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </HpSelect>
                  <HpSelect
                    aria-label="Filter by readiness status"
                    value={filters.tier}
                    onChange={(e) => setFilter("tier", e.target.value)}
                    leading={
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          filters.tier === ALL ? "bg-border-strong" : HP_TONES[TIER_TONE[filters.tier as CohortStudent["readiness_tier"]]].fill
                        )}
                      />
                    }
                    wrapperClassName="xl:w-44"
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {t === "ALL" ? "All Statuses" : t}
                      </option>
                    ))}
                  </HpSelect>
                  {showCoding && (
                    <HpSelect
                      aria-label="Filter by coding language"
                      value={filters.language}
                      onChange={(e) => setFilter("language", e.target.value)}
                      leading={<Code2 className="h-3.5 w-3.5 text-text-muted" />}
                      wrapperClassName="xl:w-44"
                    >
                      <option value={ALL}>All Languages</option>
                      {languageRollup.map((l) => (
                        <option key={l.language} value={l.language}>
                          {languageLabel(l.language)} ({l.students})
                        </option>
                      ))}
                    </HpSelect>
                  )}
                  <HpSelect
                    aria-label="Filter by practice engagement"
                    value={filters.engagement}
                    onChange={(e) => setFilter("engagement", e.target.value as CohortFilters["engagement"])}
                    leading={<Activity className="h-3.5 w-3.5 text-text-muted" />}
                    wrapperClassName="xl:w-44"
                  >
                    <option value={ALL}>All Practice</option>
                    <option value="active">Active ({engagement.active})</option>
                    <option value="slipping">Slipping ({engagement.slipping})</option>
                    <option value="dormant">Dormant ({engagement.dormant})</option>
                    <option value="not_started">Not started ({engagement.not_started})</option>
                    <option value="pending_activation">Not activated ({engagement.pending_activation})</option>
                  </HpSelect>
                  <HpSelect
                    aria-label="Sort roster by"
                    value={sortId(sort)}
                    onChange={(e) => setSort(SORT_OPTIONS.find((o) => o.id === e.target.value)?.sort ?? DEFAULT_SORT)}
                    leading={<ArrowUpDown className="h-3.5 w-3.5 text-text-muted" />}
                    wrapperClassName="xl:w-52"
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
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
                  active={filters.eligibleOnly}
                  tone="emerald"
                  icon={CheckCircle2}
                  onClick={() => setFilter("eligibleOnly", !filters.eligibleOnly)}
                  title="Students eligible for at least one currently active drive mapped to your college"
                >
                  Eligible Only
                </FilterChip>
                <FilterChip
                  active={atRiskActive}
                  tone="rose"
                  icon={ShieldAlert}
                  onClick={() => setFilters((prev) => ({ ...prev, minScore: 0, maxScore: AT_RISK_THRESHOLD - 1 }))}
                  title={`Same threshold used by the weekly readiness report (< ${AT_RISK_THRESHOLD}%)`}
                >
                  At Risk (&lt;{AT_RISK_THRESHOLD}%)
                </FilterChip>
                {showCoding && (
                  <FilterChip
                    active={filters.needsLanguageHelp}
                    tone="amber"
                    icon={LifeBuoy}
                    onClick={() => setFilter("needsLanguageHelp", !filters.needsLanguageHelp)}
                    title="Students with enough submissions in a language to show it's going badly (low acceptance, many compile or runtime errors)"
                  >
                    Struggling in a language
                  </FilterChip>
                )}

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
                    value={filters.minScore}
                    aria-label="Minimum readiness score"
                    onChange={(e) => setFilter("minScore", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="tabular h-6 w-12 rounded-full bg-elevated text-center text-2xs font-bold text-primary outline-none ring-1 ring-inset ring-border-subtle transition-shadow focus:ring-2 focus:ring-indigo-500/50"
                  />
                  <span className="text-text-muted" aria-hidden>
                    –
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={filters.maxScore}
                    aria-label="Maximum readiness score"
                    onChange={(e) => setFilter("maxScore", Math.max(0, Math.min(100, Number(e.target.value) || 100)))}
                    className="tabular h-6 w-12 rounded-full bg-elevated text-center text-2xs font-bold text-primary outline-none ring-1 ring-inset ring-border-subtle transition-shadow focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>

                <AnimatePresence>
                  {filtersActive && (
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

            {/* Selection banner — the header checkbox picks this page; this offers the whole filtered list */}
            {!loading && !loadError && allPageSelected && filtered.length > pageData.rows.length && (
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-border-subtle bg-indigo-500/[0.06] px-4 py-2 text-2xs text-text-secondary" role="status">
                {allFilteredSelected ? (
                  <>
                    All <span className="tabular font-bold text-primary">{filtered.length}</span> filtered students are selected.
                    <button type="button" onClick={() => setSelectedIds(new Set())} className="font-semibold text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300">
                      Clear selection
                    </button>
                  </>
                ) : (
                  <>
                    All <span className="tabular font-bold text-primary">{pageData.rows.length}</span> students on this page are selected.
                    <button type="button" onClick={selectAllFiltered} className="font-semibold text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300">
                      Select all {filtered.length} filtered students
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Body */}
            {loading ? (
              <RosterSkeleton />
            ) : loadError ? (
              <div className="p-4 sm:p-5">
                <HpErrorCard message={loadError} onRetry={() => loadStudents()} />
              </div>
            ) : filtered.length === 0 ? (
              students.length === 0 && allStudents.length > 0 ? (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <HpIconTile icon={CalendarRange} tone="violet" size="lg" />
                  <p className="mt-4 text-sm font-bold text-primary">Nobody is in {yearLabel} yet</p>
                  <p className="mt-1 max-w-sm text-2xs leading-relaxed text-text-muted">
                    Add a student and choose this year, or import a roster for it. To move students you already have, tick them in another year and use Set year.
                  </p>
                  <HpButton variant="secondary" size="sm" className="mt-4" onClick={() => setYear(ALL_YEARS)}>
                    Show all years
                  </HpButton>
                </div>
              ) : students.length === 0 ? (
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
                            checked={allPageSelected}
                            indeterminate={somePageSelected}
                            onChange={toggleSelectPage}
                            label={`Select all ${pageData.rows.length} students on this page`}
                          />
                        </th>
                        <SortHeader label="Student" sortKey="name" firstDir="asc" sort={sort} onSort={handleSort} />
                        <th scope="col" className={cn(hpTh, "px-4")}>
                          Academics
                        </th>
                        <SortHeader label="Readiness" sortKey="readiness" firstDir="desc" sort={sort} onSort={handleSort} />
                        <SortHeader label="Practice" sortKey="inactivity" firstDir="desc" sort={sort} onSort={handleSort} />
                        <th scope="col" className={cn(hpTh, "px-4")}>
                          {showCoding ? "Languages" : "Domain Prep"}
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
                      {pageData.rows.map((s) => {
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
                            <td className="max-w-[16rem] px-4 py-3">
                              <StudentIdentity student={s} onOpen={() => setActiveStudent(s)} />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-start gap-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  <BranchChip branch={s.branch} className="max-w-[10rem]" />
                                  {showDepartmentChip && <DepartmentTag department={s.department} catalog={catalog} />}
                                  <YearChip student={s} />
                                  <SectionChip section={s.section} />
                                </div>
                                <CgpaCell student={s} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <ReadinessCell score={s.readiness_score} practice={s.practice_score} />
                            </td>
                            <td className="px-4 py-3">
                              <PracticeCell student={s} />
                            </td>
                            <td className="max-w-[14rem] px-4 py-3">
                              <div className="flex flex-col items-start gap-1.5">
                                <CoreCell student={s} />
                                {showCoding && <LanguageChips coding={s.coding} />}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-start gap-1.5">
                                <StatusCell student={s} />
                                <EligibilityCell student={s} />
                                <VaultAiChip student={s} />
                              </div>
                            </td>
                            <td className="py-3 pl-4 pr-5">
                              <RowActions student={s} onProfile={() => setActiveStudent(s)} onEdit={() => setEditing(s)} />
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
                      checked={allPageSelected}
                      indeterminate={somePageSelected}
                      onChange={toggleSelectPage}
                      label={`Select all ${pageData.rows.length} students on this page`}
                      visibleLabel={`Select page (${pageData.rows.length})`}
                    />
                  </div>
                  <ul className="divide-y divide-border-subtle">
                    {pageData.rows.map((s) => {
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
                              {showDepartmentChip && <DepartmentTag department={s.department} catalog={catalog} />}
                              <YearChip student={s} />
                              <SectionChip section={s.section} />
                              <span className="tabular inline-flex items-center gap-1 rounded-md bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
                                <GraduationCap className="h-3 w-3" aria-hidden />
                                CGPA {s.cgpa ?? "—"}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <StatusCell student={s} />
                              <EligibilityCell student={s} />
                              <VaultAiChip student={s} />
                            </div>
                            <div className="mt-3 space-y-2 rounded-xl bg-elevated/40 p-2.5">
                              <PracticeCell student={s} inline />
                              <CoreCell student={s} />
                              {showCoding && <LanguageChips coding={s.coding} />}
                            </div>
                            <div className="mt-3">
                              <RowActions student={s} onProfile={() => setActiveStudent(s)} onEdit={() => setEditing(s)} align="start" />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <CohortPagination slice={pageData} total={filtered.length} pageSize={pageSize} onPage={setPage} onPageSize={setPageSize} />
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
        {someSelected && <div aria-hidden className="h-16" />}
      </HpStagger>

      {/* Floating selection toolbar */}
      <AnimatePresence>
        {someSelected && (
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
                <HpButton variant="secondary" size="sm" onClick={() => setShowSetYear(true)} leftIcon={<CalendarRange className="h-3.5 w-3.5" />}>
                  Set year
                </HpButton>
                <HpButton variant="secondary" size="sm" onClick={() => setShowSetSection(true)} leftIcon={<LayoutGrid className="h-3.5 w-3.5" />}>
                  Set section
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
          setAllStudents((prev) => [student, ...prev]);
          triggerToast(`${student.name} added — login credentials emailed to ${student.email}.`);
        }}
      />

      {showSetSection && <SetSectionModal count={selectedIds.size} sections={allSections} onClose={() => setShowSetSection(false)} onConfirm={handleSetSection} />}

      {editing && <EditStudentModal student={editing} sections={allSections} onClose={() => setEditing(null)} onSaved={handleStudentSaved} />}

      {showSetYear && <SetYearModal count={selectedIds.size} onClose={() => setShowSetYear(false)} onConfirm={handleSetYear} />}

      {showBranches && <BranchMappingModal onClose={() => setShowBranches(false)} onChanged={() => void loadStudents(true)} />}

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
        extra={
          activeStudent && (
            <section className="space-y-2.5" aria-label="Coordinator follow-up log">
              <h3 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Coordinator follow-up log</h3>
              <NotesPanel key={activeStudent.id} listPath={`/tpo/students/${activeStudent.id}/notes`} readOnly />
            </section>
          )
        }
      />
    </DashboardShell>
  );
}

/* ── Local presentation pieces ──────────────────────────────────────────── */

/** Thin bar that fills in on mount (instant under reduced motion). `value` is 0–100. */
function RowActions({ student: s, onProfile, onEdit, align = "end" }: { student: CohortStudent; onProfile: () => void; onEdit: () => void; align?: "start" | "end" }) {
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
      <button type="button" onClick={onEdit} aria-label={`Edit year and section for ${s.name}`} title="Edit year & section" className={hpBtn("secondary", "sm", "h-8 px-2.5")}>
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
    </div>
  );
}

