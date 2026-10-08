"use client";

import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { LISTENING_SKILL_HINTS, type ListeningSkill, type ListeningSkillRow } from "@/types/learningCentre";

/** Bar colour from accuracy: red under half, amber until 70, green from there — the same 70 the "weakest skill" rule treats as strong. */
function barTone(pct: number): string {
  if (pct >= 70) return "bg-status-success";
  if (pct >= 50) return "bg-status-warning";
  return "bg-status-danger";
}

/**
 * A student's accuracy per listening skill. The weakest skill (when the
 * backend has enough evidence to name one) is flagged "Focus", because
 * knowing *which* skill is letting you down is the whole point of a skill
 * profile.
 */
export function SkillBars({
  skills,
  weakest,
  className,
}: {
  skills: ListeningSkillRow[];
  weakest?: { skill: ListeningSkill } | null;
  className?: string;
}) {
  if (skills.length === 0) return null;

  return (
    <ul className={cn("space-y-3", className)} aria-label="Accuracy by listening skill">
      {skills.map((row) => {
        const isWeakest = weakest?.skill === row.skill;
        return (
          <li key={row.skill}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
                {row.label}
                {isWeakest && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-status-danger/10 px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wide text-status-danger">
                    <Target className="h-3 w-3" aria-hidden="true" />
                    Focus
                  </span>
                )}
              </span>
              <span className="font-mono text-2xs font-bold tabular-nums text-text-secondary">
                {row.pct}% <span className="font-medium text-text-muted">({row.correct}/{row.total})</span>
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-elevated"
              role="meter"
              aria-label={`${row.label}: ${row.pct}%`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={row.pct}
            >
              <div className={cn("h-full rounded-full transition-[width] duration-700", barTone(row.pct))} style={{ width: `${row.pct}%` }} />
            </div>
            <p className="mt-0.5 text-2xs text-text-muted">{LISTENING_SKILL_HINTS[row.skill]}</p>
          </li>
        );
      })}
    </ul>
  );
}
