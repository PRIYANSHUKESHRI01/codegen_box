"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, Clock, FileText, Layers, ListChecks, Minus, Trophy } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DownloadReportButton } from "@/components/dashboard/merchantNavy/DownloadReportButton";
import { ScoreTrend } from "@/components/dashboard/merchantNavy/ScoreTrend";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { ApiError, api } from "@/lib/api";
import { formatDuration } from "@/lib/studyReportPdf";
import { MATCH_BAND, bandOf } from "@/lib/studyMatch";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { cn } from "@/lib/utils";
import type { StudyOverview, StudyOverviewExam, StudyOverviewSet } from "@/types/studyReport";

const PATH = "/dashboard/merchant-navy";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/** My Reports: every Merchant Navy set the student has sat, with the score of each sitting, and the report of any of them to download. */
export default function MerchantNavyReportsPage() {
  const { status } = useAuthGuard(["user"]);
  const [overview, setOverview] = useState<StudyOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await api.get<StudyOverview>("/study-attempts"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your reports.");
    }
  }, []);

  useEffect(() => {
    if (status === "ready") void load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="user"
      title="My Reports"
      subtitle="Every set you have practised, with your score each time. Download the report of any sitting: your answers, the model answers and what to revise."
      back={{ href: PATH, label: "Merchant Navy" }}
    >
      <div className="mt-4 space-y-8">
        {error ? (
          <div role="alert" className="rounded-2xl border border-status-danger/30 bg-status-danger/10 p-5 text-sm text-status-danger">
            {error}{" "}
            <button type="button" onClick={() => void load()} className="font-bold underline">
              Try again
            </button>
          </div>
        ) : !overview ? (
          <p role="status" className="text-sm text-text-muted">
            Loading your reports…
          </p>
        ) : overview.exams.length === 0 ? (
          <Empty />
        ) : (
          <>
            <Totals totals={overview.totals} />
            {overview.exams.map((exam) => (
              <Exam key={exam.stack_key} exam={exam} />
            ))}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function Empty() {
  return (
    <div data-testid="reports-empty" className="rounded-3xl border border-dashed border-border-strong bg-surface p-10 text-center">
      <FileText className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
      <h2 className="mt-3 text-lg font-extrabold text-primary">No sittings yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">When you finish a set, its score is kept here and you can download a report of it. Practise a set to get started.</p>
      <Link href={PATH} className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent-primary/30 hover:bg-accent-primary-hover">
        Choose a set
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}

function Totals({ totals }: { totals: StudyOverview["totals"] }) {
  const time = formatDuration(totals.seconds);
  const tiles = [
    { icon: ListChecks, label: "Sittings", value: String(totals.attempts) },
    { icon: Layers, label: "Sets practised", value: String(totals.sets_practised) },
    { icon: FileText, label: "Questions answered", value: String(totals.questions_answered) },
    { icon: Clock, label: "Time practising", value: time ?? "-" },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Your totals">
      {tiles.map(({ icon: Icon, label, value }) => (
        <li key={label} className="rounded-2xl border border-border-subtle bg-surface p-4">
          <Icon className="h-4 w-4 text-accent-primary" aria-hidden />
          <p className="mt-2 text-2xl font-black tabular-nums text-primary">{value}</p>
          <p className="text-3xs font-bold uppercase tracking-wide text-text-muted">{label}</p>
        </li>
      ))}
    </ul>
  );
}

function Exam({ exam }: { exam: StudyOverviewExam }) {
  return (
    <section aria-labelledby={`exam-${exam.stack_key}`} data-testid="reports-exam">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`exam-${exam.stack_key}`} className="text-lg font-extrabold tracking-tight text-primary">
            {exam.name}
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            {exam.sets_practised}
            {exam.sets_total ? ` of ${exam.sets_total}` : ""} {exam.sets_practised === 1 ? "set" : "sets"} practised
            {exam.average_latest !== null && (
              <>
                {" · "}latest scores average <strong className="tabular-nums text-primary">{exam.average_latest}%</strong>
              </>
            )}
            {" · "}best <strong className="tabular-nums text-primary">{exam.best_score}%</strong>
          </p>
        </div>
        <Link href={`${PATH}?domain=merchant_navy&stack=${exam.stack_key}`} className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline">
          Practise another set
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <ul className="divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-subtle bg-surface">
        {exam.sets.map((set) => (
          <SetRow key={set.round_id} set={set} />
        ))}
      </ul>
    </section>
  );
}

function Delta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-3xs font-semibold text-text-muted">first sitting</span>;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-3xs font-bold text-text-secondary">
        <Minus className="h-3 w-3" aria-hidden />
        level
      </span>
    );
  }

  return delta > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-3xs font-bold text-status-success">
      <ArrowUpRight className="h-3 w-3" aria-hidden />
      {delta} up
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-3xs font-bold text-status-danger">
      <ArrowDownRight className="h-3 w-3" aria-hidden />
      {Math.abs(delta)} down
    </span>
  );
}

function SetRow({ set }: { set: StudyOverviewSet }) {
  const band = MATCH_BAND[bandOf(set.last_score)];
  const sittings = [...set.history].reverse();

  return (
    <li data-testid="reports-set" className="px-4 py-3.5 sm:px-5">
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-5 gap-y-2 [&::-webkit-details-marker]:hidden">
          <span className="w-16 shrink-0 text-sm font-extrabold text-primary">{set.title}</span>
          <ScoreTrend points={set.history} className="hidden sm:block" />
          <span className="flex items-center gap-2.5">
            <span className={cn("rounded-full px-2.5 py-1 text-sm font-extrabold tabular-nums", band.soft, band.text)} title={band.label}>
              {set.last_score}%
            </span>
            <Delta delta={set.delta} />
          </span>
          <span className="inline-flex items-center gap-1 text-2xs text-text-secondary">
            <Trophy className="h-3 w-3 text-amber-500" aria-hidden />
            Best <strong className="tabular-nums text-primary">{set.best_score}%</strong>
          </span>
          <span className="text-2xs text-text-muted">
            {set.attempts} {set.attempts === 1 ? "sitting" : "sittings"} · last {day(set.last_at)}
          </span>
          <ChevronDown className="ml-auto h-4 w-4 text-text-muted transition-transform group-open:rotate-180" aria-hidden />
        </summary>

        <ol className="mt-3 divide-y divide-border-subtle rounded-xl border border-border-subtle bg-background/60" aria-label={`${set.title} sittings, newest first`}>
          {sittings.map((p, i) => (
            <li key={p.id} data-testid="reports-sitting" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 text-xs">
              <span className="w-24 font-bold text-primary">Sitting {set.history.length - i}</span>
              <span className="text-text-secondary">{day(p.completed_at)}</span>
              <span className="text-text-muted">{p.partial ? `${p.answered} of ${p.total} answered` : `${p.answered} answered`}</span>
              {formatDuration(p.duration_seconds) && <span className="text-text-muted">{formatDuration(p.duration_seconds)}</span>}
              <span className={cn("ml-auto rounded-full px-2 py-0.5 font-extrabold tabular-nums", MATCH_BAND[bandOf(p.score)].soft, MATCH_BAND[bandOf(p.score)].text)}>{p.score}%</span>
              <DownloadReportButton attemptId={p.id} compact label="Download report" />
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}
