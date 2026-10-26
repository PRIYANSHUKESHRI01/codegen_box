"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { GripVertical, GripHorizontal, Code2, FileText } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ProblemHeaderBar } from "@/components/practice/ProblemHeaderBar";
import { ProblemDescriptionPanel } from "@/components/practice/ProblemDescriptionPanel";
import { CodeEditorPanel } from "@/components/practice/CodeEditorPanel";
import { ConsolePanel, ConsoleTab } from "@/components/practice/ConsolePanel";
import { EditorBootPlaceholder } from "@/components/practice/EditorBootPlaceholder";
import { Button } from "@/components/ui/Button";
import { ProblemDetail } from "@/types/problem";
import { ApiError } from "@/lib/api";
import { invalidateProblem, loadProblem } from "@/lib/problemPrefetch";
import { useJudgedRun } from "@/lib/useJudgedRun";
import { useResilientNavigation } from "@/lib/useResilientNavigation";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { RETURN_TO_PARAM, safeReturnTo } from "@/lib/backNav";
import { pickInitialLanguage, recallLastLanguage, rememberLastLanguage } from "@/lib/studentPreferences";
import { cn } from "@/lib/utils";

/** When a run starts and the console is squeezed small, give it room so the verdict is in view. */
const CONSOLE_MIN_WHILE_RUNNING = 40;
const CONSOLE_COMFORTABLE = 46;

/** Per-problem, per-language local draft — genuinely client-only (no
 * submission backend exists yet), so this never claims to sync anywhere. */
function draftKey(slug: string, language: string) {
  return `aptrun:draft:${slug}:${language}`;
}

export default function ProblemSolvePage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <ProblemSolvePageContent />
    </Suspense>
  );
}

function ProblemSolvePageContent() {
  const { status, user } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") ?? "";
  // Back must never leave the student staring at the old screen if the Practice Arena's data is slow to arrive.
  const nav = useResilientNavigation();

  // A problem opened from a company's PYQ page (…&from=/dashboard/company-prep/view?company=…) goes back THERE — the same company,
  // the same filters — not up to the Practice Arena. Only allow-listed in-app pages are honoured (see safeReturnTo).
  const returnTo = safeReturnTo(searchParams.get(RETURN_TO_PARAM));
  const backHref = returnTo?.href ?? "/dashboard/practice";
  const backLabel = `Back to ${returnTo?.label ?? "Practice Arena"}`;

  const [problem, setProblem] = useState<ProblemDetail | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not_found" | "error">("loading");
  const [language, setLanguage] = useState<string>("javascript");
  const [code, setCode] = useState("");
  const [fontSize, setFontSize] = useState(14);
  const [revealedHints, setRevealedHints] = useState(0);
  const [activeExample, setActiveExample] = useState(0);
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("testcase");
  const consolePanel = usePanelRef();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<"problem" | "code">("problem");

  useEffect(() => {
    if (status !== "ready") return;
    // No problem in the address (a bookmark, an old link): say so instead of showing the loading skeleton for ever.
    if (!slug) {
      setLoadState("not_found");
      return;
    }
    let cancelled = false;

    // Usually already on its way: the Solve button starts this request the moment it is hovered or touched.
    loadProblem(slug)
      .then((res) => {
        if (cancelled) return;
        setProblem(res.problem);
        // Open in the language they last used, else the one they told us they code in (onboarding),
        // else whatever this problem lists first.
        setLanguage(pickInitialLanguage(Object.keys(res.problem.starter_code ?? {}), user, recallLastLanguage(user?.id)));
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState(err instanceof ApiError && err.status === 404 ? "not_found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [status, slug]);

  // Restore a saved draft for this problem+language, else fall back to the
  // starter stub, whenever the problem loads or the language is switched.
  useEffect(() => {
    if (!problem) return;
    const saved = window.localStorage.getItem(draftKey(problem.slug, language));
    setCode(saved ?? problem.starter_code[language] ?? "");
  }, [problem, language]);

  const handleLanguageChange = (next: string) => {
    setLanguage(next);
    rememberLastLanguage(user?.id, next);
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
    if (!problem) return;
    window.localStorage.setItem(draftKey(problem.slug, language), value);
    setSavedAt(Date.now());
  };

  const handleReset = () => {
    if (!problem) return;
    const starter = problem.starter_code[language] ?? "";
    setCode(starter);
    window.localStorage.setItem(draftKey(problem.slug, language), starter);
    setSavedAt(Date.now());
  };

  /** Make sure the console is tall enough to show what is about to happen in it. */
  const ensureConsoleVisible = () => {
    const panel = consolePanel.current;
    if (!panel) return;
    if (panel.getSize().asPercentage < CONSOLE_MIN_WHILE_RUNNING) panel.resize(`${CONSOLE_COMFORTABLE}%`);
  };

  // Run / Submit: sending → queued → running → verdict, driven by the judge's real state (see useJudgedRun).
  const judge = useJudgedRun({
    endpoint: problem ? `/problems/${problem.slug}` : null,
    language,
    code,
    onStart: () => {
      setConsoleTab("result");
      setMobileView("code");
      ensureConsoleVisible();
    },
    onVerdict: (action, result) => {
      if (action === "submit" && result.all_passed && problem) {
        // The header's "Solved" appears at once instead of after the next visit.
        setProblem((current) => (current && !current.solved ? { ...current, solved: true } : current));
        invalidateProblem(problem.slug);
      }
    },
  });
  const { state: runState, lastAction, result: runResult, error: runError, progress, startedAt, resultKey, execute: executeCode } = judge;

  const handleRun = () => void executeCode("run");
  const handleSubmit = () => void executeCode("submit");

  // Ctrl/Cmd+Enter runs, Ctrl/Cmd+Shift+Enter submits — the shortcuts every major judge uses.
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
    return (
      <SessionLoader />
    );
  }

  return (
    <DashboardShell role="user" title="Practice Arena" fullBleed defaultSidebarCollapsed back={returnTo ?? undefined}>
      <div className="flex flex-col flex-1 min-h-0">
        {loadState === "loading" && <SolveScreenSkeleton />}

        {loadState === "not_found" && (
          <CenteredNotice
            heading="Problem not found"
            body={`"${slug}" doesn't match any problem in the catalog.`}
            onBack={() => nav.go(backHref)}
            backLabel={backLabel}
          />
        )}

        {loadState === "error" && (
          <CenteredNotice
            heading="Couldn't load this problem"
            body="Something went wrong talking to the server. Please try again."
            retry
          />
        )}

        {loadState === "ready" && problem && (
          <div className="workspace-in flex flex-col flex-1 min-h-0">
            <ProblemHeaderBar
              problem={problem}
              onBack={() => nav.go(backHref)}
              backLabel={backLabel}
              backPending={nav.pending}
              onRun={handleRun}
              onSubmit={handleSubmit}
              running={runState === "running"}
              activeAction={runState === "running" ? lastAction : null}
            />

            {/* Desktop / tablet-landscape: resizable split workspace */}
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
                        onLanguageChange={handleLanguageChange}
                        code={code}
                        onCodeChange={handleCodeChange}
                        onReset={handleReset}
                        fontSize={fontSize}
                        onFontSizeChange={setFontSize}
                        savedAt={savedAt}
                        onRun={handleRun}
                        onSubmit={handleSubmit}
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

            {/* Mobile / tablet-portrait: tabbed single-pane workspace */}
            <div className="flex lg:hidden flex-col flex-1 min-h-0">
              <div className="flex border-b border-border-subtle shrink-0">
                <button
                  onClick={() => setMobileView("problem")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors",
                    mobileView === "problem"
                      ? "border-accent-primary text-accent-primary"
                      : "border-transparent text-text-muted"
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Problem
                </button>
                <button
                  onClick={() => setMobileView("code")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-b-2 transition-colors",
                    mobileView === "code"
                      ? "border-accent-primary text-accent-primary"
                      : "border-transparent text-text-muted"
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
          </div>
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
          direction === "horizontal"
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-3"
            : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-3"
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
        <EditorBootPlaceholder label="Setting up your workspace…" className="flex-1" />
      </div>
    </div>
  );
}

function CenteredNotice({
  heading,
  body,
  onBack,
  backLabel = "Back to Practice Arena",
  retry,
}: {
  heading: string;
  body: string;
  onBack?: () => void;
  backLabel?: string;
  retry?: boolean;
}) {
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
