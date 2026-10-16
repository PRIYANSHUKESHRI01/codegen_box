import { describe, expect, it } from "vitest";
import {
  ALL,
  DEFAULT_FILTERS,
  branchOptions,
  codingSummary,
  engagementCounts,
  hasActiveFilters,
  matchesFilters,
  paginate,
  rollupLanguages,
  sortId,
  sortStudents,
  type CohortFilters,
} from "@/lib/cohortInsights";
import type { CohortStudent } from "@/types/cohort";
import type { CohortLanguage } from "@/types/languageInsights";

let nextId = 1;

function lang(language: string, attempts: number, accepted: number, solved: number): CohortLanguage {
  const acceptance = attempts ? Math.round((accepted / attempts) * 100) : 0;
  return { language, attempts, accepted, solved, acceptance_rate: acceptance, proficiency: "steady" };
}

function student(overrides: Partial<CohortStudent> & { languages?: CohortLanguage[]; needsWork?: string[]; days?: number | null } = {}): CohortStudent {
  const { languages = [], needsWork = [], days = null, ...rest } = overrides;
  const id = nextId++;
  return {
    id,
    name: `Student ${id}`,
    email: `s${id}@college.edu`,
    roll_number: `R${id}`,
    branch: "CSE",
    section: "A",
    phone: null,
    parent_phone: null,
    cgpa: "8.00",
    backlogs: 0,
    is_blocked: false,
    readiness_score: 50,
    readiness_tier: "In Progress",
    practice_score: 0,
    eligible_for_active_drive: null,
    eligible_drive_count: 0,
    active_drive_count: 0,
    created_at: "2026-01-01T00:00:00Z",
    activated: true,
    onboarded: false,
    solved: { total: 0, easy: 0, medium: 0, hard: 0 },
    activity: {
      engagement: days === null ? "not_started" : days <= 7 ? "active" : days <= 21 ? "slipping" : "dormant",
      last_practice_at: null,
      days_since_practice: days,
      last_seen_at: null,
      active_days_30: 0,
    },
    coding: { primary_language: languages[0]?.language ?? null, stated_language: null, mismatch: false, languages, needs_work: needsWork },
    ...rest,
  };
}

describe("rollupLanguages", () => {
  it("counts students per language, who mainly uses it, and the cohort-wide acceptance rate", () => {
    const rows = rollupLanguages([
      student({ languages: [lang("python", 10, 8, 8), lang("java", 5, 1, 1)], needsWork: ["java"] }),
      student({ languages: [lang("java", 10, 5, 5)] }),
      student({ languages: [lang("python", 10, 2, 2)] }),
    ]);

    const python = rows.find((r) => r.language === "python")!;
    expect(python).toMatchObject({ students: 2, mainly: 2, attempts: 20, accepted: 10, solved: 10, acceptanceRate: 50, needsWork: 0 });

    const java = rows.find((r) => r.language === "java")!;
    expect(java).toMatchObject({ students: 2, mainly: 1, attempts: 15, accepted: 6, acceptanceRate: 40, needsWork: 1 });
  });

  it("lists the most-used language first, breaking ties by problems solved", () => {
    const rows = rollupLanguages([
      student({ languages: [lang("go", 5, 5, 5)] }),
      student({ languages: [lang("rust", 5, 5, 9)] }),
      student({ languages: [lang("python", 5, 5, 1)] }),
      student({ languages: [lang("python", 5, 5, 1)] }),
    ]);

    expect(rows.map((r) => r.language)).toEqual(["python", "rust", "go"]);
  });

  it("is empty when nobody has submitted anything", () => {
    expect(rollupLanguages([student(), student()])).toEqual([]);
  });
});

describe("engagementCounts and codingSummary", () => {
  const roster = [
    student({ days: 1, languages: [lang("python", 5, 5, 5)], onboarded: true }),
    student({ days: 12, languages: [lang("java", 5, 1, 1)], needsWork: ["java"], onboarded: true }),
    student({ days: 40 }),
    student({ days: null }),
    student({ activated: false, activity: { engagement: "pending_activation", last_practice_at: null, days_since_practice: null, last_seen_at: null, active_days_30: 0 } }),
  ];

  it("buckets every student exactly once", () => {
    expect(engagementCounts(roster)).toEqual({ active: 1, slipping: 1, dormant: 1, not_started: 1, pending_activation: 1 });
  });

  it("summarises coding, onboarding and language trouble", () => {
    const withMismatch = [...roster, student({ languages: [lang("c", 5, 5, 5)], onboarded: true, coding: { primary_language: "c", stated_language: "java", mismatch: true, languages: [lang("c", 5, 5, 5)], needs_work: [] } })];

    expect(codingSummary(withMismatch)).toEqual({ coding: 3, onboarded: 3, mismatched: 1, needingLanguageHelp: 1 });
  });
});

describe("branchOptions", () => {
  it("comes from the data — including branches a hardcoded list would have missed — de-duplicated and sorted", () => {
    const options = branchOptions([
      student({ branch: "CSE (AI & ML)" }),
      student({ branch: "ECE" }),
      student({ branch: "CSE (AI & ML)" }),
      student({ branch: null }),
      student({ branch: "  " }),
      student({ branch: "AIDS" }),
    ]);

    expect(options).toEqual(["AIDS", "CSE (AI & ML)", "ECE"]);
  });
});

describe("matchesFilters", () => {
  const f = (patch: Partial<CohortFilters>): CohortFilters => ({ ...DEFAULT_FILTERS, ...patch });

  it("passes everyone with no filters set", () => {
    expect(matchesFilters(student(), DEFAULT_FILTERS)).toBe(true);
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it("searches name, roll number and email, ignoring case and surrounding spaces", () => {
    const s = student({ name: "Aarav Sharma", roll_number: "21CS007", email: "aarav@x.edu" });
    expect(matchesFilters(s, f({ search: "  AARAV " }))).toBe(true);
    expect(matchesFilters(s, f({ search: "21cs007" }))).toBe(true);
    expect(matchesFilters(s, f({ search: "@x.edu" }))).toBe(true);
    expect(matchesFilters(s, f({ search: "priya" }))).toBe(false);
  });

  it("filters by the language a student has submitted in — main or not", () => {
    const polyglot = student({ languages: [lang("python", 6, 6, 6), lang("java", 5, 3, 3)] });
    const none = student();

    expect(matchesFilters(polyglot, f({ language: "java" }))).toBe(true);
    expect(matchesFilters(polyglot, f({ language: "python" }))).toBe(true);
    expect(matchesFilters(polyglot, f({ language: "rust" }))).toBe(false);
    expect(matchesFilters(none, f({ language: "python" }))).toBe(false);
  });

  it("filters by engagement and by 'needs language help'", () => {
    const stuck = student({ days: 2, languages: [lang("java", 8, 1, 1)], needsWork: ["java"] });
    const fine = student({ days: 30, languages: [lang("java", 8, 7, 7)] });

    expect(matchesFilters(stuck, f({ engagement: "active" }))).toBe(true);
    expect(matchesFilters(fine, f({ engagement: "active" }))).toBe(false);
    expect(matchesFilters(fine, f({ engagement: "dormant" }))).toBe(true);
    expect(matchesFilters(stuck, f({ needsLanguageHelp: true }))).toBe(true);
    expect(matchesFilters(fine, f({ needsLanguageHelp: true }))).toBe(false);
  });

  it("combines filters with AND and applies the readiness range inclusively", () => {
    const s = student({ branch: "ECE", section: "B", readiness_score: 60, readiness_tier: "In Progress", eligible_for_active_drive: true });

    expect(matchesFilters(s, f({ branch: "ECE", section: "B", tier: "In Progress", eligibleOnly: true, minScore: 60, maxScore: 60 }))).toBe(true);
    expect(matchesFilters(s, f({ branch: "ECE", section: "A" }))).toBe(false);
    expect(matchesFilters(s, f({ minScore: 61 }))).toBe(false);
    expect(matchesFilters(s, f({ eligibleOnly: true, branch: "CSE" }))).toBe(false);
  });

  it("reports when any filter has moved off its default", () => {
    expect(hasActiveFilters(f({ language: "go" }))).toBe(true);
    expect(hasActiveFilters(f({ engagement: "dormant" }))).toBe(true);
    expect(hasActiveFilters(f({ language: ALL }))).toBe(false);
  });
});

describe("sortStudents", () => {
  const names = (list: CohortStudent[]) => list.map((s) => s.name);

  it("sorts by readiness in either direction, breaking ties by name", () => {
    const a = student({ name: "Asha", readiness_score: 40 });
    const b = student({ name: "Bela", readiness_score: 80 });
    const c = student({ name: "Chet", readiness_score: 80 });

    expect(names(sortStudents([a, b, c], { key: "readiness", dir: "desc" }))).toEqual(["Bela", "Chet", "Asha"]);
    expect(names(sortStudents([a, b, c], { key: "readiness", dir: "asc" }))).toEqual(["Asha", "Bela", "Chet"]);
  });

  it("puts students with no CGPA on file last, whichever direction", () => {
    const high = student({ name: "High", cgpa: "9.10" });
    const low = student({ name: "Low", cgpa: "6.00" });
    const none = student({ name: "None", cgpa: null });

    expect(names(sortStudents([none, low, high], { key: "cgpa", dir: "desc" }))).toEqual(["High", "Low", "None"]);
    expect(names(sortStudents([none, high, low], { key: "cgpa", dir: "asc" }))).toEqual(["Low", "High", "None"]);
  });

  it("orders 'most inactive first' as: never signed in, never practised, then longest gap", () => {
    const pending = student({ name: "Pending", activated: false });
    const never = student({ name: "Never", days: null });
    const longAgo = student({ name: "LongAgo", days: 90 });
    const recent = student({ name: "Recent", days: 2 });

    expect(names(sortStudents([recent, longAgo, never, pending], { key: "inactivity", dir: "desc" }))).toEqual(["Pending", "Never", "LongAgo", "Recent"]);
    expect(names(sortStudents([pending, never, longAgo, recent], { key: "inactivity", dir: "asc" }))[0]).toBe("Recent");
  });

  it("sorts by problems solved and does not mutate its input", () => {
    const a = student({ name: "A", solved: { total: 3, easy: 3, medium: 0, hard: 0 } });
    const b = student({ name: "B", solved: { total: 9, easy: 5, medium: 3, hard: 1 } });
    const input = [a, b];

    expect(names(sortStudents(input, { key: "solved", dir: "desc" }))).toEqual(["B", "A"]);
    expect(names(input)).toEqual(["A", "B"]);
  });

  it("maps every sort state back to a select option", () => {
    expect(sortId({ key: "inactivity", dir: "desc" })).toBe("inactivity_desc");
    expect(sortId({ key: "name", dir: "desc" })).toBe("name_asc"); // not offered — falls back to the default
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 53 }, (_, i) => i + 1);

  it("slices a page and reports the visible range", () => {
    const p = paginate(rows, 2, 25);
    expect(p.rows[0]).toBe(26);
    expect(p).toMatchObject({ page: 2, pageCount: 3, from: 26, to: 50 });
  });

  it("shows the short last page", () => {
    expect(paginate(rows, 3, 25)).toMatchObject({ from: 51, to: 53, rows: [51, 52, 53] });
  });

  it("clamps a page that no longer exists after the list shrinks", () => {
    expect(paginate(rows.slice(0, 10), 5, 25)).toMatchObject({ page: 1, pageCount: 1, from: 1, to: 10 });
    expect(paginate(rows, 0, 25).page).toBe(1);
  });

  it("handles an empty list", () => {
    expect(paginate([], 1, 25)).toMatchObject({ rows: [], page: 1, pageCount: 1, from: 0, to: 0 });
  });
});
