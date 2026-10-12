"use client";

import { ExternalLink, FileArchive, MessageSquareText, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUBMISSION_STATUS_META, formatBytes } from "@/lib/projectLab";
import type { SubmissionData } from "@/types/projectLab";

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Everything a student gets back about a hand-in: status, score, the reviewer's words. */
export function SubmissionHistory({ submissions }: { submissions: SubmissionData[] }) {
  if (submissions.length === 0) {
    return (
      <div className="p-6 text-center">
        <MessageSquareText className="mx-auto h-8 w-8 text-text-muted" />
        <p className="mt-3 text-sm font-bold text-primary">Nothing submitted yet</p>
        <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-text-secondary">
          When your milestones are done, press Submit. Your reviewer&apos;s score and feedback will appear here.
        </p>
      </div>
    );
  }

  return (
    <ol className="space-y-3 p-4">
      {submissions.map((s) => {
        const meta = SUBMISSION_STATUS_META[s.status];
        return (
          <li key={s.id} className="rounded-control border border-border-subtle bg-surface p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-primary">Attempt {s.attempt}</span>
              <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", meta.className)}>{meta.label}</span>
            </div>
            <p className="mt-1 text-2xs font-medium text-text-secondary">
              Submitted {formatWhen(s.submitted_at)} · {s.milestones_done}/{s.milestones_total} milestones ticked
            </p>

            {s.score !== null && (
              <p className="mt-3 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-black leading-none text-primary">{s.score}</span>
                <span className="text-xs font-semibold text-text-secondary">/ 100</span>
              </p>
            )}

            {s.rubric.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {s.rubric.map((r) => (
                  <li key={r.criterion} className="flex items-center justify-between gap-3 text-xs text-text-secondary">
                    <span>{r.criterion}</span>
                    <span className="font-mono font-bold tabular-nums text-primary">
                      {r.score}/{r.max}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {s.feedback && (
              <div className="mt-3 rounded-control border-l-2 border-accent-primary bg-elevated p-3">
                <p className="text-3xs font-bold uppercase tracking-[0.1em] text-text-secondary">Reviewer feedback</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-primary">{s.feedback}</p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs font-semibold text-text-secondary">
              {s.has_snapshot && (
                <span className="inline-flex items-center gap-1.5">
                  <FileArchive className="h-3.5 w-3.5" />
                  Code snapshot · {formatBytes(s.snapshot_size_bytes)}
                </span>
              )}
              {s.repo_url && (
                <a href={s.repo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-primary hover:underline">
                  Repository <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {s.live_url && (
                <a href={s.live_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-primary hover:underline">
                  Live demo <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {s.warnings.length > 0 && (
              <ul className="mt-2.5 space-y-1">
                {s.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-1.5 text-2xs text-amber-800 dark:text-amber-300">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
