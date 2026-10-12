"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { languageLabel, orderedLanguageIds } from "@/lib/judgeLanguages";

/** Languages per column in the open list; with the 19 we have that is the 8 / 8 / 3 layout LeetCode shows. */
const PER_COLUMN = 8;

interface LanguagePickerProps {
  value: string;
  options: string[];
  onChange: (language: string) => void;
}

/**
 * The language picker: a button showing the current language that opens a multi-column list with a check
 * on the selected one (replacing a native <select>, whose single long list doesn't scale to 19 languages).
 *
 * Keyboard: Enter/Space/ArrowDown on the button opens it onto the current language; Arrow keys, Home and End
 * move through the list in reading order (down a column, then across); Enter/Space picks; Escape or a click
 * outside closes and hands focus back to the button. The list is a dark popover whatever the site theme,
 * because it sits over the always-dark editor.
 */
export function LanguagePicker({ value, options, onChange }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  const ids = useMemo(() => orderedLanguageIds(options), [options]);
  const columns = useMemo(() => {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += PER_COLUMN) chunks.push(ids.slice(i, i + PER_COLUMN));
    return chunks;
  }, [ids]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Focus the current language when the list opens, so the keyboard starts where the student is.
  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, ids.indexOf(value));
    itemRefs.current[index]?.focus();
  }, [open, ids, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, close]);

  const onListKeyDown = (event: React.KeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const last = ids.length - 1;
    const move = (to: number) => {
      event.preventDefault();
      itemRefs.current[Math.min(last, Math.max(0, to))]?.focus();
    };

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        return move(current + 1);
      case "ArrowUp":
      case "ArrowLeft":
        return move(current - 1);
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "Escape":
        event.preventDefault();
        return close(true);
      case "Tab":
        return close(false);
    }
  };

  const choose = (id: string) => {
    onChange(id);
    close(true);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-elevated border border-border-subtle text-xs font-semibold text-primary outline-none hover:border-accent-primary focus-visible:border-accent-primary transition-colors"
      >
        {languageLabel(value)}
        <ChevronDown className={cn("w-3.5 h-3.5 text-text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Programming language"
          onKeyDown={onListKeyDown}
          className="absolute left-0 top-full mt-1.5 z-40 max-h-[70vh] overflow-auto rounded-lg border border-white/10 bg-[#2b2b2b] p-2 shadow-2xl flex flex-col sm:flex-row"
        >
          {columns.map((column, columnIndex) => (
            <div
              key={columnIndex}
              className={cn("min-w-[9.5rem] sm:min-w-[11rem]", columnIndex > 0 && "sm:border-l sm:border-white/10 sm:ml-1 sm:pl-1")}
            >
              {column.map((id, rowIndex) => {
                const index = columnIndex * PER_COLUMN + rowIndex;
                const selected = id === value;
                return (
                  <button
                    key={id}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => choose(id)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-white/90 outline-none hover:bg-white/10 focus-visible:bg-white/10"
                  >
                    <Check className={cn("w-4 h-4 shrink-0", selected ? "text-white" : "invisible")} aria-hidden />
                    {languageLabel(id)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
