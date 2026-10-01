"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Swords, Trophy, CheckCircle2, ArrowRight, Loader2, Lock } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ContestDetail, ContestLeaderboard } from "@/types/liveContest";

type Tab = "problems" | "leaderboard";

export default function ContestDetailPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <ContestDetailPageContent />
    </Suspense>
  );
}

function ContestDetailPageContent() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const router = useRouter();

  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not_found">("loading");
  const [tab, setTab] = useState<Tab>("problems");
  const [leaderboard, setLeaderboard] = useState<ContestLeaderboard | null>(null);
  const [registering, setRegistering] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadContest = () => {
    api
      .get<ContestDetail>(`/contests/${slug}`)
      .then((res) => {
        setContest(res);
        setLoadState("ready");
      })
      .catch((err) => {
        setLoadState(err instanceof ApiError && err.status === 404 ? "not_found" : "ready");
      });
  };

  useEffect(() => {
    if (status !== "ready" || !slug) return;
    loadContest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slug]);

  useEffect(() => {
    if (tab !== "leaderboard" || !slug) return;
    api
      .get<ContestLeaderboard>(`/contests/${slug}/leaderboard`)
      .then(setLeaderboard)
      .catch(() => setLeaderboard(null));
  }, [tab, slug]);

  if (status !== "ready" || loadState === "loading") {
    return <SessionLoader label={status !== "ready" ? undefined : "Loading contest..."} />;
  }

  if (loadState === "not_found" || !contest) {
    return (
      <DashboardShell role="user" title="Contest not found">
        <div className="p-10 text-center text-sm text-text-muted">
          This contest doesn&apos;t exist or isn&apos;t published.{" "}
          <Link href="/dashboard/contests" className="text-accent-primary hover:underline">
            Back to contests
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const handleRegister = async () => {
    setRegistering(true);
    try {
      await api.post(`/contests/${contest.slug}/register`);
      triggerToast("You're registered!");
      loadContest();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to register.");
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregister = async () => {
    setRegistering(true);
    try {
      await api.delete(`/contests/${contest.slug}/register`);
      triggerToast("Unregistered.");
      loadContest();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to unregister.");
    } finally {
      setRegistering(false);
    }
  };

  const minutesFromNow = Math.round((new Date(contest.start_at).getTime() - Date.now()) / 60000);
  const minutesToEnd = Math.round((new Date(contest.end_at).getTime() - Date.now()) / 60000);

  return (
    <DashboardShell role="user" title={contest.title} subtitle={contest.description ?? undefined}>
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {/* Header card */}
      <div className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-panel bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
            <Swords className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {contest.is_rated && (
                <span className="px-2 py-0.5 text-3xs font-bold uppercase rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/25">
                  Rated
                </span>
              )}
              <span className="text-xs text-text-muted">
                {contest.problem_count} problems · {contest.total_points} points
              </span>
            </div>
            <div className="text-xs text-text-muted">
              {new Date(contest.start_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              {" – "}
              {new Date(contest.end_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit" })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!contest.has_ended && (
            <div className="text-center">
              <span className="text-3xs uppercase tracking-wider text-text-muted font-semibold block mb-1">
                {contest.has_started ? "Ends in" : "Starts in"}
              </span>
              <CountdownTimer minutesFromNow={contest.has_started ? minutesToEnd : minutesFromNow} />
            </div>
          )}

          {contest.is_registered ? (
            contest.has_started && !contest.has_ended ? (
              // The one thing a registered student actually needs once the
              // contest goes live: a single obvious way in, instead of
              // having to scroll to the problem list and pick a row
              // themselves. Jumps to the first problem by display_order —
              // same one the problems tab lists first.
              contest.problems && contest.problems.length > 0 && (
                <button
                  onClick={() =>
                    router.push(`/dashboard/contests/problem?slug=${contest.slug}&contestProblemId=${contest.problems![0].id}`)
                  }
                  className="px-5 py-2.5 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>Start Contest</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )
            ) : (
              // Backend only allows unregistering before start — once
              // live, the register/unregister action disappears entirely
              // rather than offering a button that would just 422.
              !contest.has_started && (
                <button
                  onClick={handleUnregister}
                  disabled={registering}
                  className="px-4 py-2.5 rounded-btn bg-elevated hover:bg-surface-hover border border-border-strong text-xs font-bold text-primary transition-all disabled:opacity-60"
                >
                  {registering ? "..." : "Unregister"}
                </button>
              )
            )
          ) : (
            !contest.has_ended && (
              // Registration stays open through the whole live window
              // (backend allows it any time before end_at), not just
              // before start.
              <button
                onClick={handleRegister}
                disabled={registering}
                className="px-4 py-2.5 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow disabled:opacity-60 flex items-center gap-1.5"
              >
                {registering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Register</span>}
              </button>
            )
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-btn bg-surface border border-border-subtle shadow-subtle w-fit">
        {(["problems", "leaderboard"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 rounded-control text-xs font-bold capitalize transition-all",
              tab === t ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "problems" ? (
        !contest.has_started ? (
          <div className="p-10 rounded-panel bg-surface border border-border-subtle text-center space-y-2">
            <Lock className="w-6 h-6 text-text-muted mx-auto" />
            <p className="text-sm text-text-secondary">
              Problems are hidden until the contest starts — register now so you&apos;re ready.
            </p>
          </div>
        ) : (
          <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden divide-y divide-border-subtle">
            {contest.problems?.map((cp) => (
              <button
                key={cp.id}
                onClick={() => router.push(`/dashboard/contests/problem?slug=${contest.slug}&contestProblemId=${cp.id}`)}
                disabled={!contest.has_started}
                className="w-full p-4 flex items-center justify-between gap-4 hover:bg-surface-hover/60 transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-3xs font-bold rounded capitalize shrink-0",
                      cp.problem.difficulty === "easy"
                        ? "bg-status-success/15 text-status-success"
                        : cp.problem.difficulty === "medium"
                        ? "bg-status-warning/15 text-status-warning"
                        : "bg-status-danger/15 text-status-danger"
                    )}
                  >
                    {cp.problem.difficulty}
                  </span>
                  <span className="text-sm font-semibold text-primary truncate">{cp.problem.title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono font-bold text-accent-primary">{cp.points} pts</span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted" />
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-elevated/80 border-b border-border-subtle text-2xs font-mono uppercase tracking-wider text-text-muted">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Coder</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Penalty</th>
                  {leaderboard?.is_finalized && <th className="py-3 px-4 text-right">Rating Δ</th>}
                </tr>
              </thead>
              <tbody>
                {!leaderboard || leaderboard.leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-text-muted">
                      No submissions yet.
                    </td>
                  </tr>
                ) : (
                  leaderboard.leaderboard.map((row) => (
                    <tr key={row.user.id} className="border-b border-border-subtle hover:bg-surface-hover/60">
                      <td className="py-3 px-4 font-mono font-bold text-sm">#{row.rank}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-primary text-sm">{row.user.name}</div>
                        <div className="text-2xs text-text-muted font-mono">@{row.user.handle}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-primary">{row.score}</td>
                      <td className="py-3 px-4 font-mono text-text-secondary">{row.penalty_minutes}m</td>
                      {leaderboard.is_finalized && (
                        <td className="py-3 px-4 text-right font-mono font-bold">
                          {row.rating_after !== null && row.rating_before !== null && (
                            <span className={cn(row.rating_after - row.rating_before >= 0 ? "text-status-success" : "text-status-danger")}>
                              {row.rating_after - row.rating_before >= 0 ? "+" : ""}
                              {row.rating_after - row.rating_before}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
