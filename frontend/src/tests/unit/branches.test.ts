import { describe, expect, it } from "vitest";
import {
  branchGroupKey,
  branchShortLabel,
  canonicalizeBranchTokens,
  describeEligibleBranches,
  inBranchScope,
  normalizeBranchKey,
  SCOPE_ALL,
  SCOPE_UNMATCHED,
  type BranchCatalog,
} from "@/lib/branches";
import { branchFilterGroups, matchesBranchFilter } from "@/lib/cohortInsights";
import type { CohortStudent } from "@/types/cohort";

/** The same cases are pinned in the backend's BranchTaxonomyTest — the two normalisers must agree. */
const SHARED_CASES: [string, string | null][] = [
  ["Mechanical Engineering", "mechanical"],
  ["B.Tech - MECHANICAL", "mechanical"],
  ["  mechanical engg. ", "mechanical"],
  ["Electrical & Electronics", "electrical electronics"],
  ["Electrical and Electronics Engineering", "electrical electronics"],
  ["CSE (AI & ML)", "cse ai ml"],
  ["B.E. in Civil Engineering", "civil"],
  ["Bachelor of Technology in ECE", "ece"],
  ["E&TC", "e tc"],
  ["   ", null],
];

const catalog: BranchCatalog = {
  disciplines: [
    { code: "cse", name: "Computer Science & IT", short: "CSE / IT" },
    { code: "ece", name: "Electronics & Communication", short: "ECE" },
    { code: "mech", name: "Mechanical", short: "Mech" },
  ],
  branches: [
    { code: "cse", discipline: "cse", name: "Computer Science & Engineering", short: "CSE" },
    { code: "ece", discipline: "ece", name: "Electronics & Communication Engineering", short: "ECE" },
    { code: "mech", discipline: "mech", name: "Mechanical Engineering", short: "Mech" },
    { code: "prod", discipline: "mech", name: "Production Engineering", short: "Production" },
  ],
  aliases: { mech: "mech", mechanical: "mech", me: "mech", ece: "ece", cse: "cse" },
};

const student = (over: Partial<CohortStudent>): CohortStudent => ({ branch: null, branch_code: null, discipline: null, ...over }) as CohortStudent;

describe("normalizeBranchKey", () => {
  it.each(SHARED_CASES)("%s → %s", (raw, key) => {
    expect(normalizeBranchKey(raw)).toBe(key);
  });
});

describe("canonicalizeBranchTokens", () => {
  it("turns an older drive's labels into branch codes without dropping anything", () => {
    expect(canonicalizeBranchTokens(["MECH", "Mechanical", "ECE", "Quantum Basket Weaving"], catalog)).toEqual(["mech", "ece", "Quantum Basket Weaving"]);
  });

  it("leaves codes and family tokens alone", () => {
    expect(canonicalizeBranchTokens(["family:mech", "prod"], catalog)).toEqual(["family:mech", "prod"]);
  });
});

describe("describeEligibleBranches", () => {
  it("speaks in branch names, and says all branches for an empty list", () => {
    expect(describeEligibleBranches(null, catalog)).toBe("All branches");
    expect(describeEligibleBranches(["MECH", "family:ece"], catalog)).toBe("Mechanical Engineering, all Electronics & Communication branches");
  });
});

describe("branch grouping and scope", () => {
  it("groups by meaning when recognised, by the college's wording when not", () => {
    expect(branchGroupKey({ branch: "Mechanical", branch_code: "mech" })).toBe("mech");
    expect(branchGroupKey({ branch: " Mech-A ", branch_code: null })).toBe("Mech-A");
    expect(branchGroupKey({ branch: null, branch_code: null })).toBeNull();
    expect(branchShortLabel({ branch: "Mechanical", branch_code: "mech" }, catalog)).toBe("Mech");
    expect(branchShortLabel({ branch: "Mech-A", branch_code: null }, catalog)).toBe("Mech-A");
  });

  it("scopes by family, and 'none' means not matched yet", () => {
    expect(inBranchScope({ discipline: "mech" }, SCOPE_ALL)).toBe(true);
    expect(inBranchScope({ discipline: "mech" }, "mech")).toBe(true);
    expect(inBranchScope({ discipline: "ece" }, "mech")).toBe(false);
    expect(inBranchScope({ discipline: null }, SCOPE_UNMATCHED)).toBe(true);
    expect(inBranchScope({ discipline: "mech" }, SCOPE_UNMATCHED)).toBe(false);
  });
});

describe("cohort branch filter", () => {
  const roster = [
    student({ id: 1, branch: "Mechanical", branch_code: "mech", discipline: "mech" }),
    student({ id: 2, branch: "MECH", branch_code: "mech", discipline: "mech" }),
    student({ id: 3, branch: "Production", branch_code: "prod", discipline: "mech" }),
    student({ id: 4, branch: "ECE", branch_code: "ece", discipline: "ece" }),
    student({ id: 5, branch: "Mech-A (Day)" }),
  ];

  it("matches a family, a code, an unrecognised label, and the old bare-string form", () => {
    const ids = (value: string) => roster.filter((s) => matchesBranchFilter(s, value)).map((s) => s.id);
    expect(ids("family:mech")).toEqual([1, 2, 3]);
    expect(ids("code:mech")).toEqual([1, 2]);
    expect(ids("raw:Mech-A (Day)")).toEqual([5]);
    expect(ids("ECE")).toEqual([4]);
  });

  it("builds options from the branches really on file, grouped, with counts", () => {
    const groups = branchFilterGroups(roster, catalog);
    expect(groups.map((g) => g.label)).toEqual(["Electronics & Communication", "Mechanical", "Not recognised yet"]);

    const mech = groups.find((g) => g.label === "Mechanical")!;
    expect(mech.options[0]).toEqual({ value: "family:mech", label: "All Mech", count: 3 });
    expect(mech.options.map((o) => o.value)).toEqual(["family:mech", "code:mech", "code:prod"]);
    expect(groups.at(-1)!.options).toEqual([{ value: "raw:Mech-A (Day)", label: "Mech-A (Day)", count: 1 }]);
  });
});
