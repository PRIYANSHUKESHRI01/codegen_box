"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { HP_TONES, hpEase, type HpTone } from "@/components/portal/kit";
import { DRIVE_APPLICATION_STAGES, type DriveApplicationStage } from "@/types/placement";

/**
 * One tone per ATS stage, shared by this bar and the applicant stage pills on
 * the Campus Drives page: sky = new in pipeline (the TPO identity colour),
 * teal→indigo→violet = progressing rounds, amber = offer awaiting a reply,
 * emerald = placed, rose / slate = closed.
 */
export const DRIVE_STAGE_TONE: Record<DriveApplicationStage, HpTone> = {
  registered: "sky",
  online_test: "teal",
  technical_interview: "indigo",
  hr_round: "violet",
  offer_extended: "amber",
  offer_accepted: "emerald",
  rejected: "rose",
  withdrawn: "slate",
};

/** Callers pass stages in DRIVE_APPLICATION_STAGES order, so index → stage → tone. */
function toneAt(idx: number): HpTone {
  const stage = DRIVE_APPLICATION_STAGES[idx];
  return stage ? DRIVE_STAGE_TONE[stage] : "slate";
}

export interface PipelineStageCount {
  name: string;
  count: number;
}

interface DrivePipelineBarProps {
  stages: PipelineStageCount[];
  /** Dense variant: the distribution bar plus an inline legend instead of the stage tiles. */
  compact?: boolean;
  className?: string;
}

export function DrivePipelineBar({ stages, compact = false, className }: DrivePipelineBarProps) {
  const reduce = useReducedMotion();
  const total = stages.reduce((sum, s) => sum + s.count, 0);
  const share = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Stage distribution — each segment's width is its share of all applicants. */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-elevated [&>*+*]:border-l-2 [&>*+*]:border-surface" aria-hidden>
        {stages.map((stage, idx) =>
          stage.count > 0 ? (
            <motion.div
              key={stage.name}
              title={`${stage.name}: ${stage.count}`}
              className={cn("h-full", HP_TONES[toneAt(idx)].bar)}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(stage.count / total) * 100}%` }}
              transition={{ duration: 0.8, ease: hpEase, delay: reduce ? 0 : idx * 0.04 }}
            />
          ) : null
        )}
      </div>

      {compact ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Applicants by stage">
          {stages.map((stage, idx) => (
            <li key={stage.name} className={cn("flex items-center gap-1.5 text-2xs", stage.count === 0 && "opacity-55")}>
              <span className={cn("h-2 w-2 shrink-0 rounded-full", HP_TONES[toneAt(idx)].fill)} aria-hidden />
              <span className="font-medium text-text-secondary">{stage.name}</span>
              <span className="tabular font-bold text-primary">{stage.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" aria-label="Applicants by stage">
          {stages.map((stage, idx) => {
            const tone = toneAt(idx);
            return (
              <li
                key={stage.name}
                className={cn(
                  "group/stage relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong",
                  stage.count === 0 && "opacity-60"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", HP_TONES[tone].fill)} aria-hidden />
                  <span className="tabular text-lg font-extrabold leading-none tracking-tight text-primary">{stage.count}</span>
                </span>
                <span className="min-w-0">
                  <span className="block text-2xs font-semibold leading-tight text-text-secondary">{stage.name}</span>
                  <span className="tabular mt-0.5 block text-3xs font-medium text-text-muted">{share(stage.count)}% of pipeline</span>
                </span>
                {/* mt-auto pins the bar to the tile's foot so bars line up when a label wraps. */}
                <span aria-hidden className="mt-auto h-1 w-full overflow-hidden rounded-full bg-elevated">
                  <motion.span
                    className={cn("block h-full rounded-full", HP_TONES[tone].bar)}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${share(stage.count)}%` }}
                    transition={{ duration: 0.8, ease: hpEase, delay: reduce ? 0 : 0.1 + idx * 0.04 }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
