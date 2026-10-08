"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Ear, Headphones, Loader2, PartyPopper, Sparkles, Target } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { GenerateLessonForm } from "@/components/listening/GenerateLessonForm";
import { LessonCard } from "@/components/listening/LessonCard";
import { SkillBars } from "@/components/listening/SkillBars";
import { DIFFICULTY_BADGE, DIFFICULTY_LABEL, FORMAT_ICON, Pill } from "@/components/listening/listeningUi";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LISTENING_FORMAT_LABELS,
  type Difficulty,
  type ListeningFormat,
  type ListeningIndexResponse,
} from "@/types/learningCentre";

type LevelFilter = Difficulty | "all";
type FormatFilter = ListeningFormat | "all";

const LEVEL_FILTERS: { key: LevelFilter; label: string }[] = [
  { key: "all", label: "All levels" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

const FORMAT_FILTERS: { key: FormatFilter; label: string }[] = [
  { key: "all", label: "All formats" },
  { key: "comprehension", label: LISTENING_FORMAT_LABELS.comprehension },
  { key: "conversation", label: LISTENING_FORMAT_LABELS.conversation },
  { key: "dictation", label: LISTENING_FORMAT_LABELS.dictation },
];

const LEVELS: Difficulty[] = ["beginner", "intermediate", "advanced"];

export default function ListeningLabListPage() {
  const { status } = useAuthGuard(["user"]);
  const [data, setData] = useState<ListeningIndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<LevelFilter>("all");
  const [format, setFormat] = useState<FormatFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<ListeningIndexResponse>("/learning-centre/listening/lessons"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load listening lessons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  const library = useMemo(
    () => (data?.lessons ?? []).filter((l) => (level === "all" || l.difficulty === level) && (format === "all" || l.format === format)),
    [data, level, format]
  );

  if (status !== "ready") return <SessionLoader />;

  const summary = data?.summary;
  const started = (summary?.attempts_total ?? 0) > 0;
  const passedPct = summary && summary.lessons_total > 0 ? Math.round((100 * summary.lessons_passed) / summary.lessons_total) : 0;
  const recommended = summary?.recommended ?? null;
  const recommendedLesson = recommended ? [...(data?.lessons ?? []), ...(data?.my_lessons ?? [])].find((l) => l.id === recommended.lesson_id) : null;

  return (
    <DashboardShell
      role="user"
      title="Listening Lab"
      subtitle="Train your ear for interviews, calls and placement tests — passages, real conversations and dictation, with a skill-by-skill picture of how you listen."
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-16 text-xs text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading lessons...
        </div>
      ) : error || !data || !summary ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center text-xs text-status-danger">{error ?? "Failed to load listening lessons."}</div>
      ) : (
        <div className="space-y-8">
          {/* ── Progress + up next ───────────────────────────────────────── */}
          <div className={cn("grid gap-4", summary.skills.length > 0 ? "lg:grid-cols-5" : "lg:grid-cols-1")}>
            <section
              className={cn(
                "relative overflow-hidden rounded-panel border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.10] via-surface to-accent-primary/[0.06] p-5 shadow-card sm:p-6",
                summary.skills.length > 0 && "lg:col-span-3"
              )}
              aria-label="Your listening progress"
            >
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
                {started ? (
                  <ReadinessRing value={passedPct} label="Lessons passed" size={116} />
                ) : (
                  <div className="flex h-[116px] w-[116px] shrink-0 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-500">
                    <Ear className="h-12 w-12" aria-hidden="true" />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <h2 className="text-lg font-extrabold tracking-tight text-primary">
                      {started ? `${summary.lessons_passed} of ${summary.lessons_total} lessons passed` : "Train your ear in five minutes a day"}
                    </h2>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {started
                        ? `Average best score ${summary.average_best_score ?? 0}% · ${summary.attempts_total} attempt${summary.attempts_total === 1 ? "" : "s"} · working at ${DIFFICULTY_LABEL[summary.current_level]} level`
                        : "Most listening mistakes aren't about vocabulary — they're about not catching the numbers, the names and the small words. Short daily practice fixes that."}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {LEVELS.map((lv) => {
                      const l = summary.levels[lv];
                      const pct = l.total > 0 ? Math.round((100 * l.passed) / l.total) : 0;
                      return (
                        <div key={lv} className="rounded-control border border-border-subtle bg-surface/80 p-2.5">
                          <p className="flex items-center justify-between gap-1 text-2xs font-bold text-text-secondary">
                            <span>{DIFFICULTY_LABEL[lv]}</span>
                            <span className="tabular-nums">{l.passed}/{l.total}</span>
                          </p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                            <div className={cn("h-full rounded-full transition-[width] duration-700", pct === 100 ? "bg-status-success" : "bg-sky-500")} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Up next */}
              <div className="relative mt-5 border-t border-border-subtle pt-4">
                {recommended ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-2xs font-bold uppercase tracking-wide text-accent-primary">{started ? "Up next for you" : "Start here"}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-primary">
                        {recommended.title}
                        <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", DIFFICULTY_BADGE[recommended.difficulty])}>{recommended.difficulty}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">{recommended.reason}</p>
                    </div>
                    <Link
                      href={`/dashboard/learning-centre/listening/session?lessonId=${recommended.lesson_id}`}
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control bg-accent-primary px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover"
                    >
                      {recommendedLesson?.attempt_count ? "Try again" : "Start lesson"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-sm font-bold text-status-success">
                    <PartyPopper className="h-5 w-5" aria-hidden="true" />
                    You&apos;ve aced every lesson. Write one about your next interview below.
                  </p>
                )}
              </div>
            </section>

            {summary.skills.length > 0 && (
              <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle lg:col-span-2" aria-label="Your listening skills">
                <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-primary">
                  <Target className="h-4 w-4 text-accent-primary" aria-hidden="true" />
                  How you listen
                </h2>
                <p className="mb-4 text-2xs text-text-muted">
                  {summary.weakest_skill
                    ? `Your weakest skill is “${summary.weakest_skill.label}” (${summary.weakest_skill.pct}%). Your next lesson targets it.`
                    : "Accuracy by skill, across all your attempts."}
                </p>
                <SkillBars skills={summary.skills} weakest={summary.weakest_skill} />
              </section>
            )}
          </div>

          {/* ── Make my own ──────────────────────────────────────────────── */}
          <GenerateLessonForm defaultLevel={summary.current_level} />

          {/* ── Made for you ─────────────────────────────────────────────── */}
          {data.my_lessons.length > 0 && (
            <section className="space-y-3" aria-label="Lessons made for you">
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-primary">
                <Sparkles className="h-4 w-4 text-accent-primary" aria-hidden="true" />
                Made for you
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.my_lessons.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} highlight={recommended?.lesson_id === lesson.id} />
                ))}
              </div>
            </section>
          )}

          {/* ── Library ──────────────────────────────────────────────────── */}
          <section className="space-y-3" aria-label="Lesson library">
            <h2 className="text-sm font-bold text-primary">Lesson library</h2>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by level">
                {LEVEL_FILTERS.map(({ key, label }) => (
                  <Pill key={key} active={level === key} onClick={() => setLevel(key)}>
                    {label}
                  </Pill>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by format">
                {FORMAT_FILTERS.map(({ key, label }) => {
                  const Icon = key === "all" ? Headphones : FORMAT_ICON[key];
                  return (
                    <Pill key={key} active={format === key} onClick={() => setFormat(key)}>
                      <span className="inline-flex items-center gap-1">
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {label}
                      </span>
                    </Pill>
                  );
                })}
              </div>
            </div>

            {library.length === 0 ? (
              <div className="space-y-2 rounded-panel border border-border-subtle bg-surface p-16 text-center">
                <Headphones className="mx-auto h-8 w-8 text-text-muted" />
                <p className="text-xs text-text-muted">No lessons match these filters yet — try another one.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {library.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} highlight={recommended?.lesson_id === lesson.id} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
