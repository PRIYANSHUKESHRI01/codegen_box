"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MotionConfig, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarRange,
  Check,
  Code2,
  ExternalLink,
  FileQuestion,
  Globe,
  Layers,
  MessagesSquare,
  Mic,
  Search,
  Shapes,
  Sparkles,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { hpEase } from "@/components/portal/kit";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { FacetRow, FilterChip, FiltersToggle } from "@/components/company-prep/FilterChip";
import { QuestionBrowser } from "@/components/company-prep/QuestionBrowser";
import { RecommendedProblems } from "@/components/company-prep/RecommendedProblems";
import { categoryMeta } from "@/components/company-prep/categoryMeta";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { companyAccent, hexToRgbTriplet } from "@/lib/companyBrands";
import {
  CATEGORY_ORDER,
  CODING_PROBLEMS_ANCHOR,
  companyPageSearch,
  curatedPracticeHref,
  filterQuestions,
  questionFacetCounts,
  questionMatchesText,
  type FacetSelection,
} from "@/lib/companyPrep";
import type { CompanyPrepDetail } from "@/types/companyPrep";

const NO_SELECTION: FacetSelection = { round: null, category: null, year: null };

export default function CompanyPrepViewPage() {
  return (
    <Suspense fallback={<SessionLoader label="Loading company previous year questions..." />}>
      <CompanyPrepViewContent />
    </Suspense>
  );
}

function StatPill({ icon: Icon, children }: { icon: typeof FileQuestion; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-elevated/60 px-3 py-1.5 text-2xs font-semibold text-text-secondary">
      <Icon className="h-3.5 w-3.5 text-[rgb(var(--brand-rgb))]" strokeWidth={2.3} aria-hidden />
      {children}
    </span>
  );
}

function CompanyPrepViewContent() {
  const { status: authStatus } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const slug = searchParams.get("company") || searchParams.get("slug") || "";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CompanyPrepDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters. The hub hands over the round / category / year it was filtered by (?round=…&year=…).
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false); // phones only: the chip rows are tucked behind a button
  const [sel, setSel] = useState<FacetSelection>(() => {
    const year = Number(searchParams.get("year"));
    return {
      round: searchParams.get("round") || null,
      category: searchParams.get("category") || null,
      year: Number.isInteger(year) && year > 0 ? year : null,
    };
  });

  useEffect(() => {
    if (authStatus !== "ready") return;

    if (!slug) {
      setError("No company specified.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<CompanyPrepDetail>(`/company-prep/${slug}`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        // Drop anything in the link this company has no questions for, instead of opening on an empty list.
        const qs = res.prep_questions ?? [];
        setSel((prev) => ({
          round: prev.round !== null && qs.some((q) => q.round_name === prev.round) ? prev.round : null,
          category: prev.category !== null && qs.some((q) => q.category === prev.category) ? prev.category : null,
          year: prev.year !== null && qs.some((q) => q.asked_year === prev.year) ? prev.year : null,
        }));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Failed to load company prep materials.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, slug]);

  // Keep the address bar shareable: ?company=…&round=…&year=…
  useEffect(() => {
    if (loading || !data || typeof window === "undefined") return;
    const next = `${window.location.pathname}${companyPageSearch(slug, sel)}${window.location.hash}`;
    const now = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== now) window.history.replaceState(window.history.state, "", next);
  }, [sel, slug, loading, data]);

  // Coming back from a problem (…#coding-problems) lands on the problems the student was looking at, not the top of the page.
  useEffect(() => {
    if (loading || !data || typeof window === "undefined") return;
    const id = window.location.hash.slice(1);
    if (!id) return;
    // After the entrance animations have placed the section.
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 400);
    return () => window.clearTimeout(t);
  }, [loading, data]);

  const questions = useMemo(() => data?.prep_questions ?? [], [data?.prep_questions]);

  // Rounds in the order of the hiring process when the names line up, else as they first appear.
  const uniqueRounds = useMemo(() => {
    const order = (data?.company.hiring_process ?? []).map((s) => s.name.trim().toLowerCase());
    const seen: string[] = [];
    questions.forEach((q) => {
      if (q.round_name && !seen.includes(q.round_name)) seen.push(q.round_name);
    });
    const rank = (r: string) => {
      const i = order.indexOf(r.trim().toLowerCase());
      return i === -1 ? Number.MAX_SAFE_INTEGER : i;
    };
    return seen
      .map((r, idx) => ({ r, idx }))
      .sort((a, b) => rank(a.r) - rank(b.r) || a.idx - b.idx)
      .map((x) => x.r);
  }, [questions, data?.company.hiring_process]);

  const uniqueYears = useMemo(() => Array.from(new Set(questions.map((q) => q.asked_year))).sort((a, b) => b - a), [questions]);

  const uniqueCategories = useMemo(() => {
    const present = new Set(questions.map((q) => q.category));
    const known = CATEGORY_ORDER.filter((c) => present.has(c));
    const extra = Array.from(present).filter((c) => !CATEGORY_ORDER.includes(c));
    return [...known, ...extra];
  }, [questions]);

  const textMatch = useCallback((q: CompanyPrepDetail["prep_questions"][number]) => questionMatchesText(q, searchQuery), [searchQuery]);

  const filteredQuestions = useMemo(() => filterQuestions(questions, sel, textMatch), [questions, sel, textMatch]);
  const roundCounts = useMemo(() => questionFacetCounts(questions, sel, "round", textMatch), [questions, sel, textMatch]);
  const yearCounts = useMemo(() => questionFacetCounts(questions, sel, "year", textMatch), [questions, sel, textMatch]);
  const categoryCounts = useMemo(() => questionFacetCounts(questions, sel, "category", textMatch), [questions, sel, textMatch]);

  const filtersActive = !!searchQuery.trim() || sel.round !== null || sel.year !== null || sel.category !== null;

  const resetFilters = () => {
    setSearchQuery("");
    setSel(NO_SELECTION);
  };

  if (authStatus !== "ready" || loading) {
    return <SessionLoader label="Loading company previous year questions..." />;
  }

  if (error || !data) {
    return (
      <DashboardShell role="user" title="Company Prep Questions" subtitle="Question archive and authentic campus recruitment material">
        <div role="alert" className="mx-auto max-w-lg space-y-4 rounded-[24px] border border-rose-500/20 bg-rose-500/[0.04] p-8 text-center shadow-[var(--hp-edge),var(--hp-shadow)]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-300">
            <AlertCircle className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-sm font-semibold text-primary">{error ?? "Company not found."}</p>
          <Link
            href="/dashboard/company-prep"
            className="hp-btn-sheen inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-indigo-500 to-violet-600 px-4 text-13 font-semibold text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.75)] transition-all hover:-translate-y-px"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to All Companies
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const { company, live_drive, recommended_problems } = data;
  const accent = companyAccent(company.slug, company.name);
  const brandStyle = { "--brand-rgb": hexToRgbTriplet(accent) } as CSSProperties;

  const firstYear = uniqueYears.length ? uniqueYears[uniqueYears.length - 1] : null;
  const lastYear = uniqueYears.length ? uniqueYears[0] : null;
  const yearsPhrase =
    firstYear === null || lastYear === null ? "campus recruitment drives" : firstYear === lastYear ? `campus recruitment drives in ${firstYear}` : `campus recruitment drives from ${firstYear} to ${lastYear}`;

  /** This page, as it is right now (company + filters), pointing at the problems — what the editor's Back arrows return to. */
  const returnTo = `/dashboard/company-prep/view${companyPageSearch(slug, sel)}#${CODING_PROBLEMS_ANCHOR}`;

  const practiceHref = curatedPracticeHref(
    recommended_problems.filter((p) => p.available).map((p) => p.problem_slug),
    company.name
  );

  /** A hiring-process stage that is also a round we hold questions for → clicking it filters to that round. */
  const roundForStep = (stepName: string) => uniqueRounds.find((r) => r.trim().toLowerCase() === stepName.trim().toLowerCase()) ?? null;

  return (
    <DashboardShell
      role="user"
      title={`${company.name} Previous Year Questions`}
      subtitle={`Authentic question archives, round-wise breakdowns & DSA practice for ${company.name} campus drives`}
    >
      <MotionConfig reducedMotion="user">
        <div style={brandStyle} className="space-y-6 pb-8">
          {/* Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/dashboard/company-prep"
              className="group inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3.5 py-1.5 text-xs font-semibold text-text-secondary shadow-subtle transition-all duration-200 hover:-translate-x-0.5 hover:border-indigo-500/40 hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden />
              All Companies
            </Link>

            {live_drive && (
              <Link
                href={`/dashboard/drives?driveId=${live_drive.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/25 transition-colors hover:bg-emerald-500/15 dark:text-emerald-300"
              >
                <Briefcase className="h-3.5 w-3.5" aria-hidden />
                Campus Drive Active for your College
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </div>

          {/* Company header */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: hpEase }}
            className="relative overflow-hidden rounded-[28px] border border-border-subtle bg-surface shadow-[var(--hp-edge),var(--hp-shadow)]"
          >
            <div aria-hidden className="relative h-28 overflow-hidden sm:h-32">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(var(--brand-rgb)/0.26),rgb(var(--brand-rgb)/0.08)_55%,transparent)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle,rgb(var(--brand-rgb)/0.34)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom_left,#000,transparent_75%)]" />
              <div className="hp-drift absolute -right-12 -top-20 h-48 w-48 rounded-full bg-[rgb(var(--brand-rgb)/0.4)] blur-3xl" />
              <div className="hp-drift absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-[rgb(var(--brand-rgb)/0.18)] blur-3xl [animation-delay:-5s]" />
            </div>

            <div className="relative px-6 pb-6 sm:px-8 sm:pb-8">
              <div className="-mt-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
                  <CompanyLogo name={company.name} slug={company.slug} logo={company.logo} size="xl" />
                  <div className="min-w-0 pb-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">{company.name}</h2>
                      {company.industry && (
                        <span className="rounded-full border border-border-subtle bg-elevated/70 px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wider text-text-secondary">
                          {company.industry}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatPill icon={FileQuestion}>
                        <strong className="font-bold text-primary">{questions.length}</strong> PYQs archived
                      </StatPill>
                      {firstYear !== null && lastYear !== null && <StatPill icon={CalendarRange}>{firstYear === lastYear ? firstYear : `${firstYear} – ${lastYear}`}</StatPill>}
                      <StatPill icon={Code2}>
                        <strong className="font-bold text-primary">{recommended_problems.length}</strong> recommended DSA
                      </StatPill>
                    </div>
                  </div>
                </div>

                {company.website_url && (
                  <a
                    href={company.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="group inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-xs font-semibold text-primary shadow-subtle transition-all duration-200 hover:-translate-y-px hover:border-[rgb(var(--brand-rgb)/0.55)] hover:shadow-[0_14px_28px_-14px_rgb(var(--brand-rgb)/0.6)] md:self-auto"
                  >
                    <Globe className="h-3.5 w-3.5" aria-hidden />
                    Careers Portal
                    <ExternalLink className="h-3 w-3 text-text-muted transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                  </a>
                )}
              </div>

              {company.overview && <p className="mt-6 max-w-4xl text-sm leading-relaxed text-text-secondary">{company.overview}</p>}

              {/* Hiring process */}
              {company.hiring_process && company.hiring_process.length > 0 && (
                <div className="mt-7">
                  <h3 className="mb-3 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.12em] text-text-muted">
                    <Layers className="h-3.5 w-3.5 text-[rgb(var(--brand-rgb))]" aria-hidden />
                    Campus Recruitment Round Structure
                  </h3>
                  <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {company.hiring_process.map((step, idx) => {
                      const round = roundForStep(step.name);
                      const active = round !== null && sel.round === round;
                      const count = round ? questions.filter((q) => q.round_name === round).length : 0;
                      const inner = (
                        <>
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -right-1 -top-3 select-none text-[64px] font-black leading-none text-[rgb(var(--brand-rgb)/0.09)] transition-transform duration-500 group-hover:scale-110"
                          >
                            {idx + 1}
                          </span>
                          <span className="relative flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--brand-rgb))] text-3xs font-extrabold text-white shadow-[0_6px_14px_-4px_rgb(var(--brand-rgb)/0.8)]">
                              {idx + 1}
                            </span>
                            <span className="text-3xs font-extrabold uppercase tracking-[0.12em] text-[rgb(var(--brand-rgb))] brightness-90 dark:brightness-150">Round {idx + 1}</span>
                          </span>
                          <span className="relative mt-2 block text-13 font-bold leading-snug text-primary">{step.name}</span>
                          {step.description && <span className="relative mt-1 line-clamp-3 text-2xs leading-snug text-text-muted">{step.description}</span>}
                          {round && (
                            <span className="relative mt-3 inline-flex items-center gap-1 rounded-full bg-[rgb(var(--brand-rgb)/0.12)] px-2.5 py-0.5 text-3xs font-bold text-primary">
                              {active ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : <FileQuestion className="h-3 w-3" aria-hidden />}
                              {count} {count === 1 ? "question" : "questions"}
                            </span>
                          )}
                        </>
                      );
                      const base =
                        "group relative block h-full overflow-hidden rounded-2xl border bg-elevated/50 p-4 text-left transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";
                      return (
                        <motion.li
                          key={idx}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.45, ease: hpEase, delay: 0.15 + idx * 0.06 }}
                        >
                          {round ? (
                            <button
                              type="button"
                              aria-pressed={active}
                              onClick={() => setSel((prev) => ({ ...prev, round: prev.round === round ? null : round }))}
                              className={cn(
                                base,
                                "w-full cursor-pointer hover:-translate-y-1 hover:border-[rgb(var(--brand-rgb)/0.5)] hover:shadow-[0_18px_34px_-18px_rgb(var(--brand-rgb)/0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--brand-rgb)/0.6)]",
                                active ? "border-[rgb(var(--brand-rgb)/0.6)] bg-[rgb(var(--brand-rgb)/0.08)]" : "border-border-subtle"
                              )}
                            >
                              {inner}
                            </button>
                          ) : (
                            <div className={cn(base, "border-border-subtle")}>{inner}</div>
                          )}
                        </motion.li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          </motion.section>

          {/* Live drive callout */}
          {live_drive && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: hpEase, delay: 0.1 }}
              className="relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-[22px] border border-emerald-500/25 bg-emerald-500/[0.07] p-5 sm:flex-row sm:items-center"
            >
              <div aria-hidden className="hp-drift pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
              <div className="relative flex items-center gap-4">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-[0_10px_22px_-8px_rgba(16,185,129,0.8)]">
                  <Briefcase className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-primary">
                    Active Drive: {live_drive.title} ({live_drive.role_title})
                  </h3>
                  <p className="text-xs text-text-muted">
                    Package: {live_drive.ctc_range ?? "Competitive"} · Date:{" "}
                    {new Date(live_drive.drive_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
              <Link
                href={`/dashboard/drives?driveId=${live_drive.id}`}
                className="relative inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-[0_10px_22px_-10px_rgba(16,185,129,0.85)] transition-all hover:-translate-y-px"
              >
                Open Campus Drive Workspace
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </motion.div>
          )}

          {/* Previous year questions */}
          <section className="space-y-4" aria-labelledby="pyq-heading">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 id="pyq-heading" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-primary">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_8px_18px_-6px_rgba(99,102,241,0.65)]">
                    <FileQuestion className="h-4 w-4" aria-hidden />
                  </span>
                  Verified Previous Year Questions ({questions.length})
                </h2>
                <p className="mt-1 text-xs text-text-muted">Authentic questions asked across {yearsPhrase}</p>
              </div>

            </div>

            {/* Search and filters */}
            <div role="search" aria-label="Filter questions" className="space-y-4 rounded-[24px] border border-border-subtle bg-surface p-4 shadow-[var(--hp-edge),var(--hp-shadow)] sm:p-5">
              <div className="group relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-indigo-500" aria-hidden />
                <input
                  type="text"
                  placeholder="Search questions by keyword, topic, pseudocode, STAR interview questions, or Versant prompt…"
                  aria-label="Search questions"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-border-subtle bg-elevated/60 pl-11 pr-11 text-sm text-primary placeholder:text-text-muted transition-all duration-200 hover:border-border-strong focus:border-indigo-500/60 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-text-muted transition-colors hover:bg-black/5 hover:text-primary dark:hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <FiltersToggle
                open={filtersOpen}
                onToggle={() => setFiltersOpen((v) => !v)}
                activeCount={[sel.round, sel.category, sel.year].filter((x) => x !== null).length}
                controls="pyq-facets"
              />

              <div id="pyq-facets" className={cn("space-y-3.5", !filtersOpen && "hidden md:block")}>
                {uniqueCategories.length > 0 && (
                  <FacetRow icon={Shapes} label="Category">
                    <FilterChip active={sel.category === null} onClick={() => setSel((p) => ({ ...p, category: null }))}>
                      All
                    </FilterChip>
                    {uniqueCategories.map((c) => {
                      const meta = categoryMeta(c);
                      const Icon = meta.icon;
                      const n = categoryCounts.get(c) ?? 0;
                      return (
                        <FilterChip
                          key={c}
                          active={sel.category === c}
                          disabled={n === 0}
                          count={n}
                          activeClass={meta.solid}
                          idleClass={cn(meta.soft, "hover:-translate-y-px hover:brightness-95 dark:hover:brightness-125")}
                          onClick={() => setSel((p) => ({ ...p, category: p.category === c ? null : c }))}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5" strokeWidth={2.3} aria-hidden />
                            {c}
                          </span>
                        </FilterChip>
                      );
                    })}
                  </FacetRow>
                )}

                {uniqueYears.length > 0 && (
                  <FacetRow icon={CalendarRange} label="Year">
                    <FilterChip active={sel.year === null} onClick={() => setSel((p) => ({ ...p, year: null }))}>
                      All years
                    </FilterChip>
                    {uniqueYears.map((y) => {
                      const n = yearCounts.get(y) ?? 0;
                      return (
                        <FilterChip
                          key={y}
                          active={sel.year === y}
                          disabled={n === 0}
                          count={n}
                          activeClass="bg-gradient-to-r from-sky-500 to-indigo-500 text-white ring-transparent shadow-[0_8px_18px_-8px_rgba(14,165,233,0.85)]"
                          onClick={() => setSel((p) => ({ ...p, year: p.year === y ? null : y }))}
                        >
                          {y}
                        </FilterChip>
                      );
                    })}
                  </FacetRow>
                )}

                {uniqueRounds.length > 0 && (
                  <FacetRow icon={Layers} label="Round">
                    <FilterChip active={sel.round === null} onClick={() => setSel((p) => ({ ...p, round: null }))}>
                      All rounds
                    </FilterChip>
                    {uniqueRounds.map((r) => {
                      const n = roundCounts.get(r) ?? 0;
                      return (
                        <FilterChip
                          key={r}
                          active={sel.round === r}
                          disabled={n === 0}
                          count={n}
                          activeClass="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white ring-transparent shadow-[0_8px_18px_-8px_rgba(139,92,246,0.85)]"
                          onClick={() => setSel((p) => ({ ...p, round: p.round === r ? null : r }))}
                        >
                          {r}
                        </FilterChip>
                      );
                    })}
                  </FacetRow>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3.5 text-2xs text-text-muted" aria-live="polite">
                <span>
                  Showing <strong className="tabular text-primary">{filteredQuestions.length}</strong> of <strong className="tabular text-primary">{questions.length}</strong> authentic questions
                </span>
                {filtersActive && (
                  <button type="button" onClick={resetFilters} className="cursor-pointer rounded-full px-3 py-1 font-bold text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300">
                    Reset filters
                  </button>
                )}
              </div>
            </div>

            {/* Question cards */}
            {filteredQuestions.length === 0 ? (
              <div className="rounded-[24px] border border-border-subtle bg-surface p-10 text-center shadow-[var(--hp-edge),var(--hp-shadow)]">
                <p className="text-sm font-semibold text-primary">No previous year questions match your current filters.</p>
                <p className="mx-auto mt-1.5 max-w-sm text-xs text-text-muted">Try a different round or year — the number on each chip is how many questions you’d see.</p>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-b from-indigo-500 to-violet-600 px-4 text-13 font-semibold text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.75)] transition-all hover:-translate-y-px active:scale-[0.97]"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            ) : (
              <QuestionBrowser
                questions={filteredQuestions}
                roundOrder={uniqueRounds}
                hiringProcess={company.hiring_process ?? []}
                filtersActive={filtersActive}
                resetKey={`${searchQuery}|${sel.round}|${sel.category}|${sel.year}`}
              />
            )}
          </section>

          {/* Recommended coding practice — each card opens the code editor on that problem */}
          <RecommendedProblems problems={recommended_problems} companyName={company.name} returnTo={returnTo} />

          {/* Round simulation shortcuts */}
          <section className="relative overflow-hidden rounded-[24px] border border-border-subtle bg-surface p-6 shadow-[var(--hp-edge),var(--hp-shadow)]">
            <div aria-hidden className="hp-drift pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/15 blur-3xl" />
            <div className="relative space-y-4">
              <div className="flex items-center gap-2.5 text-primary">
                <Sparkles className="h-5 w-5 text-violet-500" aria-hidden />
                <h3 className="text-sm font-bold">Simulate {company.name} Drive Rounds</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { href: "/dashboard/soft-skills", icon: MessagesSquare, title: "Round 1: Cognitive & Soft Skills", text: "Practice 25 timed MCQs with answer review", tint: "from-amber-400 to-orange-500" },
                  { href: practiceHref, icon: Code2, title: "Round 2: Coding Assessment", text: "Practice with test cases & code editor", tint: "from-indigo-500 to-violet-600" },
                  { href: "/dashboard/interviews", icon: Mic, title: "Round 3: AI Spoken Interview", text: "Real-time voice & STAR feedback", tint: "from-teal-400 to-cyan-600" },
                ].map((r) => (
                  <Link
                    key={r.title}
                    href={r.href}
                    className="group flex items-center gap-3.5 rounded-2xl border border-border-subtle bg-elevated/50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/40 hover:bg-surface hover:shadow-[0_18px_34px_-20px_rgba(79,70,229,0.5)]"
                  >
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110", r.tint)}>
                      <r.icon className="h-[18px] w-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-bold text-primary">{r.title}</span>
                      <span className="mt-0.5 block text-2xs text-text-muted">{r.text}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-text-muted transition-all duration-300 group-hover:translate-x-1 group-hover:text-indigo-500" aria-hidden />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </MotionConfig>
    </DashboardShell>
  );
}
