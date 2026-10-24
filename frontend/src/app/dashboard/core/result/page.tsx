"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CircleSlash, Flag, ShieldAlert, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { MathMarkdown } from "@/components/core/MathMarkdown";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useQueryParams } from "@/lib/useQueryParams";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CoreResult, CoreResultReview } from "@/types/core";

type Filter = "all" | "wrong" | "skipped" | "right";
const LETTERS = "ABCDEF";
const REASONS: [string, string][] = [["wrong_answer", "The answer is wrong"], ["unclear", "Unclear question"], ["typo", "Typo"], ["other", "Something else"]];

export default function CoreResultPage() {
  const { status } = useAuthGuard(["user"]);
  const { params, ready } = useQueryParams();
  const [result, setResult] = useState<CoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (status !== "ready" || !ready) return;
    const id = params.get("id");
    if (!id) return setError("No result was chosen.");
    api
      .get<{ result: CoreResult }>(`/core/sessions/${id}/result`)
      .then((res) => setResult(res.result))
      .catch((err) => setError(err instanceof ApiError ? (err.status === 409 ? "This test is still in progress." : err.message) : "Couldn't load the result."));
  }, [status, ready, params]);

  const shown = useMemo(() => {
    if (!result) return [];
    return result.review.filter((r) => (filter === "all" ? true : filter === "wrong" ? r.is_correct === false : filter === "skipped" ? r.is_correct === null : r.is_correct === true));
  }, [result, filter]);

  if (status !== "ready" || (!result && !error)) return <SessionLoader />;

  return (
    <DashboardShell role="user" title="Test result" subtitle={result?.test.title}>
      <div className="mx-auto max-w-4xl space-y-6">
        {error && <p role="alert" className="rounded-control bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">{error}</p>}

        {result && (
          <>
            {result.terminated_by_proctoring && (
              <p className="flex items-start gap-2 rounded-control border border-status-danger/30 bg-status-danger/5 p-3 text-xs text-status-danger"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> This attempt was ended by proctoring. The score below is what you had saved, and it can&apos;t count as a pass.</p>
            )}

            <section className="grid gap-4 rounded-panel border border-border-subtle bg-surface p-6 sm:grid-cols-[auto_1fr] sm:items-center" aria-label="Score">
              <div className={cn("mx-auto flex h-32 w-32 flex-col items-center justify-center rounded-full border-4", result.passed ? "border-status-success text-status-success" : "border-status-danger text-status-danger")}>
                <span className="tabular text-3xl font-black">{Math.round(result.score_percent)}%</span>
                <span className="text-3xs font-bold uppercase tracking-wide">{result.passed ? "Passed" : "Not passed"}</span>
              </div>
              <div>
                <p className="text-sm text-text-secondary">
                  You scored <strong className="tabular text-primary">{result.score}</strong> of <strong className="tabular text-primary">{result.max_score}</strong> marks · the pass mark was {result.test.pass_percentage}%.
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[["Correct", result.correct_count, "text-status-success"], ["Wrong", result.wrong_count, "text-status-danger"], ["Skipped", result.skipped_count, "text-text-secondary"]].map(([k, v, c]) => (
                    <div key={k as string} className="rounded-control bg-elevated py-2.5"><dd className={cn("tabular text-xl font-extrabold", c as string)}>{v}</dd><dt className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{k}</dt></div>
                  ))}
                </dl>
              </div>
            </section>

            {result.subject_breakdown.length > 0 && (
              <section aria-labelledby="by-subject" className="rounded-panel border border-border-subtle bg-surface p-5">
                <h2 id="by-subject" className="text-sm font-extrabold text-primary">By subject</h2>
                <ul className="mt-3 space-y-3">
                  {result.subject_breakdown.map((s) => (
                    <li key={s.subject_id}>
                      <div className="flex items-baseline justify-between gap-2 text-xs"><span className="font-semibold text-primary">{s.subject}</span><span className="tabular text-text-muted">{s.score}/{s.max} · {s.correct} right, {s.wrong} wrong, {s.skipped} skipped</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated"><div className={cn("h-full rounded-full", s.percent >= 60 ? "bg-status-success" : s.percent >= 40 ? "bg-status-warning" : "bg-status-danger")} style={{ width: `${s.percent}%` }} /></div>
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard/core/practice?mode=weak" className="mt-4 inline-block text-2xs font-bold text-accent-primary hover:underline">Practise your weak topics →</Link>
              </section>
            )}

            <section aria-labelledby="review" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="review" className="text-sm font-extrabold text-primary">Review every question</h2>
                <div className="flex gap-1" role="group" aria-label="Filter questions">
                  {(["all", "wrong", "skipped", "right"] as const).map((f) => (
                    <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1 text-2xs font-bold capitalize", filter === f ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle text-text-muted hover:text-primary")}>{f === "right" ? "Correct" : f}</button>
                  ))}
                </div>
              </div>
              {shown.length === 0 ? <p className="rounded-panel border border-border-subtle bg-surface py-8 text-center text-xs text-text-muted">Nothing in this view.</p> : shown.map((r) => <ReviewCard key={r.question_id} item={r} />)}
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function ReviewCard({ item }: { item: CoreResultReview }) {
  const [reporting, setReporting] = useState(false);
  const [sent, setSent] = useState(false);
  const state = item.is_correct === null ? "skipped" : item.is_correct ? "right" : "wrong";

  const report = async (reason: string) => {
    try {
      await api.post(`/core/questions/${item.question_id}/report`, { reason });
      setSent(true);
      setReporting(false);
    } catch {
      /* the next try will surface it */
    }
  };

  return (
    <article className={cn("rounded-panel border bg-surface p-5", state === "right" ? "border-status-success/30" : state === "wrong" ? "border-status-danger/30" : "border-border-subtle")}>
      <header className="mb-3 flex flex-wrap items-center gap-2 text-3xs font-bold uppercase tracking-wide">
        <span className="text-text-muted">Q{item.position}</span>
        <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5", state === "right" ? "bg-status-success/10 text-status-success" : state === "wrong" ? "bg-status-danger/10 text-status-danger" : "bg-elevated text-text-muted")}>
          {state === "right" ? <Check className="h-3 w-3" aria-hidden /> : state === "wrong" ? <X className="h-3 w-3" aria-hidden /> : <CircleSlash className="h-3 w-3" aria-hidden />}
          {state === "right" ? "Correct" : state === "wrong" ? "Wrong" : "Skipped"} · {item.marks_awarded ?? 0}/{item.marks}
        </span>
        {item.subject && <span className="rounded bg-elevated px-1.5 py-0.5 text-text-muted">{item.subject}</span>}
        {item.topic && <span className="rounded bg-elevated px-1.5 py-0.5 text-text-muted">{item.topic}</span>}
      </header>

      <MathMarkdown>{item.stem}</MathMarkdown>
      {item.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt="Figure for this question" className="mt-3 max-h-60 rounded-control border border-border-subtle bg-white object-contain" />
      )}

      {item.type === "numeric" ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-control bg-elevated p-2.5"><dt className="text-3xs font-semibold uppercase text-text-muted">Your answer</dt><dd className="tabular font-mono font-bold text-primary">{item.numeric_value ?? "—"} {item.numeric_unit}</dd></div>
          <div className="rounded-control bg-status-success/10 p-2.5"><dt className="text-3xs font-semibold uppercase text-status-success">Accepted</dt><dd className="tabular font-mono font-bold text-primary">{item.numeric_min}{item.numeric_max !== item.numeric_min ? ` to ${item.numeric_max}` : ""} {item.numeric_unit}</dd></div>
        </dl>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {item.options.map((o, i) => {
            const key = item.correct?.includes(o.id);
            const mine = item.selected.includes(o.id);
            return (
              <li key={o.id} className={cn("flex items-start gap-2.5 rounded-control border px-3 py-2 text-xs", key ? "border-status-success/50 bg-status-success/10" : mine ? "border-status-danger/50 bg-status-danger/10" : "border-border-subtle")}>
                <span className={cn("mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-3xs font-extrabold", key ? "bg-status-success text-white" : mine ? "bg-status-danger text-white" : "bg-elevated text-text-muted")}>{LETTERS[i]}</span>
                <span className="min-w-0 flex-1"><MathMarkdown inline>{o.text}</MathMarkdown></span>
                {mine && <span className="shrink-0 text-3xs font-bold uppercase text-text-muted">Your answer</span>}
              </li>
            );
          })}
        </ul>
      )}

      {item.explanation && (
        <div className="mt-3 rounded-control bg-elevated/60 p-3">
          <p className="mb-1 text-3xs font-bold uppercase tracking-wide text-text-muted">Solution</p>
          <MathMarkdown>{item.explanation}</MathMarkdown>
        </div>
      )}

      <footer className="mt-3 flex flex-wrap items-center gap-3 text-2xs">
        {sent ? <span className="font-semibold text-status-success">Thanks — we&apos;ll check it.</span> : reporting ? (
          <span className="flex flex-wrap gap-1.5" role="group" aria-label="What is wrong?">{REASONS.map(([id, label]) => <button key={id} onClick={() => void report(id)} className="rounded-full border border-border-strong px-2.5 py-1 font-semibold text-text-secondary hover:border-accent-primary hover:text-accent-primary">{label}</button>)}</span>
        ) : (
          <button onClick={() => setReporting(true)} className="inline-flex items-center gap-1 font-semibold text-text-muted hover:text-primary"><Flag className="h-3 w-3" /> Report a problem</button>
        )}
        <Link href={`/dashboard/core/practice?mode=new`} className="ml-auto font-bold text-accent-primary hover:underline">Practise more like this</Link>
      </footer>
    </article>
  );
}
