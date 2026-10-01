"use client";

import { cn } from "@/lib/utils";

const STAGE_COLORS = [
  "bg-accent-primary",
  "bg-accent-secondary",
  "bg-status-warning",
  "bg-purple-500",
  "bg-blue-500",
  "bg-status-success",
  "bg-status-danger",
  "bg-text-muted",
];

export interface PipelineStageCount {
  name: string;
  count: number;
}

interface DrivePipelineBarProps {
  stages: PipelineStageCount[];
  compact?: boolean;
}

export function DrivePipelineBar({ stages, compact = false }: DrivePipelineBarProps) {
  const max = stages[0]?.count || 1;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {stages.map((stage, idx) => (
          <div key={stage.name} className="flex-1 min-w-0" title={`${stage.name}: ${stage.count}`}>
            <div className="text-3xs text-text-muted truncate mb-1">{stage.name}</div>
            <div className="h-1.5 rounded-full bg-elevated overflow-hidden">
              <div
                className={cn("h-full rounded-full", STAGE_COLORS[idx % STAGE_COLORS.length])}
                style={{ width: `${Math.max(3, (stage.count / max) * 100)}%` }}
              />
            </div>
            <div className="text-3xs font-mono font-bold text-primary mt-1">{stage.count}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {stages.map((stage, idx) => (
        <div key={stage.name} className="p-3 rounded-control bg-elevated/60 border border-border-subtle text-center">
          <div
            className={cn("w-2 h-2 rounded-full mx-auto mb-2", STAGE_COLORS[idx % STAGE_COLORS.length])}
          />
          <div className="text-lg font-black text-primary font-mono">{stage.count}</div>
          <div className="text-3xs text-text-muted mt-0.5 leading-tight">{stage.name}</div>
        </div>
      ))}
    </div>
  );
}
