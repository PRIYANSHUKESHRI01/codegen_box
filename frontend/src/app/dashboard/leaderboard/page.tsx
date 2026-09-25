"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Scope = "global" | "college";

interface LeaderboardRow {
  rank: number;
  user: { id: number; name: string; handle: string };
  solved_score: number;
  display_rating: string;
}

interface LeaderboardResponse {
  scope: Scope;
  leaderboard: LeaderboardRow[];
  my_rank: number | null;
  my_row: LeaderboardRow | null;
}

const RANK_MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function LeaderboardPage() {
  const { user, status } = useAuthGuard();
  const [scope, setScope] = useState<Scope>("global");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "ready") return;
    setLoading(true);
    api
      .get<LeaderboardResponse>(`/leaderboard?scope=${scope}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [status, scope]);

  if (status !== "ready" || !user) {
    return (
      <SessionLoader />
    );
  }

  return (
    <DashboardShell
      role={user.role}
      currentTpoView={user.role === "admin_tpo" ? "tpo" : "mellow"}
      title="Leaderboard"
      subtitle="Ranked by a real, difficulty-weighted score from every student's actual accepted submissions."
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
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

        <div className="text-xs font-mono text-text-muted flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          Updated live from every accepted submission
        </div>
      </div>

      {data?.my_row && (
        <div className="p-4 rounded-panel bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-black font-mono text-accent-primary">#{data.my_row.rank}</span>
            <div>
              <div className="text-sm font-bold text-primary">You</div>
              <div className="text-[11px] text-text-muted font-mono">{data.my_row.user.handle}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Score</div>
              <div className="font-mono font-bold text-primary">{data.my_row.solved_score}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Rating</div>
              <div className="font-mono font-bold text-primary">{data.my_row.display_rating}</div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-elevated/80 border-b border-border-subtle text-[11px] font-mono uppercase tracking-wider text-text-muted">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Coder</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4 text-right">Solved Score</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-xs text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                    Loading...
                  </td>
                </tr>
              ) : !data || data.leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-xs text-text-muted">
                    No ranked students yet.
                  </td>
                </tr>
              ) : (
                data.leaderboard.map((row) => (
                  <tr
                    key={row.user.id}
                    className={cn(
                      "border-b border-border-subtle hover:bg-surface-hover/80 transition-colors",
                      row.user.id === user.id && "bg-accent-primary/5"
                    )}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-sm whitespace-nowrap">
                      {RANK_MEDAL[row.rank] ?? `#${row.rank}`}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-primary text-sm">{row.user.name}</div>
                      <div className="text-xs font-mono text-text-muted">@{row.user.handle}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-sm whitespace-nowrap">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded border",
                          row.display_rating === "Unrated"
                            ? "text-text-muted bg-elevated border-border-subtle"
                            : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                        )}
                      >
                        {row.display_rating}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-xs text-primary whitespace-nowrap text-right">
                      {row.solved_score} pts
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.leaderboard.length > 0 && (
          <div className="p-4 bg-surface border-t border-border-subtle text-xs text-text-muted font-mono">
            Showing top {data.leaderboard.length} ranked student{data.leaderboard.length === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
