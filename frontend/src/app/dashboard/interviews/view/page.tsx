"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Mic, Headphones, MessageSquare, CheckCircle2, ArrowLeft, Loader2, Camera, Maximize, ShieldAlert, Timer, Sparkles, PlayCircle } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { hasSpeechRecognition, hasSpeechSynthesis } from "@/lib/voice/VoiceEngine";
import type { InterviewResult, StudentInterviewSummary } from "@/types/interview";

function formatEstimatedTime(totalSeconds: number | null): string | null {
  if (!totalSeconds) return null;
  const minutes = Math.ceil(totalSeconds / 60);
  return minutes <= 1 ? "~1 min" : `~${minutes} min`;
}

export default function InterviewDetailPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <InterviewDetailPageContent />
    </Suspense>
  );
}

function InterviewDetailPageContent() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const router = useRouter();
  const [interview, setInterview] = useState<StudentInterviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<StudentInterviewSummary>(`/interviews/${slug}`)
      .then(setInterview)
      .catch((err) => setError(err instanceof ApiError ? err.message : "This interview isn't available."))
      .finally(() => setLoading(false));
  }, [status, slug]);

  // Fetched separately (not part of the summary above) — only meaningful
  // once completed, and this page is also reached straight from the
  // interview list on a revisit, well after the session page's own polling
  // would have finished, so a single fetch (no polling loop) is enough here.
  useEffect(() => {
    if (status !== "ready" || interview?.my_session_status !== "completed") return;
    api
      .get<InterviewResult>(`/interviews/${slug}/result`)
      .then(setResult)
      .catch(() => setResult(null));
  }, [status, slug, interview?.my_session_status]);

  // Revoke every object URL on unmount — same cleanup ReviewSessionsModal
  // does for the reviewer-side player, since these blobs otherwise leak for
  // the life of the tab.
  useEffect(() => {
    return () => {
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlay = async (responseId: number) => {
    if (audioUrls[responseId]) {
      setPlayingId(responseId);
      return;
    }
    try {
      const blob = await api.getFile(`/interviews/${slug}/responses/${responseId}/audio`);
      const url = URL.createObjectURL(blob);
      setAudioUrls((prev) => ({ ...prev, [responseId]: url }));
      setPlayingId(responseId);
    } catch {
      // Non-fatal — the rest of the transcript is still readable without audio.
    }
  };

  if (status !== "ready") return <SessionLoader />;

  const ttsSupported = hasSpeechSynthesis();
  const sttSupported = hasSpeechRecognition();
  const estimatedTime = interview ? formatEstimatedTime(interview.estimated_total_seconds) : null;

  return (
    <DashboardShell role="user" title="AI Interview">
      <Link href="/dashboard/interviews" className="inline-flex items-center gap-1.5 text-2xs font-semibold text-accent-primary hover:underline mb-4">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Interviews
      </Link>

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : error || !interview ? (
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle">
          {error ?? "This interview isn't available."}
        </div>
      ) : (
        <div className="max-w-2xl space-y-5">
          <div className="p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                <Mic className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-primary">{interview.title}</h1>
                  {interview.is_mock && (
                    <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded border bg-amber-500/10 text-amber-500 border-amber-500/25">
                      Practice Round
                    </span>
                  )}
                </div>
                {interview.company && <p className="text-xs text-text-muted">{interview.company.name}</p>}
              </div>
            </div>

            {interview.is_mock && (
              <p className="text-2xs text-amber-600 bg-amber-500/[0.06] border border-amber-500/20 rounded-control px-3 py-2">
                This is a practice round to help you prepare — it&apos;s never part of the actual hiring decision.
              </p>
            )}

            {interview.description && <p className="text-sm text-text-secondary leading-relaxed">{interview.description}</p>}

            <div className={cn("grid gap-3 pt-2 border-t border-border-subtle", estimatedTime ? "grid-cols-3" : "grid-cols-2")}>
              <Stat label="Questions" value={String(interview.question_count)} />
              {estimatedTime && <Stat label="Est. time" value={estimatedTime} />}
              <Stat label="Status" value={interview.my_session_status === "completed" ? "Completed" : interview.my_session_status === "in_progress" ? "In progress" : "Not started"} />
            </div>
          </div>

          {interview.my_session_status !== "completed" && (
            <div className="p-5 rounded-panel bg-elevated/60 border border-border-subtle space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">What to expect</h2>
              <div className="flex items-start gap-3 text-xs text-text-secondary">
                <Camera className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                <span>Camera and microphone access is required — your camera stays visible in a small preview the whole time, like a video call.</span>
              </div>
              <div className="flex items-start gap-3 text-xs text-text-secondary">
                <Maximize className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                <span>The interview runs in fullscreen. Exiting fullscreen, switching tabs, or opening dev tools counts as a strike.</span>
              </div>
              <div className="flex items-start gap-3 text-xs text-text-secondary">
                <ShieldAlert className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                <span>After 3 strikes you&apos;ll be locked out — only whoever invited you can reinstate the interview.</span>
              </div>
              {estimatedTime && (
                <div className="flex items-start gap-3 text-xs text-text-secondary">
                  <Timer className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                  <span>Set aside about {estimatedTime.replace("~", "")} — you&apos;ll get a countdown for each answer, plus time to prepare.</span>
                </div>
              )}
            </div>
          )}

          <div className="p-5 rounded-panel bg-elevated/60 border border-border-subtle space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-text-muted">How it works</h2>
            <div className="flex items-start gap-3 text-xs text-text-secondary">
              <Headphones className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
              <span>Each question is read aloud one at a time{!ttsSupported && " (your browser will show it as text instead)"}.</span>
            </div>
            <div className="flex items-start gap-3 text-xs text-text-secondary">
              <Mic className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
              <span>
                {sttSupported
                  ? "Answer by speaking — you can review and edit the transcript before submitting each answer."
                  : "Your browser doesn't support speech recognition, so you'll type your answers instead."}
              </span>
            </div>
            <div className="flex items-start gap-3 text-xs text-text-secondary">
              <MessageSquare className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
              <span>AI scores your answers right after you finish — a human reviewer can still adjust it afterward.</span>
            </div>
            {!ttsSupported && !sttSupported && (
              <p className="text-[10.5px] text-status-warning pt-1">
                Voice features aren&apos;t available in this browser — try Chrome or Edge for the full spoken experience.
              </p>
            )}
          </div>

          {interview.my_session_status === "completed" ? (
            result?.status === "scored" ? (
              <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-accent-primary text-accent-primary shrink-0">
                    <span className="text-sm font-black tabular-nums">{Math.round(result.composite_score_percent ?? 0)}%</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
                      Your Result
                    </div>
                    <p className="text-2xs text-text-muted mt-0.5">Scored by AI — a human reviewer can still adjust this.</p>
                  </div>
                </div>
                {result.responses.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-border-subtle">
                    <h3 className="text-2xs font-bold uppercase tracking-wide text-text-muted">Full Transcript</h3>
                    {result.responses.map((r) => (
                      <div key={r.response_id} className="p-3 rounded-control bg-elevated/60 border border-border-subtle space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-2xs font-semibold text-primary">{r.question_text}</span>
                          <span className="text-2xs font-bold text-accent-primary shrink-0">{r.score}/100</span>
                        </div>
                        <div className="pl-2.5 border-l-2 border-accent-primary/25">
                          <p className="text-3xs font-bold uppercase tracking-wide text-text-muted mb-0.5">Your answer</p>
                          <p className="text-2xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                            {r.transcript_text || <span className="italic text-text-muted">No transcript captured.</span>}
                          </p>
                        </div>
                        {r.has_audio && (
                          <div>
                            {playingId === r.response_id && audioUrls[r.response_id] ? (
                              <audio controls autoPlay src={audioUrls[r.response_id]} className="w-full h-8" />
                            ) : (
                              <button
                                onClick={() => handlePlay(r.response_id)}
                                className="flex items-center gap-1.5 text-2xs font-semibold text-accent-primary hover:underline"
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                Play my recording
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-[10.5px] text-text-secondary leading-relaxed pt-1 border-t border-border-subtle">
                          <span className="font-bold text-text-muted">Feedback: </span>
                          {r.feedback}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-panel bg-status-success/10 border border-status-success/25 flex items-center gap-2 text-xs font-semibold text-status-success">
                <CheckCircle2 className="w-4 h-4" />
                {result?.status === "needs_human_review"
                  ? "You've completed this interview. A reviewer has been notified."
                  : "You've completed this interview — it's being scored."}
              </div>
            )
          ) : (
            <button
              onClick={() => router.push(`/dashboard/interviews/session?slug=${interview.slug}`)}
              className="w-full py-3 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Mic className="w-4 h-4" />
              {interview.my_session_status === "in_progress" ? "Continue Interview" : "Start Interview"}
            </button>
          )}
        </div>
      )}
    </DashboardShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-3xs font-bold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="text-sm font-bold text-primary mt-0.5">{value}</div>
    </div>
  );
}
