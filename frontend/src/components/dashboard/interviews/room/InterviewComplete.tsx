"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Loader2, Mail, RefreshCw, RotateCcw, Sparkles, ThumbsDown, ThumbsUp, UserCheck } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { ScoreRing } from "@/components/dashboard/vaultAi/vaultKit";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { cn } from "@/lib/utils";
import type { InterviewResult } from "@/types/interview";
import { AptRunOrb } from "./AptRunOrb";
import { RoomBackdrop } from "./RoomBackdrop";
import { formatClock } from "./format";
import { useRoomSignal } from "./roomSignal";

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent-primary/30 transition-colors hover:bg-accent-primary-hover disabled:pointer-events-none disabled:opacity-50";
const SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full border border-border-strong bg-surface/90 px-6 py-3 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-surface-hover";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-black tabular-nums text-primary">{value}</div>
      <div className="mt-0.5 text-3xs font-semibold uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}

/** Same backdrop, same wordmark, same orb as the rest of the interview — the page everything ends on. */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-primary">
      <RoomBackdrop />
      <header className="relative z-10 px-5 pt-4 sm:px-8 sm:pt-5">
        <Wordmark className="text-xl sm:text-2xl" />
      </header>
      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/**
 * The interview could not start. On the room's own backdrop, with a way out — the dashboard that used to be around this screen is no longer.
 */
export function InterviewError({ message, retrying, onRetry, onBack, backLabel }: { message: string | null; retrying: boolean; onRetry: () => void; onBack: () => void; backLabel: string }) {
  return (
    <Stage>
      <div data-testid="interview-error" className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 px-5 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-status-danger/25 bg-status-danger/10">
          <AlertTriangle className="h-7 w-7 text-status-danger" aria-hidden />
        </div>
        <h2 className="text-lg font-extrabold tracking-tight text-primary">Couldn&apos;t start this interview</h2>
        <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{message}</p>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-3">
          <button onClick={onRetry} disabled={retrying} className={PRIMARY}>
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4" aria-hidden />}
            Try Again
          </button>
          <button onClick={onBack} className={SECONDARY}>
            {backLabel}
          </button>
        </div>
      </div>
    </Stage>
  );
}

/**
 * The end of an interview: the orb keeps thinking while the answers are scored, then the score draws itself in, with the feedback for every
 * question beneath it. Nothing is decided here — the result, the re-attempt rules and the copy are the same ones the card this replaces had.
 */
export function InterviewComplete({
  vault,
  result,
  totalQuestions,
  answeredCount,
  elapsedSeconds,
  reattempting,
  onReattempt,
  onBack,
}: {
  vault: boolean;
  result: InterviewResult | null;
  totalQuestions: number;
  answeredCount: number;
  elapsedSeconds: number | null;
  reattempting: boolean;
  onReattempt: () => void;
  onBack: () => void;
}) {
  const signal = useRoomSignal();
  const reduce = useReducedMotion() ?? false;
  const scoring = !result || result.status === "scoring";
  const done = result?.status === "scored" ? result : null;
  const percent = Math.round(done?.composite_score_percent ?? 0);
  const belowBar = done !== null && !vault && percent < 60 && done.reattemptable !== false;
  const canReattempt = belowBar || (result?.status === "needs_human_review" && result.reattemptable === true);

  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay } });

  return (
    <Stage>
      <div data-testid="interview-complete" className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-5 py-6 text-center sm:gap-8 sm:py-10">
        <motion.div {...rise(0)} className="flex flex-col items-center gap-5">
          <AptRunOrb mode={scoring ? "thinking" : "idle"} signal={signal} className="w-[clamp(96px,19vh,176px)]" />
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{vault ? "Set complete" : "Interview complete"}</h2>
            {scoring ? (
              <p className="mx-auto mt-2 flex max-w-sm items-center justify-center gap-2 text-sm text-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Scoring your interview with AI...
              </p>
            ) : result?.status === "needs_human_review" ? (
              <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">Your answers have been saved. A real person will review your responses.</p>
            ) : (
              <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">Here&apos;s how you did — a human reviewer can still adjust this afterward.</p>
            )}
          </div>
        </motion.div>

        {totalQuestions > 0 && (
          <motion.div {...rise(0.08)} className="flex items-center justify-center gap-10 border-y border-border-subtle px-10 py-4">
            <Stat value={String(Math.max(answeredCount, totalQuestions))} label="Questions answered" />
            {elapsedSeconds !== null && <Stat value={formatClock(elapsedSeconds)} label="Time taken" />}
          </motion.div>
        )}

        {done ? (
          <div className="w-full space-y-7 text-left">
            <motion.div {...rise(0.16)} className="flex items-center gap-6">
              <ScoreRing value={percent} size={112} stroke={9} tone={done.passed === false || (!vault && percent < 60) ? "amber" : "emerald"} label={vault ? "Your score for this set" : "AI-scored result"}>
                <span className="text-2xl font-black tabular-nums text-primary">
                  <AnimatedCounter target={percent} suffix="%" />
                </span>
              </ScoreRing>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
                  <Sparkles className="h-4 w-4 text-accent-primary" aria-hidden />
                  {vault ? "Your score for this set" : "AI-Scored Result"}
                </div>
                {!vault && done.passed !== null && (
                  <div className={cn("mt-1 flex items-center gap-1.5 text-xs font-semibold", done.passed ? "text-status-success" : "text-status-danger")}>
                    {done.passed ? <ThumbsUp className="h-3.5 w-3.5" aria-hidden /> : <ThumbsDown className="h-3.5 w-3.5" aria-hidden />}
                    {done.passed ? "You passed this round" : "Didn't clear this round's threshold"}
                  </div>
                )}
              </div>
            </motion.div>

            {vault && (
              <motion.p {...rise(0.22)} className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.07] p-4 text-xs leading-relaxed text-text-secondary">
                This set counts toward your Mellow Vault series and is scored once.{" "}
                <strong className="font-semibold text-primary">Your average across all three sets decides whether you qualify</strong> (60% or higher), so one lower set can still be made up by the others.
              </motion.p>
            )}

            {belowBar && (
              <motion.div {...rise(0.22)} className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-500">
                  <RotateCcw className="h-4 w-4" aria-hidden />
                </span>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400">Score below 60% — Re-attempt Recommended</h4>
                  <p className="text-2xs leading-relaxed text-text-secondary">
                    You scored <strong className="font-bold text-primary">{percent}%</strong>, which is below the 60% technical readiness benchmark required by top engineering firms and campus placements. Review the AI critiques below to identify your weak spots, then re-attempt this interview to improve your score!
                  </p>
                </div>
              </motion.div>
            )}

            {done.responses.length > 0 && (
              <section aria-labelledby="feedback-title">
                <p id="feedback-title" className="mb-1 text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">
                  Per-question feedback
                </p>
                <ul className="divide-y divide-border-subtle">
                  {done.responses.map((r, i) => (
                    <motion.li key={r.response_id ?? i} {...rise(0.3 + i * 0.07)} className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-sm font-semibold leading-snug text-primary">{r.question_text}</span>
                        <span className="shrink-0 rounded-full bg-accent-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-accent-primary">{r.score}/100</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{r.feedback}</p>
                    </motion.li>
                  ))}
                </ul>
              </section>
            )}

            <p className="text-center text-3xs text-text-muted">Scored by AI — a human reviewer can still adjust this.</p>
          </div>
        ) : (
          <motion.div {...rise(0.16)} className="w-full max-w-xs space-y-3 text-left">
            <p className="text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">What happens next</p>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-accent-primary/25 bg-accent-primary/10">
                <UserCheck className="h-3.5 w-3.5 text-accent-primary" aria-hidden />
              </span>
              <p className="text-xs leading-relaxed text-text-secondary">
                {result?.status === "needs_human_review" ? "A reviewer reads your transcripts and listens to your recordings." : "Your interview is being scored by AI right now."}
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-elevated">
                <Mail className="h-3.5 w-3.5 text-text-muted" aria-hidden />
              </span>
              <p className="text-xs leading-relaxed text-text-secondary">You&apos;ll hear back through the platform once it&apos;s ready.</p>
            </div>
          </motion.div>
        )}

        <motion.div {...rise(0.2)} className="flex flex-wrap items-center justify-center gap-3 pb-6 pt-2">
          {canReattempt && (
            <button onClick={onReattempt} disabled={reattempting} className={PRIMARY}>
              {reattempting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>Starting fresh attempt...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  <span>{vault ? "Sit this set again" : "Re-attempt Interview"}</span>
                </>
              )}
            </button>
          )}
          <button onClick={onBack} className={vault && !canReattempt ? PRIMARY : SECONDARY}>
            {vault ? "Back to Qualification Circuit" : "Back to Interviews"}
          </button>
        </motion.div>
      </div>
    </Stage>
  );
}
