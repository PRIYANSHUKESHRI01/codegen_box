"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Code2, GraduationCap, LifeBuoy, Shuffle } from "lucide-react";
import { HP_TONES, HpCard, HpSectionHeader, hpEase, hpTh } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import { languageLabel } from "@/lib/judgeLanguages";
import {
  ALL,
  PAGE_SIZES,
  codingSummary,
  engagementCounts,
  rollupLanguages,
  type PageSlice,
  type SortDir,
  type SortKey,
  type SortState,
} from "@/lib/cohortInsights";
import { ENGAGEMENT_META, ENGAGEMENT_ORDER } from "./cohortProgress";
import type { CohortStudent, Engagement } from "@/types/cohort";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/* ── Practice engagement ──────────────────────────────────────────────── */

/**
 * Who is actually practising: the cohort split by how recently each student
 * submitted code, plus how many never signed in at all. Every row filters the
 * roster below it — the "who do I need to nudge" list is one click away.
 */
export function CohortEngagementCard({
  students,
  active,
  onSelect,
}: {
  students: readonly CohortStudent[];
  active: Engagement | typeof ALL;
  onSelect: (engagement: Engagement | typeof ALL) => void;
}) {
  const counts = useMemo(() => engagementCounts(students), [students]);
  const { onboarded } = useMemo(() => codingSummary(students), [students]);
  const total = students.length;

  return (
    <HpCard spotlight={false} className="flex flex-col p-4 sm:p-5">
      <HpSectionHeader title="Practice engagement" subtitle="Based on coding practice and contests — select a group to focus the roster" icon={Activity} tone="emerald" />

      <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-elevated [&>*+*]:border-l-2 [&>*+*]:border-[rgb(var(--bg-surface-rgb))]" role="img" aria-label="Engagement mix">
        {ENGAGEMENT_ORDER.map((e) =>
          counts[e] > 0 ? (
            <motion.div
              key={e}
              className={cn("h-full", HP_TONES[ENGAGEMENT_META[e].tone].fill)}
              initial={{ width: 0 }}
              animate={{ width: `${pct(counts[e], total)}%` }}
              transition={{ duration: 0.8, ease: hpEase }}
            />
          ) : null
        )}
      </div>

      <ul className="mt-4 space-y-1">
        {ENGAGEMENT_ORDER.map((e) => {
          const meta = ENGAGEMENT_META[e];
          const selected = active === e;
          return (
            <li key={e}>
              <button
                type="button"
                aria-pressed={selected}
                title={meta.hint}
                onClick={() => onSelect(selected ? ALL : e)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  selected ? "bg-indigo-500/[0.08] ring-1 ring-inset ring-indigo-500/25" : "hover:bg-elevated/70"
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", HP_TONES[meta.tone].fill)} />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold text-text-secondary">{meta.label}</span>
                    <span className="block text-3xs leading-snug text-text-muted">{meta.hint}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tabular text-3xs font-semibold text-text-muted">{pct(counts[e], total)}%</span>
                  <span className="tabular w-9 text-right text-sm font-extrabold text-primary">{counts[e]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-auto flex items-center justify-between gap-2 border-t border-border-subtle pt-3.5 text-2xs text-text-muted">
        <span>First-login onboarding answered</span>
        <span className="tabular font-bold text-primary">
          {onboarded}
          <span className="font-semibold text-text-muted"> / {total}</span>
        </span>
      </p>
    </HpCard>
  );
}

/* ── Coding languages ─────────────────────────────────────────────────── */

const LANGUAGE_ROWS_COLLAPSED = 6;

/**
 * Which languages the cohort really solves problems in — students per language,
 * how well it goes (cohort-wide acceptance), and where students are struggling —
 * so a TPO can see, say, that half the batch codes in Java but one in three of
 * them is failing, and plan a workshop accordingly. Selecting a language filters
 * the roster to the students who have submitted in it.
 */
export function CohortLanguagesCard({
  students,
  activeLanguage,
  onSelectLanguage,
  needsHelpActive,
  onToggleNeedsHelp,
}: {
  students: readonly CohortStudent[];
  activeLanguage: string;
  onSelectLanguage: (language: string) => void;
  needsHelpActive: boolean;
  onToggleNeedsHelp: () => void;
}) {
  const reduce = useReducedMotion();
  const [showAll, setShowAll] = useState(false);
  const rollup = useMemo(() => rollupLanguages(students), [students]);
  const summary = useMemo(() => codingSummary(students), [students]);
  const rows = showAll ? rollup : rollup.slice(0, LANGUAGE_ROWS_COLLAPSED);
  const widest = rollup[0]?.students ?? 0;
  const notStarted = students.length - summary.coding;

  return (
    <HpCard spotlight={false} className="flex flex-col p-4 sm:p-5 xl:col-span-2">
      <HpSectionHeader
        title="Coding languages"
        subtitle="What your students actually solve in — select one to focus the roster"
        icon={Code2}
        tone="violet"
        action={
          activeLanguage !== ALL ? (
            <button
              type="button"
              onClick={() => onSelectLanguage(ALL)}
              className="rounded-md text-2xs font-semibold text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
            >
              Clear language
            </button>
          ) : undefined
        }
      />

      {rollup.length === 0 ? (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-elevated/30 px-6 py-10 text-center">
          <Code2 className="h-6 w-6 text-text-muted" aria-hidden />
          <p className="mt-3 text-sm font-bold text-primary">No code submitted yet</p>
          <p className="mt-1 max-w-sm text-2xs leading-relaxed text-text-muted">
            Language data appears here as soon as students start solving problems in the practice arena or contests.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <ul className="space-y-1" aria-label="Languages used by your students">
            {rows.map((row) => {
              const selected = activeLanguage === row.language;
              const share = widest > 0 ? (row.students / widest) * 100 : 0;
              return (
                <li key={row.language}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectLanguage(selected ? ALL : row.language)}
                    className={cn(
                      "block w-full rounded-xl px-2.5 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      selected ? "bg-indigo-500/[0.08] ring-1 ring-inset ring-indigo-500/25" : "hover:bg-elevated/70"
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-mono text-xs font-bold text-primary">{languageLabel(row.language)}</span>
                      <span className="tabular shrink-0 text-2xs text-text-muted">
                        <span className="font-extrabold text-primary">{row.students}</span> {row.students === 1 ? "student" : "students"}
                        <span className="hidden sm:inline">
                          {" "}
                          · {row.mainly} mainly · {row.acceptanceRate}% accepted
                        </span>
                      </span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-elevated" aria-hidden>
                        <motion.span
                          className={cn("block h-full rounded-full", HP_TONES.violet.bar)}
                          initial={reduce ? false : { width: 0 }}
                          animate={{ width: `${share}%` }}
                          transition={{ duration: 0.8, ease: hpEase }}
                        />
                      </span>
                      {row.needsWork > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-px text-3xs font-bold text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
                          {row.needsWork} struggling
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
            {rollup.length > LANGUAGE_ROWS_COLLAPSED && (
              <li>
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-1 rounded-md px-2.5 py-1 text-2xs font-semibold text-indigo-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300"
                >
                  {showAll ? "Show fewer" : `Show all ${rollup.length} languages`}
                </button>
              </li>
            )}
          </ul>

          <dl className="grid grid-cols-1 content-start gap-2 self-start">
            <SignalTile
              icon={LifeBuoy}
              tone="amber"
              label="Struggling in a language"
              value={summary.needingLanguageHelp}
              hint="Enough submissions to see it's going badly"
              pressed={needsHelpActive}
              onClick={summary.needingLanguageHelp > 0 || needsHelpActive ? onToggleNeedsHelp : undefined}
            />
            <SignalTile
              icon={Shuffle}
              tone="sky"
              label="Say one, solve another"
              value={summary.mismatched}
              hint="Named a main language they rarely use"
            />
            <SignalTile icon={GraduationCap} tone="slate" label="Haven't submitted code" value={notStarted} hint="No language data yet" />
          </dl>
        </div>
      )}
    </HpCard>
  );
}

function SignalTile({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  pressed,
  onClick,
}: {
  icon: typeof Code2;
  tone: "amber" | "sky" | "slate";
  label: string;
  value: number;
  hint: string;
  pressed?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ring-1 ring-inset", HP_TONES[tone].soft)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <dt className="text-2xs font-semibold leading-tight text-text-secondary">{label}</dt>
        <dd className="mt-0.5 text-3xs leading-snug text-text-muted">{hint}</dd>
      </span>
      <span className="tabular text-lg font-extrabold text-primary">{value}</span>
    </>
  );
  const className = "flex items-start gap-2.5 rounded-xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] p-2.5 text-left";

  return onClick ? (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(className, "transition-colors hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", pressed && "border-amber-500/40 bg-amber-500/[0.06]")}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

/* ── Table header sort + paging ───────────────────────────────────────── */

/** A column header that sorts the roster — keyboard-operable, with aria-sort on the th. */
export function SortHeader({
  label,
  sortKey,
  firstDir,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  /** Direction the first click sorts in (e.g. readiness starts high → low). */
  firstDir: SortDir;
  sort: SortState;
  onSort: (key: SortKey, firstDir: SortDir) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn(hpTh, "px-4", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey, firstDir)}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 uppercase tracking-[0.08em] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          active && "text-primary"
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", !active && "opacity-50")} aria-hidden />
      </button>
    </th>
  );
}

export function CohortPagination<T>({
  slice,
  total,
  pageSize,
  onPage,
  onPageSize,
}: {
  slice: PageSlice<T>;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  if (total === 0) return null;
  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] text-text-secondary transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[rgb(var(--bg-surface-rgb))]";

  return (
    <nav aria-label="Roster pages" className="flex flex-col gap-3 border-t border-border-subtle bg-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-2xs text-text-muted" aria-live="polite">
        Showing <span className="tabular font-bold text-primary">{slice.from}–{slice.to}</span> of <span className="tabular font-bold text-primary">{total}</span>
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-2xs font-semibold text-text-muted">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 cursor-pointer rounded-lg border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-2 text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1.5">
          <button type="button" className={btn} onClick={() => onPage(slice.page - 1)} disabled={slice.page <= 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="tabular min-w-[4.5rem] text-center text-2xs font-semibold text-text-secondary">
            Page {slice.page} of {slice.pageCount}
          </span>
          <button type="button" className={btn} onClick={() => onPage(slice.page + 1)} disabled={slice.page >= slice.pageCount} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
