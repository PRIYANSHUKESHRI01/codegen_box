"use client";

import { useState } from "react";
import { Check, ChevronDown, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrollmentMilestone } from "@/types/projectLab";

interface MilestonePanelProps {
  milestones: EnrollmentMilestone[];
  /** The project is in progress and the student may tick things off. */
  editable: boolean;
  /** Ticks or unticks one milestone; the parent owns the request and the state. */
  onToggle: (milestone: EnrollmentMilestone) => void;
  /** Milestone ids with a request in flight. */
  pending: ReadonlySet<number>;
}

/**
 * The SOW's milestones as a checklist next to the editor. Ticking one is the
 * student's own claim — reviewers check it against the acceptance criteria shown
 * under it — so it is cheap to toggle and says so.
 */
export function MilestonePanel({ milestones, editable, onToggle, pending }: MilestonePanelProps) {
  const [open, setOpen] = useState<number | null>(milestones.find((m) => !m.done)?.id ?? null);

  const done = milestones.filter((m) => m.done).length;
  const pct = milestones.length === 0 ? 0 : Math.round((100 * done) / milestones.length);

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-secondary">Progress</h3>
          <span className="text-xs font-bold tabular-nums text-primary">
            {done} / {milestones.length}
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-elevated"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Milestones completed"
        >
          <div className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {editable && (
          <p className="mt-2 text-2xs leading-snug text-text-secondary">
            Tick a milestone when every acceptance criterion under it is met. A reviewer checks your claim.
          </p>
        )}
      </div>

      <ol className="space-y-2">
        {milestones.map((m, i) => {
          const expanded = open === m.id;
          const busy = pending.has(m.id);
          return (
            <li
              key={m.id}
              className={cn(
                "rounded-control border transition-colors",
                m.done ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-border-subtle bg-surface"
              )}
            >
              <div className="flex items-start gap-2.5 p-3">
                <button
                  type="button"
                  onClick={() => onToggle(m)}
                  disabled={!editable || busy}
                  aria-pressed={m.done}
                  aria-label={`${m.done ? "Untick" : "Tick"} milestone ${i + 1}: ${m.title}`}
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-1",
                    m.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-border-strong text-transparent hover:border-accent-primary",
                    (!editable || busy) && "cursor-not-allowed opacity-70"
                  )}
                >
                  {m.done ? <Check className="h-3 w-3" strokeWidth={3} /> : <Circle className="h-3 w-3" />}
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : m.id)}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left"
                >
                  <span className="min-w-0">
                    <span className={cn("block text-13 font-bold leading-snug", m.done ? "text-text-secondary line-through decoration-emerald-500/60" : "text-primary")}>
                      {i + 1}. {m.title}
                    </span>
                    <span className="mt-0.5 block text-2xs font-semibold text-text-secondary">~{m.estimated_hours} h</span>
                  </span>
                  <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-text-secondary transition-transform", expanded && "rotate-180")} />
                </button>
              </div>

              {expanded && (
                <div className="border-t border-border-subtle px-3 pb-3 pl-[2.375rem] pt-2.5">
                  {m.description && <p className="text-xs leading-relaxed text-text-secondary">{m.description}</p>}
                  {m.acceptance_criteria.length > 0 && (
                    <>
                      <p className="mt-2.5 text-3xs font-bold uppercase tracking-[0.1em] text-text-secondary">Done when</p>
                      <ul className="mt-1.5 space-y-1.5">
                        {m.acceptance_criteria.map((c) => (
                          <li key={c} className="flex items-start gap-2 text-xs leading-snug text-text-secondary">
                            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-primary" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {!m.description && m.acceptance_criteria.length === 0 && <p className="text-xs text-text-secondary">See the SOW for this milestone&apos;s detail.</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
