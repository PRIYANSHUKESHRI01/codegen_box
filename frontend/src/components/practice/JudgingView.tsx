"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Where a Run/Submit is: the browser is sending it, it is waiting for a free judge, or the judge is running it. */
export type RunPhase = "sending" | "queued" | "running";

export interface RunProgress {
  phase: RunPhase;
  /** Approximate place in line while queued (1 = next up). */
  position?: number;
  /** How many test cases are being judged, once the server has said. */
  totalCases?: number | null;
}

/** More chips than this stop being a picture of the cases and start being noise. */
const MAX_CHIPS = 40;

const PHASE_ORDER: Record<RunPhase, number> = { sending: 0, queued: 1, running: 2 };

/** How long a request may be out before the judge is presumed to be running it (see JudgingView). */
const SYNC_JUDGE_AFTER_MS = 500;

/** Seconds since `startedAt`, redrawn ten times a second — the "something is genuinely running" tell. */
function useElapsed(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  return Math.max(0, now - startedAt);
}

interface JudgingViewProps {
  action: "run" | "submit";
  progress: RunProgress;
  /** Date.now() when the student pressed the button. */
  startedAt: number;
  /** How many cases to draw before the server has said (0 = unknown). The caller picks the number for the action. */
  fallbackCases: number;
}

/**
 * What the result area shows while the judge is working: the stages the request really moves
 * through (sent → waiting for a judge → running the test cases → verdict), a live timer, and one
 * chip per test case lighting up in turn so it is plain that the cases are being checked.
 *
 * The stages follow the server's real state (queued / running) — nothing here is invented progress.
 * The sweep across the chips is the picture of the judge working through them; the verdict view
 * takes over with the real per-case results.
 */
export function JudgingView({ action, progress, startedAt, fallbackCases }: JudgingViewProps) {
  const elapsedMs = useElapsed(startedAt);
  // Where the judge answers in the same request (a synchronous queue, as in local development) there is no
  // polling to say it is running: a request still out after half a second IS the judge working.
  const phase: RunPhase = progress.phase === "sending" && elapsedMs > SYNC_JUDGE_AFTER_MS ? "running" : progress.phase;
  const active = PHASE_ORDER[phase];
  const total = progress.totalCases ?? (fallbackCases > 0 ? fallbackCases : null);
  const queuedBehind = phase === "queued" && (progress.position ?? 0) > 1;

  const steps = [
    "Sent to the judge",
    queuedBehind ? `In queue — #${progress.position} in line` : "Waiting for a free judge",
    total ? `Running ${total} test case${total === 1 ? "" : "s"}` : "Running your code",
    action === "submit" ? "Verdict" : "Result",
  ];

  const title = action === "submit" ? "Judging your submission" : "Running your code";
  const subtitle =
    phase === "running"
      ? total
        ? `Compiling, then checking your output on ${total} test case${total === 1 ? "" : "s"}…`
        : "Compiling and running…"
      : phase === "queued"
        ? queuedBehind
          ? "Lots of code is being judged right now — you are next in line shortly."
          : "A judge is picking this up…"
        : "Sending your code…";

  const chips = total ? Math.min(total, MAX_CHIPS) : 0;

  return (
    <div role="status" aria-live="polite" aria-label={`${title}. ${steps[Math.min(active, 2)]}.`} className="relative flex h-full flex-col">
      {/* indeterminate bar */}
      <div aria-hidden className="judge-bar absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-accent-primary/10" />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-tight text-primary">{title}</p>
            <p className="mt-0.5 text-2xs text-text-secondary">{subtitle}</p>
          </div>
          <span className="shrink-0 rounded-full border border-border-subtle bg-elevated px-2.5 py-1 font-mono text-2xs font-semibold tabular-nums text-text-secondary" aria-hidden>
            {(elapsedMs / 1000).toFixed(1)}s
          </span>
        </div>

        {/* The stages */}
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5 text-2xs font-semibold">
          {steps.map((label, index) => {
            const done = index < active;
            const current = index === active;
            return (
              <li key={label} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border text-[9px]",
                    done && "border-status-success/40 bg-status-success/15 text-status-success",
                    current && "border-accent-primary/50 bg-accent-primary/10 text-accent-primary",
                    !done && !current && "border-border-subtle text-text-muted"
                  )}
                  aria-hidden
                >
                  {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : current ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : index + 1}
                </span>
                <span className={cn(current ? "text-primary" : done ? "text-text-secondary" : "text-text-muted")}>{label}</span>
                {index < steps.length - 1 && <span aria-hidden className="mx-1 h-px w-3 bg-border-strong" />}
              </li>
            );
          })}
        </ol>

        {/* One chip per test case, lighting up in turn */}
        {chips > 0 && (
          <div>
            <div className="flex flex-wrap gap-1.5" aria-hidden data-testid="judging-chips">
              {Array.from({ length: chips }, (_, i) => (
                <span
                  key={i}
                  data-testid="judging-chip"
                  style={{ "--i": i, "--n": chips } as React.CSSProperties}
                  className={cn(
                    "flex h-7 min-w-7 items-center justify-center rounded-control border border-border-strong bg-elevated px-1.5 font-mono text-2xs font-bold text-text-muted",
                    active >= 2 && "judge-chip-scan border-accent-primary/40 text-accent-primary"
                  )}
                >
                  {i + 1}
                </span>
              ))}
              {total && total > MAX_CHIPS && <span className="self-center text-2xs text-text-muted">+{total - MAX_CHIPS} more</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
