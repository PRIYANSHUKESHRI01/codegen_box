"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type Cell = 0 | 1 | null;

const bitsOf = (row: number, width: number): (0 | 1)[] => Array.from({ length: width }, (_, k) => ((row >> (width - 1 - k)) & 1) as 0 | 1);

/**
 * A truth table. With `onChange` the output column is fillable: click or press Space/Enter to flip a cell, type 0 or 1 to set it and move
 * down, use the arrow keys to move. Once `solution` is given (after checking) every cell shows whether it was right. Without `onChange` it
 * just displays `values` (a "?" where a value is null).
 */
export function TruthTable({
  inputs,
  output = "Y",
  values,
  onChange,
  solution,
  disabled,
}: {
  inputs: string[];
  output?: string;
  values: Cell[];
  onChange?: (next: Cell[]) => void;
  solution?: Cell[];
  disabled?: boolean;
}) {
  const rows = 2 ** inputs.length;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const interactive = !!onChange && !disabled;

  const set = (row: number, value: Cell) => onChange?.(values.map((v, i) => (i === row ? value : v)));
  const focusRow = (row: number) => refs.current[Math.max(0, Math.min(rows - 1, row))]?.focus();

  return (
    <div className="overflow-x-auto">
      <table className="mx-auto border-collapse text-center font-mono text-sm" aria-label={`Truth table with inputs ${inputs.join(", ")} and output ${output}`}>
        <thead>
          <tr>
            {inputs.map((name) => (
              <th key={name} scope="col" className="border border-border-subtle bg-elevated px-3.5 py-1.5 font-bold text-primary">
                {name}
              </th>
            ))}
            <th scope="col" className="border border-border-strong bg-accent-primary/10 px-4 py-1.5 font-extrabold text-accent-primary">
              {output}
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => {
            const value = values[row] ?? null;
            const wrong = solution !== undefined && value !== solution[row];
            return (
              <tr key={row}>
                {bitsOf(row, inputs.length).map((bit, k) => (
                  <td key={k} className="border border-border-subtle px-3.5 py-1 text-text-secondary">
                    {bit}
                  </td>
                ))}
                <td className={cn("border border-border-strong p-0", solution !== undefined && (wrong ? "bg-status-danger/10" : "bg-status-success/10"))}>
                  {interactive ? (
                    <button
                      type="button"
                      ref={(el) => {
                        refs.current[row] = el;
                      }}
                      aria-label={`Row ${row + 1}, ${inputs.map((n, k) => `${n} ${bitsOf(row, inputs.length)[k]}`).join(", ")}: output ${value === null ? "not set" : value}`}
                      onClick={() => set(row, value === 1 ? 0 : 1)}
                      onKeyDown={(e) => {
                        if (e.key === "0" || e.key === "1") {
                          e.preventDefault();
                          set(row, Number(e.key) as 0 | 1);
                          focusRow(row + 1);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          focusRow(row + 1);
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          focusRow(row - 1);
                        } else if (e.key === "Backspace" || e.key === "Delete") {
                          e.preventDefault();
                          set(row, null);
                        }
                      }}
                      className={cn(
                        "h-9 w-full min-w-[3.25rem] px-4 font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-primary",
                        value === null ? "text-text-muted hover:bg-accent-primary/10" : "text-primary hover:bg-accent-primary/10"
                      )}
                    >
                      {value === null ? "·" : value}
                    </button>
                  ) : (
                    <span className={cn("inline-block min-w-[3.25rem] px-4 py-1 font-bold", wrong ? "text-status-danger" : "text-primary")}>
                      {value === null ? (solution !== undefined ? "–" : "?") : value}
                      {solution !== undefined && wrong && <span className="ml-1.5 text-2xs font-semibold text-status-success">→ {solution[row]}</span>}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
