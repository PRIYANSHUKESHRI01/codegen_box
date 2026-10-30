"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Flag, Info, Minus, X } from "lucide-react";
import { MATCH_BAND, SEGMENT_STYLE } from "@/lib/studyMatch";
import { cn } from "@/lib/utils";
import type { StudyFeedback } from "@/types/interview";

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent-primary/30 transition-colors hover:bg-accent-primary-hover disabled:pointer-events-none disabled:opacity-50";

/**
 * The match as a LINE: a track with the fill in the band's colour, the two band edges marked on it (30% and 70%), and the number and the
 * words beside it - so colour is never the only thing that says how the answer did.
 */
export function MatchMeter({ percent, band, label, points, animate = true }: { percent: number; band: StudyFeedback["band"]; label: string; points: StudyFeedback["points"]; animate?: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const style = MATCH_BAND[band];

  return (
    <div data-testid="match-meter" data-band={band} className={cn("rounded-2xl border border-border-subtle p-4 sm:p-5", style.soft)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={cn("text-3xs font-extrabold uppercase tracking-[0.16em]", style.text)}>{label}</p>
        <p className={cn("text-3xl font-black tabular-nums leading-none", style.text)}>
          {percent}%
          <span className="ml-1.5 text-2xs font-semibold text-text-muted">match</span>
        </p>
      </div>

      <div
        role="meter"
        aria-label="How much of the model answer your answer covered"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent} percent: ${label}`}
        className="relative mt-3 h-3 overflow-hidden rounded-full bg-text-muted/20"
      >
        <motion.div
          className={cn("h-full origin-left rounded-full", style.fill)}
          initial={reduce || !animate ? false : { scaleX: 0 }}
          animate={{ scaleX: Math.max(percent, 2) / 100 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: "100%" }}
        />
        {/* where yellow and green begin */}
        {[30, 70].map((edge) => (
          <span key={edge} aria-hidden className="absolute inset-y-0 w-px bg-background/80" style={{ left: `${edge}%` }} />
        ))}
      </div>
      <div aria-hidden className="relative mt-1 h-3 text-[10px] font-semibold text-text-muted">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: "30%" }}>30</span>
        <span className="absolute -translate-x-1/2" style={{ left: "70%" }}>70</span>
        <span className="absolute right-0">100</span>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-semibold text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-status-success" aria-hidden />
          {points.covered} of {points.total} key {points.total === 1 ? "point" : "points"} covered
        </span>
        {points.partial > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 text-status-warning" aria-hidden />
            {points.partial} partly
          </span>
        )}
        {points.missed > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <X className="h-3.5 w-3.5 text-status-danger" aria-hidden />
            {points.missed} left out
          </span>
        )}
      </p>
    </div>
  );
}

/** The model answer written out as it is, with each key point marked by what the answer did with it. */
export function ModelAnswer({ segments }: { segments: StudyFeedback["segments"] }) {
  return (
    <p data-testid="model-answer" className="text-base leading-[1.85] text-text-secondary sm:text-lg sm:leading-[1.85]">
      {segments.map((segment, i) => {
        const style = SEGMENT_STYLE[segment.status];
        return (
          <span key={i} data-status={segment.status} className={style.className}>
            {segment.text}
            <span className="sr-only"> ({style.srLabel}) </span>
          </span>
        );
      })}
    </p>
  );
}

/**
 * Study mode's screen after an answer is submitted - in place of the transcript, where the student's eyes already are: the question, how
 * the answer matched the model answer (a coloured line and a number), what they said, and the model answer with exactly what they left
 * out marked. Then Next question. Nothing here is an AI's opinion: the match is plain text matching on the server, and the screen says
 * plainly what it can and cannot tell them.
 */
export function StudyFeedbackPanel({
  question,
  answer,
  feedback,
  index,
  total,
  onNext,
  nextLabel,
}: {
  question: string;
  answer: string;
  feedback: StudyFeedback;
  index: number;
  total: number;
  onNext: () => void;
  nextLabel: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const style = MATCH_BAND[feedback.band];
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay } });

  return (
    <section aria-label="Your feedback" data-testid="study-feedback" className="relative flex min-h-0 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-1 pb-8 pr-3 pt-10 [scrollbar-width:thin] lg:pt-14">
        <motion.p {...rise(0)} className="text-3xs font-bold uppercase tracking-[0.18em] text-text-muted">
          Question {index + 1} of {total}
        </motion.p>
        <motion.h2 {...rise(0.03)} className="mt-1.5 text-xl font-semibold leading-snug tracking-tight text-primary sm:text-2xl">
          {question}
        </motion.h2>

        <motion.div {...rise(0.08)} className="mt-5">
          <MatchMeter percent={feedback.match_percent} band={feedback.band} label={feedback.label} points={feedback.points} />
        </motion.div>

        <motion.div {...rise(0.14)} className="mt-6">
          <p className="mb-2 text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">What you said</p>
          <div data-testid="your-answer" className={cn("border-l-4 pl-4 sm:pl-5", style.border)}>
            <p className="text-base leading-relaxed text-primary sm:text-lg">{answer || <span className="italic text-text-muted">No answer was captured.</span>}</p>
          </div>
        </motion.div>

        <motion.div {...rise(0.2)} className="mt-6">
          <p className="mb-2 text-3xs font-bold uppercase tracking-[0.16em] text-text-muted">Model answer</p>
          <ModelAnswer segments={feedback.segments} />
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs font-semibold text-text-muted" aria-hidden>
            {(["covered", "partial", "missed"] as const).map((status) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span className={cn("inline-block h-2.5 w-5 rounded-sm", status === "covered" ? "bg-status-success" : status === "partial" ? "bg-status-warning" : "bg-status-danger")} />
                {SEGMENT_STYLE[status].legend}
              </span>
            ))}
          </p>
        </motion.div>

        {feedback.unverified && (
          <motion.div {...rise(0.24)} role="note" className="mt-5 flex items-start gap-2.5 rounded-xl border border-status-warning/30 bg-status-warning/10 p-3.5">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-status-warning" aria-hidden />
            <p className="text-xs leading-relaxed text-text-secondary">
              <strong className="font-bold text-primary">This model answer is still being checked.</strong> A figure in it, or the answer itself, has not been confirmed against the latest official text yet. Use it as a guide, and check it against the current SOLAS, MARPOL or Load Line texts before the exam.
            </p>
          </motion.div>
        )}

        <motion.p {...rise(0.28)} className="mt-5 flex items-start gap-2 text-2xs leading-relaxed text-text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            The match compares the key points of the model answer with the words you used. It is not marked by AI and it cannot tell whether what you said is correct, only how much of the model answer you covered, so always read it through.
          </span>
        </motion.p>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onNext} className={PRIMARY}>
            {nextLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
