"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, Flag, Minus, Trophy } from "lucide-react";
import { DownloadReportButton } from "@/components/dashboard/merchantNavy/DownloadReportButton";
import { ScoreTrend } from "@/components/dashboard/merchantNavy/ScoreTrend";
import { MATCH_BAND, bandOf } from "@/lib/studyMatch";
import { cn } from "@/lib/utils";
import type { InterviewResult, InterviewResultQuestion, MatchBand, StudyAttemptStanding } from "@/types/interview";
import { MatchMeter, ModelAnswer } from "./StudyFeedbackPanel";

type Order = "set" | "weakest";

/**
 * Where this sitting stands among the student's sittings of the set (the score history the server keeps), and the report to download. The
 * report is the thing to keep: every question with the model answer, and the picture of a ROR card, as a PDF.
 */
function HistoryCard({ attempt }: { attempt: StudyAttemptStanding }) {
  const { delta, previous_score: previous } = attempt;
  const trend =
    delta === null ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary">First sitting of this set: this is the score to beat.</span>
    ) : delta > 0 ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-status-success"><ArrowUpRight className="h-4 w-4" aria-hidden />Up {delta} {delta === 1 ? "point" : "points"} on last time ({previous}%)</span>
    ) : delta < 0 ? (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-status-danger"><ArrowDownRight className="h-4 w-4" aria-hidden />Down {Math.abs(delta)} {Math.abs(delta) === 1 ? "point" : "points"} on last time ({previous}%)</span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary"><Minus className="h-4 w-4" aria-hidden />Level with last time ({previous}%)</span>
    );

  return (
    <section data-testid="study-history" aria-labelledby="history-title" className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1.5">
          <p id="history-title" className="text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">
            Your history on this set
          </p>
          <p className="text-sm font-extrabold text-primary">
            Sitting {attempt.number}
            {attempt.attempts > attempt.number ? ` of ${attempt.attempts}` : ""}
            {attempt.is_personal_best && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 align-middle text-3xs font-extrabold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                <Trophy className="h-3 w-3" aria-hidden />
                New best
              </span>
            )}
          </p>
          <p data-testid="history-trend">{trend}</p>
          <p className="text-2xs text-text-muted">
            Best on this set <strong className="tabular-nums text-primary">{attempt.best_score}%</strong>
          </p>
        </div>
        <ScoreTrend points={attempt.history} highlightId={attempt.id} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <DownloadReportButton attemptId={attempt.id} />
        <Link href="/dashboard/merchant-navy/reports" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline">
          All my reports
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/**
 * The end of a study set: the average match, how many answers were strong, partial or weak, and every question again with the student's
 * own answer and the model answer beside it - the thing to go and revise from. Nothing here is an AI's opinion (see AnswerMatcher).
 */
export function StudySummary({ result }: { result: InterviewResult }) {
  const reduce = useReducedMotion() ?? false;
  const [order, setOrder] = useState<Order>("set");

  const items = useMemo(() => result.responses.map((r, i) => ({ r, i })).filter((x): x is { r: InterviewResultQuestion & { study: NonNullable<InterviewResultQuestion["study"]> }; i: number } => !!x.r.study), [result.responses]);
  const percent = Math.round(result.composite_score_percent ?? 0);
  const band = bandOf(percent);

  const bands = useMemo(() => {
    const count: Record<MatchBand, number> = { green: 0, yellow: 0, red: 0 };
    items.forEach(({ r }) => (count[r.study.band] += 1));
    return count;
  }, [items]);

  const points = useMemo(
    () => items.reduce((sum, { r }) => ({ covered: sum.covered + r.study.points.covered, partial: sum.partial + r.study.points.partial, missed: sum.missed + r.study.points.missed, total: sum.total + r.study.points.total }), { covered: 0, partial: 0, missed: 0, total: 0 }),
    [items]
  );

  const shown = useMemo(() => (order === "weakest" ? [...items].sort((a, b) => a.r.study.match_percent - b.r.study.match_percent || a.i - b.i) : items), [items, order]);
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as const, delay } });

  return (
    <div data-testid="study-summary" className="w-full space-y-6 text-left">
      <motion.div {...rise(0.1)}>
        <MatchMeter percent={percent} band={band} label={`Average match · ${MATCH_BAND[band].label}`} points={points} />
      </motion.div>

      {result.attempt && (
        <motion.div {...rise(0.14)}>
          <HistoryCard attempt={result.attempt} />
        </motion.div>
      )}

      <motion.ul {...rise(0.16)} className="grid grid-cols-3 gap-2.5 text-center" aria-label="Answers by match">
        {(["green", "yellow", "red"] as const).map((b) => (
          <li key={b} data-band={b} className={cn("rounded-2xl border border-border-subtle px-2 py-3", MATCH_BAND[b].soft)}>
            <div className={cn("text-2xl font-black tabular-nums", MATCH_BAND[b].text)}>{bands[b]}</div>
            <div className="mt-0.5 text-3xs font-bold uppercase tracking-wide text-text-muted">{b === "green" ? "Strong" : b === "yellow" ? "Getting there" : "Needs work"}</div>
          </li>
        ))}
      </motion.ul>

      <motion.section {...rise(0.22)} aria-labelledby="review-title">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <p id="review-title" className="text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">
            Review every question
          </p>
          <div role="group" aria-label="Order of the questions" className="inline-flex rounded-full border border-border-subtle bg-surface p-0.5 text-2xs font-bold shadow-subtle">
            {([["set", "In order"], ["weakest", "Weakest first"]] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={order === value} onClick={() => setOrder(value)} className={cn("rounded-full px-3 py-1 transition-colors", order === value ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="divide-y divide-border-subtle">
          {shown.map(({ r, i }) => {
            const style = MATCH_BAND[r.study.band];
            return (
              <li key={r.response_id ?? i} data-testid="review-item" data-band={r.study.band} className="py-3.5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 shrink-0 text-xs font-bold tabular-nums text-text-muted">{i + 1}.</span>
                      <span className="text-sm font-semibold leading-snug text-primary">{r.question_text}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums", style.soft, style.text)} title={style.label}>
                        {r.study.match_percent}%
                      </span>
                      <ChevronDown className="h-4 w-4 text-text-muted transition-transform group-open:rotate-180" aria-hidden />
                    </span>
                  </summary>

                  <div className="mt-3 space-y-4 pl-7">
                    {r.image && (
                      <div>
                        <p className="mb-1 text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">The card</p>
                        {/* eslint-disable-next-line @next/next/no-img-element -- a fixed 360x180 drawing served as-is from /public */}
                        <img src={r.image} alt="The card: a plan view of the two vessels on the left, and on the right what you saw from your own ship." width={360} height={180} data-testid="review-card" className="h-auto w-full max-w-sm rounded-xl border border-border-subtle" />
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">What you said</p>
                      <div className={cn("border-l-4 pl-3", style.border)}>
                        <p className="text-sm leading-relaxed text-primary">{r.transcript_text || <span className="italic text-text-muted">No answer was captured.</span>}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">Model answer</p>
                      <ModelAnswer segments={r.study.segments} />
                    </div>
                    {r.study.unverified && (
                      <p className="flex items-start gap-2 rounded-xl border border-status-warning/30 bg-status-warning/10 p-3 text-2xs leading-relaxed text-text-secondary">
                        <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden />
                        This model answer is still being checked; confirm any figure against the latest official text.
                      </p>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </motion.section>

      <p className="text-center text-3xs text-text-muted">Not scored by AI: each answer is matched with the model answer by plain text comparison. It shows what you covered, not whether it was right.</p>
    </div>
  );
}
