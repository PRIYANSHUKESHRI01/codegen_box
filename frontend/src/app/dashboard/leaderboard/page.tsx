"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { DailyChallengeBoard } from "@/components/contests/DailyChallenge";
import { WeeklyRewardsBanner } from "@/components/leaderboard/WeeklyRewardsBanner";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ContestBoardResponse, ContestBoardRow } from "@/types/weeklyRewards";

type Scope = "global" | "college";
// "weekly" and "all_time" are the contest-score boards; "daily" is the AptRun Daily Challenge's top students and the rating ladder.
type Board = "weekly" | "all_time" | "daily";

const BOARDS: [Board, string][] = [
  ["weekly", "This week"],
  ["all_time", "All time"],
  ["daily", "Daily Challenge"],
];

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LeaderboardPage() {
  const { user, status } = useAuthGuard();
  const [scope, setScope] = useState<Scope>("global");
  const [board, setBoard] = useState<Board>("weekly");
  const [data, setData] = useState<ContestBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // The Contests page links straight to the Daily Challenge board (?board=daily).
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("board");
    if (wanted === "daily" || wanted === "all_time" || wanted === "weekly") setBoard(wanted);
  }, []);

  useEffect(() => {
    if (status !== "ready" || board === "daily") return;
    setLoading(true);
    api
      .get<ContestBoardResponse>(`/leaderboard?period=${board}&scope=${scope}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [status, scope, board]);

  if (status !== "ready" || !user) {
    return (
      <SessionLoader />
    );
  }

  const subtitle =
    board === "daily"
      ? "Top students of the AptRun Daily Challenge, and the rating every rated contest builds."
      : board === "weekly"
        ? "Contest points earned this week — the board starts again from zero every Monday."
        : "Every contest point a student has ever earned, all-time.";

  return (
    <DashboardShell
      role={user.role}
      currentTpoView={user.role === "admin_tpo" ? "tpo" : "mellow"}
      title="Leaderboard"
      subtitle={subtitle}
    >
      {board === "weekly" && scope === "global" && <WeeklyRewardsBanner variant="full" />}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex max-w-full overflow-x-auto p-1 rounded-control bg-surface border border-border-subtle shadow-subtle" role="tablist" aria-label="Leaderboard">
            {BOARDS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={board === key}
                onClick={() => setBoard(key)}
                className={cn(
                  "px-3.5 py-1.5 rounded-[7px] text-xs font-medium transition-all font-mono whitespace-nowrap",
                  board === key ? "bg-accent-primary text-white font-bold shadow-sm" : "text-text-muted hover:text-primary hover:bg-surface-hover"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="inline-flex max-w-full overflow-x-auto p-1 rounded-control bg-surface border border-border-subtle shadow-subtle">
            <button
              type="button"
              onClick={() => setScope("global")}
              className={cn(
                "px-3.5 py-1.5 rounded-[7px] text-xs font-medium transition-all font-mono whitespace-nowrap",
                scope === "global"
                  ? "bg-elevated text-primary border border-border-strong font-bold shadow-sm"
                  : "text-text-muted hover:text-primary hover:bg-surface-hover"
              )}
            >
              Global
            </button>
            {user.college && (
              <button
                type="button"
                onClick={() => setScope("college")}
                className={cn(
                  "px-3.5 py-1.5 rounded-[7px] text-xs font-medium transition-all font-mono whitespace-nowrap",
                  scope === "college"
                    ? "bg-elevated text-primary border border-border-strong font-bold shadow-sm"
                    : "text-text-muted hover:text-primary hover:bg-surface-hover"
                )}
              >
                My College
              </button>
            )}
          </div>
        </div>

        <div className="text-xs font-mono text-text-muted flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          {board === "weekly" && data?.week ? (
            <>
              Resets in <CountdownTimer minutesFromNow={(new Date(data.week.resets_at).getTime() - Date.now()) / 60000} compact className="font-bold text-primary" />
            </>
          ) : board === "daily" ? (
            "Updated live while the contest runs"
          ) : (
            "Contest scores only — updated as contests are scored"
          )}
        </div>
      </div>

      {board === "daily" ? (
        <DailyChallengeBoard scope={scope} userId={user.id} />
      ) : (
        <>
          {data?.my_row && (
            <div className="p-4 rounded-panel bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-lg font-black font-mono text-accent-primary">#{data.my_row.rank}</span>
                <div>
                  <div className="text-sm font-bold text-primary">You</div>
                  <div className="text-2xs text-text-muted font-mono">{data.my_row.user.handle}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <div className="text-3xs text-text-muted uppercase tracking-wider">Contest score</div>
                  <div className="font-mono font-bold text-primary">{data.my_row.contest_score}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xs text-text-muted uppercase tracking-wider">Rating</div>
                  <div className="font-mono font-bold text-primary">{data.my_row.display_rating}</div>
                </div>
              </div>
            </div>
          )}

          <BoardTable data={data} loading={loading} userId={user.id} board={board} />
        </>
      )}
    </DashboardShell>
  );
}

function BoardTable({ data, loading, userId, board }: { data: ContestBoardResponse | null; loading: boolean; userId: number; board: Board }) {
  const hasPrizes = (data?.prizes.length ?? 0) > 0;
  const cols = hasPrizes ? 6 : 5;

  return (
    <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-elevated/80 border-b border-border-subtle text-2xs font-mono uppercase tracking-wider text-text-muted">
              <th className="py-3 px-4">Rank</th>
              <th className="py-3 px-4">Coder</th>
              {hasPrizes && <th className="py-3 px-4">Prize</th>}
              <th className="py-3 px-4">Rating</th>
              <th className="py-3 px-4 text-right">Contests</th>
              <th className="py-3 px-4 text-right">Contest score</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={cols} className="py-10 text-center text-xs text-text-muted">
                  <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                  Loading...
                </td>
              </tr>
            ) : !data || data.leaderboard.length === 0 ? (
              <tr>
                <td colSpan={cols} className="py-10 text-center text-xs text-text-muted">
                  {board === "weekly" ? "Nobody has scored in a contest this week yet — be the first on the board." : "No ranked students yet."}
                </td>
              </tr>
            ) : (
              data.leaderboard.map((row) => <BoardRow key={row.user.id} row={row} mine={row.user.id === userId} hasPrizes={hasPrizes} />)
            )}
          </tbody>
        </table>
      </div>

      {data && data.leaderboard.length > 0 && (
        <div className="p-4 bg-surface border-t border-border-subtle text-xs text-text-muted font-mono">
          Showing top {data.leaderboard.length} of {data.total} ranked student{data.total === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

function BoardRow({ row, mine, hasPrizes }: { row: ContestBoardRow; mine: boolean; hasPrizes: boolean }) {
  return (
    <tr className={cn("border-b border-border-subtle hover:bg-surface-hover/80 transition-colors", mine && "bg-accent-primary/5")}>
      <td className="py-3.5 px-4 font-mono font-bold text-xl whitespace-nowrap">{RANK_MEDAL[row.rank] ?? `#${row.rank}`}</td>
      <td className="py-3.5 px-4">
        <div className="font-bold text-primary text-sm">{row.user.name}</div>
        <div className="text-xs font-mono text-text-muted">@{row.user.handle}</div>
      </td>
      {hasPrizes && (
        <td className="py-3.5 px-4">
          {row.prize && (
            <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full py-0.5 pl-0.5 pr-2.5 text-2xs font-bold text-white" style={{ background: row.prize.color }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image's optimiser is unavailable */}
              <img src={row.prize.logo} alt="" width={20} height={20} draggable={false} className="h-5 w-5 rounded-full bg-white object-contain p-0.5" />
              {row.prize.brand} ₹{row.prize.amount}
            </span>
          )}
        </td>
      )}
      <td className="py-3.5 px-4 font-mono font-bold text-sm whitespace-nowrap">
        <span
          className={cn(
            "px-2 py-0.5 rounded border",
            row.display_rating === "Unrated" ? "text-text-muted bg-elevated border-border-subtle" : "text-amber-400 bg-amber-500/10 border-amber-500/20"
          )}
        >
          {row.display_rating}
        </span>
      </td>
      <td className="py-3.5 px-4 font-mono text-xs text-text-secondary whitespace-nowrap text-right">{row.contests_played}</td>
      <td className="py-3.5 px-4 font-mono font-bold text-xs text-primary whitespace-nowrap text-right">{row.contest_score} pts</td>
    </tr>
  );
}
