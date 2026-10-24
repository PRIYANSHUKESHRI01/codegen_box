"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { disciplineStyle, SCOPE_ALL, SCOPE_UNMATCHED, useBranchCatalog, type BranchedRow } from "@/lib/branches";

/**
 * The branch switcher for a college dashboard: All · CSE / IT · ECE · EEE · Mech · Civil · Other · Not matched yet.
 * Only offers what the roster really contains, and renders nothing for a single-branch college — there
 * is nothing to switch between. `students` is the FULL roster (counts are never affected by the scope itself).
 */
export function BranchScopeBar({ students, value, onChange, className }: { students: readonly BranchedRow[]; value: string; onChange: (scope: string) => void; className?: string }) {
  const catalog = useBranchCatalog();

  const chips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of students) counts.set(s.discipline ?? SCOPE_UNMATCHED, (counts.get(s.discipline ?? SCOPE_UNMATCHED) ?? 0) + 1);

    const known = (catalog?.disciplines ?? []).filter((d) => counts.has(d.code)).map((d) => ({ value: d.code, label: d.short, count: counts.get(d.code) ?? 0, code: d.code }));
    const unmatched = counts.get(SCOPE_UNMATCHED);
    return unmatched ? [...known, { value: SCOPE_UNMATCHED, label: "Not matched yet", count: unmatched, code: "other" as const }] : known;
  }, [students, catalog]);

  if (chips.length < 2) return null;

  return (
    <div role="group" aria-label="Show data for a branch" className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {[{ value: SCOPE_ALL, label: "All branches", count: students.length, code: null as string | null }, ...chips].map((chip) => {
        const on = value === chip.value;
        const style = chip.code ? disciplineStyle(catalog, chip.code) : null;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(chip.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-2xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95",
              on ? "border-transparent bg-accent-primary text-white shadow-subtle" : "border-border-strong bg-elevated text-text-secondary hover:text-primary"
            )}
          >
            {style && <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-white" : style.dot)} aria-hidden />}
            {chip.label}
            <span className={cn("tabular", on ? "opacity-80" : "text-text-muted")}>{chip.count}</span>
          </button>
        );
      })}
    </div>
  );
}
