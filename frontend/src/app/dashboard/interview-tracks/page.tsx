"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Lock, CheckCircle2, XCircle, PlayCircle, Award } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TrackPipeline, TrackPipelineRound } from "@/types/interviewTrack";

/**
 * A candidate's "Final Interview" pipeline overview — 3 rounds, each
 * locked/unlocked/in-progress/completed based on InterviewTrackController::show().
 * Taking a round itself reuses the existing, unchanged
 * /dashboard/interviews/view?slug= -> /session voice-taking flow: a round IS
 * a plain Interview under the hood.
 */
export default function InterviewTrackPipelinePage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <InterviewTrackPipelinePageContent />
    </Suspense>
  );
}

function InterviewTrackPipelinePageContent() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const [pipeline, setPipeline] = useState<TrackPipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<TrackPipeline>(`/interview-tracks/${slug}`)
      .then(setPipeline)
      .catch((err) => setError(err instanceof ApiError ? err.message : "This Final Interview isn't available."))
      .finally(() => setLoading(false));
  }, [status, slug]);

  if (status !== "ready") return <SessionLoader />;

  const sortedRounds = pipeline ? pipeline.rounds.slice().sort((a, b) => a.round_number - b.round_number) : [];
  const reviewedCount = sortedRounds.filter((r) => r.composite_score_percent != null).length;

  return (
    <DashboardShell role="user" title="Final Interview">
      <Link href="/dashboard/interviews" className="inline-flex items-center gap-1.5 text-2xs font-semibold text-accent-primary hover:underline mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Interviews
      </Link>

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : error || !pipeline ? (
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle">
          {error ?? "This Final Interview isn't available."}
        </div>
      ) : (
        <div className="max-w-2xl space-y-5">
          <div className="p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3">
            <h1 className="text-lg font-bold text-primary">{pipeline.track.title}</h1>
            {pipeline.track.role_title && <p className="text-xs text-text-muted">{pipeline.track.role_title}</p>}
            {pipeline.track.description && <p className="text-sm text-text-secondary leading-relaxed">{pipeline.track.description}</p>}

            <div className="pt-2 border-t border-border-subtle space-y-1.5">
              <div className="flex items-center justify-between text-2xs font-semibold text-text-muted">
                <span>{reviewedCount} of {sortedRounds.length} rounds complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                {sortedRounds.map((r) => (
                  <div
                    key={r.round_number}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors duration-500",
                      r.composite_score_percent != null ? (r.passed ? "bg-status-success" : "bg-status-danger") : r.locked ? "bg-elevated" : "bg-accent-primary"
                    )}
                  />
                ))}
              </div>
            </div>

            <p className="text-2xs text-text-muted">
              A 3-round pipeline — each round unlocks once a reviewer scores your previous round and you clear its
              qualifying threshold.
            </p>
          </div>

          <div>
            {sortedRounds.map((round, i) => (
              <RoundRow key={round.round_number} round={round} isLast={i === sortedRounds.length - 1} />
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function RoundRow({ round, isLast }: { round: TrackPipelineRound; isLast: boolean }) {
  const isCompleted = round.my_session_status === "completed";
  const isReviewed = round.composite_score_percent != null;
  const passed = isReviewed && round.passed;

  return (
    <div className="flex gap-3.5">
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 z-10 bg-surface",
            round.locked
              ? "text-text-muted border-border-subtle"
              : isReviewed
              ? passed
                ? "text-status-success border-status-success"
                : "text-status-danger border-status-danger"
              : "text-accent-primary border-accent-primary"
          )}
        >
          {round.locked ? (
            <Lock className="w-3.5 h-3.5" />
          ) : isReviewed ? (
            passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />
          ) : (
            <span className="text-xs font-bold">{round.round_number}</span>
          )}
        </div>
        {!isLast && (
          <div
            className={cn("w-0.5 flex-1 my-0.5 rounded-full", isReviewed && passed ? "bg-status-success" : "bg-border-subtle")}
            style={{ minHeight: 28 }}
          />
        )}
      </div>

      <div
        className={cn(
          "flex-1 mb-3 p-4 rounded-panel border shadow-subtle flex items-center justify-between gap-4",
          round.locked ? "bg-elevated/40 border-border-subtle opacity-70" : "bg-surface border-border-subtle"
        )}
      >
        <div className="min-w-0">
          <div className="text-sm font-bold text-primary">
            Round {round.round_number} — {round.round_name}
          </div>
          <div className="text-2xs text-text-muted mt-0.5">
            {round.question_count} questions · qualifying score {round.qualifying_score_percent}%
            {isReviewed && (
              <>
                {" "}
                ·{" "}
                <span className={cn("font-bold", passed ? "text-status-success" : "text-status-danger")}>
                  {round.composite_score_percent!.toFixed(1)}% {passed ? "— passed" : "— not cleared"}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {round.locked ? (
            <span className="text-[10.5px] text-text-muted italic">Locked</span>
          ) : isCompleted ? (
            isReviewed ? (
              <span className="flex items-center gap-1 text-[10.5px] font-bold text-text-muted">
                <Award className="w-3.5 h-3.5" />
                Reviewed
              </span>
            ) : (
              <span className="text-[10.5px] text-text-muted italic">Awaiting review</span>
            )
          ) : (
            <Link
              href={`/dashboard/interviews/view?slug=${round.interview_slug}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {round.my_session_status === "in_progress" ? "Continue" : "Start"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
