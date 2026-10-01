"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, CheckCircle2, Loader2, PlayCircle, Layers } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { UsageLimitBanner } from "@/components/billing/UsageLimitBanner";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StudentInterviewSummary } from "@/types/interview";
import type { StudentInterviewTrackSummary } from "@/types/interviewTrack";
import type { MySubscriptionResponse } from "@/types/subscription";

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  tpo_mock: { label: "Mock", className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25" },
  company: { label: "Company", className: "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/25" },
  company_hiring: { label: "Shortlisted", className: "bg-teal-500/10 text-teal-500 border-teal-500/25" },
};

export default function InterviewsListPage() {
  const { status } = useAuthGuard(["user"]);
  const [interviews, setInterviews] = useState<StudentInterviewSummary[]>([]);
  const [tracks, setTracks] = useState<StudentInterviewTrackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [entitlements, setEntitlements] = useState<MySubscriptionResponse["entitlements"]>(undefined);

  useEffect(() => {
    if (status !== "ready") return;
    Promise.all([
      api.get<{ interviews: StudentInterviewSummary[] }>("/interviews").catch(() => ({ interviews: [] })),
      api.get<{ tracks: StudentInterviewTrackSummary[] }>("/interview-tracks").catch(() => ({ tracks: [] })),
      api.get<MySubscriptionResponse>("/me/subscription").catch(() => ({ scope: "individual" as const, coverage: null, entitlements: undefined })),
    ])
      .then(([interviewsRes, tracksRes, subscriptionRes]) => {
        setInterviews(interviewsRes.interviews);
        setTracks(tracksRes.tracks);
        setEntitlements(subscriptionRes.entitlements);
      })
      .finally(() => setLoading(false));
  }, [status]);

  if (status !== "ready") return <SessionLoader />;

  const notStarted = interviews.filter((i) => !i.my_session_status || i.my_session_status === "invited");
  const inProgress = interviews.filter((i) => i.my_session_status === "in_progress");
  const completed = interviews.filter((i) => i.my_session_status === "completed");

  return (
    <DashboardShell
      role="user"
      title="AI Interviews"
      subtitle="Voice interviews — each question is read aloud, you answer by speaking, and AI scores your result instantly."
    >
      {!loading && entitlements && (
        <UsageLimitBanner
          label="mock interviews"
          used={entitlements.mock_interviews_used_today}
          max={entitlements.max_mock_interviews_per_day}
        />
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading interviews...
        </div>
      ) : interviews.length === 0 && tracks.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No interviews yet — shortlisted interviews and mock rounds from your college will appear here.
        </div>
      ) : (
        <div className="space-y-8">
          {tracks.length > 0 && <TrackSection tracks={tracks} />}
          {inProgress.length > 0 && <InterviewSection title="Resume" interviews={inProgress} accent="warning" />}
          {notStarted.length > 0 && <InterviewSection title="Available" interviews={notStarted} accent="primary" />}
          {completed.length > 0 && <InterviewSection title="Completed" interviews={completed} accent="muted" />}
        </div>
      )}
    </DashboardShell>
  );
}

function TrackSection({ tracks }: { tracks: StudentInterviewTrackSummary[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-primary flex items-center gap-2">
        <Layers className="w-4 h-4 text-accent-primary" />
        <span>Final Interviews</span>
        <span className="text-xs font-normal text-text-muted">({tracks.length})</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tracks.map((track) => (
          <Link
            key={track.id}
            href={`/dashboard/interview-tracks?slug=${track.slug}`}
            className="p-5 rounded-panel bg-surface border border-accent-primary/25 shadow-subtle hover:border-accent-primary/50 hover:-translate-y-1 hover:shadow-card transition-all flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="w-10 h-10 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              {track.company && (
                <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded border bg-accent-secondary/10 text-accent-secondary border-accent-secondary/25">
                  {track.company.name}
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-primary leading-snug">{track.title}</h3>
            {track.role_title && <p className="text-xs text-text-secondary">{track.role_title}</p>}
            <div className="flex items-center justify-between text-2xs text-text-muted mt-auto pt-2 border-t border-border-subtle">
              <span>{track.round_count} rounds</span>
              <span className="font-bold text-accent-primary">
                {track.my_round1_status === "in_progress" ? "Continue →" : track.my_round1_status === "completed" ? "View progress →" : "Start →"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function InterviewSection({
  title,
  interviews,
  accent,
}: {
  title: string;
  interviews: StudentInterviewSummary[];
  accent: "warning" | "primary" | "muted";
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-bold text-primary flex items-center gap-2">
        {accent === "warning" && <span className="w-2 h-2 rounded-full bg-status-warning animate-pulse" />}
        <span>{title}</span>
        <span className="text-xs font-normal text-text-muted">({interviews.length})</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {interviews.map((interview) => (
          <Link
            key={interview.id}
            href={`/dashboard/interviews/view?slug=${interview.slug}`}
            className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle hover:border-border-strong hover:-translate-y-1 hover:shadow-card transition-all flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="w-10 h-10 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                <Mic className="w-5 h-5" />
              </div>
              <div className="flex flex-col items-end gap-1">
                {interview.company && TYPE_BADGE[interview.interview_type] && (
                  <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded border", TYPE_BADGE[interview.interview_type].className)}>
                    {interview.company.name}
                  </span>
                )}
                {interview.interview_type === "tpo_mock" && (
                  <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded border", TYPE_BADGE.tpo_mock.className)}>Mock</span>
                )}
                {interview.is_mock && interview.interview_type !== "tpo_mock" && (
                  <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded border bg-amber-500/10 text-amber-500 border-amber-500/25">
                    Practice Round
                  </span>
                )}
                {interview.my_session_status === "completed" && (
                  <span className="text-3xs font-bold text-status-success flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </span>
                )}
              </div>
            </div>

            <h3 className="text-sm font-bold text-primary leading-snug">{interview.title}</h3>
            {interview.description && <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{interview.description}</p>}

            <div className="flex items-center justify-between text-2xs text-text-muted mt-auto pt-2 border-t border-border-subtle">
              <span>{interview.question_count} questions</span>
              {interview.my_session_status === "in_progress" ? (
                <span className="font-bold text-status-warning flex items-center gap-1">
                  <PlayCircle className="w-3.5 h-3.5" />
                  Continue
                </span>
              ) : interview.my_session_status !== "completed" ? (
                <span className="font-bold text-accent-primary">Start →</span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
