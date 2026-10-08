"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { DifficultyBadge, FORMAT_ICON, FormatChip, formatDuration } from "./listeningUi";
import { LISTENING_FORMAT_LABELS, LISTENING_SKILL_LABELS, LISTENING_PASS_THRESHOLD, type ListeningLessonSummary } from "@/types/learningCentre";

/** One lesson in the library or the student's own shelf. Everything a student needs to choose: what it is, how long, what it trains, how they did. */
export function LessonCard({ lesson, highlight }: { lesson: ListeningLessonSummary; highlight?: boolean }) {
  const Icon = lesson.is_mine ? Sparkles : FORMAT_ICON[lesson.format];
  const unit = lesson.format === "dictation" ? "sentences" : "questions";

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18, ease: "easeOut" }} className="h-full">
      <Link
        href={`/dashboard/learning-centre/listening/session?lessonId=${lesson.id}`}
        className={cn(
          "group flex h-full flex-col gap-3 rounded-panel border bg-surface p-5 shadow-subtle transition-all hover:border-border-strong hover:shadow-card",
          highlight ? "border-accent-primary/40 ring-1 ring-accent-primary/20" : "border-border-subtle"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-control border border-sky-500/25 bg-gradient-to-br from-sky-500/25 to-sky-500/5 bg-sky-500/10 text-sky-500">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <DifficultyBadge difficulty={lesson.difficulty} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-sm font-bold text-primary transition-colors group-hover:text-accent-primary">{lesson.title}</h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <FormatChip format={lesson.format} />
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-text-secondary">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatDuration(lesson.estimated_seconds)} · {lesson.question_count} {unit}
            </span>
          </div>
          <p className="text-2xs text-text-muted">
            {lesson.category}
            {lesson.format === "conversation" && lesson.speaker_count > 1 ? ` · ${lesson.speaker_count} speakers` : ""}
          </p>
          {lesson.is_mine && lesson.interest && <p className="line-clamp-1 text-2xs font-semibold text-accent-primary">Made for you · {lesson.interest}</p>}
          {lesson.skills.length > 0 && (
            <p className="line-clamp-1 text-2xs text-text-muted">Trains: {lesson.skills.slice(0, 3).map((s) => LISTENING_SKILL_LABELS[s]).join(" · ")}</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-2xs">
          {lesson.passed ? (
            <span className="flex items-center gap-1 font-bold text-status-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Passed · best {lesson.best_score}%
            </span>
          ) : lesson.best_score !== null ? (
            <span className="flex items-center gap-1 font-bold text-status-warning">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              Best {lesson.best_score}% · aim for {LISTENING_PASS_THRESHOLD}%
            </span>
          ) : (
            <span className="font-medium text-text-muted">{LISTENING_FORMAT_LABELS[lesson.format]} · not tried yet</span>
          )}
          <ArrowRight className="h-3.5 w-3.5 text-text-muted transition-all group-hover:translate-x-0.5 group-hover:text-accent-primary" aria-hidden="true" />
        </div>
      </Link>
    </motion.div>
  );
}
