"use client";

import { forwardRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, ChevronDown, Layers, Radio, Search, Shapes, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hpEase } from "@/components/portal/kit";
import { SORT_OPTIONS, hasActiveFilters, type FacetOptions, type PrepFilters, type PrepSort } from "@/lib/companyPrep";
import { categoryMeta } from "./categoryMeta";
import { FacetRow, FilterChip as Chip, FiltersToggle } from "./FilterChip";

const ROUNDS_COLLAPSED = 8;

/* ── Panel ──────────────────────────────────────────────────────────────── */

export interface PyqFiltersProps {
  filters: PrepFilters;
  sort: PrepSort;
  options: FacetOptions;
  roundCounts: Map<string | number, number>;
  categoryCounts: Map<string | number, number>;
  yearCounts: Map<string | number, number>;
  /** Show the "live at my campus" switch only when some company actually has a live drive. */
  canFilterLive: boolean;
  onChange: (patch: Partial<PrepFilters>) => void;
  onSortChange: (sort: PrepSort) => void;
  onClear: () => void;
}

export const PyqFilters = forwardRef<HTMLInputElement, PyqFiltersProps>(function PyqFilters(
  { filters, sort, options, roundCounts, categoryCounts, yearCounts, canFilterLive, onChange, onSortChange, onClear },
  searchRef
) {
  const [roundsOpen, setRoundsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false); // phones only: the chip rows are tucked behind a button

  // The picked round must stay visible even when it sits past the collapsed cut-off.
  const pickedIndex = filters.round ? options.rounds.indexOf(filters.round) : -1;
  const collapsible = options.rounds.length > ROUNDS_COLLAPSED;
  const visibleRounds =
    !collapsible || roundsOpen
      ? options.rounds
      : options.rounds.slice(0, ROUNDS_COLLAPSED).concat(pickedIndex >= ROUNDS_COLLAPSED && filters.round ? [filters.round] : []);

  const active: { key: string; label: string; clear: () => void }[] = [];
  if (filters.query.trim()) active.push({ key: "q", label: `“${filters.query.trim()}”`, clear: () => onChange({ query: "" }) });
  if (filters.category) active.push({ key: "category", label: filters.category, clear: () => onChange({ category: null }) });
  if (filters.year !== null) active.push({ key: "year", label: String(filters.year), clear: () => onChange({ year: null }) });
  if (filters.round) active.push({ key: "round", label: filters.round, clear: () => onChange({ round: null }) });
  if (filters.liveOnly) active.push({ key: "live", label: "Live at my campus", clear: () => onChange({ liveOnly: false }) });

  const toggle = <K extends "round" | "category" | "year">(key: K, value: PrepFilters[K], current: PrepFilters[K]) =>
    onChange({ [key]: current === value ? null : value } as Partial<PrepFilters>);

  return (
    <div
      role="search"
      aria-label="Filter companies"
      className="relative rounded-[24px] border border-border-subtle bg-surface p-4 shadow-[var(--hp-edge),var(--hp-shadow)] sm:p-5"
    >
      {/* Search + sort + live */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="group relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-indigo-500" aria-hidden />
          <input
            ref={searchRef}
            type="text"
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Search by company, industry or round (e.g. Accenture, Versant)…"
            aria-label="Search companies"
            autoComplete="off"
            spellCheck={false}
            className="h-12 w-full rounded-2xl border border-border-subtle bg-elevated/60 pl-11 pr-12 text-sm text-primary placeholder:text-text-muted transition-all duration-200 hover:border-border-strong focus:border-indigo-500/60 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
          {filters.query ? (
            <button
              type="button"
              onClick={() => onChange({ query: "" })}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-text-muted transition-colors hover:bg-black/5 hover:text-primary dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-3xs font-semibold text-text-muted sm:block">/</kbd>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canFilterLive && (
            <button
              type="button"
              role="switch"
              aria-checked={filters.liveOnly}
              onClick={() => onChange({ liveOnly: !filters.liveOnly })}
              className={cn(
                "inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-2xl border px-4 text-xs font-semibold transition-all duration-200 active:scale-[0.97]",
                filters.liveOnly
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 shadow-[0_8px_20px_-10px_rgba(16,185,129,0.7)] dark:text-emerald-300"
                  : "border-border-subtle bg-elevated/60 text-text-secondary hover:border-emerald-500/40 hover:text-primary"
              )}
            >
              <Radio className="h-4 w-4" aria-hidden />
              Live at my campus
              <span aria-hidden className={cn("relative h-5 w-9 rounded-full transition-colors duration-200", filters.liveOnly ? "bg-emerald-500" : "bg-border-strong")}>
                <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-200", filters.liveOnly ? "left-[18px]" : "left-0.5")} />
              </span>
            </button>
          )}

          <label className="relative inline-flex h-12 items-center gap-2 rounded-2xl border border-border-subtle bg-elevated/60 pl-4 pr-3 text-xs font-semibold text-text-secondary transition-colors focus-within:border-indigo-500/60 hover:border-border-strong">
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-text-muted">Sort</span>
            <select
              value={sort}
              onChange={(e) => onSortChange(e.target.value as PrepSort)}
              aria-label="Sort companies"
              className="cursor-pointer appearance-none bg-transparent pr-6 text-xs font-bold text-primary outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-text-muted" aria-hidden />
          </label>
        </div>
      </div>

      {/* Facets */}
      <div className="mt-4 md:hidden">
        <FiltersToggle
          open={filtersOpen}
          onToggle={() => setFiltersOpen((v) => !v)}
          activeCount={[filters.round, filters.category, filters.year].filter((x) => x !== null).length}
          controls="pyq-hub-facets"
        />
      </div>

      <div id="pyq-hub-facets" className={cn("mt-5 space-y-4 border-t border-border-subtle pt-5", !filtersOpen && "hidden md:block")}>
        {options.categories.length > 0 && (
          <FacetRow icon={Shapes} label="Category">
            <Chip active={filters.category === null} onClick={() => onChange({ category: null })}>
              All
            </Chip>
            {options.categories.map((cat) => {
              const meta = categoryMeta(cat);
              const Icon = meta.icon;
              const n = categoryCounts.get(cat) ?? 0;
              return (
                <Chip
                  key={cat}
                  active={filters.category === cat}
                  disabled={n === 0}
                  count={n}
                  activeClass={meta.solid}
                  idleClass={cn(meta.soft, "hover:-translate-y-px hover:brightness-95 dark:hover:brightness-125")}
                  onClick={() => toggle("category", cat, filters.category)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.3} aria-hidden />
                    {cat}
                  </span>
                </Chip>
              );
            })}
          </FacetRow>
        )}

        {options.years.length > 0 && (
          <FacetRow icon={CalendarRange} label="Year">
            <Chip active={filters.year === null} onClick={() => onChange({ year: null })}>
              All years
            </Chip>
            {options.years.map((y) => {
              const n = yearCounts.get(y) ?? 0;
              return (
                <Chip
                  key={y}
                  active={filters.year === y}
                  disabled={n === 0}
                  count={n}
                  activeClass="bg-gradient-to-r from-sky-500 to-indigo-500 text-white ring-transparent shadow-[0_8px_18px_-8px_rgba(14,165,233,0.85)]"
                  onClick={() => toggle("year", y, filters.year)}
                >
                  {y}
                </Chip>
              );
            })}
          </FacetRow>
        )}

        {options.rounds.length > 0 && (
          <FacetRow icon={Layers} label="Round">
            <Chip active={filters.round === null} onClick={() => onChange({ round: null })}>
              All rounds
            </Chip>
            <AnimatePresence initial={false}>
              {visibleRounds.map((r) => {
                const n = roundCounts.get(r) ?? 0;
                return (
                  <motion.span key={r} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25, ease: hpEase }} className="max-w-full">
                    <Chip
                      active={filters.round === r}
                      disabled={n === 0}
                      count={n}
                      activeClass="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white ring-transparent shadow-[0_8px_18px_-8px_rgba(139,92,246,0.85)]"
                      onClick={() => toggle("round", r, filters.round)}
                    >
                      {r}
                    </Chip>
                  </motion.span>
                );
              })}
            </AnimatePresence>
            {collapsible && (
              <button
                type="button"
                onClick={() => setRoundsOpen((v) => !v)}
                aria-expanded={roundsOpen}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-2xs font-bold text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300"
              >
                {roundsOpen ? "Show fewer" : `Show all ${options.rounds.length}`}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", roundsOpen && "rotate-180")} aria-hidden />
              </button>
            )}
          </FacetRow>
        )}
      </div>

      {/* Active filters */}
      <AnimatePresence initial={false}>
        {hasActiveFilters(filters) && (
          <motion.div
            key="active"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: hpEase }}
            className="overflow-hidden"
          >
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
              <span className="text-3xs font-bold uppercase tracking-[0.12em] text-text-muted">Active</span>
              <AnimatePresence initial={false}>
                {active.map((a) => (
                  <motion.button
                    key={a.key}
                    type="button"
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    onClick={a.clear}
                    aria-label={`Remove filter ${a.label}`}
                    className="group inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-indigo-500/10 py-1 pl-3 pr-1.5 text-2xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-500/25 transition-colors hover:bg-rose-500/10 hover:text-rose-700 hover:ring-rose-500/30 dark:text-indigo-300 dark:hover:text-rose-300"
                  >
                    <span className="truncate">{a.label}</span>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500/15 transition-colors group-hover:bg-rose-500/20">
                      <X className="h-3 w-3" strokeWidth={3} />
                    </span>
                  </motion.button>
                ))}
              </AnimatePresence>
              <button
                type="button"
                onClick={onClear}
                className="ml-auto cursor-pointer rounded-full px-3 py-1 text-2xs font-bold text-text-secondary transition-colors hover:bg-black/5 hover:text-primary dark:hover:bg-white/10"
              >
                Clear all
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
