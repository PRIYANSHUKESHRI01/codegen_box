"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  FileQuestion,
  Filter,
  Globe,
  Layers,
  ListChecks,
  MessageSquare,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CompanyPrepDetail } from "@/types/companyPrep";

const FILTER_ALL = "All";

export default function CompanyPrepViewPage() {
  return (
    <Suspense fallback={<SessionLoader label="Loading company previous year questions..." />}>
      <CompanyPrepViewContent />
    </Suspense>
  );
}

function CompanyPrepViewContent() {
  const { status: authStatus } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const slug = searchParams.get("company") || searchParams.get("slug") || "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CompanyPrepDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRound, setSelectedRound] = useState(FILTER_ALL);
  const [selectedYear, setSelectedYear] = useState<string>(FILTER_ALL);
  const [selectedCategory, setSelectedCategory] = useState(FILTER_ALL);
  const [expandedAnswers, setExpandedAnswers] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (authStatus !== "ready") return;

    if (!slug) {
      setError("No company specified.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    api
      .get<CompanyPrepDetail>(`/company-prep/${slug}`)
      .then((res) => {
        if (cancelled) return;
        setData(res);
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

  // Derived filter options
  const uniqueRounds = useMemo(() => {
    if (!data?.prep_questions) return [];
    const set = new Set<string>();
    data.prep_questions.forEach((q) => {
      if (q.round_name) set.add(q.round_name);
    });
    return Array.from(set);
  }, [data?.prep_questions]);

  const uniqueYears = useMemo(() => {
    if (!data?.prep_questions) return [];
    const set = new Set<number>();
    data.prep_questions.forEach((q) => {
      if (q.asked_year) set.add(q.asked_year);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [data?.prep_questions]);

  const uniqueCategories = useMemo(() => {
    if (!data?.prep_questions) return [];
    const set = new Set<string>();
    data.prep_questions.forEach((q) => {
      if (q.category) set.add(q.category);
    });
    return Array.from(set);
  }, [data?.prep_questions]);

  // Filtered question set
  const filteredQuestions = useMemo(() => {
    if (!data?.prep_questions) return [];

    return data.prep_questions.filter((q) => {
      const qText = q.question.toLowerCase();
      const notesText = (q.answer_notes || "").toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !query ||
        qText.includes(query) ||
        notesText.includes(query) ||
        (q.round_name && q.round_name.toLowerCase().includes(query)) ||
        q.category.toLowerCase().includes(query);

      const matchesRound =
        selectedRound === FILTER_ALL || q.round_name === selectedRound;

      const matchesYear =
        selectedYear === FILTER_ALL ||
        q.asked_year.toString() === selectedYear;

      const matchesCategory =
        selectedCategory === FILTER_ALL || q.category === selectedCategory;

      return matchesSearch && matchesRound && matchesYear && matchesCategory;
    });
  }, [data?.prep_questions, searchQuery, selectedRound, selectedYear, selectedCategory]);

  const toggleAnswer = (id: number) => {
    setExpandedAnswers((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAllAnswers = () => {
    const all: Record<number, boolean> = {};
    filteredQuestions.forEach((q) => {
      all[q.id] = true;
    });
    setExpandedAnswers(all);
  };

  const collapseAllAnswers = () => {
    setExpandedAnswers({});
  };

  const handleCopyQuestion = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (authStatus !== "ready" || loading) {
    return <SessionLoader label="Loading company previous year questions..." />;
  }

  if (error || !data) {
    return (
      <DashboardShell
        role="user"
        title="Company Prep Questions"
        subtitle="Question archive and authentic campus recruitment material"
      >
        <div className="p-8 text-center rounded-panel bg-surface border border-border-subtle max-w-lg mx-auto space-y-4">
          <p className="text-sm text-status-danger">{error ?? "Company not found."}</p>
          <Link
            href="/dashboard/company-prep"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-control bg-accent-primary text-text-inverse text-xs font-bold hover:bg-accent-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Companies</span>
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const { company, live_drive, recommended_problems } = data;

  return (
    <DashboardShell
      role="user"
      title={`${company.name} Previous Year Questions`}
      subtitle={`Authentic question archives, round-wise breakdowns & DSA practice for ${company.name} campus drives`}
    >
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/company-prep"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Companies</span>
          </Link>

          {live_drive && (
            <Link
              href={`/dashboard/drives?driveId=${live_drive.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-secondary hover:underline"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Campus Drive Active for your College →</span>
            </Link>
          )}
        </div>

        {/* Company Overview Header Card */}
        <div className="p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-panel bg-elevated border border-border-subtle flex items-center justify-center text-3xl shrink-0 shadow-subtle">
                {company.logo ? (
                  <span className="font-bold">{company.logo}</span>
                ) : (
                  <Building2 className="w-8 h-8 text-accent-primary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
                    {company.name}
                  </h1>
                  {company.industry && (
                    <span className="px-2.5 py-0.5 rounded-full bg-elevated border border-border-subtle text-3xs font-bold text-text-secondary uppercase tracking-wider">
                      {company.industry}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted flex-wrap">
                  <span className="flex items-center gap-1">
                    <FileQuestion className="w-3.5 h-3.5 text-accent-primary" />
                    <strong className="text-primary font-bold">{data.prep_questions.length}</strong> PYQs Archive
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-accent-secondary" />
                    Years: {uniqueYears.join(", ")}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Code2 className="w-3.5 h-3.5 text-status-success" />
                    {recommended_problems.length} Recommended DSA
                  </span>
                </div>
              </div>
            </div>

            {company.website_url && (
              <a
                href={company.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-control bg-elevated border border-border-subtle hover:border-border-strong text-text-secondary hover:text-primary transition-colors shrink-0"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Careers Portal</span>
                <ExternalLink className="w-3 h-3 text-text-muted" />
              </a>
            )}
          </div>

          {company.overview && (
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed border-t border-border-subtle pt-4">
              {company.overview}
            </p>
          )}

          {/* Hiring Process Rounds Timeline */}
          {company.hiring_process && company.hiring_process.length > 0 && (
            <div className="pt-2">
              <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted mb-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-accent-primary" />
                <span>Campus Recruitment Round Structure</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {company.hiring_process.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-control bg-elevated/60 border border-border-subtle flex flex-col gap-1 relative overflow-hidden"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xs font-extrabold text-accent-primary uppercase tracking-wider">
                        Round {idx + 1}
                      </span>
                      <span className="w-4 h-4 rounded-full bg-accent-primary/10 text-accent-primary text-3xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-primary mt-0.5">{step.name}</div>
                    {step.description && (
                      <p className="text-2xs text-text-muted leading-snug line-clamp-2">
                        {step.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Drive Callout Banner if college has active drive */}
        {live_drive && (
          <div className="p-4 rounded-panel bg-accent-secondary/10 border border-accent-secondary/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-control bg-accent-secondary/20 text-accent-secondary shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">
                  Active Drive: {live_drive.title} ({live_drive.role_title})
                </h3>
                <p className="text-xs text-text-muted">
                  Package: {live_drive.ctc_range ?? "Competitive"} · Date:{" "}
                  {new Date(live_drive.drive_date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <Link
              href={`/dashboard/drives?driveId=${live_drive.id}`}
              className="px-4 py-2 rounded-control bg-accent-secondary text-surface text-xs font-bold hover:bg-accent-secondary/90 transition-colors shrink-0"
            >
              Open Campus Drive Workspace →
            </Link>
          </div>
        )}

        {/* Previous Year Questions Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-primary flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-accent-primary" />
                <span>Verified Previous Year Questions ({data.prep_questions.length})</span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Authentic questions asked across campus recruitment drives from 2021 to 2025
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={expandAllAnswers}
                className="px-2.5 py-1 text-2xs font-semibold rounded-control bg-elevated border border-border-subtle hover:text-primary text-text-secondary transition-colors"
              >
                Expand All Solutions
              </button>
              <button
                onClick={collapseAllAnswers}
                className="px-2.5 py-1 text-2xs font-semibold rounded-control bg-elevated border border-border-subtle hover:text-primary text-text-secondary transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="p-4 rounded-panel bg-surface border border-border-subtle space-y-3.5 shadow-subtle">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search questions by keyword, topic, pseudocode, STAR interview questions, or Versant prompt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-control bg-elevated border border-border-subtle text-xs text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
              />
            </div>

            {/* Filter Pills Grid */}
            <div className="space-y-2.5 pt-1 text-xs">
              {/* Round Filters */}
              {uniqueRounds.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-3xs font-bold text-text-muted uppercase tracking-wider mr-1">
                    Round:
                  </span>
                  <button
                    onClick={() => setSelectedRound(FILTER_ALL)}
                    className={cn(
                      "px-2.5 py-1 rounded-control text-2xs font-bold border transition-colors",
                      selectedRound === FILTER_ALL
                        ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                        : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                    )}
                  >
                    All Rounds
                  </button>
                  {uniqueRounds.map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRound(r)}
                      className={cn(
                        "px-2.5 py-1 rounded-control text-2xs font-bold border transition-colors",
                        selectedRound === r
                          ? "bg-accent-primary/10 text-accent-primary border-accent-primary/30"
                          : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}

              {/* Year Filters */}
              {uniqueYears.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-3xs font-bold text-text-muted uppercase tracking-wider mr-1">
                    Year:
                  </span>
                  <button
                    onClick={() => setSelectedYear(FILTER_ALL)}
                    className={cn(
                      "px-2.5 py-1 rounded-control text-2xs font-bold border transition-colors",
                      selectedYear === FILTER_ALL
                        ? "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/35"
                        : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                    )}
                  >
                    All Years
                  </button>
                  {uniqueYears.map((yr) => (
                    <button
                      key={yr}
                      onClick={() => setSelectedYear(yr.toString())}
                      className={cn(
                        "px-2.5 py-1 rounded-control text-2xs font-bold border transition-colors",
                        selectedYear === yr.toString()
                          ? "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/35"
                          : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                      )}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              )}

              {/* Category Filters */}
              {uniqueCategories.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-3xs font-bold text-text-muted uppercase tracking-wider mr-1">
                    Category:
                  </span>
                  <button
                    onClick={() => setSelectedCategory(FILTER_ALL)}
                    className={cn(
                      "px-2.5 py-1 rounded-control text-2xs font-bold border transition-colors",
                      selectedCategory === FILTER_ALL
                        ? "bg-elevated font-semibold text-primary border-border-strong"
                        : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                    )}
                  >
                    All Categories
                  </button>
                  {uniqueCategories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedCategory(c)}
                      className={cn(
                        "px-2.5 py-1 rounded-control text-2xs font-bold border transition-colors",
                        selectedCategory === c
                          ? "bg-elevated font-semibold text-primary border-border-strong"
                          : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-2xs text-text-muted pt-1 border-t border-border-subtle">
              <span>
                Showing <strong>{filteredQuestions.length}</strong> of{" "}
                <strong>{data.prep_questions.length}</strong> authentic questions
              </span>
              {(selectedRound !== FILTER_ALL ||
                selectedYear !== FILTER_ALL ||
                selectedCategory !== FILTER_ALL ||
                searchQuery) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedRound(FILTER_ALL);
                    setSelectedYear(FILTER_ALL);
                    setSelectedCategory(FILTER_ALL);
                  }}
                  className="text-accent-primary hover:underline font-semibold"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Question Cards List */}
          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center rounded-panel bg-surface border border-border-subtle space-y-2">
              <p className="text-xs font-semibold text-text-secondary">
                No previous year questions match your current filter settings.
              </p>
              <p className="text-2xs text-text-muted">
                Try selecting &ldquo;All Rounds&rdquo; or clearing your search query.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredQuestions.map((q, idx) => {
                const isExpanded = expandedAnswers[q.id] ?? false;

                return (
                  <div
                    key={q.id}
                    className="p-4 sm:p-5 rounded-panel bg-surface border border-border-subtle hover:border-border-strong transition-all shadow-subtle space-y-3"
                  >
                    {/* Question Header Badges & Actions */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded-control bg-elevated text-text-muted border border-border-subtle text-3xs font-bold flex items-center justify-center">
                          #{idx + 1}
                        </span>

                        {q.round_name && (
                          <span className="px-2.5 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/25 text-3xs font-bold">
                            {q.round_name}
                          </span>
                        )}

                        <span className="px-2.5 py-0.5 rounded-full bg-accent-secondary/15 text-accent-secondary border border-accent-secondary/30 text-3xs font-bold">
                          {q.category}
                        </span>

                        <span className="px-2.5 py-0.5 rounded-full bg-elevated text-text-muted border border-border-subtle text-3xs font-bold">
                          Year {q.asked_year}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleCopyQuestion(q.id, q.question)}
                          title="Copy question text"
                          className="p-1.5 rounded-control text-text-muted hover:text-primary hover:bg-elevated transition-colors text-2xs flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedId === q.id ? "Copied!" : "Copy"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Question Body */}
                    <div className="text-xs sm:text-sm font-semibold text-primary leading-relaxed whitespace-pre-wrap font-sans selection:bg-accent-primary/20">
                      {q.question}
                    </div>

                    {/* Solution / Answer Notes Toggle */}
                    {q.answer_notes && (
                      <div className="pt-2 border-t border-border-subtle">
                        <button
                          onClick={() => toggleAnswer(q.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Hide Verified Solution & Notes</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>View Verified Solution & Notes</span>
                            </>
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 p-4 rounded-control bg-elevated/70 border border-border-subtle text-2xs sm:text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-mono">
                            <div className="text-3xs font-bold uppercase tracking-wider text-accent-primary mb-2 flex items-center gap-1.5 font-sans">
                              <CheckCircle2 className="w-3.5 h-3.5 text-accent-primary" />
                              <span>Verified Answer Rubric & Solution Logic</span>
                            </div>
                            {q.answer_notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recommended Coding Practice Section */}
        {recommended_problems.length > 0 && (
          <section className="space-y-4 pt-4 border-t border-border-subtle">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-base font-bold text-primary flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-accent-primary" />
                  <span>Frequently Tested Coding Problems ({recommended_problems.length})</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Hand-picked DSA problems tagged specifically for {company.name} recruitment drives
                </p>
              </div>

              <Link
                href={`/dashboard/practice?company=${company.slug}`}
                className="text-xs font-semibold text-accent-primary hover:underline flex items-center gap-1"
              >
                <span>Practice in Arena</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommended_problems.map((p) => {
                const href = p.available
                  ? `/dashboard/practice/${p.problem_slug}`
                  : `/dashboard/practice`;

                return (
                  <Link
                    key={p.problem_slug}
                    href={href}
                    className="p-4 rounded-panel bg-surface border border-border-subtle hover:border-border-strong hover:shadow-subtle transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        {p.difficulty && (
                          <DifficultyBadge difficulty={p.difficulty.toLowerCase() as "easy" | "medium" | "hard"} />
                        )}
                        {p.topic_tag && (
                          <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-elevated text-text-muted border border-border-subtle">
                            {p.topic_tag}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-primary group-hover:text-accent-primary transition-colors line-clamp-1">
                        {p.title ?? p.problem_slug}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between text-2xs font-semibold text-text-muted pt-2 border-t border-border-subtle">
                      <span>Priority #{p.priority}</span>
                      <span className="text-accent-primary group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Solve <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Round Simulation Shortcuts */}
        <section className="p-6 rounded-panel bg-surface border border-border-subtle space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5 text-accent-secondary" />
            <h3 className="text-sm font-bold">Simulate {company.name} Drive Rounds</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/dashboard/soft-skills"
              className="p-3.5 rounded-control bg-elevated border border-border-subtle hover:border-border-strong hover:bg-elevated/80 transition-all flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-primary">Round 1: Cognitive & Soft Skills</div>
                <div className="text-2xs text-text-muted mt-0.5">Practice 25 timed MCQs with answer review</div>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href="/dashboard/interviews"
              className="p-3.5 rounded-control bg-elevated border border-border-subtle hover:border-border-strong hover:bg-elevated/80 transition-all flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-primary">Round 3: AI Spoken Interview</div>
                <div className="text-2xs text-text-muted mt-0.5">Real-time voice & STAR feedback</div>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              href={`/dashboard/practice?company=${company.slug}`}
              className="p-3.5 rounded-control bg-elevated border border-border-subtle hover:border-border-strong hover:bg-elevated/80 transition-all flex items-center justify-between group"
            >
              <div>
                <div className="text-xs font-bold text-primary">Round 2: Coding Assessment</div>
                <div className="text-2xs text-text-muted mt-0.5">Practice with test cases & code editor</div>
              </div>
              <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

