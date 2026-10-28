"use client";

import { SELECTABLE_YEARS, yearName } from "@/lib/studyYear";
import { cn } from "@/lib/utils";

/**
 * "Which year are these students in?" - 1st to 4th year as radio chips, like the department picker beside it. `blankLabel` adds a
 * first chip meaning "none chosen" (an import whose file carries a year per row); without it a year must be picked.
 */
export function YearPicker({
  value,
  onChange,
  label = "Year of study",
  blankLabel,
  hint,
  required = false,
  className,
}: {
  /** "" = none chosen. */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  blankLabel?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  const options = [...(blankLabel ? [{ value: "", label: blankLabel }] : []), ...SELECTABLE_YEARS.map((y) => ({ value: String(y), label: yearName(y) }))];

  return (
    <div className={cn("space-y-1.5", className)}>
      <span className="text-2xs font-bold uppercase tracking-wide text-text-muted">
        {label}
        {required && (
          <span className="text-rose-500" aria-hidden>
            {" "}
            *
          </span>
        )}
      </span>
      <div role="radiogroup" aria-label={label} aria-required={required} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value || "blank"}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]",
                on
                  ? "border-transparent bg-violet-500/10 text-violet-700 ring-2 ring-violet-500/30 dark:text-violet-300"
                  : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong hover:text-primary"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="text-2xs leading-relaxed text-text-muted">{hint}</p>}
    </div>
  );
}
