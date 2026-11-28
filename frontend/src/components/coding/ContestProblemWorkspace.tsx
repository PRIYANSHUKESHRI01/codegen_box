"use client";

import { SessionLoader } from "@/components/ui/SessionLoader";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import {
  GripVertical,
  GripHorizontal,
  Code2,
  FileText,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mic,
  ScanFace,
  ListChecks,
  Rocket,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ProblemHeaderBar } from "@/components/practice/ProblemHeaderBar";
import { ProblemDescriptionPanel } from "@/components/practice/ProblemDescriptionPanel";
import { CodeEditorPanel } from "@/components/practice/CodeEditorPanel";
import { ConsolePanel, ConsoleTab } from "@/components/practice/ConsolePanel";
import { Button } from "@/components/ui/Button";
import { ProblemDetail } from "@/types/problem";
import type { ContestDetail } from "@/types/liveContest";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useJudgedRun } from "@/lib/useJudgedRun";
import { useResilientNavigation } from "@/lib/useResilientNavigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { pickInitialLanguage, recallLastLanguage, rememberLastLanguage } from "@/lib/studentPreferences";
import { cn } from "@/lib/utils";
import { useProctoring } from "@/lib/proctoring/useProctoring";
import { ProctoringConsentGate } from "@/components/proctoring/ProctoringConsentGate";
import { contestProblemHref } from "@/components/contests/ContestProblemRow";
import { loadContestProblem, peekContestProblem, prefetchContestProblem, seedContestProblems } from "@/lib/contestProblemPrefetch";
import { warmUpEditor } from "@/lib/editorWarmup";
import { StrikePill } from "@/components/proctoring/InterviewSessionHud";
import { ProctoringOverlay, ProctoringStatusPill } from "@/components/proctoring/ProctoringOverlay";
import { ProctoringLockedScreen } from "@/components/proctoring/ProctoringLockedScreen";

function draftKey(contestSlug: string, contestProblemId: string, language: string) {
  return `aptrun:contest-draft:${contestSlug}:${contestProblemId}:${language}`;
}

export function ContestProblemWorkspace({ mode = "contest" }: { mode?: "contest" | "assessment" }) {
  return (
    <Suspense fallback={<SessionLoader />}>
      <ContestProblemWorkspaceContent mode={mode} />
    </Suspense>
  );
}

function ContestProblemWorkspaceContent({ mode }: { mode: "contest" | "assessment" }) {
  const { status, user } = useAuthGuard(["user"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("contest") ?? searchParams.get("slug") ?? "";
  const urlProblemId = searchParams.get("contestProblemId") ?? "";
  const assessmentSlug = searchParams.get("assessment") ?? "";
  const nav = useResilientNavigation();

  const [activeProblemId, setActiveProblemId] = useState(urlProblemId);
  const [proctoringAnchorId, setProctoringAnchorId] = useState(urlProblemId);

  // Sync URL query param changes (e.g. initial arrival or browser Back/Forward), and lock proctoringAnchorId
  // per contest slug so switching Q1 <-> Q2 <-> Q3 never tears down or restarts the proctoring engine.
  useEffect(() => {
    if (urlProblemId) {
      setActiveProblemId(urlProblemId);
      setProctoringAnchorId((prev) => prev || urlProblemId);
    }
  }, [urlProblemId]);

  const prevSlugRef = useRef(slug);
  useEffect(() => {
    if (prevSlugRef.current !== slug) {
      prevSlugRef.current = slug;
      setProctoringAnchorId(urlProblemId);
      setActiveProblemId(urlProblemId);
    }
  }, [slug, urlProblemId]);

  const contestProblemId = activeProblemId || urlProblemId;

  const isCampusFlow = mode === "assessment" || Boolean(assessmentSlug);
  const backHref = isCampusFlow
    ? assessmentSlug
      ? `/dashboard/assessments/view?slug=${encodeURIComponent(assessmentSlug)}`
      : "/dashboard/assessments"
    : slug
    ? `/dashboard/contests/view?slug=${slug}`
    : "/dashboard/contests";
  const backLabel = isCampusFlow ? "Back to Campus Assessment" : "Back to Contest";

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [, setPoints] = useState<number | null>(null);
  const [contestProblems, setContestProblems] = useState<NonNullable<ContestDetail["problems"]>>([]);
  const [submittedProblemIds, setSubmittedProblemIds] = useState<Set<string>>(() => new Set());
  const [solvedProblemIds, setSolvedProblemIds] = useState<Set<string>>(() => new Set());
  const [advancingNextStage, setAdvancingNextStage] = useState(false);
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const [lastSubmittedVerdict, setLastSubmittedVerdict] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not_found" | "forbidden" | "error">("loading");
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("javascript");
  const [code, setCode] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [revealedHints, setRevealedHints] = useState(0);
  const [activeExample, setActiveExample] = useState(0);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("testcase");
  const consolePanel = usePanelRef();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"problem" | "code">("problem");

  const proctoringBasePath = `/contests/${slug}/problems/${proctoringAnchorId || contestProblemId}`;
  const problemBasePath = `/contests/${slug}/problems/${contestProblemId}`;

  // A stable getter (never changes identity) so useProctoring's violation
  // listeners don't need to re-register on every keystroke just because
  // `code` changed — they read the latest value through this ref instead.
  const codeRef = useRef({ code: "", language: "javascript" });
  useEffect(() => {
    codeRef.current = { code, language };
  }, [code, language]);
  const getCurrentCode = useCallback(() => codeRef.current, []);

  const proctoring = useProctoring({
    basePath: proctoringBasePath,
    activeProblemId: contestProblemId,
    keepKey: isCampusFlow && assessmentSlug ? `assessment:${assessmentSlug}` : undefined,
    requireScreenShare: isCampusFlow,
    requireChromium: isCampusFlow,
    enabled: loadState === "ready",
    getCurrentCode,
  });

  const problemHref = useCallback(
    (targetId: number | string) => {
      if (mode === "assessment") {
        const params = new URLSearchParams({
          slug,
          contestProblemId: String(targetId),
        });
        if (assessmentSlug) params.set("assessment", assessmentSlug);
        return `/dashboard/assessments/coding?${params.toString()}`;
      }
      return isCampusFlow && assessmentSlug
        ? `${contestProblemHref(slug, targetId)}&assessment=${encodeURIComponent(assessmentSlug)}`
        : contestProblemHref(slug, targetId);
    },
    [mode, slug, isCampusFlow, assessmentSlug]
  );

  const applyLoadedProblem = useCallback(
    (res: { problem: ProblemDetail; points: number }) => {
      setProblem(res.problem);
      setPoints(res.points);
      setRevealedHints(0);
      setActiveExample(0);
      setConsoleTab("testcase");
      setLanguage(pickInitialLanguage(Object.keys(res.problem.starter_code ?? {}), user, recallLastLanguage(user?.id)));
      setLoadState("ready");
    },
    [user]
  );

  const handleSwitchProblem = useCallback(
    (targetId: number | string) => {
      const nextId = String(targetId);
      if (!slug || !nextId || nextId === String(contestProblemId)) return;

      const targetHref = problemHref(nextId);

      // Update address bar cleanly in-place (no Next.js route transition / engine teardown).
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", targetHref);
      }
      setActiveProblemId(nextId);

      // Synchronously apply from memory cache if already loaded/prefetched for 0ms question toggling.
      const cached = peekContestProblem(slug, nextId);
      if (cached) {
        applyLoadedProblem(cached);
      }
    },
    [slug, contestProblemId, problemHref, applyLoadedProblem]
  );

  useEffect(() => {
    if (status !== "ready") return;
    warmUpEditor();
    if (isCampusFlow) {
      router.prefetch("/dashboard/interviews/session");
    }
    if (!slug || !contestProblemId) {
      setLoadState("not_found");
      return;
    }

    const cached = peekContestProblem(slug, contestProblemId);
    if (cached) {
      applyLoadedProblem(cached);
      return;
    }

    let cancelled = false;

    loadContestProblem(slug, contestProblemId)
      .then((res) => {
        if (cancelled) return;
        applyLoadedProblem(res);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setLoadState("not_found");
        else if (err instanceof ApiError && err.status === 403) {
          setForbiddenMessage(err.message || null);
          setLoadState("forbidden");
        } else setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slug, contestProblemId]);

  // Bulk-load the coding round's problem list + problem details once so Q1/Q2/Q3 toggles are instantaneous.
  useEffect(() => {
    if (status !== "ready" || !slug) return;
    let cancelled = false;
    api
      .get<ContestDetail>(`/contests/${slug}?include_details=1`)
      .then((res) => {
        if (cancelled || !res.problems) return;
        if (res.problem_details) {
          seedContestProblems(slug, res.problem_details);
          const match = res.problem_details.find((item) => String(item.id) === String(contestProblemId));
          if (match) {
            applyLoadedProblem({ problem: match.problem, points: match.points });
          }
        }
        setContestProblems(res.problems);
        const solvedFromServer = new Set<string>();
        res.problems.forEach((cp) => {
          if (cp.solved) solvedFromServer.add(String(cp.id));
          if (!res.problem_details && String(cp.id) !== String(contestProblemId)) {
            prefetchContestProblem(slug, cp.id);
          }
        });
        if (solvedFromServer.size > 0) {
          setSolvedProblemIds((prev) => {
            const next = new Set(prev);
            solvedFromServer.forEach((id) => next.add(id));
            return next;
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slug]);

  const handleAdvanceToInterview = useCallback(async () => {
    if (!isCampusFlow || !assessmentSlug || advancingNextStage) return;
    setAdvancingNextStage(true);
    setAutoAdvanceCountdown(null);
    try {
      const next = await api.post<{ next_stage: "coding" | "interview" | "complete"; interview_slug?: string }>(
        `/assessments/${encodeURIComponent(assessmentSlug)}/advance`,
        { completed_stage: "coding" }
      );
      if (next.next_stage === "interview" && next.interview_slug) {
        if (proctoring.handOffSession) proctoring.handOffSession();
        else proctoring.endSession();
        toast.success("Coding round submitted! Opening AI Interview...");
        router.push(`/dashboard/interviews/session?slug=${encodeURIComponent(next.interview_slug)}&assessment=${encodeURIComponent(assessmentSlug)}`);
        return;
      }
      proctoring.endSession();
      nav.go(backHref);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not launch the AI Interview. Returning to Campus Assessment.");
      proctoring.endSession();
      nav.go(backHref);
    }
  }, [isCampusFlow, advancingNextStage, proctoring, assessmentSlug, router, nav, backHref]);

  useEffect(() => {
    if (autoAdvanceCountdown === null) return;
    if (autoAdvanceCountdown <= 0) {
      void handleAdvanceToInterview();
      return;
    }
    const id = window.setTimeout(() => setAutoAdvanceCountdown((n) => (n !== null ? n - 1 : null)), 1000);
    return () => window.clearTimeout(id);
  }, [autoAdvanceCountdown, handleAdvanceToInterview]);

  const currentProblemIdx = useMemo(
    () => contestProblems.findIndex((p) => String(p.id) === String(contestProblemId)),
    [contestProblems, contestProblemId]
  );
  const nextUnsolvedProblem = useMemo(() => {
    if (contestProblems.length <= 1) return null;
    const isDone = (id: number | string, solved?: boolean) =>
      Boolean(solved) || solvedProblemIds.has(String(id)) || submittedProblemIds.has(String(id));
    const after = contestProblems.slice(currentProblemIdx + 1).find((p) => !isDone(p.id, p.solved));
    if (after) return after;
    return contestProblems.find((p) => String(p.id) !== String(contestProblemId) && !isDone(p.id, p.solved)) ?? null;
  }, [contestProblems, currentProblemIdx, contestProblemId, submittedProblemIds, solvedProblemIds]);

  useEffect(() => {
    if (!problem) return;
    const saved = window.localStorage.getItem(draftKey(slug, contestProblemId, language));
    setCode(saved ?? problem.starter_code[language] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, language, contestProblemId]);

  const handleLanguageChange = (next: string) => {
    setLanguage(next);
    rememberLastLanguage(user?.id, next);
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    if (!problem) return;
    window.localStorage.setItem(draftKey(slug, contestProblemId, language), value);
    setSavedAt(Date.now());
  };

  const handleReset = () => {
    if (!problem) return;
    const starter = problem.starter_code[language] ?? "";
    setCode(starter);
    window.localStorage.setItem(draftKey(slug, contestProblemId, language), starter);
    setSavedAt(Date.now());
  };

  const ensureConsoleVisible = () => {
    const panel = consolePanel.current;
    if (panel && panel.getSize().asPercentage < 40) panel.resize("46%");
  };

  const judge = useJudgedRun({
    endpoint: problem ? problemBasePath : null,
    language,
    code,
    minCheckingMs: { run: 450, submit: 650 },
    onStart: () => {
      setConsoleTab("result");
      setMobileView("code");
      ensureConsoleVisible();
    },
    onVerdict: (action, verdict) => {
      if (action !== "submit") return;
      const pid = String(contestProblemId);
      const updatedSubmitted = new Set(submittedProblemIds);
      updatedSubmitted.add(pid);
      setSubmittedProblemIds(updatedSubmitted);

      const updatedSolved = new Set(solvedProblemIds);
      if (verdict.all_passed) {
        updatedSolved.add(pid);
        setSolvedProblemIds(updatedSolved);
      }

      if (!isCampusFlow) return;
      setLastSubmittedVerdict(verdict.status ?? (verdict.all_passed ? "Accepted" : "Submitted"));

      const allDone =
        contestProblems.length <= 1 ||
        contestProblems.every((p) => updatedSolved.has(String(p.id)) || updatedSubmitted.has(String(p.id)));
      if (allDone) {
        setAutoAdvanceCountdown(3);
      } else {
        toast.success(
          verdict.all_passed
            ? "Problem solved! Toggle to the next question on the left."
            : "Submission recorded! You can refine or toggle to another question on the left."
        );
      }
    },
  });
  const { state: runState, lastAction, result: runResult, error: runError, progress, startedAt, resultKey, execute: executeCode } = judge;

  const handleRun = () => void executeCode("run");
  const handleSubmit = () => void executeCode("submit");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) handleSubmit();
        else handleRun();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status !== "ready") {
    return <SessionLoader />;
  }

  return (
    <DashboardShell
      role="user"
      title={isCampusFlow ? "Launchpad Coding Round" : "Contest Arena"}
      fullBleed
      defaultSidebarCollapsed
      hideChrome={isCampusFlow || proctoring.phase === "active" || proctoring.phase === "fullscreen_lost"}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {(loadState === "loading" || (loadState === "ready" && proctoring.phase === "idle")) && (
          isCampusFlow ? (
            <LaunchpadCodingLoadingShell
              problems={contestProblems}
              activeProblemId={contestProblemId}
              solvedIds={solvedProblemIds}
              onBack={() => nav.go(backHref)}
              onSelect={handleSwitchProblem}
            />
          ) : (
            <SolveScreenSkeleton />
          )
        )}

        {loadState === "not_found" && (
          <CenteredNotice
            heading="Problem not found"
            body={isCampusFlow ? "This coding assessment question doesn't exist." : "This contest problem doesn't exist."}
            onBack={() => nav.go(backHref)}
            backLabel={backLabel}
          />
        )}

        {loadState === "forbidden" && (
          <CenteredNotice
            heading={forbiddenMessage?.toLowerCase().includes("locked out") ? "You've been locked out" : "Not available yet"}
            body={
              forbiddenMessage ??
              (isCampusFlow
                ? "Please unlock this stage from your Campus Assessment dashboard first."
                : "You need to register for this contest before you can open its problems.")
            }
            onBack={() => nav.go(backHref)}
            backLabel={backLabel}
          />
        )}

        {loadState === "error" && (
          <CenteredNotice heading="Couldn't load this problem" body="Something went wrong talking to the server. Please try again." retry />
        )}

        {loadState === "ready" && problem && (proctoring.phase === "consent" || proctoring.phase === "starting" || proctoring.phase === "blocked") && (
          <ProctoringConsentGate
            phase={proctoring.phase}
            consentError={proctoring.consentError}
            devicePreviewReady={proctoring.devicePreviewReady}
            previewVideoRef={proctoring.previewVideoRef}
            onEnableDevices={proctoring.enableDevicePreview}
            onConsent={(photo, descriptor) => {
              if (photo) proctoring.setBaselineIdentity?.(photo, descriptor);
              void proctoring.grantConsentAndStart();
            }}
            badge={isCampusFlow ? "Campus Assessment · Coding Round" : undefined}
            requireVerificationPhoto={true}
            cameraStream={proctoring.cameraStream}
            candidateName={user?.name ?? ""}
            onLeave={() => nav.go(backHref)}
          />
        )}

        {loadState === "ready" && problem && proctoring.phase === "locked" && (
          <ProctoringLockedScreen session={proctoring.session} onBack={() => nav.go(backHref)} />
        )}

        {loadState === "ready" && problem && (proctoring.phase === "active" || proctoring.phase === "fullscreen_lost") && (
          <>
            <ProctoringOverlay
              phase={proctoring.phase}
              session={proctoring.session}
              lastViolation={proctoring.lastViolation}
              studentName={user?.name ?? "Student"}
              rollNumber={user?.roll_number ?? null}
              onResumeFullscreen={proctoring.resumeFullscreen}
              hideStatusPill
            />

            <ProblemHeaderBar
              problem={problem}
              onBack={() => nav.go(backHref)}
              backPending={nav.pending}
              onRun={handleRun}
              onSubmit={handleSubmit}
              running={runState === "running"}
              activeAction={runState === "running" ? lastAction : null}
              backLabel={backLabel}
              statusSlot={proctoring.session ? <ProctoringStatusPill session={proctoring.session} /> : undefined}
              rightSlot={
                isCampusFlow ? (
                  <button
                    type="button"
                    onClick={() => void handleAdvanceToInterview()}
                    disabled={advancingNextStage}
                    className="inline-flex items-center gap-1.5 rounded-control bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    {advancingNextStage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                    <span className="hidden md:inline">Finish &amp; Start AI Interview</span>
                    <span className="md:hidden">AI Interview</span>
                  </button>
                ) : undefined
              }
            />

            {isCampusFlow && autoAdvanceCountdown !== null && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
                <div className="w-full max-w-md rounded-[24px] border border-border-strong bg-surface p-6 shadow-2xl space-y-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-primary">Coding Round Submitted!</h3>
                    <p className="text-xs text-text-secondary">
                      Latest verdict: <strong className="text-primary">{lastSubmittedVerdict ?? "Submitted"}</strong>. Launching AI Interview in{" "}
                      <strong className="text-accent-primary">{autoAdvanceCountdown}s</strong>…
                    </p>
                  </div>
                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setAutoAdvanceCountdown(null)}
                      className="flex-1 rounded-full border border-border-subtle px-4 py-2 text-xs font-bold text-text-secondary hover:text-primary"
                    >
                      Stay on Coding
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAdvanceToInterview()}
                      disabled={advancingNextStage}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-accent-primary hover:bg-accent-primary-hover px-4 py-2 text-xs font-bold text-white"
                    >
                      {advancingNextStage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                      Start AI Interview Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="hidden lg:flex flex-1 min-h-0">
              {contestProblems.length > 0 && (
                <aside className="w-[256px] shrink-0 border-r border-border-subtle bg-surface/95 flex flex-col justify-between overflow-hidden">
                  <div className="flex-1 min-h-0 flex flex-col">
                    {isCampusFlow && (
                      <div className="px-3.5 pt-3 pb-2.5 border-b border-border-subtle bg-gradient-to-b from-indigo-500/[0.06] to-transparent space-y-2 shrink-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                            <Rocket className="w-3.5 h-3.5" />
                            Launchpad · Stage 2
                          </span>
                          <span className="text-[10px] font-bold text-text-muted">Coding</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-center">
                          <span className="rounded-md bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 py-1 px-1 truncate">
                            1. Soft ✓
                          </span>
                          <span className="rounded-md bg-indigo-600 text-white py-1 px-1 truncate">
                            2. Coding
                          </span>
                          <span className="rounded-md bg-elevated text-text-muted py-1 px-1 truncate">
                            3. Interview
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="px-3.5 py-3 border-b border-border-subtle flex items-center justify-between gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <ListChecks className="w-4 h-4 text-accent-primary shrink-0" />
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-text-muted">Questions</span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 border border-emerald-500/25">
                        {solvedProblemIds.size}/{contestProblems.length} Solved
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
                      {contestProblems.map((cp, idx) => {
                        const pid = String(cp.id);
                        const isCurrent = pid === String(contestProblemId);
                        const isSolved = solvedProblemIds.has(pid) || Boolean(cp.solved);
                        const isAttempted = !isSolved && submittedProblemIds.has(pid);
                        return (
                          <button
                            key={cp.id}
                            type="button"
                            onMouseEnter={() => prefetchContestProblem(slug, cp.id)}
                            onClick={() => handleSwitchProblem(cp.id)}
                            className={cn(
                              "w-full text-left rounded-xl p-2.5 border transition-all flex flex-col gap-1.5",
                              isCurrent
                                ? "bg-accent-primary/10 border-accent-primary/50 shadow-sm"
                                : isSolved
                                ? "bg-emerald-500/[0.06] border-emerald-500/30 hover:bg-emerald-500/10"
                                : "bg-elevated/40 border-border-subtle hover:border-border-strong hover:bg-elevated/70"
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide",
                                  isCurrent
                                    ? "bg-accent-primary text-white"
                                    : isSolved
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                    : "bg-surface text-text-secondary border border-border-subtle"
                                )}
                              >
                                Q{idx + 1}
                              </span>
                              {isSolved ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Solved
                                </span>
                              ) : isAttempted ? (
                                <span className="text-[10px] font-bold text-amber-500">Submitted</span>
                              ) : (
                                <span className="text-[10px] font-semibold text-text-muted">{cp.points} pts</span>
                              )}
                            </div>

                            <p className={cn("text-xs font-bold leading-snug line-clamp-2", isCurrent ? "text-primary" : "text-text-secondary")}>
                              {cp.problem.title}
                            </p>

                            <div className="flex items-center justify-between text-[10px] font-semibold text-text-muted">
                              <span
                                className={cn(
                                  "capitalize",
                                  cp.problem.difficulty === "easy"
                                    ? "text-emerald-500"
                                    : cp.problem.difficulty === "hard"
                                    ? "text-rose-500"
                                    : "text-amber-500"
                                )}
                              >
                                {cp.problem.difficulty}
                              </span>
                              <span>{cp.points} pts</span>
                            </div>
                          </button>
                        );
                      })}

                      {nextUnsolvedProblem && (submittedProblemIds.has(String(contestProblemId)) || solvedProblemIds.has(String(contestProblemId))) && (
                        <button
                          type="button"
                          onClick={() => handleSwitchProblem(nextUnsolvedProblem.id)}
                          className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-accent-primary/35 bg-accent-primary/10 px-3 py-2 text-[11px] font-bold text-accent-primary hover:bg-accent-primary/15 transition-colors"
                        >
                          <span>Next Unsolved</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isCampusFlow && (
                    <div className="p-3 border-t border-border-subtle bg-elevated/40 space-y-2.5 shrink-0">
                      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-text-muted px-0.5">
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                          <ScanFace className="w-3.5 h-3.5" />
                          AI Proctor Active
                        </span>
                        {proctoring.session && <StrikePill session={proctoring.session} className="py-0.5 px-2 text-[10px]" />}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleAdvanceToInterview()}
                        disabled={advancingNextStage}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition-colors disabled:opacity-60"
                      >
                        {advancingNextStage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                        <span>Finish &amp; Start AI Interview</span>
                      </button>
                    </div>
                  )}
                </aside>
              )}

              <Group orientation="horizontal" className="flex-1 min-h-0">
                <Panel defaultSize="42" minSize="28" maxSize="62">
                  <div className="h-full border-r border-border-subtle">
                    <ProblemDescriptionPanel
                      problem={problem}
                      revealedHints={revealedHints}
                      onRevealNextHint={() => setRevealedHints((n) => n + 1)}
                    />
                  </div>
                </Panel>
                <ResizeHandle direction="horizontal" />
                <Panel minSize="38">
                  <Group orientation="vertical">
                    <Panel defaultSize="68" minSize="30">
                      <CodeEditorPanel
                        language={language}
                        availableLanguages={Object.keys(problem.starter_code)}
                        onLanguageChange={handleLanguageChange}
                        code={code}
                        onCodeChange={handleCodeChange}
                        onReset={handleReset}
                        fontSize={fontSize}
                        onFontSizeChange={setFontSize}
                        savedAt={savedAt}
                        onRun={handleRun}
                        onSubmit={handleSubmit}
                        restrictClipboard
                      />
                    </Panel>
                    <ResizeHandle direction="vertical" />
                    <Panel defaultSize="32" minSize="18" panelRef={consolePanel}>
                      <ConsolePanel
                        examples={problem.examples}
                        activeExample={activeExample}
                        onSelectExample={setActiveExample}
                        activeTab={consoleTab}
                        onTabChange={setConsoleTab}
                        lastAction={lastAction}
                        runState={runState}
                        runResult={runResult}
                        errorMessage={runError}
                        progress={progress}
                        startedAt={startedAt}
                        resultKey={resultKey}
                        caseCounts={problem.case_counts}
                        onSubmit={handleSubmit}
                        onRetry={() => lastAction && void executeCode(lastAction)}
                      />
                    </Panel>
                  </Group>
                </Panel>
              </Group>
            </div>

            <div className="flex lg:hidden flex-col flex-1 min-h-0">
              {contestProblems.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border-subtle bg-elevated/40 px-3 py-2 shrink-0">
                  {contestProblems.map((cp, idx) => {
                    const pid = String(cp.id);
                    const isCurrent = pid === String(contestProblemId);
                    const isSolved = solvedProblemIds.has(pid) || Boolean(cp.solved);
                    return (
                      <button
                        key={cp.id}
                        type="button"
                        onClick={() => handleSwitchProblem(cp.id)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold border whitespace-nowrap transition-colors",
                          isCurrent
                            ? "bg-accent-primary text-white border-accent-primary"
                            : isSolved
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
                            : "bg-surface text-text-secondary border-border-subtle"
                        )}
                      >
                        {isSolved && <CheckCircle2 className="w-3 h-3" />}
                        <span>Q{idx + 1}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex border-b border-border-subtle shrink-0">
                <button
                  onClick={() => setMobileView("problem")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors",
                    mobileView === "problem" ? "border-accent-primary text-accent-primary" : "border-transparent text-text-muted"
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Problem
                </button>
                <button
                  onClick={() => setMobileView("code")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors",
                    mobileView === "code" ? "border-accent-primary text-accent-primary" : "border-transparent text-text-muted"
                  )}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Code
                </button>
              </div>

              <div className="flex-1 min-h-0">
                {mobileView === "problem" ? (
                  <ProblemDescriptionPanel
                    problem={problem}
                    revealedHints={revealedHints}
                    onRevealNextHint={() => setRevealedHints((n) => n + 1)}
                  />
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 min-h-0">
                      <CodeEditorPanel
                        language={language}
                        availableLanguages={Object.keys(problem.starter_code)}
                        onLanguageChange={handleLanguageChange}
                        code={code}
                        onCodeChange={handleCodeChange}
                        onReset={handleReset}
                        fontSize={fontSize}
                        onFontSizeChange={setFontSize}
                        savedAt={savedAt}
                        onRun={handleRun}
                        onSubmit={handleSubmit}
                        restrictClipboard
                      />
                    </div>
                    <div className="h-64 border-t border-border-subtle shrink-0">
                      <ConsolePanel
                        examples={problem.examples}
                        activeExample={activeExample}
                        onSelectExample={setActiveExample}
                        activeTab={consoleTab}
                        onTabChange={setConsoleTab}
                        lastAction={lastAction}
                        runState={runState}
                        runResult={runResult}
                        errorMessage={runError}
                        progress={progress}
                        startedAt={startedAt}
                        resultKey={resultKey}
                        caseCounts={problem.case_counts}
                        onSubmit={handleSubmit}
                        onRetry={() => lastAction && void executeCode(lastAction)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function ResizeHandle({ direction }: { direction: "horizontal" | "vertical" }) {
  return (
    <Separator
      className={cn(
        "group relative bg-border-subtle hover:bg-accent-primary/40 transition-colors shrink-0",
        direction === "horizontal" ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize"
      )}
    >
      <div
        className={cn(
          "absolute flex items-center justify-center text-text-muted group-hover:text-accent-primary transition-colors pointer-events-none",
          direction === "horizontal" ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-3" : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-3"
        )}
      >
        {direction === "horizontal" ? <GripVertical className="w-3 h-3" /> : <GripHorizontal className="w-3 h-3" />}
      </div>
    </Separator>
  );
}

function LaunchpadCodingLoadingShell({
  problems,
  activeProblemId,
  solvedIds,
  onBack,
  onSelect,
}: {
  problems: NonNullable<ContestDetail["problems"]>;
  activeProblemId: string;
  solvedIds: Set<string>;
  onBack: () => void;
  onSelect: (id: number | string) => void;
}) {
  const placeholderSlots = [0, 1, 2];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background text-primary">
      <div className="flex items-center justify-between gap-3 px-4 h-14 border-b border-border-subtle bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-bold text-text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Campus Assessment</span>
          </button>
          <div className="h-5 w-px bg-border-subtle hidden sm:block" />
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-extrabold text-primary">Launchpad · Coding Round</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold">
          <span className="rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 px-2.5 py-1">1. Soft Skills ✓</span>
          <span className="rounded-full bg-indigo-600 text-white px-2.5 py-1">2. Coding Round</span>
          <span className="rounded-full bg-elevated text-text-muted px-2.5 py-1">3. AI Interview</span>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className="hidden lg:flex w-[256px] shrink-0 border-r border-border-subtle bg-surface/95 flex-col">
          <div className="px-3.5 py-3 border-b border-border-subtle flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-text-muted">
              <ListChecks className="w-4 h-4 text-accent-primary" />
              Questions (3)
            </span>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-primary" />
          </div>
          <div className="p-2.5 space-y-2">
            {problems.length > 0
              ? problems.map((cp, idx) => {
                  const pid = String(cp.id);
                  const isCurrent = pid === String(activeProblemId);
                  const isSolved = solvedIds.has(pid) || Boolean(cp.solved);
                  return (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => onSelect(cp.id)}
                      className={cn(
                        "w-full text-left rounded-xl p-2.5 border transition-all flex flex-col gap-1.5",
                        isCurrent ? "bg-accent-primary/10 border-accent-primary/50" : "bg-elevated/40 border-border-subtle"
                      )}
                    >
                      <div className="flex items-center justify-between text-[10px] font-extrabold">
                        <span className={cn("rounded-md px-1.5 py-0.5", isCurrent ? "bg-accent-primary text-white" : "bg-surface text-text-secondary")}>
                          Q{idx + 1}
                        </span>
                        {isSolved ? <span className="text-emerald-600">Solved</span> : <span className="text-text-muted">{cp.points} pts</span>}
                      </div>
                      <p className="text-xs font-bold text-primary line-clamp-2">{cp.problem.title}</p>
                    </button>
                  );
                })
              : placeholderSlots.map((idx) => (
                  <div key={idx} className="rounded-xl p-2.5 border border-border-subtle bg-elevated/40 space-y-2 animate-pulse">
                    <div className="flex items-center justify-between">
                      <span className="rounded-md px-1.5 py-0.5 text-[10px] font-extrabold bg-surface text-text-muted">
                        Q{idx + 1}
                      </span>
                      <div className="h-3 w-10 rounded bg-surface" />
                    </div>
                    <div className="h-3.5 w-4/5 rounded bg-surface" />
                    <div className="h-2.5 w-1/2 rounded bg-surface" />
                  </div>
                ))}
          </div>
        </aside>

        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-surface/30">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-primary">Opening Launchpad Coding Round...</h2>
            <p className="text-xs text-text-muted max-w-sm">
              Loading your 3 coding challenges and syncing your proctored workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SolveScreenSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0 animate-pulse">
      <div className="h-14 border-b border-border-subtle flex items-center px-4 gap-3 shrink-0">
        <div className="w-6 h-6 rounded-control bg-elevated" />
        <div className="h-4 w-40 rounded bg-elevated" />
        <div className="ml-auto h-7 w-16 rounded-control bg-elevated" />
        <div className="h-7 w-20 rounded-control bg-elevated" />
      </div>
      <div className="flex-1 flex gap-px bg-border-subtle overflow-hidden">
        <div className="w-[42%] bg-surface p-6 space-y-3">
          <div className="h-3 w-full rounded bg-elevated" />
          <div className="h-3 w-5/6 rounded bg-elevated" />
          <div className="h-3 w-2/3 rounded bg-elevated" />
          <div className="h-24 w-full rounded bg-elevated mt-6" />
          <div className="h-24 w-full rounded bg-elevated" />
        </div>
        <div className="flex-1 bg-[#1e1e1e]" />
      </div>
    </div>
  );
}

function CenteredNotice({ heading, body, onBack, backLabel = "Back", retry }: { heading: string; body: string; onBack?: () => void; backLabel?: string; retry?: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm space-y-3">
        <h3 className="text-lg font-bold text-primary">{heading}</h3>
        <p className="text-sm text-text-secondary">{body}</p>
        {retry ? (
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Retry
          </Button>
        ) : (
          onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              {backLabel}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
