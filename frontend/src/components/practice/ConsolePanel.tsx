"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Terminal, TriangleAlert } from "lucide-react";
import { ProblemExample, RunResponse } from "@/types/problem";
import { cn } from "@/lib/utils";
import { JudgingView, type RunProgress } from "./JudgingView";
import { VerdictView, describeVerdict } from "./VerdictView";

export type { RunProgress } from "./JudgingView";

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
  /** Where a run in flight is (sending / queued / running) and how many cases it will judge. */
  progress?: RunProgress | null;
  /** Date.now() when the run in flight was started — drives the live timer. */
  startedAt?: number;
  /** Changes with every finished run, so each verdict plays its reveal once (and tab-switching never replays it). */
  resultKey?: number;
  /** How many cases a Run and a Submit judge — drawn while the judge works, before the server says. */
  caseCounts?: { samples: number; total: number } | null;
  /** After a Run passes every sample case: submit it for real. */
  onSubmit?: () => void;
  /** After a failure to reach the judge: try the same action again. */
  onRetry?: () => void;
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
  progress,
  startedAt,
  resultKey = 0,
  caseCounts,
  onSubmit,
  onRetry,
}: ConsolePanelProps) {
  // A small, always-visible cue on the Result tab, so the outcome is clear even while looking at the Testcase tab —
  // but only once the verdict has actually been revealed, never ahead of it.
  const [settledKey, setSettledKey] = useState<number | null>(null);
  const verdictTone = runState === "done" && runResult && settledKey === resultKey ? describeVerdict(runResult, lastAction).tone : null;

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-1 border-b border-border-subtle px-3 pt-2.5" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "testcase"}
          onClick={() => onTabChange("testcase")}
          className={cn(
            "rounded-t-control px-3 py-1.5 text-2xs font-bold transition-colors",
            activeTab === "testcase" ? "bg-elevated text-primary" : "text-text-muted hover:text-primary"
          )}
        >
          Testcase
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "result"}
          onClick={() => onTabChange("result")}
          className={cn(
            "flex items-center gap-1.5 rounded-t-control px-3 py-1.5 text-2xs font-bold transition-colors",
            activeTab === "result" ? "bg-elevated text-primary" : "text-text-muted hover:text-primary"
          )}
        >
          Result
          {runState === "running" && <Loader2 className="h-3 w-3 animate-spin text-accent-primary" aria-label="Running" />}
          {verdictTone && (
            <span
              data-testid="result-tab-dot"
              aria-hidden
              className={cn("h-1.5 w-1.5 rounded-full", verdictTone === "success" ? "bg-status-success" : verdictTone === "warning" ? "bg-status-warning" : "bg-status-danger")}
            />
          )}
          {runState === "error" && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-status-danger" />}
        </button>
      </div>

      {/* Both panes stay mounted (just hidden): flipping to Testcase and back must not replay a verdict. */}
      <div className="min-h-0 flex-1">
        <div className={cn("h-full overflow-y-auto", activeTab !== "testcase" && "hidden")}>
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {examples.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectExample(idx)}
                  className={cn(
                    "rounded-control border px-2.5 py-1 text-2xs font-bold transition-colors",
                    activeExample === idx
                      ? "border-accent-primary/30 bg-accent-primary/10 text-accent-primary"
                      : "border-border-subtle text-text-muted hover:text-primary"
                  )}
                >
                  Case {idx + 1}
                </button>
              ))}
            </div>
            <div className="space-y-2 font-mono text-xs text-text-secondary">
              <div>
                <div className="mb-1 text-3xs uppercase tracking-wide text-text-muted">Input</div>
                <div className="rounded-control border border-border-subtle bg-elevated/60 px-3 py-2">{examples[activeExample]?.input}</div>
              </div>
              <div>
                <div className="mb-1 text-3xs uppercase tracking-wide text-text-muted">Expected Output</div>
                <div className="rounded-control border border-border-subtle bg-elevated/60 px-3 py-2">{examples[activeExample]?.output}</div>
              </div>
            </div>
          </div>
        </div>

        <div className={cn("h-full overflow-y-auto", activeTab !== "result" && "hidden")}>
          <ResultTab
            runState={runState}
            runResult={runResult}
            errorMessage={errorMessage}
            lastAction={lastAction}
            progress={progress ?? { phase: "sending" }}
            startedAt={startedAt ?? 0}
            resultKey={resultKey}
            fallbackCases={lastAction === "submit" ? (caseCounts?.total ?? 0) : (caseCounts?.samples ?? examples.length)}
            onSubmit={onSubmit}
            onRetry={onRetry}
            onSettled={() => setSettledKey(resultKey)}
          />
        </div>
      </div>
    </div>
  );
}

function ResultTab({
  runState,
  runResult,
  errorMessage,
  lastAction,
  progress,
  startedAt,
  resultKey,
  fallbackCases,
  onSubmit,
  onRetry,
  onSettled,
}: {
  runState: RunState;
  runResult: RunResponse | null;
  errorMessage: string | null;
  lastAction: LastAction;
  progress: RunProgress;
  startedAt: number;
  resultKey: number;
  fallbackCases: number;
  onSubmit?: () => void;
  onRetry?: () => void;
  onSettled: () => void;
}) {
  if (runState === "idle") {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div className="flex flex-col items-center gap-2 text-xs text-text-muted">
          <Terminal className="h-5 w-5 text-text-muted/60" />
          <span>Run your code to see program output here.</span>
        </div>
      </div>
    );
  }

  if (runState === "running") {
    return <JudgingView action={lastAction === "submit" ? "submit" : "run"} progress={progress} startedAt={startedAt} fallbackCases={fallbackCases} />;
  }

  if (runState === "error") {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div role="alert" className="flex max-w-xs flex-col items-center gap-2.5 text-xs text-status-danger">
          <TriangleAlert className="h-5 w-5" />
          <span>{errorMessage ?? "Something went wrong running your code."}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover"
            >
              <RefreshCw className="h-3 w-3" aria-hidden /> Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!runResult) return null;

  return <VerdictView key={resultKey} result={runResult} action={lastAction} onSubmit={onSubmit} onSettled={onSettled} />;
}
