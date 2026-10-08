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
  Ear,
  ShieldCheck,
  MessageSquareText,
} from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BrowserVoiceEngine } from "@/lib/voice/browserVoiceEngine";
import { hasMediaRecorder } from "@/lib/voice/VoiceEngine";
import {
  SPEAKING_PASS_THRESHOLD,
  type SpeakingAttemptResult,
  type SpeakingPromptDetail,
  type SpeakingWordResult,
} from "@/types/learningCentre";

type Stage = "loading" | "idle" | "recording" | "scoring" | "result" | "unsupported" | "not_found";

const MAX_RECORDING_SECONDS = 180;

/** Less speech than this in the whole take means the mic was muted or too far away — don't spend a scoring call on it. */
const MIN_VOICED_MS = 800;

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

const WORD_STYLE: Record<SpeakingWordResult["status"], string> = {
  ok: "text-primary",
  close: "text-status-warning bg-status-warning/10 rounded px-0.5",
  wrong: "text-status-warning bg-status-warning/10 rounded px-0.5",
  missed: "text-status-danger underline decoration-dotted decoration-2 underline-offset-4",
};

/** The passage word by word, marked up with what the student actually said — the part of the result that tells them WHAT to fix. */
function WordMap({ words }: { words: SpeakingWordResult[] }) {
  const changed = words.filter((w) => (w.status === "wrong" || w.status === "close") && w.heard);
  const skipped = words.filter((w) => w.status === "missed").length;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-2xs font-bold uppercase tracking-wide text-text-muted">Word by word</h3>
        <div className="flex flex-wrap items-center gap-3 text-3xs font-semibold text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-status-success" /> Spot on
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-status-warning" /> Heard differently
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-status-danger" /> Skipped
          </span>
        </div>
      </div>

      <p className="text-sm leading-loose rounded-control bg-elevated border border-border-subtle p-3.5">
        {words.map((w, i) => (
          <span key={i}>
            <span className={WORD_STYLE[w.status]} title={w.heard ? `Heard as “${w.heard}”` : w.status === "missed" ? "Skipped" : undefined}>
              {w.word}
            </span>{" "}
          </span>
        ))}
      </p>

      {(changed.length > 0 || skipped > 0) && (
        <ul className="space-y-1 text-xs text-text-secondary">
          {changed.slice(0, 6).map((w, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-bold text-status-warning">{w.word.replace(/[.,;:!?]+$/, "")}</span>
              <span className="text-text-muted">— heard as</span>
              <span className="font-semibold text-primary">“{w.heard}”</span>
            </li>
          ))}
          {skipped > 0 && (
            <li className="text-text-muted">
              {skipped} word{skipped === 1 ? "" : "s"} skipped (underlined above).
            </li>
          )}
        </ul>
      )}
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
  const stoppingRef = useRef(false);

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
      // Only recording is required: scoring listens to the audio itself, so browsers without
      // live speech-to-text (Firefox, Safari) work too — they just don't get the live caption.
      setStage(hasMediaRecorder() ? "idle" : "unsupported");
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
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    stopTimer();

    try {
      const engine = engineRef.current;
      if (!engine) return;

      const { transcript, audioBlob, voicedMs } = await engine.stopListening();

      if (!audioBlob || audioBlob.size === 0) {
        setError("We couldn't capture any audio — check your microphone and try again.");
        setStage("idle");
        return;
      }

      // Cheap local check so a muted mic doesn't wait on a network round trip to find out.
      if (voicedMs !== null && voicedMs < MIN_VOICED_MS) {
        setError("We couldn't hear you clearly — check your microphone is unmuted, speak a little louder, and try again.");
        setStage("idle");
        return;
      }

      setStage("scoring");
      setError(null);

      const formData = new FormData();
      formData.append("duration_seconds", String(Math.max(1, elapsedSeconds)));
      // Reference only — the server scores the recording itself and never trusts this caption.
      if (transcript.trim()) formData.append("transcript_text", transcript.trim());
      const ext = audioBlob.type.includes("ogg") ? "ogg" : audioBlob.type.includes("mp4") ? "m4a" : "webm";
      formData.append("audio", audioBlob, `attempt.${ext}`);

      try {
        const res = await api.postFormData<{ attempt: SpeakingAttemptResult }>(
          `/learning-centre/speaking/prompts/${promptId}/attempts`,
          formData
        );
        setResult(res.attempt);
        setStage("result");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Scoring failed. Please try again.");
        setStage("idle");
      }
    } finally {
      stoppingRef.current = false;
      setElapsedSeconds(0);
      setLiveTranscript("");
    }
  }, [elapsedSeconds, promptId]);

  // Auto-finish at the cap. Lives in an effect (not inside the timer's state updater) so
  // the stop is never triggered as a side effect of a React state function.
  useEffect(() => {
    if (stage === "recording" && elapsedSeconds >= MAX_RECORDING_SECONDS) handleStop();
  }, [stage, elapsedSeconds, handleStop]);

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
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
  };

  const handleRetry = () => {
    setResult(null);
    setError(null);
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

  const pace = result ? pacingLabel(result.pacing_wpm) : null;
  const showInterviewNudge = !!result?.passed && prompt.category === "Interview Ready";

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
          <div role="alert" className="flex items-start gap-2 p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {stage === "unsupported" && (
          <div className="flex items-start gap-2 p-4 rounded-panel bg-status-warning/10 border border-status-warning/25 text-xs text-status-warning">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Your browser can&apos;t record audio for Speaking Practice. Try the latest Chrome, Edge, Firefox or Safari.</span>
          </div>
        )}

        {/* Passage — once scored, the word-by-word view below replaces it */}
        {stage !== "result" && (
          <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">
                {prompt.category} · {prompt.difficulty}
              </span>
              <span className="text-3xs text-text-muted">{prompt.word_count} words</span>
            </div>
            {prompt.is_mine && prompt.interest && (
              <p className="flex items-center gap-1.5 text-2xs font-semibold text-accent-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Made for you · {prompt.interest}
              </p>
            )}
            <p className="text-sm leading-relaxed text-primary font-medium">{prompt.passage_text}</p>
          </div>
        )}

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
                  <p className="text-2xs text-text-muted">Tap the square when you finish the passage</p>
                </div>
              ) : (
                <p className="text-xs text-text-muted text-center">Tap the mic and read the passage above aloud, clearly and at a natural pace</p>
              )}

              {stage === "recording" && liveTranscript && (
                <p className="w-full text-xs text-text-muted italic border-t border-border-subtle pt-3 line-clamp-3">
                  &ldquo;{liveTranscript}&rdquo;
                </p>
              )}

              <p className="flex items-center gap-1.5 text-3xs font-medium text-text-muted text-center">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                Your voice is scored by AI and deleted right after — we don&apos;t keep recordings.
              </p>
            </motion.div>
          )}

          {stage === "scoring" && (
            <motion.div
              key="scoring"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="status"
              className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-10 flex flex-col items-center gap-3"
            >
              <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
              <p className="text-xs font-semibold text-text-muted">Listening to your recording…</p>
              <p className="text-2xs text-text-muted">This usually takes about ten seconds</p>
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
                        {(result.overall_score ?? 0) >= SPEAKING_PASS_THRESHOLD - 10
                          ? `Just short of ${SPEAKING_PASS_THRESHOLD}% — try again, you've got this.`
                          : `You need ${SPEAKING_PASS_THRESHOLD}% to pass — read it through once more and go again.`}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ScoreBar label="Clarity" value={result.clarity_score} />
                    <ScoreBar label="Fluency" value={result.fluency_score} />
                    <ScoreBar label="Accuracy" value={result.accuracy_score} />
                  </div>

                  {result.accuracy_note && (
                    <p className="flex items-start gap-2 text-xs font-medium text-primary bg-elevated border border-border-subtle rounded-control p-3">
                      <MessageSquareText className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                      {result.accuracy_note}
                    </p>
                  )}

                  {result.words.length > 0 && <WordMap words={result.words} />}

                  <div className="space-y-1.5">
                    {result.pacing_wpm !== null && (
                      <div className="flex flex-wrap items-center gap-2 text-2xs p-2.5 rounded-control bg-elevated">
                        <Gauge className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span className="font-semibold text-primary">{result.pacing_wpm} words/min</span>
                        {pace && <span className={cn("font-medium", pace.tone)}>— {pace.text}</span>}
                      </div>
                    )}
                    {((result.filler_count ?? 0) > 0 || (result.long_pauses ?? 0) > 0) && (
                      <div className="flex flex-wrap items-center gap-2 text-2xs p-2.5 rounded-control bg-elevated">
                        <Mic className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        {(result.filler_count ?? 0) > 0 && (
                          <span className="font-semibold text-primary">
                            {result.filler_count} filler sound{result.filler_count === 1 ? "" : "s"} <span className="font-medium text-text-muted">(um, uh)</span>
                          </span>
                        )}
                        {(result.long_pauses ?? 0) > 0 && (
                          <span className="font-semibold text-primary">
                            {result.long_pauses} long pause{result.long_pauses === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {result.pronunciation.length > 0 && (
                    <div className="rounded-control border border-border-subtle p-3 space-y-1.5">
                      <h3 className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-text-muted">
                        <Ear className="w-3.5 h-3.5" />
                        Worth a second listen
                      </h3>
                      <ul className="space-y-1 text-xs text-text-secondary">
                        {result.pronunciation.map((p, i) => (
                          <li key={i}>
                            <span className="font-bold text-primary">{p.word.replace(/[.,;:!?]+$/, "")}</span> may have sounded like{" "}
                            <span className="font-semibold text-primary">“{p.heard_as}”</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-3xs text-text-muted">AI hints, not a verdict — these never changed your score.</p>
                    </div>
                  )}

                  {result.feedback && (
                    <div className="flex items-start gap-2 text-xs text-primary bg-accent-primary/5 border border-accent-primary/15 rounded-control p-3">
                      <Sparkles className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-3xs font-bold uppercase tracking-wide text-accent-primary">Coach feedback on how you sounded</p>
                        <p>{result.feedback}</p>
                      </div>
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

              {showInterviewNudge && (
                <Link
                  href="/dashboard/interviews"
                  className="flex items-center justify-between gap-2 rounded-control border border-border-subtle hover:border-accent-primary/40 bg-elevated px-3.5 py-2.5 text-xs font-semibold text-primary transition-colors"
                >
                  <span>Ready for the real thing? Practise this answer in a mock AI interview.</span>
                  <ChevronRight className="w-3.5 h-3.5 text-accent-primary shrink-0" />
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}
