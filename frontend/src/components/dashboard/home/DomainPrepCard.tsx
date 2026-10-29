"use client";

import Link from "next/link";
import { ArrowRight, CircuitBoard, Clock3 } from "lucide-react";
import { HpCard, HpIconTile, HpProgress, hpBtn } from "@/components/portal/kit";
import { useDomainPrepCopy } from "@/lib/departments";
import type { CoreHomeAvailable } from "@/types/core";

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

/**
 * A branch student's Domain Prep (Core / Management / Commerce / Subject Prep) in one glance: where they stand, this week's
 * target, and a way back into a test they left half-done. The questions, topics and tests themselves live on the Domain Prep page.
 */
export function DomainPrepCard({ home }: { home: CoreHomeAvailable }) {
  const copy = useDomainPrepCopy();
  const { summary, week, in_progress: resume } = home;
  const weekPct = week && week.questions.target > 0 ? Math.min(100, Math.round((week.questions.current / week.questions.target) * 100)) : null;

  return (
    <HpCard aria-labelledby="domain-prep-card" className="group relative overflow-hidden p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <HpIconTile icon={CircuitBoard} tone="violet" size="lg" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105" />
          <div>
            <h2 id="domain-prep-card" className="text-15 font-bold tracking-tight text-primary">
              {copy.label}
            </h2>
            <p className="text-2xs text-text-muted">Questions from your own subject, then timed tests</p>
          </div>
        </div>
        <Link href="/dashboard/core" className={hpBtn("primary", "md", "group/btn")}>
          {summary.answered > 0 ? "Keep practising" : "Start practising"}
          <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" aria-hidden />
        </Link>
      </div>

      {resume && (
        <Link
          href={`/dashboard/core/session?id=${resume.session}`}
          className="relative mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 transition-colors hover:bg-amber-500/15"
        >
          <span className="flex items-center gap-2 text-xs font-bold text-primary">
            <Clock3 className="h-4 w-4 text-amber-500" aria-hidden /> You have a test in progress{resume.test ? ` — ${resume.test}` : ""}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-300">
            Resume <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </Link>
      )}

      <dl className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { k: "Answered", v: summary.answered.toLocaleString("en-IN") },
          { k: "Accuracy", v: pct(summary.accuracy) },
          { k: "Topics mastered", v: `${summary.topics_mastered}/${summary.topics_total}` },
          { k: "Tests taken", v: String(summary.tests_taken) },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-border-subtle bg-elevated/60 px-3.5 py-3 transition-colors hover:border-indigo-500/25">
            <dd className="tabular text-xl font-extrabold text-primary">{s.v}</dd>
            <dt className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{s.k}</dt>
          </div>
        ))}
      </dl>

      {week && weekPct !== null && (
        <div className="relative mt-5">
          <div className="mb-2 flex items-baseline justify-between text-xs">
            <span className="font-medium text-text-secondary">Questions this week</span>
            <span className="tabular font-bold text-primary">
              {week.questions.current} / {week.questions.target}
            </span>
          </div>
          <HpProgress value={weekPct} tone={weekPct >= 100 ? "emerald" : "indigo"} className="h-2" />
        </div>
      )}
    </HpCard>
  );
}
