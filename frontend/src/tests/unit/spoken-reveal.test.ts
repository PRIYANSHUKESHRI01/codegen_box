import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateWordStarts, useSpokenReveal, wordSpans, wordsThroughChar } from "@/lib/voice/spokenReveal";

const TEXT = "Tell me about a project. What was hard?";

describe("word timing helpers", () => {
  it("finds each word's span", () => {
    expect(wordSpans("Hi  there")).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 9 },
    ]);
    expect(wordSpans("   ")).toEqual([]);
  });

  it("counts a word as spoken once the voice reaches its first character", () => {
    const spans = wordSpans("one two three");
    expect(wordsThroughChar(spans, 0)).toBe(1);
    expect(wordsThroughChar(spans, 3)).toBe(1); // the space after "one"
    expect(wordsThroughChar(spans, 4)).toBe(2);
    expect(wordsThroughChar(spans, 99)).toBe(3);
  });

  it("estimates a later start for every word, pausing longer after a sentence than after a comma", () => {
    const sentence = estimateWordStarts("Yes. Go");
    const clause = estimateWordStarts("Yes, go");
    expect(sentence).toHaveLength(2);
    expect(sentence[0]).toBe(0);
    expect(sentence[1]).toBeGreaterThan(clause[1]);
    expect(clause[1]).toBeGreaterThan(estimateWordStarts("Yes go")[1]);
  });

  it("squeezes a silent reveal into a couple of seconds however long the text is", () => {
    const long = Array.from({ length: 400 }, () => "word").join(" ");
    const silent = estimateWordStarts(long, true);
    expect(silent[silent.length - 1]).toBeLessThanOrEqual(2200);
    expect(estimateWordStarts(long)[399]).toBeGreaterThan(20000);
  });
});

describe("useSpokenReveal", () => {
  // The reveal clock reads performance.now(), so that has to be faked along with the timers.
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] }));
  afterEach(() => vi.useRealTimers());

  it("reveals words on the estimated pace, but never the last one until the voice has finished", () => {
    const { result } = renderHook(() => useSpokenReveal());
    act(() => result.current.begin(TEXT));
    expect(result.current.revealedWords).toBe(0);

    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.revealedWords).toBeGreaterThan(0);
    expect(result.current.revealedWords).toBeLessThan(8);

    act(() => void vi.advanceTimersByTime(60_000));
    expect(result.current.revealedWords).toBe(7); // 8 words, the last one held back

    act(() => result.current.finish());
    expect(result.current.revealedWords).toBe(8);
  });

  it("follows real word boundaries as soon as the browser sends one, and stops estimating", () => {
    const { result } = renderHook(() => useSpokenReveal());
    act(() => result.current.begin(TEXT));

    act(() => result.current.boundary(8)); // "about"
    expect(result.current.revealedWords).toBe(3);

    act(() => void vi.advanceTimersByTime(30_000)); // the estimate would have run on to 7
    expect(result.current.revealedWords).toBe(3);

    act(() => result.current.boundary(0)); // an out-of-order event can't hide words again
    expect(result.current.revealedWords).toBe(3);

    act(() => result.current.finish());
    expect(result.current.revealedWords).toBe(8);
  });

  it("restarts the estimate from the moment the voice really starts", () => {
    const { result } = renderHook(() => useSpokenReveal());
    act(() => result.current.begin(TEXT));
    act(() => void vi.advanceTimersByTime(600)); // a slow network voice: nothing audible yet
    const before = result.current.revealedWords;
    act(() => result.current.markStarted());
    act(() => void vi.advanceTimersByTime(100));
    // Words already shown stay shown, but the clock begins again: only the first word or two come out after the re-base.
    expect(result.current.revealedWords).toBeGreaterThanOrEqual(before);
    expect(result.current.revealedWords).toBeLessThanOrEqual(Math.max(before, 2));
  });

  it("starts from nothing for the next question", () => {
    const { result } = renderHook(() => useSpokenReveal());
    act(() => result.current.begin(TEXT));
    act(() => result.current.finish());
    expect(result.current.revealedWords).toBe(8);

    act(() => result.current.begin("Next question please"));
    expect(result.current.revealedWords).toBe(0);
  });

  it("writes out the whole text by itself when there is no voice", () => {
    const { result } = renderHook(() => useSpokenReveal());
    act(() => result.current.begin(TEXT, { silent: true }));
    act(() => void vi.advanceTimersByTime(3000));
    expect(result.current.revealedWords).toBe(8);
  });
});
