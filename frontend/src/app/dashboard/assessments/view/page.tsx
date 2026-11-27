"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  Loader2,
  Lock,
  Mic,
  RefreshCw,
  Sparkles,
  Trophy,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { StudentCollegeAssessment } from "@/types/collegeAssessment";

function AssessmentDetailContent() {
  const { status } = useAuthGuard(["user"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";

  const [assessment, setAssessment] = useState<StudentCollegeAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingModule, setStartingModule] = useState<"soft_skills" | "coding" | "interview" | null>(null);

  const load = useCallback(async () => {
    if (!slug) {
      setError("Assessment link is missing a valid identifier.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get<{ assessment: StudentCollegeAssessment }>(
        `/assessments/${encodeURIComponent(slug)}`
      );
      setAssessment(res.assessment);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load this assessment.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  const handleStartSoftSkill = async () => {
    if (!assessment) return;
    try {
      setStartingModule("soft_skills");
      const res = await api.post<{ soft_skill_slug: string }>(
        `/assessments/${encodeURIComponent(assessment.slug)}/start-soft-skill`
      );
      router.push(`/dashboard/soft-skills/session?slug=${encodeURIComponent(res.soft_skill_slug)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to start Soft Skills test.");
      setStartingModule(null);
    }
  };

  const handleStartCoding = async () => {
    if (!assessment) return;
    try {
      setStartingModule("coding");
      const res = await api.post<{ contest_slug: string }>(
        `/assessments/${encodeURIComponent(assessment.slug)}/start-coding`
      );
      router.push(`/dashboard/contests/view?slug=${encodeURIComponent(res.contest_slug)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to launch Coding Test.");
      setStartingModule(null);
    }
  };

  const handleStartInterview = async () => {
    if (!assessment) return;
    try {
      setStartingModule("interview");
      const res = await api.post<{ interview_slug: string }>(
        `/assessments/${encodeURIComponent(assessment.slug)}/start-interview`
      );
      router.push(`/dashboard/interviews/view?slug=${encodeURIComponent(res.interview_slug)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Unable to start AI Interview.");
      setStartingModule(null);
    }
  };

  if (status !== "ready" || loading) return <SessionLoader />;

  if (error || !assessment) {
    return (
      <DashboardShell role="user" title="Campus Assessment" subtitle="Assessment unavailable">
        <div className="rounded-panel border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-700">
          {error ?? "Assessment not found."}
        </div>
      </DashboardShell>
    );
  }

  const ss = assessment.modules.soft_skills;
  const coding = assessment.modules.coding;
  const iv = assessment.modules.interview;
  const passedOverall =
    assessment.overall_score_percent !== null &&
    assessment.overall_score_percent >= assessment.passing_score_percent;

  return (
    <DashboardShell
      role="user"
      title={assessment.title}
      subtitle={assessment.description ?? "Complete every enabled stage below to finalize your scorecard."}
    >
      <div className="space-y-6">
        {assessment.campaign_locked && assessment.campaign_lock_reason && (
          <div className="flex items-center gap-2.5 rounded-panel border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-800 dark:text-amber-200">
            <Lock className="h-4 w-4 shrink-0" />
            <span>{assessment.campaign_lock_reason}</span>
          </div>
        )}

        {/* Overall Scorecard Banner */}
        <div className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase",
                  assessment.assignment_status === "completed" && "bg-emerald-500/15 text-emerald-700",
                  assessment.assignment_status === "in_progress" && "bg-amber-500/15 text-amber-700",
                  assessment.assignment_status === "assigned" && "bg-primary/10 text-primary"
                )}
              >
                {assessment.assignment_status.replace("_", " ")}
              </span>
              {!assessment.is_open && (
                <span className="rounded-pill bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                  Window Closed / Upcoming
                </span>
              )}
              {assessment.enforce_sequence && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-text-secondary">
                  <Lock className="h-3 w-3" /> Complete rounds in sequence
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              {assessment.modules_completed} of {assessment.modules_total} rounds completed &middot; Passing Benchmark:{" "}
              <strong className="text-primary">{assessment.passing_score_percent}%</strong>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] font-bold uppercase text-text-muted">Overall Score</div>
              <div className="flex items-center gap-1.5 text-2xl font-extrabold text-primary">
                <Trophy className="h-5 w-5 text-amber-500" />
                {assessment.overall_score_percent !== null ? `${assessment.overall_score_percent}%` : "Pending"}
              </div>
              {assessment.overall_score_percent !== null && (
                <div className={cn("text-[11px] font-bold", passedOverall ? "text-emerald-600" : "text-amber-600")}>
                  {passedOverall ? "Qualified" : "Below Benchmark"}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle bg-surface-muted px-3 py-2 text-xs font-bold text-text-secondary hover:bg-surface-hover"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Sync Scores
            </button>
          </div>
        </div>

        {/* Stage Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {ss.enabled && (
            <div className="flex flex-col justify-between rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-700">
                    <Sparkles className="h-3.5 w-3.5" /> Soft Skills
                  </span>
                  <span className="text-xs font-bold text-text-muted">Weight: {ss.weight}%</span>
                </div>
                <h3 className="text-sm font-extrabold text-primary">{ss.title}</h3>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {ss.duration_minutes} mins
                  </span>
                  <span>Pass: {ss.pass_percentage}%</span>
                </div>
                {ss.completed && ss.score_percent !== null && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed: {ss.score_percent}%
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!assessment.is_open || !!assessment.campaign_locked || ss.locked || startingModule !== null}
                onClick={handleStartSoftSkill}
                className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {startingModule === "soft_skills" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : ss.locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                {ss.completed ? "View / Retake Soft Skills" : ss.in_progress ? "Resume Soft Skills" : "Start Soft Skills"}
              </button>
            </div>
          )}

          {coding.enabled && (
            <div className="flex flex-col justify-between rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-violet-500/10 px-2.5 py-1 text-xs font-bold text-violet-700">
                    <Code2 className="h-3.5 w-3.5" /> Coding Test
                  </span>
                  <span className="text-xs font-bold text-text-muted">Weight: {coding.weight}%</span>
                </div>
                <h3 className="text-sm font-extrabold text-primary">{coding.title}</h3>
                {coding.locked ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-surface-muted p-2.5 text-xs text-text-muted">
                    <Lock className="h-3.5 w-3.5" /> Complete Soft Skills first to unlock.
                  </div>
                ) : coding.score_percent !== null ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Best Score: {coding.score_percent}% ({coding.points ?? 0}/{coding.max_points ?? 0} pts)
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Solve coding challenges in the live timed contest runner.</p>
                )}
              </div>

              <button
                type="button"
                disabled={!assessment.is_open || !!assessment.campaign_locked || coding.locked || startingModule !== null}
                onClick={handleStartCoding}
                className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {startingModule === "coding" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : coding.locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                {coding.locked ? "Locked" : coding.completed || coding.in_progress ? "Open Coding Contest" : "Start Coding Test"}
              </button>
            </div>
          )}

          {iv.enabled && (
            <div className="flex flex-col justify-between rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <Mic className="h-3.5 w-3.5" /> AI Interview
                  </span>
                  <span className="text-xs font-bold text-text-muted">Weight: {iv.weight}%</span>
                </div>
                <h3 className="text-sm font-extrabold text-primary">{iv.title}</h3>
                {iv.locked ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-surface-muted p-2.5 text-xs text-text-muted">
                    <Lock className="h-3.5 w-3.5" /> Complete previous stage(s) first to unlock.
                  </div>
                ) : iv.completed ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 p-2.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    {iv.scoring_pending
                      ? "Submitted — AI evaluation in progress"
                      : `Completed: ${iv.score_percent ?? 0}%`}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">Voice-based AI technical &amp; HR interview round.</p>
                )}
              </div>

              <button
                type="button"
                disabled={!assessment.is_open || !!assessment.campaign_locked || iv.locked || startingModule !== null}
                onClick={handleStartInterview}
                className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {startingModule === "interview" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : iv.locked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                {iv.locked ? "Locked" : iv.completed ? "View AI Interview" : iv.in_progress ? "Resume AI Interview" : "Start AI Interview"}
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

export default function StudentAssessmentDetailPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <AssessmentDetailContent />
    </Suspense>
  );
}
