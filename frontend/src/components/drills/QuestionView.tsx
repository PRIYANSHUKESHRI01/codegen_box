"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { MathMarkdown } from "@/components/core/MathMarkdown";
import { LogicCircuit } from "@/components/drills/LogicCircuit";
import { TruthTable } from "@/components/drills/TruthTable";
import { blankResponse } from "@/lib/drills/session";
import { cn } from "@/lib/utils";
import type { DrillQuestion, Response } from "@/lib/drills/types";

/**
 * One drill question: the prompt, its picture, the right kind of answer box, an optional hint — and, once checked, whether the student was
 * right with the worked solution. It owns no flow: the session decides when a question is checked and what comes next.
 */
export function QuestionView({
  question,
  response,
  onChange,
  onSubmit,
  checked,
  correct,
}: {
  question: DrillQuestion;
  response: Response;
  onChange: (next: Response) => void;
  onSubmit: () => void;
  checked: boolean;
  correct: boolean;
}) {
  const [hintOpen, setHintOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { answer } = question;

  // A new question: hide the hint and put the cursor in the box (desktop only — on a phone, focusing would throw the keyboard up unasked).
  useEffect(() => {
    setHintOpen(false);
    if (typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches) inputRef.current?.focus();
  }, [question.id]);

  // 1–4 / A–D pick a choice, for keyboard users.
  useEffect(() => {
    if (answer.kind !== "choice" || checked) return;
    const options = answer.options;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey) return;
      const index = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : "abcd".indexOf(e.key.toLowerCase());
      if (index >= 0 && index < options.length) {
        e.preventDefault();
        onChange({ choice: options[index].id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, checked, onChange]);

  const submitOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !checked) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    // data-question-id lets an end-to-end test rebuild the exact question (and so its answer) from the id
    <div className="space-y-5" data-question-id={question.id}>
      <MathMarkdown className="text-base font-medium leading-relaxed">{question.prompt}</MathMarkdown>

      {question.figure?.type === "circuit" && <LogicCircuit expr={question.figure.expr} inputs={question.figure.inputs} output={question.figure.output} />}
      {question.figure?.type === "table" && <TruthTable inputs={question.figure.inputs} output={question.figure.output} values={question.figure.values} />}

      {answer.kind === "number" && (
        <label className="block">
          <span className="sr-only">Your answer{answer.unit ? ` in ${answer.unit}` : ""}</span>
          <div className="flex max-w-sm items-stretch gap-2">
            <input
              ref={inputRef}
              value={response.number ?? ""}
              onChange={(e) => onChange({ number: e.target.value })}
              onKeyDown={submitOnEnter}
              disabled={checked}
              inputMode="decimal"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={answer.placeholder ?? "Type a number"}
              aria-invalid={checked && !correct ? true : undefined}
              className={cn(
                "min-w-0 flex-1 rounded-control border bg-surface px-3.5 py-2.5 font-mono text-base text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/25 disabled:opacity-80",
                checked ? (correct ? "border-status-success" : "border-status-danger") : "border-border-strong"
              )}
            />
            {answer.unit && <span className="flex items-center rounded-control bg-elevated px-3 text-sm font-bold text-text-secondary">{answer.unit}</span>}
          </div>
        </label>
      )}

      {answer.kind === "text" && (
        <label className="block">
          <span className="sr-only">Your answer</span>
          <input
            ref={inputRef}
            value={response.text ?? ""}
            onChange={(e) => onChange({ text: e.target.value })}
            onKeyDown={submitOnEnter}
            disabled={checked}
            maxLength={answer.maxLength}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={answer.placeholder ?? "Type your answer"}
            aria-invalid={checked && !correct ? true : undefined}
            className={cn(
              "w-full max-w-md rounded-control border bg-surface px-3.5 py-2.5 text-base text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/25 disabled:opacity-80",
              answer.mono !== false && "font-mono tracking-wide",
              checked ? (correct ? "border-status-success" : "border-status-danger") : "border-border-strong"
            )}
          />
        </label>
      )}

      {answer.kind === "choice" && (
        <div role="radiogroup" aria-label="Choose an answer" className={cn("grid gap-2.5", answer.options.every((o) => o.label.length <= 3) ? "max-w-xs grid-cols-2" : "sm:grid-cols-2")}>
          {answer.options.map((option, index) => {
            const picked = response.choice === option.id;
            const isRight = checked && option.id === question.solution.choice;
            const isWrongPick = checked && picked && !isRight;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={picked}
                disabled={checked}
                onClick={() => onChange({ choice: option.id })}
                className={cn(
                  "flex min-h-[3rem] items-center gap-3 rounded-control border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:cursor-default",
                  isRight
                    ? "border-status-success bg-status-success/10"
                    : isWrongPick
                      ? "border-status-danger bg-status-danger/10"
                      : picked
                        ? "border-accent-primary bg-accent-primary/10"
                        : "border-border-strong bg-surface hover:border-accent-primary/60 hover:bg-surface-hover"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-2xs font-extrabold",
                    isRight ? "bg-status-success text-white" : isWrongPick ? "bg-status-danger text-white" : picked ? "bg-accent-primary text-white" : "bg-elevated text-text-secondary"
                  )}
                >
                  {index + 1}
                </span>
                <MathMarkdown inline className="text-sm font-semibold">
                  {option.label}
                </MathMarkdown>
              </button>
            );
          })}
        </div>
      )}

      {answer.kind === "table" && (
        <div>
          <TruthTable
            inputs={answer.inputs}
            values={response.table ?? blankResponse(question).table ?? []}
            onChange={(table) => onChange({ table })}
            solution={checked ? question.solution.table : undefined}
            disabled={checked}
          />
          {!checked && <p className="mt-2 text-center text-2xs text-text-muted">Click a cell to flip it, or press 0 / 1 and the arrow keys.</p>}
        </div>
      )}

      {question.hint && !checked && (
        <div>
          {hintOpen ? (
            <p className="flex items-start gap-2 rounded-control border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs leading-relaxed text-text-secondary">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden />
              {question.hint}
            </p>
          ) : (
            <button type="button" onClick={() => setHintOpen(true)} className="inline-flex items-center gap-1.5 text-2xs font-bold text-text-secondary hover:text-accent-primary">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Show a hint
            </button>
          )}
        </div>
      )}

      {checked && (
        <section
          role="status"
          aria-live="polite"
          className={cn("rounded-panel border p-4", correct ? "border-status-success/40 bg-status-success/[0.07]" : "border-status-danger/40 bg-status-danger/[0.06]")}
        >
          <h3 className={cn("flex items-center gap-2 text-sm font-extrabold", correct ? "text-status-success" : "text-status-danger")}>
            {correct ? <CheckCircle2 className="h-4.5 w-4.5" aria-hidden /> : <XCircle className="h-4.5 w-4.5" aria-hidden />}
            {correct ? "Correct" : "Not quite"}
          </h3>
          {!correct && (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-text-secondary">
              <span>The answer is</span>
              <MathMarkdown inline className="text-sm">
                {question.solutionText}
              </MathMarkdown>
            </div>
          )}
          <ol className="mt-3 space-y-1.5 border-t border-border-subtle pt-3">
            {question.explanation.map((step, i) => (
              <li key={i} className="text-xs leading-relaxed text-text-secondary">
                <MathMarkdown className="text-xs text-text-secondary">{step}</MathMarkdown>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
