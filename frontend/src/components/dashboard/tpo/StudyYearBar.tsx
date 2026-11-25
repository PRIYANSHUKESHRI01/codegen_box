"use client";

import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const YEAR_NAMES: Record<number, string> = {
  0: "Unassigned",
  1: "1st Year",
  2: "2nd Year",
  3: "3rd Year",
  4: "4th Year",
  5: "Passed Out",
};

export function StudyYearBar({
  availableYears,
  value,
  onChange,
  className,
}: {
  availableYears?: { year: number; count: number }[];
  value: number | null;
  onChange: (year: number | null) => void;
  className?: string;
}) {
  const options =
    availableYears && availableYears.length > 0
      ? availableYears.filter((y) => y.count > 0)
      : [
          { year: 4, count: 0 },
          { year: 3, count: 0 },
          { year: 2, count: 0 },
          { year: 1, count: 0 },
        ];

  if (options.length === 0) return null;

  return (
    <div
      className={cn("inline-flex flex-wrap items-center gap-1 rounded-xl border border-border-subtle bg-elevated/50 p-1", className)}
      role="group"
      aria-label="Filter by student batch year"
    >
      <span className="inline-flex items-center gap-1 px-2 text-3xs font-bold uppercase tracking-wider text-text-muted">
        <Calendar className="h-3 w-3" />
        Batch
      </span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "rounded-lg px-2.5 py-1 text-2xs font-bold transition-colors",
          value === null ? "bg-indigo-600 text-white shadow-sm" : "text-text-secondary hover:bg-elevated hover:text-primary"
        )}
      >
        All Years
      </button>
      {options.map((opt) => (
        <button
          key={opt.year}
          type="button"
          onClick={() => onChange(opt.year)}
          className={cn(
            "tabular rounded-lg px-2.5 py-1 text-2xs font-bold transition-colors",
            value === opt.year ? "bg-indigo-600 text-white shadow-sm" : "text-text-secondary hover:bg-elevated hover:text-primary"
          )}
        >
          {YEAR_NAMES[opt.year] ?? `Year ${opt.year}`}
          {opt.count > 0 && <span className={cn("ml-1 text-3xs", value === opt.year ? "text-indigo-100" : "text-text-muted")}>({opt.count})</span>}
        </button>
      ))}
    </div>
  );
}
