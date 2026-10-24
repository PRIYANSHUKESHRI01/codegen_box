"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Code2,
  FileQuestion,
  Layers,
  ListChecks,
  MessageSquare,
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CompanyPrepSummary } from "@/types/companyPrep";

const ROUND_FILTER_ALL = "All";

export default function CompanyPrepHubPage() {
  const { status: authStatus } = useAuthGuard(["user"]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyPrepSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRound, setSelectedRound] = useState(ROUND_FILTER_ALL);

  useEffect(() => {
    if (authStatus !== "ready") return;
    let cancelled = false;

    api
      .get<{ companies: CompanyPrepSummary[] }>("/company-prep")
      .then((res) => {
        if (cancelled) return;
        setCompanies(res.companies ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCompanies([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  // Aggregate all unique round names across all companies
  const allRounds = useMemo(() => {
    const roundsSet = new Set<string>();
    companies.forEach((c) => {
      c.rounds.forEach((r) => roundsSet.add(r));
    });
    return Array.from(roundsSet);
  }, [companies]);

  // Total statistics across company catalog
  const totalQuestions = useMemo(() => {
    return companies.reduce((sum, c) => sum + c.prep_questions_count, 0);
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        c.name.toLowerCase().includes(query) ||
        (c.industry && c.industry.toLowerCase().includes(query)) ||
        c.rounds.some((r) => r.toLowerCase().includes(query));

      const matchesRound =
        selectedRound === ROUND_FILTER_ALL || c.rounds.includes(selectedRound);

      return matchesSearch && matchesRound;
    });
  }, [companies, searchQuery, selectedRound]);

  if (authStatus !== "ready" || loading) {
    return <SessionLoader label="Loading company PYQs and prep catalog..." />;
  }

  return (
    <DashboardShell
      role="user"
      title="Previous Year Questions (PYQs)"
      subtitle="Authentic company-wise and round-wise question banks from campus recruitment drives"
    >
      <div className="space-y-6">
        {/* Hero Banner */}
        <section className="p-6 sm:p-8 rounded-panel bg-gradient-to-r from-accent-primary/10 via-surface to-accent-secondary/10 border border-border-subtle shadow-subtle relative overflow-hidden">
          <div className="max-w-2xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-primary/15 border border-accent-primary/30 text-accent-primary text-2xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Recruitment Archives</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-primary tracking-tight">
              Master Previous Year Drive Questions
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              Prepare with verified questions asked in campus recruitment drives over the last 5 years.
              Practice Communication Versant rounds, STAR-format Soft Skills interviews, Coding challenges, and Technical Pseudocode.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-border-subtle/80">
            <div>
              <div className="text-xs text-text-muted">Companies Curated</div>
              <div className="text-lg font-bold font-mono text-primary mt-0.5">{companies.length}</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Archived Questions</div>
              <div className="text-lg font-bold font-mono text-accent-primary mt-0.5">{totalQuestions} PYQs</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Years Covered</div>
              <div className="text-lg font-bold font-mono text-accent-secondary mt-0.5">2021 – 2025</div>
            </div>
            <div>
              <div className="text-xs text-text-muted">Verified Rounds</div>
              <div className="text-lg font-bold font-mono text-status-success mt-0.5">4 Stages</div>
            </div>
          </div>
        </section>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company name, industry, or round (e.g. Accenture)..."
                className="w-full pl-9 pr-3 py-2 rounded-control bg-elevated border border-border-subtle text-xs text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary transition-colors"
              />
            </div>
            <div className="text-2xs text-text-muted font-mono self-end sm:self-center">
              Showing {filteredCompanies.length} of {companies.length} companies
            </div>
          </div>

          {/* Round Filter Tabs */}
          {allRounds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border-subtle/60">
              <span className="text-3xs font-bold text-text-muted uppercase tracking-wider mr-1 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>Round:</span>
              </span>
              <button
                onClick={() => setSelectedRound(ROUND_FILTER_ALL)}
                className={cn(
                  "px-2.5 py-1 rounded-control text-2xs font-bold border transition-colors",
                  selectedRound === ROUND_FILTER_ALL
                    ? "bg-accent-primary text-white border-accent-primary"
                    : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                )}
              >
                All Rounds
              </button>
              {allRounds.map((round) => (
                <button
                  key={round}
                  onClick={() => setSelectedRound(round)}
                  className={cn(
                    "px-2.5 py-1 rounded-control text-2xs font-bold border transition-colors",
                    selectedRound === round
                      ? "bg-accent-primary text-white border-accent-primary"
                      : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                  )}
                >
                  {round}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Company Cards Grid */}
        {filteredCompanies.length === 0 ? (
          <div className="p-10 text-center rounded-panel bg-surface border border-border-subtle space-y-3">
            <Building2 className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-sm font-semibold text-primary">No companies match your filters</p>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Try adjusting your search query or selecting &ldquo;All Rounds&rdquo; to see all available company prep packs.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedRound(ROUND_FILTER_ALL);
              }}
              className="px-3 py-1.5 rounded-control bg-accent-primary text-white text-xs font-semibold hover:bg-accent-primary/90 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCompanies.map((company) => {
              const yearsSpan =
                company.years.length > 0
                  ? `${Math.min(...company.years)} – ${Math.max(...company.years)}`
                  : null;

              return (
                <div
                  key={company.id}
                  className="rounded-panel bg-surface border border-border-subtle hover:border-border-strong shadow-subtle hover:shadow-elevation transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="p-5 sm:p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl shrink-0 p-2 rounded-control bg-elevated/70 border border-border-subtle">
                          {company.logo ?? "🏢"}
                        </span>
                        <div>
                          <h3 className="text-base font-bold text-primary group-hover:text-accent-primary transition-colors">
                            {company.name}
                          </h3>
                          <p className="text-2xs text-text-muted">{company.industry ?? "Technology Services"}</p>
                        </div>
                      </div>
                      {company.has_live_drive && (
                        <span className="px-2 py-0.5 rounded-full bg-status-success/15 border border-status-success/30 text-status-success text-3xs font-bold whitespace-nowrap inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Campus Drive Live</span>
                        </span>
                      )}
                    </div>

                    {/* Overview snippet */}
                    {company.overview && (
                      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                        {company.overview}
                      </p>
                    )}

                    {/* Stats pills */}
                    <div className="flex items-center gap-2 flex-wrap text-2xs pt-1">
                      <span className="px-2.5 py-1 rounded-control bg-accent-primary/10 border border-accent-primary/25 text-accent-primary font-bold font-mono">
                        {company.prep_questions_count} PYQs Archived
                      </span>
                      {yearsSpan && (
                        <span className="px-2.5 py-1 rounded-control bg-elevated border border-border-subtle text-text-secondary font-mono">
                          {yearsSpan} ({company.years.length} Yrs)
                        </span>
                      )}
                      {company.recommended_problems_count > 0 && (
                        <span className="px-2.5 py-1 rounded-control bg-accent-secondary/10 border border-accent-secondary/25 text-accent-secondary font-bold font-mono">
                          {company.recommended_problems_count} DSA Problems
                        </span>
                      )}
                    </div>

                    {/* Rounds coverage */}
                    {company.rounds.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">
                          Rounds Covered:
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {company.rounds.map((r) => (
                            <span
                              key={r}
                              className="px-2 py-0.5 rounded-full bg-elevated border border-border-subtle text-3xs text-text-secondary"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-4 px-5 sm:px-6 bg-elevated/40 border-t border-border-subtle flex items-center justify-between gap-3">
                    <span className="text-2xs text-text-muted font-mono">
                      {company.hiring_process.length > 0
                        ? `${company.hiring_process.length} Assessment Stages`
                        : "Full Prep Pack"}
                    </span>
                    <Link
                      href={`/dashboard/company-prep/view?company=${company.slug}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary text-white text-xs font-bold hover:bg-accent-primary/90 transition-colors shadow-subtle"
                    >
                      <span>Explore PYQs</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
