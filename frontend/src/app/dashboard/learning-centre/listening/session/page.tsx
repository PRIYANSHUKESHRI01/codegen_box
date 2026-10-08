"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Loader2 } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AudioPlayer } from "@/components/listening/AudioPlayer";
import { DictationTask } from "@/components/listening/DictationTask";
import { LessonBrief } from "@/components/listening/LessonBrief";
import { ListeningResult } from "@/components/listening/ListeningResult";
import { DifficultyBadge, FormatChip } from "@/components/listening/listeningUi";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useListeningPlayer } from "@/lib/listening/useListeningPlayer";
import {
  LISTENING_EXAM_MAX_PLAYS,
  type ListeningHistory,
  type ListeningLessonDetail,
  type ListeningMode,
  type ListeningSubmitResponse,
} from "@/types/learningCentre";

type Stage = "loading" | "brief" | "task" | "submitting" | "result" | "not_found";

const OPTION_LETTERS = ["A", "B", "C", "D"];

/**
 * One listening lesson, start to finish:
 *   brief  — what it is, what it trains, practice vs exam
 *   task   — the audio player beside the questions (passage / conversation),
 *            or one sentence at a time to type (dictation)
 *   result — score, skill breakdown, where every answer was in the transcript
 * The audio engine is created here once per lesson and shared with the result
 * screen, so "hear the answer" and the transcript read-along use the same
 * voices the student heard during the task.
 */
export default function ListeningSessionPage() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId") ?? "";

  const [stage, setStage] = useState<Stage>("loading");
  const [lesson, setLesson] = useState<ListeningLessonDetail | null>(null);
  const [history, setHistory] = useState<ListeningHistory | null>(null);
  const [mode, setMode] = useState<ListeningMode>("practice");
  const [answers, setAnswers] = useState<number[]>([]);
  const [typed, setTyped] = useState<string[]>([]);
  const [result, setResult] = useState<ListeningSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const topRef = useRef<HTMLDivElement>(null);
  const dictationPlays = useRef(0);

  const isDictation = lesson?.format === "dictation";
  const exam = mode === "exam";

  const segments = useMemo(() => lesson?.sentences ?? [], [lesson]);
  const speakerSpecs = useMemo(() => lesson?.speakers?.map((s) => ({ key: s.key, gender: s.gender })) ?? null, [lesson]);
  const player = useListeningPlayer({
    segments,
    speakers: speakerSpecs,
    rules: {
      // Exam: the whole passage plays at most twice and the controls are fixed. A dictation counts plays per sentence in its own UI.
      maxPlays: exam && !isDictation ? LISTENING_EXAM_MAX_PLAYS : null,
      locked: exam,
    },
  });

  const load = useCallback(async () => {
    if (!lessonId) {
      setStage("not_found");
      return;
    }
    try {
      const res = await api.get<{ lesson: ListeningLessonDetail; history: ListeningHistory }>(`/learning-centre/listening/lessons/${lessonId}`);
      setLesson(res.lesson);
      setHistory(res.history);
      setAnswers(new Array(res.lesson.questions.length).fill(-1));
      setTyped(new Array(res.lesson.sentences.length).fill(""));
      setStage("brief");
    } catch {
      setStage("not_found");
    }
  }, [lessonId]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  // Every stage change starts at the top of the lesson.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, [stage]);

  const startTask = () => {
    setError(null);
    dictationPlays.current = 0;
    // Every attempt starts with a fresh audio engine state — in exam mode a retry must get its plays back.
    player.reset();
    setStage("task");
  };

  const submit = async () => {
    if (!lesson || stage === "submitting") return;
    setStage("submitting");
    setError(null);
    player.pause();

    const playsUsed = isDictation ? dictationPlays.current : player.snapshot.plays;
    try {
      const res = await api.post<ListeningSubmitResponse>(`/learning-centre/listening/lessons/${lesson.id}/attempts`, {
        answers: isDictation ? typed : answers,
        mode,
        plays_used: Math.min(50, playsUsed),
      });
      setResult(res);
      setStage("result");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your answers. Please try again.");
      setStage("task");
    }
  };

  const retry = async () => {
    setResult(null);
    setStage("loading");
    await load(); // refreshes the student's history (best score, attempts) and returns to the briefing
  };

  if (status !== "ready" || stage === "loading") return <SessionLoader />;

  if (stage === "not_found" || !lesson) {
    return (
      <DashboardShell role="user" title="Listening Lab">
        <div className="space-y-3 rounded-panel border border-border-subtle bg-surface p-10 text-center text-xs text-status-danger">
          <p>This lesson couldn&apos;t be found.</p>
          <Link href="/dashboard/learning-centre/listening" className="font-semibold text-accent-primary hover:underline">
            Back to lessons
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const answeredCount = answers.filter((a) => a >= 0).length;
  const allAnswered = answeredCount === answers.length;

  return (
    <DashboardShell role="user" title="Listening Lab" subtitle={stage === "brief" ? undefined : lesson.title}>
      <div ref={topRef} className={cn("mx-auto space-y-4", stage === "task" || stage === "submitting" ? "max-w-5xl" : stage === "result" ? "max-w-3xl" : "max-w-2xl")}>
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/25 bg-status-danger/10 p-3 text-xs text-status-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {stage === "brief" && <LessonBrief lesson={lesson} history={history} mode={mode} onModeChange={setMode} onStart={startTask} starting={false} />}

        {(stage === "task" || stage === "submitting") && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href="/dashboard/learning-centre/listening" className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted transition-colors hover:text-primary">
                <ArrowLeft className="h-3.5 w-3.5" />
                Leave lesson
              </Link>
              <div className="flex items-center gap-1.5">
                <FormatChip format={lesson.format} />
                <DifficultyBadge difficulty={lesson.difficulty} />
              </div>
            </div>

            {isDictation ? (
              <div className="mx-auto max-w-2xl">
                <DictationTask
                  sentences={lesson.sentences}
                  mode={mode}
                  answers={typed}
                  onChange={(i, text) => setTyped((prev) => prev.map((t, idx) => (idx === i ? text : t)))}
                  onPlayed={() => {
                    dictationPlays.current += 1;
                  }}
                  onSubmit={submit}
                  submitting={stage === "submitting"}
                  player={player}
                />
              </div>
            ) : (
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
                <div className="lg:sticky lg:top-20">
                  <AudioPlayer player={player} sentences={lesson.sentences} speakers={lesson.speakers} mode={mode} title={lesson.title} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-primary">Questions</h2>
                    <span className="text-2xs font-bold text-text-secondary" aria-live="polite">
                      {answeredCount} of {answers.length} answered
                    </span>
                  </div>

                  {lesson.questions.map((q, qi) => (
                    <fieldset key={qi} className="space-y-2.5 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
                      <legend className="sr-only">Question {qi + 1}</legend>
                      <p className="text-sm font-bold text-primary">
                        <span className="mr-1.5 text-accent-primary">{qi + 1}.</span>
                        {q.question}
                      </p>
                      <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label={`Options for question ${qi + 1}`}>
                        {q.options.map((option, oi) => {
                          const selected = answers[qi] === oi;
                          return (
                            <button
                              key={oi}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))}
                              className={cn(
                                "flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-left text-xs font-semibold transition-colors",
                                selected ? "border-transparent bg-accent-primary text-white" : "border-border-subtle bg-elevated text-primary hover:border-accent-primary/40"
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-3xs font-bold",
                                  selected ? "bg-white/25 text-white" : "bg-surface text-text-secondary"
                                )}
                                aria-hidden="true"
                              >
                                {selected ? <Check className="h-3 w-3" /> : OPTION_LETTERS[oi]}
                              </span>
                              <span className="leading-snug">{option}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}

                  <button
                    type="button"
                    onClick={submit}
                    disabled={!allAnswered || stage === "submitting"}
                    className="flex w-full items-center justify-center gap-1.5 rounded-control bg-accent-primary py-3 text-sm font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {stage === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Check my answers
                  </button>
                  {!allAnswered && <p className="text-center text-2xs text-text-muted">Answer every question to check your score.</p>}
                </div>
              </div>
            )}
          </>
        )}

        {stage === "result" && result && <ListeningResult lesson={lesson} response={result} player={player} onRetry={retry} />}
      </div>
    </DashboardShell>
  );
}
