"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Lock, MinusCircle, Send, TimerOff, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { RunResponse, RunResultCase } from "@/types/problem";
import { cn } from "@/lib/utils";

export type VerdictKind = "accepted" | "samples_passed" | "wrong_answer" | "compile_error" | "time_limit" | "runtime_error";
export type VerdictTone = "success" | "danger" | "warning";

export interface Verdict {
  kind: VerdictKind;
  tone: VerdictTone;
  /** The headline: "Accepted", "Wrong Answer", "Compilation Error", "Time Limit Exceeded", … */
  label: string;
  /** One plain sentence under it. */
  summary: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Turns the judge's answer into what the student reads. A Submit that passes everything is
 * "Accepted"; a Run that does is only "Sample cases passed" — it never saw the hidden cases, so it
 * must not claim the judge's final word.
 */
export function describeVerdict(result: RunResponse, action: "run" | "submit" | null): Verdict {
  const cases = result.results ?? [];
  const total = cases.length;
  const passed = cases.filter((c) => c.passed).length;

  if (result.compile_error) {
    return { kind: "compile_error", tone: "danger", label: "Compilation Error", summary: "Your code didn't compile. Fix the error below and try again." };
  }

  if (result.runtime_error) {
    const status = result.status ?? "Runtime Error";

    if (/time limit/i.test(status)) {
      return { kind: "time_limit", tone: "warning", label: status, summary: "Your code was too slow — it didn't finish within the time limit." };
    }
    if (/output limit/i.test(status)) {
      return { kind: "runtime_error", tone: "warning", label: status, summary: "Your program printed far more output than expected." };
    }
    if (/terminated/i.test(status)) {
      return { kind: "runtime_error", tone: "danger", label: status, summary: "Your program was stopped before it finished — usually too much memory or a crash." };
    }

    return { kind: "runtime_error", tone: "danger", label: status, summary: "Your program crashed before it finished." };
  }

  if (result.all_passed) {
    return action === "run"
      ? { kind: "samples_passed", tone: "success", label: "Sample cases passed", summary: `All ${plural(total, "sample case")} passed — submit to check the hidden ones.` }
      : { kind: "accepted", tone: "success", label: "Accepted", summary: `All ${plural(total, "test case")} passed.` };
  }

  const failing = cases.find((c) => !c.passed && !c.not_run);
  const where = failing ? ` — failed on ${failing.hidden ? "hidden " : ""}case ${failing.case}` : "";

  return { kind: "wrong_answer", tone: "danger", label: "Wrong Answer", summary: `${passed} of ${plural(total, "test case")} passed${where}.` };
}

const TONE: Record<VerdictTone, string> = {
  success: "border-status-success/30 bg-status-success/10 text-status-success",
  danger: "border-status-danger/30 bg-status-danger/10 text-status-danger",
  warning: "border-status-warning/30 bg-status-warning/10 text-status-warning",
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The reveal: chips settle on their real verdicts one after another, fast enough that even a
 * 100-case submission is over in about a second, and only then does the verdict banner arrive.
 * `revealed` is how many chips have settled; `settled` is true once the banner may show.
 */
function useReveal(count: number): { revealed: number; settled: boolean } {
  const [state, setState] = useState(() => {
    const instant = count === 0 || prefersReducedMotion();
    return { revealed: instant ? count : 0, settled: instant };
  });

  useEffect(() => {
    if (state.settled) return;

    const stagger = Math.min(140, Math.max(8, Math.round(1100 / count)));
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < count; i++) {
      timers.push(setTimeout(() => setState((s) => ({ ...s, revealed: Math.max(s.revealed, i + 1) })), (i + 1) * stagger));
    }
    timers.push(setTimeout(() => setState((s) => ({ ...s, settled: true })), count * stagger + 160));

    return () => timers.forEach(clearTimeout);
    // The effect runs once per mounted result (the parent re-mounts this view for each new one).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}

function formatMemory(kb: number | null | undefined): string | null {
  if (kb == null) return null;
  const mb = Math.round(kb / 1024);
  return mb > 0 ? `${mb} MB` : "< 1 MB";
}

interface VerdictViewProps {
  result: RunResponse;
  action: "run" | "submit" | null;
  /** Offered after a Run passes every sample case: go straight to the real judge. */
  onSubmit?: () => void;
  /** Fired once the cases have been revealed and the verdict is on screen. */
  onSettled?: () => void;
}

export function VerdictView({ result, action, onSubmit, onSettled }: VerdictViewProps) {
  const verdict = describeVerdict(result, action);
  const errorText = result.compile_error ?? result.runtime_error ?? null;
  // A program that crashed before any case ran has nothing to show per case: a row of "not evaluated" chips
  // under the error would only be noise. (A crash after some cases passed still shows how far it got.)
  const allCases = result.results ?? [];
  const cases = errorText && allCases.every((c) => c.not_run) ? [] : allCases;
  const { revealed, settled } = useReveal(cases.length);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (settled) onSettled?.();
    // Once per result: the parent re-mounts this view for each new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  const firstFailure = cases.findIndex((c) => !c.passed && !c.not_run);
  const selected = cases.length === 0 ? -1 : (picked ?? (firstFailure >= 0 ? firstFailure : 0));
  const memory = formatMemory(result.memory);
  const hasHidden = cases.some((c) => c.hidden);

  return (
    <div className="space-y-3 p-4">
      {/* Checking… → the verdict */}
      {settled ? (
        <div
          role="status"
          data-testid="verdict-banner"
          data-verdict={verdict.kind}
          className={cn("verdict-in flex items-center gap-3 rounded-control border px-3.5 py-3", TONE[verdict.tone], verdict.kind === "accepted" && "verdict-ring")}
        >
          <VerdictIcon verdict={verdict} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-tight">{verdict.label}</p>
            <p className="mt-0.5 text-2xs leading-snug opacity-90">{verdict.summary}</p>
          </div>
          {(result.time || memory) && (
            <div className="hidden shrink-0 gap-1.5 font-mono text-3xs sm:flex">
              {result.time ? <span className="rounded-full bg-black/10 px-2 py-0.5 dark:bg-white/10">{result.time}s</span> : null}
              {memory ? <span className="rounded-full bg-black/10 px-2 py-0.5 dark:bg-white/10">{memory}</span> : null}
            </div>
          )}
        </div>
      ) : (
        <div role="status" className="flex items-center gap-2 rounded-control border border-border-subtle bg-elevated/50 px-3.5 py-3 text-xs font-semibold text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin text-accent-primary" aria-hidden />
          Checking test cases… {revealed}/{cases.length}
        </div>
      )}

      {/* Compiler / runtime message */}
      {settled && errorText && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-control border border-status-danger/20 bg-status-danger/5 p-3 font-mono text-2xs text-status-danger">{errorText}</pre>
      )}

      {/* One chip per test case */}
      {cases.length > 0 && (
        <div>
          <div role="group" aria-label="Test cases" className="flex flex-wrap gap-1.5">
            {cases.map((c, index) => (
              <CaseChip key={c.case} result={c} settled={index < revealed} selected={index === selected && settled} onSelect={() => setPicked(index)} />
            ))}
          </div>
          {settled && hasHidden && (
            <p className="mt-2 flex items-center gap-1 text-3xs text-text-muted">
              <Lock className="h-3 w-3" aria-hidden /> Hidden cases show only whether they passed.
            </p>
          )}
        </div>
      )}

      {settled && selected >= 0 && <CaseDetail result={cases[selected]} />}

      {settled && action === "run" && result.all_passed && onSubmit && (
        <Button variant="primary" size="sm" leftIcon={<Send className="h-3.5 w-3.5" />} onClick={onSubmit}>
          Submit solution
        </Button>
      )}
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  if (verdict.tone === "success") {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle className="draw-circle" cx="12" cy="12" r="10" />
        <path className="draw-check" d="M7.5 12.5l3 3 6-6.5" />
      </svg>
    );
  }

  const Icon = verdict.kind === "time_limit" ? TimerOff : verdict.tone === "warning" ? AlertTriangle : XCircle;
  return <Icon className="chip-pop h-6 w-6 shrink-0" aria-hidden />;
}

function CaseChip({ result: c, settled, selected, onSelect }: { result: RunResultCase; settled: boolean; selected: boolean; onSelect: () => void }) {
  if (!settled) {
    return (
      <span
        data-testid="case-chip"
        data-state="pending"
        aria-label={`Case ${c.case} — checking`}
        className="flex h-7 min-w-9 animate-pulse items-center justify-center rounded-control border border-border-strong bg-elevated px-1.5 font-mono text-2xs font-bold text-text-muted"
      >
        {c.case}
      </span>
    );
  }

  const state = c.not_run ? "not_run" : c.passed ? "passed" : "failed";
  const label = `Case ${c.case}${c.hidden ? " (hidden)" : ""} — ${state === "not_run" ? "not evaluated" : state}`;

  return (
    <button
      type="button"
      data-testid="case-chip"
      data-state={state}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onSelect}
      className={cn(
        "chip-pop relative flex h-7 min-w-9 items-center justify-center gap-0.5 rounded-control border px-1.5 font-mono text-2xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
        state === "passed" && "border-status-success/40 bg-status-success/10 text-status-success hover:bg-status-success/20",
        state === "failed" && "border-status-danger/40 bg-status-danger/10 text-status-danger hover:bg-status-danger/20",
        state === "not_run" && "border-dashed border-border-strong bg-transparent text-text-muted hover:text-primary",
        selected && "ring-2 ring-accent-primary/60"
      )}
    >
      {state === "passed" ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : state === "failed" ? <X className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
      {c.case}
      {c.hidden && <Lock className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-surface p-px text-text-muted" aria-hidden />}
    </button>
  );
}

function Field({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-3xs font-bold uppercase tracking-wide text-text-muted">{label}</div>
      <pre
        className={cn(
          "max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-control border px-3 py-2 font-mono text-2xs",
          bad ? "border-status-danger/30 bg-status-danger/5 font-semibold text-status-danger" : "border-border-subtle bg-elevated/60 text-text-secondary"
        )}
      >
        {value}
      </pre>
    </div>
  );
}

function CaseDetail({ result: c }: { result: RunResultCase }) {
  if (c.not_run) {
    return (
      <div className="verdict-in flex items-start gap-2 rounded-control border border-dashed border-border-strong p-3 text-2xs text-text-muted">
        <MinusCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Case {c.case} wasn&apos;t evaluated — an earlier case failed or the program stopped before reaching it.</span>
      </div>
    );
  }

  if (c.hidden) {
    return (
      <div className="verdict-in flex items-start gap-2 rounded-control border border-border-subtle bg-elevated/40 p-3 text-2xs text-text-secondary">
        <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
        <span>
          Hidden test case {c.case} — <strong className={c.passed ? "text-status-success" : "text-status-danger"}>{c.passed ? "passed" : "failed"}</strong>. Hidden cases never show their input or expected output.
        </span>
      </div>
    );
  }

  return (
    <div className="verdict-in space-y-2" data-testid="case-detail">
      <div className={cn("flex items-center gap-1.5 text-2xs font-bold", c.passed ? "text-status-success" : "text-status-danger")}>
        {c.passed ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
        Case {c.case} — {c.passed ? "passed" : "failed"}
      </div>
      <Field label="Input" value={c.input ?? ""} />
      <Field label="Expected" value={c.expected ?? ""} />
      <Field label="Your output" value={c.actual || "(no output)"} bad={!c.passed} />
    </div>
  );
}
