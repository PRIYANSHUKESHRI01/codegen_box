"use client";

import { ArrowLeft, CheckCircle2, Play, Send } from "lucide-react";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import { Button } from "@/components/ui/Button";
import { ProblemDetail } from "@/types/problem";
import { formatNumber } from "@/lib/formatters";

interface ProblemHeaderBarProps {
  problem: ProblemDetail;
  onBack: () => void;
  onRun: () => void;
  onSubmit: () => void;
  running?: boolean;
  /** Overrides the back button's label — this bar is shared with the contest solve page, where "Back to Practice Arena" is simply wrong. */
  backLabel?: string;
}

export function ProblemHeaderBar({ problem, onBack, onRun, onSubmit, running = false, backLabel = "Back to Practice Arena" }: ProblemHeaderBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 sm:px-4 h-14 border-b border-border-subtle bg-surface shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1 rounded-control text-text-muted hover:text-primary hover:bg-surface-hover transition-colors shrink-0"
          aria-label={backLabel}
          title={backLabel}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="h-6 w-px bg-border-subtle shrink-0 hidden sm:block" />

        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm font-bold text-primary truncate">
              {problem.serial_number}. {problem.title}
            </h1>
            <DifficultyBadge
              difficulty={problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
              size="sm"
            />
            {problem.solved && (
              <span className="hidden sm:inline-flex items-center gap-1 text-3xs font-bold text-status-success">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Solved
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 mt-0.5">
            {problem.tags.slice(0, 3).map((tag, idx, shown) => (
              <span key={tag} className="text-3xs font-mono text-text-muted">
                {tag}
                {idx < shown.length - 1 && " ·"}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {problem.acceptance_rate !== null && (
          <span className="hidden lg:inline text-2xs font-mono text-text-muted whitespace-nowrap">
            {problem.acceptance_rate}% acceptance · {formatNumber(problem.total_submissions)} submissions
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Play className="w-3.5 h-3.5" />}
          onClick={onRun}
          disabled={running}
          isLoading={running}
        >
          Run
        </Button>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Send className="w-3.5 h-3.5" />}
          onClick={onSubmit}
          disabled={running}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
