"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Mic,
  Square,
  RotateCcw,
  Trophy,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Gauge,
} from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BrowserVoiceEngine } from "@/lib/voice/browserVoiceEngine";
import { hasSpeechRecognition, hasMediaRecorder } from "@/lib/voice/VoiceEngine";
import { SPEAKING_PASS_THRESHOLD, type SpeakingAttemptResult, type SpeakingPromptDetail } from "@/types/learningCentre";

type Stage = "loading" | "idle" | "recording" | "scoring" | "result" | "unsupported" | "not_found";

const MAX_RECORDING_SECONDS = 180;

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex items-center justify-between text-2xs mb-1">
        <span className="font-semibold text-text-muted">{label}</span>
        <span className="font-mono font-bold text-primary">{value ?? "—"}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value ?? 0}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn("h-full rounded-full", (value ?? 0) >= SPEAKING_PASS_THRESHOLD ? "bg-status-success" : "bg-status-warning")}
        />
      </div>
    </div>
  );
}

export default function SpeakingSessionPage() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const promptId = searchParams.get("promptId") ?? "";

  const [stage, setStage] = useState<Stage>("loading");
  const [prompt, setPrompt] = useState<SpeakingPromptDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [liveTranscript, setLiveTranscript] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<SpeakingAttemptResult | null>(null);

  const engineRef = useRef<BrowserVoiceEngine | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    engineRef.current = new BrowserVoiceEngine();
    return () => {
      engineRef.current?.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadPrompt = useCallback(async () => {
    if (!promptId) {
      setStage("not_found");
      return;
    }
    try {
      const res = await api.get<{ prompt: SpeakingPromptDetail }>(`/learning-centre/speaking/prompts/${promptId}`);
      setPrompt(res.prompt);
      setStage(hasSpeechRecognition() && hasMediaRecorder() ? "idle" : "unsupported");
    } catch {
      setStage("not_found");
    }
  }, [promptId]);

  useEffect(() => {
    if (status === "ready") loadPrompt();
  }, [status, loadPrompt]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStop = useCallback(async () => {
    stopTimer();
    const engine = engineRef.current;
    if (!engine) return;

    const { transcript, audioBlob } = await engine.stopListening();

    if (!transcript.trim()) {
      setError("We couldn't hear you clearly — check your microphone and try again.");
      setStage("idle");
      setElapsedSeconds(0);
      return;
    }

    setStage("scoring");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("transcript_text", transcript);
      formData.append("duration_seconds", String(Math.max(1, elapsedSeconds)));
      if (audioBlob) {
        const ext = audioBlob.type.includes("ogg") ? "ogg" : audioBlob.type.includes("mp4") ? "m4a" : "webm";
        formData.append("audio", audioBlob, `attempt.${ext}`);
      }

      const res = await api.postFormData<{ attempt: SpeakingAttemptResult }>(
        `/learning-centre/speaking/prompts/${promptId}/attempts`,
        formData
      );
      setResult(res.attempt);
      setStage("result");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Scoring failed. Please try again.");
      setStage("idle");
    } finally {
      setElapsedSeconds(0);
      setLiveTranscript("");
    }
  }, [elapsedSeconds, promptId]);

  const handleStopRef = useRef(handleStop);
  useEffect(() => {
    handleStopRef.current = handleStop;
  }, [handleStop]);

  const handleStart = async () => {
    const engine = engineRef.current;
    if (!engine) return;

    setError(null);
    setLiveTranscript("");
    setElapsedSeconds(0);

    try {
      await engine.startListening({
        onInterimTranscript: (text) => setLiveTranscript(text),
        onAudioLevel: (level) => setMicLevel(level),
        onError: (kind) => {
          if (kind === "permission_denied") {
            setError("Microphone access was denied — allow it in your browser settings to practice speaking.");
          }
        },
      });
    } catch (err) {
      const cause = err instanceof Error ? (err.cause as string | undefined) : undefined;
      setError(
        cause === "permission_denied"
          ? "Microphone access was denied — allow it in your browser settings to practice speaking."
          : "Couldn't access your microphone. Please try again."
      );
      return;
    }

    setStage("recording");
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          handleStopRef.current();
        }
        return next;
      });
    }, 1000);
  };

  const handleRetry = () => {
    setResult(null);
    setStage("idle");
  };

  const timeLabel = useMemo(() => {
    const m = Math.floor(elapsedSeconds / 60);
    const s = elapsedSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [elapsedSeconds]);

  const pacingLabel = (wpm: number | null) => {
    if (wpm === null || !prompt) return null;
    if (wpm < prompt.target_wpm_min) return { text: "A little slow — try to flow more naturally", tone: "text-status-warning" };
    if (wpm > prompt.target_wpm_max) return { text: "A little fast — slow down for clarity", tone: "text-status-warning" };
    return { text: "Great pace!", tone: "text-status-success" };
  };

  if (status !== "ready" || stage === "loading") return <SessionLoader />;

  if (stage === "not_found" || !prompt) {
    return (
      <DashboardShell role="user" title="Speaking Practice">
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle space-y-3">
          <p>This prompt couldn&apos;t be found.</p>
          <Link href="/dashboard/learning-centre/speaking" className="text-accent-primary font-semibold hover:underline">
            Back to prompts
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="user" title="Speaking Practice" subtitle={prompt.title}>
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/dashboard/learning-centre/speaking"
          className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All prompts
        </Link>

        {error && stage !== "recording" && (
          <div className="flex items-start gap-2 p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {stage === "unsupported" && (
          <div className="flex items-start gap-2 p-4 rounded-panel bg-status-warning/10 border border-status-warning/25 text-xs text-status-warning">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Your browser doesn&apos;t support speech recognition for Speaking Practice yet. Try the latest Chrome or Edge on desktop.</span>
          </div>
        )}

        {/* Passage */}
        <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">{prompt.category} · {prompt.difficulty}</span>
            <span className="text-3xs text-text-muted">{prompt.word_count} words</span>
          </div>
          <p className="text-sm leading-relaxed text-primary font-medium">{prompt.passage_text}</p>
        </div>

        {/* Recorder / live state */}
        <AnimatePresence mode="wait">
          {(stage === "idle" || stage === "recording") && (
            <motion.div
              key="recorder"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-6 flex flex-col items-center gap-4"
            >
              <div className="relative flex items-center justify-center">
                {stage === "recording" && (
                  <motion.span
                    aria-hidden
                    className="absolute rounded-full bg-status-danger/20"
                    animate={{ scale: 1 + micLevel * 1.4, opacity: 0.6 - micLevel * 0.3 }}
                    transition={{ duration: 0.12 }}
                    style={{ width: 88, height: 88 }}
                  />
                )}
                <button
                  onClick={stage === "idle" ? handleStart : handleStop}
                  className={cn(
                    "relative z-10 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-card transition-colors",
                    stage === "recording" ? "bg-status-danger hover:bg-status-danger/90" : "bg-accent-primary hover:bg-accent-primary-hover"
                  )}
                  aria-label={stage === "recording" ? "Stop recording" : "Start recording"}
                >
                  {stage === "recording" ? <Square className="w-6 h-6" /> : <Mic className="w-7 h-7" />}
                </button>
              </div>

              {stage === "recording" ? (
                <div className="text-center space-y-1">
                  <span className="font-mono text-lg font-bold text-status-danger tabular-nums">{timeLabel}</span>
                  <p className="text-2xs text-text-muted">Tap the square to finish and submit</p>
                </div>
              ) : (
                <p className="text-xs text-text-muted text-center">Tap the mic and read the passage above aloud</p>
              )}

              {stage === "recording" && liveTranscript && (
                <p className="w-full text-xs text-text-muted italic border-t border-border-subtle pt-3 line-clamp-3">
                  &ldquo;{liveTranscript}&rdquo;
                </p>
              )}
            </motion.div>
          )}

          {stage === "scoring" && (
            <motion.div
              key="scoring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-10 flex flex-col items-center gap-3"
            >
              <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
              <p className="text-xs font-semibold text-text-muted">Scoring your speech with AI…</p>
            </motion.div>
          )}

          {stage === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-5"
            >
              {result.scoring_failed ? (
                <div className="flex items-start gap-2 p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>We couldn&apos;t score this attempt. Please try again.</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <ReadinessRing value={result.overall_score ?? 0} label={result.passed ? "Passed" : "Try Again"} />
                    {result.passed ? (
                      <motion.div
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        className="flex items-center gap-1.5 text-status-success font-bold text-sm"
                      >
                        <Trophy className="w-4 h-4" />
                        Nice work — you passed!
                      </motion.div>
                    ) : (
                      <p className="text-sm font-bold text-status-warning">
                        Just short of {SPEAKING_PASS_THRESHOLD}% — try again, you&apos;ve got this.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ScoreBar label="Clarity" value={result.clarity_score} />
                    <ScoreBar label="Fluency" value={result.fluency_score} />
                    <ScoreBar label="Accuracy" value={result.accuracy_score} />
                  </div>

                  {result.pacing_wpm !== null && (
                    <div className="flex items-center gap-2 text-2xs p-2.5 rounded-control bg-elevated">
                      <Gauge className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="font-semibold text-primary">{result.pacing_wpm} words/min</span>
                      {pacingLabel(result.pacing_wpm) && (
                        <span className={cn("font-medium", pacingLabel(result.pacing_wpm)!.tone)}>
                          — {pacingLabel(result.pacing_wpm)!.text}
                        </span>
                      )}
                    </div>
                  )}

                  {result.feedback && (
                    <div className="flex items-start gap-2 text-xs text-primary bg-accent-primary/5 border border-accent-primary/15 rounded-control p-3">
                      <Sparkles className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                      <p>{result.feedback}</p>
                    </div>
                  )}

                  {result.improvement_tips.length > 0 && (
                    <ul className="space-y-1.5">
                      {result.improvement_tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-text-muted">
                          <ChevronRight className="w-3.5 h-3.5 text-accent-primary shrink-0 mt-0.5" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={handleRetry}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-control py-2.5 text-xs font-bold transition-colors",
                    !result.passed
                      ? "bg-accent-primary text-white hover:bg-accent-primary-hover"
                      : "bg-elevated text-primary border border-border-subtle hover:border-accent-primary/40"
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <Link
                  href="/dashboard/learning-centre/speaking"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-control py-2.5 text-xs font-bold transition-colors",
                    result.passed
                      ? "bg-accent-primary text-white hover:bg-accent-primary-hover"
                      : "bg-elevated text-primary border border-border-subtle hover:border-accent-primary/40"
                  )}
                >
                  More Prompts
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}
