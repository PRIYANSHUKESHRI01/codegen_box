"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Keeps the on-screen transcript in step with a question being read aloud.
 *
 * The browser can't be asked "which word are you on?" reliably: a voice that supports word timing fires `boundary` events with the
 * character offset of each word (Edge's neural voices, most OS voices), but Chrome's network voices never do. So the reveal runs on an
 * estimate of the speaking pace from the moment speech starts, and the instant a real boundary arrives it takes over — words then
 * appear exactly as they are spoken. Either way the whole question is on screen the moment speech ends, and the last word is never
 * shown before the voice has finished it.
 */

export interface WordSpan {
  start: number;
  end: number;
}

/** Where each whitespace-separated word of `text` starts and ends. */
export function wordSpans(text: string): WordSpan[] {
  const spans: WordSpan[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) spans.push({ start: match.index, end: match.index + match[0].length });
  return spans;
}

/** How many words are spoken once the voice has reached `charIndex` (a boundary event names the word it is *starting*, so that word counts). */
export function wordsThroughChar(spans: WordSpan[], charIndex: number): number {
  let count = 0;
  for (const span of spans) {
    if (span.start <= charIndex) count += 1;
    else break;
  }
  return count;
}

/** Normal speech is ~150 words a minute, a touch under 70 ms a character once spaces are counted. */
const MS_PER_CHAR = 68;
const PAUSE_SENTENCE_MS = 320;
const PAUSE_CLAUSE_MS = 140;
/** With no voice at all, the question just has to feel like it is being written out, not take as long as reading it. */
const SILENT_REVEAL_MAX_MS = 2200;

/** When each word of `text` begins to be spoken, at a normal pace, and when the last one is over. Milliseconds from the start of speech. */
export function estimateWordTimeline(text: string): { starts: number[]; total: number } {
  const spans = wordSpans(text);
  const starts: number[] = [];
  let at = 0;

  for (const span of spans) {
    starts.push(at);
    const word = text.slice(span.start, span.end);
    at += (word.length + 1) * MS_PER_CHAR;
    if (/[.!?…]["')\]]*$/.test(word)) at += PAUSE_SENTENCE_MS;
    else if (/[,;:—–-]["')\]]*$/.test(word)) at += PAUSE_CLAUSE_MS;
  }

  return { starts, total: at };
}

/** Milliseconds after speech starts at which each word begins to be spoken (or, when `silent`, squeezed into a short reveal). */
export function estimateWordStarts(text: string, silent = false): number[] {
  const { starts } = estimateWordTimeline(text);

  if (!silent || starts.length === 0) return starts;
  // A silent reveal is quick: a tenth of the speaking time, and never longer than the cap however long the question is.
  const factor = Math.min(0.1, SILENT_REVEAL_MAX_MS / Math.max(starts[starts.length - 1], 1));
  return starts.map((value) => value * factor);
}

interface Run {
  /** No voice to wait for: the whole text is written out on its own and then finished. */
  silent: boolean;
  total: number;
  spans: WordSpan[];
  starts: number[];
  /** When speech began (or, until the voice says so, when it was asked to). */
  startedAt: number;
  source: "estimate" | "boundary" | "done";
  timer: ReturnType<typeof setInterval> | null;
}

export interface SpokenReveal {
  /** How many words of the current question have been spoken so far. */
  revealedWords: number;
  /** Starts a new question: nothing revealed yet. `silent` is for a browser with no speech voice, where the text is simply written out quickly. */
  begin: (text: string, options?: { silent?: boolean }) => void;
  /** Clears the text and waits, without starting any estimate — for the moment between "the next question is here" and "its voice is ready". */
  hold: () => void;
  /** The voice really started making sound — re-bases the estimate on that instant. */
  markStarted: () => void;
  /** The voice reached the word at `charIndex`. */
  boundary: (charIndex: number) => void;
  /** Speech ended (or was never going to happen): everything is revealed. */
  finish: () => void;
}

export function useSpokenReveal(): SpokenReveal {
  const [revealedWords, setRevealedWords] = useState(0);
  const runRef = useRef<Run | null>(null);

  const stopTimer = useCallback(() => {
    const run = runRef.current;
    if (run?.timer) clearInterval(run.timer);
    if (run) run.timer = null;
  }, []);

  // Words only ever get revealed, never hidden again, so a late or out-of-order signal can't make the text flicker backwards.
  const reveal = useCallback((count: number) => setRevealedWords((current) => (count > current ? count : current)), []);

  const begin = useCallback(
    (text: string, options?: { silent?: boolean }) => {
      stopTimer();
      const spans = wordSpans(text);
      const run: Run = {
        silent: options?.silent ?? false,
        total: spans.length,
        spans,
        starts: estimateWordStarts(text, options?.silent),
        startedAt: performance.now(),
        source: "estimate",
        timer: null,
      };
      runRef.current = run;
      setRevealedWords(0);

      run.timer = setInterval(() => {
        if (run.source !== "estimate") return;
        const elapsed = performance.now() - run.startedAt;
        let count = 0;
        while (count < run.starts.length && run.starts[count] <= elapsed) count += 1;
        if (run.silent) {
          reveal(count);
          if (count >= run.total) {
            run.source = "done";
            stopTimer();
          }
          return;
        }
        // The estimate never reveals the final word: only the voice finishing (finish) or a real boundary can say it has been said.
        reveal(Math.min(count, Math.max(run.total - 1, 0)));
      }, 50);
    },
    [reveal, stopTimer]
  );

  const hold = useCallback(() => {
    stopTimer();
    runRef.current = null;
    setRevealedWords(0);
  }, [stopTimer]);

  const markStarted = useCallback(() => {
    const run = runRef.current;
    if (run && run.source === "estimate") run.startedAt = performance.now();
  }, []);

  const boundary = useCallback(
    (charIndex: number) => {
      const run = runRef.current;
      if (!run || run.source === "done") return;
      run.source = "boundary";
      stopTimer();
      reveal(wordsThroughChar(run.spans, charIndex));
    },
    [reveal, stopTimer]
  );

  const finish = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    run.source = "done";
    stopTimer();
    reveal(run.total);
  }, [reveal, stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  return { revealedWords, begin, hold, markStarted, boundary, finish };
}
