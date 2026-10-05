"use client";

import { Lightbulb, ListChecks, Briefcase } from "lucide-react";
import { ProblemDetail } from "@/types/problem";
import { CompanyBadgeList } from "@/components/problems/CompanyBadge";

interface ProblemDescriptionPanelProps {
  problem: ProblemDetail;
  revealedHints: number;
  onRevealNextHint: () => void;
}

export function ProblemDescriptionPanel({
  problem,
  revealedHints,
  onRevealNextHint,
}: ProblemDescriptionPanelProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-5 sm:p-6 space-y-7 max-w-[72ch]">
        {problem.companies && problem.companies.length > 0 && (
          <div className="flex items-center gap-2.5 p-3 rounded-control bg-accent-primary/5 border border-accent-primary/20">
            <Briefcase className="w-3.5 h-3.5 text-accent-primary shrink-0" />
            <span className="text-2xs font-bold text-text-muted uppercase tracking-wide shrink-0">Asked at</span>
            <CompanyBadgeList companies={problem.companies} size="sm" />
          </div>
        )}

        <p className="text-[13.5px] text-text-secondary leading-[1.75] whitespace-pre-line">
          {problem.description}
        </p>

        {/* Examples */}
        <div className="space-y-3">
          {problem.examples.map((example, idx) => (
            <div key={idx} className="rounded-control bg-elevated/60 border border-border-subtle p-4 space-y-1.5">
              <div className="text-xs font-bold text-primary mb-1.5">Example {idx + 1}</div>
              <div className="font-mono text-13 text-text-secondary space-y-1">
                <div>
                  <span className="text-text-muted">Input: </span>
                  {example.input}
                </div>
                <div>
                  <span className="text-text-muted">Output: </span>
                  {example.output}
                </div>
                {example.explanation && (
                  <div className="pt-1.5 text-text-muted font-sans text-13 leading-relaxed">
                    <span className="font-semibold text-text-secondary">Explanation: </span>
                    {example.explanation}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Constraints */}
        {problem.constraints.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide">
              <ListChecks className="w-3.5 h-3.5 text-accent-secondary" />
              Constraints
            </h3>
            <ul className="space-y-1.5">
              {problem.constraints.map((c, idx) => (
                <li key={idx} className="font-mono text-xs text-text-secondary pl-3.5 relative">
                  <span className="absolute left-0 top-1.5 w-1 h-1 rounded-full bg-text-muted" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Hints */}
        {problem.hints.length > 0 && (
          <div className="space-y-2.5 pb-4">
            <h3 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wide">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              Hints
            </h3>
            <div className="space-y-2">
              {problem.hints.slice(0, revealedHints).map((hint, idx) => (
                <div
                  key={idx}
                  className="text-13 text-text-secondary leading-relaxed bg-amber-500/5 border border-amber-500/20 rounded-control p-3"
                >
                  <span className="font-bold text-amber-400">Hint {idx + 1}: </span>
                  {hint}
                </div>
              ))}
              {revealedHints < problem.hints.length && (
                <button
                  onClick={onRevealNextHint}
                  className="text-xs font-bold text-accent-primary hover:underline"
                >
                  Show hint {revealedHints + 1} of {problem.hints.length}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
