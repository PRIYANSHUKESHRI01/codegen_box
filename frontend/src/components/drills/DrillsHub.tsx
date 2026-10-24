"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck2, Flame, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MasteryMeter } from "@/components/drills/MasteryMeter";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { getSkill, isPackForBranch, packsForBranch } from "@/lib/drills/catalog";
import { accuracyPercent, masteryFrom } from "@/lib/drills/mastery";
import { REASON_TEXT, recommendNext } from "@/lib/drills/recommend";
import { useDrillSummary } from "@/lib/drills/useDrillSummary";
import type { DrillSummary } from "@/lib/drills/api";
import type { PackDef, SkillDef } from "@/lib/drills/types";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { cn } from "@/lib/utils";

/** Skill Drills home: your streak, what to practise next, and every skill in the order that suits your branch. */
export function DrillsHub() {
  const { user, status } = useAuthGuard(["user"]);
  const { summary, error, reload } = useDrillSummary(status === "ready");

  // `summary` is null until the first load lands (the hook only starts once the student is signed in), and is never null after it —
  // an empty one stands in if the request fails. Waiting on it, not on `loading`, is what keeps the first render from touching null.
  if (status !== "ready" || !summary) return <SessionLoader />;

  const discipline = user?.discipline ?? null;
  const packs = packsForBranch(discipline);
  const data = summary;
  const recommended = recommendNext(data, packs[0].id);
  const recommendedSkill = recommended ? getSkill(recommended.skill) : undefined;

  return (
    <DashboardShell role="user" title="Skill Drills" subtitle="Short, unlimited practice with instant feedback — a fresh question every time.">
      {error && (
        <div role="alert" className="mb-5 rounded-control border border-status-warning/30 bg-status-warning/10 px-4 py-2.5 text-xs text-text-secondary">
          {error}{" "}
          <button type="button" onClick={() => void reload()} className="font-bold text-accent-primary underline">
            Try again
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <StreakCard summary={data} />
        {recommended && recommendedSkill && (
          <section aria-label="Up next" className="flex flex-col justify-between rounded-panel border border-accent-primary/25 bg-gradient-to-r from-accent-primary/[0.08] to-transparent p-5">
            <div>
              <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-accent-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Up next
              </p>
              <h2 className="mt-1.5 text-lg font-extrabold text-primary">{recommendedSkill.title}</h2>
              <p className="mt-0.5 text-xs text-text-secondary">
                {REASON_TEXT[recommended.reason]}. {recommendedSkill.blurb}
              </p>
            </div>
            <Link
              href={`/dashboard/drills/session?skill=${recommendedSkill.id}`}
              className="mt-4 inline-flex w-fit items-center gap-2 rounded-control bg-accent-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-accent-primary-hover"
            >
              Practise this <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </section>
        )}
      </div>

      <div className="mt-8 space-y-9">
        {packs.map((pack) => (
          <PackSection key={pack.id} pack={pack} summary={data} forYou={isPackForBranch(pack, discipline)} />
        ))}
      </div>

      <p className="mt-9 text-2xs leading-relaxed text-text-muted">
        Drills are practice, not tests: they build your streak and your mastery of each skill. Each sitting is proctored (camera on, fullscreen), and none of it changes your readiness score.
      </p>
    </DashboardShell>
  );
}

function StreakCard({ summary }: { summary: DrillSummary }) {
  const { streak, week } = summary;
  const keep = streak.current > 0 && !streak.active_today;

  return (
    <section aria-label="Your streak" className="rounded-panel border border-border-subtle bg-surface p-5">
      <div className="flex items-center gap-3.5">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", streak.current > 0 ? "bg-status-warning/15 text-status-warning" : "bg-elevated text-text-muted")}>
          <Flame className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-2xl font-black leading-none text-primary">
            {streak.current}
            <span className="ml-1.5 text-sm font-bold text-text-secondary">day streak</span>
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            {streak.current === 0
              ? "Answer one question today to start a streak."
              : keep
                ? `Practise today to keep it going${streak.best > streak.current ? ` · best ${streak.best}` : ""}.`
                : streak.best > streak.current
                  ? `You've practised today · best ${streak.best}`
                  : "You've practised today — that's your best run yet."}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle pt-3.5 text-xs">
        <div>
          <dt className="text-text-muted">Answered today</dt>
          <dd className="mt-0.5 text-sm font-extrabold text-primary">{streak.today}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-text-muted">
            <CalendarCheck2 className="h-3 w-3" aria-hidden /> This week
          </dt>
          <dd className="mt-0.5 text-sm font-extrabold text-primary">
            {week.attempts} answers · {week.days} {week.days === 1 ? "day" : "days"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function PackSection({ pack, summary, forYou }: { pack: PackDef; summary: DrillSummary; forYou: boolean }) {
  return (
    <section aria-labelledby={`pack-${pack.id}`}>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={`pack-${pack.id}`} className="text-base font-extrabold text-primary">
          {pack.title}
        </h2>
        {forYou && <span className="rounded-full bg-accent-primary/10 px-2 py-0.5 text-2xs font-bold text-accent-primary">For your branch</span>}
      </div>
      <p className="mb-3.5 text-xs text-text-secondary">{pack.blurb}</p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pack.skills.map((skill) => (
          <li key={skill.id}>
            <SkillCard skill={skill} stats={summary.skills[skill.id]} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SkillCard({ skill, stats }: { skill: SkillDef; stats: DrillSummary["skills"][string] | undefined }) {
  const mastery = masteryFrom(stats?.recent ?? []);
  const accuracy = stats ? accuracyPercent(stats.recent) : null;

  return (
    <Link
      href={`/dashboard/drills/session?skill=${skill.id}`}
      className="group flex h-full flex-col rounded-panel border border-border-subtle bg-surface p-4 transition-colors hover:border-accent-primary/50 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-extrabold text-primary">{skill.title}</h3>
        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent-primary" aria-hidden />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">{skill.blurb}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-3.5">
        <MasteryMeter mastery={mastery} />
        {stats && <span className="text-2xs text-text-muted">{`${stats.attempts} answered${accuracy !== null ? ` · ${accuracy}% recent` : ""}`}</span>}
      </div>
    </Link>
  );
}
