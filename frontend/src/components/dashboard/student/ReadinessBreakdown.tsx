"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessComponent, ReadinessDecay } from "@/types/studentStats";

interface ReadinessBreakdownProps {
  components: ReadinessComponent[];
  nextSteps: string[];
  /** Compact mode drops the next-steps callouts — used next to the ReadinessRing on the main dashboard, where the full explanation lives on the Reports page instead. */
  compact?: boolean;
  /** Which weighting made the score; a non-software profile gets a one-line explanation in the full view. */
  profile?: "software" | "core" | "balanced" | "general";
  /** What missed days have taken off the score; drawn as the last row, in red, when it is more than nothing. */
  decay?: ReadinessDecay | null;
}

function barTone(score: number) {
  if (score >= 75) return "bg-status-success";
  if (score >= 45) return "bg-accent-primary";
  if (score > 0) return "bg-status-warning";
  return "bg-status-danger";
}

export function ReadinessBreakdown({ components, nextSteps, compact = false, profile, decay }: ReadinessBreakdownProps) {
  return (
    <div className="space-y-4">
      {/* Said once, plainly, so a student on Core Prep knows why coding and contests are not in their score. */}
      {!compact && profile && profile !== "software" && (
        <p className="rounded-control border border-border-subtle bg-elevated/50 px-3 py-2 text-3xs leading-relaxed text-text-muted">
          {profile === "core"
            ? "Your score is weighted for Core Prep: technical tests and syllabus coverage count in place of coding and contest points."
            : profile === "general"
              ? "Your score is built from interviews, the Learning Centre, soft skills, events and showing up — your programme has no coding or contest points to earn, so none are expected of you."
              : "Your score is weighted for a balanced track: Core Prep counts alongside coding and contests."}
        </p>
      )}
      <div className="space-y-3.5">
        {components.map((c) => (
          <div key={c.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-primary">{c.label}</span>
              <div className="flex items-center gap-2 shrink-0 font-mono text-text-muted">
                <span className="text-3xs uppercase tracking-wide text-text-muted">{c.weight_percent}% weight</span>
                <span className={cn("font-bold", c.score === 0 ? "text-status-danger" : "text-text-secondary")}>{c.score}%</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", barTone(c.score))}
                style={{ width: `${c.score}%` }}
              />
            </div>
            {/* What the score is made of — shown in full mode; the compact dashboard card stays a glance. */}
            {!compact && c.detail && <p className="text-3xs leading-relaxed text-text-muted">{c.detail}</p>}
          </div>
        ))}

        {decay && decay.enabled && decay.points > 0 && (
          <div className="space-y-1.5 border-t border-border-subtle pt-3.5" data-testid="decay-row">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-primary">Missed days</span>
              <div className="flex items-center gap-2 shrink-0 font-mono text-text-muted">
                <span className="text-3xs uppercase tracking-wide text-text-muted">{decay.missed_days} of {decay.window_days} days</span>
                <span className="font-bold text-status-danger">−{decay.points}</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-status-danger transition-all duration-500"
                style={{ width: `${Math.min(100, decay.max_points > 0 ? (decay.points / decay.max_points) * 100 : 0)}%` }}
              />
            </div>
            {!compact && (
              <p className="text-3xs leading-relaxed text-text-muted">
                {decay.per_day} {decay.per_day === 1 ? "point" : "points"} off for every day with no activity — it stops growing the day you practise, and each missed day drops out after {decay.window_days} days.
              </p>
            )}
          </div>
        )}
      </div>

      {!compact && nextSteps.length > 0 && (
        <div className="space-y-2 pt-1">
          {nextSteps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-3 rounded-control bg-accent-primary/5 border border-accent-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent-primary shrink-0 mt-0.5" />
              <span className="text-2xs text-text-secondary leading-relaxed">{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
