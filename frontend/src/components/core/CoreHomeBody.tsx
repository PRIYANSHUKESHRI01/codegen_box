"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, CheckCircle2, Clock3, Crosshair, History, ShieldCheck, Target, Timer, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDomainPrepCopy } from "@/lib/departments";
import type { CoreHomeAvailable } from "@/types/core";

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);
const tone = (accuracy: number | null) => (accuracy === null ? "bg-border-strong" : accuracy >= 75 ? "bg-status-success" : accuracy >= 50 ? "bg-status-warning" : "bg-status-danger");

/** Where a student stands in Core Prep, and the next useful thing to do. Shared by the Core Prep page and the Core home layout. */
export function CoreHomeBody({ home }: { home: CoreHomeAvailable }) {
  const { summary, plan } = home;
  const copy = useDomainPrepCopy();
  const limitLeft = plan.practice_limit === null ? null : Math.max(0, plan.practice_limit - plan.practice_used_today);

  return (
    <div className="space-y-6">
      {home.in_progress && (
        <Link href={`/dashboard/core/session?id=${home.in_progress.session}`} className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-status-warning/40 bg-status-warning/10 px-5 py-3.5 transition-colors hover:bg-status-warning/15">
          <span className="flex items-center gap-2.5 text-sm font-bold text-primary">
            <Clock3 className="h-4 w-4 text-status-warning" aria-hidden /> You have a test in progress{home.in_progress.test ? ` — ${home.in_progress.test}` : ""}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-status-warning">Resume <ArrowRight className="h-3.5 w-3.5" /></span>
        </Link>
      )}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "Questions answered", v: summary.answered.toLocaleString("en-IN"), icon: BookOpenCheck },
          { k: "Accuracy", v: pct(summary.accuracy), icon: Target },
          { k: "Topics mastered", v: `${summary.topics_mastered}/${summary.topics_total}`, icon: CheckCircle2 },
          { k: "Tests taken", v: `${summary.tests_taken}${summary.avg_test_percent !== null ? ` · avg ${summary.avg_test_percent}%` : ""}`, icon: Timer },
        ].map((s) => (
          <div key={s.k} className="rounded-panel border border-border-subtle bg-surface p-4">
            <s.icon className="h-4 w-4 text-accent-primary" aria-hidden />
            <dd className="tabular mt-2 text-xl font-extrabold text-primary">{s.v}</dd>
            <dt className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{s.k}</dt>
          </div>
        ))}
      </dl>

      {home.week && (
        <section aria-label="This week" className="rounded-panel border border-border-subtle bg-surface p-5">
          <h2 className="text-2xs font-bold uppercase tracking-wide text-text-muted">This week</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {[
              { label: "Practice questions", ...home.week.questions },
              { label: "Timed tests", ...home.week.tests },
            ].map((g) => {
              const share = Math.min(100, g.target > 0 ? Math.round((g.current / g.target) * 100) : 0);
              return (
                <div key={g.label}>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-text-secondary">{g.label}</span>
                    <span className="tabular font-bold text-primary">{g.current} / {g.target}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label={g.label} aria-valuemin={0} aria-valuemax={g.target} aria-valuenow={Math.min(g.current, g.target)}>
                    <div className={cn("h-full rounded-full", share >= 100 ? "bg-status-success" : "bg-accent-primary")} style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="practice-heading" className="rounded-panel border border-border-subtle bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="practice-heading" className="text-base font-extrabold text-primary">Practise</h2>
            <p className="mt-0.5 text-xs text-text-secondary">Instant feedback and a worked solution after every question.</p>
          </div>
          {plan.practice_limit !== null && (
            <p className="rounded-full border border-border-subtle bg-elevated px-3 py-1 text-2xs font-semibold text-text-secondary">
              {limitLeft} of {plan.practice_limit} left today · <Link href="/dashboard/billing" className="text-accent-primary hover:underline">Upgrade for unlimited</Link>
            </p>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { mode: "new", title: "New questions", body: "Questions you haven't tried yet.", icon: Crosshair },
            { mode: "weak", title: "My weak topics", body: home.weakest_topics.length ? `Starting with ${home.weakest_topics[0].topic}.` : "Appears once we've seen a few of your answers.", icon: TrendingUp },
            { mode: "review", title: "Review mistakes", body: "Questions you last got wrong.", icon: History },
          ].map((m) => (
            <Link key={m.mode} href={`/dashboard/core/practice?mode=${m.mode}`} className="group rounded-xl border border-border-subtle bg-elevated/40 p-4 transition-colors hover:border-accent-primary/50 hover:bg-accent-primary/5">
              <m.icon className="h-4 w-4 text-accent-primary" aria-hidden />
              <h3 className="mt-2 text-sm font-bold text-primary">{m.title}</h3>
              <p className="mt-0.5 text-2xs text-text-secondary">{m.body}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-2xs font-bold text-accent-primary">Start <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="subjects-heading" className="rounded-panel border border-border-subtle bg-surface">
          <h2 id="subjects-heading" className="border-b border-border-subtle px-5 py-3.5 text-sm font-extrabold text-primary">Your subjects</h2>
          <ul className="divide-y divide-border-subtle">
            {home.subjects.map((s) => (
              <li key={s.id}>
                <Link href={`/dashboard/core/practice?subject=${s.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-hover">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs font-bold text-primary">{s.name}</span>
                      <span className="tabular shrink-0 text-2xs text-text-muted">{s.attempts > 0 ? `${pct(s.accuracy)} · ${s.attempts} answered` : `${s.questions} question${s.questions === 1 ? "" : "s"}`}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated" role="img" aria-label={s.accuracy === null ? "Not started" : `${s.accuracy}% accuracy`}>
                      <div className={cn("h-full rounded-full transition-all", tone(s.accuracy))} style={{ width: `${s.accuracy ?? 0}%` }} />
                    </div>
                    <p className="mt-1 text-3xs text-text-muted">{s.topics_mastered}/{s.topics_total} topics mastered</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section aria-labelledby="weak-heading" className="rounded-panel border border-border-subtle bg-surface">
            <h2 id="weak-heading" className="border-b border-border-subtle px-5 py-3.5 text-sm font-extrabold text-primary">Where to focus</h2>
            {home.weakest_topics.length === 0 ? (
              <p className="px-5 py-6 text-xs text-text-muted">Answer a few questions and your weakest topics show up here.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {home.weakest_topics.map((t) => (
                  <li key={t.topic_id}>
                    <Link href={`/dashboard/core/practice?subject=${t.subject_id}&topic=${t.topic_id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-surface-hover">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-primary">{t.topic}</span>
                        <span className="block truncate text-3xs text-text-muted">{t.subject}</span>
                      </span>
                      <span className="tabular shrink-0 rounded-full bg-status-danger/10 px-2 py-0.5 text-2xs font-bold text-status-danger">{t.accuracy}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="tests-heading" className="rounded-panel border border-border-subtle bg-surface p-5">
            <h2 id="tests-heading" className="text-sm font-extrabold text-primary">Timed tests</h2>
            <p className="mt-1 text-xs text-text-secondary">
              {home.tests_available > 0 ? `${home.tests_available} test${home.tests_available === 1 ? "" : "s"} available — proctored, with a clock and negative marking like the real thing.` : `No tests have been published for ${copy.yours} yet.`}
            </p>
            {!plan.tests_access && plan.free_test_tries !== null && (
              <p className="mt-2 text-2xs text-text-muted">Your plan includes {plan.free_test_tries} free test{plan.free_test_tries === 1 ? "" : "s"} ({plan.free_test_tries_used ?? 0} used). <Link href="/dashboard/billing" className="font-semibold text-accent-primary hover:underline">Upgrade</Link> for unlimited.</p>
            )}
            <Link href="/dashboard/core/tests" className="mt-3 inline-flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline">See all tests <ArrowRight className="h-3 w-3" /></Link>

            {home.recent_results.length > 0 && (
              <ul className="mt-4 divide-y divide-border-subtle border-t border-border-subtle">
                {home.recent_results.map((r) => (
                  <li key={r.session}>
                    <Link href={`/dashboard/core/result?id=${r.session}`} className="flex items-center justify-between gap-3 py-2 text-xs hover:text-accent-primary">
                      <span className="min-w-0 truncate font-semibold text-primary">{r.test ?? "Test"}</span>
                      <span className={cn("tabular shrink-0 font-bold", r.passed ? "text-status-success" : "text-status-danger")}>{r.score_percent !== null ? `${Math.round(r.score_percent)}%` : "—"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <p className="flex items-start gap-2 text-2xs leading-relaxed text-text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {copy.label} practice and tests are proctored — camera on, fullscreen, no switching tabs. They don&apos;t count towards your readiness score or Vault profile yet.
      </p>
    </div>
  );
}
