"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, FileCode2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

interface ApiProblem {
  id: number;
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  created_at: string;
  submissions_count: number;
  accepted_submissions_count: number;
  acceptance_rate: number | null;
}

interface ApiPage<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

interface ProblemsResponse {
  problems: ApiPage<ApiProblem>;
  counts: { total: number; easy: number; medium: number; hard: number };
}

const DIFFICULTY_BADGE: Record<ApiProblem["difficulty"], string> = {
  easy: "bg-status-success/15 text-status-success border-status-success/30",
  medium: "bg-status-warning/15 text-status-warning border-status-warning/30",
  hard: "bg-status-danger/15 text-status-danger border-status-danger/30",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The real problem catalog — replaces a hardcoded 5-row mock table (with
 * fabricated "In Review"/"Needs Testcases" statuses and a fake "Add
 * Problem" button that never called any API). Submission/acceptance
 * numbers here are live, computed from the real submissions table (see
 * AdminProblemController::index()) rather than Problem's own
 * total_submissions/acceptance_rate columns, which turned out to be static
 * seed flavor-text (e.g. "284,190 submissions" against a platform that has
 * recorded a few dozen real ones, total). No "Add Problem" action exists
 * here — problems are authored through a structured function-signature +
 * verified-test-case pipeline (see AdminProblemController::store()'s own
 * docblock), which has no quick-form equivalent yet; showing one that
 * didn't actually work would be the same kind of fabrication this panel
 * replaces.
 */
export function ProblemBankPanel({ triggerToast }: { triggerToast: (msg: string) => void }) {
  const [problems, setProblems] = useState<ApiProblem[]>([]);
  const [counts, setCounts] = useState<ProblemsResponse["counts"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [difficulty, setDifficulty] = useState<"" | ApiProblem["difficulty"]>("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    (s: string, diff: string) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (s) params.set("search", s);
      if (diff) params.set("difficulty", diff);
      api
        .get<ProblemsResponse>(`/admin/problems?${params.toString()}`)
        .then((res) => {
          setProblems(res.problems.data);
          setCounts(res.counts);
          setPage(res.problems.current_page);
          setHasMore(res.problems.current_page < res.problems.last_page);
        })
        .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load the problem catalog."))
        .finally(() => setLoading(false));
    },
    [triggerToast]
  );

  useEffect(() => {
    load(searchDebounced, difficulty);
  }, [searchDebounced, difficulty, load]);

  const loadMore = () => {
    setLoadingMore(true);
    const params = new URLSearchParams({ page: String(page + 1) });
    if (searchDebounced) params.set("search", searchDebounced);
    if (difficulty) params.set("difficulty", difficulty);
    api
      .get<ProblemsResponse>(`/admin/problems?${params.toString()}`)
      .then((res) => {
        setProblems((prev) => [...prev, ...res.problems.data]);
        setPage(res.problems.current_page);
        setHasMore(res.problems.current_page < res.problems.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more problems."))
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-accent-primary" />
            <span>Problem Bank</span>
          </h2>
          <p className="text-xs text-text-muted">{counts?.total ?? "—"} problem(s) in the catalog students practice against.</p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["", "easy", "medium", "hard"] as const).map((d) => (
          <button
            key={d || "all"}
            onClick={() => setDifficulty(d)}
            className={cn(
              "p-3.5 rounded-panel border shadow-subtle text-left transition-colors",
              difficulty === d ? "border-accent-primary bg-accent-primary/5" : "border-border-subtle bg-surface hover:border-border-strong"
            )}
          >
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">
              {d === "" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
            </span>
            <span className="text-xl font-black text-primary mt-1 block font-mono">
              {counts ? (d === "" ? counts.total : counts[d]) : "—"}
            </span>
          </button>
        ))}
      </div>

      <div className="p-3 rounded-control bg-accent-primary/5 border border-accent-primary/20 flex items-start gap-2 text-[11px] text-text-secondary">
        <Info className="w-3.5 h-3.5 text-accent-primary shrink-0 mt-0.5" />
        <span>
          New problems are authored through Mellow&apos;s structured problem-generation pipeline (a function signature plus a
          judge-verified reference solution), not from this screen — this view is the real, read-only catalog.
        </span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Loading problem catalog...</div>
      ) : problems.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          {searchDebounced ? "No problems match your search." : "No problems in the catalog yet."}
        </div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Difficulty</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Added</th>
                  <th className="px-4 py-3 text-right">Real Submissions</th>
                  <th className="px-4 py-3 text-right">Real Acceptance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {problems.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-primary">{p.title}</div>
                      <div className="text-[10px] font-mono text-text-muted">/{p.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full border", DIFFICULTY_BADGE[p.difficulty])}>
                        {p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(p.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded bg-elevated text-text-secondary border border-border-subtle">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-text-muted whitespace-nowrap">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right font-mono text-primary">{p.submissions_count}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">
                      {p.acceptance_rate !== null ? `${p.acceptance_rate}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="p-3 border-t border-border-subtle flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
