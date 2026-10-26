"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { AlertCircle, RefreshCw, SearchX } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { HpSkeleton, hpEase } from "@/components/portal/kit";
import { CompanyCard } from "@/components/company-prep/CompanyCard";
import { PyqFilters } from "@/components/company-prep/PyqFilters";
import { PyqHero } from "@/components/company-prep/PyqHero";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import {
  DEFAULT_SORT,
  NO_FILTERS,
  facetCounts,
  facetOptions,
  filterCompanies,
  filterSearch,
  hasActiveFilters,
  matchingQuestionCount,
  parseFilterSearch,
  sanitizeFilters,
  sortCompanies,
  summarizeCatalogue,
  type PrepFilters,
  type PrepSort,
} from "@/lib/companyPrep";
import type { CompanyPrepSummary } from "@/types/companyPrep";

type LoadState = "loading" | "ready" | "error";

/** The URL the page was opened with ("?round=…&year=…") — read once, so Back from a company lands on the same filtered view. */
const fromUrl = () => parseFilterSearch(typeof window === "undefined" ? "" : window.location.search);

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-border-subtle bg-surface shadow-[var(--hp-edge),var(--hp-shadow)]" aria-hidden>
      <HpSkeleton className="h-[92px] w-full rounded-none" />
      <div className="space-y-4 px-6 pb-6">
        <HpSkeleton className="-mt-9 h-16 w-36 rounded-2xl" />
        <div className="space-y-2">
          <HpSkeleton className="h-5 w-1/2" />
          <HpSkeleton className="h-3 w-1/3" />
        </div>
        <HpSkeleton className="h-3 w-full" />
        <HpSkeleton className="h-3 w-4/5" />
        <div className="grid grid-cols-3 gap-2.5">
          <HpSkeleton className="h-[70px] rounded-2xl" />
          <HpSkeleton className="h-[70px] rounded-2xl" />
          <HpSkeleton className="h-[70px] rounded-2xl" />
        </div>
        <div className="flex gap-2">
          <HpSkeleton className="h-6 w-20 rounded-full" />
          <HpSkeleton className="h-6 w-24 rounded-full" />
          <HpSkeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex justify-between border-t border-border-subtle pt-4">
          <HpSkeleton className="h-5 w-28" />
          <HpSkeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function Notice({
  icon: Icon,
  tone,
  title,
  children,
  actions,
}: {
  icon: typeof SearchX;
  tone: "indigo" | "rose";
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const ring = tone === "rose" ? "border-rose-500/20 bg-rose-500/[0.04]" : "border-border-subtle bg-surface";
  const tile = tone === "rose" ? "from-rose-400 to-red-600 shadow-[0_10px_24px_-8px_rgba(244,63,94,0.7)]" : "from-indigo-500 to-violet-600 shadow-[0_10px_24px_-8px_rgba(99,102,241,0.7)]";
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: hpEase }}
      role={tone === "rose" ? "alert" : undefined}
      className={`relative overflow-hidden rounded-[24px] border px-6 py-14 text-center shadow-[var(--hp-edge),var(--hp-shadow)] ${ring}`}
    >
      <div aria-hidden className="hp-dots pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(55%_70%_at_50%_30%,#000,transparent)]" />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <div className="relative mb-6 flex items-center justify-center">
          <span aria-hidden className="absolute h-28 w-28 rounded-full border border-indigo-500/10" />
          <span aria-hidden className="absolute h-20 w-20 rounded-full border border-indigo-500/15 bg-indigo-500/[0.04]" />
          <span className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white ring-1 ring-inset ring-white/25 ${tile}`}>
            <Icon className="h-6 w-6" strokeWidth={2.2} aria-hidden />
          </span>
        </div>
        <h3 className="text-lg font-bold tracking-tight text-primary">{title}</h3>
        {children && <div className="mt-2 text-13 leading-relaxed text-text-muted">{children}</div>}
        {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">{actions}</div>}
      </div>
    </motion.div>
  );
}

const PRIMARY_BTN =
  "hp-btn-sheen inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-b from-indigo-500 to-violet-600 px-4 text-13 font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_20px_-8px_rgba(79,70,229,0.75)] transition-all duration-200 hover:-translate-y-px active:scale-[0.97]";
const GHOST_BTN =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 text-13 font-semibold text-primary transition-all duration-200 hover:-translate-y-px hover:border-indigo-500/40 active:scale-[0.97]";

export default function CompanyPrepHubPage() {
  const { status: authStatus } = useAuthGuard(["user"]);

  const [state, setState] = useState<LoadState>("loading");
  const [companies, setCompanies] = useState<CompanyPrepSummary[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<PrepFilters>(() => fromUrl().filters);
  const [sort, setSort] = useState<PrepSort>(() => fromUrl().sort);

  const filtersRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authStatus !== "ready") return;
    let cancelled = false;
    setState("loading");

    api
      .get<{ companies: CompanyPrepSummary[] }>("/company-prep")
      .then((res) => {
        if (cancelled) return;
        const list = res.companies ?? [];
        setCompanies(list);
        // A link or bookmark can name a round / year this catalogue doesn't have — drop it rather than show an empty page.
        setFilters((prev) => sanitizeFilters(prev, facetOptions(list)));
        setState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setCompanies([]);
        setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, reloadKey]);

  // Keep the address bar in step with the filters (no navigation, no history entries).
  useEffect(() => {
    if (state !== "ready" || typeof window === "undefined") return;
    const next = `${window.location.pathname}${filterSearch(filters, sort)}${window.location.hash}`;
    const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== now) window.history.replaceState(window.history.state, "", next);
  }, [filters, sort, state]);

  // "/" jumps to search, the way most search-first sites do.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const patchFilters = useCallback((patch: Partial<PrepFilters>) => setFilters((prev) => ({ ...prev, ...patch })), []);
  const clearFilters = useCallback(() => setFilters(NO_FILTERS), []);

  const options = useMemo(() => facetOptions(companies), [companies]);
  const summary = useMemo(() => summarizeCatalogue(companies), [companies]);
  const results = useMemo(() => sortCompanies(filterCompanies(companies, filters), sort, filters), [companies, filters, sort]);

  const roundCounts = useMemo(() => facetCounts(companies, filters, "round"), [companies, filters]);
  const categoryCounts = useMemo(() => facetCounts(companies, filters, "category"), [companies, filters]);
  const yearCounts = useMemo(() => facetCounts(companies, filters, "year"), [companies, filters]);

  const matchingQuestions = useMemo(
    () => results.reduce((sum, c) => sum + (matchingQuestionCount(c, filters) ?? c.prep_questions_count), 0),
    [results, filters]
  );

  const browse = useCallback(() => {
    filtersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 450);
  }, []);

  if (authStatus !== "ready") {
    return <SessionLoader label="Loading company PYQs and prep catalog..." />;
  }

  const ready = state === "ready";
  const active = hasActiveFilters(filters);

  return (
    <DashboardShell
      role="user"
      title="Previous Year Questions (PYQs)"
      subtitle="Authentic company-wise and round-wise question banks from campus recruitment drives"
    >
      <MotionConfig reducedMotion="user">
        <div className="space-y-6 pb-8">
          <PyqHero summary={summary} companies={companies} loading={!ready} onBrowse={browse} />

          <div ref={filtersRef} className="scroll-mt-24">
            {ready && companies.length > 0 ? (
              <PyqFilters
                ref={searchRef}
                filters={filters}
                sort={sort}
                options={options}
                roundCounts={roundCounts}
                categoryCounts={categoryCounts}
                yearCounts={yearCounts}
                canFilterLive={summary.liveDrives > 0}
                onChange={patchFilters}
                onSortChange={setSort}
                onClear={clearFilters}
              />
            ) : state === "loading" ? (
              <HpSkeleton className="h-[210px] rounded-[24px]" />
            ) : null}
          </div>

          {state === "loading" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading companies">
              {[0, 1, 2].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}

          {state === "error" && (
            <Notice
              icon={AlertCircle}
              tone="rose"
              title="Couldn’t load the PYQ archive"
              actions={
                <button type="button" className={PRIMARY_BTN} onClick={() => setReloadKey((k) => k + 1)}>
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Try again
                </button>
              }
            >
              Check your connection and try again. Nothing is lost — your filters are still in the address bar.
            </Notice>
          )}

          {ready && companies.length === 0 && (
            <Notice icon={SearchX} tone="indigo" title="No company packs are published yet">
              Previous year questions appear here as soon as your institution’s catalogue is updated. Check back soon.
            </Notice>
          )}

          {ready && companies.length > 0 && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 px-1" aria-live="polite">
                <p className="text-xs text-text-secondary">
                  Showing <strong className="tabular font-bold text-primary">{results.length}</strong> of{" "}
                  <strong className="tabular font-bold text-primary">{companies.length}</strong> {companies.length === 1 ? "company" : "companies"}
                  <span className="text-text-muted">
                    {" "}
                    · <span className="tabular">{matchingQuestions}</span> {active ? "matching " : ""}PYQs
                  </span>
                </p>
              </div>

              {results.length === 0 ? (
                <Notice
                  icon={SearchX}
                  tone="indigo"
                  title="No companies match these filters"
                  actions={
                    <>
                      <button type="button" className={PRIMARY_BTN} onClick={clearFilters}>
                        Reset filters
                      </button>
                      {filters.liveOnly && (
                        <button type="button" className={GHOST_BTN} onClick={() => patchFilters({ liveOnly: false })}>
                          Show all campuses
                        </button>
                      )}
                    </>
                  }
                >
                  Try removing a filter above — the numbers on each chip show how many companies you’d get.
                </Notice>
              ) : (
                <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence mode="popLayout" initial>
                    {results.map((company, i) => (
                      <motion.li
                        key={company.id}
                        layout
                        initial={{ opacity: 0, y: 22, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.18 } }}
                        transition={{ duration: 0.45, ease: hpEase, delay: Math.min(i, 8) * 0.045 }}
                        className="min-w-0"
                      >
                        <CompanyCard company={company} filters={filters} matchCount={matchingQuestionCount(company, filters)} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </>
          )}
        </div>
      </MotionConfig>
    </DashboardShell>
  );
}
