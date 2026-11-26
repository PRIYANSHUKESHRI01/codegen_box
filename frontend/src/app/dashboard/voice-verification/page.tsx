"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Mic,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { AptRunOrb } from "@/components/dashboard/interviews/room/AptRunOrb";
import { AnswerEditor } from "@/components/dashboard/interviews/room/AnswerEditor";
import { CameraTile } from "@/components/dashboard/interviews/room/CameraTile";
import { MicStrip } from "@/components/dashboard/interviews/room/MicStrip";
import { RoomBackdrop } from "@/components/dashboard/interviews/room/RoomBackdrop";
import { useRoomSignal } from "@/components/dashboard/interviews/room/roomSignal";
import { InterviewProctoringConsentGate } from "@/components/proctoring/InterviewProctoringConsentGate";
import { InterviewSessionHud, StrikePill } from "@/components/proctoring/InterviewSessionHud";
import { InterviewProctoringLockedScreen } from "@/components/proctoring/InterviewProctoringLockedScreen";
import { api, ApiError } from "@/lib/api";
import { useInterviewProctoring } from "@/lib/proctoring/useInterviewProctoring";
import { toast } from "@/lib/toast";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { cn } from "@/lib/utils";
import { BrowserVoiceEngine } from "@/lib/voice/browserVoiceEngine";
import { extractAcousticSignature } from "@/lib/voice/acousticSignature";
import { hasMediaRecorder, hasSpeechRecognition, type VoiceEngine } from "@/lib/voice/VoiceEngine";
import type { VoiceVerificationPromptItem, VoiceVerificationStatusResponse } from "@/types/voiceVerification";

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

const SHORT_STEP_LABELS = ["Intro", "Project", "Problem", "Teamwork", "Passphrase"];

function PromptProgressRing({ ratio, active, metMin }: { ratio: number; active: boolean; metMin: boolean }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeColor = !active ? "#818cf8" : metMin ? "#10b981" : "#22d3ee";

  return (
    <svg aria-hidden viewBox="0 0 100 100" className="pointer-events-none absolute -inset-[5%] h-[110%] w-[110%] -rotate-90">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="0.8" className="text-text-muted/20" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - (active ? Math.min(1, Math.max(0.03, ratio)) : 0))}
        style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.35s ease", filter: `drop-shadow(0 0 1.4px ${strokeColor})` }}
      />
    </svg>
  );
}

export default function VoiceVerificationPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <VoiceVerificationContent />
    </Suspense>
  );
}

function VoiceVerificationContent() {
  const { status: authStatus, user } = useAuthGuard(["user"]);
  const params = useSearchParams();
  const returnTo = params.get("returnTo") || "/dashboard/vault-interviews";

  const [data, setData] = useState<VoiceVerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number>(1);
  const [phase, setPhase] = useState<"idle" | "recording" | "review" | "saving" | "completing">("idle");
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryingEnrollment, setRetryingEnrollment] = useState(false);

  const engineRef = useRef<VoiceEngine>(new BrowserVoiceEngine());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const signal = useRoomSignal();

  const needsProctoring = Boolean(
    data && data.status !== "verified" && data.status !== "blocked" && !data.can_retry_enrollment
  );
  const proctoring = useInterviewProctoring({
    basePath: "/voice-verification",
    enabled: authStatus === "ready" && needsProctoring,
    activityLabel: "voice verification",
    getContext: () => ({ phase: phase === "recording" ? "listening" : phase, prompt: activeIndex }),
  });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<VoiceVerificationStatusResponse>("/voice-verification/status");
      setData(res);
      const firstIncomplete = res.prompts.find((p) => !p.completed);
      if (firstIncomplete) {
        setActiveIndex(firstIncomplete.position);
      } else if (res.prompts.length > 0) {
        setActiveIndex(res.prompts[0].position);
      }
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Could not load voice verification details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "ready") {
      void fetchStatus();
    }
  }, [authStatus, fetchStatus]);

  useEffect(() => {
    if (proctoring.phase === "locked") {
      void fetchStatus();
    }
  }, [proctoring.phase, fetchStatus]);

  const handleRetryEnrollment = async () => {
    if (retryingEnrollment) return;
    setRetryingEnrollment(true);
    try {
      await api.post("/voice-verification/retry", {});
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not start a new attempt.");
      setRetryingEnrollment(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      engineRef.current.cancel();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const activePrompt: VoiceVerificationPromptItem | null = useMemo(
    () => data?.prompts.find((p) => p.position === activeIndex) ?? data?.prompts[0] ?? null,
    [data, activeIndex]
  );

  const micLabel = useMemo(
    () => proctoring.cameraStream?.getAudioTracks()[0]?.label?.trim() || null,
    [proctoring.cameraStream]
  );

  const resetCapture = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setTranscript("");
    setInterimText("");
    setElapsedSec(0);
    setErrorMsg(null);
    setPhase("idle");
    signal.level = 0;
  }, [audioUrl, signal]);

  const handleStartRecording = async () => {
    if (!activePrompt) return;
    if (!hasMediaRecorder() && !hasSpeechRecognition()) {
      setErrorMsg("Microphone recording is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return;
    }

    resetCapture();
    try {
      await api.post("/voice-verification/start", {});
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
        return;
      }
    }

    startedAtRef.current = Date.now();
    setPhase("recording");
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 400);

    await engineRef.current.startListening({
      onInterimTranscript: (full, parts) => {
        setTranscript(parts?.final ?? full);
        setInterimText(full);
      },
      onAudioLevel: (lvl) => {
        signal.level = lvl;
      },
      onError: (kind) => {
        if (kind === "permission_denied") {
          setErrorMsg("Microphone permission was denied. Please allow microphone access to record your voice verification.");
        }
      },
    });
  };

  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const { transcript: finalTxt, audioBlob: blob } = await engineRef.current.stopListening();
    const dur = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    setElapsedSec(dur);
    signal.level = 0;

    if (finalTxt.trim()) {
      setTranscript(finalTxt.trim());
    }
    if (blob) {
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
    }
    setPhase("review");
  };

  const handleSaveSample = async () => {
    if (!activePrompt || !audioBlob) {
      setErrorMsg("No audio recording was captured. Please record your response again.");
      return;
    }

    setPhase("saving");
    setErrorMsg(null);

    try {
      const fd = new FormData();
      fd.append("prompt_index", String(activePrompt.position));
      fd.append("audio", audioBlob, `voice_prompt_${activePrompt.position}.webm`);
      fd.append("duration_seconds", String(Math.max(1, elapsedSec)));
      if (transcript.trim()) {
        fd.append("transcript_text", transcript.trim());
      }
      const sig = await extractAcousticSignature(audioBlob);
      if (sig) {
        fd.append("acoustic_features", JSON.stringify(sig));
      }

      const res = await api.postFormData<{ message: string; voice_verification: VoiceVerificationStatusResponse }>(
        "/voice-verification/sample",
        fd
      );

      setData(res.voice_verification);
      toast.success(`Prompt ${activePrompt.position} saved!`);
      resetCapture();

      const nextIncomplete = res.voice_verification.prompts.find((p) => !p.completed);
      if (nextIncomplete) {
        setActiveIndex(nextIncomplete.position);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 423) {
        proctoring.lockSession(err.message);
        return;
      }
      setErrorMsg(err instanceof ApiError ? err.message : "Could not save your voice sample. Please try again.");
      setPhase("review");
    }
  };

  const handleCompleteEnrollment = async () => {
    setPhase("completing");
    setErrorMsg(null);
    try {
      const res = await api.post<{ message: string; voice_verification: VoiceVerificationStatusResponse }>(
        "/voice-verification/complete",
        {}
      );
      proctoring.endSession();
      setData(res.voice_verification);
      toast.success("5-Minute Voice Verification complete!");
    } catch (err) {
      setErrorMsg(err instanceof ApiError ? err.message : "Unable to finalize voice verification yet.");
    } finally {
      setPhase("idle");
    }
  };

  if (authStatus !== "ready" || loading) return <SessionLoader />;

  const showConsentGate =
    needsProctoring && (proctoring.phase === "consent" || proctoring.phase === "starting" || proctoring.phase === "blocked");
  const showLockedScreen = (needsProctoring && proctoring.phase === "locked") || Boolean(data?.can_retry_enrollment);
  const hudActive = needsProctoring && (proctoring.phase === "active" || proctoring.phase === "fullscreen_lost");
  const bootingProctoring = needsProctoring && !showConsentGate && !showLockedScreen && !hudActive;

  if (bootingProctoring) {
    return <SessionLoader />;
  }

  if (showConsentGate) {
    return (
      <DashboardShell role="user" title="5-Minute Voice Identity Verification" fullBleed hideChrome>
        <div className="flex flex-1 flex-col min-h-0">
          <InterviewProctoringConsentGate
            phase={proctoring.phase}
            consentError={proctoring.consentError}
            devicePreviewReady={proctoring.devicePreviewReady}
            previewVideoRef={proctoring.previewVideoRef}
            onEnableDevices={proctoring.enableDevicePreview}
            onConsent={(photo?: string | null, descriptor?: number[] | null) => {
              if (photo) {
                proctoring.setBaselineIdentity(photo, descriptor ?? null);
              }
              void proctoring.grantConsentAndStart();
            }}
            cameraStream={proctoring.cameraStream}
            candidateName={user?.name ?? "Candidate"}
            sessionLabel="Voice Identity Studio"
            sessionNote="One-time 5-minute proctored baseline"
            onLeave={() => {
              window.location.href = returnTo;
            }}
          />
        </div>
      </DashboardShell>
    );
  }

  if (showLockedScreen) {
    const remaining = data?.remaining_enrollment_attempts ?? 0;
    const maxAttempts = data?.max_enrollment_attempts ?? 3;
    const lockCount = data?.enrollment_lock_count ?? 0;
    const canRetry = remaining > 0 && data?.status !== "blocked";

    return (
      <DashboardShell role="user" title="5-Minute Voice Identity Verification" fullBleed hideChrome>
        <div className="flex flex-1 flex-col min-h-0">
          <InterviewProctoringLockedScreen
            session={proctoring.session}
            reason={data?.blocked_reason ?? undefined}
            retryAction={
              canRetry
                ? {
                    label: `Try Again (${remaining} ${remaining === 1 ? "attempt" : "attempts"} left)`,
                    hint: `Attempt ${lockCount} of ${maxAttempts} was stopped by proctoring. You can retry up to ${maxAttempts} times — after ${maxAttempts} blocks, you will need to contact an administrator.`,
                    busy: retryingEnrollment,
                    onRetry: handleRetryEnrollment,
                  }
                : undefined
            }
            onBack={() => {
              window.location.href = returnTo;
            }}
          />
        </div>
      </DashboardShell>
    );
  }

  const totalSec = data?.total_duration_seconds ?? 0;
  const targetTotalSec = data?.required_duration_seconds ?? 300;
  const minEnrollSec = data?.min_enroll_duration_seconds ?? 100;
  const promptTarget = activePrompt?.target_seconds ?? 60;
  const promptMin = activePrompt?.min_seconds ?? 20;
  const metPromptMin = elapsedSec >= promptMin;
  const promptRatio = promptTarget > 0 ? elapsedSec / promptTarget : 0;

  // Live proctored enrollment studio layout (mirrors InterviewRoom.tsx)
  if (hudActive && data && activePrompt) {
    return (
      <DashboardShell role="user" title="Voice Identity Studio" fullBleed hideChrome>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-primary">
          <RoomBackdrop />

          <InterviewSessionHud
            embedded
            phase={proctoring.phase}
            session={proctoring.session}
            lastViolation={proctoring.lastViolation}
            candidateName={user?.name ?? "Candidate"}
            cameraStream={proctoring.cameraStream}
            onResumeFullscreen={proctoring.resumeFullscreen}
          />

          {/* Top Studio Header */}
          <header className="relative z-10 flex flex-wrap items-center gap-x-5 gap-y-3 px-5 pb-2 pt-4 sm:px-8 sm:pt-5">
            <div className="flex shrink-0 items-center gap-3">
              <Wordmark className="text-xl sm:text-2xl" />
              <span className="hidden h-6 w-px bg-border-strong sm:block" aria-hidden />
              <div className="hidden min-w-0 sm:block">
                <p className="text-2xs font-extrabold leading-tight text-primary">Voice Identity Studio</p>
                <p className="text-3xs font-semibold leading-tight text-text-muted">One-time 5-min baseline · Complete once</p>
              </div>
            </div>

            {/* 5-segment progress bar */}
            <ol aria-label="Voice prompt progress" className="hidden flex-1 items-end gap-2 px-4 md:flex max-w-xl mx-auto">
              {data.prompts.map((p, idx) => {
                const isCurrent = p.position === activeIndex;
                const lockedButtons = phase === "recording" || phase === "saving" || phase === "completing";
                return (
                  <li key={p.id} className="min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={lockedButtons}
                      onClick={() => {
                        resetCapture();
                        setActiveIndex(p.position);
                      }}
                      className="w-full text-left disabled:cursor-default"
                    >
                      <p
                        className={cn(
                          "mb-1.5 truncate text-3xs font-bold transition-colors",
                          isCurrent ? "text-primary" : p.completed ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted"
                        )}
                      >
                        {p.position} · {SHORT_STEP_LABELS[idx] ?? `Prompt ${p.position}`}
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-text-muted/20">
                        <motion.div
                          className={cn(
                            "h-full origin-left rounded-full",
                            p.completed
                              ? "bg-status-success"
                              : "bg-gradient-to-r from-indigo-500 to-cyan-400"
                          )}
                          initial={false}
                          animate={{ scaleX: p.completed ? 1 : isCurrent ? 0.45 : 0 }}
                          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* Total clock + Proctoring Strike Pill */}
            <div className="ml-auto flex shrink-0 items-center gap-2.5 md:ml-0">
              <div
                className="flex items-center gap-2 rounded-2xl border border-border-subtle bg-surface/85 px-3.5 py-2 shadow-sm"
                title="Total recorded voice audio"
              >
                <Clock3 className="h-4 w-4 text-accent-primary" aria-hidden />
                <span className="text-xs font-extrabold tabular-nums text-primary">
                  {formatClock(totalSec)} <span className="text-text-muted font-semibold">/ {formatClock(targetTotalSec)}</span>
                </span>
              </div>
              {proctoring.session && <StrikePill session={proctoring.session} />}
            </div>
          </header>

          {/* Studio 3-Column Workspace */}
          <div className="relative z-10 grid min-h-0 flex-1 gap-6 overflow-y-auto px-5 pb-10 pt-3 sm:px-8 lg:grid-cols-[minmax(230px,280px)_minmax(280px,360px)_minmax(0,1fr)] lg:items-center lg:gap-10">
            {/* Left: Camera, Mic Strip & Guard Badge */}
            <aside className="flex flex-col gap-3.5">
              <MicStrip
                label={micLabel}
                signal={signal}
                live={phase === "recording"}
                hint={phase === "recording" ? "Capturing voiceprint" : "Microphone ready"}
              />
              <CameraTile stream={proctoring.cameraStream} name={user?.name ?? "Candidate"} />
              <div className="rounded-2xl border border-border-subtle bg-surface/80 px-3.5 py-2.5 text-3xs leading-relaxed text-text-secondary shadow-sm">
                <div className="flex items-center gap-1.5 font-extrabold text-primary">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                  Active Biometric Guard
                </div>
                <p className="mt-0.5 text-text-muted">
                  Single-person camera detection, live face match, and fullscreen protection active.
                </p>
              </div>
            </aside>

            {/* Center: Orb, Live Timer Ring & Primary Recording Controls */}
            <section className="flex flex-col items-center justify-center text-center py-4">
              <div className="relative flex items-center justify-center">
                <PromptProgressRing
                  ratio={promptRatio}
                  active={phase === "recording"}
                  metMin={metPromptMin}
                />
                <AptRunOrb
                  mode={phase === "recording" ? "listening" : phase === "saving" || phase === "completing" ? "thinking" : "idle"}
                  signal={signal}
                  className="w-44 sm:w-52"
                />
              </div>

              <div className="mt-5 space-y-1.5">
                <p className="text-3xl font-black tracking-tight tabular-nums text-primary">
                  {formatClock(elapsedSec)}
                </p>
                <p className="text-sm font-bold text-primary">
                  {phase === "recording"
                    ? metPromptMin
                      ? "Great pace — keep speaking or stop to review"
                      : `Listening — speak at least ${Math.max(0, promptMin - elapsedSec)}s more`
                    : phase === "review"
                      ? "Review your recording before saving"
                      : phase === "saving"
                        ? "Analyzing vocal signature..."
                        : activePrompt.completed
                          ? `Prompt ${activePrompt.position} saved (${activePrompt.recorded_duration_seconds}s)`
                          : `Ready for Prompt ${activePrompt.position} of ${data.total_prompts}`}
                </p>
                <p className="text-2xs text-text-muted">
                  Target ~{promptTarget}s · Minimum {promptMin}s clear speech
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {phase === "idle" && (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] hover:from-indigo-500 hover:to-violet-500"
                  >
                    <Mic className="h-4 w-4" aria-hidden />
                    {activePrompt.completed ? `Re-record Prompt ${activePrompt.position}` : "Start Speaking"}
                  </button>
                )}

                {phase === "recording" && (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="inline-flex items-center justify-center gap-2.5 rounded-full bg-status-danger px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-status-danger/30 transition-all hover:opacity-95"
                  >
                    <Square className="h-4 w-4 fill-current" aria-hidden />
                    Stop &amp; Review ({elapsedSec}s)
                  </button>
                )}

                {(phase === "review" || phase === "saving") && (
                  <>
                    <button
                      type="button"
                      disabled={phase === "saving"}
                      onClick={handleSaveSample}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {phase === "saving" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving &amp; Analyzing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" aria-hidden /> Save Prompt {activePrompt.position}
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={phase === "saving"}
                      onClick={handleStartRecording}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border-strong bg-surface/90 px-5 py-3.5 text-xs font-bold text-text-secondary shadow-sm hover:text-primary"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Re-record
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* Right: Prompt Card, Live Transcript / Review Audio Player, & Finalize Banner */}
            <section className="flex min-h-0 flex-col gap-4">
              {/* Mobile/Tablet Prompt Selector */}
              <div className="flex flex-wrap gap-1.5 md:hidden">
                {data.prompts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={phase === "recording" || phase === "saving" || phase === "completing"}
                    onClick={() => {
                      resetCapture();
                      setActiveIndex(p.position);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-3xs font-bold",
                      p.position === activeIndex
                        ? "border-accent-primary bg-accent-primary text-white"
                        : p.completed
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                          : "border-border-subtle bg-surface text-text-muted"
                    )}
                  >
                    #{p.position} {p.completed ? "✓" : ""}
                  </button>
                ))}
              </div>

              <div className="rounded-3xl border border-border-subtle bg-surface/95 p-6 shadow-xl shadow-black/[0.04] backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-3 py-1 text-3xs font-extrabold uppercase tracking-wider text-accent-primary">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Prompt {activePrompt.position} of {data.total_prompts} · {activePrompt.title}
                  </span>
                  {activePrompt.completed && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-3xs font-bold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> {activePrompt.recorded_duration_seconds}s saved
                    </span>
                  )}
                </div>

                <p className="mt-4 text-base font-bold leading-relaxed text-primary sm:text-lg">
                  {activePrompt.prompt_text}
                </p>

                {activePrompt.guidance && (
                  <p className="mt-4 flex items-start gap-2.5 rounded-2xl border border-border-subtle bg-elevated/60 px-4 py-3 text-xs leading-relaxed text-text-secondary">
                    <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden />
                    <span>{activePrompt.guidance}</span>
                  </p>
                )}
              </div>

              {errorMsg && (
                <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-status-danger/35 bg-status-danger/10 p-4 text-xs font-semibold text-status-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{errorMsg}</span>
                </div>
              )}

              {phase === "recording" && (
                <div className="rounded-2xl border border-cyan-500/35 bg-surface/95 p-5 shadow-md">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                    <p className="text-2xs font-extrabold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
                      Live Speech Capture
                    </p>
                  </div>
                  <p className="min-h-[4.5rem] max-h-40 overflow-y-auto text-sm leading-relaxed text-primary">
                    {interimText || (
                      <span className="italic text-text-muted">Listening — speak naturally in your normal interview voice...</span>
                    )}
                  </p>
                </div>
              )}

              {(phase === "review" || phase === "saving") && (
                <AnswerEditor
                  label={`Prompt ${activePrompt.position} Recording`}
                  value={transcript}
                  audioUrl={audioUrl}
                  recordedSeconds={elapsedSec}
                  disabled={phase === "saving"}
                  placeholder="Your audio recording is ready — click Save Prompt to analyze & transcribe."
                />
              )}

              {data.ready_to_complete ? (
                <div className="flex flex-col gap-3 rounded-3xl border-2 border-emerald-500/45 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 p-5 shadow-lg sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-primary">All {data.total_prompts} voice prompts captured!</p>
                    <p className="text-xs text-text-secondary">
                      Finalize to create your biometric voice profile and unlock Vault AI &amp; Mock AI interviews.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={phase === "completing" || phase === "recording"}
                    onClick={handleCompleteEnrollment}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {phase === "completing" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Finalizing...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4" aria-hidden /> Finalize &amp; Unlock
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p className="text-center text-2xs font-medium text-text-muted sm:text-left">
                  Progress: <strong className="text-primary">{data.samples_count}/{data.total_prompts}</strong> prompts saved ·{" "}
                  Minimum <strong className="text-primary">{formatClock(minEnrollSec)}</strong> total speech required ({formatClock(totalSec)} recorded)
                </p>
              )}
            </section>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Fallback shell for Verified / Blocked views
  return (
    <DashboardShell
      role="user"
      title="5-Minute Voice Identity Verification"
      subtitle="One-time proctored baseline voice interview — required once before taking Vault AI or Mock AI interviews."
      back={{ href: returnTo, label: "Back to Interviews" }}
    >
      <div className="mx-auto max-w-4xl space-y-6 py-2">
        {data?.status === "blocked" && (
          <div className="relative overflow-hidden rounded-3xl border-2 border-status-danger/40 bg-status-danger/[0.06] p-7 shadow-xl">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-status-danger/30 bg-status-danger/15 text-status-danger">
                <ShieldAlert className="h-7 w-7" aria-hidden />
              </div>
              <div className="space-y-2.5">
                <span className="inline-flex rounded-full bg-status-danger/15 px-3 py-0.5 text-3xs font-extrabold uppercase tracking-wider text-status-danger">
                  Access Blocked
                </span>
                <h2 className="text-xl font-extrabold text-primary">Voice Verification Profile Blocked</h2>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {data.blocked_reason ||
                    "Your account's interview access was blocked due to a voice mismatch or repeated proctoring violations."}
                </p>
                <p className="rounded-2xl border border-border-subtle bg-surface/90 p-4 text-xs leading-relaxed text-text-muted">
                  Please contact your college Placement Cell (TPO) or AptRun administrator to review your verification logs and reinstate access.
                </p>
              </div>
            </div>
          </div>
        )}

        {data?.status === "verified" && (
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/35 bg-gradient-to-br from-emerald-500/[0.12] via-surface to-cyan-500/[0.06] p-7 shadow-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-5">
                <AptRunOrb mode="idle" signal={signal} className="hidden w-24 shrink-0 sm:block" />
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-0.5 text-3xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    One-Time Biometric Credential Active
                  </span>
                  <h2 className="text-2xl font-extrabold tracking-tight text-primary">Voice Identity Verified</h2>
                  <p className="max-w-xl text-sm leading-relaxed text-text-secondary">
                    Completed {data.samples_count} baseline prompts ({formatClock(data.total_duration_seconds)} spoken audio). Your voiceprint automatically verifies your identity in every Vault AI and Mock AI interview.
                  </p>
                  {data.voice_summary && (
                    <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-surface/90 px-4 py-3 text-xs leading-relaxed text-text-secondary">
                      <span className="font-bold text-primary">Vocal Biometric Profile: </span>
                      {data.voice_summary}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2.5 lg:w-60">
                <Link
                  href={returnTo}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 hover:from-indigo-500 hover:to-violet-500"
                >
                  Continue to Interviews
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/dashboard/interviews"
                  className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-subtle bg-surface px-5 py-2.5 text-xs font-bold text-text-secondary hover:text-primary"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Open Mock AI Interview
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
