import { describe, expect, it } from "vitest";
import {
  audienceTouchesDepartment,
  branchesByDepartment,
  departmentsFor,
  disciplineStyle,
  inDepartmentScope,
  rowDepartment,
  SCOPE_ALL,
  type BranchCatalog,
} from "@/lib/branches";
import { can, capabilitiesOf, codesAtAll, DEFAULT_CAPABILITIES, departmentCan, domainPrepCopy, domainPrepLabel, isDepartmentScopedRoute } from "@/lib/departments";

const NO_CODING = { coding_practice: false, contests: false, company_prep: false, project_lab: false, hackathons: false, skill_drills: false, domain_prep: true };

const catalog: BranchCatalog = {
  departments: [
    { code: "engineering", name: "Engineering & Technology", short: "Engineering", icon: "cpu", accent: "indigo", domain_prep_label: "Core Prep", capabilities: {} },
    { code: "management", name: "Management & Business Administration", short: "Management", icon: "briefcase", accent: "violet", domain_prep_label: "Management Prep", capabilities: NO_CODING },
    { code: "commerce", name: "Commerce & Accounting", short: "Commerce", icon: "calculator", accent: "emerald", domain_prep_label: "Commerce Prep", capabilities: NO_CODING },
    { code: "arts", name: "Arts, Humanities & Social Sciences", short: "Arts & Humanities", icon: "landmark", accent: "rose", domain_prep_label: "Subject Prep", capabilities: NO_CODING },
  ],
  disciplines: [
    { code: "cse", name: "Computer Science & IT", short: "CSE / IT", department: "engineering" },
    { code: "ece", name: "Electronics & Communication", short: "ECE", department: "engineering" },
    { code: "mba", name: "MBA · PGDM", short: "MBA", department: "management" },
    { code: "bcom", name: "Bachelor of Commerce", short: "B.Com", department: "commerce" },
    { code: "lang_lit", name: "Languages & Literature", short: "Lang & Lit", department: "arts" },
  ],
  branches: [
    { code: "cse", discipline: "cse", name: "Computer Science & Engineering", short: "CSE" },
    { code: "ece", discipline: "ece", name: "Electronics & Communication Engineering", short: "ECE" },
    { code: "mba_finance", discipline: "mba", name: "MBA (Finance)", short: "MBA-Fin" },
    { code: "bcom", discipline: "bcom", name: "B.Com (General)", short: "B.Com" },
    { code: "english", discipline: "lang_lit", name: "BA English", short: "English" },
  ],
  aliases: {},
};

describe("what a student's programme offers", () => {
  it("is everything engineering has when nothing is recorded — an older cached user, a staff account, an unclassified student", () => {
    expect(capabilitiesOf(null)).toEqual(DEFAULT_CAPABILITIES);
    expect(capabilitiesOf({ capabilities: undefined })).toEqual(DEFAULT_CAPABILITIES);
    expect(can(null, "coding_practice")).toBe(true);
    expect(can(null, "domain_prep")).toBe(false);
    expect(codesAtAll(null)).toBe(true);
  });

  it("takes the server's answer over the defaults, one module at a time", () => {
    const commerce = { capabilities: NO_CODING } as never;
    expect(can(commerce, "coding_practice")).toBe(false);
    expect(can(commerce, "domain_prep")).toBe(true);
    expect(can(commerce, "ai_interviews")).toBe(true); // not mentioned: the default stands
    expect(codesAtAll(commerce)).toBe(false);
  });

  it("says a programme codes if it has coding practice OR contests", () => {
    expect(codesAtAll({ capabilities: { ...NO_CODING, contests: true } } as never)).toBe(true);
    expect(codesAtAll({ capabilities: { ...NO_CODING, coding_practice: true } } as never)).toBe(true);
  });
});

describe("what a department offers", () => {
  it("answers from the catalogue, and says yes when it cannot tell", () => {
    expect(departmentCan(catalog, "commerce", "coding_practice")).toBe(false);
    expect(departmentCan(catalog, "commerce", "soft_skills")).toBe(true);
    expect(departmentCan(catalog, "engineering", "coding_practice")).toBe(true);
    expect(departmentCan(catalog, SCOPE_ALL, "coding_practice")).toBe(true);
    expect(departmentCan(catalog, null, "coding_practice")).toBe(true);
    expect(departmentCan(null, "commerce", "coding_practice")).toBe(true);
    expect(departmentCan(catalog, "law", "coding_practice")).toBe(true);
  });
});

describe("what a department calls Domain Prep", () => {
  it("uses the catalogue's word, keeps 'Core Prep' for engineering and a plain default otherwise", () => {
    expect(domainPrepLabel(catalog, "commerce")).toBe("Commerce Prep");
    expect(domainPrepLabel(catalog, "management")).toBe("Management Prep");
    expect(domainPrepLabel(catalog, "arts")).toBe("Subject Prep");
    expect(domainPrepLabel(catalog, null)).toBe("Core Prep");
    expect(domainPrepLabel(null, "engineering")).toBe("Core Prep");
    expect(domainPrepLabel(null, "commerce")).toBe("Domain Prep");
  });

  it("keeps engineering's wording byte for byte and words the others around their own field", () => {
    const eng = domainPrepCopy(catalog, "engineering");
    expect(eng).toMatchObject({ label: "Core Prep", testsLabel: "Core Tests", yours: "your branch", engineering: true });
    expect(eng.subtitle).toBe("Technical practice and timed tests for your branch.");

    const commerce = domainPrepCopy(catalog, "commerce");
    expect(commerce).toMatchObject({ label: "Commerce Prep", testsLabel: "Commerce Tests", yours: "your programme", engineering: false });

    expect(domainPrepCopy(catalog, "arts").yours).toBe("your subject");
    expect(domainPrepCopy(catalog, null).engineering).toBe(true);
  });
});

describe("the departments a college runs", () => {
  it("narrows the catalogue to the enabled ones, in catalogue order, and shows all when unknown", () => {
    expect(departmentsFor(catalog, ["commerce", "engineering"]).map((d) => d.code)).toEqual(["engineering", "commerce"]);
    expect(departmentsFor(catalog, ["engineering"]).map((d) => d.code)).toEqual(["engineering"]);
    expect(departmentsFor(catalog, null)).toHaveLength(4);
    expect(departmentsFor(catalog, [])).toHaveLength(4);
    expect(departmentsFor(null, ["commerce"])).toEqual([]);
  });

  it("groups branches by department and family, leaving out departments with none", () => {
    const grouped = branchesByDepartment(catalog);
    expect(grouped.map((g) => g.department.code)).toEqual(["engineering", "management", "commerce", "arts"]);
    expect(grouped[2].groups[0].branches.map((b) => b.code)).toEqual(["bcom"]);

    const withoutArts = branchesByDepartment({ ...catalog, disciplines: catalog.disciplines.filter((d) => d.department !== "arts") });
    expect(withoutArts.map((g) => g.department.code)).not.toContain("arts");
  });

  it("treats a catalogue from before departments existed as engineering only", () => {
    const old: BranchCatalog = { disciplines: [{ code: "cse", name: "CS", short: "CSE" }], branches: [{ code: "cse", discipline: "cse", name: "CSE", short: "CSE" }] };
    expect(branchesByDepartment(old).map((g) => g.department.code)).toEqual(["engineering"]);
  });
});

describe("filtering a roster by department", () => {
  it("counts a student with no recorded department as engineering, like the server", () => {
    expect(rowDepartment({})).toBe("engineering");
    expect(rowDepartment({ department: null })).toBe("engineering");
    expect(rowDepartment({ department: "commerce" })).toBe("commerce");

    expect(inDepartmentScope({ department: null }, "engineering")).toBe(true);
    expect(inDepartmentScope({ department: null }, "commerce")).toBe(false);
    expect(inDepartmentScope({ department: "commerce" }, "commerce")).toBe(true);
    expect(inDepartmentScope({ department: "commerce" }, "engineering")).toBe(false);
    expect(inDepartmentScope({ department: "commerce" }, SCOPE_ALL)).toBe(true);
  });
});

describe("whether something aimed at an audience is for a department", () => {
  it("is for everyone when it names nobody", () => {
    expect(audienceTouchesDepartment(null, "commerce", catalog)).toBe(true);
    expect(audienceTouchesDepartment({ departments: [], disciplines: [], branches: [] }, "arts", catalog)).toBe(true);
  });

  it("matches a named department, a family inside it, or a branch inside it", () => {
    expect(audienceTouchesDepartment({ departments: ["commerce"] }, "commerce", catalog)).toBe(true);
    expect(audienceTouchesDepartment({ departments: ["commerce"] }, "arts", catalog)).toBe(false);
    expect(audienceTouchesDepartment({ disciplines: ["mba"] }, "management", catalog)).toBe(true);
    expect(audienceTouchesDepartment({ disciplines: ["mba"] }, "commerce", catalog)).toBe(false);
    expect(audienceTouchesDepartment({ branches: ["english"] }, "arts", catalog)).toBe(true);
    expect(audienceTouchesDepartment({ branches: ["english"] }, "engineering", catalog)).toBe(false);
    expect(audienceTouchesDepartment({ branches: ["ece"] }, "engineering", catalog)).toBe(true);
  });

  it("never hides something that may be theirs just because the catalogue has not loaded", () => {
    expect(audienceTouchesDepartment({ branches: ["english"] }, "commerce", null)).toBe(true);
  });

  it("shows everything under ALL", () => {
    expect(audienceTouchesDepartment({ departments: ["commerce"] }, SCOPE_ALL, catalog)).toBe(true);
  });
});

describe("how a family is drawn", () => {
  it("keeps the engineering colours and gives every other family its department's accent", () => {
    expect(disciplineStyle(catalog, "ece").chip).toBe(disciplineStyle(null, "ece").chip);
    expect(disciplineStyle(catalog, "bcom").chip).toContain("emerald");
    expect(disciplineStyle(catalog, "mba").chip).toContain("violet");
    expect(disciplineStyle(catalog, "lang_lit").chip).toContain("rose");
  });
});

describe("which TPO screens follow the department switcher", () => {
  it("draws it on the screens that use it, with or without a trailing slash", () => {
    for (const path of ["/admin", "/admin/", "/admin/students", "/admin/students/", "/admin/reports", "/admin/analytics", "/admin/mock-interviews", "/admin/mock-soft-skills"]) {
      expect(isDepartmentScopedRoute(path), path).toBe(true);
    }
  });

  it("leaves it off screens it would do nothing on", () => {
    for (const path of ["/settings", "/admin/coordinators", "/admin/drives", "/admin/students/report", "/admin/proctoring", "/dashboard", "/superadmin", "", null, undefined]) {
      expect(isDepartmentScopedRoute(path), String(path)).toBe(false);
    }
  });
});
