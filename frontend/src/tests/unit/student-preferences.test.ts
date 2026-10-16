import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JUDGE_LANGUAGES } from "@/lib/judgeLanguages";
import {
  CAREER_GOALS,
  FOCUS_AREAS,
  MAX_LANGUAGES,
  POPULAR_LANGUAGE_IDS,
  SKILL_LEVELS,
  WEEKLY_PACES,
  choiceLabel,
  pickInitialLanguage,
  preferredLanguageList,
  recallLastLanguage,
  rememberLastLanguage,
} from "@/lib/studentPreferences";
import { PROFICIENCY_META, daysAgo, describeFinding, languageList, relativeDays } from "@/lib/languageInsights";
import type { LanguageFinding } from "@/types/languageInsights";

describe("pickInitialLanguage — which language the editor opens in", () => {
  const all = ["cpp", "java", "python", "javascript"];

  it("prefers the language they last used on this device, if the problem offers it", () => {
    expect(pickInitialLanguage(all, { primary_language: "python", preferred_languages: ["python", "java"] }, "java")).toBe("java");
  });

  it("falls back to their stated main language", () => {
    expect(pickInitialLanguage(all, { primary_language: "python", preferred_languages: ["python", "java"] }, null)).toBe("python");
  });

  it("then to the other languages they said they know, in the order they gave them", () => {
    expect(pickInitialLanguage(["cpp", "java"], { primary_language: "rust", preferred_languages: ["rust", "go", "java"] }, null)).toBe("java");
  });

  it("ignores a last-used or stated language the problem does not offer", () => {
    expect(pickInitialLanguage(["cpp", "java"], { primary_language: "python", preferred_languages: ["python"] }, "go")).toBe("cpp");
  });

  it("keeps the old behaviour — the problem's first language — when they have no preference", () => {
    expect(pickInitialLanguage(["java", "cpp"], null, null)).toBe("java");
    expect(pickInitialLanguage(["java", "cpp"], { primary_language: null, preferred_languages: null }, null)).toBe("java");
  });

  it("never returns something the problem does not offer, and survives an empty list", () => {
    expect(pickInitialLanguage([], { primary_language: "python" }, "python")).toBe("javascript");
    expect(pickInitialLanguage([], null, null, "python")).toBe("python");
    expect(all).toContain(pickInitialLanguage(all, { primary_language: "brainfuck" }, "cobol"));
  });
});

describe("preferredLanguageList", () => {
  it("leads with the main language, de-duplicates, and drops anything the judge doesn't run", () => {
    expect(preferredLanguageList({ primary_language: "python", preferred_languages: ["java", "python", "cobol"] })).toEqual(["python", "java"]);
    expect(preferredLanguageList({})).toEqual([]);
  });
});

describe("the last language remembered per device", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("round-trips per student", () => {
    rememberLastLanguage(7, "go");
    rememberLastLanguage(8, "rust");

    expect(recallLastLanguage(7)).toBe("go");
    expect(recallLastLanguage(8)).toBe("rust");
    expect(recallLastLanguage(9)).toBeNull();
  });

  it("does nothing without a student id", () => {
    rememberLastLanguage(null, "go");
    expect(recallLastLanguage(undefined)).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});

describe("the option catalogues", () => {
  it("only offer languages the judge runs, with the popular ones among them", () => {
    const known = new Set(JUDGE_LANGUAGES.map((l) => l.id));
    for (const id of POPULAR_LANGUAGE_IDS) expect(known.has(id)).toBe(true);
    expect(MAX_LANGUAGES).toBeGreaterThan(1);
  });

  it("have unique ids and a label for each choice", () => {
    for (const list of [SKILL_LEVELS, CAREER_GOALS, FOCUS_AREAS, WEEKLY_PACES]) {
      const ids = list.map((c) => c.id as string);
      expect(new Set(ids).size).toBe(ids.length);
      for (const choice of list) expect(choice.label.length).toBeGreaterThan(0);
    }
  });

  it("keep the weekly targets the dashboard shows in step with the backend (StudentPreferences::PACE_TARGETS)", () => {
    expect(WEEKLY_PACES.map((p) => [p.id, p.solved, p.hard])).toEqual([
      ["casual", 10, 2],
      ["steady", 20, 5],
      ["intense", 35, 10],
    ]);
  });

  it("look a choice up by id, tolerating missing and unknown ids", () => {
    expect(choiceLabel(SKILL_LEVELS, "advanced")).toBe("Strong");
    expect(choiceLabel(SKILL_LEVELS, null)).toBeNull();
    expect(choiceLabel(SKILL_LEVELS, "nope")).toBeNull();
  });
});

describe("describeFinding", () => {
  const base: LanguageFinding = {
    kind: "low_acceptance",
    severity: "high",
    language: "java",
    attempts: 8,
    acceptance_rate: 13,
    compile_error_share: 0,
    runtime_error_share: 0,
    dominant_failure: "wrong_answer",
    stronger_language: { language: "python", acceptance_rate: 80 },
  };

  it("names languages the way the editor does and quotes the stronger one", () => {
    const copy = describeFinding(base);
    expect(copy.title).toBe("Java · Low acceptance");
    expect(copy.detail).toContain("13% of 8 Java submissions");
    expect(copy.detail).toContain("mostly wrong answers");
    expect(copy.detail).toContain("Python3 is at 80%");
  });

  it("omits the comparison when there is no clearly stronger language", () => {
    expect(describeFinding({ ...base, stronger_language: null, dominant_failure: null }).detail).toBe("Only 13% of 8 Java submissions were accepted.");
  });

  it("words compile-error, runtime-error and unpractised-language findings", () => {
    expect(describeFinding({ ...base, kind: "compile_errors", compile_error_share: 40, acceptance_rate: 50 }).detail).toContain("40% of 8 Java submissions failed to compile");
    expect(describeFinding({ ...base, kind: "runtime_errors", runtime_error_share: 30 }).detail).toContain("30% of 8 Java submissions crashed");
    expect(describeFinding({ ...base, kind: "preferred_not_practiced", attempts: 0 }).detail).toContain("nothing has been submitted in it yet");
  });

  it("gives actionable advice for every kind", () => {
    for (const kind of ["low_acceptance", "compile_errors", "runtime_errors", "preferred_not_practiced"] as const) {
      expect(describeFinding({ ...base, kind }).advice.length).toBeGreaterThan(20);
    }
  });
});

describe("language insight helpers", () => {
  it("has a pill style for every proficiency", () => {
    for (const p of ["strong", "steady", "needs_work", "getting_started"] as const) expect(PROFICIENCY_META[p].label).toBeTruthy();
  });

  it("lists a few languages with an overflow count", () => {
    expect(languageList(["python", "java"])).toBe("Python3 · Java");
    expect(languageList(["python", "java", "cpp", "go", "rust"], 3)).toBe("Python3 · Java · C++ +2");
    expect(languageList([])).toBe("");
  });

  it("counts calendar days, not 24-hour periods", () => {
    const now = new Date(2026, 9, 14, 9, 0, 0);
    expect(daysAgo(new Date(2026, 9, 13, 23, 59, 0).toISOString(), now)).toBe(1);
    expect(daysAgo(new Date(2026, 9, 14, 0, 1, 0).toISOString(), now)).toBe(0);
    expect(daysAgo(null, now)).toBeNull();
    expect(daysAgo("not a date", now)).toBeNull();
  });

  it("words a gap in days naturally", () => {
    expect(relativeDays(null)).toBe("never");
    expect(relativeDays(0)).toBe("today");
    expect(relativeDays(1)).toBe("yesterday");
    expect(relativeDays(5)).toBe("5 days ago");
    expect(relativeDays(21)).toBe("3 weeks ago");
    expect(relativeDays(95)).toBe("3 months ago");
  });
});
