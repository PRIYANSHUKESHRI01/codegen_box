import { describe, expect, it } from "vitest";
import { buildStudentNav } from "@/components/dashboard/studentNav";

const flat = (opts: Parameters<typeof buildStudentNav>[0]) => buildStudentNav(opts).map((s) => ({ title: s.title, items: s.items.map((i) => `${i.label}|${i.href}${i.locked ? "|locked" : ""}${i.badge ? `|${i.badge}` : ""}`) }));

/** The rail exactly as it was before Core Prep existed — a CSE student must still get precisely this. */
const ORIGINAL = [
  {
    title: "Your Arena",
    items: ["Overview|/dashboard", "Practice Arena|/dashboard/practice", "Performance Report|/dashboard/reports", "Learning Centre|/dashboard/learning-centre|AI", "Project Lab|/dashboard/projects|New"],
  },
  {
    title: "Competition",
    items: ["Upcoming & Drives|/dashboard#placement-drives", "Company PYQs|/dashboard/company-prep|New", "Contests|/dashboard/contests", "AI Interviews|/dashboard/interviews", "Soft Skills|/dashboard/soft-skills", "Vault|/dashboard/vault|New", "Submissions|/dashboard#submissions", "Global Leaderboard|/dashboard/leaderboard"],
  },
];

describe("student navigation", () => {
  it("is unchanged for a CSE student, an unknown branch, or a branch whose Core Prep is not live", () => {
    const base = { projectLabEnabled: true, vaultEnabled: true };
    expect(flat(base)).toEqual(ORIGINAL);
    expect(flat({ ...base, coreAvailable: false })).toEqual(ORIGINAL);
    expect(flat({ ...base, coreAvailable: false, trackFocus: "core_first" })).toEqual(ORIGINAL);
  });

  it("keeps the plan locks exactly as before", () => {
    const locked = flat({ projectLabEnabled: false, vaultEnabled: false });
    expect(locked[0].items).toContain("Project Lab|/dashboard/projects|locked");
    expect(locked[1].items).toContain("Vault|/dashboard/vault|locked");
    const unknown = flat({ projectLabEnabled: null, vaultEnabled: null });
    expect(unknown[0].items).toContain("Project Lab|/dashboard/projects|New");
  });

  it("adds exactly two items — Core Prep and Skill Drills — after Practice Arena for a student who leads with IT or balances", () => {
    for (const trackFocus of [null, "balanced", "it_first"]) {
      const nav = flat({ projectLabEnabled: true, vaultEnabled: true, coreAvailable: true, trackFocus });
      expect(nav[0].items.map((i) => i.split("|")[0])).toEqual(["Overview", "Practice Arena", "Core Prep", "Skill Drills", "Performance Report", "Learning Centre", "Project Lab"]);
      expect(nav[1]).toEqual(ORIGINAL[1]);
    }
  });

  it("puts Core Prep and Skill Drills right under Overview for a student leading with their branch", () => {
    const nav = flat({ projectLabEnabled: true, vaultEnabled: true, coreAvailable: true, trackFocus: "core_first" });
    expect(nav[0].items.slice(0, 4).map((i) => i.split("|")[0])).toEqual(["Overview", "Core Prep", "Skill Drills", "Practice Arena"]);
    expect(nav[0].items).toContain("Core Prep|/dashboard/core|New");
    expect(nav[0].items).toContain("Skill Drills|/dashboard/drills|New");
  });

  describe("for a programme without coding (Management, Commerce, Arts)", () => {
    const NO_CODING = { coding_practice: false, contests: false, company_prep: false, project_lab: false, hackathons: false, skill_drills: false, domain_prep: true };
    const rail = (over: Partial<Parameters<typeof buildStudentNav>[0]> = {}) =>
      flat({ projectLabEnabled: true, vaultEnabled: true, capabilities: NO_CODING, coreAvailable: true, domainPrepLabel: "Commerce Prep", ...over });

    it("loses every coding module and keeps the ones it has", () => {
      const nav = rail();
      const labels = nav.flatMap((s) => s.items.map((i) => i.split("|")[0]));

      for (const gone of ["Practice Arena", "Project Lab", "Company PYQs", "Contests", "Submissions", "Global Leaderboard", "Skill Drills"]) {
        expect(labels, gone).not.toContain(gone);
      }
      for (const kept of ["Overview", "Performance Report", "Learning Centre", "AI Interviews", "Soft Skills", "Vault", "Upcoming & Drives"]) {
        expect(labels, kept).toContain(kept);
      }
    });

    it("puts the department's own prep right under Overview, under its own name", () => {
      expect(rail()[0].items.slice(0, 2).map((i) => i.split("|")[0])).toEqual(["Overview", "Commerce Prep"]);
      expect(rail({ domainPrepLabel: "Management Prep" })[0].items[1]).toContain("Management Prep|/dashboard/core");
    });

    it("shows no prep item until the server says it exists for this student", () => {
      const labels = rail({ coreAvailable: false })[0].items.map((i) => i.split("|")[0]);
      expect(labels).toEqual(["Overview", "Performance Report", "Learning Centre"]);
    });

    it("gives a branch back what its department lacks (B.Com Computer Applications codes)", () => {
      const labels = rail({ capabilities: { ...NO_CODING, coding_practice: true, contests: true, company_prep: true } }).flatMap((s) => s.items.map((i) => i.split("|")[0]));
      expect(labels).toEqual(expect.arrayContaining(["Practice Arena", "Contests", "Company PYQs", "Submissions", "Global Leaderboard"]));
    });
  });
});
