"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Brain, Building2, CheckCircle2, ChevronDown, Clock, Library, ListChecks, PlayCircle, Search, SearchX, Trophy, X } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ListPagination } from "@/components/dashboard/softSkills/ListPagination";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VIEW,
  libraryViewToApiQuery,
  libraryViewToSearch,
  parseLibraryView,
  type LibraryViewState,
  type PerPage,
} from "@/lib/softSkillSets";
import {
  ASSESSMENT_TYPE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type SoftSkillAssessmentSummary,
  type SoftSkillLibraryResponse,
  type SoftSkillListStatus,
} from "@/types/softSkill";

const STATUS_FILTERS: { id: SoftSkillListStatus; label: string }[] = [
  { id: "all", label: "All sets" },
  { id: "not_attempted", label: "Not attempted" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
];

/** How many assigned tests show before "Show all" — they are few, and the ones that matter most, so they are never paged. */
const ASSIGNED_PREVIEW = 4;

export default function SoftSkillsListPage() {
  const { status } = useAuthGuard(["user"]);

  // The view lives in the address bar (?q=&status=&page=&per=all) so a refresh, a shared link, or Back from a
  // test lands on the same page of the library. It is read once, after mount, so the static page renders neutrally.
  const [view, setView] = useState<LibraryViewState>(DEFAULT_VIEW);
  const [searchText, setSearchText] = useState("");
  const [viewReady, setViewReady] = useState(false);

  const [library, setLibrary] = useState<SoftSkillLibraryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<SoftSkillAssessmentSummary[]>([]);
  const [showAllAssigned, setShowAllAssigned] = useState(false);

  const gridTop = useRef<HTMLDivElement>(null);
  const scrollOnLoad = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    const initial = parseLibraryView(window.location.search);
    setView(initial);
    setSearchText(initial.q);
    setViewReady(true);
  }, []);

  // Typing waits for a pause before it asks the server, and always goes back to page 1.
  useEffect(() => {
    if (!viewReady || searchText.trim() === view.q.trim()) return;
    const timer = window.setTimeout(() => setView((v) => ({ ...v, q: searchText, page: 1 })), 300);
    return () => window.clearTimeout(timer);
  }, [searchText, view.q, viewReady]);

  useEffect(() => {
    if (!viewReady) return;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${libraryViewToSearch(view)}`);
  }, [view, viewReady]);

  const loadLibrary = useCallback(async (current: LibraryViewState) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SoftSkillLibraryResponse>(`/soft-skills?${libraryViewToApiQuery("sets", current)}`);
      if (id !== requestId.current) return; // a newer request superseded this one
      setLibrary(res);
      // A page number past the end (a stale link) is clamped by the server; follow it so the URL stays honest.
      if (res.meta.page !== current.page && current.perPage !== "all") setView((v) => ({ ...v, page: res.meta.page }));
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof ApiError ? err.message : "Failed to load the Soft Skills sets.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready" && viewReady) loadLibrary(view);
  }, [status, viewReady, view, loadLibrary]);

  // The tests somebody scheduled for this student — fetched once, independent of the library's paging and search.
  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    api
      .get<SoftSkillLibraryResponse>("/soft-skills?scope=assigned&per_page=all")
      .then((res) => !cancelled && setAssigned(res.assessments))
      .catch(() => undefined); // the library is the page; a failure here must not take it down
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (!loading && scrollOnLoad.current) {
      scrollOnLoad.current = false;
      gridTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  const changePage = (page: number) => {
    scrollOnLoad.current = true;
    setView((v) => ({ ...v, page }));
  };
  const changePerPage = (perPage: PerPage) => setView((v) => ({ ...v, perPage, page: 1 }));
  const changeStatus = (next: SoftSkillListStatus) => setView((v) => ({ ...v, status: next, page: 1 }));
  const clearFilters = () => {
    setSearchText("");
    setView((v) => ({ ...DEFAULT_VIEW, perPage: v.perPage }));
  };

  const counts = library?.counts;
  const filtersActive = view.q.trim() !== "" || view.status !== "all";
  const sets = library?.assessments ?? [];
  const visibleAssigned = showAllAssigned ? assigned : assigned.slice(0, ASSIGNED_PREVIEW);
  const completionPct = useMemo(() => (counts && counts.sets > 0 ? Math.round((counts.sets_completed / counts.sets) * 100) : 0), [counts]);

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="user"
      title="Soft Skills"
      subtitle="Aptitude, reasoning, English and workplace judgment — the readiness check most placement drives screen on before the technical rounds."
    >
      <div className="space-y-8">
        {/* Assigned tests: what a college or hiring partner scheduled for this student. Few, and the ones that matter most. */}
        {assigned.length > 0 && (
          <section aria-labelledby="assigned-heading" className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 id="assigned-heading" className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Building2 className="h-4 w-4 text-accent-secondary" aria-hidden />
                  Assigned to you
                  <span className="tabular rounded-full bg-accent-secondary/10 px-2 py-0.5 text-3xs font-bold text-accent-secondary">{assigned.length}</span>
                </h2>
                <p className="mt-0.5 text-2xs text-text-muted">Tests your college or a hiring partner set up for you.</p>
              </div>
              {assigned.length > ASSIGNED_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllAssigned((v) => !v)}
                  className="flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline"
                  aria-expanded={showAllAssigned}
                >
                  {showAllAssigned ? "Show fewer" : `Show all ${assigned.length}`}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAllAssigned && "rotate-180")} aria-hidden />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {visibleAssigned.map((assessment) => (
                <TestCard key={assessment.id} assessment={assessment} />
              ))}
            </div>
          </section>
        )}

        {/* The AptRun question-set library. */}
        <section aria-labelledby="sets-heading" className="space-y-4">
          <div className="flex flex-col gap-4 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-accent-primary/25 bg-gradient-to-br from-accent-primary/25 to-accent-primary/5 text-accent-primary">
                <Library className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 id="sets-heading" className="text-base font-bold text-primary">
                  AptRun Soft Skills question sets
                </h2>
                <p className="mt-0.5 max-w-xl text-xs text-text-muted">
                  Ready-made practice papers written by AptRun — aptitude, reasoning, English and workplace judgment. Pick any set and attempt it whenever you like; attempt as many as you want.
                </p>
              </div>
            </div>

            {counts && counts.sets > 0 && (
              <div className="w-full shrink-0 lg:w-64" aria-label="Your progress through the question sets">
                <div className="flex items-baseline justify-between text-2xs">
                  <span className="font-semibold text-text-secondary">
                    <span className="tabular text-primary">{counts.sets_completed}</span> of <span className="tabular">{counts.sets}</span> completed
                  </span>
                  {counts.sets_in_progress > 0 && <span className="font-semibold text-status-warning">{counts.sets_in_progress} in progress</span>}
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={completionPct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-accent-primary transition-all duration-500" style={{ width: `${completionPct}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Search + filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label="Filter sets by your progress" className="flex flex-wrap items-center gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={view.status === f.id}
                  onClick={() => changeStatus(f.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                    view.status === f.id ? "border-accent-primary/40 bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-surface text-text-muted hover:text-primary"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <label className="relative block w-full sm:w-72">
              <span className="sr-only">Search question sets</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
              <input
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search sets — e.g. 12"
                maxLength={100}
                className="h-10 w-full rounded-xl border border-border-strong bg-surface pl-9 pr-9 text-xs text-primary outline-none transition-all placeholder:text-text-muted focus:border-accent-primary/60 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => setSearchText("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted hover:bg-elevated hover:text-primary"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              )}
            </label>
          </div>

          <div ref={gridTop} className="scroll-mt-24" />

          {/* The grid */}
          {error && !library ? (
            <div role="alert" className="space-y-3 rounded-panel border border-border-subtle bg-surface p-10 text-center">
              <AlertTriangle className="mx-auto h-7 w-7 text-status-danger" aria-hidden />
              <p className="text-xs text-status-danger">{error}</p>
              <button
                type="button"
                onClick={() => loadLibrary(view)}
                className="rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover"
              >
                Try again
              </button>
            </div>
          ) : !library && loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Loading question sets">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-panel border border-border-subtle bg-surface" />
              ))}
            </div>
          ) : sets.length === 0 ? (
            <div className="space-y-3 rounded-panel border border-border-subtle bg-surface p-14 text-center">
              {filtersActive ? (
                <>
                  <SearchX className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
                  <p className="text-sm font-bold text-primary">No sets match</p>
                  <p className="text-xs text-text-muted">Nothing fits that search and filter. Try another word, or clear them.</p>
                  <button type="button" onClick={clearFilters} className="rounded-control border border-border-subtle bg-elevated px-4 py-2 text-xs font-bold text-text-secondary hover:text-primary">
                    Clear search and filters
                  </button>
                </>
              ) : (
                <>
                  <Brain className="mx-auto h-8 w-8 text-text-muted" aria-hidden />
                  <p className="text-sm font-bold text-primary">No question sets yet</p>
                  <p className="text-xs text-text-muted">AptRun&apos;s practice sets will appear here as soon as they are published — check back soon.</p>
                </>
              )}
            </div>
          ) : (
            <div aria-busy={loading} className={cn("space-y-5 transition-opacity", loading && "opacity-60")}>
              {error && (
                <p role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-2xs text-status-danger">
                  {error}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sets.map((set) => (
                  <SetCard key={set.id} set={set} />
                ))}
              </div>
              {library && <ListPagination meta={library.meta} noun="sets" onPage={changePage} onPerPage={changePerPage} busy={loading} />}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}

/** Where the student stands on one assessment — the same wording on every card. */
function ProgressLine({ assessment }: { assessment: SoftSkillAssessmentSummary }) {
  if (assessment.in_progress) {
    return (
      <span className="flex items-center gap-1 font-bold text-status-warning">
        <PlayCircle className="h-3.5 w-3.5" aria-hidden />
        In progress — resume
      </span>
    );
  }
  if (assessment.best_score_percent !== null) {
    const passed = assessment.best_score_percent >= assessment.pass_percentage;
    return (
      <span className={cn("flex items-center gap-1 font-bold", passed ? "text-status-success" : "text-status-warning")}>
        {passed ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Trophy className="h-3.5 w-3.5" aria-hidden />}
        Best {Math.round(assessment.best_score_percent)}%
        {assessment.attempts_taken > 1 && <span className="font-medium text-text-muted">· {assessment.attempts_taken} attempts</span>}
      </span>
    );
  }
  return <span>Not attempted</span>;
}

function CategoryChips({ assessment }: { assessment: SoftSkillAssessmentSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {CATEGORY_ORDER.filter((cat) => assessment.category_composition[cat]).map((cat) => (
        <span key={cat} className="rounded-full bg-elevated px-2 py-0.5 text-3xs font-semibold text-text-muted">
          {assessment.category_composition[cat]} {CATEGORY_LABELS[cat].split(" ")[0]}
        </span>
      ))}
    </div>
  );
}

function CardFooter({ assessment }: { assessment: SoftSkillAssessmentSummary }) {
  return (
    <div className="flex items-center justify-between border-t border-border-subtle pt-2.5 text-2xs text-text-muted">
      <ProgressLine assessment={assessment} />
      {!assessment.can_attempt ? (
        <span className="text-3xs font-bold">Attempts used up</span>
      ) : (
        <ArrowRight className="h-3.5 w-3.5 transition-all group-hover:translate-x-0.5 group-hover:text-accent-primary" aria-hidden />
      )}
    </div>
  );
}

/** One AptRun library set: "Set 12", what is in it, and where the student stands. */
function SetCard({ set }: { set: SoftSkillAssessmentSummary }) {
  const label = set.set_number !== null ? `Set ${set.set_number}` : set.title;
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18, ease: "easeOut" }}>
      <Link
        href={`/dashboard/soft-skills/session?slug=${set.slug}`}
        className="group flex h-full flex-col gap-3 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle transition-all hover:border-border-strong hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-control border",
              set.best_score_percent !== null
                ? "border-status-success/25 bg-status-success/10 text-status-success"
                : "border-accent-primary/25 bg-gradient-to-br from-accent-primary/25 to-accent-primary/5 text-accent-primary"
            )}
          >
            {set.best_score_percent !== null ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <Brain className="h-5 w-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-primary transition-colors group-hover:text-accent-primary">{label}</h3>
            <p className="flex items-center gap-2 text-2xs text-text-muted">
              <span className="flex items-center gap-1">
                <ListChecks className="h-3 w-3" aria-hidden />
                {set.question_count} questions
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden />
                {set.duration_minutes} min
              </span>
            </p>
          </div>
        </div>
        <CategoryChips assessment={set} />
        <div className="mt-auto">
          <CardFooter assessment={set} />
        </div>
      </Link>
    </motion.div>
  );
}

/** A test somebody scheduled for the student (a campus mock, a hiring partner's screening). */
function TestCard({ assessment }: { assessment: SoftSkillAssessmentSummary }) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.18, ease: "easeOut" }}>
      <Link
        href={`/dashboard/soft-skills/session?slug=${assessment.slug}`}
        className="group flex h-full flex-col gap-3 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle transition-all hover:border-border-strong hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-bold text-primary transition-colors group-hover:text-accent-primary">{assessment.title}</h3>
          <span className="shrink-0 rounded-full bg-accent-secondary/10 px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-accent-secondary">
            {ASSESSMENT_TYPE_LABELS[assessment.assessment_type]}
          </span>
        </div>
        {assessment.company && <p className="text-2xs font-semibold text-text-secondary">{assessment.company.name}</p>}
        <p className="flex items-center gap-3 text-2xs text-text-muted">
          <span className="flex items-center gap-1">
            <ListChecks className="h-3 w-3" aria-hidden />
            {assessment.question_count} questions
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            {assessment.duration_minutes} min
          </span>
        </p>
        <div className="mt-auto">
          <CardFooter assessment={assessment} />
        </div>
      </Link>
    </motion.div>
  );
}
