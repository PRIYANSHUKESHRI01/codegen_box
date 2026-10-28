import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.resolve(__dirname, "../../app");

/** The student sections that belong to a module some programmes do not have, and the capability that opens each. */
const GATED: Record<string, string[]> = {
  "dashboard/practice": ["coding_practice"],
  "dashboard/contests": ["contests"],
  "dashboard/leaderboard": ["coding_practice"],
  "dashboard/company-prep": ["company_prep"],
  "dashboard/projects": ["project_lab"],
  "dashboard/drills": ["skill_drills", "coding_practice"],
  "dashboard/interviews": ["ai_interviews"],
  "dashboard/interview-tracks": ["ai_interviews"],
  "dashboard/vault-interviews": ["ai_interviews"],
  "dashboard/soft-skills": ["soft_skills"],
  "dashboard/learning-centre": ["learning_centre"],
  "dashboard/articles": ["learning_centre"],
  arena: ["hackathons"],
};

/** Sections every student has, whatever their programme: they decide for themselves what to show (or are the module's own shell). */
const FOR_EVERYONE = new Set(["billing", "core", "drives", "reports", "vault", "talent-pool"]);

describe("student sections that depend on a module are gated by it", () => {
  it.each(Object.entries(GATED))("%s is wrapped in a CapabilityGate for %j", (section, capabilities) => {
    const layout = path.join(APP, section, "layout.tsx");
    expect(fs.existsSync(layout), `${section}/layout.tsx exists`).toBe(true);

    const source = fs.readFileSync(layout, "utf8");
    expect(source).toContain("CapabilityGate");
    for (const capability of capabilities) expect(source, `${section} names ${capability}`).toContain(`"${capability}"`);
  });

  it("leaves no other student section ungated by accident", () => {
    const sections = fs
      .readdirSync(path.join(APP, "dashboard"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    const unaccounted = sections.filter((name) => !GATED[`dashboard/${name}`] && !FOR_EVERYONE.has(name));
    expect(unaccounted, `a new student section needs a CapabilityGate layout (or an entry in FOR_EVERYONE): ${unaccounted.join(", ")}`).toEqual([]);
  });
});
