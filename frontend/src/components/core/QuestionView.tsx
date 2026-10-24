"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MathMarkdown } from "./MathMarkdown";
import { NumericKeypad } from "./NumericKeypad";
import type { CoreOption, CoreType } from "@/types/core";

interface QuestionLike {
  type: CoreType;
  stem: string;
  image_url: string | null;
  options: CoreOption[];
  numeric_unit: string | null;
}

interface Props {
  question: QuestionLike;
  selected: string[];
  numeric: string;
  onSelect: (ids: string[]) => void;
  onNumeric: (value: string) => void;
  disabled?: boolean;
  /** Practice feedback: once set, options are coloured against the key and nothing can change. */
  reveal?: { correct: string[] | null; numeric?: { min: number | null; max: number | null } };
  /** Show the on-screen number pad under a numerical answer (timed tests do; practice uses the keyboard). */
  keypad?: boolean;
}

const LETTERS = "ABCDEF";

/**
 * One question as a student answers it — shared by practice and the timed test so the two never drift:
 * the stem and figure, then either options (a single choice or several) or a number box.
 *
 * Nothing here knows the answer unless `reveal` is passed (practice, after Check).
 */
export function QuestionView({ question, selected, numeric, onSelect, onNumeric, disabled = false, reveal, keypad = false }: Props) {
  const multi = question.type === "mcq_multi";

  const toggle = (id: string) => {
    if (disabled) return;
    if (multi) onSelect(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    else onSelect(selected.includes(id) ? [] : [id]);
  };

  return (
    <div className="space-y-5">
      <MathMarkdown className="text-[15px]">{question.stem}</MathMarkdown>

      {question.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={question.image_url} alt="Figure for this question" className="max-h-72 max-w-full rounded-control border border-border-subtle bg-white object-contain" />
      )}

      {question.type === "numeric" ? (
        <div className="space-y-3">
          <label className="block text-2xs font-semibold text-text-secondary" htmlFor="core-numeric">
            Your answer {question.numeric_unit ? <span className="text-text-muted">({question.numeric_unit})</span> : null}
          </label>
          <input
            id="core-numeric"
            inputMode="decimal"
            autoComplete="off"
            value={numeric}
            disabled={disabled}
            onChange={(e) => onNumeric(e.target.value.replace(/[^0-9eE+.\-]/g, ""))}
            placeholder="Type a number"
            className={cn(
              "tabular w-full max-w-xs rounded-control border bg-elevated px-3.5 py-2.5 font-mono text-base text-primary outline-none focus:border-accent-primary",
              reveal ? (reveal.numeric && numeric !== "" && Number(numeric) >= (reveal.numeric.min ?? -Infinity) - 1e-9 && Number(numeric) <= (reveal.numeric.max ?? Infinity) + 1e-9 ? "border-status-success" : "border-status-danger") : "border-border-subtle"
            )}
          />
          {keypad && !disabled && <NumericKeypad value={numeric} onChange={onNumeric} />}
          {reveal?.numeric && (
            <p className="text-xs font-semibold text-status-success">
              Accepted answer: {reveal.numeric.min}
              {reveal.numeric.max !== null && reveal.numeric.max !== reveal.numeric.min ? ` to ${reveal.numeric.max}` : ""} {question.numeric_unit ?? ""}
            </p>
          )}
        </div>
      ) : (
        <div role={multi ? "group" : "radiogroup"} aria-label="Answer options" className="space-y-2.5">
          {multi && <p className="text-2xs font-semibold text-text-muted">Select all that apply</p>}
          {question.options.map((option, i) => {
            const chosen = selected.includes(option.id);
            const isKey = reveal?.correct?.includes(option.id) ?? false;
            const state = reveal ? (isKey ? "right" : chosen ? "wrong" : "idle") : chosen ? "chosen" : "idle";

            return (
              <button
                key={option.id}
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={chosen}
                disabled={disabled}
                onClick={() => toggle(option.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:cursor-default",
                  state === "chosen" && "border-accent-primary bg-accent-primary/10",
                  state === "right" && "border-status-success bg-status-success/10",
                  state === "wrong" && "border-status-danger bg-status-danger/10",
                  state === "idle" && "border-border-subtle bg-surface hover:border-border-strong hover:bg-elevated"
                )}
              >
                <span
                  className={cn(
                    "mt-px flex h-6 w-6 shrink-0 items-center justify-center text-2xs font-extrabold",
                    multi ? "rounded-md" : "rounded-full",
                    state === "chosen" ? "bg-accent-primary text-white" : state === "right" ? "bg-status-success text-white" : state === "wrong" ? "bg-status-danger text-white" : "bg-elevated text-text-muted"
                  )}
                >
                  {state === "right" ? <Check className="h-3.5 w-3.5" aria-hidden /> : state === "wrong" ? <X className="h-3.5 w-3.5" aria-hidden /> : LETTERS[i]}
                </span>
                <span className="min-w-0 flex-1">
                  <MathMarkdown inline>{option.text}</MathMarkdown>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
