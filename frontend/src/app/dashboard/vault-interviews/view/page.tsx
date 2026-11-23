"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  Flame,
  Info,
  Loader2,
  Maximize,
  Mic,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Reveal, ScoreRing } from "@/components/dashboard/vaultAi/vaultKit";
import { BeforeYouStart, BriefingGrid, BriefingHero, HowItWorks, Rise } from "@/components/dashboard/interviews/briefing/BriefingParts";
import { InterviewerCard } from "@/components/dashboard/interviews/briefing/InterviewerCard";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { hasSpeechRecognition, hasSpeechSynthesis } from "@/lib/voice/VoiceEngine";
import type { InterviewResult, StudentInterviewSummary } from "@/types/interview";

const BENCHMARK = 60;
const HOME = "/dashboard/vault-interviews";

function formatEstimatedTime(totalSeconds: number | null): string | null {
  if (!totalSeconds) return null;
  const minutes = Math.ceil(totalSeconds / 60);
  return minutes <= 1 ? "~1 min" : `~${minutes} min`;
}

/** A Vault AI Interview set, before and after it is sat: what it is, how it works, the way in - and, once scored, the result. */
export default function VaultInterviewSetPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <VaultInterviewSetContent />
    </Suspense>
  );
}

function VaultInterviewSetContent() {
  const { status } = useAuthGuard(["user"]);
  const router = useRouter();
  const slug = useSearchParams().get("slug") ?? "";

  const [interview, setInterview] = useState<StudentInterviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [reattempting, setReattempting] = useState(false);
  const [retryingScoring, setRetryingScoring] = useState(false);
  const [launchingNext, setLaunchingNext] = useState(false);
  // Pressing Start gives feedback at once; the interview is a full-screen experience and takes a moment to open.
  const [opening, setOpening] = useState(false);

  const handleLaunchNextSet = async () => {
    if (!interview?.qualification?.stack_key || setNumber === null || launchingNext) return;
    const nextSet = setNumber + 1;
    setLaunchingNext(true);
    try {
      const res = await api.post<{ interview: { slug: string } }>("/vault-qualification/start-set", {
        stack: interview.qualification.stack_key,
        set_number: nextSet,
      });
      router.push(`${HOME}/session?slug=${encodeURIComponent(res.interview.slug)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not launch next set. Please try from the qualification circuit.");
      setLaunchingNext(false);
    }
  };

  const handleRetryScoring = async () => {
    if (retryingScoring) return;
    setRetryingScoring(true);
    try {
      const res = await api.post<InterviewResult>(`/interviews/${encodeURIComponent(slug)}/retry-scoring`, {});
      setResult(res);
      if (res.status === "scored") {
        toast.success("Your Vault AI Interview score is ready!");
      } else {
        toast.info("Evaluation is in progress. Your answers are securely saved.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Evaluation service is busy. Your answers are safely saved and will be scored automatically.");
    } finally {
      setRetryingScoring(false);
    }
  };

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<StudentInterviewSummary>(`/interviews/${encodeURIComponent(slug)}`)
      .then((summary) => {
        // Not a Vault set: it belongs to the Mock AI Interview's pages.
        if (summary.is_qualification === false) {
          router.replace(`/dashboard/interviews/view?slug=${encodeURIComponent(slug)}`);
          return;
        }
        setInterview(summary);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "This set isn't available."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slug]);

  // Once the set is finished, fetch its result - and keep asking while the AI is still scoring (a few seconds, usually).
  useEffect(() => {
    if (status !== "ready" || interview?.my_session_status !== "completed") return;
    let cancelled = false;
    let attempts = 0;

    const poll = async () => {
      try {
        const res = await api.get<InterviewResult>(`/interviews/${encodeURIComponent(slug)}/result`);
        if (cancelled) return;
        setResult(res);
        if (res.status === "scoring" && ++attempts < 40) timer = setTimeout(poll, 4000);
      } catch {
        if (!cancelled) setResult(null);
      }
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [status, slug, interview?.my_session_status]);

  // Revoke every object URL on unmount: the recordings are blobs that would otherwise live as long as the tab.
  useEffect(() => {
    return () => Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlay = async (responseId: number) => {
    if (audioUrls[responseId]) {
      setPlayingId(responseId);
      return;
    }
    try {
      const blob = await api.getFile(`/interviews/${encodeURIComponent(slug)}/responses/${responseId}/audio`);
      setAudioUrls((prev) => ({ ...prev, [responseId]: URL.createObjectURL(blob) }));
      setPlayingId(responseId);
    } catch {
      // Not fatal: the transcript is still there without the audio.
    }
  };

  const handleReattempt = async () => {
    if (reattempting) return;
    setReattempting(true);
    try {
      await api.post(`/interviews/${encodeURIComponent(slug)}/reattempt`, {});
      router.push(`${HOME}/session?slug=${encodeURIComponent(slug)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't reset this set. Please try again.");
      setReattempting(false);
    }
  };

  if (status !== "ready") return <SessionLoader />;

  const ttsSupported = hasSpeechSynthesis();
  const sttSupported = hasSpeechRecognition();
  const estimatedTime = interview ? formatEstimatedTime(interview.estimated_total_seconds) : null;
  const setNumber = interview?.qualification?.set_number ?? null;
  const seriesNumber = interview?.qualification?.series_number ?? null;
  const completed = interview?.my_session_status === "completed";
  const inProgress = interview?.my_session_status === "in_progress";
  const score = result?.status === "scored" ? Math.round(result.composite_score_percent ?? 0) : null;
  const cleared = score !== null && score >= BENCHMARK;

  return (
    <DashboardShell role="user" title="Vault AI Interview" subtitle="Pass 3 voice sets with a 60%+ average to get listed on Mellow Vault.">
      <div className="space-y-5">
        <Link href={HOME} className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-primary transition-all hover:gap-2 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to the qualification circuit
        </Link>

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface p-12 text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your set...
          </div>
        ) : error || !interview ? (
          <div className="rounded-2xl border border-status-danger/30 bg-status-danger/[0.06] p-10 text-center text-xs text-status-danger">{error ?? "This set isn't available."}</div>
        ) : (
          <BriefingGrid
            main={
              <>
                <Rise>
                  <BriefingHero
                    eyebrow={
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-300">
                          <ShieldCheck className="h-3 w-3" aria-hidden /> Vault qualification
                        </span>
                        {seriesNumber !== null && setNumber !== null && (
                          <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-3xs font-semibold text-text-secondary ring-1 ring-inset ring-border-subtle">
                            Series {seriesNumber} · Set {setNumber} of 3
                          </span>
                        )}
                      </>
                    }
                    title={interview.title}
                    description={interview.description}
                    questionCount={interview.question_count}
                    answered={completed ? interview.question_count : 0}
                    facts={[
                      { label: "Questions", value: interview.question_count },
                      ...(estimatedTime ? [{ label: "Est. time", value: estimatedTime }] : []),
                      {
                        label: "Status",
                        value: (
                          <span className={cn(completed ? "text-emerald-600 dark:text-emerald-400" : inProgress ? "text-amber-600 dark:text-amber-400" : "text-primary")}>
                            {completed ? "Completed" : inProgress ? "In progress" : "Not started"}
                          </span>
                        ),
                      },
                    ]}
                    note={
                      <span className="flex items-start gap-2">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" aria-hidden />
                        <span>
                          This set counts toward your Mellow Vault series and is scored once. <strong className="font-semibold text-primary">Your average across all three sets decides whether you qualify</strong> (60% or higher).
                        </span>
                      </span>
                    }
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
                          { icon: Camera, text: "Camera and microphone are required. Your camera stays visible in a small preview, like a video call." },
                          { icon: Maximize, text: "It runs in fullscreen. Leaving fullscreen, switching tabs or opening dev tools counts as a strike." },
                          { icon: ShieldAlert, tone: "warn", text: "After 3 strikes the set is locked, so find a quiet spot and stay on the page." },
                          ...(estimatedTime ? [{ icon: Timer, text: `Set aside about ${estimatedTime.replace("~", "")}. Each answer has its own countdown, plus time to prepare.` }] : []),
                        ]}
                      />
                    </Rise>
                  </>
                )}

                {completed && (
                  <Reveal delay={0.05}>
                    {!result || result.status === "scoring" ? (
                      <div role="status" className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface p-5 text-sm text-text-secondary shadow-subtle">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" aria-hidden />
                        <span>
                          <strong className="font-bold text-primary">Scoring your answers with AI.</strong> This usually takes a few seconds, and this page updates by itself.
                        </span>
                      </div>
                    ) : result.status === "scored" ? (
                      <div className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6">
                        <div className="flex flex-wrap items-center gap-5">
                          <ScoreRing value={score} size={96} stroke={9} tone={cleared ? "emerald" : "amber"} label="Your score for this set">
                            <span className="tabular text-2xl font-extrabold text-primary">{score}%</span>
                          </ScoreRing>
                          <div className="min-w-0 flex-1">
                            <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">Your score for this set</p>
                            <p className={cn("mt-1 flex items-center gap-1.5 text-sm font-extrabold", cleared ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                              {cleared ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Flame className="h-4 w-4" aria-hidden />}
                              {cleared ? `Above the ${BENCHMARK}% line` : `Below the ${BENCHMARK}% line`}
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                              {cleared
                                ? "Nice work. Finish the other sets of this series to lock in your average."
                                : "That's fine: it's your average across all three sets that counts, so the other sets can make it up."}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            {setNumber !== null && setNumber < 3 && interview?.qualification?.stack_key && (
                              <button
                                type="button"
                                onClick={handleLaunchNextSet}
                                disabled={launchingNext}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
                              >
                                {launchingNext ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                                <span>Proceed to Set {setNumber + 1}</span>
                              </button>
                            )}
                            <Link
                              href={HOME}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-xs font-bold text-text-secondary hover:text-primary transition-all"
                            >
                              Back to the circuit <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </div>
                        </div>

                        {result.responses.length > 0 && (
                          <div className="space-y-2.5 border-t border-border-subtle pt-4">
                            <h3 className="text-xs font-extrabold uppercase tracking-wider text-text-muted">Feedback on every answer</h3>
                            {result.responses.map((r) => (
                              <div key={r.response_id} className="space-y-2 rounded-xl border border-border-subtle bg-elevated/50 p-3.5 transition-colors hover:border-indigo-500/25">
                                <div className="flex items-start justify-between gap-3">
                                  <span className="text-xs font-semibold text-primary">{r.question_text}</span>
                                  <span className="tabular shrink-0 rounded-full bg-indigo-500/10 px-2 py-0.5 text-2xs font-extrabold text-indigo-700 dark:text-indigo-300">{r.score}/100</span>
                                </div>
                                <div className="border-l-2 border-indigo-500/30 pl-3">
                                  <p className="mb-0.5 text-3xs font-bold uppercase tracking-wide text-text-muted">Your answer</p>
                                  <p className="whitespace-pre-wrap text-2xs leading-relaxed text-text-secondary">
                                    {r.transcript_text || <span className="italic text-text-muted">No transcript captured.</span>}
                                  </p>
                                </div>
                                {r.has_audio &&
                                  (playingId === r.response_id && audioUrls[r.response_id] ? (
                                    <audio controls autoPlay src={audioUrls[r.response_id]} className="h-8 w-full" />
                                  ) : (
                                    <button onClick={() => handlePlay(r.response_id)} className="flex items-center gap-1.5 text-2xs font-semibold text-accent-primary hover:underline">
                                      <PlayCircle className="h-3.5 w-3.5" aria-hidden /> Play my recording
                                    </button>
                                  ))}
                                <p className="border-t border-border-subtle pt-2 text-2xs leading-relaxed text-text-secondary">
                                  <span className="font-bold text-text-muted">Feedback: </span>
                                  {r.feedback}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.04] p-5 space-y-3.5 text-left shadow-subtle">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 ring-1 ring-inset ring-indigo-500/25">
                            <ShieldCheck className="h-5 w-5" aria-hidden />
                          </span>
                          <div>
                            <h4 className="text-sm font-extrabold text-primary">All Answers Recorded &amp; Safely Saved</h4>
                            <p className="mt-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                              ✓ Audio recordings &amp; spoken transcripts safely stored in your Vault account
                            </p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-subtle bg-surface p-3.5 text-xs leading-relaxed text-text-secondary space-y-1.5">
                          <p>
                            Your interview responses for all questions are <strong className="font-bold text-primary">100% saved</strong>. You do <strong className="font-bold text-primary">not</strong> need to re-attempt or re-record your answers.
                          </p>
                          <p className="text-2xs text-text-muted">
                            Our AI evaluation service is experiencing temporary high traffic. Your answers are safely queued in the background and will count toward your Mellow Vault series once scored. You can check your marks now below, or return anytime to view your updated qualification status.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={handleRetryScoring}
                            disabled={retryingScoring}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60"
                          >
                            {retryingScoring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                            <span>{retryingScoring ? "Evaluating Answers..." : "View / Check My Score"}</span>
                          </button>

                          <Link
                            href={HOME}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-xs font-bold text-text-secondary hover:text-primary transition-all"
                          >
                            <span>Back to Qualification Circuit</span>
                          </Link>
                        </div>

                        {result.reattemptable && (
                          <p className="pt-1 text-3xs text-text-muted">
                            Prefer to discard these saved answers and take a fresh sitting instead?{" "}
                            <button
                              type="button"
                              onClick={handleReattempt}
                              disabled={reattempting}
                              className="font-bold text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-500"
                            >
                              {reattempting ? "Resetting..." : "Sit this set again"}
                            </button>
                          </p>
                        )}
                      </div>
                    )}
                  </Reveal>
                )}
              </>
            }
            aside={
              <Rise delay={1}>
                {completed ? (
                  <InterviewerCard
                    title={setNumber && setNumber < 3 ? `Set ${setNumber} Complete` : "Series Complete"}
                    subtitle={setNumber && setNumber < 3 ? `Ready to tackle Set ${setNumber + 1}?` : "All 3 sets of this series have been completed."}
                    showChecks={false}
                  >
                    {setNumber && setNumber < 3 && interview?.qualification?.stack_key ? (
                      <button
                        type="button"
                        disabled={launchingNext}
                        onClick={handleLaunchNextSet}
                        className="va-sheen relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5"
                      >
                        {launchingNext ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                        <span>Proceed to Set {setNumber + 1}</span>
                      </button>
                    ) : (
                      <Link
                        href={interview?.qualification?.stack_key ? `${HOME}?stack=${encodeURIComponent(interview.qualification.stack_key)}` : HOME}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/25 transition-all hover:-translate-y-0.5"
                      >
                        <span>View Series Standing</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </InterviewerCard>
                ) : (
                  <InterviewerCard
                    title={inProgress ? "Pick up where you left off" : "Ready when you are"}
                    subtitle="You choose when the first question starts — nothing begins until you say so."
                    voicePreview={interview.voice_preview}
                    footnote={estimatedTime ? `About ${estimatedTime.replace("~", "")} in all. You'll get a moment to get ready first.` : "You'll get a moment to get ready first."}
                  >
                    <button
                      type="button"
                      disabled={opening}
                      onClick={() => {
                        setOpening(true);
                        router.push(`${HOME}/session?slug=${encodeURIComponent(interview.slug)}`);
                      }}
                      className="va-sheen relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/40 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-80"
                    >
                      {opening ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
                      {opening ? "Opening your interview..." : inProgress ? `Continue Set ${setNumber ?? ""}`.trim() : `Start Set ${setNumber ?? ""}`.trim()}
                      {!opening && <ArrowRight className="h-4 w-4" aria-hidden />}
                    </button>
                  </InterviewerCard>
                )}
              </Rise>
            }
          />
        )}
      </div>
    </DashboardShell>
  );
}
