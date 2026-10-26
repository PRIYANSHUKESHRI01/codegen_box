"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Ban, CheckCircle2, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { UserManageDrawer } from "./UserManageDrawer";
import { formatDateTime, type ApiPage, type ApiPlatformUser } from "./types";
import { UniversityPicker, useDirectoryFacets } from "./DirectoryFilters";
import { departmentShort, useBranchCatalog } from "@/lib/branches";
import { type ToastTrigger } from "@/lib/toast";

const TIER_BADGE_CLASS: Record<string, string> = {
  "Placement Ready": "bg-status-success/15 text-status-success border-status-success/30",
  "In Progress": "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30",
  "Needs Training": "bg-status-warning/15 text-status-warning border-status-warning/30",
};

/** After this long a first load is worth explaining rather than leaving a bare placeholder on screen. */
const SLOW_AFTER_MS = 4_000;

export function StudentsPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [students, setStudents] = useState<ApiPlatformUser[]>([]);
  // `loaded` flips once any answer has arrived; until then there is nothing to show but a placeholder. After that a new
  // filter keeps the previous rows on screen (dimmed) while the next answer is on its way, instead of blanking the table.
  const [loaded, setLoaded] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  // Whether the rows on screen are the answer to a filtered request — the count line describes the DATA, so while a new
  // filter is still loading it must not already claim "match this filter" about the previous, unfiltered rows.
  const [answeredFiltered, setAnsweredFiltered] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null);

  const [collegeId, setCollegeId] = useState("");
  // Superadmin sees every department; narrowing to one is a filter, never a restriction.
  const catalog = useBranchCatalog();
  const [department, setDepartment] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // The numbers beside each filter, worked out under every OTHER filter: a university's count is its students of the
  // chosen department, a department's count is its students at the chosen university — exactly what picking it shows.
  const facets = useDirectoryFacets({ role: "user", collegeId, department, hasCollege: true, search: searchDebounced });

  const buildParams = useCallback((extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ role: "user", has_college: "1", ...extra });
    if (searchDebounced) params.set("search", searchDebounced);
    if (collegeId) params.set("college_id", collegeId);
    if (department) params.set("department", department);
    return params;
  }, [searchDebounced, collegeId, department]);

  // Only the newest request may write to the screen: with several filters changed in quick succession, a slow answer to an
  // old filter must never land on top of the answer to the current one.
  const latest = useRef(0);

  const load = useCallback(() => {
    const ticket = ++latest.current;
    const askedFiltered = Boolean(searchDebounced || collegeId || department);
    setFetching(true);
    setError(null);

    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams().toString()}`)
      .then((res) => {
        if (ticket !== latest.current) return;
        setStudents(res.data);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
        setTotal(res.total);
        setAnsweredFiltered(askedFiltered);
        setLoaded(true);
      })
      .catch((err) => {
        if (ticket !== latest.current) return;
        const message = err instanceof ApiError ? err.message : "Failed to load students.";
        setError(message);
        triggerToast(message, "error");
      })
      .finally(() => {
        if (ticket === latest.current) setFetching(false);
      });
  }, [buildParams, searchDebounced, collegeId, department, triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  // A request that is taking its time says so, once, instead of leaving "Loading…" looking like the page has hung.
  useEffect(() => {
    if (!fetching) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [fetching]);

  const loadMore = () => {
    const ticket = latest.current;
    setLoadingMore(true);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams({ page: String(page + 1) }).toString()}`)
      .then((res) => {
        // The filters changed while this page was on its way — it belongs to a list that is no longer on screen.
        if (ticket !== latest.current) return;
        setStudents((prev) => [...prev, ...res.data]);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more students.", "error"))
      .finally(() => setLoadingMore(false));
  };

  const filtered = Boolean(searchDebounced || collegeId || department);
  const clearFilters = () => {
    setSearch("");
    setSearchDebounced("");
    setCollegeId("");
    setDepartment("");
  };

  const departmentCount = (code: string): number | null => (facets?.departments ? facets.departments[code] ?? 0 : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Students</h2>
          <p className="text-xs text-text-muted" aria-live="polite">
            {total === null
              ? error
                ? "Couldn't load the list."
                : "Loading students…"
              : `${total.toLocaleString()} student(s) ${answeredFiltered ? "match this filter" : "enrolled via a partner college"}.`}
            {loaded && fetching && <span className="ml-2 inline-flex items-center gap-1 text-accent-primary"><RefreshCw className="h-3 w-3 animate-spin" aria-hidden />Updating…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <UniversityPicker value={collegeId} onChange={setCollegeId} facets={facets} allowNone={false} />
          <select
            aria-label="Filter by department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-xs text-primary outline-none focus:border-accent-primary"
          >
            <option value="">All departments</option>
            {(catalog?.departments ?? []).map((d) => {
              const count = departmentCount(d.code);
              return (
                <option key={d.code} value={d.code}>
                  {count === null ? d.name : `${d.name} (${count.toLocaleString()})`}
                </option>
              );
            })}
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              aria-label="Search students"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, handle, email..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
            />
          </div>
        </div>
      </div>

      {!loaded && !error ? (
        <div role="status" aria-label="Loading students" className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="divide-y divide-border-subtle" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-elevated" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-elevated" />
                  <div className="h-2.5 w-56 animate-pulse rounded bg-elevated" />
                </div>
                <div className="hidden h-3 w-32 animate-pulse rounded bg-elevated sm:block" />
                <div className="hidden h-5 w-20 animate-pulse rounded-full bg-elevated md:block" />
              </div>
            ))}
          </div>
          {slow && <p className="border-t border-border-subtle px-4 py-3 text-center text-xs text-text-muted">Still working — this is taking longer than usual. The server may be busy.</p>}
        </div>
      ) : !loaded && error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-panel border border-status-danger/30 bg-status-danger/5 p-8 text-center">
          <AlertTriangle className="h-5 w-5 text-status-danger" aria-hidden />
          <p className="text-xs font-semibold text-primary">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        </div>
      ) : students.length === 0 ? (
        <div className="space-y-3 rounded-panel border border-border-subtle bg-surface p-8 text-center text-xs text-text-muted">
          <p>{filtered ? "No students match this filter." : "No students found."}</p>
          {filtered && (
            <button onClick={clearFilters} className="rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={cn("rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle transition-opacity", fetching && "opacity-60")} aria-busy={fetching}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">College</th>
                  <th className="px-4 py-3">Department · Branch</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Readiness</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {students.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setActiveStudentId(s.id)}
                    className="hover:bg-surface-hover/60 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="font-bold text-primary">{s.name}</div>
                      <div className="text-3xs font-mono text-text-muted">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-medium">{s.college?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      <div>{s.branch ?? "—"}</div>
                      <div className="text-3xs text-text-muted">{departmentShort(catalog, s.department ?? "engineering")}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {s.subscription ? (
                        <>
                          <div className="font-semibold text-primary">{s.subscription.plan_name}</div>
                          <div className="text-3xs text-text-muted">
                            {s.subscription.source === "institution" ? "via college" : s.subscription.days_remaining === null ? "never expires" : s.subscription.days_remaining <= 0 ? "ended" : `${s.subscription.days_remaining} days left`}
                          </div>
                        </>
                      ) : (
                        s.subscription_plan_name ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.readiness_tier ? (
                        <span className={cn("px-2 py-0.5 text-3xs font-bold rounded-full border", TIER_BADGE_CLASS[s.readiness_tier])}>
                          {s.readiness_tier}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatDateTime(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-full",
                          s.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success"
                        )}
                      >
                        {s.is_blocked ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span>{s.is_blocked ? "Blocked" : "Active"}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="p-3 border-t border-border-subtle flex flex-col items-center gap-1">
              <button
                onClick={loadMore}
                disabled={loadingMore || fetching}
                className="px-4 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
              {total !== null && <span className="text-3xs text-text-muted">Showing {students.length.toLocaleString()} of {total.toLocaleString()}</span>}
            </div>
          )}
        </div>
      )}

      {activeStudentId && (
        <UserManageDrawer
          userId={activeStudentId}
          onClose={() => setActiveStudentId(null)}
          onChanged={load}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}
