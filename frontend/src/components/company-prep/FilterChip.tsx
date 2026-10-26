"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FilterChip({
  active,
  disabled,
  count,
  onClick,
  activeClass,
  idleClass,
  children,
}: {
  active: boolean;
  /** Nothing would match — can't be picked (an already-picked chip can always be un-picked). */
  disabled?: boolean;
  count?: number;
  onClick: () => void;
  activeClass?: string;
  idleClass?: string;
  children: ReactNode;
}) {
  const blocked = !!disabled && !active;
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={blocked}
      onClick={onClick}
      className={cn(
        "inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-2xs font-semibold ring-1 ring-inset transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95",
        active
          ? (activeClass ?? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white ring-transparent shadow-[0_8px_18px_-8px_rgba(99,102,241,0.85)]")
          : (idleClass ?? "bg-elevated/60 text-text-secondary ring-border-subtle hover:-translate-y-px hover:bg-indigo-500/[0.07] hover:text-primary hover:ring-indigo-500/40"),
        blocked && "pointer-events-none cursor-not-allowed opacity-40"
      )}
    >
      {active && (
        <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }} className="flex">
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
        </motion.span>
      )}
      <span className="truncate">{children}</span>
      {count !== undefined && (
        <span className={cn("tabular rounded-full px-1.5 text-3xs font-bold leading-4", active ? "bg-white/25" : "bg-black/[0.06] text-text-muted dark:bg-white/10")}>{count}</span>
      )}
    </button>
  );
}

export function FacetRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <div className="flex w-24 shrink-0 items-center gap-1.5 pt-1.5 text-3xs font-bold uppercase tracking-[0.12em] text-text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">{children}</div>
    </div>
  );
}

/**
 * Phones only (hidden from md up): the Category / Year / Round chips run to a few hundred pixels, which on a small screen
 * pushes the actual content below the fold. They sit behind this button instead, with a count of what is applied.
 */
export function FiltersToggle({ open, onToggle, activeCount, controls }: { open: boolean; onToggle: () => void; activeCount: number; controls: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border-subtle bg-elevated/60 px-4 py-3 text-xs font-bold text-primary transition-colors hover:border-indigo-500/40 md:hidden"
    >
      <span className="inline-flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-text-muted" aria-hidden />
        Filter by category, year &amp; round
        {activeCount > 0 && <span className="tabular rounded-full bg-indigo-500 px-2 py-0.5 text-3xs font-extrabold text-white">{activeCount}</span>}
      </span>
      <ChevronDown className={cn("h-4 w-4 text-text-muted transition-transform duration-300", open && "rotate-180")} aria-hidden />
    </button>
  );
}
