import type { CohortStudent } from "@/types/cohort";
import { branchName, departmentName, rowDepartment, type BranchCatalog } from "@/lib/branches";

/**
 * Year-wise cohorts. A college student is filed under a year of study (1st-4th); the server works the year out from the year they
 * pass out, so it moves on by itself each July. Everything here is a pure function over the roster the TPO page already holds.
 */

/** The years a TPO can file a student under, in order (the server's AcademicYear::selectableYears). */
export const SELECTABLE_YEARS = [1, 2, 3, 4] as const;

export const ALL_YEARS = "ALL" as const;
/** No year filed yet. */
export const YEAR_NOT_SET = "none" as const;
/** Past their final year. */
export const YEAR_PASSED_OUT = "passed" as const;

/** "1st year" … "4th year". */
export function yearName(year: number): string {
  const suffix = year % 100 >= 11 && year % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[year % 10] ?? "th";
  return `${year}${suffix} year`;
}

/** Which year tab a student belongs to: "1".."4", "none" (not filed) or "passed" (graduated). */
export function yearBucket(student: Pick<CohortStudent, "study_year">): string {
  const year = student.study_year;
  if (year === null || year === undefined) return YEAR_NOT_SET;
  if (year > SELECTABLE_YEARS[SELECTABLE_YEARS.length - 1]) return YEAR_PASSED_OUT;
  if (year < 1) return YEAR_NOT_SET;
  return String(year);
}

export interface YearTab {
  value: string;
  label: string;
  count: number;
  /** A tab that exists to point at a problem (students nobody has filed), not a year. */
  attention?: boolean;
}

/**
 * The year switcher's tabs. 2nd, 3rd and 4th year are always there (a TPO should see an empty year as empty, not wonder where it
 * went); 1st year, "Year not set" and "Passed out" appear only when somebody is in them.
 */
export function yearTabs(students: readonly Pick<CohortStudent, "study_year">[]): YearTab[] {
  const counts = new Map<string, number>();
  for (const s of students) counts.set(yearBucket(s), (counts.get(yearBucket(s)) ?? 0) + 1);

  const tabs: YearTab[] = [{ value: ALL_YEARS, label: "All years", count: students.length }];
  for (const year of SELECTABLE_YEARS) {
    const count = counts.get(String(year)) ?? 0;
    if (year === 1 && count === 0) continue;
    tabs.push({ value: String(year), label: yearName(year), count });
  }
  if ((counts.get(YEAR_PASSED_OUT) ?? 0) > 0) tabs.push({ value: YEAR_PASSED_OUT, label: "Passed out", count: counts.get(YEAR_PASSED_OUT) ?? 0 });
  if ((counts.get(YEAR_NOT_SET) ?? 0) > 0) tabs.push({ value: YEAR_NOT_SET, label: "Year not set", count: counts.get(YEAR_NOT_SET) ?? 0, attention: true });

  return tabs;
}

export function inYear(student: Pick<CohortStudent, "study_year">, year: string): boolean {
  return year === ALL_YEARS || yearBucket(student) === year;
}

export interface BranchBreakdownRow {
  key: string;
  /** The value to put in the roster's branch filter to focus on this branch; null for students with no branch to filter on. */
  filter: string | null;
  label: string;
  count: number;
  avgReadiness: number;
  /** Students who have the Vault AI Interview open. */
  vaultAiOpen: number;
}

export interface DepartmentBreakdown {
  department: string;
  name: string;
  count: number;
  avgReadiness: number;
  branches: BranchBreakdownRow[];
}

const avg = (xs: readonly number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/**
 * The students of the year being looked at, laid out department by department and, inside each, branch by branch - the way a TPO
 * reads a year ("Engineering: CSE 42, ECE 18 · Commerce: B.Com 30"). Departments follow the catalogue's order; branches are largest first.
 */
export function departmentBranchBreakdown(students: readonly CohortStudent[], catalog: BranchCatalog | null): DepartmentBreakdown[] {
  const byDepartment = new Map<string, CohortStudent[]>();
  for (const s of students) {
    const department = rowDepartment(s);
    byDepartment.set(department, [...(byDepartment.get(department) ?? []), s]);
  }

  const order = (catalog?.departments ?? []).map((d) => d.code);
  const departments = Array.from(byDepartment.keys()).sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

  return departments.map((department) => {
    const members = byDepartment.get(department) ?? [];
    const rows = new Map<string, { filter: string | null; label: string; members: CohortStudent[] }>();

    for (const s of members) {
      const label = s.branch?.trim();
      const key = s.branch_code ? `code:${s.branch_code}` : label ? `raw:${label}` : "none";
      const row = rows.get(key) ?? {
        filter: key === "none" ? null : key,
        label: s.branch_code ? branchName(catalog, s.branch_code) ?? label ?? s.branch_code : label ?? "No branch on file",
        members: [],
      };
      row.members.push(s);
      rows.set(key, row);
    }

    return {
      department,
      name: departmentName(catalog, department) ?? department,
      count: members.length,
      avgReadiness: avg(members.map((m) => m.readiness_score)),
      branches: Array.from(rows.entries())
        .map(([key, row]) => ({
          key,
          filter: row.filter,
          label: row.label,
          count: row.members.length,
          avgReadiness: avg(row.members.map((m) => m.readiness_score)),
          vaultAiOpen: row.members.filter((m) => m.vault_ai?.state === "open").length,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    };
  });
}
