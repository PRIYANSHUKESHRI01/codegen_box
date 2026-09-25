import { describe, it, expect } from "vitest";
import { PROBLEMS_DATA } from "@/data/problems";
import { LANGUAGES_DATA } from "@/data/languages";

/**
 * PROBLEMS_DATA is still real mock data used by RecommendedProblemsPanel
 * (an authenticated admin screen) — not the landing page anymore, which now
 * fetches real problems from GET /public/problems/sample. LANGUAGES_DATA
 * backs the landing page's Languages section directly and must stay in sync
 * with the real judge config (backend/config/piston.php) — exactly 4
 * languages, no Rust.
 */
describe("centralized dummy data integrity", () => {
  it("validates problems dataset structure", () => {
    expect(PROBLEMS_DATA.length).toBeGreaterThanOrEqual(10);
    PROBLEMS_DATA.forEach((p) => {
      expect(p.id).toBeDefined();
      expect(p.title.length).toBeGreaterThan(0);
      expect(["Easy", "Medium", "Hard"]).toContain(p.difficulty);
      expect(p.tags.length).toBeGreaterThan(0);
      expect(p.acceptanceRate).toBeGreaterThan(0);
      expect(p.acceptanceRate).toBeLessThanOrEqual(100);
    });
  });

  it("validates supported languages match the real judge config exactly", () => {
    expect(LANGUAGES_DATA.length).toBe(4);
    expect(LANGUAGES_DATA.map((l) => l.id).sort()).toEqual(["cpp", "java", "javascript", "python"]);
    LANGUAGES_DATA.forEach((lang) => {
      expect(lang.id).toBeDefined();
      expect(lang.defaultSnippet.length).toBeGreaterThan(20);
      expect(lang.compiler.length).toBeGreaterThan(0);
    });
  });
});
