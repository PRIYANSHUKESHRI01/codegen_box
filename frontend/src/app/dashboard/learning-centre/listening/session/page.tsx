"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Volume2,
  Headphones,
  RotateCcw,
  Trophy,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BrowserVoiceEngine } from "@/lib/voice/browserVoiceEngine";
import { hasSpeechSynthesis } from "@/lib/voice/VoiceEngine";
import {
  LISTENING_PASS_THRESHOLD,
  type ListeningLessonDetail,
  type ListeningSubmitResponse,
  type QuizResultItem,
} from "@/types/learningCentre";

type Stage = "loading" | "listen" | "answer" | "result" | "not_found";

export default function ListeningSessionPage() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId") ?? "";

  const [stage, setStage] = useState<Stage>("loading");
  const [lesson, setLesson] = useState<ListeningLessonDetail | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(true);
  const [submitResult, setSubmitResult] = useState<ListeningSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const engineRef = useRef<BrowserVoiceEngine | null>(null);

  useEffect(() => {
    engineRef.current = new BrowserVoiceEngine();
    setTtsSupported(hasSpeechSynthesis());
    return () => engineRef.current?.cancel();
  }, []);

  const load = useCallback(async () => {
    if (!lessonId) {
      setStage("not_found");
      return;
    }
    try {
      const res = await api.get<{ lesson: ListeningLessonDetail }>(`/learning-centre/listening/lessons/${lessonId}`);
      setLesson(res.lesson);
      setAnswers(new Array(res.lesson.questions.length).fill(-1));
      setStage("listen");
    } catch {
      setStage("not_found");
    }
  }, [lessonId]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  const handlePlay = async () => {
    if (!lesson || !engineRef.current) return;
    setIsPlaying(true);
    await engineRef.current.speak(lesson.passage_text);
    setIsPlaying(false);
    setHasPlayedOnce(true);
  };

  const handleSubmit = async () => {
    if (!lesson) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<ListeningSubmitResponse>(`/learning-centre/listening/lessons/${lesson.id}/attempts`, { answers });
      setSubmitResult(res);
      setStage("result");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your answers. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (!lesson) return;
    setAnswers(new Array(lesson.questions.length).fill(-1));
    setSubmitResult(null);
    setHasPlayedOnce(false);
    setStage("listen");
  };

  if (status !== "ready" || stage === "loading") return <SessionLoader />;

  if (stage === "not_found" || !lesson) {
    return (
      <DashboardShell role="user" title="Listening Lab">
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle space-y-3">
          <p>This lesson couldn&apos;t be found.</p>
          <Link href="/dashboard/learning-centre/listening" className="text-accent-primary font-semibold hover:underline">
            Back to lessons
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const allAnswered = answers.every((a) => a >= 0);

  return (
    <DashboardShell role="user" title="Listening Lab" subtitle={lesson.title}>
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/dashboard/learning-centre/listening"
          className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          All lessons
        </Link>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {stage === "listen" && (
            <motion.div
              key="listen"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-6 flex flex-col items-center gap-4 text-center"
            >
              <div className="w-11 h-11 rounded-control flex items-center justify-center border bg-gradient-to-br from-sky-500/25 to-sky-500/5 bg-sky-500/10 text-sky-400 border-sky-500/25">
                <Headphones className="w-5 h-5" />
              </div>
              <div>
                <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">{lesson.category} · {lesson.difficulty}</span>
                <p className="text-xs text-text-muted mt-1 max-w-sm">
                  Listen carefully — the passage plays aloud, not as text. You can replay it as many times as you need before answering.
                </p>
              </div>

              {ttsSupported ? (
                <button
                  onClick={handlePlay}
                  disabled={isPlaying}
                  className="flex items-center gap-2 rounded-full bg-accent-primary text-white px-6 py-3 text-sm font-bold shadow-card hover:bg-accent-primary-hover transition-colors disabled:opacity-60"
                >
                  {isPlaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                  {isPlaying ? "Playing…" : hasPlayedOnce ? "Play Again" : "Play Passage"}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-2xs text-status-warning">Text-to-speech isn&apos;t supported in this browser — here&apos;s the passage to read instead:</p>
                  <p className="text-sm text-primary leading-relaxed bg-elevated rounded-control p-3 text-left">{lesson.passage_text}</p>
                </div>
              )}

              <button
                onClick={() => setStage("answer")}
                disabled={!hasPlayedOnce && ttsSupported}
                className="text-2xs font-bold text-accent-primary hover:underline disabled:opacity-40 disabled:no-underline flex items-center gap-1"
              >
                Continue to Questions
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {stage === "answer" && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              {lesson.questions.map((q, qi) => (
                <div key={qi} className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-4 space-y-2.5">
                  <p className="text-sm font-bold text-primary">{qi + 1}. {q.question}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((option, oi) => (
                      <button
                        key={oi}
                        onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                        className={cn(
                          "text-left px-3 py-2 rounded-control text-xs font-semibold border transition-colors",
                          answers[qi] === oi
                            ? "bg-accent-primary text-white border-transparent"
                            : "bg-elevated border-border-subtle text-primary hover:border-accent-primary/40"
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={handleSubmit}
                disabled={!allAnswered || submitting}
                className="w-full flex items-center justify-center gap-1.5 rounded-control py-2.5 text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover transition-colors disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit Answers
              </button>
            </motion.div>
          )}

          {stage === "result" && submitResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-5"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <ReadinessRing value={submitResult.attempt.score} label={submitResult.attempt.passed ? "Passed" : "Try Again"} />
                {submitResult.attempt.passed ? (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className="flex items-center gap-1.5 text-status-success font-bold text-sm"
                  >
                    <Trophy className="w-4 h-4" />
                    Nice listening — you passed!
                  </motion.div>
                ) : (
                  <p className="text-sm font-bold text-status-warning">
                    Just short of {LISTENING_PASS_THRESHOLD}% — replay the passage and try again.
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                {submitResult.results.map((r: QuizResultItem, i: number) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-control p-3 border text-xs",
                      r.is_correct ? "bg-status-success/5 border-status-success/20" : "bg-status-danger/5 border-status-danger/20"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {r.is_correct ? (
                        <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-status-danger shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className="font-bold text-primary">{r.question}</p>
                        {!r.is_correct && (
                          <p className="text-text-muted">
                            You chose <span className="font-semibold">{r.options[r.selected_index]}</span> — correct answer:{" "}
                            <span className="font-semibold text-status-success">{r.options[r.correct_index]}</span>
                          </p>
                        )}
                        <p className="text-text-muted">{r.explanation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={handleRetry}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-control py-2.5 text-xs font-bold transition-colors",
                    !submitResult.attempt.passed
                      ? "bg-accent-primary text-white hover:bg-accent-primary-hover"
                      : "bg-elevated text-primary border border-border-subtle hover:border-accent-primary/40"
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <Link
                  href="/dashboard/learning-centre/listening"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-control py-2.5 text-xs font-bold transition-colors",
                    submitResult.attempt.passed
                      ? "bg-accent-primary text-white hover:bg-accent-primary-hover"
                      : "bg-elevated text-primary border border-border-subtle hover:border-accent-primary/40"
                  )}
                >
                  More Lessons
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
