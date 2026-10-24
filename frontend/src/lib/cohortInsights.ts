import type { CohortStudent, Engagement } from "@/types/cohort";
import type { BranchCatalog } from "@/lib/branches";

/** What each engagement is called wherever it is written down — the roster pills, filters, and the Excel export. */
export const ENGAGEMENT_LABEL: Record<Engagement, string> = {
  active: "Active",
  slipping: "Slipping",
  dormant: "Dormant",
  not_started: "Not started",
  pending_activation: "Not activated",
};

/**
 * Everything the Student Cohort page works out from the roster it already has:
 * cohort-wide language and engagement roll-ups, the filter predicate, sorting and
 * paging. Pure functions over `CohortStudent[]` — no fetching, no React — so the
 * page stays presentational and the rules (what "Codes in Java" means, how
 * "most inactive first" orders someone who never signed in) are unit-tested in
 * one place.
 */

/* ── Roll-ups ─────────────────────────────────────────────────────────── */

export interface LanguageRollup {
  language: string;
  /** Students who have submitted at least one solution in it. */
  students: number;
  /** Students whose most-solved language it is. */
  mainly: number;
  attempts: number;
  accepted: number;
  /** Problems solved in it, summed over students (a problem two students solve counts twice — it's volume, not a distinct count). */
  solved: number;
  /** accepted / attempts across the cohort, 0–100. */
  acceptanceRate: number;
  /** Students with enough submissions in it to say it's going badly. */
  needsWork: number;
}

/** Languages the cohort codes in, most-used first. Empty when nobody has submitted anything. */
export function rollupLanguages(students: readonly Pick<CohortStudent, "coding">[]): LanguageRollup[] {
  const byLanguage = new Map<string, LanguageRollup>();

  for (const student of students) {
    for (const entry of student.coding.languages) {
      const row =
        byLanguage.get(entry.language) ??
        { language: entry.language, students: 0, mainly: 0, attempts: 0, accepted: 0, solved: 0, acceptanceRate: 0, needsWork: 0 };
      row.students += 1;
      row.attempts += entry.attempts;
      row.accepted += entry.accepted;
      row.solved += entry.solved;
      if (student.coding.primary_language === entry.language) row.mainly += 1;
      if (student.coding.needs_work.includes(entry.language)) row.needsWork += 1;
      byLanguage.set(entry.language, row);
    }
  }

  return Array.from(byLanguage.values())
    .map((row) => ({ ...row, acceptanceRate: row.attempts > 0 ? Math.round((row.accepted / row.attempts) * 100) : 0 }))
    .sort((a, b) => b.students - a.students || b.solved - a.solved || a.language.localeCompare(b.language));
}

export function engagementCounts(students: readonly Pick<CohortStudent, "activity">[]): Record<Engagement, number> {
  const counts: Record<Engagement, number> = { active: 0, slipping: 0, dormant: 0, not_started: 0, pending_activation: 0 };
  for (const student of students) counts[student.activity.engagement] += 1;
  return counts;
}

export interface CodingSummary {
  /** Students who have submitted at least one solution. */
  coding: number;
  /** Students who answered the first-login onboarding. */
  onboarded: number;
  /** Named one main language but mostly solve in another. */
  mismatched: number;
  /** Struggling in at least one language. */
  needingLanguageHelp: number;
}

export function codingSummary(students: readonly CohortStudent[]): CodingSummary {
  return {
    coding: students.filter((s) => s.coding.languages.length > 0).length,
    onboarded: students.filter((s) => s.onboarded).length,
    mismatched: students.filter((s) => s.coding.mismatch).length,
    needingLanguageHelp: students.filter((s) => s.coding.needs_work.length > 0).length,
  };
}

/** Branches actually on file, sorted — the filter's options come from the data, never a hardcoded list that misses a college's own naming. */
export function branchOptions(students: readonly CohortStudent[]): string[] {
  return Array.from(new Set(students.map((s) => s.branch?.trim()).filter((b): b is string => !!b))).sort((a, b) => a.localeCompare(b));
}

/**
 * The branch filter's value is one of: ALL · `family:<discipline>` (every branch in a family) ·
 * `code:<branch_code>` (one recognised branch) · `raw:<label>` (a label we don't recognise yet).
 * A bare string is the pre-catalogue form (a restored session filter) and still means "this exact label".
 */
export function matchesBranchFilter(student: CohortStudent, value: string): boolean {
  if (value.startsWith("family:")) return student.discipline === value.slice(7);
  if (value.startsWith("code:")) return student.branch_code === value.slice(5);
  if (value.startsWith("raw:")) return !student.branch_code && student.branch?.trim() === value.slice(4);
  return student.branch === value;
}

export interface BranchFilterGroup {
  label: string;
  options: { value: string; label: string; count: number }[];
}

/**
 * The branch filter's choices, from the branches actually in the roster: a family-wide choice
 * ("All Mechanical (42)") and one per recognised branch, grouped by family; labels the platform
 * doesn't recognise yet are listed last, as written, so they can still be filtered.
 */
export function branchFilterGroups(students: readonly CohortStudent[], catalog: BranchCatalog | null): BranchFilterGroup[] {
  const groups: BranchFilterGroup[] = [];
  const disciplines = catalog?.disciplines ?? [];

  for (const discipline of disciplines) {
    const inFamily = students.filter((s) => s.discipline === discipline.code);
    if (inFamily.length === 0) continue;

    const byCode = new Map<string, number>();
    for (const s of inFamily) if (s.branch_code) byCode.set(s.branch_code, (byCode.get(s.branch_code) ?? 0) + 1);

    groups.push({
      label: discipline.name,
      options: [
        { value: `family:${discipline.code}`, label: `All ${discipline.short}`, count: inFamily.length },
        ...Array.from(byCode.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([code, count]) => ({ value: `code:${code}`, label: catalog?.branches.find((b) => b.code === code)?.name ?? code, count })),
      ],
    });
  }

  const unrecognised = new Map<string, number>();
  for (const s of students) {
    const label = s.branch?.trim();
    if (!s.branch_code && label) unrecognised.set(label, (unrecognised.get(label) ?? 0) + 1);
  }
  if (unrecognised.size > 0) {
    groups.push({
      label: "Not recognised yet",
      options: Array.from(unrecognised.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, count]) => ({ value: `raw:${label}`, label, count })),
    });
  }

  return groups;
}

/* ── Filtering ────────────────────────────────────────────────────────── */

export const ALL = "ALL" as const;

export interface CohortFilters {
  search: string;
  branch: string;
  section: string;
  tier: string;
  /** A language id, or ALL. Matches anyone who has submitted in it. */
  language: string;
  engagement: Engagement | typeof ALL;
  eligibleOnly: boolean;
  needsLanguageHelp: boolean;
  minScore: number;
  maxScore: number;
}

export const DEFAULT_FILTERS: CohortFilters = {
  search: "",
  branch: ALL,
  section: ALL,
  tier: ALL,
  language: ALL,
  engagement: ALL,
  eligibleOnly: false,
  needsLanguageHelp: false,
  minScore: 0,
  maxScore: 100,
};

export function hasActiveFilters(filters: CohortFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof CohortFilters)[]).some((key) => filters[key] !== DEFAULT_FILTERS[key]);
}

export function matchesFilters(student: CohortStudent, filters: CohortFilters): boolean {
  const needle = filters.search.trim().toLowerCase();
  if (needle) {
    const haystack = [student.name, student.roll_number ?? "", student.email].map((v) => v.toLowerCase());
    if (!haystack.some((v) => v.includes(needle))) return false;
  }
  if (filters.branch !== ALL && !matchesBranchFilter(student, filters.branch)) return false;
  if (filters.section !== ALL && student.section !== filters.section) return false;
  if (filters.tier !== ALL && student.readiness_tier !== filters.tier) return false;
  if (filters.engagement !== ALL && student.activity.engagement !== filters.engagement) return false;
  if (filters.language !== ALL && !student.coding.languages.some((l) => l.language === filters.language)) return false;
  if (filters.eligibleOnly && student.eligible_for_active_drive !== true) return false;
  if (filters.needsLanguageHelp && student.coding.needs_work.length === 0) return false;
  return student.readiness_score >= filters.minScore && student.readiness_score <= filters.maxScore;
}

/* ── Sorting ──────────────────────────────────────────────────────────── */

export type SortKey = "name" | "readiness" | "cgpa" | "solved" | "inactivity";
export type SortDir = "asc" | "desc";
export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export const DEFAULT_SORT: SortState = { key: "name", dir: "asc" };

/** The "Sort by" choices, as one control that works on every screen size (the table's headers drive the same state). */
export const SORT_OPTIONS: readonly { id: string; label: string; sort: SortState }[] = [
  { id: "name_asc", label: "Name (A–Z)", sort: { key: "name", dir: "asc" } },
  { id: "readiness_desc", label: "Readiness (high → low)", sort: { key: "readiness", dir: "desc" } },
  { id: "readiness_asc", label: "Readiness (low → high)", sort: { key: "readiness", dir: "asc" } },
  { id: "solved_desc", label: "Most problems solved", sort: { key: "solved", dir: "desc" } },
  { id: "solved_asc", label: "Fewest problems solved", sort: { key: "solved", dir: "asc" } },
  { id: "inactivity_desc", label: "Most inactive first", sort: { key: "inactivity", dir: "desc" } },
  { id: "inactivity_asc", label: "Most recently active", sort: { key: "inactivity", dir: "asc" } },
  { id: "cgpa_desc", label: "CGPA (high → low)", sort: { key: "cgpa", dir: "desc" } },
];

export function sortId(sort: SortState): string {
  return SORT_OPTIONS.find((o) => o.sort.key === sort.key && o.sort.dir === sort.dir)?.id ?? "name_asc";
}

/**
 * How long since they last practised, for ordering: someone who never practised
 * (or never even signed in) is "most inactive", ahead of a student who stopped a
 * year ago — the order a TPO wants when chasing the students who need a nudge.
 */
function inactivityDays(student: CohortStudent): number {
  if (!student.activated) return Number.MAX_SAFE_INTEGER;
  return student.activity.days_since_practice ?? Number.MAX_SAFE_INTEGER - 1;
}

function sortValue(student: CohortStudent, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return student.name.toLowerCase();
    case "readiness":
      return student.readiness_score;
    case "cgpa":
      return student.cgpa === null ? null : Number(student.cgpa);
    case "solved":
      return student.solved.total;
    case "inactivity":
      return inactivityDays(student);
  }
}

/** A new, sorted array. Missing values (e.g. no CGPA on file) always sort last, whichever way; ties fall back to name so the order is stable. */
export function sortStudents(students: readonly CohortStudent[], { key, dir }: SortState): CohortStudent[] {
  const sign = dir === "asc" ? 1 : -1;

  return [...students].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);

    if (av === null && bv !== null) return 1;
    if (bv === null && av !== null) return -1;

    if (av !== null && bv !== null && av !== bv) {
      return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sign;
    }

    return a.name.localeCompare(b.name);
  });
}

/* ── Paging ───────────────────────────────────────────────────────────── */

export const PAGE_SIZES = [25, 50, 100] as const;

export interface PageSlice<T> {
  rows: T[];
  /** The page actually shown — clamped, so a filter that shrinks the list never leaves you on a page that no longer exists. */
  page: number;
  pageCount: number;
  /** 1-based position of the first / last row shown (0 when empty). */
  from: number;
  to: number;
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number): PageSlice<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);

  return {
    rows: slice,
    page: current,
    pageCount,
    from: slice.length === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}
