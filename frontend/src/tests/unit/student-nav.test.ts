import { describe, expect, it } from "vitest";
import { buildStudentNav } from "@/components/dashboard/studentNav";

const flat = (opts: Parameters<typeof buildStudentNav>[0]) => buildStudentNav(opts).map((s) => ({ title: s.title, items: s.items.map((i) => `${i.label}|${i.href}${i.locked ? "|locked" : ""}${i.badge ? `|${i.badge}` : ""}`) }));

/**
 * The rail a CSE student gets: three groups by purpose — Your Arena (build skill, then the report that measures it),
 * Placements (get hired) and Competition (measure yourself). Every Overview section that has a page of its own is reached from
 * here, once; there are no #anchors back into the Overview any more.
 */
const ORIGINAL = [
  {
    title: "Your Arena",
    items: ["Overview|/dashboard", "Practice Arena|/dashboard/practice", "Learning Centre|/dashboard/learning-centre|AI", "Soft Skills|/dashboard/soft-skills", "Project Lab|/dashboard/projects|New", "Performance Report|/dashboard/reports"],
  },
  {
    title: "Placements",
    items: ["Upcoming Drives|/dashboard/drives", "Company PYQs|/dashboard/company-prep|New", "Mock AI Interview|/dashboard/interviews", "Vault AI Interview|/dashboard/vault-interviews", "Mellow Vault|/dashboard/vault|Get Hired"],
  },
  {
    title: "Competition",
    items: ["Contests|/dashboard/contests", "Global Leaderboard|/dashboard/leaderboard"],
  },
];

describe("student navigation", () => {
  it("never points back into the Overview with an anchor (Upcoming Drives and Submissions used to bounce to /dashboard#…)", () => {
    for (const s of buildStudentNav({ projectLabEnabled: true, vaultEnabled: true })) for (const i of s.items) expect(i.href, i.label).not.toContain("#");
  });

  it("is stable for a CSE student, an unknown branch, or a branch whose Core Prep is not live", () => {
    const base = { projectLabEnabled: true, vaultEnabled: true };
    expect(flat(base)).toEqual(ORIGINAL);
    expect(flat({ ...base, coreAvailable: false })).toEqual(ORIGINAL);
    expect(flat({ ...base, coreAvailable: false, trackFocus: "core_first" })).toEqual(ORIGINAL);
  });

  it("calls the practice interviews Mock AI Interview, and keeps Vault AI Interview as the separate final step", () => {
    const labels = flat({ projectLabEnabled: true, vaultEnabled: true })[1].items.map((i) => i.split("|")[0]);
    expect(labels).toContain("Mock AI Interview");
    expect(labels).toContain("Vault AI Interview");
    expect(labels).not.toContain("AI Interviews");
  });

  describe("the Vault AI Interview item", () => {
    const base = { projectLabEnabled: true, vaultEnabled: true };
    const item = (vaultAi: Parameters<typeof buildStudentNav>[0]["vaultAi"]) =>
      buildStudentNav({ ...base, vaultAi })[1].items.find((i) => i.href === "/dashboard/vault-interviews");

    it("wears a gold Priority badge (not the green New) when it is open to the student", () => {
      for (const vaultAi of [{ state: "open" as const, reasons: [], days_remaining: null, readiness: null }]) {
        const i = item(vaultAi);
        expect(i?.locked).toBeUndefined();
        expect(i?.badge).toBe("Priority");
        expect(i?.badgeTone).toBe("priority");
      }
    });

    it("shows no badge and no lock while the answer is still unknown, so nothing flashes", () => {
      for (const vaultAi of [null, undefined]) {
        const i = item(vaultAi);
        expect(i).toBeDefined();
        expect(i?.locked).toBeUndefined();
        expect(i?.badge).toBeUndefined();
      }
    });

    it("never calls it New any more", () => {
      for (const vaultAi of [null, { state: "open" as const, reasons: [], days_remaining: null, readiness: null }]) {
        expect(item(vaultAi)?.badge).not.toBe("New");
      }
    });

    it("stays in the rail, locked, with the days left, for a college student still waiting", () => {
      const i = item({ state: "locked", reasons: ["waiting_period", "readiness"], days_remaining: 45, readiness: { score: 20, required: 60, met: false, points_needed: 40 } });

      expect(i?.locked).toBe(true);
      expect(i?.lockChip).toBe("45d");
      expect(i?.lockTitle).toBe("Vault AI Interview — unlocks in 45 days");
      expect(i?.badge).toBeUndefined();
      expect(i?.href).toBe("/dashboard/vault-interviews");
    });

    it("counts down: 44 days a day later", () => {
      expect(item({ state: "locked", reasons: ["waiting_period"], days_remaining: 44, readiness: null })?.lockChip).toBe("44d");
    });

    it("stays locked, without a countdown chip, once the wait is over but readiness is short", () => {
      const i = item({ state: "locked", reasons: ["readiness"], days_remaining: 0, readiness: { score: 40, required: 60, met: false, points_needed: 20 } });

      expect(i?.locked).toBe(true);
      expect(i?.lockChip).toBeUndefined();
      expect(i?.lockTitle).toBe("Vault AI Interview — reach 60% readiness to unlock");
    });

    it("is taken out of the rail for a year that is not offered it", () => {
      expect(item({ state: "unavailable", reasons: ["year_not_offered"], days_remaining: null, readiness: null })).toBeUndefined();
    });

    it("never takes the rest of the rail with it", () => {
      const locked = flat({ ...base, vaultAi: { state: "unavailable", reasons: ["year_not_offered"], days_remaining: null, readiness: null } });
      const expected = ORIGINAL[1].items.filter((i) => !i.startsWith("Vault AI Interview"));
      expect(locked[1].items).toEqual(expected);
    });

    it("is not there at all for a programme without AI interviews", () => {
      const labels = buildStudentNav({ ...base, capabilities: { ai_interviews: false } })[1].items.map((i) => i.label);
      expect(labels).not.toContain("Vault AI Interview");
      expect(labels).not.toContain("Mock AI Interview");
    });
  });

  it("keeps the plan locks exactly as before", () => {
    const locked = flat({ projectLabEnabled: false, vaultEnabled: false });
    expect(locked[0].items).toContain("Project Lab|/dashboard/projects|locked");
    expect(locked[1].items).toContain("Mellow Vault|/dashboard/vault|locked");
    const unknown = flat({ projectLabEnabled: null, vaultEnabled: null });
    expect(unknown[0].items).toContain("Project Lab|/dashboard/projects|New");
  });

  it("adds exactly two items — Core Prep and Skill Drills — after Practice Arena for a student who leads with IT or balances", () => {
    for (const trackFocus of [null, "balanced", "it_first"]) {
      const nav = flat({ projectLabEnabled: true, vaultEnabled: true, coreAvailable: true, trackFocus });
      expect(nav[0].items.map((i) => i.split("|")[0])).toEqual(["Overview", "Practice Arena", "Core Prep", "Skill Drills", "Learning Centre", "Soft Skills", "Project Lab", "Performance Report"]);
      expect(nav[1]).toEqual(ORIGINAL[1]);
      expect(nav[2]).toEqual(ORIGINAL[2]);
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
      for (const kept of ["Overview", "Performance Report", "Learning Centre", "Mock AI Interview", "Vault AI Interview", "Soft Skills", "Mellow Vault", "Upcoming Drives"]) {
        expect(labels, kept).toContain(kept);
      }
    });

    it("has no empty Competition heading when there is nothing to compete in", () => {
      expect(rail().map((s) => s.title)).toEqual(["Your Arena", "Placements"]);
    });

    it("puts the department's own prep right under Overview, under its own name", () => {
      expect(rail()[0].items.slice(0, 2).map((i) => i.split("|")[0])).toEqual(["Overview", "Commerce Prep"]);
      expect(rail({ domainPrepLabel: "Management Prep" })[0].items[1]).toContain("Management Prep|/dashboard/core");
    });

    it("shows no prep item until the server says it exists for this student", () => {
      const labels = rail({ coreAvailable: false })[0].items.map((i) => i.split("|")[0]);
      expect(labels).toEqual(["Overview", "Learning Centre", "Soft Skills", "Performance Report"]);
    });

    it("gives a branch back what its department lacks (B.Com Computer Applications codes)", () => {
      const labels = rail({ capabilities: { ...NO_CODING, coding_practice: true, contests: true, company_prep: true } }).flatMap((s) => s.items.map((i) => i.split("|")[0]));
      expect(labels).toEqual(expect.arrayContaining(["Practice Arena", "Contests", "Company PYQs", "Global Leaderboard"]));
    });
  });
});
