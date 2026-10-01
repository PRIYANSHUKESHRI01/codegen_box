"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Brain, Clock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ASSESSMENT_TYPE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type SoftSkillActiveSession,
  type SoftSkillAssessmentSummary,
  type SoftSkillSessionQuestion,
} from "@/types/softSkill";

type Stage = "loading" | "intro" | "taking" | "submitting" | "not_found";

interface ShowResponse {
  assessment: SoftSkillAssessmentSummary;
  in_progress_session_id: number | null;
  completed_session_ids: number[];
}

export default function SoftSkillSessionPage() {
  const { status } = useAuthGuard(["user"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";

  const [stage, setStage] = useState<Stage>("loading");
  const [overview, setOverview] = useState<ShowResponse | null>(null);
  const [active, setActive] = useState<SoftSkillActiveSession | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // response_id -> selected_index
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);

  const loadOverview = useCallback(async () => {
    if (!slug) {
      setStage("not_found");
      return;
    }
    try {
      const res = await api.get<ShowResponse>(`/soft-skills/${slug}`);
      setOverview(res);
      setStage("intro");
    } catch {
      setStage("not_found");
    }
  }, [slug]);

  useEffect(() => {
    if (status === "ready") loadOverview();
  }, [status, loadOverview]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleSubmit = useCallback(async () => {
    if (!active || submittingRef.current) return;
    submittingRef.current = true;
    stopTimer();
    setStage("submitting");
    try {
      await api.post(`/soft-skills/sessions/${active.session.id}/submit`);
      router.push(`/dashboard/soft-skills/view?sessionId=${active.session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your test. Please try again.");
      setStage("taking");
      submittingRef.current = false;
    }
  }, [active, router]);

  const beginOrResume = async () => {
    if (!overview) return;
    setError(null);
    try {
      const res = await api.post<SoftSkillActiveSession>(`/soft-skills/${slug}/start`);
      setActive(res);
      const initialAnswers: Record<number, number> = {};
      res.questions.forEach((q) => {
        if (q.selected_index !== null) initialAnswers[q.response_id] = q.selected_index;
      });
      setAnswers(initialAnswers);
      setStage("taking");

      const deadline = new Date(res.session.deadline_at).getTime();
      const tick = () => {
        const secs = Math.max(0, Math.round((deadline - Date.now()) / 1000));
        setRemainingSeconds(secs);
        if (secs <= 0) handleSubmit();
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start this test. Please try again.");
    }
  };

  useEffect(() => stopTimer, []);

  const handleSelect = async (responseId: number, index: number) => {
    setAnswers((prev) => ({ ...prev, [responseId]: index }));
    if (!active) return;
    try {
      await api.post(`/soft-skills/sessions/${active.session.id}/answer`, { response_id: responseId, selected_index: index });
    } catch {
      // Autosave is best-effort per question — a transient failure here
      // doesn't block the student; submit() re-grades from whatever
      // answers actually made it to the server.
    }
  };

  const timeLabel = useMemo(() => {
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [remainingSeconds]);

  const answeredCount = Object.keys(answers).length;

  if (status !== "ready" || stage === "loading") return <SessionLoader />;

  if (stage === "not_found" || !overview) {
    return (
      <DashboardShell role="user" title="Soft Skills">
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle space-y-3">
          <p>This test couldn&apos;t be found.</p>
          <Link href="/dashboard/soft-skills" className="text-accent-primary font-semibold hover:underline">
            Back to Soft Skills
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const { assessment, in_progress_session_id, completed_session_ids } = overview;

  return (
    <DashboardShell role="user" title="Soft Skills" subtitle={stage === "intro" ? assessment.title : undefined} fullBleed={stage === "taking"}>
      <div className={cn(stage === "taking" ? "flex-1 min-h-0 flex flex-col p-4 sm:p-6" : "max-w-2xl mx-auto space-y-4")}>
        {stage !== "taking" && (
          <Link href="/dashboard/soft-skills" className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-primary transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            All Soft Skills tests
          </Link>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {stage === "intro" && (
          <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-control flex items-center justify-center border bg-gradient-to-br from-accent-primary/25 to-accent-primary/5 bg-accent-primary/10 text-accent-primary border-accent-primary/25">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-primary">{assessment.title}</h2>
                <span className="text-2xs font-bold uppercase text-accent-secondary">{ASSESSMENT_TYPE_LABELS[assessment.assessment_type]}</span>
              </div>
            </div>

            {assessment.description && <p className="text-sm text-text-secondary">{assessment.description}</p>}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-control bg-elevated text-center">
                <p className="text-lg font-black text-primary">{assessment.question_count}</p>
                <p className="text-3xs text-text-muted">Questions</p>
              </div>
              <div className="p-2.5 rounded-control bg-elevated text-center">
                <p className="text-lg font-black text-primary">{assessment.duration_minutes}</p>
                <p className="text-3xs text-text-muted">Minutes</p>
              </div>
              <div className="p-2.5 rounded-control bg-elevated text-center">
                <p className="text-lg font-black text-primary">{assessment.pass_percentage}%</p>
                <p className="text-3xs text-text-muted">To Pass</p>
              </div>
              <div className="p-2.5 rounded-control bg-elevated text-center">
                <p className="text-lg font-black text-primary">{assessment.best_score_percent !== null ? `${Math.round(assessment.best_score_percent)}%` : "—"}</p>
                <p className="text-3xs text-text-muted">Best Score</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {CATEGORY_ORDER.filter((cat) => assessment.category_composition[cat]).map((cat) => (
                <span key={cat} className="text-2xs font-semibold text-text-muted bg-elevated rounded-full px-2.5 py-1">
                  {assessment.category_composition[cat]} {CATEGORY_LABELS[cat]}
                </span>
              ))}
            </div>

            {!assessment.can_attempt ? (
              <p className="text-xs font-semibold text-status-warning bg-status-warning/10 border border-status-warning/25 rounded-control p-3">
                You&apos;ve used all {assessment.max_attempts} attempt(s) for this test.
              </p>
            ) : (
              <button
                onClick={beginOrResume}
                className="w-full py-3 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors"
              >
                {in_progress_session_id ? "Resume Test" : "Start Test"}
              </button>
            )}

            {completed_session_ids.length > 0 && (
              <Link
                href={`/dashboard/soft-skills/view?sessionId=${completed_session_ids[0]}`}
                className="block text-center text-2xs font-semibold text-accent-primary hover:underline"
              >
                View your most recent result
              </Link>
            )}
          </div>
        )}

        {(stage === "taking" || stage === "submitting") && active && (
          <TakingTest
            active={active}
            answers={answers}
            currentIndex={currentIndex}
            setCurrentIndex={setCurrentIndex}
            timeLabel={timeLabel}
            remainingSeconds={remainingSeconds}
            answeredCount={answeredCount}
            onSelect={handleSelect}
            onSubmit={() => setConfirmingSubmit(true)}
            submitting={stage === "submitting"}
          />
        )}
      </div>

      <AnimatePresence>
        {confirmingSubmit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmingSubmit(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="relative z-10 w-full max-w-sm rounded-panel bg-surface border border-border-strong shadow-card p-5 space-y-4">
              <h3 className="font-bold text-primary">Submit this test?</h3>
              <p className="text-xs text-text-muted">
                {active && active.questions.length - answeredCount > 0
                  ? `You still have ${active.questions.length - answeredCount} unanswered question(s). They'll be marked incorrect.`
                  : "All questions are answered."}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmingSubmit(false)} className="flex-1 py-2 rounded-control border border-border-subtle text-text-secondary hover:text-primary text-xs font-bold transition-colors">
                  Keep Going
                </button>
                <button
                  onClick={() => {
                    setConfirmingSubmit(false);
                    handleSubmit();
                  }}
                  className="flex-1 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

function TakingTest({
  active,
  answers,
  currentIndex,
  setCurrentIndex,
  timeLabel,
  remainingSeconds,
  answeredCount,
  onSelect,
  onSubmit,
  submitting,
}: {
  active: SoftSkillActiveSession;
  answers: Record<number, number>;
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
  timeLabel: string;
  remainingSeconds: number;
  answeredCount: number;
  onSelect: (responseId: number, index: number) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const question: SoftSkillSessionQuestion = active.questions[currentIndex];
  const isLow = remainingSeconds <= 60;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      {/* Header: timer + progress */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-panel bg-surface border border-border-subtle shadow-subtle px-4 py-3">
        <span className="text-xs font-bold text-primary">{active.assessment.title}</span>
        <div className="flex items-center gap-3">
          <span className="text-2xs text-text-muted">{answeredCount}/{active.questions.length} answered</span>
          <span className={cn("flex items-center gap-1.5 font-mono font-bold text-sm px-2.5 py-1 rounded-control", isLow ? "bg-status-danger/10 text-status-danger" : "bg-elevated text-primary")}>
            <Clock className="w-3.5 h-3.5" />
            {timeLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
        {/* Question panel */}
        <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-5 flex flex-col overflow-y-auto">
          <span className="text-3xs font-bold uppercase tracking-wide text-accent-primary mb-2">
            Question {currentIndex + 1} of {active.questions.length} · {CATEGORY_LABELS[question.category]}
          </span>
          <p className="text-sm font-semibold text-primary leading-relaxed mb-4">{question.question_text}</p>

          <div className="space-y-2 flex-1">
            {question.options.map((option, oi) => (
              <button
                key={oi}
                onClick={() => onSelect(question.response_id, oi)}
                className={cn(
                  "w-full text-left px-3.5 py-2.5 rounded-control text-xs font-semibold border transition-colors",
                  answers[question.response_id] === oi
                    ? "bg-accent-primary text-white border-transparent"
                    : "bg-elevated border-border-subtle text-primary hover:border-accent-primary/40"
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border-subtle">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 text-2xs font-bold text-text-secondary hover:text-primary disabled:opacity-40 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            {currentIndex < active.questions.length - 1 ? (
              <button
                onClick={() => setCurrentIndex(currentIndex + 1)}
                className="flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit Test
              </button>
            )}
          </div>
        </div>

        {/* Question navigator */}
        <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-4 overflow-y-auto">
          <p className="text-3xs font-bold uppercase tracking-wide text-text-muted mb-2.5">Questions</p>
          <div className="grid grid-cols-5 lg:grid-cols-4 gap-1.5">
            {active.questions.map((q, i) => {
              const isAnswered = answers[q.response_id] !== undefined;
              const isCurrent = i === currentIndex;
              return (
                <button
                  key={q.response_id}
                  onClick={() => setCurrentIndex(i)}
                  className={cn(
                    "h-8 rounded-control text-2xs font-bold flex items-center justify-center transition-colors border",
                    isCurrent
                      ? "bg-accent-primary text-white border-transparent"
                      : isAnswered
                      ? "bg-status-success/10 text-status-success border-status-success/25"
                      : "bg-elevated text-text-muted border-border-subtle"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Submit Test
          </button>
        </div>
      </div>
    </div>
  );
}
