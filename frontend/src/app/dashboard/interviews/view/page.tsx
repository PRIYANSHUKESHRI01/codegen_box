"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Mic, CheckCircle2, Loader2, Camera, Maximize, ShieldAlert, Timer, Sparkles, PlayCircle, RotateCcw, ArrowLeft } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BeforeYouStart, BriefingGrid, BriefingHero, HowItWorks, Rise } from "@/components/dashboard/interviews/briefing/BriefingParts";
import { InterviewerCard } from "@/components/dashboard/interviews/briefing/InterviewerCard";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
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
  const [reattempting, setReattempting] = useState(false);
  // Pressing Start gives feedback at once; the interview is a full-screen experience and takes a moment to open.
  const [opening, setOpening] = useState(false);

  const handleReattempt = async () => {
    if (reattempting) return;
    setReattempting(true);
    try {
      await api.post(`/interviews/${encodeURIComponent(slug)}/reattempt`, {});
      router.push(`/dashboard/interviews/session?slug=${encodeURIComponent(slug)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to reset interview session for re-attempt.");
      setReattempting(false);
    }
  };

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<StudentInterviewSummary>(`/interviews/${slug}`)
      .then((summary) => {
        // A Vault AI Interview set is sat in the Vault AI Interview's own pages (an old link or bookmark lands here).
        if (summary.is_qualification) router.replace(`/dashboard/vault-interviews/view?slug=${encodeURIComponent(slug)}`);
        setInterview(summary);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "This interview isn't available."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (status !== "ready" || interview?.is_qualification) return <SessionLoader />;

  const ttsSupported = hasSpeechSynthesis();
  const sttSupported = hasSpeechRecognition();
  const estimatedTime = interview ? formatEstimatedTime(interview.estimated_total_seconds) : null;

  const completed = interview?.my_session_status === "completed";
  const inProgress = interview?.my_session_status === "in_progress";

  return (
    <DashboardShell role="user" title="AI Interview">
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
        <BriefingGrid
          main={
            <>
              <Rise>
                <BriefingHero
                  eyebrow={
                    <>
                      {interview.is_mock && (
                        <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded border bg-amber-500/10 text-amber-500 border-amber-500/25">Practice Round</span>
                      )}
                      {interview.company && <span className="text-xs font-semibold text-text-muted">{interview.company.name}</span>}
                    </>
                  }
                  title={interview.title}
                  description={interview.description}
                  questionCount={interview.question_count}
                  answered={completed ? interview.question_count : 0}
                  facts={[
                    { label: "Questions", value: interview.question_count },
                    ...(estimatedTime ? [{ label: "Est. time", value: estimatedTime }] : []),
                    { label: "Status", value: completed ? "Completed" : inProgress ? "In progress" : "Not started" },
                  ]}
                  tone={interview.is_mock ? "amber" : "indigo"}
                  note={interview.is_mock ? <span className="text-amber-700">This is a practice round to help you prepare — it&apos;s never part of the actual hiring decision.</span> : undefined}
                />
              </Rise>

              {!completed && (
                <>
                  <Rise delay={1}>
                    <HowItWorks voiceSupported={ttsSupported} speechSupported={sttSupported} />
                  </Rise>
                  <Rise delay={2}>
                    <BeforeYouStart
                      items={[
                        { icon: Camera, text: "Camera and microphone access is required — your camera stays visible in a small preview the whole time, like a video call." },
                        { icon: Maximize, text: "The interview runs in fullscreen. Exiting fullscreen, switching tabs, or opening dev tools counts as a strike." },
                        {
                          icon: ShieldAlert,
                          tone: "warn",
                          text:
                            interview.interview_type === "practice"
                              ? "After 3 strikes this round is closed — you can build a new practice interview whenever you like."
                              : "After 3 strikes you'll be locked out — only whoever invited you can reinstate the interview.",
                        },
                        ...(estimatedTime ? [{ icon: Timer, text: `Set aside about ${estimatedTime.replace("~", "")} — you'll get a countdown for each answer, plus time to prepare.` }] : []),
                      ]}
                    />
                  </Rise>
                </>
              )}

              {!ttsSupported && !sttSupported && (
                <p className="text-3xs text-status-warning">Voice features aren&apos;t available in this browser — try Chrome or Edge for the full spoken experience.</p>
              )}

              {completed && (
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
                    {result.is_qualification && (
                      <div className="p-4 rounded-control bg-emerald-500/10 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-3 mt-3">
                        <p className="text-2xs text-text-secondary leading-relaxed max-w-md">
                          This set counts toward your Mellow Vault qualification series and is scored once. Your series average decides whether you qualify.
                        </p>
                        <Link
                          href="/dashboard/vault-interviews"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface border border-border-subtle hover:border-accent-primary text-primary text-xs font-bold transition-all"
                        >
                          <ArrowLeft className="w-3.5 h-3.5 text-text-muted" />
                          <span>Qualification Circuit</span>
                        </Link>
                      </div>
                    )}
                    {Math.round(result.composite_score_percent ?? 0) < 60 && result.reattemptable !== false && (
                      <div className="p-4 rounded-control bg-amber-500/10 border border-amber-500/25 space-y-3 mt-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                            <RotateCcw className="w-4 h-4" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400">
                              Score below 60% — Re-attempt Recommended
                            </h4>
                            <p className="text-2xs text-text-secondary leading-relaxed">
                              You scored <strong className="text-primary font-bold">{Math.round(result.composite_score_percent ?? 0)}%</strong>, which is below the 60% technical readiness benchmark required by top engineering companies and campus placement rounds. Review the AI critiques below to identify your weak spots, then re-attempt this interview to improve your score!
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                          <Link
                            href="/dashboard/vault-interviews"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface border border-border-subtle hover:border-accent-primary text-primary text-xs font-bold transition-all"
                          >
                            <ArrowLeft className="w-3.5 h-3.5 text-text-muted" />
                            <span>Qualification Circuit</span>
                          </Link>
                          <button
                            onClick={handleReattempt}
                            disabled={reattempting}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                          >
                            {reattempting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Resetting session...</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Re-attempt Interview</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

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
                            <p className="text-3xs text-text-secondary leading-relaxed pt-1 border-t border-border-subtle">
                              <span className="font-bold text-text-muted">Feedback: </span>
                              {r.feedback}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-panel bg-status-success/10 border border-status-success/25 flex items-center gap-2 text-xs font-semibold text-status-success">
                      <CheckCircle2 className="w-4 h-4" />
                      {result?.status === "needs_human_review"
                        ? result.is_qualification
                          ? "Scoring didn't complete for this set, so it hasn't counted. You can sit it again."
                          : "You've completed this interview. A reviewer has been notified."
                        : "You've completed this interview — it's being scored."}
                    </div>
                    {result?.status === "needs_human_review" && result.reattemptable && (
                      <button
                        onClick={handleReattempt}
                        disabled={reattempting}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-control bg-accent-primary hover:bg-accent-primary/90 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{reattempting ? "Resetting session..." : "Re-attempt Interview"}</span>
                      </button>
                    )}
                  </div>
                )
              )}
            </>
          }
          aside={
            <Rise delay={1}>
              {completed ? (
                <InterviewerCard title="Interview complete" subtitle="Your result and the feedback on every answer are alongside." showChecks={false} />
              ) : (
                <InterviewerCard
                  title={inProgress ? "Pick up where you left off" : "Ready when you are"}
                  subtitle="You choose when the first question starts — nothing begins until you say so."
                  voicePreview={interview.voice_preview}
                  footnote={estimatedTime ? `About ${estimatedTime.replace("~", "")} in all. You'll get a moment to get ready first.` : "You'll get a moment to get ready first."}
                >
                  <button
                    disabled={opening}
                    onClick={() => {
                      setOpening(true);
                      router.push(`/dashboard/interviews/session?slug=${interview.slug}`);
                    }}
                    className="w-full py-3.5 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white text-sm font-bold shadow-lg shadow-accent-primary/30 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-80"
                  >
                    {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
                    {opening ? "Opening your interview..." : inProgress ? "Continue Interview" : "Start Interview"}
                  </button>
                </InterviewerCard>
              )}
            </Rise>
          }
        />
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
