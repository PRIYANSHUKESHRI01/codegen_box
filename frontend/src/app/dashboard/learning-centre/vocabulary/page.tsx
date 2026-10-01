"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  SpellCheck2,
  Sparkles,
  RotateCcw,
  Trophy,
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
import {
  VOCABULARY_PASS_THRESHOLD,
  VOCABULARY_TOPIC_SUGGESTIONS,
  type Difficulty,
  type VocabularyGenerateResponse,
  type VocabularySubmitResponse,
  type QuizResultItem,
} from "@/types/learningCentre";

type Stage = "setup" | "quiz" | "result";

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

export default function VocabularySprintPage() {
  const { status } = useAuthGuard(["user"]);

  const [stage, setStage] = useState<Stage>("setup");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quiz, setQuiz] = useState<VocabularyGenerateResponse | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<VocabularySubmitResponse | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await api.post<VocabularyGenerateResponse>("/learning-centre/vocabulary/generate", {
        topic: topic.trim(),
        difficulty,
      });
      setQuiz(res);
      setAnswers(new Array(res.questions.length).fill(-1));
      setStage("quiz");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't generate a quiz. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<VocabularySubmitResponse>(`/learning-centre/vocabulary/attempts/${quiz.attempt_id}/submit`, { answers });
      setResult(res);
      setStage("result");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your answers. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewQuiz = () => {
    setQuiz(null);
    setResult(null);
    setAnswers([]);
    setStage("setup");
  };

  if (status !== "ready") return <SessionLoader />;

  const allAnswered = answers.every((a) => a >= 0);

  return (
    <DashboardShell
      role="user"
      title="Vocabulary Sprint"
      subtitle="Pick any topic and difficulty — Gemini builds you a fresh word-in-context quiz on the spot."
    >
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/dashboard/learning-centre"
          className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Learning Centre
        </Link>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {stage === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-control flex items-center justify-center border bg-gradient-to-br from-amber-500/25 to-amber-500/5 bg-amber-500/10 text-amber-500 border-amber-500/25">
                  <SpellCheck2 className="w-5 h-5" />
                </div>
                <p className="text-xs text-text-muted">Choose a topic — pick a suggestion or type your own.</p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {VOCABULARY_TOPIC_SUGGESTIONS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopic(t)}
                      className={cn(
                        "px-2.5 py-1 rounded-control text-2xs font-bold transition-colors border",
                        topic === t
                          ? "bg-accent-primary text-white border-transparent"
                          : "bg-elevated border-border-subtle text-text-muted hover:text-primary hover:border-accent-primary/40"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Or type any topic — e.g. Marketing, Sports, Cooking..."
                  maxLength={80}
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-sm text-primary placeholder:text-text-muted outline-none focus:border-accent-primary transition-colors"
                />
              </div>

              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-text-muted mb-2">Difficulty</p>
                <div className="flex items-center gap-1.5">
                  {DIFFICULTIES.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setDifficulty(key)}
                      className={cn(
                        "px-2.5 py-1 rounded-control text-2xs font-bold transition-colors border",
                        difficulty === key
                          ? "bg-accent-primary text-white border-transparent"
                          : "bg-elevated border-border-subtle text-text-muted hover:text-primary hover:border-accent-primary/40"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={!topic.trim() || generating}
                className="w-full flex items-center justify-center gap-1.5 rounded-control py-2.5 text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover transition-colors disabled:opacity-50"
              >
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generating ? "Generating your quiz…" : "Generate Quiz"}
              </button>
            </motion.div>
          )}

          {stage === "quiz" && quiz && (
            <motion.div
              key="quiz"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">{quiz.topic} · {quiz.difficulty}</span>
                <span className="text-3xs text-text-muted">{quiz.questions.length} questions</span>
              </div>

              {quiz.questions.map((q, qi) => (
                <div key={qi} className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-4 space-y-2.5">
                  <p className="text-sm text-primary">
                    <span className="font-bold">{qi + 1}.</span> {q.sentence}
                  </p>
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

          {stage === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-5"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <ReadinessRing value={result.attempt.score} label={result.attempt.passed ? "Passed" : "Try Again"} />
                {result.attempt.passed ? (
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                    className="flex items-center gap-1.5 text-status-success font-bold text-sm"
                  >
                    <Trophy className="w-4 h-4" />
                    Great vocabulary — you passed!
                  </motion.div>
                ) : (
                  <p className="text-sm font-bold text-status-warning">
                    Just short of {VOCABULARY_PASS_THRESHOLD}% — a new quiz might land easier words.
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                {result.results.map((r: QuizResultItem, i: number) => (
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
                        <p className="font-bold text-primary">{r.word}</p>
                        <p className="text-text-muted">{r.sentence}</p>
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

              <button
                onClick={handleNewQuiz}
                className="w-full flex items-center justify-center gap-1.5 rounded-control py-2.5 text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                New Quiz
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
}
