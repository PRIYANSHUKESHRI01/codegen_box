"use client";

import { useState } from "react";
import { Calculator, X } from "lucide-react";
import { CalcError, evaluate, formatResult, type AngleMode } from "@/lib/calc";
import { cn } from "@/lib/utils";

const ROWS: { label: string; insert?: string; action?: "equals" | "clear" | "back" | "ans" | "angle" }[][] = [
  [{ label: "sin", insert: "sin(" }, { label: "cos", insert: "cos(" }, { label: "tan", insert: "tan(" }, { label: "ln", insert: "ln(" }, { label: "log", insert: "log(" }],
  [{ label: "asin", insert: "asin(" }, { label: "acos", insert: "acos(" }, { label: "atan", insert: "atan(" }, { label: "eˣ", insert: "exp(" }, { label: "√", insert: "sqrt(" }],
  [{ label: "π", insert: "pi" }, { label: "e", insert: "e" }, { label: "x²", insert: "^2" }, { label: "xʸ", insert: "^" }, { label: "n!", insert: "!" }],
  [{ label: "(", insert: "(" }, { label: ")", insert: ")" }, { label: "%", insert: "%" }, { label: "⌫", action: "back" }, { label: "C", action: "clear" }],
  [{ label: "7", insert: "7" }, { label: "8", insert: "8" }, { label: "9", insert: "9" }, { label: "÷", insert: "/" }, { label: "Ans", action: "ans" }],
  [{ label: "4", insert: "4" }, { label: "5", insert: "5" }, { label: "6", insert: "6" }, { label: "×", insert: "*" }, { label: "EXP", insert: "e" }],
  [{ label: "1", insert: "1" }, { label: "2", insert: "2" }, { label: "3", insert: "3" }, { label: "−", insert: "-" }, { label: "+", insert: "+" }],
  [{ label: "0", insert: "0" }, { label: ".", insert: "." }, { label: "±", insert: "-" }, { label: "=", action: "equals" }, { label: "", insert: undefined }],
];

/**
 * The on-screen scientific calculator an online engineering exam provides — and the only calculator a proctored
 * test allows, so the student never needs a second tab. Opens in degrees. Computes with the parser in lib/calc.ts,
 * never eval().
 */
export function ScientificCalculator({ onClose }: { onClose: () => void }) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string>("");
  const [last, setLast] = useState<number | null>(null);
  const [angle, setAngle] = useState<AngleMode>("deg");
  const [error, setError] = useState(false);

  const run = () => {
    if (!expression.trim()) return;
    try {
      const value = evaluate(expression, angle);
      setResult(formatResult(value));
      setLast(value);
      setError(false);
    } catch (err) {
      setError(true);
      setResult(err instanceof CalcError ? "Error" : "Error");
    }
  };

  const press = (key: (typeof ROWS)[number][number]) => {
    if (key.action === "equals") return run();
    if (key.action === "clear") {
      setExpression("");
      setResult("");
      setError(false);
      return;
    }
    if (key.action === "back") return setExpression((e) => e.slice(0, -1));
    if (key.action === "ans") return last !== null && setExpression((e) => e + formatResult(last));
    if (key.insert !== undefined) {
      // After a result, typing a digit starts fresh while an operator continues from the answer.
      setError(false);
      setExpression((e) => e + key.insert);
    }
  };

  return (
    <div role="dialog" aria-label="Scientific calculator" className="w-[19rem] max-w-full rounded-panel border border-border-strong bg-surface p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-text-muted"><Calculator className="h-3.5 w-3.5" aria-hidden /> Calculator</span>
        <div className="flex items-center gap-1">
          {(["deg", "rad"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={angle === m} onClick={() => setAngle(m)} className={cn("rounded px-1.5 py-0.5 text-3xs font-bold uppercase", angle === m ? "bg-accent-primary text-white" : "bg-elevated text-text-muted")}>{m}</button>
          ))}
          <button type="button" onClick={onClose} aria-label="Close calculator" className="ml-1 rounded p-0.5 text-text-muted hover:text-primary"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <input
        value={expression}
        onChange={(e) => { setExpression(e.target.value); setError(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); run(); } }}
        aria-label="Expression"
        spellCheck={false}
        autoComplete="off"
        placeholder="0"
        className="mb-1 w-full rounded-control border border-border-subtle bg-elevated px-2.5 py-2 text-right font-mono text-sm text-primary outline-none focus:border-accent-primary"
      />
      <output aria-live="polite" className={cn("tabular mb-2 block min-h-[1.75rem] text-right font-mono text-xl font-bold", error ? "text-status-danger" : "text-primary")}>{result}</output>

      <div className="grid grid-cols-5 gap-1">
        {ROWS.flat().map((key, i) =>
          key.label === "" ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              className={cn(
                "h-9 rounded-control border text-xs font-bold transition-colors active:scale-95",
                key.action === "equals" ? "col-span-1 border-transparent bg-accent-primary text-white" : /[0-9.]/.test(key.label) && key.label.length === 1 ? "border-border-subtle bg-elevated text-primary hover:border-accent-primary" : "border-border-subtle bg-surface text-text-secondary hover:border-accent-primary hover:text-accent-primary"
              )}
            >
              {key.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
