"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Clock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Maximize2,
  FileText,
  ShieldAlert,
  RotateCcw,
  Check,
  Eye,
  HelpCircle,
} from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useInterviewProctoring } from "@/lib/proctoring/useInterviewProctoring";
import { ProctoringConsentGate } from "@/components/proctoring/ProctoringConsentGate";
import { ProctoringOverlay } from "@/components/proctoring/ProctoringOverlay";
import { ProctoringLockedScreen } from "@/components/proctoring/ProctoringLockedScreen";
import {
  ASSESSMENT_TYPE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type SoftSkillActiveSession,
  type SoftSkillAssessmentSummary,
  type SoftSkillSessionQuestion,
} from "@/types/softSkill";

/** "proctoring" = attempt exists server-side but held behind camera/fullscreen consent gate. */
type Stage = "loading" | "intro" | "proctoring" | "taking" | "submitting" | "not_found";

interface ShowResponse {
  assessment: SoftSkillAssessmentSummary;
  in_progress_session_id: number | null;
  completed_session_ids: number[];
  /** Absent from older API — treated as "not required". */
  proctoring_required?: boolean;
}

const CATEGORY_THEMES: Record<string, { bg: string; text: string; border: string }> = {
  aptitude: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/25" },
  reasoning: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/25" },
  english: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/25" },
  situational: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/25" },
};

export default function SoftSkillSessionPage() {
  const { user, status } = useAuthGuard(["user"]);
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
  const [startingSession, setStartingSession] = useState(false);

  /** Set once attempt exists and proctoring is required — proctoring endpoints hang off this session id. */
  const [proctoredSessionId, setProctoredSessionId] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  const preConsentStartRef = useRef<SoftSkillActiveSession | null>(null);
  const enteredTakingRef = useRef(false);
  const lastCopyWarningRef = useRef<number>(0);

  // CRITICAL FIX: Keep proctoring enabled during "proctoring", "taking", AND "submitting".
  // Previously, enabled was ONLY `stage === "proctoring"`. When the stage switched to "taking",
  // enabled became false, causing the proctoring engine to destroy itself and exit fullscreen after 2 seconds!
  const proctoring = useInterviewProctoring({
    basePath: `/soft-skills/sessions/${proctoredSessionId ?? 0}`,
    enabled: (stage === "proctoring" || stage === "taking" || stage === "submitting") && proctoredSessionId !== null,
    activityLabel: "assessment",
  });

  const loadOverview = useCallback(async () => {
    if (!slug) {
      setStage("not_found");
      return;
    }
    try {
      const res = await api.get<ShowResponse>(`/soft-skills/${slug}`);
      setOverview(res);
      if (res.in_progress_session_id) {
        setProctoredSessionId(res.in_progress_session_id);
      }
      setStage("intro");
    } catch {
      setStage("not_found");
    }
  }, [slug]);

  useEffect(() => {
    if (status === "ready") loadOverview();
  }, [status, loadOverview]);

  // Anti-cheating & Anti-Copying Enforcement:
  // Strictly blocks text selection, copying questions, right-clicking, and inspector keyboard shortcuts.
  useEffect(() => {
    if (stage !== "taking" && stage !== "submitting") return;

    const warnBlocked = (action: string) => {
      const now = Date.now();
      if (now - lastCopyWarningRef.current > 2500) {
        lastCopyWarningRef.current = now;
        toast.error(`${action} is disabled during this assessment.`);
      }
    };

    const blockEvent = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      warnBlocked("Copying questions");
    };

    const blockSelect = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      warnBlocked("Right-click context menu");
    };

    const blockKeys = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Block Ctrl/Cmd + C, A, X, V, U, P, S, F12, and Devtools shortcuts
      if (
        (isCtrlOrMeta && ["c", "a", "x", "v", "u", "p", "s"].includes(key)) ||
        e.key === "F12" ||
        (isCtrlOrMeta && e.shiftKey && ["i", "c", "j"].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        warnBlocked("Keyboard shortcut");
      }
    };

    document.addEventListener("copy", blockEvent, true);
    document.addEventListener("cut", blockEvent, true);
    document.addEventListener("paste", blockEvent, true);
    document.addEventListener("selectstart", blockSelect, true);
    document.addEventListener("contextmenu", blockContextMenu, true);
    window.addEventListener("keydown", blockKeys, true);

    return () => {
      document.removeEventListener("copy", blockEvent, true);
      document.removeEventListener("cut", blockEvent, true);
      document.removeEventListener("paste", blockEvent, true);
      document.removeEventListener("selectstart", blockSelect, true);
      document.removeEventListener("contextmenu", blockContextMenu, true);
      window.removeEventListener("keydown", blockKeys, true);
    };
  }, [stage]);

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
      if (proctoredSessionId !== null) proctoring.endSession();
      router.push(`/dashboard/soft-skills/view?sessionId=${active.session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your assessment. Please try again.");
      setStage("taking");
      submittingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, router, proctoredSessionId, proctoring.endSession]);

  const enterTaking = (res: SoftSkillActiveSession) => {
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
  };

  const beginOrResume = async () => {
    if (!overview || startingSession) return;
    setStartingSession(true);
    setError(null);
    try {
      const res = await api.post<SoftSkillActiveSession>(`/soft-skills/${slug}/start`);

      if (overview.proctoring_required) {
        preConsentStartRef.current = res;
        enteredTakingRef.current = false;
        setProctoredSessionId(res.session.id);
        setStage("proctoring");
        setStartingSession(false);
        return;
      }

      enterTaking(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start this assessment. Please try again.");
    } finally {
      setStartingSession(false);
    }
  };

  // Consent cleared and the proctored session is live -> reveal the test.
  useEffect(() => {
    if (stage !== "proctoring" || proctoring.phase !== "active" || enteredTakingRef.current) return;
    enteredTakingRef.current = true;
    (async () => {
      let res = preConsentStartRef.current;
      try {
        res = await api.post<SoftSkillActiveSession>(`/soft-skills/${slug}/start`);
      } catch {
        // Fall back to the click-time payload: same questions and answers
      }
      if (res) enterTaking(res);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, proctoring.phase, slug]);

  useEffect(() => {
    if (proctoring.phase !== "locked") return;
    submittingRef.current = true;
    stopTimer();
    setConfirmingSubmit(false);
  }, [proctoring.phase]);

  useEffect(() => stopTimer, []);

  const handleSelect = async (responseId: number, index: number) => {
    setAnswers((prev) => ({ ...prev, [responseId]: index }));
    if (!active) return;
    try {
      await api.post(`/soft-skills/sessions/${active.session.id}/answer`, { response_id: responseId, selected_index: index });
    } catch {
      // Best-effort autosave
    }
  };

  const handleClearAnswer = (responseId: number) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[responseId];
      return next;
    });
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
          <p>This assessment couldn&apos;t be found.</p>
          <Link href="/dashboard/soft-skills" className="text-accent-primary font-semibold hover:underline">
            Back to Soft Skills
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const { assessment, in_progress_session_id, completed_session_ids } = overview;

  const isLocked = proctoring.phase === "locked";
  const examActive = proctoring.phase === "active" || proctoring.phase === "fullscreen_lost";
  const showGate = stage === "proctoring" && (proctoring.phase === "consent" || proctoring.phase === "starting" || proctoring.phase === "blocked");
  const fullBleed = stage === "taking" || stage === "proctoring" || isLocked || (stage === "submitting" && examActive);
  const lockedSessionId = active?.session.id ?? proctoredSessionId;

  return (
    <DashboardShell
      role="user"
      title="Soft Skills"
      subtitle={stage === "intro" ? assessment.title : undefined}
      fullBleed={fullBleed}
      hideChrome={examActive && !isLocked}
    >
      <div className={cn(fullBleed ? "flex-1 min-h-0 flex flex-col p-3 sm:p-5" : "max-w-4xl mx-auto space-y-6 pb-12")}>
        {error && (
          <div className="flex items-start gap-2 p-3.5 rounded-control bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STAGE: INTRO & INSTRUCTIONS LOBBY ────────────────────────────── */}
        {stage === "intro" && (
          <div className="space-y-6">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center justify-between">
              <Link
                href="/dashboard/soft-skills"
                className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Soft Skills Library
              </Link>
              {completed_session_ids.length > 0 && (
                <Link
                  href={`/dashboard/soft-skills/view?sessionId=${completed_session_ids[0]}`}
                  className="text-2xs font-bold text-accent-primary hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View latest result
                </Link>
              )}
            </div>

            {/* Assessment Briefing Hero */}
            <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center border bg-gradient-to-br from-accent-primary/25 to-accent-primary/5 bg-accent-primary/10 text-accent-primary border-accent-primary/25 shrink-0 shadow-sm">
                    <Brain className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-3xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/25">
                        {ASSESSMENT_TYPE_LABELS[assessment.assessment_type]}
                      </span>
                      {overview.proctoring_required ? (
                        <span className="text-3xs font-bold px-2.5 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/25 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Proctored Assessment
                        </span>
                      ) : (
                        <span className="text-3xs font-bold px-2.5 py-0.5 rounded-full bg-elevated text-text-muted border border-border-subtle">
                          Standard Practice
                        </span>
                      )}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-primary tracking-tight">{assessment.title}</h1>
                    <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed max-w-2xl">
                      {assessment.description ||
                        "Standard campus recruitment assessment evaluating quantitative aptitude, analytical reasoning, verbal comprehension, and situational workplace judgement."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Assessment Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-elevated border border-border-subtle flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-primary">{assessment.question_count}</span>
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted mt-0.5">Questions</span>
                </div>
                <div className="p-3.5 rounded-xl bg-elevated border border-border-subtle flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-primary">{assessment.duration_minutes}</span>
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted mt-0.5">Minutes Total</span>
                </div>
                <div className="p-3.5 rounded-xl bg-elevated border border-border-subtle flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-primary">{assessment.pass_percentage}%</span>
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted mt-0.5">To Qualify</span>
                </div>
                <div className="p-3.5 rounded-xl bg-elevated border border-border-subtle flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-primary">
                    {assessment.best_score_percent !== null ? `${Math.round(assessment.best_score_percent)}%` : "—"}
                  </span>
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted mt-0.5">Best Score</span>
                </div>
              </div>

              {/* Category Breakdown Chips */}
              <div className="pt-2 border-t border-border-subtle">
                <span className="text-3xs font-bold uppercase tracking-widest text-text-muted block mb-2.5">Category Composition</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {CATEGORY_ORDER.filter((cat) => assessment.category_composition[cat]).map((cat) => {
                    const theme = CATEGORY_THEMES[cat] ?? { bg: "bg-elevated", text: "text-text-muted", border: "border-border-subtle" };
                    return (
                      <span
                        key={cat}
                        className={cn(
                          "text-2xs font-bold rounded-lg px-3 py-1.5 border flex items-center gap-1.5",
                          theme.bg,
                          theme.text,
                          theme.border
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {assessment.category_composition[cat]} {CATEGORY_LABELS[cat]}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Assessment Guidelines & Instructions */}
            <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent-primary" />
                <h2 className="text-base font-bold text-primary">Important Instructions Before You Begin</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-elevated/70 border border-border-subtle flex gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-primary/10 text-accent-primary flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-primary">No Negative Marking</h3>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      Every question has 4 options with a single correct choice. All questions carry equal weight with zero negative marking. Answer all questions!
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-elevated/70 border border-border-subtle flex gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-status-success/10 text-status-success flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-primary">Real-time Autosave</h3>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      Your answers are instantly saved to the server as you select them. You can navigate back and forth freely or change selections anytime before submission.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-elevated/70 border border-border-subtle flex gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-accent-secondary/10 text-accent-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-primary">Continuous Fullscreen Required</h3>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      The test must be taken in continuous fullscreen mode. Exiting fullscreen, switching tabs, or opening other windows triggers strikes (3 strikes terminates attempt).
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-elevated/70 border border-border-subtle flex gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-status-danger/10 text-status-danger flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-primary">Strict Anti-Copy Protection</h3>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      Text selection, copying question content, right-clicking, and developer tools are strictly disabled. Your browser activity is securely verified throughout.
                    </p>
                  </div>
                </div>
              </div>

              {/* Start Assessment Action Banner */}
              <div className="pt-4 border-t border-border-subtle">
                {!assessment.can_attempt ? (
                  <div className="p-4 rounded-xl bg-status-warning/10 border border-status-warning/25 text-center space-y-1">
                    <p className="text-xs font-bold text-status-warning">
                      You&apos;ve used all {assessment.max_attempts} attempt(s) for this assessment.
                    </p>
                    <p className="text-2xs text-text-secondary">Please review your results or explore other available test sets.</p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-2xs text-text-muted">
                      <span>Clicking below begins your timed attempt. Ensure you have a quiet environment and stable internet connection.</span>
                    </div>

                    <button
                      onClick={beginOrResume}
                      disabled={startingSession}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent-primary hover:bg-accent-primary-hover px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent-primary/25 transition-all hover:shadow-xl hover:shadow-accent-primary/35 disabled:opacity-60 whitespace-nowrap"
                    >
                      {startingSession ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Preparing Session...
                        </>
                      ) : in_progress_session_id ? (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Resume Assessment
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Begin Assessment
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STAGE: PROCTORING CONSENT GATE ──────────────────────────────── */}
        {showGate && (
          <ProctoringConsentGate
            activity="soft_skill"
            phase={proctoring.phase}
            consentError={proctoring.consentError}
            devicePreviewReady={proctoring.devicePreviewReady}
            previewVideoRef={proctoring.previewVideoRef}
            onEnableDevices={proctoring.enableDevicePreview}
            onConsent={proctoring.grantConsentAndStart}
            cameraStream={proctoring.cameraStream}
            candidateName={user?.name ?? ""}
            startLabel="Begin Assessment"
            onLeave={() => router.push("/dashboard/soft-skills")}
          />
        )}

        {/* ── STAGE: LOCKED SCREEN ────────────────────────────────────────── */}
        {isLocked && (
          <ProctoringLockedScreen
            activity="soft_skill"
            session={proctoring.session}
            onBack={() => router.push("/dashboard/soft-skills")}
            secondary={
              lockedSessionId !== null
                ? { label: "View result", onClick: () => router.push(`/dashboard/soft-skills/view?sessionId=${lockedSessionId}`) }
                : undefined
            }
          />
        )}

        {/* ── STAGE: TAKING / SUBMITTING ──────────────────────────────────── */}
        {!isLocked && (stage === "taking" || stage === "submitting") && active && (
          <>
            {examActive && (
              <ProctoringOverlay
                phase={proctoring.phase}
                session={proctoring.session}
                lastViolation={proctoring.lastViolation}
                studentName={user?.name ?? "Student"}
                rollNumber={user?.roll_number ?? null}
                onResumeFullscreen={proctoring.resumeFullscreen}
              />
            )}
            <TakingTest
              active={active}
              answers={answers}
              currentIndex={currentIndex}
              setCurrentIndex={setCurrentIndex}
              timeLabel={timeLabel}
              remainingSeconds={remainingSeconds}
              answeredCount={answeredCount}
              onSelect={handleSelect}
              onClear={handleClearAnswer}
              onSubmit={() => setConfirmingSubmit(true)}
              submitting={stage === "submitting"}
            />
          </>
        )}
      </div>

      {/* ── SUBMIT CONFIRMATION MODAL ────────────────────────────────────── */}
      <AnimatePresence>
        {confirmingSubmit && active && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmingSubmit(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative z-10 w-full max-w-md rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 text-accent-primary flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-primary text-base">Submit Assessment?</h3>
                  <p className="text-2xs text-text-muted">Review your attempt progress before submitting.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-elevated text-xs font-semibold">
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface/80 border border-border-subtle">
                  <span className="text-text-secondary">Answered:</span>
                  <span className="font-bold text-status-success">{answeredCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-surface/80 border border-border-subtle">
                  <span className="text-text-secondary">Unanswered:</span>
                  <span className={cn("font-bold", active.questions.length - answeredCount > 0 ? "text-status-warning" : "text-text-muted")}>
                    {active.questions.length - answeredCount}
                  </span>
                </div>
              </div>

              {active.questions.length - answeredCount > 0 ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-status-warning/10 border border-status-warning/25 text-2xs text-status-warning leading-relaxed">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    You still have <strong>{active.questions.length - answeredCount} unanswered</strong> question(s). Unanswered questions receive 0 marks.
                  </span>
                </div>
              ) : (
                <p className="text-2xs text-status-success font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Great job! All questions have been answered.
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmingSubmit(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border-subtle text-text-secondary hover:text-primary text-xs font-bold transition-colors"
                >
                  Keep Reviewing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingSubmit(false);
                    handleSubmit();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors shadow-md shadow-accent-primary/20"
                >
                  Confirm & Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAKING TEST VIEW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function TakingTest({
  active,
  answers,
  currentIndex,
  setCurrentIndex,
  timeLabel,
  remainingSeconds,
  answeredCount,
  onSelect,
  onClear,
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
  onClear: (responseId: number) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const question: SoftSkillSessionQuestion = active.questions[currentIndex];
  const isLowTime = remainingSeconds <= 300; // <= 5 mins
  const isCriticalTime = remainingSeconds <= 60; // <= 1 min
  const categoryTheme = CATEGORY_THEMES[question.category] ?? { bg: "bg-elevated", text: "text-text-muted", border: "border-border-subtle" };
  const currentSelection = answers[question.response_id];
  const progressPercent = Math.round((answeredCount / active.questions.length) * 100);

  // Keyboard shortcut listener for options (1-4 or A-D) and arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input (none in this view, but good practice)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === "1" || key === "a") {
        e.preventDefault();
        onSelect(question.response_id, 0);
      } else if (key === "2" || key === "b") {
        e.preventDefault();
        onSelect(question.response_id, 1);
      } else if (key === "3" || key === "c") {
        e.preventDefault();
        onSelect(question.response_id, 2);
      } else if (key === "4" || key === "d") {
        e.preventDefault();
        onSelect(question.response_id, 3);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < active.questions.length - 1) setCurrentIndex(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, question.response_id, onSelect, setCurrentIndex, active.questions.length]);

  return (
    <div
      className="flex-1 min-h-0 flex flex-col gap-3 select-none"
      style={{ userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none" }}
    >
      {/* ── TOP HEADER BAR: Assessment Title, Progress, Timer, and Submit ──── */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-panel bg-surface border border-border-subtle shadow-subtle px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-status-success animate-pulse shrink-0" title="Assessment Live & Proctoring Active" />
          <span className="text-xs sm:text-sm font-bold text-primary truncate">{active.assessment.title}</span>
          <span className={cn("hidden sm:inline-flex text-3xs font-extrabold uppercase px-2 py-0.5 rounded-md border", categoryTheme.bg, categoryTheme.text, categoryTheme.border)}>
            {CATEGORY_LABELS[question.category]}
          </span>
        </div>

        {/* Center Progress Tracker */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end gap-1">
            <span className="text-3xs font-bold text-text-muted">
              {answeredCount} of {active.questions.length} Answered ({progressPercent}%)
            </span>
            <div className="w-32 h-1.5 rounded-full bg-elevated overflow-hidden border border-border-subtle">
              <div
                className="h-full bg-accent-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Timer Display */}
          <div
            className={cn(
              "flex items-center gap-1.5 font-mono font-black text-sm px-3 py-1.5 rounded-xl border transition-colors",
              isCriticalTime
                ? "bg-status-danger/15 text-status-danger border-status-danger/30 animate-pulse"
                : isLowTime
                ? "bg-status-warning/15 text-status-warning border-status-warning/30"
                : "bg-elevated text-primary border-border-subtle"
            )}
            title="Time Remaining"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>{timeLabel}</span>
          </div>

          <button
            onClick={onSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Submit Test</span>
            <span className="sm:hidden">Submit</span>
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT GRID: Question Card + Navigator ──────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
        {/* Question Panel */}
        <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-5 sm:p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Question Meta Bar */}
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <span className="text-3xs font-extrabold uppercase tracking-widest text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-md px-2 py-0.5">
                  Question {currentIndex + 1} of {active.questions.length}
                </span>
                <span className={cn("text-3xs font-bold px-2 py-0.5 rounded-md border", categoryTheme.bg, categoryTheme.text, categoryTheme.border)}>
                  {CATEGORY_LABELS[question.category]}
                </span>
              </div>
              <span className="text-3xs font-semibold text-text-muted">1 Mark · Single Choice</span>
            </div>

            {/* Question Text (Protected from Selection/Copying) */}
            <div className="mb-6">
              <p className="text-sm sm:text-base font-semibold text-primary leading-relaxed select-none">
                {question.question_text}
              </p>
            </div>

            {/* Options List */}
            <div className="space-y-3">
              {question.options.map((option, oi) => {
                const isSelected = currentSelection === oi;
                const optionKey = OPTION_KEYS[oi] ?? `${oi + 1}`;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => onSelect(question.response_id, oi)}
                    className={cn(
                      "group w-full text-left p-3.5 sm:p-4 rounded-xl text-xs sm:text-sm font-medium border transition-all flex items-start gap-3.5",
                      isSelected
                        ? "bg-accent-primary/10 border-accent-primary text-primary shadow-sm ring-1 ring-accent-primary"
                        : "bg-elevated/70 border-border-subtle text-text-secondary hover:border-accent-primary/40 hover:bg-surface-hover hover:text-primary"
                    )}
                  >
                    <span
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors border",
                        isSelected
                          ? "bg-accent-primary text-white border-accent-primary shadow-sm"
                          : "bg-surface text-text-secondary border-border-subtle group-hover:border-accent-primary/40 group-hover:text-primary"
                      )}
                    >
                      {optionKey}
                    </span>
                    <span className="flex-1 mt-0.5 leading-relaxed select-none">{option}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-accent-primary shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls Footer */}
          <div className="flex items-center justify-between pt-5 mt-6 border-t border-border-subtle gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:text-primary disabled:opacity-40 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {currentSelection !== undefined && (
                <button
                  type="button"
                  onClick={() => onClear(question.response_id)}
                  className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-status-warning transition-colors px-2 py-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear Selection
                </button>
              )}

              {currentIndex < active.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-status-success hover:bg-status-success/90 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Finish & Submit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── QUESTION NAVIGATOR SIDEBAR ─────────────────────────────────── */}
        <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-extrabold uppercase tracking-widest text-text-muted">Question Palette</span>
              <span className="text-3xs font-bold text-accent-primary">{answeredCount}/{active.questions.length} answered</span>
            </div>

            {/* Status Legend */}
            <div className="flex items-center justify-between text-3xs font-semibold text-text-muted pb-2 border-b border-border-subtle">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-status-success" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-border-strong" /> Unanswered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-primary" /> Current
              </span>
            </div>

            {/* Question Numbers Grid */}
            <div className="grid grid-cols-5 gap-1.5 max-h-[380px] overflow-y-auto p-1">
              {active.questions.map((q, i) => {
                const isAnswered = answers[q.response_id] !== undefined;
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={q.response_id}
                    type="button"
                    onClick={() => setCurrentIndex(i)}
                    className={cn(
                      "h-8 rounded-lg text-2xs font-extrabold flex items-center justify-center transition-all border",
                      isCurrent
                        ? "bg-accent-primary text-white border-accent-primary ring-2 ring-accent-primary/40 shadow-sm"
                        : isAnswered
                        ? "bg-status-success/15 text-status-success border-status-success/35 font-bold"
                        : "bg-elevated text-text-muted border-border-subtle hover:border-border-strong hover:text-primary"
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigator Footer */}
          <div className="pt-3 border-t border-border-subtle mt-3 space-y-2">
            <div className="text-center text-3xs text-text-muted">
              Shortcut: Use keys <kbd className="font-mono bg-elevated px-1 py-0.5 rounded border border-border-subtle">1-4</kbd> or <kbd className="font-mono bg-elevated px-1 py-0.5 rounded border border-border-subtle">A-D</kbd> to answer.
            </div>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary border border-accent-primary/25 text-xs font-bold transition-colors disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Submit Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}