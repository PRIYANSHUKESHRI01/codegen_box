"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Swords,
  ArrowRight,
  Search,
  Target,
  Flame,
  CheckCircle2,
  Sparkles,
  Percent,
  X,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { TopicMasteryList } from "@/components/dashboard/student/TopicMasteryList";
import { StatTile } from "@/components/dashboard/student/StatTile";
import { UsageLimitBanner } from "@/components/billing/UsageLimitBanner";
import { ProblemSummary } from "@/types/problem";
import type { MySubscriptionResponse } from "@/types/subscription";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useMyStats } from "@/lib/useMyStats";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

export default function PracticeArenaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-xs text-text-muted">
          Loading Practice Arena...
        </div>
      }
    >
      <PracticeArenaPageContent />
    </Suspense>
  );
}

const PAGE_SIZE = 10;

type DifficultyFilter = "all" | "easy" | "medium" | "hard";

const DIFFICULTY_FILTERS: { key: DifficultyFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
];

/** LeetCode-style compact pagination: first, last, a window around current, "…" for gaps. */
function pageNumbersWithEllipsis(current: number, total: number): (number | "ellipsis")[] {
  const keep = new Set<number>([1, total]);
  for (let d = -1; d <= 1; d++) {
    const p = current + d;
    if (p >= 1 && p <= total) keep.add(p);
  }
  const sorted = Array.from(keep).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

function PracticeArenaPageContent() {
  const { status } = useAuthGuard(["user"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  // The input stays instantly responsive (bound to `query` directly) — only
  // the actual re-filtering of the (up to thousands-strong) problem catalog
  // uses this debounced value.
  const debouncedQuery = useDebouncedValue(query, 250);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");
  const [page, setPage] = useState(1);
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [problemsLoading, setProblemsLoading] = useState(true);

  const { stats } = useMyStats(status === "ready");
  const [entitlements, setEntitlements] = useState<MySubscriptionResponse["entitlements"]>(undefined);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;

    api
      .get<{ problems: ProblemSummary[] }>("/problems")
      .then((res) => {
        if (!cancelled) setProblems(res.problems);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProblemsLoading(false);
      });

    api
      .get<MySubscriptionResponse>("/me/subscription")
      .then((res) => {
        if (!cancelled) setEntitlements(res.entitlements);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [status]);

  // A drive's "Prepare" page links here with a curated slug list (and the
  // company name) to filter the real problem catalog down to that company's
  // recommended set.
  const slugsParam = searchParams.get("slugs");
  const companyParam = searchParams.get("company");
  const curatedSlugs = useMemo(
    () => (slugsParam ? new Set(slugsParam.split(",").map((s) => s.trim()).filter(Boolean)) : null),
    [slugsParam]
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, difficultyFilter, slugsParam]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const matchesQuery = (p: ProblemSummary) =>
    !debouncedQuery.trim() ||
    p.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
    p.tags.some((t) => t.toLowerCase().includes(debouncedQuery.toLowerCase()));

  const matchesDifficulty = (p: ProblemSummary) =>
    difficultyFilter === "all" || p.difficulty === difficultyFilter;

  const recommended = curatedSlugs
    ? problems.filter((p) => curatedSlugs.has(p.slug) && matchesQuery(p))
    : [];

  // Full catalog mode: every problem matching the filters, paginated — no
  // more hard cap at 6. Curated mode (company prep) ignores pagination since
  // those lists are short by construction.
  const catalogFiltered = curatedSlugs ? [] : problems.filter((p) => matchesQuery(p) && matchesDifficulty(p));
  const catalogPageCount = Math.max(1, Math.ceil(catalogFiltered.length / PAGE_SIZE));
  const catalogPage = Math.min(page, catalogPageCount);
  const paginatedCatalog = catalogFiltered.slice((catalogPage - 1) * PAGE_SIZE, catalogPage * PAGE_SIZE);

  const displayList = curatedSlugs ? recommended : paginatedCatalog;

  const totalSubs = stats?.verdict_stats.reduce((s, v) => s + v.count, 0) ?? 0;
  const accepted = stats?.verdict_stats.find((v) => v.status === "accepted")?.count ?? 0;
  const acceptanceRate = totalSubs > 0 ? Math.round((accepted / totalSubs) * 100) : 0;

  return (
    <DashboardShell
      role="user"
      title="Practice Arena"
      subtitle="The real problem catalog, your real progress."
      actionButton={{
        label: "Browse Contests",
        icon: Swords,
        onClick: () => router.push("/dashboard/contests"),
      }}
    >
      {entitlements && (
        <UsageLimitBanner
          label="practice problems"
          used={entitlements.practice_problems_used_today}
          max={entitlements.max_practice_problems_per_day}
        />
      )}

      {/* KPI strip — every value real */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Problems Solved"
          value={stats?.solved.total_solved ?? 0}
          icon={CheckCircle2}
          tone="success"
          hint={`${stats?.solved.hard.solved ?? 0} hard problems`}
        />
        <StatTile
          label="Solved This Week"
          value={stats?.weekly_goals.solved_this_week.current ?? 0}
          suffix={`/ ${stats?.weekly_goals.solved_this_week.target ?? 20}`}
          icon={Target}
          tone="secondary"
          hint="Your weekly goal"
        />
        <StatTile
          label="Current Streak"
          value={stats?.streak.current ?? 0}
          suffix="days"
          icon={Flame}
          tone="warning"
          hint="Solve one problem to extend it"
        />
        <StatTile
          label="Acceptance Rate"
          value={`${acceptanceRate}%`}
          icon={Percent}
          tone="primary"
          hint={`${accepted} of ${totalSubs} submissions`}
        />
      </div>

      {/* Recommended + topic ladder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-primary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-secondary" />
                <span>{curatedSlugs ? "Recommended For You" : "Problem Catalog"}</span>
                {!curatedSlugs && !problemsLoading && (
                  <span className="px-1.5 py-0.5 rounded bg-elevated border border-border-subtle text-[10px] font-mono font-bold text-text-muted">
                    {problems.length} total
                  </span>
                )}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {curatedSlugs
                  ? `Curated by Mellow staff for ${companyParam ?? "your"} interviews.`
                  : "Every real problem in the catalog — filter by title, tag, or difficulty."}
              </p>
            </div>
            <div className="relative shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter problems or tags..."
                className="pl-8 pr-3 py-1.5 w-full sm:w-56 rounded-control bg-surface border border-border-subtle text-xs text-primary placeholder:text-text-muted outline-none focus:border-accent-primary transition-colors"
              />
            </div>
          </div>

          {!curatedSlugs && !problemsLoading && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {DIFFICULTY_FILTERS.map(({ key, label }) => {
                const count =
                  key === "all" ? problems.length : problems.filter((p) => p.difficulty === key).length;
                const active = difficultyFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setDifficultyFilter(key)}
                    className={cn(
                      "px-2.5 py-1 rounded-control text-[11px] font-bold transition-colors border",
                      active
                        ? key === "easy"
                          ? "bg-status-success text-white border-transparent"
                          : key === "medium"
                          ? "bg-status-warning text-white border-transparent"
                          : key === "hard"
                          ? "bg-status-danger text-white border-transparent"
                          : "bg-accent-primary text-white border-transparent"
                        : "bg-elevated border-border-subtle text-text-muted hover:text-primary hover:border-accent-primary/40"
                    )}
                  >
                    {label} <span className="opacity-70 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {curatedSlugs && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-control bg-accent-primary/10 border border-accent-primary/25 text-xs">
              <span className="text-accent-primary font-semibold">
                Showing {recommended.length} problem{recommended.length === 1 ? "" : "s"} recommended for your{" "}
                {companyParam ?? "company"} prep
              </span>
              <button
                onClick={() => router.push("/dashboard/practice")}
                className="font-bold text-accent-primary hover:underline flex items-center gap-1 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear filter</span>
              </button>
            </div>
          )}

          <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden">
          <div className="divide-y divide-border-subtle">
            {problemsLoading ? (
              <div className="p-8 text-center text-xs text-text-muted">Loading problems...</div>
            ) : displayList.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                {query || difficultyFilter !== "all"
                  ? "No problems match your filters."
                  : "No recommended problems found."}
              </div>
            ) : (
              displayList.map((problem) => (
                <div
                  key={problem.id}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-surface-hover/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-[10px] font-bold rounded capitalize",
                          problem.difficulty === "easy"
                            ? "bg-status-success/15 text-status-success"
                            : problem.difficulty === "medium"
                            ? "bg-status-warning/15 text-status-warning"
                            : "bg-status-danger/15 text-status-danger"
                        )}
                      >
                        {problem.difficulty}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-primary truncate">{problem.title}</h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {problem.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded bg-elevated border border-border-subtle text-[10px] text-text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                      {problem.acceptance_rate !== null && (
                        <span className="text-[10px] text-text-muted font-mono">
                          {problem.acceptance_rate}% accepted
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {problem.solved && (
                      <CheckCircle2
                        className="w-4 h-4 text-status-success shrink-0"
                        aria-label="Solved"
                      />
                    )}
                    <button
                      onClick={() => router.push(`/dashboard/practice/${problem.slug}`)}
                      className="px-3 py-1.5 rounded-control bg-elevated hover:bg-accent-primary hover:text-white border border-border-subtle hover:border-transparent text-xs font-bold text-primary transition-all shrink-0"
                    >
                      Solve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {!curatedSlugs && !problemsLoading && catalogPageCount > 1 && (
            <div className="p-3 border-t border-border-subtle flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[11px] text-text-muted">
                Showing {(catalogPage - 1) * PAGE_SIZE + 1}–
                {Math.min(catalogPage * PAGE_SIZE, catalogFiltered.length)} of {catalogFiltered.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={catalogPage === 1}
                  className="px-2.5 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  Previous
                </button>
                {pageNumbersWithEllipsis(catalogPage, catalogPageCount).map((p, i) =>
                  p === "ellipsis" ? (
                    <span key={`ellipsis-${i}`} className="px-1.5 text-text-muted text-xs">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={cn(
                        "w-7 h-7 rounded-control text-[11px] font-bold transition-colors border",
                        p === catalogPage
                          ? "bg-accent-primary text-white border-transparent"
                          : "bg-elevated hover:bg-surface-hover text-text-secondary border-border-subtle"
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setPage((p) => Math.min(catalogPageCount, p + 1))}
                  disabled={catalogPage === catalogPageCount}
                  className="px-2.5 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-primary flex items-center gap-2">
                <Target className="w-4 h-4 text-accent-secondary" />
                <span>Topic Ladder</span>
              </h3>
              <Link href="/dashboard/reports" className="text-[11px] font-semibold text-accent-primary hover:underline">
                Details
              </Link>
            </div>
            {stats && stats.topic_mastery.length > 0 ? (
              <TopicMasteryList topics={stats.topic_mastery} limit={6} />
            ) : (
              <p className="text-xs text-text-muted text-center py-6">Solve a few problems to see this fill in.</p>
            )}
          </div>

          <div className="p-5 rounded-panel bg-surface border border-accent-primary/25 shadow-subtle space-y-3">
            <h3 className="font-bold text-sm text-primary flex items-center gap-2">
              <Swords className="w-4 h-4 text-accent-primary" />
              <span>Rated Contests</span>
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Compete head-to-head against real deadlines and a real rating that goes up or down — a different way
              to practice than solving on your own.
            </p>
            <Link
              href="/dashboard/contests"
              className="w-full py-2.5 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow flex items-center justify-center gap-1.5"
            >
              <span>Browse Contests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
