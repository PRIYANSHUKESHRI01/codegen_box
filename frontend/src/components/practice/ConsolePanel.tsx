"use client";

import { CheckCircle2, Loader2, Terminal, TriangleAlert, XCircle } from "lucide-react";
import { ProblemExample, RunResponse } from "@/types/problem";
import { cn } from "@/lib/utils";

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
            "px-3 py-1.5 rounded-t-control text-[11px] font-bold transition-colors",
            activeTab === "testcase" ? "bg-elevated text-primary" : "text-text-muted hover:text-primary"
          )}
        >
          Testcase
        </button>
        <button
          onClick={() => onTabChange("result")}
          className={cn(
            "px-3 py-1.5 rounded-t-control text-[11px] font-bold transition-colors flex items-center gap-1.5",
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
                    "px-2.5 py-1 rounded-control text-[11px] font-bold transition-colors border",
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
                <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Input</div>
                <div className="rounded-control bg-elevated/60 border border-border-subtle px-3 py-2">
                  {examples[activeExample]?.input}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-text-muted mb-1">Expected Output</div>
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
          {statusNote && <span className="text-[11px] text-text-muted">{statusNote}</span>}
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
        <pre className="text-[11px] font-mono text-status-danger bg-status-danger/5 border border-status-danger/20 rounded-control p-3 overflow-x-auto whitespace-pre-wrap">
          {runResult.compile_error}
        </pre>
      </div>
    );
  }

  if (runResult.runtime_error) {
    return (
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-status-danger">
          <XCircle className="w-4 h-4" />
          {runResult.status ?? "Runtime Error"}
        </div>
        <pre className="text-[11px] font-mono text-status-danger bg-status-danger/5 border border-status-danger/20 rounded-control p-3 overflow-x-auto whitespace-pre-wrap">
          {runResult.runtime_error}
        </pre>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
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
          <span className="ml-auto text-[10px] font-mono font-normal opacity-80">{runResult.time}s</span>
        )}
        {runResult.memory != null && (
          <span className="text-[10px] font-mono font-normal opacity-80">{Math.round(runResult.memory / 1024)}MB</span>
        )}
      </div>

      <div className="space-y-2">
        {runResult.results.map((r) => (
          <div
            key={r.case}
            className={cn(
              "rounded-control border p-3 space-y-1.5",
              r.passed ? "border-border-subtle bg-elevated/40" : "border-status-danger/30 bg-status-danger/5"
            )}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              {r.passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-status-danger" />
              )}
              <span className={r.passed ? "text-status-success" : "text-status-danger"}>Case {r.case}</span>
            </div>
            <div className="font-mono text-[11px] text-text-secondary space-y-1">
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
                <span className={!r.passed ? "text-status-danger font-semibold" : undefined}>
                  {r.actual || "(no output)"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
