"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic,
  Volume2,
  Square,
  Loader2,
  CheckCircle2,
  Edit3,
  Send,
  PartyPopper,
  RotateCcw,
  Zap,
  Clock3,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  Mail,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BrowserVoiceEngine } from "@/lib/voice/browserVoiceEngine";
import { hasMediaRecorder, hasSpeechRecognition, hasSpeechSynthesis, type VoiceEngine, type VoiceListenError } from "@/lib/voice/VoiceEngine";
import { useInterviewProctoring } from "@/lib/proctoring/useInterviewProctoring";
import { InterviewProctoringConsentGate } from "@/components/proctoring/InterviewProctoringConsentGate";
import { InterviewSessionHud } from "@/components/proctoring/InterviewSessionHud";
import { InterviewProctoringLockedScreen } from "@/components/proctoring/InterviewProctoringLockedScreen";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  DIFFICULTY_COLORS,
  type AnswerInterviewResponse,
  type InterviewResult,
  type StartInterviewResponse,
  type TakeQuestionPayload,
} from "@/types/interview";

type Phase =
  | "loading"
  | "speaking"
  | "prep"
  | "listening"
  | "text_fallback"
  | "reviewing_answer"
  | "submitting"
  | "complete"
  | "error";

const PREP_SECONDS = 10;
const DEFAULT_ANSWER_SECONDS = 180;

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Green while there's plenty of time, amber in the last third, red (pulsing in the UI) in the last 15%. */
function urgencyColor(ratio: number): string {
  if (ratio > 0.33) return "#10b981"; // emerald-500
  if (ratio > 0.15) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
}

/** Runs a one-per-second countdown while `active`, firing `onExpire` exactly once when it reaches 0. Resets to `totalSeconds` every time `active` flips back to true — a fresh attempt (re-record) always gets a full new window. */
function useCountdown(totalSeconds: number, active: boolean, onExpire: () => void) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!active) return;
    setSecondsLeft(totalSeconds);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(interval);
          onExpireRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, totalSeconds]);

  return secondsLeft;
}

/** A draining ring wrapped around the mic/stop button — the recording countdown's focal point. */
function CountdownRing({ ratio, size = 96 }: { ratio: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = urgencyColor(ratio);

  return (
    <svg width={size} height={size} className="absolute inset-0 -rotate-90 pointer-events-none">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-elevated" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s ease" }}
      />
    </svg>
  );
}

const LEVEL_BAR_COUNT = 7;

/**
 * A small live waveform — each bar reflects one recent audio-level sample
 * (most recent on the right), so it reads as motion over the last ~1s
 * rather than a single jumpy needle. Renders a calm, non-zero baseline even
 * with no data yet (mic still initializing / AudioContext unavailable) so
 * it always looks "ready," never broken.
 */
function AudioLevelBars({ levels }: { levels: number[] }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-6">
      {levels.map((level, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-accent-primary"
          animate={{ height: `${Math.max(15, level * 100)}%`, opacity: 0.45 + level * 0.55 }}
          transition={{ duration: 0.1, ease: "easeOut" }}
          style={{ height: "15%" }}
        />
      ))}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl font-black text-primary tabular-nums">{value}</div>
      <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

/**
 * The voice-taking flow — state machine driven through the VoiceEngine
 * interface (see lib/voice/), never touching SpeechSynthesis/
 * SpeechRecognition/MediaRecorder directly. Every question is time-boxed
 * (a short "get ready" prep countdown, then a hard response-time budget
 * from InterviewQuestionBank.expected_duration_seconds — purely a frontend
 * pacing feature, nothing server-side enforces it, matching this feature's
 * "no auto-scoring, a human reviews the final recording" philosophy) and
 * gated behind camera/mic proctoring exactly like a live contest problem —
 * see useInterviewProctoring. Unlike contest proctoring, the candidate's
 * own camera stays visible the entire time (InterviewSessionHud) — a real
 * interview is a video-call experience, not silent surveillance.
 */
export default function InterviewSessionPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <InterviewSessionPageContent />
    </Suspense>
  );
}

function InterviewSessionPageContent() {
  const { status, user } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState<TakeQuestionPayload | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  // Captured exactly once, the instant the interview actually finishes —
  // NOT recomputed from Date.now() on every render of the complete screen,
  // which would keep climbing for as long as the candidate sits looking at
  // it (any later re-render — a HUD tick, an auth refresh, anything —
  // would otherwise show more elapsed time than was actually taken).
  const [completionElapsedSeconds, setCompletionElapsedSeconds] = useState<number | null>(null);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [starting, setStarting] = useState(false);
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);
  const [listenHint, setListenHint] = useState<string | null>(null);
  const [interimCaption, setInterimCaption] = useState("");
  const [levelHistory, setLevelHistory] = useState<number[]>(() => Array(LEVEL_BAR_COUNT).fill(0));

  const startResponseRef = useRef<StartInterviewResponse | null>(null);
  const revealedRef = useRef(false);
  const stopGuardRef = useRef(false);
  const interviewStartedAtRef = useRef<number>(0);
  const levelFrameRef = useRef(0);
  const listenHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const engineRef = useRef<VoiceEngine>(new BrowserVoiceEngine());
  const listenStartedAtRef = useRef<number>(0);
  const ttsSupported = hasSpeechSynthesis();
  const sttSupported = hasSpeechRecognition() && hasMediaRecorder();

  const basePath = `/interviews/${slug}`;
  const alreadyComplete = phase === "complete" && totalQuestions > 0 && answeredCount >= totalQuestions;

  // Polls for the AI-scored result once the interview is complete —
  // ScoreInterviewSessionJob usually finishes within a few seconds, but
  // this self-scheduling chain (not setInterval, so requests never overlap)
  // keeps checking until it resolves to "scored"/"needs_human_review" or
  // gives up after ~60s and just leaves the safe fallback copy showing.
  useEffect(() => {
    if (phase !== "complete") return;
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 30;

    const poll = async () => {
      try {
        const res = await api.get<InterviewResult>(`${basePath}/result`);
        if (cancelled) return;
        setResult(res);
        if (res.status === "scoring" && attempts < MAX_ATTEMPTS) {
          attempts += 1;
          setTimeout(poll, 2000);
        }
      } catch {
        // No result endpoint response (e.g. a stale/mid-transition session)
        // — the completion screen's default copy already covers this.
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  const proctoring = useInterviewProctoring({ basePath, enabled: status === "ready" });

  useEffect(() => {
    return () => {
      engineRef.current.cancel();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (listenHintTimeoutRef.current) clearTimeout(listenHintTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const presentQuestion = useCallback(
    async (q: TakeQuestionPayload) => {
      setQuestion(q);
      setTranscriptDraft("");
      setAudioBlob(null);
      setTimedOut(false);
      setMicErrorMessage(null);
      setListenHint(null);
      setInterimCaption("");
      setLevelHistory(Array(LEVEL_BAR_COUNT).fill(0));
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      if (ttsSupported) {
        setPhase("speaking");
        await engineRef.current.speak(q.question_text);
      }
      setPhase(sttSupported ? "prep" : "text_fallback");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ttsSupported, sttSupported]
  );

  const startInterview = useCallback(async () => {
    setStarting(true);
    setErrorMessage(null);
    try {
      const res = await api.post<StartInterviewResponse>(`${basePath}/start`);
      startResponseRef.current = res;
      setTotalQuestions(res.total_questions);
      setAnsweredCount(res.answered_count);
      if (res.complete || !res.question) {
        setPhase("complete");
      } else {
        setPhase("loading");
      }
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't start this interview.");
      setPhase("error");
    } finally {
      setStarting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath]);

  useEffect(() => {
    if (status !== "ready") return;
    startInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slug]);

  useEffect(() => {
    if (revealedRef.current) return;
    const res = startResponseRef.current;
    if (!res || res.complete || !res.question) return;
    if (proctoring.phase !== "active" && !alreadyComplete) return;

    revealedRef.current = true;
    interviewStartedAtRef.current = Date.now();
    presentQuestion(res.question);
  }, [proctoring.phase, alreadyComplete, presentQuestion]);

  const handleStartAnswering = useCallback(async () => {
    stopGuardRef.current = false;
    setTimedOut(false);
    setMicErrorMessage(null);
    setListenHint(null);
    setInterimCaption("");
    setPhase("listening");
    listenStartedAtRef.current = Date.now();
    try {
      await engineRef.current.startListening({
        onInterimTranscript: (text) => setInterimCaption(text),
        onAudioLevel: (level) => {
          // Throttled to ~20fps (every 3rd animation frame) — smooth enough
          // to read as a live waveform without re-rendering on every frame.
          levelFrameRef.current += 1;
          if (levelFrameRef.current % 3 !== 0) return;
          setLevelHistory((prev) => [...prev.slice(1), level]);
        },
        onError: (error: VoiceListenError) => {
          if (error === "permission_denied") return; // surfaced via the startListening() rejection below instead
          if (listenHintTimeoutRef.current) clearTimeout(listenHintTimeoutRef.current);
          setListenHint(error === "network" ? "Connection hiccup — still listening." : "Didn't catch that — keep talking.");
          listenHintTimeoutRef.current = setTimeout(() => setListenHint(null), 4000);
        },
      });
    } catch (err) {
      const cause = err instanceof Error ? (err.cause as VoiceListenError | undefined) : undefined;
      setMicErrorMessage(
        cause === "permission_denied"
          ? "We couldn't access your microphone — switching to typed answers. Enable mic access in your browser's site settings to use voice next time."
          : "Voice capture isn't available right now — switching to typed answers."
      );
      setPhase("text_fallback");
    }
  }, []);

  const handleStopAnswering = useCallback(async (fromTimeout = false) => {
    if (stopGuardRef.current) return;
    stopGuardRef.current = true;

    if (fromTimeout) setTimedOut(true);
    const { transcript, audioBlob: blob } = await engineRef.current.stopListening();
    setTranscriptDraft(transcript);
    setInterimCaption("");
    setListenHint(null);
    if (blob) {
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
    }
    setPhase("reviewing_answer");
  }, []);

  const handleTextFallbackContinue = useCallback((fromTimeout = false) => {
    if (fromTimeout) setTimedOut(true);
    setPhase((current) => (current === "text_fallback" ? "reviewing_answer" : current));
  }, []);

  const handleReRecord = () => {
    setErrorMessage(null);
    setMicErrorMessage(null);
    setTimedOut(false);
    if (sttSupported) {
      handleStartAnswering();
    } else {
      setTranscriptDraft("");
      setPhase("text_fallback");
    }
  };

  const responseSeconds = question?.expected_duration_seconds ?? DEFAULT_ANSWER_SECONDS;
  const prepSecondsLeft = useCountdown(PREP_SECONDS, phase === "prep", handleStartAnswering);
  const listeningSecondsLeft = useCountdown(responseSeconds, phase === "listening", () => handleStopAnswering(true));
  const typingSecondsLeft = useCountdown(responseSeconds, phase === "text_fallback", () => handleTextFallbackContinue(true));

  const handleSubmitAnswer = async () => {
    if (!question || !transcriptDraft.trim()) return;
    setPhase("submitting");
    setErrorMessage(null);

    const formData = new FormData();
    formData.append("interview_question_id", String(question.interview_question_id));
    formData.append("transcript_text", transcriptDraft.trim());
    if (audioBlob) {
      const durationSeconds = Math.max(1, Math.round((Date.now() - listenStartedAtRef.current) / 1000));
      formData.append("audio", audioBlob, "answer.webm");
      formData.append("audio_duration_seconds", String(durationSeconds));
    }

    try {
      const res = await api.postFormData<AnswerInterviewResponse>(`${basePath}/answer`, formData);
      setAnsweredCount((c) => c + 1);
      if (res.complete || !res.next_question) {
        if (interviewStartedAtRef.current > 0) {
          setCompletionElapsedSeconds(Math.round((Date.now() - interviewStartedAtRef.current) / 1000));
        }
        proctoring.endSession();
        setPhase("complete");
      } else {
        presentQuestion(res.next_question);
      }
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Failed to submit your answer. Try again.");
      setPhase("reviewing_answer");
    }
  };

  if (status !== "ready") return <SessionLoader />;

  const needsProctoringGate = !alreadyComplete && phase !== "error";
  const showConsentGate =
    needsProctoringGate && (proctoring.phase === "consent" || proctoring.phase === "starting" || proctoring.phase === "blocked");
  const showLockedScreen = needsProctoringGate && proctoring.phase === "locked";
  const showContent = alreadyComplete || phase === "error" || proctoring.phase === "active" || proctoring.phase === "fullscreen_lost";
  const hudActive = needsProctoringGate && (proctoring.phase === "active" || proctoring.phase === "fullscreen_lost");

  return (
    <DashboardShell role="user" title="AI Interview" fullBleed={needsProctoringGate} hideChrome={hudActive}>
      <div className="flex-1 flex flex-col min-h-0">
        {showConsentGate && (
          <InterviewProctoringConsentGate
            phase={proctoring.phase}
            consentError={proctoring.consentError}
            devicePreviewReady={proctoring.devicePreviewReady}
            previewVideoRef={proctoring.previewVideoRef}
            onEnableDevices={proctoring.enableDevicePreview}
            onConsent={proctoring.grantConsentAndStart}
          />
        )}

        {showLockedScreen && (
          <InterviewProctoringLockedScreen session={proctoring.session} onBack={() => router.push("/dashboard/interviews")} />
        )}

        {showContent && (
          <>
            {hudActive && (
              <InterviewSessionHud
                phase={proctoring.phase}
                session={proctoring.session}
                lastViolation={proctoring.lastViolation}
                candidateName={user?.name ?? "Candidate"}
                cameraStream={proctoring.cameraStream}
                onResumeFullscreen={proctoring.resumeFullscreen}
              />
            )}

            <div className="max-w-2xl mx-auto w-full p-4 sm:p-6 space-y-5 overflow-y-auto">
              {totalQuestions > 0 && phase !== "complete" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-text-muted">
                    <span>
                      Question {Math.min(answeredCount + 1, totalQuestions)} of {totalQuestions}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalQuestions }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-colors duration-500",
                          i < answeredCount
                            ? "bg-status-success"
                            : i === answeredCount
                            ? "bg-accent-primary"
                            : "bg-elevated"
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}

              {phase === "loading" && (
                <div className="p-16 flex flex-col items-center justify-center gap-3 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Starting your interview...
                </div>
              )}

              {phase === "error" && (
                <div className="p-10 text-center rounded-panel bg-surface border border-border-subtle space-y-3">
                  <div className="w-12 h-12 rounded-full bg-status-danger/10 border border-status-danger/25 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6 text-status-danger" />
                  </div>
                  <h2 className="text-sm font-bold text-primary">Couldn&apos;t start this interview</h2>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">{errorMessage}</p>
                  <button
                    onClick={startInterview}
                    disabled={starting}
                    className="mt-1 flex items-center gap-1.5 mx-auto px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Try Again
                  </button>
                </div>
              )}

              {phase === "complete" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="p-8 sm:p-10 text-center rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-5"
                >
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center mx-auto"
                  >
                    <PartyPopper className="w-8 h-8 text-accent-primary" />
                  </motion.div>
                  <div>
                    <h2 className="text-lg font-bold text-primary">Interview complete</h2>
                    {!result || result.status === "scoring" ? (
                      <p className="text-xs text-text-muted max-w-sm mx-auto mt-1.5 flex items-center justify-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Scoring your interview with AI...
                      </p>
                    ) : result.status === "needs_human_review" ? (
                      <p className="text-xs text-text-muted max-w-sm mx-auto mt-1.5">
                        Your answers have been saved. A real person will review your responses.
                      </p>
                    ) : (
                      <p className="text-xs text-text-muted max-w-sm mx-auto mt-1.5">
                        Here&apos;s how you did — a human reviewer can still adjust this afterward.
                      </p>
                    )}
                  </div>

                  {totalQuestions > 0 && (
                    <div className="flex items-center justify-center gap-6 py-3 border-y border-border-subtle">
                      <Stat value={String(Math.max(answeredCount, totalQuestions))} label="Questions answered" />
                      {completionElapsedSeconds !== null && (
                        <Stat value={formatClock(completionElapsedSeconds)} label="Time taken" />
                      )}
                    </div>
                  )}

                  {result?.status === "scored" ? (
                    <div className="text-left space-y-4">
                      <div className="flex items-center gap-4 p-4 rounded-control bg-elevated/60 border border-border-subtle">
                        <div
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center border-2 shrink-0",
                            result.passed === false ? "border-status-danger text-status-danger" : "border-accent-primary text-accent-primary"
                          )}
                        >
                          <span className="text-base font-black tabular-nums">{Math.round(result.composite_score_percent ?? 0)}%</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                            <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
                            AI-Scored Result
                          </div>
                          {result.passed !== null && (
                            <div
                              className={cn(
                                "flex items-center gap-1 text-[11px] font-semibold mt-0.5",
                                result.passed ? "text-status-success" : "text-status-danger"
                              )}
                            >
                              {result.passed ? <ThumbsUp className="w-3 h-3" /> : <ThumbsDown className="w-3 h-3" />}
                              {result.passed ? "You passed this round" : "Didn't clear this round's threshold"}
                            </div>
                          )}
                        </div>
                      </div>

                      {result.responses.length > 0 && (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Per-question feedback</p>
                          {result.responses.map((r, i) => (
                            <div key={i} className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-semibold text-primary line-clamp-1">{r.question_text}</span>
                                <span className="text-[11px] font-bold text-accent-primary shrink-0">{r.score}/100</span>
                              </div>
                              <p className="text-[10.5px] text-text-secondary mt-1 leading-relaxed">{r.feedback}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-[10px] text-text-muted text-center">Scored by AI — a human reviewer can still adjust this.</p>
                    </div>
                  ) : (
                    <div className="text-left max-w-xs mx-auto space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">What happens next</p>
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                          <UserCheck className="w-3.5 h-3.5 text-accent-primary" />
                        </div>
                        <p className="text-xs text-text-secondary">
                          {result?.status === "needs_human_review"
                            ? "A reviewer reads your transcripts and listens to your recordings."
                            : "Your interview is being scored by AI right now."}
                        </p>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-elevated border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-text-muted" />
                        </div>
                        <p className="text-xs text-text-secondary">You&apos;ll hear back through the platform once it&apos;s ready.</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => router.push("/dashboard/interviews")}
                    className="mt-2 px-5 py-2.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors"
                  >
                    Back to Interviews
                  </button>
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {question && phase !== "loading" && phase !== "error" && phase !== "complete" && (
                  <motion.div
                    key={question.interview_question_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden"
                  >
                    <div className="p-6 sm:p-7 space-y-5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border", CATEGORY_COLORS[question.category])}>
                          {CATEGORY_LABELS[question.category]}
                        </span>
                        <span className={cn("px-1.5 py-0.5 text-[9px] font-bold rounded capitalize", DIFFICULTY_COLORS[question.difficulty])}>
                          {question.difficulty}
                        </span>
                        {phase === "speaking" && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-accent-primary ml-auto">
                            <Volume2 className="w-3 h-3 animate-pulse" />
                            Reading question aloud...
                          </span>
                        )}
                      </div>

                      <p className="text-lg sm:text-xl font-bold text-primary leading-snug">{question.question_text}</p>

                      {phase === "prep" && (
                        <div className="pt-2 flex flex-col items-center gap-4 text-center">
                          <div className="relative w-24 h-24 flex items-center justify-center">
                            <CountdownRing ratio={prepSecondsLeft / PREP_SECONDS} size={96} />
                            <span className="text-3xl font-black text-primary tabular-nums">{prepSecondsLeft}</span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-primary">Get ready to answer</p>
                            <p className="text-[11px] text-text-muted mt-0.5">Recording starts automatically — or jump in now.</p>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            onClick={handleStartAnswering}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Start Now
                          </motion.button>
                        </div>
                      )}

                      {phase === "listening" && (
                        <div className="pt-2 flex flex-col items-center gap-3 text-center">
                          <div className="relative w-24 h-24 flex items-center justify-center">
                            <motion.div
                              className="absolute inset-1 rounded-full bg-status-danger/20"
                              animate={{ scale: 1 + (levelHistory[levelHistory.length - 1] ?? 0) * 0.35 }}
                              transition={{ duration: 0.12, ease: "easeOut" }}
                            />
                            <CountdownRing ratio={Math.max(0, listeningSecondsLeft / responseSeconds)} size={96} />
                            <motion.button
                              whileTap={{ scale: 0.94 }}
                              onClick={() => handleStopAnswering(false)}
                              className="relative w-16 h-16 rounded-full bg-status-danger/15 border-2 border-status-danger flex items-center justify-center animate-pulse hover:bg-status-danger/25 transition-colors"
                              title="Stop & review"
                            >
                              <Mic className="w-6 h-6 text-status-danger" />
                            </motion.button>
                          </div>

                          <AudioLevelBars levels={levelHistory} />

                          <span
                            className={cn(
                              "text-sm font-mono font-bold tabular-nums",
                              listeningSecondsLeft <= responseSeconds * 0.15 ? "text-status-danger" : "text-text-secondary"
                            )}
                          >
                            {formatClock(listeningSecondsLeft)}
                          </span>

                          {interimCaption ? (
                            <p className="max-w-sm min-h-[2.5em] text-[11.5px] text-text-secondary italic leading-relaxed flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-status-danger animate-pulse shrink-0 mt-1" />
                              <span>{interimCaption.length > 180 ? `…${interimCaption.slice(-180)}` : interimCaption}</span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-text-muted italic">Listening — start speaking whenever you&apos;re ready.</p>
                          )}

                          {listenHint && <p className="text-[10px] font-semibold text-status-warning">{listenHint}</p>}

                          <button
                            onClick={() => handleStopAnswering(false)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-primary transition-colors"
                          >
                            <Square className="w-3.5 h-3.5" />
                            Stop &amp; Review
                          </button>
                        </div>
                      )}

                      {phase === "text_fallback" && (
                        <div className="pt-2 space-y-2">
                          {micErrorMessage && (
                            <div className="flex items-start gap-2 px-3 py-2.5 rounded-control bg-status-warning/10 border border-status-warning/25 text-[11px] text-text-secondary">
                              <AlertTriangle className="w-3.5 h-3.5 text-status-warning shrink-0 mt-0.5" />
                              <span>{micErrorMessage}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-semibold text-text-secondary flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5" />
                              Type your answer
                            </label>
                            <span
                              className={cn(
                                "text-[11px] font-mono font-bold tabular-nums flex items-center gap-1",
                                typingSecondsLeft <= responseSeconds * 0.15 ? "text-status-danger" : "text-text-muted"
                              )}
                            >
                              <Clock3 className="w-3 h-3" />
                              {formatClock(typingSecondsLeft)}
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-elevated overflow-hidden">
                            <div
                              className="h-full transition-[width] duration-1000 ease-linear"
                              style={{
                                width: `${Math.max(0, (typingSecondsLeft / responseSeconds) * 100)}%`,
                                backgroundColor: urgencyColor(typingSecondsLeft / responseSeconds),
                              }}
                            />
                          </div>
                          <textarea
                            autoFocus
                            rows={5}
                            value={transcriptDraft}
                            onChange={(e) => setTranscriptDraft(e.target.value)}
                            placeholder="Write your answer here..."
                            className="w-full px-3 py-2.5 rounded-control bg-elevated border border-border-subtle text-sm text-primary outline-none focus:border-accent-primary"
                          />
                          <button
                            onClick={() => handleTextFallbackContinue(false)}
                            disabled={!transcriptDraft.trim()}
                            className="w-full py-2.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            Continue
                          </button>
                        </div>
                      )}

                      {(phase === "reviewing_answer" || phase === "submitting") && (
                        <div className="pt-2 space-y-3">
                          {timedOut && (
                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-status-warning/10 border border-status-warning/25 text-[11px] font-semibold text-status-warning">
                              <Clock3 className="w-3.5 h-3.5" />
                              Time&apos;s up — here&apos;s what was captured. Review and submit, or re-record.
                            </div>
                          )}
                          <label className="text-[11px] font-semibold text-text-secondary flex items-center gap-1.5">
                            <Edit3 className="w-3.5 h-3.5" />
                            Review your answer (edit if needed)
                          </label>
                          <textarea
                            rows={5}
                            value={transcriptDraft}
                            onChange={(e) => setTranscriptDraft(e.target.value)}
                            disabled={phase === "submitting"}
                            className="w-full px-3 py-2.5 rounded-control bg-elevated border border-border-subtle text-sm text-primary outline-none focus:border-accent-primary disabled:opacity-60"
                          />
                          {audioUrl && (
                            <div>
                              <p className="text-[10px] font-semibold text-text-muted mb-1">Your recording</p>
                              <audio controls src={audioUrl} className="w-full h-9" />
                            </div>
                          )}
                          {errorMessage && <p className="text-[11px] text-status-danger">{errorMessage}</p>}
                          <div className="flex items-center gap-2">
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              onClick={handleReRecord}
                              disabled={phase === "submitting"}
                              title="Re-record your answer"
                              className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Re-record</span>
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              onClick={handleSubmitAnswer}
                              disabled={phase === "submitting" || !transcriptDraft.trim()}
                              className="flex-1 py-2.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {phase === "submitting" ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Submitting...
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  Submit Answer
                                </>
                              )}
                            </motion.button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="px-6 py-3 bg-elevated/40 border-t border-border-subtle flex items-center gap-1.5 text-[10px] text-text-muted">
                      <CheckCircle2 className="w-3 h-3" />
                      Nothing here is auto-scored — a real person reviews your recorded answer.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
