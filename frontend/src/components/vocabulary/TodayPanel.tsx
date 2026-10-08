"use client";

import Link from "next/link";
import { ArrowRight, Flame, Play, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { sessionHref } from "@/lib/vocabulary/format";
import { GoalRing } from "./vocabularyUi";
import type { VocabularyOverview } from "@/types/learningCentre";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function MiniStat({ icon: Icon, label, value, caption }: { icon: typeof Flame; label: string; value: string; caption: string }) {
  return (
    <div className="rounded-control border border-border-subtle bg-surface/80 p-3">
      <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-text-secondary">
        <Icon className="h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold tabular-nums text-primary">{value}</p>
      <p className="text-2xs font-semibold text-text-secondary">{caption}</p>
    </div>
  );
}

/**
 * The top of the Vocabulary Sprint page: today's goal, the one button that
 * starts today's sprint, and the habit numbers (streak, mastered words,
 * accuracy). What the button says follows where the student actually is — a
 * session in progress, a first visit, a sprint ready, or nothing left to do.
 */
export function TodayPanel({ overview }: { overview: VocabularyOverview }) {
  const { today, next_sprint: sprint, resume, totals } = overview;
  const firstVisit = totals.new === totals.library_words && today.answered === 0 && totals.my_words === 0 && !resume;

  let heading: string;
  let detail: string;
  let cta: { label: string; href: string } | null = null;

  if (resume) {
    heading = "Pick up where you left off";
    detail = `${resume.title} · ${resume.answered} of ${resume.total} done`;
    cta = { label: "Continue", href: sessionHref({ kind: resume.kind, attemptId: resume.attempt_id }) };
  } else if (sprint.state === "empty") {
    heading = "The word library is on its way";
    detail = "There are no words to practise just yet. Check back soon.";
  } else if (sprint.state === "practice") {
    heading = "You’re all caught up";
    detail = "Nothing is due and there are no new words waiting. Free practice keeps what you know fresh.";
    cta = { label: "Free practice", href: sessionHref({ kind: "daily" }) };
  } else if (firstVisit) {
    heading = "Learn words that stay learned";
    detail = "Each sprint teaches a few new words, then brings them back just before you’d forget. About 3 minutes a day.";
    cta = { label: "Start your first sprint", href: sessionHref({ kind: "daily" }) };
  } else {
    heading = today.goal_reached ? "Daily goal reached. Nice work." : "Today’s sprint is ready";
    const parts = [
      sprint.new_words > 0 ? plural(sprint.new_words, "new word") : null,
      sprint.reviews_due > 0 ? `${sprint.reviews_due} to review` : null,
      `about ${sprint.minutes} min`,
    ].filter(Boolean);
    detail = parts.join(" · ") + (sprint.focus_deck ? ` · next up: ${sprint.focus_deck.title}` : "");
    cta = { label: today.goal_reached ? "Keep going" : "Start sprint", href: sessionHref({ kind: "daily" }) };
  }

  return (
    <section
      className="relative overflow-hidden rounded-panel border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.10] via-surface to-accent-primary/[0.06] p-5 shadow-card sm:p-6"
      aria-label="Today's practice"
    >
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <GoalRing done={today.answered} goal={today.goal} />

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-primary sm:text-2xl">{heading}</h2>
            <p className="mt-1 text-sm font-semibold text-text-secondary">{detail}</p>
          </div>

          {cta && (
            <Link
              href={cta.href}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-control bg-accent-primary px-6 py-3 text-sm font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              )}
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {cta.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 border-t border-border-subtle pt-4 sm:grid-cols-4">
        <MiniStat icon={Flame} label="Streak" value={String(today.streak_days)} caption={today.streak_days === 1 ? "day in a row" : "days in a row"} />
        <MiniStat icon={Trophy} label="Mastered" value={`${totals.mastered} of ${totals.library_words}`} caption="words" />
        <MiniStat icon={Target} label="Accuracy" value={today.accuracy_7d === null ? "—" : `${today.accuracy_7d}%`} caption="last 7 days" />
        <MiniStat icon={Play} label="Due today" value={String(totals.due_today)} caption={totals.due_today === 1 ? "word to review" : "words to review"} />
      </div>
    </section>
  );
}
