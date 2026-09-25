"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessComponent } from "@/types/studentStats";

interface ReadinessBreakdownProps {
  components: ReadinessComponent[];
  nextSteps: string[];
  /** Compact mode drops the next-steps callouts — used next to the ReadinessRing on the main dashboard, where the full explanation lives on the Reports page instead. */
  compact?: boolean;
}

function barTone(score: number) {
  if (score >= 75) return "bg-status-success";
  if (score >= 45) return "bg-accent-primary";
  if (score > 0) return "bg-status-warning";
  return "bg-status-danger";
}

export function ReadinessBreakdown({ components, nextSteps, compact = false }: ReadinessBreakdownProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-3.5">
        {components.map((c) => (
          <div key={c.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-semibold text-primary">{c.label}</span>
              <div className="flex items-center gap-2 shrink-0 font-mono text-text-muted">
                <span className="text-[10px] uppercase tracking-wide text-text-muted">{c.weight_percent}% weight</span>
                <span className={cn("font-bold", c.score === 0 ? "text-status-danger" : "text-text-secondary")}>{c.score}%</span>
              </div>
            </div>
            <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", barTone(c.score))}
                style={{ width: `${c.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {!compact && nextSteps.length > 0 && (
        <div className="space-y-2 pt-1">
          {nextSteps.map((step, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-3 rounded-control bg-accent-primary/5 border border-accent-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent-primary shrink-0 mt-0.5" />
              <span className="text-[11px] text-text-secondary leading-relaxed">{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
