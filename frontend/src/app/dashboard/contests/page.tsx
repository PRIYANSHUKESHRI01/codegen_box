"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, CheckCircle2, Trophy, Radio, CalendarClock, History } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { HpCard, HpEmptyState, HpIconTile, HpPill, HpSectionHeader, HpSkeletonCards, hpBtn, type HpTone } from "@/components/portal/kit";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ContestSummary } from "@/types/liveContest";

export default function ContestsListPage() {
  const { status } = useAuthGuard(["user"]);
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<{ contests: ContestSummary[] }>("/contests")
      .then((res) => setContests(res.contests))
      .catch(() => setContests([]))
      .finally(() => setLoading(false));
  }, [status]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const live = contests.filter((c) => c.has_started && !c.has_ended);
  const upcoming = contests.filter((c) => !c.has_started).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const ended = contests.filter((c) => c.has_ended).sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

  return (
    <DashboardShell
      role="user"
      title="Contests"
      subtitle="Real, timed, rated rounds — your rating moves based on how you actually place."
    >
      {loading ? (
        <HpSkeletonCards count={3} />
      ) : contests.length === 0 ? (
        <HpEmptyState
          icon={Swords}
          tone="indigo"
          title="No contests scheduled right now"
          description="Rated rounds appear here as soon as they are scheduled. Keep your streak going in the Practice Arena while you wait."
          action={
            <Link href="/dashboard/practice" className={hpBtn("primary", "md")}>
              Open Practice Arena
            </Link>
          }
        />
      ) : (
        <div className="space-y-10">
          {live.length > 0 && <ContestSection title="Live now" subtitle="Happening right now — jump in before it ends" icon={Radio} tone="rose" contests={live} accent="danger" />}
          {upcoming.length > 0 && <ContestSection title="Upcoming" subtitle="Register early so you are ready at the start" icon={CalendarClock} tone="indigo" contests={upcoming} accent="primary" />}
          {ended.length > 0 && <ContestSection title="Past contests" subtitle="Results and standings" icon={History} tone="slate" contests={ended} accent="muted" />}
        </div>
      )}
    </DashboardShell>
  );
}

function ContestSection({
  title,
  subtitle,
  icon,
  tone,
  contests,
  accent,
}: {
  title: string;
  subtitle: string;
  icon: typeof Trophy;
  tone: HpTone;
  contests: ContestSummary[];
  accent: "danger" | "primary" | "muted";
}) {
  return (
    <section className="space-y-4">
      <HpSectionHeader
        icon={icon}
        tone={tone}
        title={
          <span className="flex items-center gap-2">
            {title}
            <HpPill tone={tone} size="sm">
              {contests.length}
            </HpPill>
          </span>
        }
        subtitle={subtitle}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contests.map((contest) => {
          const minutesFromNow = Math.round((new Date(contest.start_at).getTime() - Date.now()) / 60000);
          const minutesToEnd = Math.round((new Date(contest.end_at).getTime() - Date.now()) / 60000);

          return (
            <Link
              key={contest.id}
              href={`/dashboard/contests/view?slug=${contest.slug}`}
              className="group block h-full rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <HpCard interactive className="relative flex h-full flex-col gap-3 overflow-hidden p-5">
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 top-0 h-[3px] origin-left bg-gradient-to-r transition-transform duration-500 ease-out motion-reduce:transition-none",
                    accent === "danger" ? "scale-x-100 from-rose-500 to-orange-400" : "scale-x-0 from-indigo-500 via-violet-500 to-sky-400 group-hover:scale-x-100"
                  )}
                />

                <div className="flex items-start justify-between gap-2">
                  <HpIconTile icon={Swords} tone={accent === "danger" ? "rose" : accent === "muted" ? "slate" : "indigo"} size="lg" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
                  <div className="flex flex-col items-end gap-1.5">
                    {contest.contest_type === "daily" && <HpPill tone="sky" size="sm">Daily</HpPill>}
                    {contest.company && <HpPill tone="violet" size="sm">{contest.company.name}</HpPill>}
                    {contest.contest_type === "tpo_mock" && <HpPill tone="teal" size="sm">Mock</HpPill>}
                    {contest.is_rated && <HpPill tone="amber" size="sm">Rated</HpPill>}
                    {contest.is_registered && (
                      <HpPill tone="emerald" size="sm" icon={CheckCircle2}>
                        Registered
                      </HpPill>
                    )}
                  </div>
                </div>

                <h3 className="text-15 font-bold leading-snug tracking-tight text-primary transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{contest.title}</h3>
                {contest.description && <p className="line-clamp-2 text-xs leading-relaxed text-text-secondary">{contest.description}</p>}

                <div className="mt-auto flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-text-muted">
                  <span>
                    {contest.problem_count} problems · {contest.total_points} pts
                  </span>
                  {contest.has_ended ? (
                    <span className={cn("font-semibold", contest.is_finalized ? "text-emerald-600 dark:text-emerald-300" : "text-text-muted")}>
                      {contest.is_finalized ? "Results in" : "Ended"}
                    </span>
                  ) : contest.has_started ? (
                    <CountdownTimer minutesFromNow={minutesToEnd} compact className="font-bold text-rose-600 dark:text-rose-300" />
                  ) : (
                    <CountdownTimer minutesFromNow={minutesFromNow} compact className="font-bold text-indigo-600 dark:text-indigo-300" />
                  )}
                </div>
              </HpCard>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
