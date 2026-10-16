"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { executeJudged } from "@/lib/judge";
import type { RunProgress } from "@/components/practice/JudgingView";
import type { RunResponse } from "@/types/problem";

export type RunAction = "run" | "submit";
export type RunStatus = "idle" | "running" | "done" | "error";

/**
 * Even an instant verdict (a cached Run, an empty queue) spends a beat "checking": without it the
 * result would flicker in before the student has registered that anything happened. Measured from
 * the click, so a slow judge adds nothing — and it is display only (contest penalties are timed from
 * the click on the server, never from when the browser drew the verdict).
 */
export const DEFAULT_MIN_CHECKING_MS: Record<RunAction, number> = { run: 650, submit: 950 };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface Options {
  /** The problem's judge endpoint, without the action: `/problems/two-sum` → `/problems/two-sum/run` and `/submit`. Null until it is known. */
  endpoint: string | null;
  language: string;
  code: string;
  minCheckingMs?: Record<RunAction, number>;
  /** Fired the instant a run starts — the page uses it to bring the result into view. */
  onStart?: (action: RunAction) => void;
  /** Fired when a verdict has been put on screen. */
  onVerdict?: (action: RunAction, result: RunResponse) => void;
}

/**
 * The one place a Run/Submit is driven from, shared by the practice screen and the contest screen:
 * it sends the code, follows the judge's real state (sending → queued → running → done), keeps the
 * minimum "checking" beat, and exposes everything the console needs to show it.
 */
export function useJudgedRun(options: Options) {
  const [state, setState] = useState<RunStatus>("idle");
  const [lastAction, setLastAction] = useState<RunAction | null>(null);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<RunProgress>({ phase: "sending" });
  const [startedAt, setStartedAt] = useState(0);
  const [resultKey, setResultKey] = useState(0);

  // Callers pass fresh values every render; the stable `execute` below always reads the latest.
  const latest = useRef(options);
  latest.current = options;
  const busy = useRef(false);

  const execute = useCallback(async (action: RunAction) => {
    const { endpoint, language, code, onStart, onVerdict, minCheckingMs = DEFAULT_MIN_CHECKING_MS } = latest.current;
    if (!endpoint || busy.current) return;

    busy.current = true;
    const started = Date.now();

    setLastAction(action);
    setState("running");
    setError(null);
    setStartedAt(started);
    setProgress({ phase: "sending" });
    onStart?.(action);

    try {
      // Run/Submit enqueue and return a token; executeJudged polls it and hands back the verdict.
      const verdict = await executeJudged<RunResponse>(`${endpoint}/${action}`, { language, code }, (p) =>
        setProgress({ phase: p.state, position: p.position, totalCases: p.totalCases })
      );

      const wait = minCheckingMs[action] - (Date.now() - started);
      if (wait > 0) {
        // It came straight back: show the cases being checked for the rest of the beat.
        setProgress((p) => (p.phase === "sending" ? { phase: "running", totalCases: verdict.results?.length || p.totalCases } : p));
        await sleep(wait);
      }

      setResult(verdict);
      setResultKey((k) => k + 1);
      setState("done");
      latest.current.onVerdict?.(action, verdict);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the execution engine. Please try again.");
      setState("error");
    } finally {
      busy.current = false;
    }
  }, []);

  return { state, lastAction, result, error, progress, startedAt, resultKey, execute };
}
