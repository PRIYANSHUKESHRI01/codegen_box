"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Flag,
  ScanFace,
  Camera,
  Lock,
} from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Wordmark } from "@/components/brand/Logo";
import { RoomBackdrop } from "@/components/dashboard/interviews/room/RoomBackdrop";
import { CameraTile } from "@/components/dashboard/interviews/room/CameraTile";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { prefetchContestProblem, seedContestProblems } from "@/lib/contestProblemPrefetch";
import { warmUpEditor } from "@/lib/editorWarmup";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useIntegrityUi } from "@/lib/integrity/store";
import { useInterviewProctoring } from "@/lib/proctoring/useInterviewProctoring";
import { ProctoringConsentGate } from "@/components/proctoring/ProctoringConsentGate";
import { InterviewSessionHud, StrikePill } from "@/components/proctoring/InterviewSessionHud";
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

interface AdvanceResponse {
  next_stage: "coding" | "interview" | "complete";
  contest_slug?: string;
  first_problem_id?: number | null;
  interview_slug?: string;
}

const CATEGORY_THEMES: Record<string, { bg: string; text: string; border: string }> = {
  aptitude: { bg: "bg-blue-500/10", text: "text-blue-500", border: "border-blue-500/25" },
  reasoning: { bg: "bg-purple-500/10", text: "text-purple-500", border: "border-purple-500/25" },
  english: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/25" },
  situational: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/25" },
};

export default function SoftSkillSessionPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <SoftSkillSessionContent />
    </Suspense>
  );
}

function SoftSkillSessionContent() {
  const { user, status } = useAuthGuard(["user"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const assessmentSlug = searchParams.get("assessment") ?? "";

  const isCampusFlow = Boolean(assessmentSlug);
  const backHref = isCampusFlow
    ? `/dashboard/assessments/view?slug=${encodeURIComponent(assessmentSlug)}`
    : "/dashboard/soft-skills";
  const backLabel = isCampusFlow ? "Back to Campus Assessment" : "Back to Soft Skills Library";

  const [stage, setStage] = useState<Stage>("loading");
  const [overview, setOverview] = useState<ShowResponse | null>(null);
  const [active, setActive] = useState<SoftSkillActiveSession | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // response_id -> selected_index
  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [transitionLabel, setTransitionLabel] = useState("Grading your assessment...");

  /** Set once attempt exists and proctoring is required — proctoring endpoints hang off this session id. */
  const [proctoredSessionId, setProctoredSessionId] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  const preConsentStartRef = useRef<SoftSkillActiveSession | null>(null);
  const enteredTakingRef = useRef(false);
  const lastCopyWarningRef = useRef<number>(0);

  const proctoring = useInterviewProctoring({
    basePath: `/soft-skills/sessions/${proctoredSessionId ?? 0}`,
    keepKey: isCampusFlow ? `assessment:${assessmentSlug}` : undefined,
    requireScreenShare: isCampusFlow,
    requireChromium: isCampusFlow,
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

  // Background-warm Monaco Editor, routes, and the first Coding problem while the candidate takes Soft Skills
  // in a Launchpad / Campus Assessment so switching to Coding Test happens almost instantaneously.
  useEffect(() => {
    if (!isCampusFlow || stage !== "taking") return;
    warmUpEditor();
    router.prefetch("/dashboard/assessments/coding");
    router.prefetch("/dashboard/interviews/session");
    try {
      const raw = sessionStorage.getItem(`aptrun:launchpad-prefetch:${assessmentSlug}`);
      if (raw) {
        const meta = JSON.parse(raw) as { contest_slug?: string | null; first_problem_id?: number | null };
        if (meta.contest_slug) {
          if (meta.first_problem_id) {
            prefetchContestProblem(meta.contest_slug, meta.first_problem_id);
          }
          void api
            .get<{ problem_details?: Array<{ id: number; points: number; problem: import("@/types/problem").ProblemDetail }> }>(
              `/contests/${meta.contest_slug}?include_details=1`
            )
            .then((res) => {
              if (res?.problem_details) {
                seedContestProblems(meta.contest_slug as string, res.problem_details);
              }
            })
            .catch(() => undefined);
        }
      }
    } catch {
      /* ignore storage/prefetch errors */
    }
  }, [isCampusFlow, stage, assessmentSlug, router]);

  // Anti-cheating & Anti-Copying Enforcement
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
    setTransitionLabel(isCampusFlow ? "Submitting & launching next stage..." : "Grading your assessment...");
    setStage("submitting");
    try {
      const submitRes = await api.post<{
        session?: { id: number };
        next?: AdvanceResponse;
      }>(`/soft-skills/sessions/${active.session.id}/submit`, {
        ...(isCampusFlow ? { assessment_slug: assessmentSlug, minimal: true } : {}),
      });

      if (isCampusFlow) {
        try {
          const next =
            submitRes?.next ??
            (await api.post<AdvanceResponse>(`/assessments/${encodeURIComponent(assessmentSlug)}/advance`, {
              completed_stage: "soft_skills",
            }));

          if (next.next_stage === "coding" && next.contest_slug) {
            if (proctoredSessionId !== null) {
              if (proctoring.handOffSession) proctoring.handOffSession();
              else proctoring.endSession();
            }
            toast.success("Soft Skills submitted! Opening Coding Round...");
            if (next.first_problem_id) {
              router.push(
                `/dashboard/assessments/coding?assessment=${encodeURIComponent(assessmentSlug)}&slug=${encodeURIComponent(next.contest_slug)}&contestProblemId=${next.first_problem_id}`
              );
            } else {
              router.push(backHref);
            }
            return;
          }

          if (next.next_stage === "interview" && next.interview_slug) {
            if (proctoredSessionId !== null) {
              if (proctoring.handOffSession) proctoring.handOffSession();
              else proctoring.endSession();
            }
            toast.success("Soft Skills submitted! Opening AI Interview...");
            router.push(
              `/dashboard/interviews/session?slug=${encodeURIComponent(next.interview_slug)}&assessment=${encodeURIComponent(assessmentSlug)}`
            );
            return;
          }

          if (proctoredSessionId !== null) proctoring.endSession();
          router.push(backHref);
          return;
        } catch {
          if (proctoredSessionId !== null) proctoring.endSession();
          router.push(backHref);
          return;
        }
      }

      if (proctoredSessionId !== null) proctoring.endSession();
      router.push(`/dashboard/soft-skills/view?sessionId=${active.session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your assessment. Please try again.");
      setStage("taking");
      submittingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, router, proctoredSessionId, proctoring.endSession, proctoring.handOffSession, isCampusFlow, assessmentSlug, backHref]);

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

  const handleSelect = useCallback(
    async (responseId: number, index: number) => {
      setAnswers((prev) => ({ ...prev, [responseId]: index }));
      if (!active) return;
      try {
        await api.post(`/soft-skills/sessions/${active.session.id}/answer`, { response_id: responseId, selected_index: index });
      } catch {
        // Best-effort autosave
      }
    },
    [active]
  );

  const handleClearAnswer = (responseId: number) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[responseId];
      return next;
    });
  };

  const toggleFlag = (responseId: number) => {
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(responseId)) next.delete(responseId);
      else next.add(responseId);
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
      <DashboardShell role="user" title={isCampusFlow ? "Campus Assessment" : "Soft Skills"}>
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle space-y-3">
          <p>This assessment couldn&apos;t be found.</p>
          <Link href={backHref} className="text-accent-primary font-semibold hover:underline">
            {backLabel}
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const { assessment, in_progress_session_id, completed_session_ids } = overview;

  const isLocked = proctoring.phase === "locked";
  const examActive = proctoring.phase === "active" || proctoring.phase === "fullscreen_lost";
  const showGate = stage === "proctoring" && (proctoring.phase === "consent" || proctoring.phase === "starting" || proctoring.phase === "blocked");
  const fullBleed = stage === "taking" || stage === "proctoring" || stage === "submitting" || isLocked;
  const lockedSessionId = active?.session.id ?? proctoredSessionId;
  const resultHref = lockedSessionId !== null
    ? `/dashboard/soft-skills/view?sessionId=${lockedSessionId}${isCampusFlow ? `&assessment=${encodeURIComponent(assessmentSlug)}` : ""}`
    : undefined;

  return (
    <DashboardShell
      role="user"
      title={isCampusFlow ? "Campus Assessment" : "Soft Skills"}
      subtitle={stage === "intro" ? assessment.title : undefined}
      back={stage === "intro" && isCampusFlow ? { href: backHref, label: "Campus Assessment" } : undefined}
      fullBleed={fullBleed}
      hideChrome={stage === "proctoring" || stage === "taking" || stage === "submitting" || isLocked}
    >
      <div className={cn(fullBleed ? "relative flex-1 min-h-0 flex flex-col overflow-hidden bg-background text-primary" : "max-w-4xl mx-auto space-y-6 pb-12")}>
        {fullBleed && <RoomBackdrop />}

        {error && (
          <div className="relative z-20 m-3 sm:mx-6 flex items-start gap-2 p-3.5 rounded-xl bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STAGE: INTRO & INSTRUCTIONS LOBBY ────────────────────────────── */}
        {stage === "intro" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {backLabel}
              </Link>
              {completed_session_ids.length > 0 && !isCampusFlow && (
                <Link
                  href={`/dashboard/soft-skills/view?sessionId=${completed_session_ids[0]}`}
                  className="text-2xs font-bold text-accent-primary hover:underline flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View latest result
                </Link>
              )}
            </div>

            <div className="rounded-[24px] bg-surface border border-border-subtle shadow-card p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center border bg-gradient-to-br from-indigo-500/20 to-violet-500/10 text-indigo-500 border-indigo-500/25 shrink-0 shadow-sm">
                    <Brain className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-3xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25">
                        {isCampusFlow ? "Stage 1 · Soft Skills & Aptitude" : ASSESSMENT_TYPE_LABELS[assessment.assessment_type]}
                      </span>
                      {overview.proctoring_required ? (
                        <span className="text-3xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> AI Face &amp; Camera Proctored
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
                        "Proctored placement assessment evaluating quantitative aptitude, analytical reasoning, verbal comprehension, and situational workplace judgement."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-elevated border border-border-subtle flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-primary">{assessment.question_count}</span>
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted mt-0.5">Questions</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-elevated border border-border-subtle flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-primary">{assessment.duration_minutes}</span>
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted mt-0.5">Minutes Total</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-elevated border border-border-subtle flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-primary">{assessment.pass_percentage}%</span>
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted mt-0.5">To Qualify</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-elevated border border-border-subtle flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-black text-primary">
                    {assessment.best_score_percent !== null ? `${Math.round(assessment.best_score_percent)}%` : "—"}
                  </span>
                  <span className="text-3xs font-bold uppercase tracking-wider text-text-muted mt-0.5">Best Score</span>
                </div>
              </div>

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

            <div className="rounded-[24px] bg-surface border border-border-subtle shadow-card p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent-primary" />
                <h2 className="text-base font-bold text-primary">Important Instructions Before You Begin</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-elevated/70 border border-border-subtle flex gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-accent-primary/10 text-accent-primary flex items-center justify-center shrink-0 mt-0.5">
                    <ScanFace className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-primary">No Negative Marking</h3>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      Every question has 4 options with a single correct choice and zero negative marking. Your webcam stays visible with 2s face matching &amp; look-away guard.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-elevated/70 border border-border-subtle flex gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-status-success/10 text-status-success flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-primary">Real-time Autosave</h3>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      {isCampusFlow
                        ? "Answers autosave instantly. Submitting Soft Skills launches the next stage of your Campus Assessment straightaway."
                        : "Your answers are instantly saved to the server as you select them. You can navigate back and forth freely before submission."}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-elevated/70 border border-border-subtle flex gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-accent-secondary/10 text-accent-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <Maximize2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-primary">Continuous Fullscreen Required</h3>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      The test runs in continuous fullscreen with AI face &amp; gaze monitoring. Leaving fullscreen, switching tabs, looking away, or face mismatch triggers warnings and blocks.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-elevated/70 border border-border-subtle flex gap-3.5">
                  <div className="w-8 h-8 rounded-xl bg-status-danger/10 text-status-danger flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-primary">Strict Anti-Copy Protection</h3>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      Text selection, copying question content, right-clicking, phone usage, and developer tools are strictly disabled and verified throughout.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border-subtle">
                {!assessment.can_attempt ? (
                  <div className="p-4 rounded-xl bg-status-warning/10 border border-status-warning/25 text-center space-y-2">
                    <p className="text-xs font-bold text-status-warning">
                      You&apos;ve used all {assessment.max_attempts} attempt(s) for this assessment.
                    </p>
                    <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline">
                      <ArrowLeft className="w-3.5 h-3.5" /> {backLabel}
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="text-2xs text-text-muted">
                      <span>Ensure good front lighting and keep only your face visible before clicking Begin.</span>
                    </div>

                    <button
                      onClick={beginOrResume}
                      disabled={startingSession}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-primary hover:bg-accent-primary-hover px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-accent-primary/25 transition-all hover:shadow-xl hover:shadow-accent-primary/35 disabled:opacity-60 whitespace-nowrap"
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
            badge={isCampusFlow ? "Campus Assessment · Soft Skills" : undefined}
            sessionNote={assessment.title}
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
            candidateName={user?.name ?? ""}
            startLabel="Begin Assessment"
            onLeave={() => router.push(backHref)}
          />
        )}

        {/* ── STAGE: LOCKED SCREEN ────────────────────────────────────────── */}
        {isLocked && (
          <ProctoringLockedScreen
            activity="soft_skill"
            session={proctoring.session}
            onBack={() => router.push(backHref)}
            secondary={
              resultHref
                ? { label: "View result", onClick: () => router.push(resultHref) }
                : undefined
            }
          />
        )}

        {/* ── STAGE: SUBMITTING TRANSITION ────────────────────────────────── */}
        {!isLocked && stage === "submitting" && (
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-md rounded-[28px] border border-border-subtle bg-surface/90 backdrop-blur-md p-8 shadow-card space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-primary/15 text-accent-primary">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h2 className="text-lg font-extrabold text-primary">{transitionLabel}</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                {isCampusFlow
                  ? "Saving your Soft Skills scorecard and preparing your next Campus Assessment round."
                  : "Calculating your final score and category breakdown."}
              </p>
            </div>
          </div>
        )}

        {/* ── STAGE: TAKING (EXECUTIVE INTERVIEW-ROOM STYLE) ──────────────── */}
        {!isLocked && stage === "taking" && active && (
          <>
            {examActive && (
              <InterviewSessionHud
                embedded
                phase={proctoring.phase}
                session={proctoring.session}
                lastViolation={proctoring.lastViolation}
                candidateName={user?.name ?? "Student"}
                cameraStream={proctoring.cameraStream}
                onResumeFullscreen={proctoring.resumeFullscreen}
              />
            )}
            <TakingTest
              active={active}
              answers={answers}
              flaggedIds={flaggedIds}
              onToggleFlag={toggleFlag}
              currentIndex={currentIndex}
              setCurrentIndex={setCurrentIndex}
              timeLabel={timeLabel}
              remainingSeconds={remainingSeconds}
              answeredCount={answeredCount}
              onSelect={handleSelect}
              onClear={handleClearAnswer}
              onSubmit={() => setConfirmingSubmit(true)}
              submitting={false}
              cameraStream={proctoring.cameraStream}
              candidateName={user?.name ?? "Student"}
              proctoringSession={proctoring.session}
              isCampusFlow={isCampusFlow}
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
              className="relative z-10 w-full max-w-md rounded-[24px] bg-surface border border-border-strong shadow-card p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 text-accent-primary flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-primary text-base">
                    {isCampusFlow ? "Submit Soft Skills & Continue?" : "Submit Assessment?"}
                  </h3>
                  <p className="text-2xs text-text-muted">
                    {isCampusFlow
                      ? "Your next round will open straightaway after submission."
                      : "Review your attempt progress before submitting."}
                  </p>
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
                  className="flex-1 py-2.5 rounded-full border border-border-subtle text-text-secondary hover:text-primary text-xs font-bold transition-colors"
                >
                  Keep Reviewing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingSubmit(false);
                    handleSubmit();
                  }}
                  className="flex-1 py-2.5 rounded-full bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors shadow-md shadow-accent-primary/20"
                >
                  {isCampusFlow ? "Submit & Next Round" : "Confirm & Submit"}
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
// TAKING TEST VIEW COMPONENT — Executive Interview-Room Layout
// ─────────────────────────────────────────────────────────────────────────────

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function TakingTest({
  active,
  answers,
  flaggedIds,
  onToggleFlag,
  currentIndex,
  setCurrentIndex,
  timeLabel,
  remainingSeconds,
  answeredCount,
  onSelect,
  onClear,
  onSubmit,
  submitting,
  cameraStream,
  candidateName,
  proctoringSession,
  isCampusFlow,
}: {
  active: SoftSkillActiveSession;
  answers: Record<number, number>;
  flaggedIds: Set<number>;
  onToggleFlag: (responseId: number) => void;
  currentIndex: number;
  setCurrentIndex: (i: number) => void;
  timeLabel: string;
  remainingSeconds: number;
  answeredCount: number;
  onSelect: (responseId: number, index: number) => void;
  onClear: (responseId: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  cameraStream: MediaStream | null;
  candidateName: string;
  proctoringSession: ReturnType<typeof useInterviewProctoring>["session"];
  isCampusFlow: boolean;
}) {
  const { ai, graceWarning } = useIntegrityUi();
  const question: SoftSkillSessionQuestion = active.questions[currentIndex];
  const isLowTime = remainingSeconds <= 300;
  const isCriticalTime = remainingSeconds <= 60;
  const categoryTheme = CATEGORY_THEMES[question.category] ?? { bg: "bg-elevated", text: "text-text-muted", border: "border-border-subtle" };
  const currentSelection = answers[question.response_id];
  const isFlagged = flaggedIds.has(question.response_id);
  const progressPercent = Math.round((answeredCount / active.questions.length) * 100);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      className="relative z-10 flex-1 min-h-0 flex flex-col select-none"
      style={{ userSelect: "none", WebkitUserSelect: "none", MozUserSelect: "none", msUserSelect: "none" }}
    >
      {/* ── TOP INTERVIEW-ROOM STYLE HEADER ───────────────────────────────── */}
      <header className="flex items-center gap-x-4 gap-y-2 px-4 sm:px-8 pt-4 pb-2 shrink-0">
        <div className="flex shrink-0 items-center gap-3 min-w-0">
          <Wordmark className="text-xl sm:text-2xl" />
          <span className="hidden h-6 w-px bg-border-strong sm:block" aria-hidden />
          <div className="hidden min-w-0 sm:block">
            <p className="text-2xs font-extrabold leading-tight text-primary truncate">
              {isCampusFlow ? "Campus Assessment · Soft Skills" : "Soft Skills Assessment"}
            </p>
            <p className="text-3xs font-semibold leading-tight text-text-muted truncate max-w-[260px]">
              {active.assessment.title}
            </p>
          </div>
        </div>

        {/* Center Progress Bar */}
        <div className="hidden flex-1 justify-center px-4 md:flex">
          <div className="w-full max-w-md space-y-1">
            <div className="flex items-center justify-between text-3xs font-bold text-text-muted">
              <span>Question {currentIndex + 1} of {active.questions.length}</span>
              <span className="text-primary">{answeredCount}/{active.questions.length} Answered ({progressPercent}%)</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-text-muted/20">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </div>

        {/* Right Controls: Timer, StrikePill, Submit */}
        <div className="ml-auto flex shrink-0 items-center gap-2.5 md:ml-0">
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-3.5 py-2 font-mono text-sm font-extrabold tabular-nums shadow-sm transition-colors",
              isCriticalTime
                ? "border-status-danger/40 bg-status-danger/15 text-status-danger animate-pulse"
                : isLowTime
                ? "border-status-warning/40 bg-status-warning/15 text-status-warning"
                : "border-border-subtle bg-surface/85 text-primary"
            )}
            title="Time Remaining"
          >
            <Clock className="h-4 w-4 shrink-0" aria-hidden />
            <span>{timeLabel}</span>
          </div>

          {proctoringSession && <StrikePill session={proctoringSession} />}

          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-primary hover:bg-accent-primary-hover px-4 sm:px-5 py-2 text-xs font-bold text-white shadow-md shadow-accent-primary/25 transition-all disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            <span>{isCampusFlow ? "Submit & Next" : "Submit Test"}</span>
          </button>
        </div>
      </header>

      {/* ── MAIN 3-COLUMN WORKSPACE: Camera Rail + Question Stage + Palette ── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 pb-5 pt-2 sm:px-8 lg:grid-cols-[260px_minmax(0,1fr)_260px] lg:gap-6">
        {/* LEFT COLUMN: Dedicated Always-Visible Camera & AI Proctor Panel */}
        <aside className="flex flex-col gap-3 min-h-0">
          <div className="flex items-start gap-3 lg:flex-col">
            <div className="w-36 sm:w-44 lg:w-full shrink-0">
              <CameraTile
                stream={cameraStream}
                name={candidateName}
                className={cn(
                  "transition-all",
                  graceWarning && "ring-2 ring-status-danger border-status-danger"
                )}
              />
            </div>

            <div className="flex-1 lg:w-full rounded-[20px] border border-border-subtle bg-surface/85 backdrop-blur-md p-3.5 shadow-subtle space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-3xs font-extrabold uppercase tracking-wider text-primary">
                  <ScanFace className="h-3.5 w-3.5 text-accent-primary" />
                  AI Face Proctor
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    graceWarning
                      ? "bg-status-danger/15 text-status-danger"
                      : ai === "ready"
                      ? "bg-status-success/15 text-status-success"
                      : "bg-elevated text-text-muted"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", graceWarning ? "bg-status-danger animate-ping" : ai === "ready" ? "bg-status-success animate-pulse" : "bg-text-muted")} />
                  {graceWarning ? "Alert" : ai === "ready" ? "Verified" : ai === "loading" ? "Loading" : "Camera On"}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-text-secondary">
                <div className="flex items-center gap-2">
                  <Camera className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">2s face match active</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">Look-away &amp; phone guard</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">Fullscreen &amp; anti-copy</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER COLUMN: Question Stage */}
        <section className="min-h-0 flex flex-col rounded-[24px] border border-border-subtle bg-surface/90 backdrop-blur-md shadow-card overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 sm:px-7 py-3.5 border-b border-border-subtle bg-surface/50 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-3xs font-extrabold uppercase tracking-widest text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-full px-2.5 py-0.5">
                Question {currentIndex + 1} / {active.questions.length}
              </span>
              <span className={cn("text-3xs font-bold px-2.5 py-0.5 rounded-full border", categoryTheme.bg, categoryTheme.text, categoryTheme.border)}>
                {CATEGORY_LABELS[question.category]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleFlag(question.response_id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-3xs font-bold border transition-colors",
                  isFlagged
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/35"
                    : "bg-elevated/60 text-text-muted border-border-subtle hover:text-primary"
                )}
              >
                <Flag className="h-3 w-3" />
                {isFlagged ? "Flagged" : "Flag"}
              </button>
              <span className="hidden sm:inline text-3xs font-semibold text-text-muted">1 Mark</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-7">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={question.response_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                className="space-y-6"
              >
                <p className="text-base sm:text-lg font-semibold text-primary leading-relaxed select-none">
                  {question.question_text}
                </p>

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
                          "group w-full text-left p-4 rounded-2xl text-xs sm:text-sm font-medium border transition-all flex items-start gap-3.5",
                          isSelected
                            ? "bg-accent-primary/12 border-accent-primary text-primary shadow-sm ring-1 ring-accent-primary"
                            : "bg-elevated/60 border-border-subtle text-text-secondary hover:border-accent-primary/40 hover:bg-surface-hover hover:text-primary"
                        )}
                      >
                        <span
                          className={cn(
                            "w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-colors border",
                            isSelected
                              ? "bg-accent-primary text-white border-accent-primary shadow-sm"
                              : "bg-surface text-text-secondary border-border-subtle group-hover:border-accent-primary/40 group-hover:text-primary"
                          )}
                        >
                          {optionKey}
                        </span>
                        <span className="flex-1 mt-0.5 leading-relaxed select-none">{option}</span>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-accent-primary shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="flex items-center justify-between px-5 sm:px-7 py-3.5 border-t border-border-subtle bg-surface/50 gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border-subtle text-xs font-bold text-text-secondary hover:text-primary hover:bg-surface-hover disabled:opacity-40 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {currentSelection !== undefined && (
                <button
                  type="button"
                  onClick={() => onClear(question.response_id)}
                  className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-status-warning transition-colors px-2.5 py-1.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear
                </button>
              )}

              {currentIndex < active.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors shadow-sm"
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-status-success hover:bg-status-success/90 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isCampusFlow ? "Finish & Next Round" : "Finish & Submit"}
                </button>
              )}
            </div>
          </footer>
        </section>

        {/* RIGHT COLUMN: Question Palette */}
        <aside className="rounded-[24px] border border-border-subtle bg-surface/85 backdrop-blur-md shadow-subtle p-4 flex flex-col justify-between min-h-0">
          <div className="space-y-3 min-h-0 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-3xs font-extrabold uppercase tracking-widest text-text-muted">Question Palette</span>
              <span className="text-3xs font-bold text-accent-primary">{answeredCount}/{active.questions.length}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted pb-2 border-b border-border-subtle">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-status-success" /> Done
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Flagged
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-border-strong" /> Todo
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 overflow-y-auto p-1">
              {active.questions.map((q, i) => {
                const isAnswered = answers[q.response_id] !== undefined;
                const qFlagged = flaggedIds.has(q.response_id);
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={q.response_id}
                    type="button"
                    onClick={() => setCurrentIndex(i)}
                    className={cn(
                      "relative h-8 rounded-xl text-2xs font-extrabold flex items-center justify-center transition-all border",
                      isCurrent
                        ? "bg-accent-primary text-white border-accent-primary ring-2 ring-accent-primary/40 shadow-sm"
                        : qFlagged
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/35"
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

          <div className="pt-3 border-t border-border-subtle mt-3 space-y-2.5 shrink-0">
            <div className="text-center text-[11px] text-text-muted">
              Keys <kbd className="font-mono bg-elevated px-1 py-0.5 rounded border border-border-subtle">1–4</kbd> or{" "}
              <kbd className="font-mono bg-elevated px-1 py-0.5 rounded border border-border-subtle">A–D</kbd> · Arrows{" "}
              <kbd className="font-mono bg-elevated px-1 py-0.5 rounded border border-border-subtle">←/→</kbd>
            </div>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary border border-accent-primary/25 text-xs font-bold transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isCampusFlow ? "Submit & Next Round" : "Submit Assessment"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
