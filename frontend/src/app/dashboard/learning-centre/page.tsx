"use client";

import { SessionLoader } from "@/components/ui/SessionLoader";
import { Sparkles, Mic, Headphones, SpellCheck2, Newspaper, Flame, Trophy, BookOpen } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ModuleCard } from "@/components/dashboard/learningCentre/ModuleCard";
import { StatTile } from "@/components/dashboard/student/StatTile";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useLearningCentreOverview } from "@/lib/useLearningCentreOverview";
import { cn } from "@/lib/utils";

/**
 * The Learning Centre hub — replaces the old flat "Articles" nav destination
 * with a proper landing page for all self-paced practice: Reading (the
 * existing Articles feature, re-presented here), Speaking, Listening, and
 * Vocabulary. Hero banner mirrors dashboard/page.tsx's "priority" gradient
 * wash so this reads as the same product, not a bolted-on section.
 */
export default function LearningCentrePage() {
  const { status } = useAuthGuard(["user"]);
  const { overview, loading } = useLearningCentreOverview();

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="user"
      title="Learning Centre"
      subtitle="Your own space to read, listen, and speak your way to sharper English — scored by AI, built for practice."
    >
      <div className="space-y-6">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section
          className={cn(
            "relative overflow-hidden rounded-panel border bg-surface bg-gradient-to-r shadow-card",
            "border-accent-primary/20 from-accent-primary/[0.15] via-accent-primary/[0.07] to-accent-secondary/[0.10]"
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-accent-primary/10 blur-3xl"
          />
          <div className="relative flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-panel border border-accent-primary/20 bg-surface text-accent-primary shadow-subtle">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary text-surface px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wide">
                  Powered by Gemini
                </span>
                <h2 className="mt-1.5 text-lg font-extrabold text-primary tracking-tight">
                  Welcome to your Learning Centre
                </h2>
                <p className="text-xs text-text-muted mt-0.5 max-w-xl">
                  Four ways to practice, one score that always tells you the truth. Fall below 60? Just try again.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatTile
            label="Practice Sessions"
            value={loading ? "—" : overview?.total_sessions ?? 0}
            icon={BookOpen}
            tone="primary"
          />
          <StatTile
            label="Best Speaking Score"
            value={loading ? "—" : overview?.best_speaking_score !== null && overview?.best_speaking_score !== undefined ? overview.best_speaking_score : "—"}
            suffix={overview?.best_speaking_score !== null && overview?.best_speaking_score !== undefined ? "%" : undefined}
            icon={Trophy}
            tone="success"
          />
          <StatTile
            label="Day Streak"
            value={loading ? "—" : overview?.day_streak ?? 0}
            icon={Flame}
            tone="warning"
          />
          <StatTile
            label="Words Mastered"
            value={loading ? "—" : overview?.words_mastered_total ?? overview?.words_mastered_this_week ?? 0}
            hint={overview?.words_mastered_total !== undefined ? `${overview.words_mastered_this_week} this week` : "This week"}
            icon={SpellCheck2}
            tone="secondary"
          />
        </div>

        {/* ── Modules ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ModuleCard
            href="/dashboard/articles"
            icon={Newspaper}
            color="emerald"
            title="Reading Hub"
            description="Curated, topic-by-topic technical articles — read at your own pace, one article to the next."
            meta="Self-paced knowledge base"
          />
          <ModuleCard
            href="/dashboard/learning-centre/speaking"
            icon={Mic}
            color="indigo"
            title="Speaking Practice"
            description="Read a passage aloud and get scored on clarity, fluency, and accuracy — retry instantly if you score under 60."
            meta={
              overview?.best_speaking_score !== null && overview?.best_speaking_score !== undefined
                ? `Best score ${overview.best_speaking_score}%`
                : "12 passages to try"
            }
            badge="AI Scored"
          />
          <ModuleCard
            href="/dashboard/learning-centre/listening"
            icon={Headphones}
            color="sky"
            title="Listening Lab"
            description="Train your ear with passages, real conversations and dictation — then see exactly which listening skill to work on next."
            meta={
              overview?.listening_lessons_total
                ? `${overview.listening_lessons_passed ?? 0} of ${overview.listening_lessons_total} lessons passed`
                : "Passages, conversations & dictation"
            }
            progressPct={
              overview?.listening_lessons_total
                ? Math.round((100 * (overview.listening_lessons_passed ?? 0)) / overview.listening_lessons_total)
                : undefined
            }
            badge="New"
          />
          <ModuleCard
            href="/dashboard/learning-centre/vocabulary"
            icon={SpellCheck2}
            color="amber"
            title="Vocabulary Sprint"
            description="Learn words that stay learned: daily sprints that bring each word back just before you'd forget it, plus a quick quiz on any topic."
            meta={
              overview?.vocabulary_words_total
                ? `${overview.words_mastered_total ?? 0} of ${overview.vocabulary_words_total} mastered${overview.vocabulary_due ? ` · ${overview.vocabulary_due} due` : ""}`
                : "Daily word sprints"
            }
            progressPct={
              overview?.vocabulary_words_total
                ? Math.round((100 * (overview.words_mastered_total ?? 0)) / overview.vocabulary_words_total)
                : undefined
            }
            badge="Smart review"
          />
        </div>
      </div>
    </DashboardShell>
  );
}
