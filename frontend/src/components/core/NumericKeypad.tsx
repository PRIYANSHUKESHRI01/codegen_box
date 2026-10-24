"use client";

import { Delete } from "lucide-react";

/** The on-screen number pad of an online exam: digits, point, sign, exponent, backspace, clear. */
export function NumericKeypad({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const press = (key: string) => {
    if (key === "C") return onChange("");
    if (key === "⌫") return onChange(value.slice(0, -1));
    if (key === "±") return onChange(value.startsWith("-") ? value.slice(1) : `-${value}`);
    if (key === "." && /(^|[eE])[^.]*\.[^eE]*$/.test(value)) return; // one point per number part
    if (key === "E" && (value === "" || /[eE]/.test(value))) return;
    onChange(value + key);
  };

  const keys = ["7", "8", "9", "⌫", "4", "5", "6", "±", "1", "2", "3", "E", "0", ".", "C"];

  return (
    <div className="grid w-fit grid-cols-4 gap-1.5" role="group" aria-label="Number pad">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          aria-label={k === "⌫" ? "Backspace" : k === "C" ? "Clear" : k === "±" ? "Change sign" : k === "E" ? "Exponent" : k}
          className="flex h-10 w-12 items-center justify-center rounded-control border border-border-subtle bg-elevated font-mono text-sm font-bold text-primary transition-colors hover:border-accent-primary hover:text-accent-primary active:scale-95"
        >
          {k === "⌫" ? <Delete className="h-4 w-4" aria-hidden /> : k}
        </button>
      ))}
    </div>
  );
}
