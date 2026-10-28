import { describe, expect, it } from "vitest";
import {
  ALL_YEARS,
  YEAR_NOT_SET,
  YEAR_PASSED_OUT,
  departmentBranchBreakdown,
  inYear,
  yearBucket,
  yearName,
  yearTabs,
} from "@/lib/studyYear";
import { cohortVaultAiLabel, daysPhrase, sidebarChip, sidebarTitle, unlockButtonLabel } from "@/lib/vaultAi";
import type { CohortStudent } from "@/types/cohort";
import type { BranchCatalog } from "@/lib/branches";

const student = (over: Partial<CohortStudent> = {}) =>
  ({ id: 1, name: "S", branch: "CSE", branch_code: "cse", department: "engineering", study_year: 3, readiness_score: 50, vault_ai: null, ...over }) as unknown as CohortStudent;

const CATALOG = {
  departments: [
    { code: "engineering", name: "Engineering & Technology", short: "Engineering", icon: "cpu", accent: "indigo" },
    { code: "commerce", name: "Commerce & Accounting", short: "Commerce", icon: "calculator", accent: "emerald" },
  ],
  disciplines: [],
  branches: [
    { code: "cse", discipline: "cse", name: "Computer Science & Engineering", short: "CSE" },
    { code: "ece", discipline: "ece", name: "Electronics & Communication", short: "ECE" },
    { code: "bcom", discipline: "bcom", name: "B.Com (General)", short: "B.Com" },
  ],
  aliases: {},
} as unknown as BranchCatalog;

describe("year names and buckets", () => {
  it("names the years the way people say them", () => {
    expect([1, 2, 3, 4].map(yearName)).toEqual(["1st year", "2nd year", "3rd year", "4th year"]);
  });

  it("buckets a student by year of study", () => {
    expect(yearBucket(student({ study_year: 2 }))).toBe("2");
    expect(yearBucket(student({ study_year: 4 }))).toBe("4");
    expect(yearBucket(student({ study_year: null }))).toBe(YEAR_NOT_SET);
    expect(yearBucket(student({ study_year: undefined }))).toBe(YEAR_NOT_SET);
    expect(yearBucket(student({ study_year: 5 }))).toBe(YEAR_PASSED_OUT);
  });

  it("filters to a year, or to everyone", () => {
    const roster = [student({ id: 1, study_year: 2 }), student({ id: 2, study_year: 3 }), student({ id: 3, study_year: 3 }), student({ id: 4, study_year: null })];

    expect(roster.filter((s) => inYear(s, "3")).map((s) => s.id)).toEqual([2, 3]);
    expect(roster.filter((s) => inYear(s, YEAR_NOT_SET)).map((s) => s.id)).toEqual([4]);
    expect(roster.filter((s) => inYear(s, ALL_YEARS))).toHaveLength(4);
  });
});

describe("year tabs", () => {
  it("always offers 2nd, 3rd and 4th year, even when empty, with counts", () => {
    const tabs = yearTabs([student({ study_year: 3 }), student({ study_year: 3 })]);

    expect(tabs.map((t) => `${t.label}:${t.count}`)).toEqual(["All years:2", "2nd year:0", "3rd year:2", "4th year:0"]);
  });

  it("offers 1st year, passed out and not-set only when somebody is in them", () => {
    const tabs = yearTabs([student({ study_year: 1 }), student({ study_year: 5 }), student({ study_year: null })]);
    const labels = tabs.map((t) => t.label);

    expect(labels).toEqual(["All years", "1st year", "2nd year", "3rd year", "4th year", "Passed out", "Year not set"]);
    expect(tabs.find((t) => t.value === YEAR_NOT_SET)?.attention).toBe(true);
  });

  it("counts every student under All years", () => {
    expect(yearTabs([student(), student({ study_year: null }), student({ study_year: 4 })])[0].count).toBe(3);
  });
});

describe("department and branch breakdown", () => {
  const roster = [
    student({ id: 1, branch: "CSE", branch_code: "cse", department: "engineering", readiness_score: 80, vault_ai: { state: "open", reasons: [], days_remaining: 0, required_days: 90, unlocks_at: null } }),
    student({ id: 2, branch: "CSE", branch_code: "cse", department: "engineering", readiness_score: 40 }),
    student({ id: 3, branch: "ECE", branch_code: "ece", department: "engineering", readiness_score: 60 }),
    student({ id: 4, branch: "B.Com", branch_code: "bcom", department: "commerce", readiness_score: 70 }),
  ];

  it("groups by department in the catalogue's order, then by branch, largest first", () => {
    const groups = departmentBranchBreakdown(roster, CATALOG);

    expect(groups.map((g) => g.name)).toEqual(["Engineering & Technology", "Commerce & Accounting"]);
    expect(groups[0].branches.map((b) => `${b.label}:${b.count}`)).toEqual(["Computer Science & Engineering:2", "Electronics & Communication:1"]);
    expect(groups[1].branches.map((b) => `${b.label}:${b.count}`)).toEqual(["B.Com (General):1"]);
  });

  it("averages readiness per department and per branch", () => {
    const [engineering] = departmentBranchBreakdown(roster, CATALOG);

    expect(engineering.count).toBe(3);
    expect(engineering.avgReadiness).toBe(60);
    expect(engineering.branches[0].avgReadiness).toBe(60);
  });

  it("counts how many have the Vault AI Interview open", () => {
    expect(departmentBranchBreakdown(roster, CATALOG)[0].branches[0].vaultAiOpen).toBe(1);
  });

  it("gives each branch the value the roster's branch filter takes", () => {
    const [engineering] = departmentBranchBreakdown(roster, CATALOG);

    expect(engineering.branches.map((b) => b.filter)).toEqual(["code:cse", "code:ece"]);
  });

  it("files an unclassified student under engineering, and a label we do not recognise under its own words", () => {
    const groups = departmentBranchBreakdown(
      [student({ id: 1, department: null, branch: "Robotics", branch_code: null }), student({ id: 2, department: undefined, branch: null, branch_code: null })],
      CATALOG
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].department).toBe("engineering");
    expect(groups[0].branches.find((b) => b.label === "Robotics")?.filter).toBe("raw:Robotics");
    expect(groups[0].branches.find((b) => b.label === "No branch on file")?.filter).toBeNull();
  });

  it("is empty for a year nobody is in", () => {
    expect(departmentBranchBreakdown([], CATALOG)).toEqual([]);
  });
});

describe("the words for the Vault AI Interview lock", () => {
  const waiting: Parameters<typeof unlockButtonLabel>[0] = {
    state: "locked",
    reasons: ["waiting_period", "readiness"],
    days_remaining: 45,
    readiness: { score: 10, required: 60, met: false, points_needed: 50 },
  };

  it("pluralises days", () => {
    expect(daysPhrase(1)).toBe("1 day");
    expect(daysPhrase(45)).toBe("45 days");
  });

  it("puts the countdown on the button", () => {
    expect(unlockButtonLabel(waiting)).toBe("Unlocks in 45 days");
    expect(unlockButtonLabel({ ...waiting, days_remaining: 44 })).toBe("Unlocks in 44 days");
    expect(unlockButtonLabel({ ...waiting, days_remaining: 1 })).toBe("Unlocks in 1 day");
  });

  it("never says 0 days while the wait is still running", () => {
    expect(unlockButtonLabel({ ...waiting, days_remaining: 0 })).toBe("Unlocks in 1 day");
  });

  it("moves on to readiness once the wait is over", () => {
    expect(unlockButtonLabel({ ...waiting, reasons: ["readiness"], days_remaining: 0 })).toBe("Reach 60% readiness to unlock");
  });

  it("covers the years that cannot count down", () => {
    expect(unlockButtonLabel({ state: "unavailable", reasons: ["year_not_offered"], days_remaining: null, readiness: null })).toBe("Not available for your year");
    expect(unlockButtonLabel({ state: "locked", reasons: ["year_not_set"], days_remaining: null, readiness: null })).toBe("Waiting for your college to set your year");
  });

  it("shows the sidebar a short chip only while there is a countdown", () => {
    expect(sidebarChip(waiting)).toBe("45d");
    expect(sidebarChip({ ...waiting, reasons: ["readiness"], days_remaining: 0 })).toBeNull();
    expect(sidebarTitle(waiting)).toBe("Vault AI Interview — unlocks in 45 days");
  });

  it("tells a TPO where each student stands", () => {
    expect(cohortVaultAiLabel({ state: "open", reasons: [], days_remaining: 0, required_days: 45, unlocks_at: null })).toBe("Unlocked");
    expect(cohortVaultAiLabel({ state: "locked", reasons: ["waiting_period"], days_remaining: 12, required_days: 45, unlocks_at: null })).toBe("Unlocks in 12 days");
    expect(cohortVaultAiLabel({ state: "locked", reasons: ["readiness"], days_remaining: 0, required_days: 45, unlocks_at: null, readiness_required: 60 })).toBe("Needs 60% readiness");
    expect(cohortVaultAiLabel({ state: "locked", reasons: ["year_not_set"], days_remaining: null, required_days: null, unlocks_at: null })).toBe("Year not set");
    expect(cohortVaultAiLabel({ state: "unavailable", reasons: ["year_not_offered"], days_remaining: null, required_days: null, unlocks_at: null })).toBe("Not offered");
    expect(cohortVaultAiLabel(null)).toBe("—");
  });
});
