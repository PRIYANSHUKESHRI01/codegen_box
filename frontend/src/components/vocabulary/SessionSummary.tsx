"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Flame, Loader2, PartyPopper, RotateCcw, Sparkles, Target, Trophy, TrendingUp } from "lucide-react";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { cn } from "@/lib/utils";
import { formatSeconds, percent, verdictFor } from "@/lib/vocabulary/format";
import { ExampleSentence, HearButton } from "./vocabularyUi";
import type { VocabularyKind, VocabularySummary } from "@/types/learningCentre";

interface SessionSummaryProps {
  summary: VocabularySummary;
  kind: VocabularyKind;
  retrying: boolean;
  onRetryMissed: () => void;
  onAnother: () => void;
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Clock; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-control border border-border-subtle bg-elevated p-3">
      <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-text-secondary">
        <Icon className="h-3.5 w-3.5 text-accent-primary" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold tabular-nums text-primary">{value}</p>
      {hint && <p className="text-2xs font-semibold text-text-secondary">{hint}</p>}
    </div>
  );
}

/** The end of a sprint: how it went, what moved, what to revisit, and what to do next. */
export function SessionSummary({ summary, kind, retrying, onRetryMissed, onAnother }: SessionSummaryProps) {
  const verdict = verdictFor(summary.score);
  const goal = summary.daily_goal;
  const goalPct = percent(Math.min(goal.answered, goal.goal), goal.goal);

  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5" aria-label="Session results">
      <div className="rounded-panel border border-border-subtle bg-surface p-6 shadow-card sm:p-8">
        <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
          <ReadinessRing value={summary.score} label="Accuracy" size={132} />
          <div className="min-w-0 flex-1 space-y-2">
            <h2
              className={cn(
                "text-2xl font-extrabold tracking-tight",
                verdict.tone === "great" ? "text-status-success" : "text-primary"
              )}
            >
              {verdict.headline}
            </h2>
            <p className="text-sm font-semibold text-text-secondary">
              You got {summary.correct} of {summary.total} right
              {summary.new_words_met > 0 && ` and met ${summary.new_words_met} new word${summary.new_words_met === 1 ? "" : "s"}`}.
              {summary.missed.length > 0 && " The words you missed will come back soon, which is exactly how they stick."}
            </p>
            {goal.reached && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-status-success/10 px-3 py-1 text-xs font-bold text-status-success">
                <PartyPopper className="h-4 w-4" aria-hidden="true" />
                Daily goal reached
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Target} label="Correct" value={`${summary.correct}/${summary.total}`} />
          <Stat icon={Clock} label="Time" value={summary.duration_seconds ? formatSeconds(summary.duration_seconds) : "—"} />
          <Stat icon={TrendingUp} label="Moved up" value={summary.words_moved_up} hint={summary.words_moved_up === 1 ? "word" : "words"} />
          <Stat icon={Flame} label="Streak" value={`${summary.streak_days} day${summary.streak_days === 1 ? "" : "s"}`} />
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-2xs font-bold text-text-secondary">
            <span>Today&apos;s goal</span>
            <span className="tabular-nums">
              {Math.min(goal.answered, goal.goal)} of {goal.goal} answers
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-elevated" role="meter" aria-label="Daily goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalPct}>
            <div className={cn("h-full rounded-full transition-[width] duration-700", goal.reached ? "bg-status-success" : "bg-accent-primary")} style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      </div>

      {summary.mastered_now.length > 0 && (
        <div className="rounded-panel border border-status-success/30 bg-status-success/5 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-status-success">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Newly mastered
          </h3>
          <ul className="flex flex-wrap gap-2">
            {summary.mastered_now.map((c) => (
              <li key={c.word} className="rounded-full border border-status-success/30 bg-surface px-3 py-1 text-xs font-bold text-primary">
                {c.word}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.missed.length > 0 && (
        <div className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
          <h3 className="mb-1 text-sm font-extrabold text-primary">Words to look at again</h3>
          <p className="mb-4 text-xs font-semibold text-text-secondary">Read them once more. They&apos;ll be back in your next sprint.</p>
          <ul className="divide-y divide-border-subtle">
            {summary.missed.map((c) => (
              <li key={c.word} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <HearButton text={c.word} size="sm" className="mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-primary">
                    {c.word} {c.part_of_speech && <span className="text-xs font-bold italic text-text-secondary">{c.part_of_speech}</span>}
                  </p>
                  <p className="text-xs font-semibold text-text-secondary">{c.meaning}</p>
                  {c.example && <ExampleSentence example={c.example} word={c.word} className="mt-1 text-xs leading-relaxed text-text-secondary" />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {summary.can_retry_missed && (
          <button
            type="button"
            onClick={onRetryMissed}
            disabled={retrying}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-control bg-accent-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:opacity-60 sm:flex-none"
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
            Practise missed words
          </button>
        )}
        <button
          type="button"
          onClick={onAnother}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-control px-5 py-3 text-sm font-bold transition-colors sm:flex-none",
            summary.can_retry_missed
              ? "border border-border-subtle bg-surface text-primary hover:border-accent-primary/40"
              : "bg-accent-primary text-white hover:bg-accent-primary-hover"
          )}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {kind === "custom" ? "Another quiz" : "Another sprint"}
        </button>
        <Link
          href="/dashboard/learning-centre/vocabulary"
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-control border border-border-subtle bg-surface px-5 py-3 text-sm font-bold text-primary transition-colors hover:border-accent-primary/40 sm:flex-none"
        >
          Back to Vocabulary
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </motion.section>
  );
}
