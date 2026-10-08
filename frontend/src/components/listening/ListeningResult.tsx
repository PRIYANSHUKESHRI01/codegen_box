"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ChevronRight, Lock, Medal, RotateCcw, Trophy, Volume2, XCircle } from "lucide-react";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { cn } from "@/lib/utils";
import { SkillBars } from "./SkillBars";
import { TranscriptReview } from "./TranscriptReview";
import type { ListeningPlayerApi } from "./AudioPlayer";
import { DifficultyBadge, FormatChip } from "./listeningUi";
import {
  LISTENING_PASS_THRESHOLD,
  LISTENING_SKILL_LABELS,
  type ListeningDictationResult,
  type ListeningLessonDetail,
  type ListeningQuestionResult,
  type ListeningSkillRow,
  type ListeningSubmitResponse,
  type SpeakingWordResult,
} from "@/types/learningCentre";

const OPTION_LETTERS = ["A", "B", "C", "D"];

/** The sentence as it was spoken, each word coloured by how the student's version compared. */
function WordDiff({ words }: { words: SpeakingWordResult[] }) {
  return (
    <p className="text-sm leading-relaxed">
      {words.map((w, i) => (
        <span key={i}>
          <span
            className={cn(
              w.status === "ok" && "text-primary",
              w.status === "close" && "rounded bg-status-warning/15 px-0.5 font-semibold text-status-warning",
              w.status === "wrong" && "rounded bg-status-danger/15 px-0.5 font-semibold text-status-danger",
              w.status === "missed" && "rounded bg-status-danger/15 px-0.5 font-semibold text-status-danger underline decoration-dotted"
            )}
            title={w.status === "close" || w.status === "wrong" ? `You typed “${w.heard ?? ""}”` : w.status === "missed" ? "You left this word out" : undefined}
          >
            {w.word}
          </span>{" "}
        </span>
      ))}
    </p>
  );
}

function HearButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex shrink-0 items-center gap-1 rounded-control border border-sky-500/25 bg-sky-500/10 px-2 py-1 text-2xs font-bold text-sky-500 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

export function ListeningResult({
  lesson,
  response,
  player,
  onRetry,
}: {
  lesson: ListeningLessonDetail;
  response: ListeningSubmitResponse;
  player: ListeningPlayerApi;
  onRetry: () => void;
}) {
  const { attempt, format, skill_breakdown: breakdown, next } = response;
  const isDictation = format === "dictation";
  const questionResults = (isDictation ? [] : response.results) as ListeningQuestionResult[];
  const dictationResults = (isDictation ? response.results : []) as ListeningDictationResult[];

  const skillRows = useMemo<ListeningSkillRow[]>(
    () =>
      breakdown.map((b) => ({
        skill: b.skill,
        label: b.label || LISTENING_SKILL_LABELS[b.skill],
        correct: b.correct,
        total: b.total,
        pct: b.total > 0 ? Math.round((100 * b.correct) / b.total) : 0,
      })),
    [breakdown]
  );

  // sentence index -> question numbers whose answer lives there (for the transcript highlights)
  const evidence = useMemo(() => {
    const map = new Map<number, number[]>();
    questionResults.forEach((r, i) => {
      if (r.evidence !== null && r.evidence !== undefined) map.set(r.evidence, [...(map.get(r.evidence) ?? []), i + 1]);
    });
    return map;
  }, [questionResults]);

  const missed = questionResults.filter((r) => !r.is_correct).length;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Score */}
      <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <ReadinessRing value={attempt.score} label={attempt.passed ? "Passed" : "Keep going"} />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <FormatChip format={lesson.format} />
              <DifficultyBadge difficulty={lesson.difficulty} />
              {attempt.mode === "exam" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-status-warning/30 bg-status-warning/10 px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-status-warning">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  Exam attempt
                </span>
              )}
            </div>

            {attempt.passed ? (
              <motion.p
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="flex items-center justify-center gap-1.5 text-base font-bold text-status-success sm:justify-start"
              >
                <Trophy className="h-5 w-5" aria-hidden="true" />
                Nice listening — you passed!
              </motion.p>
            ) : (
              <p className="text-base font-bold text-status-warning">
                {isDictation
                  ? `Just short of ${LISTENING_PASS_THRESHOLD}% — look at the words marked below, then listen again.`
                  : `Just short of ${LISTENING_PASS_THRESHOLD}% — see where the answers were and listen again.`}
              </p>
            )}

            {attempt.is_new_best && attempt.previous_best !== null && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-primary/10 px-2.5 py-1 text-xs font-bold text-accent-primary">
                <Medal className="h-3.5 w-3.5" aria-hidden="true" />
                New personal best — up from {attempt.previous_best}%
              </p>
            )}
            <p className="text-2xs text-text-muted">
              Attempt #{attempt.attempt_number}
              {!isDictation && ` · ${questionResults.length - missed} of ${questionResults.length} correct`}
              {isDictation && ` · ${dictationResults.filter((d) => d.is_correct).length} of ${dictationResults.length} sentences caught`}
            </p>
          </div>
        </div>

        {skillRows.length > 0 && (
          <div className="mt-5 border-t border-border-subtle pt-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-text-secondary">What this lesson trained</h3>
            <SkillBars skills={skillRows} />
          </div>
        )}
      </section>

      {/* Multiple choice review */}
      {!isDictation && (
        <section className="space-y-3" aria-label="Question review">
          <h3 className="text-sm font-bold text-primary">Your answers</h3>
          {questionResults.map((r, i) => (
            <div
              key={i}
              className={cn(
                "space-y-2 rounded-panel border p-4 text-xs",
                r.is_correct ? "border-status-success/20 bg-status-success/5" : "border-status-danger/20 bg-status-danger/5"
              )}
            >
              <div className="flex items-start gap-2.5">
                {r.is_correct ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-label="Correct" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" aria-label="Incorrect" />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">Question {i + 1}</span>
                    {r.skill && (
                      <span className="rounded-full bg-elevated px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wide text-text-secondary">
                        {LISTENING_SKILL_LABELS[r.skill]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-primary">{r.question}</p>
                  {r.is_correct ? (
                    <p className="font-semibold text-status-success">
                      {OPTION_LETTERS[r.selected_index]}. {r.options[r.selected_index]}
                    </p>
                  ) : (
                    <>
                      <p className="text-text-secondary">
                        You chose{" "}
                        <span className="font-semibold text-status-danger">
                          {OPTION_LETTERS[r.selected_index]}. {r.options[r.selected_index]}
                        </span>
                      </p>
                      <p className="text-text-secondary">
                        Correct answer:{" "}
                        <span className="font-semibold text-status-success">
                          {OPTION_LETTERS[r.correct_index]}. {r.options[r.correct_index]}
                        </span>
                      </p>
                    </>
                  )}
                  <p className="leading-relaxed text-text-secondary">{r.explanation}</p>
                </div>
                {r.evidence !== null && r.evidence !== undefined && player.supported && (
                  <HearButton label="Hear the answer" onClick={() => player.playOne(r.evidence as number)} />
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {!isDictation && <TranscriptReview player={player} sentences={lesson.sentences} speakers={lesson.speakers} evidence={evidence} />}

      {/* Dictation review */}
      {isDictation && (
        <section className="space-y-3" aria-label="Dictation review">
          <h3 className="text-sm font-bold text-primary">Sentence by sentence</h3>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-secondary">
            <span><span className="rounded bg-status-warning/15 px-1 font-semibold text-status-warning">amber</span> = nearly right (a typo)</span>
            <span><span className="rounded bg-status-danger/15 px-1 font-semibold text-status-danger">red</span> = wrong word</span>
            <span><span className="rounded bg-status-danger/15 px-1 font-semibold text-status-danger underline decoration-dotted">dotted</span> = left out</span>
          </p>
          {dictationResults.map((d) => (
            <div
              key={d.index}
              className={cn("space-y-2 rounded-panel border p-4", d.is_correct ? "border-status-success/20 bg-status-success/5" : "border-status-danger/20 bg-status-danger/5")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">Sentence {d.index + 1}</span>
                    <span className={cn("font-mono text-2xs font-bold tabular-nums", d.is_correct ? "text-status-success" : "text-status-danger")}>{d.accuracy}%</span>
                  </div>
                  <div>
                    <p className="mb-0.5 text-2xs font-bold uppercase tracking-wide text-text-muted">What was said</p>
                    <WordDiff words={d.words} />
                  </div>
                  <div>
                    <p className="mb-0.5 text-2xs font-bold uppercase tracking-wide text-text-muted">What you typed</p>
                    <p className={cn("text-sm leading-relaxed", d.typed ? "text-text-secondary" : "italic text-text-muted")}>{d.typed || "Nothing typed"}</p>
                  </div>
                </div>
                {player.supported && <HearButton label="Hear it" onClick={() => player.playOne(d.index)} />}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* What next */}
      <section className="space-y-3 rounded-panel border border-accent-primary/25 bg-accent-primary/[0.04] p-5">
        {next && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-2xs font-bold uppercase tracking-wide text-accent-primary">Up next for you</p>
              <p className="mt-0.5 truncate text-sm font-bold text-primary">{next.title}</p>
              <p className="text-xs text-text-secondary">{next.reason}</p>
            </div>
            <Link
              href={`/dashboard/learning-centre/listening/session?lessonId=${next.lesson_id}`}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control bg-accent-primary px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover"
            >
              Start next lesson
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-control py-2.5 text-xs font-bold transition-colors",
              !attempt.passed && !next ? "bg-accent-primary text-white hover:bg-accent-primary-hover" : "border border-border-subtle bg-elevated text-primary hover:border-accent-primary/40"
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {attempt.passed ? "Try for a better score" : "Try this lesson again"}
          </button>
          <Link
            href="/dashboard/learning-centre/listening"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-control border border-border-subtle bg-elevated py-2.5 text-xs font-bold text-primary transition-colors hover:border-accent-primary/40"
          >
            All lessons
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </motion.div>
  );
}
