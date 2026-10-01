"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_COLORS, type QuestionCategory, type QuestionDifficulty } from "@/types/interview";
import { categoryWeightsSum, type RoundConfig } from "@/types/interviewTrack";

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as QuestionCategory[];
const DIFFICULTIES: QuestionDifficulty[] = ["easy", "medium", "hard"];

/**
 * One round's config sub-form — question count, difficulty, and a
 * category-weight editor that must sum to exactly 100 before the parent
 * (RoleTemplateModal) will let the whole template save. Reused 3x, once per
 * round.
 */
export function RoundConfigEditor({ round, onChange }: { round: RoundConfig; onChange: (round: RoundConfig) => void }) {
  const sum = categoryWeightsSum(round.category_weights);
  const isValid = sum === 100 && Object.keys(round.category_weights).length > 0;

  const toggleCategory = (c: QuestionCategory) => {
    const next = { ...round.category_weights };
    if (c in next) {
      delete next[c];
    } else {
      next[c] = 0;
    }
    onChange({ ...round, category_weights: next });
  };

  const setWeight = (c: QuestionCategory, weight: number) => {
    onChange({ ...round, category_weights: { ...round.category_weights, [c]: Math.max(0, Math.min(100, weight)) } });
  };

  return (
    <div className="rounded-control border border-border-subtle bg-elevated/60 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="w-6 h-6 rounded-full bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-[10.5px] font-bold text-accent-primary shrink-0">
          {round.round_number}
        </span>
        <input
          value={round.round_name}
          onChange={(e) => onChange({ ...round, round_name: e.target.value })}
          placeholder="Round name"
          className="flex-1 px-2.5 py-1.5 rounded-control bg-surface border border-border-subtle text-xs font-bold text-primary outline-none focus:border-accent-primary"
        />
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div>
          <label className="block text-3xs font-semibold text-text-secondary mb-1">Questions</label>
          <input
            type="number"
            min={1}
            max={20}
            value={round.question_count}
            onChange={(e) => onChange({ ...round, question_count: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
            className="w-full px-2.5 py-1.5 rounded-control bg-surface border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
          />
        </div>
        <div>
          <label className="block text-3xs font-semibold text-text-secondary mb-1">Difficulty</label>
          <select
            value={round.difficulty}
            onChange={(e) => onChange({ ...round, difficulty: e.target.value as QuestionDifficulty })}
            className="w-full px-2.5 py-1.5 rounded-control bg-surface border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary capitalize"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-3xs font-semibold text-text-secondary mb-1">Qualifying score %</label>
          <input
            type="number"
            min={1}
            max={100}
            value={round.qualifying_score_percent}
            onChange={(e) => onChange({ ...round, qualifying_score_percent: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
            className="w-full px-2.5 py-1.5 rounded-control bg-surface border border-border-subtle text-xs text-primary outline-none focus:border-accent-primary"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-3xs font-semibold text-text-secondary">Category weights</label>
          <span
            className={cn(
              "flex items-center gap-1 text-3xs font-bold",
              isValid ? "text-status-success" : "text-status-danger"
            )}
          >
            {isValid ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            Total: {sum}%
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((c) => {
            const included = c in round.category_weights;
            return (
              <div
                key={c}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-control border text-[10.5px] font-bold transition-colors",
                  included ? CATEGORY_COLORS[c] : "bg-surface border-border-subtle text-text-muted"
                )}
              >
                <button type="button" onClick={() => toggleCategory(c)}>
                  {CATEGORY_LABELS[c]}
                </button>
                {included && (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={round.category_weights[c] ?? 0}
                    onChange={(e) => setWeight(c, Number(e.target.value) || 0)}
                    className="w-11 px-1 py-0.5 rounded bg-surface/80 border border-current/30 text-center outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
