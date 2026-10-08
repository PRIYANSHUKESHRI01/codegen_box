"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, CornerDownLeft, Loader2, RotateCcw, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { letterCountLabel } from "@/lib/vocabulary/format";
import { HearButton, StatusChip } from "./vocabularyUi";
import { WordCardView } from "./WordCardView";
import { VOCABULARY_STATUS_LABELS, type VocabularyAnswerResult, type VocabularyQuestion } from "@/types/learningCentre";

const BLANK = "_____";

const TYPE_LABEL: Record<VocabularyQuestion["type"], string> = {
  meaning: "What does it mean?",
  word: "Find the word",
  cloze: "Complete the sentence",
  recall: "Type the word",
};

interface QuestionViewProps {
  question: VocabularyQuestion;
  /** Position in the session, 1-based. */
  number: number;
  total: number;
  selected: number | null;
  typed: string;
  /** Set once the answer has been checked — switches the card into feedback. */
  result: VocabularyAnswerResult | null;
  submitting: boolean;
  isLast: boolean;
  /** The AI quiz explains each answer; word-bank questions let the word card do that. */
  showExplanation: boolean;
  onSelect: (index: number) => void;
  onType: (text: string) => void;
  onCheck: () => void;
  onContinue: () => void;
}

/** The empty slot in a sentence-blank question; filled in with the answer once it is known. */
function Gap({ answer, correct }: { answer: string | null; correct: boolean }) {
  if (answer === null) {
    return <span className="mx-1 inline-block h-[1.1em] min-w-[5.5rem] translate-y-1 border-b-4 border-dashed border-accent-primary/60" aria-label="blank" />;
  }
  return (
    <strong
      className={cn(
        "mx-0.5 rounded-control px-1.5 py-0.5 font-extrabold",
        correct ? "bg-status-success/15 text-status-success" : "bg-status-success/10 text-status-success underline decoration-2 underline-offset-4"
      )}
    >
      {answer}
    </strong>
  );
}

export function QuestionView({
  question: q,
  number,
  total,
  selected,
  typed,
  result,
  submitting,
  isLast,
  showExplanation,
  onSelect,
  onType,
  onCheck,
  onContinue,
}: QuestionViewProps) {
  const answered = result !== null;
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const isRecall = q.type === "recall";

  // A fresh typed question puts the cursor in the box; a checked answer puts focus on Continue so Enter keeps the flow going.
  useEffect(() => {
    if (answered) continueRef.current?.focus();
    else if (isRecall) inputRef.current?.focus();
  }, [answered, isRecall, q.index]);

  const canCheck = isRecall ? typed.trim() !== "" : selected !== null;

  return (
    <article className="space-y-4" aria-label={`Question ${number} of ${total}`}>
      <div className="rounded-panel border border-border-subtle bg-surface p-5 shadow-card sm:p-7">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {TYPE_LABEL[q.type]}
          </span>
          {q.is_echo && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-elevated px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wide text-text-secondary">
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              Second look
            </span>
          )}
        </div>

        {/* ── The question itself ───────────────────────────────────────── */}
        {q.type === "meaning" && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-primary sm:text-4xl">{q.word}</h2>
              {q.part_of_speech && <p className="mt-1 text-xs font-bold italic text-text-secondary">{q.part_of_speech}</p>}
              <p className="mt-3 text-sm font-semibold text-text-secondary">Which meaning is right?</p>
            </div>
            {q.word && <HearButton text={q.word} size="lg" />}
          </div>
        )}

        {q.type === "word" && (
          <div>
            <h2 className="text-xl font-extrabold leading-snug tracking-tight text-primary sm:text-2xl">{q.prompt}</h2>
            {q.part_of_speech && <p className="mt-2 text-xs font-bold italic text-text-secondary">{q.part_of_speech}</p>}
          </div>
        )}

        {q.type === "cloze" && (
          <div>
            <p className="text-sm font-semibold text-text-secondary">{q.prompt}</p>
            <p className="mt-3 text-xl font-bold leading-relaxed text-primary sm:text-2xl">
              {(q.sentence ?? "").split(BLANK).map((part, i, all) => (
                <span key={i}>
                  {part}
                  {i < all.length - 1 && <Gap answer={answered ? result.correct_answer : null} correct={answered && result.is_correct} />}
                </span>
              ))}
            </p>
          </div>
        )}

        {q.type === "recall" && (
          <div>
            <h2 className="text-xl font-extrabold leading-snug tracking-tight text-primary sm:text-2xl">{q.prompt}</h2>
            <p className="mt-4 font-mono text-2xl font-bold tracking-[0.35em] text-accent-primary" aria-label={`Hint: starts with ${q.hint?.[0] ?? ""}, ${letterCountLabel(q)}`}>
              {q.hint}
            </p>
            <p className="mt-1 text-2xs font-bold text-text-secondary">{letterCountLabel(q)}</p>
          </div>
        )}

        {/* ── Answering ─────────────────────────────────────────────────── */}
        <div className="mt-6">
          {isRecall ? (
            <div>
              <label htmlFor="recall-input" className="sr-only">
                Your answer
              </label>
              <input
                id="recall-input"
                ref={inputRef}
                value={answered ? result.response ?? "" : typed}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !answered && canCheck && !submitting) {
                    e.preventDefault();
                    onCheck();
                  }
                }}
                disabled={answered || submitting}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={100}
                placeholder="Type the word…"
                className={cn(
                  "w-full rounded-control border-2 bg-elevated px-4 py-3 text-lg font-bold text-primary placeholder:font-medium placeholder:text-text-muted focus:outline-none",
                  !answered && "border-border-subtle focus:border-accent-primary",
                  answered && result.is_correct && "border-status-success bg-status-success/10",
                  answered && !result.is_correct && (result.close ? "border-status-warning bg-status-warning/10" : "border-status-danger bg-status-danger/10")
                )}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Answer options">
              {(q.options ?? []).map((option, oi) => {
                const isSelected = selected === oi;
                const isCorrect = answered && result.correct_index === oi;
                const isWrongPick = answered && !result.is_correct && result.selected_index === oi;

                return (
                  <button
                    key={oi}
                    type="button"
                    role="radio"
                    aria-checked={answered ? result.selected_index === oi : isSelected}
                    disabled={answered || submitting}
                    onClick={() => onSelect(oi)}
                    className={cn(
                      "flex items-start gap-3 rounded-control border-2 px-3.5 py-3 text-left text-sm font-semibold leading-snug transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                      !answered && !isSelected && "border-border-subtle bg-elevated text-primary hover:border-accent-primary/50 hover:bg-surface-hover",
                      !answered && isSelected && "border-accent-primary bg-accent-primary/10 text-primary shadow-subtle",
                      isCorrect && "border-status-success bg-status-success/10 text-primary",
                      isWrongPick && "border-status-danger bg-status-danger/10 text-primary",
                      answered && !isCorrect && !isWrongPick && "border-border-subtle bg-elevated text-text-secondary opacity-70"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-2xs font-bold",
                        isCorrect ? "bg-status-success text-white" : isWrongPick ? "bg-status-danger text-white" : isSelected ? "bg-accent-primary text-white" : "bg-surface text-text-secondary ring-1 ring-border-subtle"
                      )}
                    >
                      {isCorrect ? <Check className="h-3.5 w-3.5" /> : isWrongPick ? <XCircle className="h-3.5 w-3.5" /> : oi + 1}
                    </span>
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!answered && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="hidden text-2xs font-semibold text-text-secondary sm:block">
              {isRecall ? "Press Enter to check" : "Press 1–4 to choose, Enter to check"}
            </p>
            <button
              type="button"
              onClick={onCheck}
              disabled={!canCheck || submitting}
              className="ml-auto inline-flex items-center justify-center gap-2 rounded-control bg-accent-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              Check
            </button>
          </div>
        )}
      </div>

      {/* ── Feedback ────────────────────────────────────────────────────── */}
      {answered && (
        <div
          className={cn(
            "space-y-4 rounded-panel border-2 p-5 sm:p-6",
            result.is_correct ? "border-status-success/40 bg-status-success/5" : result.close ? "border-status-warning/40 bg-status-warning/5" : "border-status-danger/30 bg-status-danger/5"
          )}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              className={cn(
                "flex items-center gap-2 text-lg font-extrabold",
                result.is_correct ? "text-status-success" : result.close ? "text-status-warning" : "text-status-danger"
              )}
            >
              {result.is_correct ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <XCircle className="h-5 w-5" aria-hidden="true" />}
              {result.is_correct ? "Correct" : result.close ? "So close — check the spelling" : "Not quite"}
            </h3>
            {result.progress && <StatusChip status={result.progress.status} />}
          </div>

          {/* The word card below already states the answer; the only thing it can't show is what was typed. */}
          {isRecall && !result.is_correct && result.correct_answer && (
            <p className="text-sm font-semibold text-text-secondary">
              The answer is: <strong className="text-primary">{result.correct_answer}</strong>
              {result.response && (
                <span className="ml-2 text-xs">
                  (you typed <span className="line-through">{result.response}</span>)
                </span>
              )}
            </p>
          )}

          {showExplanation && result.explanation && <p className="text-sm font-semibold leading-relaxed text-text-secondary">{result.explanation}</p>}

          <WordCardView card={result.card} size="compact" />

          {result.progress && <ProgressLine progress={result.progress} />}

          <div className="flex justify-end">
            <button
              ref={continueRef}
              type="button"
              onClick={onContinue}
              className="inline-flex items-center justify-center gap-2 rounded-control bg-accent-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              {isLast ? "See results" : "Continue"}
              {isLast ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : <CornerDownLeft className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/** One plain sentence on what this answer did to the word's place in the student's memory. */
function ProgressLine({ progress }: { progress: NonNullable<VocabularyAnswerResult["progress"]> }) {
  const next = progress.next_review;
  const status = VOCABULARY_STATUS_LABELS[progress.status].toLowerCase();

  if (progress.became_mastered) {
    return (
      <p className="flex items-center gap-2 rounded-control bg-status-success/10 px-3 py-2 text-xs font-bold text-status-success">
        <Trophy className="h-4 w-4 shrink-0" aria-hidden="true" />
        Mastered! You&apos;ll see this word again {next ?? "later"}.
      </p>
    );
  }
  if (progress.moved_up) {
    return (
      <p className="flex items-center gap-2 rounded-control bg-accent-primary/10 px-3 py-2 text-xs font-bold text-text-secondary">
        <ArrowUpRight className="h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
        Now {status}. Next review {next ?? "soon"}.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 rounded-control bg-elevated px-3 py-2 text-xs font-bold text-text-secondary">
      <RotateCcw className="h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
      {next === "today" ? "We’ll bring this word back again today." : `Still ${status}. Next review ${next ?? "soon"}.`}
    </p>
  );
}
