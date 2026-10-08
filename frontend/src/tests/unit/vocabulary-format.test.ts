import { describe, expect, it } from "vitest";
import { formatSeconds, kindLabel, letterCountLabel, percent, sessionHref, splitAroundWord, strengthLevel, verdictFor } from "@/lib/vocabulary/format";

describe("splitAroundWord", () => {
  it("bolds the first whole-word occurrence, ignoring case", () => {
    expect(splitAroundWord("Please Approve the plan.", "approve")).toEqual([
      { text: "Please ", hit: false },
      { text: "Approve", hit: true },
      { text: " the plan.", hit: false },
    ]);
  });

  it("does not match inside a longer word", () => {
    expect(splitAroundWord("The team was affected badly.", "affect")).toEqual([{ text: "The team was affected badly.", hit: false }]);
    expect(splitAroundWord("Reaffect it.", "affect")).toEqual([{ text: "Reaffect it.", hit: false }]);
  });

  it("finds a later whole-word occurrence when an earlier one is inside another word", () => {
    expect(splitAroundWord("Affected people affect results.", "affect")).toEqual([
      { text: "Affected people ", hit: false },
      { text: "affect", hit: true },
      { text: " results.", hit: false },
    ]);
  });

  it("handles phrases, even when the sentence has extra spacing", () => {
    expect(splitAroundWord("I will follow  up on Friday.", "follow up")).toEqual([
      { text: "I will ", hit: false },
      { text: "follow  up", hit: true },
      { text: " on Friday.", hit: false },
    ]);
  });

  it("handles apostrophes and accents", () => {
    expect(splitAroundWord("It's important.", "it's")[0]).toEqual({ text: "It's", hit: true });
    expect(splitAroundWord("A cliché here.", "cliché")[1]).toEqual({ text: "cliché", hit: true });
  });

  it("treats regex characters in a word literally", () => {
    expect(splitAroundWord("Costs (approx.) rise.", "(approx.)")).toEqual([
      { text: "Costs ", hit: false },
      { text: "(approx.)", hit: true },
      { text: " rise.", hit: false },
    ]);
  });

  it("returns the sentence untouched when the word is absent or empty", () => {
    expect(splitAroundWord("Nothing here.", "agenda")).toEqual([{ text: "Nothing here.", hit: false }]);
    expect(splitAroundWord("Anything.", "  ")).toEqual([{ text: "Anything.", hit: false }]);
  });

  it("works when the word starts or ends the sentence", () => {
    expect(splitAroundWord("Agenda first", "agenda")).toEqual([
      { text: "Agenda", hit: true },
      { text: " first", hit: false },
    ]);
    expect(splitAroundWord("Read the agenda", "agenda")).toEqual([
      { text: "Read the ", hit: false },
      { text: "agenda", hit: true },
    ]);
  });
});

describe("sessionHref", () => {
  it("builds a link that starts a session", () => {
    expect(sessionHref({ kind: "daily" })).toBe("/dashboard/learning-centre/vocabulary/session?kind=daily");
    expect(sessionHref({ kind: "deck", deck: "tech-and-engineering" })).toBe("/dashboard/learning-centre/vocabulary/session?kind=deck&deck=tech-and-engineering");
    expect(sessionHref({ kind: "weak", from: 12 })).toBe("/dashboard/learning-centre/vocabulary/session?kind=weak&from=12");
  });

  it("links straight to an existing session by id, ignoring the other options", () => {
    expect(sessionHref({ kind: "daily", attemptId: 5 })).toBe("/dashboard/learning-centre/vocabulary/session?attemptId=5");
  });
});

describe("small formatters", () => {
  it("describes how many letters a typed answer has", () => {
    expect(letterCountLabel({ letters: 8, word_count: 1 })).toBe("8 letters");
    expect(letterCountLabel({ letters: 8, word_count: 2 })).toBe("2 words · 8 letters");
    expect(letterCountLabel({ letters: 1, word_count: 1 })).toBe("1 letter");
  });

  it("formats durations", () => {
    expect(formatSeconds(0)).toBe("1 sec");
    expect(formatSeconds(45)).toBe("45 sec");
    expect(formatSeconds(120)).toBe("2 min");
    expect(formatSeconds(130)).toBe("2 min 10 sec");
  });

  it("lights one more memory box than the word's box, and none for an unseen word", () => {
    expect(strengthLevel(null)).toBe(0);
    expect(strengthLevel(undefined)).toBe(0);
    expect(strengthLevel(0)).toBe(1);
    expect(strengthLevel(4)).toBe(5);
    expect(strengthLevel(5)).toBe(6);
    expect(strengthLevel(99)).toBe(6);
  });

  it("computes percentages safely", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 5)).toBe(100);
  });

  it("names each kind of session", () => {
    expect(kindLabel("daily")).toBe("Today’s sprint");
    expect(kindLabel("custom")).toBe("Quick quiz");
  });

  it("gives a kind verdict at every level", () => {
    expect(verdictFor(100).tone).toBe("great");
    expect(verdictFor(75).tone).toBe("good");
    expect(verdictFor(40).tone).toBe("keep");
    expect(verdictFor(40).headline).not.toMatch(/fail|bad|poor/i);
  });
});
