"use client";

import { useMemo, useState } from "react";
import { Code2, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContestType, SubmissionHistoryRow } from "@/types/studentReport";

const VERDICT_TONE: Record<string, string> = {
  accepted: "text-status-success",
  wrong_answer: "text-status-danger",
  runtime_error: "text-status-warning",
  compile_error: "text-status-warning",
};

const VERDICT_LABEL: Record<string, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
};

const DIFFICULTY_TONE: Record<string, string> = {
  easy: "text-status-success",
  medium: "text-status-warning",
  hard: "text-status-danger",
};

/**
 * Every place a submission can come from, in one label map — `practice`
 * plus every Contest::CONTEST_TYPE. Reusing the backend's own type strings
 * as keys (rather than inventing a parallel id scheme) means a new contest
 * type only ever needs one new label added here, never a second enum kept
 * in sync by hand.
 */
export const SOURCE_LABEL: Record<"practice" | ContestType, string> = {
  practice: "Practice",
  tpo_mock: "Mock Contest",
  daily: "Daily Contest",
  general: "Mellow Contest",
  company: "Company Assessment",
  company_hiring: "Hiring Assessment",
  talent_pool: "Talent Pool Test",
};

export const SOURCE_TONE: Record<"practice" | ContestType, string> = {
  practice: "bg-elevated text-text-muted border-border-subtle",
  tpo_mock: "bg-accent-primary/10 text-accent-primary border-accent-primary/25",
  daily: "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/25",
  general: "bg-status-success/10 text-status-success border-status-success/25",
  company: "bg-amber-500/10 text-amber-500 border-amber-500/25",
  company_hiring: "bg-amber-500/10 text-amber-500 border-amber-500/25",
  talent_pool: "bg-rose-500/10 text-rose-400 border-rose-500/25",
};

interface SubmissionHistoryListProps {
  submissions: SubmissionHistoryRow[];
  onOpenCode: (row: SubmissionHistoryRow) => void;
  /** Caps the internal scroll area — the report page (half of a stacked page) wants a bounded list; a dedicated page can afford to show more before scrolling. Defaults to the report page's original height. */
  maxHeightClassName?: string;
}

/**
 * The unified practice+contest submission list with a source filter and a
 * "Code" button per row — originally built once for the TPO/Coordinator/
 * Admin student-report page (`admin/students/report/page.tsx`), extracted
 * here so the student's own `dashboard/reports/page.tsx` can show the exact
 * same thing about their OWN submissions without a second, drifting copy of
 * this filter/list/styling logic.
 */
export function SubmissionHistoryList({ submissions, onOpenCode, maxHeightClassName = "max-h-[560px]" }: SubmissionHistoryListProps) {
  const [submissionFilter, setSubmissionFilter] = useState<"all" | "practice" | ContestType>("all");

  // One count per source that's actually present, plus "all" — a filter
  // pill for a source with zero rows would just be dead weight in the bar.
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of submissions) counts.set(s.source, (counts.get(s.source) ?? 0) + 1);
    return counts;
  }, [submissions]);

  const filteredSubmissions = useMemo(
    () => (submissionFilter === "all" ? submissions : submissions.filter((s) => s.source === submissionFilter)),
    [submissions, submissionFilter]
  );

  return (
    <div className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-3 sm:px-5">
        <Code2 className="h-4 w-4 text-accent-primary" />
        <h2 className="text-sm font-bold text-primary">Submission History</h2>
        <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-3xs font-bold text-text-muted">{submissions.length}</span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <FilterPill active={submissionFilter === "all"} onClick={() => setSubmissionFilter("all")} label="All" count={submissions.length} />
          {(Object.keys(SOURCE_LABEL) as ("practice" | ContestType)[])
            .filter((source) => sourceCounts.has(source))
            .map((source) => (
              <FilterPill
                key={source}
                active={submissionFilter === source}
                onClick={() => setSubmissionFilter(source)}
                label={SOURCE_LABEL[source]}
                count={sourceCounts.get(source) ?? 0}
              />
            ))}
        </div>
      </div>

      <div className={cn("divide-y divide-border-subtle overflow-y-auto", maxHeightClassName)}>
        {filteredSubmissions.length === 0 ? (
          <p className="px-4 py-6 text-center text-2xs text-text-muted sm:px-5">No submissions match this filter.</p>
        ) : (
          filteredSubmissions.map((s) => (
            <div key={`${s.kind}-${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("shrink-0 text-3xs font-black uppercase", DIFFICULTY_TONE[s.difficulty] ?? "text-text-muted")} title={s.difficulty}>
                  {s.difficulty?.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-primary">{s.problem_title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-3xs">
                    <span className={cn("font-bold", VERDICT_TONE[s.status] ?? "text-text-muted")}>{VERDICT_LABEL[s.status] ?? s.status}</span>
                    <span className="text-text-muted">{s.language}</span>
                    <span className={cn("rounded-full border px-1.5 py-0 text-3xs font-bold uppercase tracking-wide", SOURCE_TONE[s.source])}>
                      {SOURCE_LABEL[s.source]}
                    </span>
                    {s.contest_title && <span className="truncate text-text-muted">via {s.contest_title}</span>}
                    {s.points_awarded !== null && <span className="text-text-muted">{s.points_awarded} pts</span>}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-3xs text-text-muted sm:inline">
                  {new Date(s.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
                <button
                  onClick={() => onOpenCode(s)}
                  className="flex items-center gap-1 rounded-control border border-border-subtle bg-elevated px-2 py-1 text-3xs font-bold text-text-secondary transition-colors hover:text-primary active:scale-95"
                >
                  <FileCode2 className="h-3.5 w-3.5" />
                  Code
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterPill({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-3xs font-bold transition-colors",
        active ? "border-accent-primary/40 bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-elevated text-text-muted hover:text-primary"
      )}
    >
      {label}
      <span className="font-mono opacity-70">{count}</span>
    </button>
  );
}
