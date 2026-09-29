"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Group, Panel, Separator } from "react-resizable-panels";
import { GripVertical, GripHorizontal, Code2, FileText } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ProblemHeaderBar } from "@/components/practice/ProblemHeaderBar";
import { ProblemDescriptionPanel } from "@/components/practice/ProblemDescriptionPanel";
import { CodeEditorPanel } from "@/components/practice/CodeEditorPanel";
import { ConsolePanel, ConsoleTab, LastAction, RunState } from "@/components/practice/ConsolePanel";
import { Button } from "@/components/ui/Button";
import { ProblemDetail, RunResponse } from "@/types/problem";
import { api, ApiError } from "@/lib/api";
import { executeJudged } from "@/lib/judge";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { cn } from "@/lib/utils";
import { useProctoring } from "@/lib/proctoring/useProctoring";
import { ProctoringConsentGate } from "@/components/proctoring/ProctoringConsentGate";
import { ProctoringOverlay } from "@/components/proctoring/ProctoringOverlay";
import { ProctoringLockedScreen } from "@/components/proctoring/ProctoringLockedScreen";

function draftKey(contestSlug: string, contestProblemId: string, language: string) {
  return `codeforge:contest-draft:${contestSlug}:${contestProblemId}:${language}`;
}

export default function ContestProblemSolvePage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <ContestProblemSolvePageContent />
    </Suspense>
  );
}

function ContestProblemSolvePageContent() {
  const { status, user } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  const contestProblemId = searchParams.get("contestProblemId") ?? "";
  const router = useRouter();

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not_found" | "forbidden" | "error">("loading");
  const [forbiddenMessage, setForbiddenMessage] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("javascript");
  const [code, setCode] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [revealedHints, setRevealedHints] = useState(0);
  const [activeExample, setActiveExample] = useState(0);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("testcase");
  const [lastAction, setLastAction] = useState<LastAction>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [runResult, setRunResult] = useState<RunResponse | null>(null);
  const [queueNote, setQueueNote] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"problem" | "code">("problem");

  const basePath = `/contests/${slug}/problems/${contestProblemId}`;

  // A stable getter (never changes identity) so useProctoring's violation
  // listeners don't need to re-register on every keystroke just because
  // `code` changed — they read the latest value through this ref instead.
  const codeRef = useRef({ code: "", language: "javascript" });
  useEffect(() => {
    codeRef.current = { code, language };
  }, [code, language]);
  const getCurrentCode = useCallback(() => codeRef.current, []);

  const proctoring = useProctoring({
    basePath,
    enabled: loadState === "ready",
    getCurrentCode,
  });

  useEffect(() => {
    if (status !== "ready" || !slug || !contestProblemId) return;
    let cancelled = false;

    api
      .get<{ problem: ProblemDetail; points: number }>(basePath)
      .then((res) => {
        if (cancelled) return;
        setProblem(res.problem);
        setPoints(res.points);
        setLanguage(Object.keys(res.problem.starter_code ?? {})[0] ?? "javascript");
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setLoadState("not_found");
        else if (err instanceof ApiError && err.status === 403) {
          // The backend already distinguishes "never registered" from
          // "locked out for proctoring violations" with two different real
          // messages (ContestSubmissionController::assertRegistered) — show
          // whichever one actually happened instead of a hardcoded guess.
          setForbiddenMessage(err.message || null);
          setLoadState("forbidden");
        } else setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, slug, contestProblemId]);

  useEffect(() => {
    if (!problem) return;
    const saved = window.localStorage.getItem(draftKey(slug, contestProblemId, language));
    setCode(saved ?? problem.starter_code[language] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, language]);

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

  const executeCode = async (action: "run" | "submit") => {
    if (!problem || runState === "running") return;

    setLastAction(action);
    setConsoleTab("result");
    setMobileView("code");
    setRunState("running");
    setRunError(null);
    setQueueNote(null);

    try {
      // Live-contest work is judged on the highest-priority queue; executeJudged polls for the verdict.
      const result = await executeJudged<RunResponse>(`${basePath}/${action}`, { language, code }, (p) =>
        setQueueNote(p.state === "queued" && (p.position ?? 0) > 1 ? `In queue — about #${p.position} in line` : null)
      );
      setRunResult(result);
      setRunState("done");
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Couldn't reach the execution engine. Please try again.");
      setRunState("error");
    } finally {
      setQueueNote(null);
    }
  };

  const handleRun = () => executeCode("run");
  const handleSubmit = () => executeCode("submit");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem, language, code, runState]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  return (
    <DashboardShell
      role="user"
      title="Contest Arena"
      fullBleed
      defaultSidebarCollapsed
      hideChrome={proctoring.phase === "active" || proctoring.phase === "fullscreen_lost"}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {loadState === "loading" && <SolveScreenSkeleton />}

        {loadState === "not_found" && (
          <CenteredNotice
            heading="Problem not found"
            body="This contest problem doesn't exist."
            onBack={() => router.push(`/dashboard/contests/view?slug=${slug}`)}
          />
        )}

        {loadState === "forbidden" && (
          <CenteredNotice
            heading={forbiddenMessage?.toLowerCase().includes("locked out") ? "You've been locked out" : "Not available yet"}
            body={forbiddenMessage ?? "You need to register for this contest before you can open its problems."}
            onBack={() => router.push(`/dashboard/contests/view?slug=${slug}`)}
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
            onConsent={proctoring.grantConsentAndStart}
          />
        )}

        {loadState === "ready" && problem && proctoring.phase === "locked" && (
          <ProctoringLockedScreen session={proctoring.session} onBack={() => router.push(`/dashboard/contests/view?slug=${slug}`)} />
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
            />

            <ProblemHeaderBar
              problem={problem}
              onBack={() => router.push(`/dashboard/contests/view?slug=${slug}`)}
              onRun={handleRun}
              onSubmit={handleSubmit}
              running={runState === "running"}
              backLabel="Back to Contest"
            />

            <div className="hidden lg:flex flex-1 min-h-0">
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
                        onLanguageChange={setLanguage}
                        code={code}
                        onCodeChange={handleCodeChange}
                        onReset={handleReset}
                        fontSize={fontSize}
                        onFontSizeChange={setFontSize}
                        savedAt={savedAt}
                      />
                    </Panel>
                    <ResizeHandle direction="vertical" />
                    <Panel defaultSize="32" minSize="18">
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
                        statusNote={queueNote}
                      />
                    </Panel>
                  </Group>
                </Panel>
              </Group>
            </div>

            <div className="flex lg:hidden flex-col flex-1 min-h-0">
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
                        onLanguageChange={setLanguage}
                        code={code}
                        onCodeChange={handleCodeChange}
                        onReset={handleReset}
                        fontSize={fontSize}
                        onFontSizeChange={setFontSize}
                        savedAt={savedAt}
                      />
                    </div>
                    <div className="h-52 border-t border-border-subtle shrink-0">
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
                        statusNote={queueNote}
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

function CenteredNotice({ heading, body, onBack, retry }: { heading: string; body: string; onBack?: () => void; retry?: boolean }) {
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
              Back to Contest
            </Button>
          )
        )}
      </div>
    </div>
  );
}
