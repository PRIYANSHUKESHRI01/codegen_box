"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords, CheckCircle2, Trophy, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
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
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading contests...
        </div>
      ) : contests.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No contests scheduled right now — check back soon.
        </div>
      ) : (
        <div className="space-y-8">
          {live.length > 0 && <ContestSection title="Live Now" contests={live} accent="danger" />}
          {upcoming.length > 0 && <ContestSection title="Upcoming" contests={upcoming} accent="primary" />}
          {ended.length > 0 && <ContestSection title="Past Contests" contests={ended} accent="muted" />}
        </div>
      )}
    </DashboardShell>
  );
}

function ContestSection({
  title,
  contests,
  accent,
}: {
  title: string;
  contests: ContestSummary[];
  accent: "danger" | "primary" | "muted";
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-primary flex items-center gap-2">
        {accent === "danger" && <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" />}
        <span>{title}</span>
        <span className="text-xs font-normal text-text-muted">({contests.length})</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {contests.map((contest) => {
          const minutesFromNow = Math.round((new Date(contest.start_at).getTime() - Date.now()) / 60000);
          const minutesToEnd = Math.round((new Date(contest.end_at).getTime() - Date.now()) / 60000);

          return (
            <Link
              key={contest.id}
              href={`/dashboard/contests/view?slug=${contest.slug}`}
              className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle hover:border-border-strong hover:-translate-y-1 hover:shadow-card transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-10 h-10 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                  <Swords className="w-5 h-5" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  {contest.contest_type === "daily" && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-sky-500/10 text-sky-400 border border-sky-500/25">
                      Daily
                    </span>
                  )}
                  {contest.company && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-accent-secondary/10 text-accent-secondary border border-accent-secondary/25">
                      {contest.company.name}
                    </span>
                  )}
                  {contest.contest_type === "tpo_mock" && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
                      Mock
                    </span>
                  )}
                  {contest.is_rated && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/10 text-amber-500 border border-amber-500/25">
                      Rated
                    </span>
                  )}
                  {contest.is_registered && (
                    <span className="text-[9px] font-bold text-status-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Registered
                    </span>
                  )}
                </div>
              </div>

              <h3 className="text-sm font-bold text-primary leading-snug">{contest.title}</h3>
              {contest.description && (
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{contest.description}</p>
              )}

              <div className="flex items-center justify-between text-[11px] text-text-muted mt-auto pt-2 border-t border-border-subtle">
                <span>
                  {contest.problem_count} problems · {contest.total_points} pts
                </span>
                {contest.has_ended ? (
                  <span className={cn("font-semibold", contest.is_finalized ? "text-status-success" : "text-text-muted")}>
                    {contest.is_finalized ? "Results in" : "Ended"}
                  </span>
                ) : contest.has_started ? (
                  <CountdownTimer minutesFromNow={minutesToEnd} compact className="text-status-danger font-bold" />
                ) : (
                  <CountdownTimer minutesFromNow={minutesFromNow} compact className="text-accent-primary font-bold" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
