import { describe, expect, it } from "vitest";
import { needsCoreCheck, resolveHomeLayout } from "@/lib/homeLayout";

describe("which home a student lands on", () => {
  it("is the software home for CSE, unknown branches and anyone without live Core Prep — whatever they chose", () => {
    for (const discipline of ["cse", null, undefined]) {
      for (const trackFocus of [null, "core_first", "balanced", "it_first"]) {
        expect(resolveHomeLayout({ discipline, trackFocus, coreAvailable: true })).toBe("software");
      }
    }
    expect(resolveHomeLayout({ discipline: "ece", trackFocus: "core_first", coreAvailable: false })).toBe("software");
    expect(resolveHomeLayout({ discipline: "mech", trackFocus: "balanced" })).toBe("software");
  });

  it("follows the chosen track for a core-branch student whose Core Prep is live", () => {
    for (const discipline of ["ece", "eee", "mech", "civil", "other"]) {
      expect(resolveHomeLayout({ discipline, trackFocus: "core_first", coreAvailable: true })).toBe("core");
      expect(resolveHomeLayout({ discipline, trackFocus: "balanced", coreAvailable: true })).toBe("balanced");
      expect(resolveHomeLayout({ discipline, trackFocus: "it_first", coreAvailable: true })).toBe("software");
      expect(resolveHomeLayout({ discipline, trackFocus: null, coreAvailable: true })).toBe("software");
    }
  });

  it("only makes a core-branch student wait for the Core Prep answer", () => {
    expect(needsCoreCheck("ece")).toBe(true);
    expect(needsCoreCheck("civil")).toBe(true);
    expect(needsCoreCheck("cse")).toBe(false);
    expect(needsCoreCheck(null)).toBe(false);
  });

  it("is the general home for a programme without coding, whatever else is true of the student", () => {
    for (const discipline of ["bcom", "mba", "lang_lit", null, undefined]) {
      for (const trackFocus of [null, "core_first", "balanced", "it_first"]) {
        expect(resolveHomeLayout({ discipline, trackFocus, coreAvailable: true, codes: false })).toBe("general");
        expect(resolveHomeLayout({ discipline, trackFocus, coreAvailable: false, codes: false })).toBe("general");
      }
    }
  });

  it("is never the general home for someone who codes, and an unknown 'codes' keeps the old behaviour", () => {
    expect(resolveHomeLayout({ discipline: "cse", codes: true })).toBe("software");
    expect(resolveHomeLayout({ discipline: "ece", trackFocus: "core_first", coreAvailable: true, codes: true })).toBe("core");
    expect(resolveHomeLayout({ discipline: "ece", trackFocus: "core_first", coreAvailable: true })).toBe("core");
  });

  it("does not make a commerce student wait for a Core Prep answer", () => {
    expect(needsCoreCheck("bcom")).toBe(false);
    expect(needsCoreCheck("mba")).toBe(false);
  });
});
