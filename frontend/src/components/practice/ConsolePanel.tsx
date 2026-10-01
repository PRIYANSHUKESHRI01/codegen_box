"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Lock, MinusCircle, Terminal, TriangleAlert, XCircle } from "lucide-react";
import { ProblemExample, RunResponse, RunResultCase } from "@/types/problem";
import { cn } from "@/lib/utils";

/** Stagger between each case flipping from "running" to its real verdict — the LeetCode/GFG-style reveal. */
const REVEAL_STAGGER_MS = 200;

export type ConsoleTab = "testcase" | "result";
export type LastAction = "run" | "submit" | null;
export type RunState = "idle" | "running" | "done" | "error";

interface ConsolePanelProps {
  examples: ProblemExample[];
  activeExample: number;
  onSelectExample: (idx: number) => void;
  activeTab: ConsoleTab;
  onTabChange: (tab: ConsoleTab) => void;
  lastAction: LastAction;
  runState: RunState;
  runResult: RunResponse | null;
  errorMessage: string | null;
  /** Live queue status while a run is in flight, e.g. "In queue — #12". */
  statusNote?: string | null;
}

export function ConsolePanel({
  examples,
  activeExample,
  onSelectExample,
  activeTab,
  onTabChange,
  lastAction,
  runState,
  runResult,
  errorMessage,
  statusNote,
}: ConsolePanelProps) {
  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="flex items-center gap-1 px-3 pt-2.5 border-b border-border-subtle shrink-0">
        <button
          onClick={() => onTabChange("testcase")}
          className={cn(
            "px-3 py-1.5 rounded-t-control text-2xs font-bold transition-colors",
            activeTab === "testcase" ? "bg-elevated text-primary" : "text-text-muted hover:text-primary"
          )}
        >
          Testcase
        </button>
        <button
          onClick={() => onTabChange("result")}
          className={cn(
            "px-3 py-1.5 rounded-t-control text-2xs font-bold transition-colors flex items-center gap-1.5",
            activeTab === "result" ? "bg-elevated text-primary" : "text-text-muted hover:text-primary"
          )}
        >
          Result
          {runState === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "testcase" ? (
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-3 flex-wrap">
              {examples.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectExample(idx)}
                  className={cn(
                    "px-2.5 py-1 rounded-control text-2xs font-bold transition-colors border",
                    activeExample === idx
                      ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                      : "text-text-muted border-border-subtle hover:text-primary"
                  )}
                >
                  Case {idx + 1}
                </button>
              ))}
            </div>
            <div className="font-mono text-xs text-text-secondary space-y-2">
              <div>
                <div className="text-3xs uppercase tracking-wide text-text-muted mb-1">Input</div>
                <div className="rounded-control bg-elevated/60 border border-border-subtle px-3 py-2">
                  {examples[activeExample]?.input}
                </div>
              </div>
              <div>
                <div className="text-3xs uppercase tracking-wide text-text-muted mb-1">Expected Output</div>
                <div className="rounded-control bg-elevated/60 border border-border-subtle px-3 py-2">
                  {examples[activeExample]?.output}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ResultTab
            runState={runState}
            runResult={runResult}
            errorMessage={errorMessage}
            lastAction={lastAction}
            statusNote={statusNote}
          />
        )}
      </div>
    </div>
  );
}

/**
 * How many of `results` have "finished running" in the animation, for the result
 * currently on screen. Reset synchronously (during render, not in an effect) the
 * instant a new `runResult` arrives, so an old reveal count can never flash against
 * a new result's rows before the timers below have a chance to restart it at 0.
 */
function useRevealedCount(runState: RunState, runResult: RunResponse | null): number {
  const [state, setState] = useState<{ result: RunResponse | null; count: number }>({ result: null, count: 0 });

  if (runResult !== state.result) {
    setState({ result: runResult, count: 0 });
  }

  useEffect(() => {
    const results = runResult?.results;
    if (runState !== "done" || !results || results.length === 0) return;

    const timers = results.map((_, idx) =>
      setTimeout(
        () => setState((s) => (s.result === runResult ? { result: runResult, count: Math.max(s.count, idx + 1) } : s)),
        (idx + 1) * REVEAL_STAGGER_MS
      )
    );

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runResult, runState]);

  return runResult === state.result ? state.count : 0;
}

function ResultTab({
  runState,
  runResult,
  errorMessage,
  lastAction,
  statusNote,
}: {
  runState: RunState;
  runResult: RunResponse | null;
  errorMessage: string | null;
  lastAction: LastAction;
  statusNote?: string | null;
}) {
  const revealedCount = useRevealedCount(runState, runResult);

  if (runState === "idle") {
    return (
      <div className="p-4 h-full flex items-center justify-center text-center">
        <div className="text-xs text-text-muted flex flex-col items-center gap-2">
          <Terminal className="w-5 h-5 text-text-muted/60" />
          <span>Run your code to see program output here.</span>
        </div>
      </div>
    );
  }

  if (runState === "running") {
    return (
      <div className="p-4 h-full flex items-center justify-center text-center">
        <div className="text-xs text-text-secondary flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-accent-primary" />
          <span>{lastAction === "submit" ? "Judging your submission..." : "Running your code..."}</span>
          {statusNote && <span className="text-2xs text-text-muted">{statusNote}</span>}
        </div>
      </div>
    );
  }

  if (runState === "error") {
    return (
      <div className="p-4 h-full flex items-center justify-center text-center">
        <div className="text-xs text-status-danger flex flex-col items-center gap-2 max-w-xs">
          <TriangleAlert className="w-5 h-5" />
          <span>{errorMessage ?? "Something went wrong running your code."}</span>
        </div>
      </div>
    );
  }

  if (!runResult) return null;

  if (runResult.compile_error) {
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-status-danger">
          <XCircle className="w-4 h-4" />
          Compilation Error
        </div>
        <pre className="text-2xs font-mono text-status-danger bg-status-danger/5 border border-status-danger/20 rounded-control p-3 overflow-x-auto whitespace-pre-wrap">
          {runResult.compile_error}
        </pre>
      </div>
    );
  }

  if (runResult.runtime_error) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-status-danger">
          <XCircle className="w-4 h-4" />
          {runResult.status ?? "Runtime Error"}
        </div>
        <pre className="text-2xs font-mono text-status-danger bg-status-danger/5 border border-status-danger/20 rounded-control p-3 overflow-x-auto whitespace-pre-wrap">
          {runResult.runtime_error}
        </pre>
        {runResult.results && runResult.results.length > 0 && (
          <ResultCaseList results={runResult.results} revealedCount={revealedCount} />
        )}
      </div>
    );
  }

  const allRevealed = revealedCount >= runResult.results.length;

  return (
    <div className="p-4 space-y-3">
      {allRevealed && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-control text-xs font-bold",
            runResult.all_passed
              ? "bg-status-success/10 text-status-success border border-status-success/25"
              : "bg-status-danger/10 text-status-danger border border-status-danger/25"
          )}
        >
          {runResult.all_passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{runResult.all_passed ? "Accepted" : "Wrong Answer"}</span>
          {runResult.time && (
            <span className="ml-auto text-3xs font-mono font-normal opacity-80">{runResult.time}s</span>
          )}
          {runResult.memory != null && (
            <span className="text-3xs font-mono font-normal opacity-80">{Math.round(runResult.memory / 1024)}MB</span>
          )}
        </div>
      )}

      <ResultCaseList results={runResult.results} revealedCount={revealedCount} />
    </div>
  );
}

function ResultCaseList({ results, revealedCount }: { results: RunResultCase[]; revealedCount: number }) {
  return (
    <div className="space-y-2">
      {results.map((r, idx) => (
        <ResultCaseRow key={r.case} result={r} running={idx >= revealedCount} />
      ))}
    </div>
  );
}

function ResultCaseRow({ result: r, running }: { result: RunResultCase; running: boolean }) {
  if (running) {
    return (
      <div className="rounded-control border border-border-subtle bg-elevated/40 p-3">
        <div className="flex items-center gap-1.5 text-2xs font-bold text-text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Case {r.case} — running…</span>
        </div>
      </div>
    );
  }

  if (r.not_run) {
    return (
      <div className="rounded-control border border-dashed border-border-subtle bg-elevated/20 p-3">
        <div className="flex items-center gap-1.5 text-2xs font-bold text-text-muted">
          <MinusCircle className="w-3.5 h-3.5" />
          <span>Case {r.case} — not evaluated</span>
        </div>
      </div>
    );
  }

  if (r.hidden) {
    return (
      <div
        className={cn(
          "rounded-control border p-3",
          r.passed ? "border-border-subtle bg-elevated/40" : "border-status-danger/30 bg-status-danger/5"
        )}
      >
        <div className="flex items-center gap-1.5 text-2xs font-bold">
          <Lock className="w-3.5 h-3.5 text-text-muted" />
          {r.passed ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-status-danger" />
          )}
          <span className={r.passed ? "text-status-success" : "text-status-danger"}>
            Hidden Test Case {r.case} — {r.passed ? "Passed" : "Failed"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-control border p-3 space-y-1.5",
        r.passed ? "border-border-subtle bg-elevated/40" : "border-status-danger/30 bg-status-danger/5"
      )}
    >
      <div className="flex items-center gap-1.5 text-2xs font-bold">
        {r.passed ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-status-danger" />
        )}
        <span className={r.passed ? "text-status-success" : "text-status-danger"}>Case {r.case}</span>
      </div>
      <div className="font-mono text-2xs text-text-secondary space-y-1">
        <div>
          <span className="text-text-muted">Input: </span>
          {r.input}
        </div>
        <div>
          <span className="text-text-muted">Expected: </span>
          {r.expected}
        </div>
        <div>
          <span className="text-text-muted">Output: </span>
          <span className={!r.passed ? "text-status-danger font-semibold" : undefined}>{r.actual || "(no output)"}</span>
        </div>
      </div>
    </div>
  );
}
