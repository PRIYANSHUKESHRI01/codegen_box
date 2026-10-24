"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Flag, Loader2, Lock } from "lucide-react";
import { CoreStudentShell } from "@/components/core/CoreStudentShell";
import { StudyProctorGate, type StudySittingContext } from "@/components/proctoring/StudyProctorGate";
import { QuestionView } from "@/components/core/QuestionView";
import { MathMarkdown } from "@/components/core/MathMarkdown";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DIFFICULTY_BADGE } from "@/lib/core";
import { useQueryParams } from "@/lib/useQueryParams";
import { useDomainPrepCopy } from "@/lib/departments";
import type { CoreHomeAvailable, CorePracticeQuestion, CorePracticeResult } from "@/types/core";

type Mode = "new" | "weak" | "review";
const MODE_LABEL: Record<Mode, string> = { new: "New questions", weak: "My weak topics", review: "Review mistakes" };
const REASONS: [string, string][] = [["wrong_answer", "The answer is wrong"], ["unclear", "The question is unclear"], ["typo", "There's a typo"], ["out_of_syllabus", "Out of syllabus"], ["other", "Something else"]];

export default function CorePracticePage() {
  // Practice is taken in a proctored sitting (camera, fullscreen, strikes); while it is live the dashboard chrome is hidden.
  const [proctored, setProctored] = useState(false);

  return (
    <CoreStudentShell title="Core Practice" subtitle="One question at a time, with the worked solution after each." hideChrome={proctored}>
      {(home) => (
        <StudyProctorGate kind="core_practice" backHref="/dashboard/core" onActiveChange={setProctored}>
          {(sitting) => <PracticeBody home={home} sitting={sitting} />}
        </StudyProctorGate>
      )}
    </CoreStudentShell>
  );
}

function PracticeBody({ home, sitting }: { home: CoreHomeAvailable; sitting: StudySittingContext }) {
  const copy = useDomainPrepCopy();
  const router = useRouter();
  const { params, ready } = useQueryParams();
  const [mode, setMode] = useState<Mode>("new");
  const [subjectId, setSubjectId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");
  const [difficulty, setDifficulty] = useState("");
  const [question, setQuestion] = useState<CorePracticeQuestion | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [numeric, setNumeric] = useState("");
  const [result, setResult] = useState<CorePracticeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<{ used: number; max: number | null }>({ used: home.plan.practice_used_today, max: home.plan.practice_limit });
  const [paywall, setPaywall] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const initialised = useRef(false);
  const current = useRef<number | null>(null);

  const fetchNext = useCallback(
    async (over: { mode?: Mode; subject?: string; topic?: string; difficulty?: string } = {}) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setSelected([]);
      setNumeric("");
      setEmpty(false);
      setReported(false);
      setReporting(false);
      const body = {
        mode: over.mode ?? mode,
        subject_id: Number(over.subject ?? subjectId) || undefined,
        topic_id: Number(over.topic ?? topicId) || undefined,
        difficulty: (over.difficulty ?? difficulty) || undefined,
        exclude: current.current ?? undefined,
        sitting_id: sitting.sittingId ?? undefined,
      };
      try {
        const res = await api.post<{ question: CorePracticeQuestion | null; practice_used_today: number; practice_limit: number | null }>("/core/practice/next", body);
        setQuestion(res.question);
        current.current = res.question?.id ?? null;
        setEmpty(res.question === null);
        setLimit({ used: res.practice_used_today, max: res.practice_limit });
        startedAt.current = Date.now();
      } catch (err) {
        // The sitting ended or was closed on the server: go back through the consent screen rather than showing an error.
        if (sitting.sittingRefused(err)) return sitting.restart();
        setError(err instanceof ApiError ? err.message : "Couldn't load a question.");
      } finally {
        setLoading(false);
      }
    },
    [mode, subjectId, topicId, difficulty, sitting]
  );

  // Read the starting point from the address (?mode=&subject=&topic=) exactly once.
  useEffect(() => {
    if (!ready || initialised.current) return;
    initialised.current = true;
    const m = (params.get("mode") as Mode) || "new";
    const subject = params.get("subject") ?? "";
    const topic = params.get("topic") ?? "";
    setMode(["new", "weak", "review"].includes(m) ? m : "new");
    setSubjectId(subject);
    setTopicId(topic);
    void fetchNext({ mode: ["new", "weak", "review"].includes(m) ? m : "new", subject, topic });
  }, [ready, params, fetchNext]);

  const check = async () => {
    if (!question) return;
    setChecking(true);
    setError(null);
    try {
      const res = await api.post<CorePracticeResult>(`/core/practice/${question.id}/answer`, {
        ...(question.type === "numeric" ? { numeric_value: Number(numeric) } : { selected }),
        time_taken: Math.round((Date.now() - startedAt.current) / 1000),
        sitting_id: sitting.sittingId ?? undefined,
      });
      setResult(res);
      setLimit({ used: res.practice_used_today, max: res.practice_limit });
    } catch (err) {
      if (sitting.sittingRefused(err)) return sitting.restart();
      if (err instanceof ApiError && err.status === 402) setPaywall(err.message);
      else setError(err instanceof ApiError ? err.errors?.answer?.[0] ?? err.message : "Couldn't check that answer.");
    } finally {
      setChecking(false);
    }
  };

  const report = async (reason: string) => {
    if (!question) return;
    try {
      await api.post(`/core/questions/${question.id}/report`, { reason });
      setReported(true);
      setReporting(false);
    } catch {
      setError("Couldn't send your report. Please try again.");
    }
  };

  const answered = question?.type === "numeric" ? numeric.trim() !== "" && Number.isFinite(Number(numeric)) : selected.length > 0;
  const subject = home.subjects.find((s) => String(s.id) === subjectId);

  // Enter checks, then moves on — what a practice tool should feel like at speed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || (e.target instanceof HTMLTextAreaElement)) return;
      if (result) void fetchNext();
      else if (answered && !checking) void check();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (paywall) {
    return (
      <div className="mx-auto max-w-lg rounded-panel border border-border-subtle bg-surface p-8 text-center">
        <Lock className="mx-auto h-7 w-7 text-accent-primary" aria-hidden />
        <h2 className="mt-3 text-base font-extrabold text-primary">That&apos;s today&apos;s practice</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{paywall}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/dashboard/billing" className="rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white">See plans</Link>
          <Link href="/dashboard/core" className="rounded-control border border-border-strong px-4 py-2 text-xs font-bold text-primary">Back to {copy.label}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {limit.max !== null && <span className="rounded-full border border-border-subtle bg-elevated px-3 py-1 text-2xs font-semibold text-text-secondary">{Math.max(0, limit.max - limit.used)} of {limit.max} left today</span>}
        {/* The dashboard is hidden while a sitting is proctored, so finishing needs a way out that is not a strike. */}
        {sitting.sittingId !== null && (
          <button
            type="button"
            onClick={() => {
              sitting.end();
              router.push("/dashboard/core");
            }}
            className="ml-auto rounded-control border border-border-strong px-3 py-1 text-2xs font-bold text-text-secondary hover:text-primary"
          >
            End practice
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-panel border border-border-subtle bg-surface px-3 py-2.5">
        <div className="flex gap-1" role="group" aria-label="What to practise">
          {(["new", "weak", "review"] as const).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => { setMode(m); void fetchNext({ mode: m }); }} className={cn("rounded-full border px-3 py-1 text-2xs font-bold transition-colors", mode === m ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle text-text-muted hover:text-primary")}>{MODE_LABEL[m]}</button>
          ))}
        </div>
        <select aria-label="Subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(""); void fetchNext({ subject: e.target.value, topic: "" }); }} className="ml-auto rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-2xs text-primary">
          <option value="">All subjects</option>
          {home.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select aria-label="Difficulty" value={difficulty} onChange={(e) => { setDifficulty(e.target.value); void fetchNext({ difficulty: e.target.value }); }} className="rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-2xs text-primary">
          <option value="">Any level</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
        </select>
      </div>
      {topicId && subject && <p className="text-2xs text-text-muted">Focused on one topic of <strong className="text-primary">{subject.name}</strong>. <button onClick={() => { setTopicId(""); void fetchNext({ topic: "" }); }} className="font-bold text-accent-primary hover:underline">Practise the whole subject</button></p>}

      {error && <p role="alert" className="rounded-control bg-status-danger/10 px-3 py-2 text-xs font-semibold text-status-danger">{error}</p>}

      {loading && !question ? (
        <div className="h-72 animate-pulse rounded-panel border border-border-subtle bg-surface" aria-busy="true" />
      ) : empty || !question ? (
        <div className="rounded-panel border border-border-subtle bg-surface px-6 py-14 text-center">
          <Check className="mx-auto h-7 w-7 text-status-success" aria-hidden />
          <h2 className="mt-3 text-base font-extrabold text-primary">{mode === "review" ? "No mistakes to review" : "Nothing left here"}</h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-text-secondary">{mode === "review" ? "Every question you last got wrong, you've since got right. Nicely done." : "Try another subject or level — or switch to a different mode."}</p>
          <button onClick={() => { setMode("new"); setSubjectId(""); setDifficulty(""); void fetchNext({ mode: "new", subject: "", topic: "", difficulty: "" }); }} className="mt-4 rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white">Practise something new</button>
        </div>
      ) : (
        <article className={cn("rounded-panel border border-border-subtle bg-surface p-5 sm:p-6", loading && "opacity-60")}>
          <header className="mb-4 flex flex-wrap items-center gap-2 text-3xs font-bold uppercase tracking-wide">
            <span className={cn("rounded px-1.5 py-0.5", DIFFICULTY_BADGE[question.difficulty])}>{question.difficulty}</span>
            {question.subject && <span className="rounded bg-elevated px-1.5 py-0.5 text-text-muted">{question.subject}</span>}
            {question.topic && <span className="rounded bg-elevated px-1.5 py-0.5 text-text-muted">{question.topic}</span>}
          </header>

          <QuestionView
            question={question}
            selected={result?.selected ?? selected}
            numeric={result?.numeric_value != null ? String(result.numeric_value) : numeric}
            onSelect={setSelected}
            onNumeric={setNumeric}
            disabled={!!result}
            reveal={result ? { correct: result.key.correct ?? null, numeric: question.type === "numeric" ? { min: result.key.min ?? null, max: result.key.max ?? null } : undefined } : undefined}
          />

          {result && (
            <div className={cn("mt-5 rounded-xl border p-4", result.correct ? "border-status-success/40 bg-status-success/5" : "border-status-danger/40 bg-status-danger/5")} role="status">
              <p className={cn("text-sm font-extrabold", result.correct ? "text-status-success" : "text-status-danger")}>{result.correct ? "Correct!" : "Not quite."}</p>
              {result.explanation ? <div className="mt-2"><MathMarkdown>{result.explanation}</MathMarkdown></div> : <p className="mt-1 text-xs text-text-muted">No written solution for this one.</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-2xs">
                {reported ? <span className="font-semibold text-status-success">Thanks — we&apos;ll check it.</span> : reporting ? (
                  <span className="flex flex-wrap gap-1.5" role="group" aria-label="What is wrong?">
                    {REASONS.map(([id, label]) => <button key={id} onClick={() => void report(id)} className="rounded-full border border-border-strong bg-surface px-2.5 py-1 font-semibold text-text-secondary hover:border-accent-primary hover:text-accent-primary">{label}</button>)}
                  </span>
                ) : (
                  <button onClick={() => setReporting(true)} className="inline-flex items-center gap-1 font-semibold text-text-muted hover:text-primary"><Flag className="h-3 w-3" /> Report a problem with this question</button>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <span className="text-3xs text-text-muted">{result ? "Press Enter for the next one" : "Press Enter to check"}</span>
            {result ? (
              <button onClick={() => void fetchNext()} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-5 py-2.5 text-xs font-bold text-white">Next question <ArrowRight className="h-3.5 w-3.5" /></button>
            ) : (
              <button onClick={() => void check()} disabled={!answered || checking} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40">
                {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Check answer
              </button>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
