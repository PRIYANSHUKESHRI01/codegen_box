"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Bookmark, Calculator, CheckCircle2, Clock3, Eraser, Loader2, ShieldCheck } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { QuestionView } from "@/components/core/QuestionView";
import { ScientificCalculator } from "@/components/core/ScientificCalculator";
import { ProctoringConsentGate } from "@/components/proctoring/ProctoringConsentGate";
import { ProctoringOverlay } from "@/components/proctoring/ProctoringOverlay";
import { ProctoringLockedScreen } from "@/components/proctoring/ProctoringLockedScreen";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useQueryParams } from "@/lib/useQueryParams";
import { useInterviewProctoring } from "@/lib/proctoring/useInterviewProctoring";
import { formatClock, useServerCountdown } from "@/lib/useServerCountdown";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDomainPrepCopy } from "@/lib/departments";
import type { CoreSession, CoreSessionQuestion, CoreTestSummary } from "@/types/core";

type Stage = "loading" | "intro" | "proctoring" | "taking" | "submitting" | "error";
type SaveState = "saved" | "saving" | "offline";

/** What the student has entered for one question, kept locally and mirrored to the server by autosave. */
interface Local {
  selected: string[];
  numeric: string;
  marked: boolean;
  visited: boolean;
  seconds: number;
}

const answeredOf = (q: CoreSessionQuestion, l: Local) => (q.type === "numeric" ? l.numeric.trim() !== "" && Number.isFinite(Number(l.numeric)) : l.selected.length > 0);

export default function CoreSessionPage() {
  const copy = useDomainPrepCopy();
  const { user, status } = useAuthGuard(["user"]);
  const router = useRouter();
  const { params, ready } = useQueryParams();

  const [stage, setStage] = useState<Stage>("loading");
  const [test, setTest] = useState<CoreTestSummary | null>(null);
  const [session, setSession] = useState<CoreSession | null>(null);
  const [proctoringRequired, setProctoringRequired] = useState(true);
  const [local, setLocal] = useState<Record<number, Local>>({});
  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [calculator, setCalculator] = useState(false);
  const [starting, setStarting] = useState(false);
  const [proctoredId, setProctoredId] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const enteredRef = useRef(false);
  const preConsentRef = useRef<CoreSession | null>(null);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const dirty = useRef<Set<number>>(new Set());
  const localRef = useRef(local);
  localRef.current = local;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const proctoring = useInterviewProctoring({
    basePath: `/core/sessions/${proctoredId ?? "none"}`,
    enabled: stage === "proctoring" && proctoredId !== null,
    activityLabel: "test",
  });

  // ── entering the test ──────────────────────────────────────────────────────────────────
  const enter = useCallback((s: CoreSession) => {
    setSession(s);
    setLocal(
      Object.fromEntries(
        s.questions.map((q) => [q.id, { selected: q.selected, numeric: q.numeric_value === null ? "" : String(q.numeric_value), marked: q.marked_for_review, visited: q.selected.length > 0 || q.numeric_value !== null, seconds: 0 }])
      )
    );
    setIndex(0);
    setStage("taking");
  }, []);

  useEffect(() => {
    if (status !== "ready" || !ready) return;
    const id = params.get("id");
    const slug = params.get("test");

    (async () => {
      try {
        if (id) {
          const res = await api.get<{ session: CoreSession | { id: string; status: "completed" }; proctoring_required?: boolean }>(`/core/sessions/${id}`);
          if (res.session.status === "completed") return router.replace(`/dashboard/core/result?id=${res.session.id}`);
          const s = res.session as CoreSession;
          setProctoringRequired(res.proctoring_required ?? true);
          if (res.proctoring_required ?? true) {
            preConsentRef.current = s;
            setProctoredId(s.id);
            setSession(s);
            setStage("proctoring");
          } else enter(s);
        } else if (slug) {
          const res = await api.get<{ tests: CoreTestSummary[]; proctoring_required: boolean }>("/core/tests");
          const found = res.tests.find((t) => t.slug === slug) ?? null;
          setProctoringRequired(res.proctoring_required);
          setTest(found);
          setStage(found ? "intro" : "error");
          if (!found) setError("This test isn't available to you.");
        } else {
          setStage("error");
          setError("No test was chosen.");
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Couldn't open this test.");
        setStage("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ready]);

  const begin = async () => {
    if (!test) return;
    setStarting(true);
    setError(null);
    try {
      const res = await api.post<{ session: CoreSession; proctoring_required: boolean }>(`/core/tests/${test.slug}/start`);
      setProctoringRequired(res.proctoring_required);
      if (res.proctoring_required) {
        preConsentRef.current = res.session;
        setProctoredId(res.session.id);
        setSession(res.session);
        setStage("proctoring");
      } else enter(res.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't start this test.");
    } finally {
      setStarting(false);
    }
  };

  // Consent cleared → reveal the questions. Re-read the attempt first: consenting restarts the clock on the server
  // (the seconds spent granting the camera are not taken out of the test), so the click-time deadline is stale.
  useEffect(() => {
    if (stage !== "proctoring" || proctoring.phase !== "active" || enteredRef.current || !proctoredId) return;
    enteredRef.current = true;
    (async () => {
      let s = preConsentRef.current;
      try {
        const res = await api.get<{ session: CoreSession }>(`/core/sessions/${proctoredId}`);
        s = res.session;
      } catch {
        // Fall back to the click-time payload — never strand a live attempt.
      }
      if (s) enter(s);
    })();
  }, [stage, proctoring.phase, proctoredId, enter]);

  // ── autosave ───────────────────────────────────────────────────────────────────────────
  const flush = useCallback(async (questionId: number) => {
    const s = sessionRef.current;
    const l = localRef.current[questionId];
    const q = s?.questions.find((x) => x.id === questionId);
    if (!s || !l || !q) return;
    dirty.current.delete(questionId);
    setSaveState("saving");
    try {
      await api.put(`/core/sessions/${s.id}/answers/${questionId}`, {
        selected: q.type === "numeric" ? [] : l.selected,
        numeric_value: q.type === "numeric" && l.numeric.trim() !== "" && Number.isFinite(Number(l.numeric)) ? Number(l.numeric) : null,
        marked_for_review: l.marked,
        time_spent: l.seconds,
      });
      setSaveState(dirty.current.size === 0 ? "saved" : "saving");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // The clock ran out (or it was already submitted): what was saved has been graded.
        submittingRef.current = true;
        proctoring.endSession();
        router.replace(`/dashboard/core/result?id=${s.id}`);
        return;
      }
      if (err instanceof ApiError && err.status === 423) return; // locked by proctoring — the overlay takes over
      dirty.current.add(questionId);
      setSaveState("offline");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const change = (q: CoreSessionQuestion, patch: Partial<Local>, immediate = false) => {
    setLocal((prev) => ({ ...prev, [q.id]: { ...prev[q.id], ...patch, visited: true } }));
    dirty.current.add(q.id);
    setSaveState("saving");
    clearTimeout(timers.current[q.id]);
    timers.current[q.id] = setTimeout(() => void flush(q.id), immediate ? 0 : 500);
  };

  // Retry anything that failed while offline.
  useEffect(() => {
    if (stage !== "taking") return;
    const timer = setInterval(() => {
      if (dirty.current.size > 0 && !submittingRef.current) Array.from(dirty.current).forEach((id) => void flush(id));
    }, 8000);
    return () => clearInterval(timer);
  }, [stage, flush]);

  // Time spent on the question on screen.
  const current = session?.questions[index];
  useEffect(() => {
    if (stage !== "taking" || !current) return;
    const timer = setInterval(() => setLocal((prev) => (prev[current.id] ? { ...prev, [current.id]: { ...prev[current.id], seconds: prev[current.id].seconds + 1 } } : prev)), 1000);
    return () => clearInterval(timer);
  }, [stage, current]);

  // Mark a question visited the moment it is shown (the palette's "not visited" state).
  useEffect(() => {
    if (stage === "taking" && current && !localRef.current[current.id]?.visited) setLocal((prev) => ({ ...prev, [current.id]: { ...prev[current.id], visited: true } }));
  }, [stage, current]);

  // ── submit ─────────────────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || submittingRef.current) return;
    submittingRef.current = true;
    setStage("submitting");
    try {
      // Everything on screen reaches the server before it is graded.
      const pending = Array.from(dirty.current);
      if (current && pending.indexOf(current.id) === -1) pending.push(current.id);
      await Promise.all(pending.map((id) => flush(id)));
      await api.post(`/core/sessions/${s.id}/submit`);
      proctoring.endSession();
      router.push(`/dashboard/core/result?id=${s.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't submit your test. Please try again.");
      setStage("taking");
      submittingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, router, current]);

  const remaining = useServerCountdown(stage === "taking" || stage === "submitting" ? (session?.deadline_at ?? null) : null, session?.server_time ?? null, () => {
    if (stage === "taking") void submit();
  });

  // The server ended the attempt (and graded what was saved): nothing here may save or tick any more.
  useEffect(() => {
    if (proctoring.phase === "locked") {
      submittingRef.current = true;
      setConfirming(false);
    }
  }, [proctoring.phase]);

  // Keyboard: ← → move between questions (not while typing in a field).
  useEffect(() => {
    if (stage !== "taking" || !session) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") setIndex((i) => Math.min(session.questions.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, session]);

  const counts = useMemo(() => {
    if (!session) return { answered: 0, marked: 0, unanswered: 0 };
    let answered = 0;
    let marked = 0;
    for (const q of session.questions) {
      const l = local[q.id];
      if (l && answeredOf(q, l)) answered++;
      if (l?.marked) marked++;
    }
    return { answered, marked, unanswered: session.questions.length - answered };
  }, [session, local]);

  // ── render ─────────────────────────────────────────────────────────────────────────────
  if (status !== "ready" || stage === "loading") return <SessionLoader />;

  const isLocked = proctoring.phase === "locked";
  const examActive = proctoring.phase === "active" || proctoring.phase === "fullscreen_lost";
  const showGate = stage === "proctoring" && (proctoring.phase === "consent" || proctoring.phase === "starting" || proctoring.phase === "blocked");
  const fullBleed = stage === "taking" || stage === "proctoring" || isLocked || (stage === "submitting" && examActive);

  return (
    <DashboardShell role="user" title={copy.testsLabel.replace(/s$/, "")} subtitle={stage === "intro" ? test?.title : undefined} fullBleed={fullBleed} hideChrome={examActive && !isLocked}>
      <div className={cn(fullBleed ? "flex min-h-0 flex-1 flex-col p-3 sm:p-5" : "mx-auto max-w-2xl space-y-4")}>
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/25 bg-status-danger/10 p-3 text-xs text-status-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{error}</span>
          </div>
        )}

        {stage === "error" && !test && (
          <div className="rounded-panel border border-border-subtle bg-surface p-8 text-center text-sm text-text-secondary">
            <Link href="/dashboard/core/tests" className="font-bold text-accent-primary hover:underline">Back to your tests</Link>
          </div>
        )}

        {stage === "intro" && test && (
          <div className="space-y-4 rounded-panel border border-border-subtle bg-surface p-6 shadow-subtle">
            <h2 className="text-lg font-extrabold text-primary">{test.title}</h2>
            {test.description && <p className="text-sm text-text-secondary">{test.description}</p>}
            <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[["Questions", test.question_count], ["Minutes", test.duration_minutes], ["Marks", test.total_marks], ["To pass", `${test.pass_percentage}%`]].map(([k, v]) => (
                <div key={k as string} className="rounded-control bg-elevated p-2.5 text-center"><dd className="tabular text-lg font-black text-primary">{v}</dd><dt className="text-3xs text-text-muted">{k}</dt></div>
              ))}
            </dl>
            <ul className="space-y-1.5 text-xs text-text-secondary">
              <li>• Questions can be single-answer, multiple-answer (select all that apply — no partial credit) or numerical.</li>
              <li>• Wrong single-answer questions can carry negative marks; unanswered questions never do.</li>
              <li>• Your answers save as you go. You can mark questions for review and come back to them.</li>
              <li>• A scientific calculator is built in — you won&apos;t need anything else.</li>
            </ul>
            {proctoringRequired && (
              <div className="flex items-start gap-2.5 rounded-control border border-accent-primary/20 bg-accent-primary/5 p-3 text-xs text-text-secondary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden />
                <span><strong className="text-primary">This test is proctored.</strong> Camera and microphone on, fullscreen. Switching tabs or leaving fullscreen is a strike — 3 strikes ends the test.</span>
              </div>
            )}
            <button onClick={begin} disabled={starting || !test.can_attempt} className="flex w-full items-center justify-center gap-2 rounded-control bg-accent-primary py-3 text-sm font-bold text-white disabled:opacity-50">
              {starting && <Loader2 className="h-4 w-4 animate-spin" />} {test.in_progress_session ? "Resume test" : "Start test"}
            </button>
          </div>
        )}

        {showGate && (
          <ProctoringConsentGate
            activity="core_test"
            phase={proctoring.phase}
            consentError={proctoring.consentError}
            devicePreviewReady={proctoring.devicePreviewReady}
            previewVideoRef={proctoring.previewVideoRef}
            onEnableDevices={proctoring.enableDevicePreview}
            onConsent={proctoring.grantConsentAndStart}
          />
        )}

        {isLocked && (
          <ProctoringLockedScreen
            activity="core_test"
            session={proctoring.session}
            onBack={() => router.push("/dashboard/core/tests")}
            secondary={proctoredId ? { label: "View result", onClick: () => router.push(`/dashboard/core/result?id=${proctoredId}`) } : undefined}
          />
        )}

        {!isLocked && (stage === "taking" || stage === "submitting") && session && current && (
          <>
            {examActive && (
              <ProctoringOverlay phase={proctoring.phase} session={proctoring.session} lastViolation={proctoring.lastViolation} studentName={user?.name ?? "Student"} rollNumber={user?.roll_number ?? null} onResumeFullscreen={proctoring.resumeFullscreen} />
            )}

            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {/* The proctoring badge ("Recording · 0/3 strikes") is pinned to the top-right corner of the window: keep the toolbar clear of it so the calculator and the clock stay clickable. */}
              <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border-subtle bg-surface px-4 py-2.5 shadow-subtle", examActive && "pr-56")}>
                <span className="truncate text-xs font-bold text-primary">{session.test.title}</span>
                <div className="flex items-center gap-3">
                  <span className={cn("text-3xs font-semibold", saveState === "offline" ? "text-status-danger" : "text-text-muted")} aria-live="polite">
                    {saveState === "saving" ? "Saving…" : saveState === "offline" ? "Offline — will retry" : "Saved"}
                  </span>
                  <span className="text-2xs text-text-muted">{counts.answered}/{session.questions.length} answered</span>
                  <button onClick={() => setCalculator((v) => !v)} aria-pressed={calculator} className={cn("inline-flex items-center gap-1 rounded-control border px-2.5 py-1 text-2xs font-bold", calculator ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle text-text-secondary hover:text-primary")}>
                    <Calculator className="h-3.5 w-3.5" aria-hidden /> Calculator
                  </button>
                  <span role="timer" aria-label={`Time left ${formatClock(remaining)}`} className={cn("flex items-center gap-1.5 rounded-control px-2.5 py-1 font-mono text-sm font-bold", remaining <= 300 ? "bg-status-danger/10 text-status-danger" : "bg-elevated text-primary")}>
                    <Clock3 className="h-3.5 w-3.5" aria-hidden /> {formatClock(remaining)}
                  </span>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <section aria-label={`Question ${index + 1}`} className="flex min-h-0 flex-col overflow-y-auto rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-3xs font-bold uppercase tracking-wide">
                    <span className="text-accent-primary">Question {index + 1} of {session.questions.length}</span>
                    {current.section && <span className="rounded bg-elevated px-1.5 py-0.5 text-text-muted">{current.section}</span>}
                    <span className="rounded bg-elevated px-1.5 py-0.5 text-text-muted">+{current.marks}{current.negative_marks > 0 ? ` / −${current.negative_marks}` : ""}</span>
                  </div>

                  <div className="flex-1">
                    <QuestionView
                      key={current.id}
                      question={current}
                      selected={local[current.id]?.selected ?? []}
                      numeric={local[current.id]?.numeric ?? ""}
                      onSelect={(ids) => change(current, { selected: ids }, true)}
                      onNumeric={(v) => change(current, { numeric: v })}
                      disabled={stage === "submitting"}
                      keypad
                    />
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { change(current, { marked: !local[current.id]?.marked }, true); }} aria-pressed={!!local[current.id]?.marked} className={cn("inline-flex items-center gap-1 rounded-control border px-3 py-1.5 text-2xs font-bold", local[current.id]?.marked ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-300" : "border-border-subtle text-text-secondary hover:text-primary")}>
                        <Bookmark className="h-3.5 w-3.5" aria-hidden /> {local[current.id]?.marked ? "Marked for review" : "Mark for review"}
                      </button>
                      <button onClick={() => change(current, { selected: [], numeric: "" }, true)} className="inline-flex items-center gap-1 rounded-control px-2.5 py-1.5 text-2xs font-bold text-text-muted hover:text-primary"><Eraser className="h-3.5 w-3.5" aria-hidden /> Clear answer</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} className="inline-flex items-center gap-1 rounded-control border border-border-subtle px-3 py-1.5 text-2xs font-bold text-text-secondary hover:text-primary disabled:opacity-40"><ArrowLeft className="h-3.5 w-3.5" /> Previous</button>
                      {index < session.questions.length - 1 ? (
                        <button onClick={() => setIndex(index + 1)} className="inline-flex items-center gap-1 rounded-control bg-accent-primary px-4 py-1.5 text-2xs font-bold text-white">Save &amp; next <ArrowRight className="h-3.5 w-3.5" /></button>
                      ) : (
                        <button onClick={() => setConfirming(true)} disabled={stage === "submitting"} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-1.5 text-2xs font-bold text-white disabled:opacity-60">
                          {stage === "submitting" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit test
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto" aria-label="Question palette">
                  <div className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
                    <p className="mb-2.5 text-3xs font-bold uppercase tracking-wide text-text-muted">Questions</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {session.questions.map((q, i) => {
                        const l = local[q.id];
                        const isAnswered = !!l && answeredOf(q, l);
                        const isMarked = !!l?.marked;
                        return (
                          <button
                            key={q.id}
                            onClick={() => setIndex(i)}
                            aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ""}${isMarked ? ", marked for review" : ""}`}
                            aria-current={i === index}
                            className={cn(
                              "relative flex h-8 items-center justify-center rounded-control border text-2xs font-bold transition-colors",
                              i === index ? "border-transparent bg-accent-primary text-white" : isAnswered ? "border-status-success/30 bg-status-success/10 text-status-success" : l?.visited ? "border-status-warning/30 bg-status-warning/10 text-status-warning" : "border-border-subtle bg-elevated text-text-muted"
                            )}
                          >
                            {i + 1}
                            {isMarked && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-surface bg-violet-500" aria-hidden />}
                          </button>
                        );
                      })}
                    </div>
                    <ul className="mt-3 space-y-1 text-3xs text-text-muted">
                      <li><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-status-success/60" />Answered · {counts.answered}</li>
                      <li><span className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-status-warning/60" />Seen, not answered · {counts.unanswered - session.questions.filter((q) => !local[q.id]?.visited).length}</li>
                      <li><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-violet-500" />Marked for review · {counts.marked}</li>
                    </ul>
                    <button onClick={() => setConfirming(true)} disabled={stage === "submitting"} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-control border border-border-subtle bg-elevated py-2 text-2xs font-bold text-text-secondary hover:text-primary disabled:opacity-60">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Submit test
                    </button>
                  </div>
                  {calculator && <ScientificCalculator onClose={() => setCalculator(false)} />}
                </aside>
              </div>
            </div>
          </>
        )}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirming(false)} aria-hidden />
          <div role="dialog" aria-modal="true" aria-label="Submit this test?" className="relative z-10 w-full max-w-sm space-y-4 rounded-panel border border-border-strong bg-surface p-5 shadow-card">
            <h3 className="font-bold text-primary">Submit this test?</h3>
            <p className="text-xs text-text-secondary">
              {counts.unanswered > 0 ? `${counts.unanswered} question${counts.unanswered === 1 ? " is" : "s are"} unanswered — they score nothing, with no penalty. ` : "Every question is answered. "}
              {counts.marked > 0 ? `${counts.marked} marked for review. ` : ""}You can&apos;t change anything after you submit.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(false)} className="flex-1 rounded-control border border-border-subtle py-2 text-xs font-bold text-text-secondary hover:text-primary">Keep going</button>
              <button onClick={() => { setConfirming(false); void submit(); }} className="flex-1 rounded-control bg-accent-primary py-2 text-xs font-bold text-white">Submit</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
