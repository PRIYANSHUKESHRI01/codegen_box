"use client";

import { AlertOctagon, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { AUTHORSHIP_LABEL_META, GUARD_KIND_LABELS, formatDuration, formatPercent } from "@/lib/projectLab";
import { cn } from "@/lib/utils";
import type { AuthorshipEvidence, AuthorshipTimelineRow } from "@/types/projectLab";

interface AuthorshipCardProps {
  evidence: AuthorshipEvidence | null;
  timeline: AuthorshipTimelineRow[];
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-control border border-border-subtle bg-elevated p-3">
      <p className="text-3xs font-bold uppercase tracking-[0.1em] text-text-secondary">{label}</p>
      <p className="mt-1 font-mono text-base font-extrabold tabular-nums text-primary">{value}</p>
      {note && <p className="mt-0.5 text-2xs leading-snug text-text-secondary">{note}</p>}
    </div>
  );
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

/**
 * "Did the student write this?" — the evidence gathered when the project was submitted, with the reasons in words.
 * A pointer for the reviewer (the label says how much it is worth a closer look), never a verdict: nothing here changes
 * a score or blocks anything, and the evidence comes from the student's own browser, so a gap is itself informative.
 * Metadata only: there is no text of anything pasted or typed to show, by design.
 */
export function AuthorshipCard({ evidence, timeline }: AuthorshipCardProps) {
  const meta = AUTHORSHIP_LABEL_META[evidence?.label ?? "not_checked"];

  return (
    <section className="rounded-panel border border-border-subtle bg-surface shadow-subtle" aria-label="Authorship check">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-primary">
          <ShieldCheck className="h-4 w-4 text-accent-primary" aria-hidden />
          Authorship check
        </h2>
        <span className={cn("rounded-full border px-2.5 py-1 text-3xs font-bold uppercase tracking-wide", meta.className)}>{meta.label}</span>
      </div>

      <div className="space-y-4 px-5 py-4">
        {evidence === null && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            No authorship evidence was gathered for this submission (the workspace was not open when it was handed in, or the report could not be built).
          </p>
        )}

        {evidence !== null && evidence.mode === "open" && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            This project allows pasting, so authorship was not checked.
          </p>
        )}

        {evidence !== null && evidence.mode !== "open" && (
          <>
            {evidence.signals.length === 0 ? (
              <p className="flex items-start gap-2 text-xs font-semibold leading-relaxed text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Nothing unusual: the guard was running throughout, no meaningful volume of outside text was refused, and the history looks like work done over time.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {evidence.signals.map((signal) => (
                  <li
                    key={signal.code}
                    className={cn(
                      "flex items-start gap-2 rounded-control border p-2.5 text-xs leading-relaxed",
                      signal.level === "attention"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                    )}
                  >
                    {signal.level === "attention" ? <AlertOctagon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
                    {signal.text}
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Guard running"
                value={formatPercent(evidence.guard.coverage)}
                note={evidence.guard.session_seconds > 0 ? `of ${formatDuration(evidence.guard.session_seconds)} in the workspace` : "no workspace time recorded"}
              />
              <Stat
                label="Refused from outside"
                value={String(evidence.guard.refused.attempts)}
                note={`${evidence.guard.refused.chars.toLocaleString()} characters · largest ${evidence.guard.refused.largest.toLocaleString()}${evidence.guard.refused.would_have_been > 0 ? " (some in trial mode)" : ""}`}
              />
              <Stat label="Pasted inside" value={String(evidence.guard.internal.pastes)} note={`${evidence.guard.internal.sow_commands} SOW command(s)`} />
              <Stat label="Typing flags" value={String(evidence.guard.typing.fast + evidence.guard.typing.robotic)} note={`${evidence.guard.typing.fast} too fast · ${evidence.guard.typing.robotic} too regular`} />
            </div>

            <div>
              <h3 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-secondary">Git history</h3>
              {evidence.git === null ? (
                <p className="mt-1.5 text-xs text-text-secondary">Not available (no repository found, or the workspace could not be read).</p>
              ) : (
                <div className="mt-1.5 space-y-2 text-xs leading-relaxed text-text-secondary">
                  <p>
                    <strong className="text-primary">{evidence.git.commits_after_first}</strong> commit{evidence.git.commits_after_first === 1 ? "" : "s"} after the starting
                    commit, over <strong className="text-primary">{formatDuration(evidence.git.span_minutes * 60)}</strong>, adding about{" "}
                    <strong className="text-primary">{evidence.git.added_after_first.toLocaleString()}</strong> lines in <code className="font-mono">{evidence.git.path}</code>.
                    {evidence.git.largest && (
                      <>
                        {" "}
                        Largest commit: <strong className="text-primary">{evidence.git.largest.lines.toLocaleString()}</strong> lines ({formatPercent(evidence.git.largest.share)}) —{" "}
                        “{evidence.git.largest.subject}”.
                      </>
                    )}
                  </p>
                  {evidence.git.top.length > 1 && (
                    <ul className="list-disc space-y-0.5 pl-5">
                      {evidence.git.top.map((c) => (
                        <li key={c.at + c.subject}>
                          {c.lines.toLocaleString()} lines — “{c.subject}” <span className="text-text-muted">({when(c.at)})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-secondary">Extensions</h3>
              <p className="mt-1.5 text-xs text-text-secondary">
                {evidence.extensions.extra.length === 0 ? "Only the curated set is installed." : `Beyond the curated set: ${evidence.extensions.extra.join(", ")}.`}
              </p>
            </div>

            {timeline.length > 0 && (
              <details className="group rounded-control border border-border-subtle">
                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-bold text-primary">What the guard noticed ({timeline.length}{timeline.length === 60 ? "+" : ""} most recent)</summary>
                <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                  {timeline.map((row, i) => (
                    <li key={`${row.at}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-xs">
                      <span className="w-40 shrink-0 text-text-secondary tabular-nums">{when(row.at)}</span>
                      <span className="font-semibold text-primary">{GUARD_KIND_LABELS[row.kind] ?? row.kind}</span>
                      {row.size !== null && row.size > 0 && (
                        <span className="text-text-secondary">
                          {row.size.toLocaleString()} {row.kind.endsWith("_typing") ? "keystrokes" : "characters"}
                        </span>
                      )}
                      {row.target && <span className="text-text-muted">in the {row.target}</span>}
                      {row.report_only && <span className="rounded-full border border-border-subtle px-1.5 text-3xs font-bold uppercase text-text-secondary">trial mode</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}

        <p className="border-t border-border-subtle pt-3 text-2xs leading-relaxed text-text-muted">
          A pointer for you, not a verdict: it never changes a score. The evidence comes from the student’s own browser and git history, so a gap (for example the guard
          not running) is itself something to ask about. Only counts and sizes are kept — never what was copied or typed.
        </p>
      </div>
    </section>
  );
}
