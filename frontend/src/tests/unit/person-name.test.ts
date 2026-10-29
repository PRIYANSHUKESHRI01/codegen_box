import { afterEach, describe, expect, it } from "vitest";
import { properName, withProperName } from "@/lib/personName";
import { getStoredUser, saveSession, type AuthUser } from "@/lib/auth";

// Mirrors backend/tests/Feature/PersonNameTest.php — the two implementations must agree on every one of these.
describe("properName", () => {
  it.each([
    ["alex chen", "Alex Chen"],
    ["Alex Chen", "Alex Chen"],
    ["priya", "Priya"],
    ["aARAV sharma", "AARAV Sharma"],
    ["anne-marie dsouza", "Anne-Marie Dsouza"],
    ["AKASH KUMAR", "AKASH KUMAR"],
    ["ronan mcDonald", "Ronan McDonald"],
    ["conor o'brien", "Conor O'brien"],
    ["  asha   rao  ", "Asha Rao"],
    ["asha\trao", "Asha Rao"],
    ["élodie müller", "Élodie Müller"],
    ["k. venkata rao", "K. Venkata Rao"],
    ["3rd floor", "3rd Floor"],
    ["", ""],
  ])("%j reads as %j", (typed, shown) => {
    expect(properName(typed)).toBe(shown);
  });

  it("passes null and undefined through untouched", () => {
    expect(properName(null)).toBeNull();
    expect(properName(undefined)).toBeUndefined();
  });
});

describe("withProperName", () => {
  it("returns the very same object when the name is already right (no needless re-renders)", () => {
    const user = { id: 1, name: "Asha Rao" };
    expect(withProperName(user)).toBe(user);
  });

  it("returns a corrected copy, leaving the original alone", () => {
    const user = { id: 1, name: "asha rao", email: "a@b.c" };
    const fixed = withProperName(user);
    expect(fixed).toEqual({ id: 1, name: "Asha Rao", email: "a@b.c" });
    expect(user.name).toBe("asha rao");
  });

  it("tolerates no user, and a user with no name", () => {
    expect(withProperName(null)).toBeNull();
    const nameless = { id: 2 } as { id: number; name?: string };
    expect(withProperName(nameless)).toBe(nameless);
  });
});

describe("a session cached in the browser before the rule existed", () => {
  afterEach(() => window.localStorage.clear());

  it("is read back with a capitalised name, so the dashboard never greets 'asha' in lower case", () => {
    window.localStorage.setItem("aptrun_token", "t");
    window.localStorage.setItem("aptrun_user", JSON.stringify({ id: 1, name: "asha rao", role: "user" }));

    expect(getStoredUser()?.name).toBe("Asha Rao");
  });

  it("round-trips a name saved after sign-in", () => {
    saveSession("t", { id: 1, name: "priya nair", role: "user" } as unknown as AuthUser);
    expect(getStoredUser()?.name).toBe("Priya Nair");
  });
});
