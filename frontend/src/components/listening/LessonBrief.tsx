"use client";

import { ArrowLeft, Clock, Ear, Lightbulb, Lock, Play, RotateCcw, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DifficultyBadge, FORMAT_ICON, FormatChip, formatDuration } from "./listeningUi";
import {
  LISTENING_EXAM_MAX_PLAYS,
  LISTENING_FORMAT_HINTS,
  LISTENING_PASS_THRESHOLD,
  LISTENING_SKILL_HINTS,
  LISTENING_SKILL_LABELS,
  type ListeningHistory,
  type ListeningLessonDetail,
  type ListeningMode,
} from "@/types/learningCentre";

const TIPS: Record<ListeningLessonDetail["format"], string[]> = {
  comprehension: [
    "Read the questions first — you'll know what to listen for.",
    "Don't try to catch every word. Listen for the main point, then the details.",
    "Numbers, names and times are easy to miss — jot them down mentally as you hear them.",
  ],
  conversation: [
    "Notice who says what — the questions often ask about one speaker.",
    "People rarely repeat themselves. A fact is usually said once, so stay with the audio.",
    "Listen to how people react — it tells you what they feel, not only what they say.",
  ],
  dictation: [
    "Listen to the whole sentence once before you start typing.",
    "Replay as often as you need — that's what practice mode is for.",
    "Small words (a, the, of, to) are the ones people miss. Listen for them.",
  ],
};

/**
 * Before the audio: what this lesson is, what it trains, how long it takes,
 * how you've done before, and the choice between Practice (replay freely, for
 * learning) and Exam (limited plays, to rehearse a real test).
 */
export function LessonBrief({
  lesson,
  history,
  mode,
  onModeChange,
  onStart,
  starting,
}: {
  lesson: ListeningLessonDetail;
  history: ListeningHistory | null;
  mode: ListeningMode;
  onModeChange: (mode: ListeningMode) => void;
  onStart: () => void;
  starting: boolean;
}) {
  const skills = lesson.skills;
  const Icon = lesson.is_mine ? Sparkles : FORMAT_ICON[lesson.format];
  const unit = lesson.format === "dictation" ? "sentences to type" : "questions";

  return (
    <div className="space-y-5">
      <Link href="/dashboard/learning-centre/listening" className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted transition-colors hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        All lessons
      </Link>

      <section className="space-y-5 rounded-panel border border-border-subtle bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control border border-sky-500/25 bg-gradient-to-br from-sky-500/25 to-sky-500/5 bg-sky-500/10 text-sky-500">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <FormatChip format={lesson.format} />
              <DifficultyBadge difficulty={lesson.difficulty} />
              <span className="text-2xs font-semibold text-text-muted">{lesson.category}</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-primary">{lesson.title}</h2>
            <p className="mt-0.5 text-xs text-text-secondary">{LISTENING_FORMAT_HINTS[lesson.format]}</p>
            {lesson.is_mine && lesson.interest && <p className="mt-1 text-2xs font-semibold text-accent-primary">Made for you · {lesson.interest}</p>}
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2.5">
          <div className="rounded-control bg-elevated p-3 text-center">
            <dt className="flex items-center justify-center gap-1 text-3xs font-bold uppercase tracking-wide text-text-muted">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Audio
            </dt>
            <dd className="mt-0.5 text-lg font-black text-primary">{formatDuration(lesson.estimated_seconds)}</dd>
          </div>
          <div className="rounded-control bg-elevated p-3 text-center">
            <dt className="text-3xs font-bold uppercase tracking-wide text-text-muted">{unit.replace(" to type", "")}</dt>
            <dd className="mt-0.5 text-lg font-black text-primary">{lesson.item_count}</dd>
          </div>
          <div className="rounded-control bg-elevated p-3 text-center">
            <dt className="flex items-center justify-center gap-1 text-3xs font-bold uppercase tracking-wide text-text-muted">
              <Trophy className="h-3 w-3" aria-hidden="true" />
              Your best
            </dt>
            <dd className="mt-0.5 text-lg font-black text-primary">{history?.best_score != null ? `${history.best_score}%` : "—"}</dd>
          </div>
        </dl>

        {skills.length > 0 && (
          <div>
            <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-text-secondary">What this trains</h3>
            <ul className="space-y-1.5">
              {skills.map((s) => (
                <li key={s} className="flex items-baseline gap-2 text-xs">
                  <span className="font-bold text-primary">{LISTENING_SKILL_LABELS[s]}</span>
                  <span className="text-text-muted">— {LISTENING_SKILL_HINTS[s]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-text-secondary">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
            Before you start
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-xs text-text-secondary marker:text-sky-500">
            {TIPS[lesson.format].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        {/* Mode */}
        <div role="radiogroup" aria-label="Choose a mode" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {(
            [
              { key: "practice", title: "Practice", icon: RotateCcw, body: "Replay as much as you like, slow it down, pick an accent, and use captions. Best for learning." },
              { key: "exam", title: "Exam", icon: Lock, body: `Audio plays up to ${LISTENING_EXAM_MAX_PLAYS} times ${lesson.format === "dictation" ? "per sentence" : "in total"}, at normal speed, no captions. Rehearses a real test.` },
            ] as const
          ).map(({ key, title, icon: ModeIcon, body }) => {
            const active = mode === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onModeChange(key)}
                className={cn(
                  "rounded-control border p-3.5 text-left transition-colors",
                  active ? "border-accent-primary bg-accent-primary/[0.06] ring-1 ring-accent-primary/30" : "border-border-subtle bg-elevated hover:border-accent-primary/40"
                )}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <ModeIcon className={cn("h-3.5 w-3.5", active ? "text-accent-primary" : "text-text-muted")} aria-hidden="true" />
                  {title}
                </span>
                <span className="mt-1 block text-2xs leading-relaxed text-text-secondary">{body}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="flex w-full items-center justify-center gap-2 rounded-control bg-accent-primary py-3 text-sm font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
        >
          <Ear className="h-4 w-4" aria-hidden="true" />
          {history && history.attempt_count > 0 ? "Start another attempt" : "Start listening"}
          <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
        </button>
        <p className="text-center text-2xs text-text-muted">
          Score {LISTENING_PASS_THRESHOLD}% or more to pass
          {history && history.attempt_count > 0 ? ` · ${history.attempt_count} attempt${history.attempt_count === 1 ? "" : "s"} so far` : ""}
        </p>
      </section>
    </div>
  );
}
