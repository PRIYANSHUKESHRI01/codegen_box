"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, type AttachedInterviewQuestion, type QuestionCategory } from "@/types/interview";
import { roundCategoryTargets, type RoundConfig } from "@/types/interviewTrack";

/**
 * Shows "Technical: 6 needed, 2 generated" per category next to a round's
 * (unchanged) GenerateQuestionsPanel — GenerateQuestionsPanel only ever
 * generates from ONE category split evenly across however many are
 * checked, so hitting a weighted target like 60/40 means running it once
 * per category. This is purely a reading aid for that; it never calls the
 * generation API itself.
 */
export function RoundQuestionTargetChecklist({
  round,
  attachedQuestions,
}: {
  round: Pick<RoundConfig, "category_weights" | "question_count">;
  attachedQuestions: AttachedInterviewQuestion[];
}) {
  const targets = roundCategoryTargets(round as RoundConfig);
  const attachedByCategory = attachedQuestions.reduce<Partial<Record<QuestionCategory, number>>>((acc, q) => {
    const c = q.question_bank.category;
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(targets).map(([category, needed]) => {
        const have = attachedByCategory[category as QuestionCategory] ?? 0;
        const met = have >= (needed ?? 0);
        return (
          <div
            key={category}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-control border text-[10.5px] font-semibold",
              met ? "bg-status-success/10 border-status-success/25 text-status-success" : "bg-elevated border-border-subtle text-text-secondary"
            )}
          >
            {met ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            {CATEGORY_LABELS[category as QuestionCategory]}: {have}/{needed} generated
          </div>
        );
      })}
    </div>
  );
}
