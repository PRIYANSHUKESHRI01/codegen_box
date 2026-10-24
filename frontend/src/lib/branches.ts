"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * The department / branch catalogue (GET /public/branches): the departments a college can run (Engineering,
 * Management, Commerce, Arts …), the disciplines the product has a dashboard for inside each, and the specific branches
 * inside those. Every department/branch picker and label reads this one list — never a hard-coded array — so a department
 * or branch added in Superadmin shows up everywhere without a release.
 */
export type DisciplineCode = string;

/** The built-in engineering families. Other departments' disciplines are plain strings from the catalogue. */
export type EngineeringDisciplineCode = "cse" | "ece" | "eee" | "mech" | "civil" | "other";

export interface Department {
  code: string;
  name: string;
  short: string;
  description?: string | null;
  icon: string;
  accent: string;
  /** What this department calls Domain Prep: "Core Prep", "Management Prep", "Commerce Prep", "Subject Prep". */
  domain_prep_label?: string;
  /** The modules its students have (coding_practice, contests, domain_prep …) — department level, before any family / branch override. */
  capabilities?: Record<string, boolean>;
}

export interface Discipline {
  code: DisciplineCode;
  name: string;
  short: string;
  /** The department this family belongs to. Absent on an older cached catalogue, which only ever had engineering. */
  department?: string;
  /** Domain Prep is switched on for this family (staff decide, once its question bank is ready). */
  is_live?: boolean;
  /** Whether this family has Domain Prep at all (Core Prep for ECE, Management Prep for MBA …). CSE and "other" do not. */
  domain_prep?: boolean;
}

export interface Branch {
  code: string;
  discipline: DisciplineCode;
  name: string;
  short: string;
}

export interface BranchCatalog {
  departments?: Department[];
  disciplines: Discipline[];
  branches: Branch[];
  /** Every known spelling: normalised key (see normalizeBranchKey) → branch code. */
  aliases?: Record<string, string>;
}

/** Prefix of a stored `eligible_branches` token that means a whole family ("family:mech"). Mirrors EligibilityService::FAMILY_PREFIX. */
export const FAMILY_PREFIX = "family:";

/** Prefix of a stored `eligible_branches` token that means a whole department ("department:commerce"). Mirrors EligibilityService::DEPARTMENT_PREFIX. */
export const DEPARTMENT_PREFIX = "department:";

const NOISE = new Set([
  "engineering", "engg", "engineer", "eng", "and", "the", "of", "in", "department", "dept", "branch",
  "btech", "be", "bachelor", "degree", "program", "programme", "course", "with", "specialization", "specialisation",
]);

/** Port of App\Support\BranchNormalizer::key() — the two MUST agree (a test pins the same cases on both sides). */
export function normalizeBranchKey(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let text = raw.trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9À-￿]+/g, " ").trim();
  text = text.replace(/^(b tech|b e|btech|bachelor of (technology|engineering))\b\s*/, "");
  const key = text
    .split(" ")
    .filter((w) => w !== "" && !NOISE.has(w))
    .join(" ")
    .slice(0, 150);
  return key === "" ? null : key;
}

/** How a family looks everywhere it is shown (chips, headers, charts). Tailwind classes, kept together. */
export const DISCIPLINE_STYLE: Record<string, { chip: string; dot: string }> = {
  cse: { chip: "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  ece: { chip: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  eee: { chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  mech: { chip: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  civil: { chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  other: { chip: "border-border-subtle bg-elevated text-text-secondary", dot: "bg-text-muted" },
};

let cached: BranchCatalog | null = null;
let inflight: Promise<BranchCatalog> | null = null;

/** One fetch per page load, shared by every component that asks. */
export function loadBranchCatalog(): Promise<BranchCatalog> {
  if (cached) return Promise.resolve(cached);
  inflight ??= api
    .get<BranchCatalog>("/public/branches?aliases=1")
    .then((catalog) => {
      // Never cache (or hand to a component) something that isn't a catalogue — a proxy error page, a stubbed API.
      if (!Array.isArray(catalog?.disciplines) || !Array.isArray(catalog?.branches)) throw new Error("Unexpected branch catalogue");
      cached = catalog;
      return catalog;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** The catalogue if some component has already loaded it — for plain functions (report generators) that cannot use a hook. */
export function getCachedBranchCatalog(): BranchCatalog | null {
  return cached;
}

/** Forget the cached list (after Superadmin edits it) so the next read refetches. */
export function resetBranchCatalog(): void {
  cached = null;
}

/** The catalogue, or null until it has loaded (or if it could not — callers fall back to free text). */
export function useBranchCatalog(): BranchCatalog | null {
  const [catalog, setCatalog] = useState<BranchCatalog | null>(cached);

  useEffect(() => {
    let alive = true;
    loadBranchCatalog()
      .then((c) => alive && setCatalog(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return catalog;
}

export function branchesByDiscipline(catalog: BranchCatalog): { discipline: Discipline; branches: Branch[] }[] {
  return catalog.disciplines
    .map((discipline) => ({ discipline, branches: catalog.branches.filter((b) => b.discipline === discipline.code) }))
    .filter((group) => group.branches.length > 0);
}

export function disciplineName(catalog: BranchCatalog | null, code: string | null | undefined): string | null {
  if (!code) return null;
  return catalog?.disciplines.find((d) => d.code === code)?.name ?? code;
}

export function branchName(catalog: BranchCatalog | null, code: string | null | undefined): string | null {
  if (!code) return null;
  return catalog?.branches.find((b) => b.code === code)?.name ?? code;
}

/**
 * The engineering families that choose between "lead with my branch" and "lead with IT" and get the Core + IT experience once their
 * Core Prep exists: ECE, EEE, Mechanical, Civil and the other engineering branches (Chemical, Biotech, Aerospace, Agri, Mining).
 * CSE keeps today's dashboard — it is already the IT track — and so does every family of the other departments.
 */
export function isCoreDiscipline(code: string | null | undefined): boolean {
  return code === "ece" || code === "eee" || code === "mech" || code === "civil" || code === "other";
}

/**
 * Turns whatever an older drive stored ("MECH", "EE", "Mechanical") into the canonical tokens the
 * pickers work with. Family tokens and codes pass through; a spelling we know becomes its branch
 * code; anything else is kept exactly as it was so saving a form never silently drops a value.
 */
export function canonicalizeBranchTokens(tokens: readonly string[], catalog: BranchCatalog): string[] {
  const codes = new Set(catalog.branches.map((b) => b.code));
  const out: string[] = [];

  for (const token of tokens) {
    const trimmed = token.trim();
    let resolved = trimmed;

    if (!trimmed.startsWith(FAMILY_PREFIX) && !trimmed.startsWith(DEPARTMENT_PREFIX) && !codes.has(trimmed)) {
      const key = normalizeBranchKey(trimmed);
      resolved = (key && catalog.aliases?.[key]) || trimmed;
    }

    if (resolved && !out.includes(resolved)) out.push(resolved);
  }

  return out;
}

/** "Mechanical Engineering, all Civil branches" — words for a stored eligibility list. */
export function describeEligibleBranches(tokens: readonly string[] | null | undefined, catalog: BranchCatalog | null): string {
  if (!tokens || tokens.length === 0) return "All branches";
  const resolved = catalog ? canonicalizeBranchTokens(tokens, catalog) : [...tokens];

  return resolved
    .map((token) => {
      if (token.startsWith(FAMILY_PREFIX)) {
        const code = token.slice(FAMILY_PREFIX.length);
        const name = catalog?.disciplines.find((d) => d.code === code)?.name;
        return name ? `all ${name} branches` : token;
      }
      if (token.startsWith(DEPARTMENT_PREFIX)) {
        const code = token.slice(DEPARTMENT_PREFIX.length);
        const name = catalog?.departments?.find((d) => d.code === code)?.name;
        return name ? `every ${name} programme` : token;
      }
      return catalog?.branches.find((b) => b.code === token)?.name ?? token;
    })
    .join(", ");
}

/** What a student/row needs for branch grouping — every roster row shape (cohort, reports) has these. */
export interface BranchedRow {
  branch?: string | null;
  branch_code?: string | null;
  discipline?: string | null;
}

/** Group by what the branch MEANS when we know it, by the college's own wording when we don't. */
export function branchGroupKey(row: BranchedRow): string | null {
  return row.branch_code ?? (row.branch?.trim() || null);
}

/** Short chart label: "Mech", "ECE" — or the college's wording for a label we don't recognise yet. */
export function branchShortLabel(row: BranchedRow, catalog: BranchCatalog | null): string | null {
  if (row.branch_code) return catalog?.branches.find((b) => b.code === row.branch_code)?.short ?? row.branch_code;
  return row.branch?.trim() || null;
}

export const SCOPE_ALL = "ALL";
export const SCOPE_UNMATCHED = "none";

/** Whether a row belongs to a family scope chosen in the branch switcher (ALL, a discipline code, or "none" = not matched yet). */
export function inBranchScope(row: BranchedRow, scope: string): boolean {
  if (scope === SCOPE_ALL) return true;
  if (scope === SCOPE_UNMATCHED) return !row.discipline;
  return row.discipline === scope;
}

// ───────────────────────────────────── departments ─────────────────────────────────────

/** The colour language of a department (its `accent`), used wherever a department or one of its families is drawn. */
export const ACCENT_STYLE: Record<string, { chip: string; dot: string; soft: string; text: string; ring: string }> = {
  indigo: { chip: "border-indigo-500/25 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500", soft: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-300", ring: "ring-indigo-500/30" },
  violet: { chip: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-500", soft: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-300", ring: "ring-violet-500/30" },
  emerald: { chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", soft: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-300", ring: "ring-emerald-500/30" },
  rose: { chip: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500", soft: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-300", ring: "ring-rose-500/30" },
  amber: { chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500", soft: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-300", ring: "ring-amber-500/30" },
  sky: { chip: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500", soft: "bg-sky-500/10", text: "text-sky-600 dark:text-sky-300", ring: "ring-sky-500/30" },
  teal: { chip: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300", dot: "bg-teal-500", soft: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-300", ring: "ring-teal-500/30" },
  orange: { chip: "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300", dot: "bg-orange-500", soft: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-300", ring: "ring-orange-500/30" },
  fuchsia: { chip: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300", dot: "bg-fuchsia-500", soft: "bg-fuchsia-500/10", text: "text-fuchsia-600 dark:text-fuchsia-300", ring: "ring-fuchsia-500/30" },
  cyan: { chip: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300", dot: "bg-cyan-500", soft: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-300", ring: "ring-cyan-500/30" },
};

export const DEFAULT_DEPARTMENT = "engineering";

export function departmentOf(catalog: BranchCatalog | null, disciplineCode: string | null | undefined): Department | null {
  if (!catalog || !disciplineCode) return null;
  const code = catalog.disciplines.find((d) => d.code === disciplineCode)?.department ?? DEFAULT_DEPARTMENT;
  return catalog.departments?.find((d) => d.code === code) ?? null;
}

export function departmentName(catalog: BranchCatalog | null, code: string | null | undefined): string | null {
  if (!code) return null;
  return catalog?.departments?.find((d) => d.code === code)?.name ?? code;
}

export function departmentShort(catalog: BranchCatalog | null, code: string | null | undefined): string | null {
  if (!code) return null;
  return catalog?.departments?.find((d) => d.code === code)?.short ?? code;
}

export function accentStyle(accent: string | null | undefined) {
  return ACCENT_STYLE[accent ?? "indigo"] ?? ACCENT_STYLE.indigo;
}

/** Where a department draws its colour from: its own `accent` (indigo when the catalogue has not loaded). */
export function departmentStyle(catalog: BranchCatalog | null, code: string | null | undefined) {
  return accentStyle(catalog?.departments?.find((d) => d.code === code)?.accent);
}

/** The chip/dot style of a family: the hand-picked engineering colours, otherwise its department's accent. */
export function disciplineStyle(catalog: BranchCatalog | null, code: string | null | undefined): { chip: string; dot: string } {
  if (code && DISCIPLINE_STYLE[code]) return DISCIPLINE_STYLE[code];
  const department = catalog?.disciplines.find((d) => d.code === code)?.department;
  return departmentStyle(catalog, department);
}

export function disciplinesOfDepartment(catalog: BranchCatalog, department: string): Discipline[] {
  return catalog.disciplines.filter((d) => (d.department ?? DEFAULT_DEPARTMENT) === department);
}

/** Departments in catalogue order, narrowed to the ones a college runs (all of them when the list is unknown). */
export function departmentsFor(catalog: BranchCatalog | null, enabled: readonly string[] | null | undefined): Department[] {
  const all = catalog?.departments ?? [];
  return enabled && enabled.length > 0 ? all.filter((d) => enabled.includes(d.code)) : all;
}

/** Groups the branches of a catalogue by department → family, in catalogue order. */
export function branchesByDepartment(catalog: BranchCatalog): { department: Department; groups: { discipline: Discipline; branches: Branch[] }[] }[] {
  const departments = catalog.departments?.length ? catalog.departments : [{ code: DEFAULT_DEPARTMENT, name: "Engineering & Technology", short: "Engineering", icon: "cpu", accent: "indigo" }];

  return departments
    .map((department) => ({
      department,
      groups: disciplinesOfDepartment(catalog, department.code)
        .map((discipline) => ({ discipline, branches: catalog.branches.filter((b) => b.discipline === discipline.code) }))
        .filter((g) => g.branches.length > 0),
    }))
    .filter((d) => d.groups.length > 0);
}

/** A student row's department: what is recorded, else engineering (what a student who was never classified has always been). */
export function rowDepartment(row: { department?: string | null }): string {
  return row.department || DEFAULT_DEPARTMENT;
}

/** Whether a row belongs to a department scope chosen in the department switcher (ALL, or a department code). */
export function inDepartmentScope(row: { department?: string | null }, scope: string): boolean {
  return scope === SCOPE_ALL || rowDepartment(row) === scope;
}

/**
 * Whether something aimed at an audience (a mock test, an interview, a Core test) is for the department being looked at.
 * No audience = everyone, so it is for every department; otherwise it must name the department, a family inside it, or a branch inside it.
 */
export function audienceTouchesDepartment(
  audience: { departments?: string[] | null; disciplines?: string[] | null; branches?: string[] | null } | null | undefined,
  department: string,
  catalog: BranchCatalog | null
): boolean {
  if (department === SCOPE_ALL) return true;

  const departments = audience?.departments ?? [];
  const disciplines = audience?.disciplines ?? [];
  const branches = audience?.branches ?? [];

  if (departments.length === 0 && disciplines.length === 0 && branches.length === 0) return true;
  // Without the catalogue we cannot tell where a family or branch belongs: show it rather than hide something that may be theirs.
  if (!catalog) return true;
  if (departments.includes(department)) return true;

  const familyDepartment = (code: string) => catalog.disciplines.find((d) => d.code === code)?.department ?? DEFAULT_DEPARTMENT;

  return disciplines.some((d) => familyDepartment(d) === department) || branches.some((b) => familyDepartment(catalog.branches.find((x) => x.code === b)?.discipline ?? "") === department);
}
