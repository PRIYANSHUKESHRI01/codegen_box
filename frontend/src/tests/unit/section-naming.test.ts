import { describe, expect, it } from "vitest";
import type { BranchCatalog } from "@/lib/branches";
import { cleanSectionInput, isPrefixOnly, nextSectionName, prefixForBranch, prefixForDiscipline, sectionPrefix, sectionsWithPrefix } from "@/lib/sectionNaming";

const CATALOG = {
  departments: [],
  disciplines: [
    { code: "cse", name: "Computer Science & IT", short: "CSE / IT", sort: 1, is_live: false, department_code: "engineering" },
    { code: "ece", name: "Electronics & Communication", short: "ECE", sort: 2, is_live: true, department_code: "engineering" },
    { code: "mech", name: "Mechanical", short: "Mech", sort: 3, is_live: true, department_code: "engineering" },
    { code: "other", name: "Other engineering", short: "Other", sort: 9, is_live: false, department_code: "engineering" },
  ],
  branches: [
    { code: "cse", name: "Computer Science & Engineering", discipline: "cse", short: "CSE" },
    { code: "it", name: "Information Technology", discipline: "cse", short: "IT" },
    { code: "cse_aiml", name: "CSE (AI & ML)", discipline: "cse", short: "CSE-AIML" },
  ],
} as unknown as BranchCatalog;

describe("section naming", () => {
  it("turns a branch family into a prefix", () => {
    expect(prefixForDiscipline(CATALOG, "ece")).toBe("ECE_");
    expect(prefixForDiscipline(CATALOG, "mech")).toBe("MECH_");
    // The family's own code, not its label ("CSE / IT"): this is what a TPO means by "CSE_A".
    expect(prefixForDiscipline(CATALOG, "cse")).toBe("CSE_");
  });

  it("gives no prefix when there is no single branch", () => {
    expect(prefixForDiscipline(CATALOG, "other")).toBeNull();
    expect(prefixForDiscipline(CATALOG, null)).toBeNull();
    expect(prefixForDiscipline(CATALOG, undefined)).toBeNull();
  });

  it("follows the branch the TPO filtered to, whether a whole family or one branch of it", () => {
    expect(sectionPrefix(CATALOG, "family:ece", [])).toBe("ECE_");
    expect(sectionPrefix(CATALOG, "family:cse", [])).toBe("CSE_");
    expect(sectionPrefix(CATALOG, "code:cse", [])).toBe("CSE_");
    expect(sectionPrefix(CATALOG, "code:it", [])).toBe("IT_");
    expect(sectionPrefix(CATALOG, "code:cse_aiml", [])).toBe("CSE-AIML_");
    expect(prefixForBranch(CATALOG, "nope")).toBeNull();
    expect(sectionPrefix(CATALOG, "raw:Some unknown label", [])).toBeNull();
  });

  it("falls back to the selected students when they all share one family", () => {
    expect(sectionPrefix(CATALOG, "ALL", [{ discipline: "mech" }, { discipline: "mech" }])).toBe("MECH_");
    expect(sectionPrefix(CATALOG, "ALL", [{ discipline: "mech" }, { discipline: "ece" }])).toBeNull();
    expect(sectionPrefix(CATALOG, "ALL", [])).toBeNull();
    // A filter wins over the selection.
    expect(sectionPrefix(CATALOG, "family:ece", [{ discipline: "mech" }])).toBe("ECE_");
  });

  it("lists this branch's sections first and suggests the next free letter", () => {
    const existing = ["ECE_B", "MECH_A", "ECE_A", "ece_D", "C"];
    expect(sectionsWithPrefix(existing, "ECE_")).toEqual(["ece_D", "ECE_A", "ECE_B"].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    expect(nextSectionName(existing, "ECE_")).toBe("ECE_C");
    expect(nextSectionName(["MECH_A"], "ECE_")).toBe("ECE_A");
    expect(nextSectionName(existing, null)).toBeNull();
  });

  it("never offers a letter that is already used, in any case, and stops after Z", () => {
    const all = Array.from({ length: 26 }, (_, i) => `ECE_${String.fromCharCode(65 + i)}`);
    expect(nextSectionName(all, "ECE_")).toBeNull();
    expect(nextSectionName(["ece_a"], "ECE_")).toBe("ECE_B");
  });

  it("treats a box holding only the prefix as unfinished, and normalises a typed prefix", () => {
    expect(isPrefixOnly("ECE_", "ECE_")).toBe(true);
    expect(isPrefixOnly(" ece_ ", "ECE_")).toBe(true);
    expect(isPrefixOnly("ECE_A", "ECE_")).toBe(false);
    expect(isPrefixOnly("", "ECE_")).toBe(false);
    expect(isPrefixOnly("ECE_", null)).toBe(false);

    expect(cleanSectionInput("  ece_a ", "ECE_")).toBe("ECE_a");
    expect(cleanSectionInput("ECE_A", "ECE_")).toBe("ECE_A");
    expect(cleanSectionInput(" B ", "ECE_")).toBe("B");
    expect(cleanSectionInput(" B ", null)).toBe("B");
  });
});
