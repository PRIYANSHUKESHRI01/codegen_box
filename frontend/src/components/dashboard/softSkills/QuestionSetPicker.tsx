"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDot, Clock, Library, ListChecks, Search, SearchX, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DEFAULT_PER_PAGE, describeUsage, shortDate, type PerPage } from "@/lib/softSkillSets";
import { CATEGORY_LABELS, CATEGORY_ORDER, type QuestionSetCatalogue, type QuestionSetItem, type QuestionSetUsageFilter } from "@/types/softSkill";
import { ListPagination } from "./ListPagination";

interface QuestionSetPickerProps {
  /** e.g. "/tpo/soft-skill-question-sets" — each role talks to its own endpoint, which is what scopes the "already used" markers to that role. */
  catalogueUrl: string;
  /** The chosen set (null = none). Held by the parent so it survives paging and searching in here. */
  selected: QuestionSetItem | null;
  onSelect: (set: QuestionSetItem | null) => void;
  /** Sets that cannot be picked again — e.g. already part of the test being edited. */
  disabledIds?: number[];
  /** Why they are disabled, shown on the row. */
  disabledReason?: string;
  /** Read-only browsing (no selection), e.g. the Mellow Ops library view. */
  browseOnly?: boolean;
  /** Max height of the scrolling list. */
  listClassName?: string;
}

const FILTERS: { id: QuestionSetUsageFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unused", label: "Not used yet" },
  { id: "used", label: "Used before" },
];

/**
 * The scheduler's view of the AptRun question-set library: every ready-made set, one page at a time
 * (20, or "Show all"), searchable, with a marker on each set that this college / company / team has
 * already built a test from — so the next test can start from a fresh one. The markers come from the
 * caller's own endpoint, so one organisation never sees another's history.
 */
export function QuestionSetPicker({ catalogueUrl, selected, onSelect, disabledIds = [], disabledReason = "Already in this test", browseOnly = false, listClassName }: QuestionSetPickerProps) {
  const [filter, setFilter] = useState<QuestionSetUsageFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<PerPage>(DEFAULT_PER_PAGE);
  const [data, setData] = useState<QuestionSetCatalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const listTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchText.trim() === query.trim()) return;
    const timer = window.setTimeout(() => {
      setQuery(searchText);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText, query]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ per_page: String(perPage), page: String(perPage === "all" ? 1 : page) });
    if (query.trim()) params.set("q", query.trim());
    if (filter !== "all") params.set("usage", filter);
    try {
      const res = await api.get<QuestionSetCatalogue>(`${catalogueUrl}?${params.toString()}`);
      if (id !== requestId.current) return;
      setData(res);
      if (res.meta.page !== page && perPage !== "all") setPage(res.meta.page);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof ApiError ? err.message : "Failed to load the question sets.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [catalogueUrl, filter, page, perPage, query]);

  useEffect(() => {
    load();
  }, [load]);

  const sets = data?.sets ?? [];
  const selectedId = selected?.id ?? null;
  const selectedUsage = selected && selected.usage.state !== "unused" ? describeUsage(selected.usage) : "";
  const filtersActive = query.trim() !== "" || filter !== "all";

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter sets by whether you have used them" className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const count = data ? (f.id === "all" ? data.counts.all : f.id === "used" ? data.counts.used : data.counts.unused) : null;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                  filter === f.id ? "border-accent-primary/40 bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-surface text-text-muted hover:text-primary"
                )}
              >
                {f.label}
                {count !== null && <span className="tabular rounded-full bg-elevated px-1.5 py-px text-3xs font-bold text-text-muted">{count}</span>}
              </button>
            );
          })}
        </div>
        <label className="relative block w-full sm:w-60">
          <span className="sr-only">Search question sets</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search — e.g. 12"
            maxLength={100}
            className="h-9 w-full rounded-control border border-border-strong bg-surface pl-8 pr-8 text-xs text-primary outline-none placeholder:text-text-muted focus:border-accent-primary/60"
          />
          {searchText && (
            <button type="button" onClick={() => setSearchText("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-text-muted hover:text-primary">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </label>
      </div>

      <div ref={listTop} />

      {/* The list */}
      {error && !data ? (
        <div role="alert" className="space-y-2 rounded-panel border border-border-subtle bg-elevated/40 p-6 text-center">
          <AlertTriangle className="mx-auto h-5 w-5 text-status-danger" aria-hidden />
          <p className="text-xs text-status-danger">{error}</p>
          <button type="button" onClick={load} className="rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white hover:bg-accent-primary-hover">
            Try again
          </button>
        </div>
      ) : !data && loading ? (
        <div className="space-y-2" role="status" aria-label="Loading question sets">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[62px] animate-pulse rounded-xl border border-border-subtle bg-elevated/40" />
          ))}
        </div>
      ) : sets.length === 0 ? (
        <div className="space-y-2 rounded-panel border border-dashed border-border-subtle p-8 text-center">
          {filtersActive ? <SearchX className="mx-auto h-6 w-6 text-text-muted" aria-hidden /> : <Library className="mx-auto h-6 w-6 text-text-muted" aria-hidden />}
          <p className="text-xs font-bold text-primary">{filtersActive ? "No sets match" : "No question sets are available yet"}</p>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setSearchText("");
                setQuery("");
                setPage(1);
              }}
              className="text-2xs font-bold text-accent-primary hover:underline"
            >
              Clear search and filter
            </button>
          )}
        </div>
      ) : (
        <div aria-busy={loading} className={cn("space-y-3 transition-opacity", loading && "opacity-60")}>
          <ul role={browseOnly ? "list" : "radiogroup"} aria-label="AptRun question sets" className={cn("space-y-2", listClassName)}>
            {sets.map((set) => (
              <SetRow
                key={set.id}
                set={set}
                selected={set.id === selectedId}
                disabled={disabledIds.includes(set.id)}
                disabledReason={disabledReason}
                browseOnly={browseOnly}
                onSelect={() => onSelect(set.id === selectedId ? null : set)}
              />
            ))}
          </ul>

          {/* A heads-up, not a block: reusing a set is allowed, but the person should know they are doing it. */}
          {selectedUsage && !browseOnly && (
            <p role="status" className="flex items-start gap-2 rounded-control border border-status-warning/30 bg-status-warning/5 px-3 py-2 text-2xs leading-relaxed text-text-secondary">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden />
              <span>
                <strong className="text-primary">{selected?.label}</strong> has been used before — {selectedUsage}. Anyone who took that test will see the same questions again. Pick a set marked <em>Not used yet</em> to avoid that.
              </span>
            </p>
          )}

          {data && <ListPagination meta={data.meta} noun="sets" busy={loading} onPage={(p) => setPage(p)} onPerPage={(pp) => { setPerPage(pp); setPage(1); }} />}
        </div>
      )}
    </div>
  );
}

function SetRow({
  set,
  selected,
  disabled,
  disabledReason,
  browseOnly,
  onSelect,
}: {
  set: QuestionSetItem;
  selected: boolean;
  disabled: boolean;
  disabledReason: string;
  browseOnly: boolean;
  onSelect: () => void;
}) {
  const used = set.usage.state !== "unused";
  const usageText = describeUsage(set.usage);
  const body = (
    <>
      {!browseOnly && (
        <span
          aria-hidden
          className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-accent-primary bg-accent-primary text-white" : "border-border-strong bg-surface")}
        >
          {selected && <CircleDot className="h-3 w-3" />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-bold text-primary">{set.label}</span>
          <span className="flex items-center gap-1 text-2xs text-text-muted">
            <ListChecks className="h-3 w-3" aria-hidden />
            {set.question_count} questions
          </span>
          <span className="flex items-center gap-1 text-2xs text-text-muted">
            <Clock className="h-3 w-3" aria-hidden />
            {set.duration_minutes} min
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {CATEGORY_ORDER.filter((cat) => set.category_composition[cat]).map((cat) => (
            <span key={cat} className="rounded-full bg-elevated px-1.5 py-px text-3xs font-semibold text-text-muted">
              {set.category_composition[cat]} {CATEGORY_LABELS[cat].split(" ")[0]}
            </span>
          ))}
        </div>
      </div>
      <div className="max-w-[46%] shrink-0 text-right">
        {disabled ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-3xs font-bold text-text-muted">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            {disabledReason}
          </span>
        ) : used ? (
          <span
            title={set.usage.tests.map((t) => `${t.title} (${t.status ?? "deleted"}${t.added_at ? `, added ${shortDate(t.added_at)}` : ""})`).join("\n")}
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-3xs font-bold",
              set.usage.state === "published" ? "bg-status-warning/15 text-status-warning" : "bg-elevated text-text-secondary"
            )}
          >
            {set.usage.state === "published" ? "Already published" : set.usage.state === "draft" ? "In a draft" : "Used · cancelled"}
          </span>
        ) : (
          <span className="inline-block rounded-full bg-status-success/10 px-2 py-0.5 text-3xs font-bold text-status-success">Not used yet</span>
        )}
        {used && !disabled && <p className="mt-1 line-clamp-2 text-3xs leading-snug text-text-muted">{usageText}</p>}
      </div>
    </>
  );

  const frame = cn(
    "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
    selected ? "border-accent-primary/50 bg-accent-primary/5" : "border-border-subtle bg-surface",
    !browseOnly && !disabled && "hover:border-border-strong hover:bg-elevated/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
    disabled && "opacity-60"
  );

  return (
    <li>
      {browseOnly || disabled ? (
        <div className={frame}>{body}</div>
      ) : (
        <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={frame}>
          {body}
        </button>
      )}
    </li>
  );
}
