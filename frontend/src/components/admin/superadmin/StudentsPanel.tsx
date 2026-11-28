"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Ban, CheckCircle2, RefreshCw, AlertTriangle, Download, UserX, KeyRound, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { downloadApiFile } from "@/lib/download";
import { UserManageDrawer } from "./UserManageDrawer";
import { ReadinessReportModal } from "./ReadinessReportModal";
import { formatDateTime, type ApiPage, type ApiPlatformUser } from "./types";
import { MvProfileBadge } from "./MvProfileBadge";
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

  // Bulk operations across multiple students (for campus placement drives and high-concurrency scale)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const [affiliation, setAffiliation] = useState<"all" | "college" | "independent">("all");
  const [downloading, setDownloading] = useState(false);
  const [collegeId, setCollegeId] = useState("");
  // Superadmin sees every department; narrowing to one is a filter, never a restriction.
  const catalog = useBranchCatalog();
  const [department, setDepartment] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("");
  const [mvSource, setMvSource] = useState<"" | "mellow_vault" | "aptrun_only">("");
  const [syncingMv, setSyncingMv] = useState(false);
  const [showReadinessModal, setShowReadinessModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // The numbers beside each filter, worked out under every OTHER filter: a university's count is its students of the
  // chosen department, a department's count is its students at the chosen university — exactly what picking it shows.
  const facets = useDirectoryFacets({
    role: "user",
    collegeId,
    department,
    hasCollege: affiliation === "all" ? undefined : affiliation === "college",
    search: searchDebounced,
  });

  const buildParams = useCallback((extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ role: "user", ...extra });
    if (affiliation === "college") params.set("has_college", "1");
    else if (affiliation === "independent") params.set("has_college", "0");
    if (searchDebounced) params.set("search", searchDebounced);
    if (collegeId) params.set("college_id", collegeId);
    if (department) params.set("department", department);
    if (readinessFilter === "above_75") params.set("min_readiness", "75");
    else if (readinessFilter === "above_60") params.set("min_readiness", "60");
    else if (readinessFilter === "above_50") params.set("min_readiness", "50");
    else if (readinessFilter === "below_60") params.set("max_readiness", "59");
    else if (readinessFilter === "placement_ready") params.set("readiness_tier", "Placement Ready");
    else if (readinessFilter === "in_progress") params.set("readiness_tier", "In Progress");
    else if (readinessFilter === "needs_training") params.set("readiness_tier", "Needs Training");
    if (sortOrder) params.set("sort", sortOrder);
    if (mvSource) params.set("mv_source", mvSource);
    return params;
  }, [affiliation, searchDebounced, collegeId, department, readinessFilter, sortOrder, mvSource]);

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const params = buildParams();
      const filename = affiliation === "independent" ? "aptrun-independent-students.csv" : "aptrun-students-report.csv";
      await downloadApiFile(`/superadmin/users/export?${params.toString()}`, filename);
      triggerToast("Students report downloaded successfully.");
    } catch {
      triggerToast("Failed to download students report.", "error");
    } finally {
      setDownloading(false);
    }
  };

  // Only the newest request may write to the screen: with several filters changed in quick succession, a slow answer to an
  // old filter must never land on top of the answer to the current one.
  const latest = useRef(0);

  const load = useCallback(() => {
    const ticket = ++latest.current;
    const askedFiltered = Boolean(searchDebounced || collegeId || department || affiliation !== "all" || readinessFilter || mvSource);
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

  const filtered = Boolean(searchDebounced || collegeId || department || affiliation !== "all" || readinessFilter || sortOrder || mvSource);
  const clearFilters = () => {
    setSearch("");
    setSearchDebounced("");
    setCollegeId("");
    setDepartment("");
    setAffiliation("all");
    setReadinessFilter("");
    setSortOrder("");
    setMvSource("");
  };

  const handleSyncMvProfiles = async () => {
    setSyncingMv(true);
    try {
      const res = await api.post<{ configured: boolean; matched_users: number; updated_users: number; eligible_90: number }>(
        "/superadmin/mellow-vault/sync-profiles",
        { max_emails: 0 }
      );
      if (!res.configured) {
        triggerToast("Mellow Vault database is not configured.", "error");
      } else {
        triggerToast(`Synced ${res.matched_users} Mellow Vault user(s) (${res.eligible_90} at 90%+).`);
        load();
      }
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to sync Mellow Vault percentages.", "error");
    } finally {
      setSyncingMv(false);
    }
  };

  const departmentCount = (code: string): number | null => (facets?.departments ? facets.departments[code] ?? 0 : null);

  const isAllOnPageSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));

  const toggleSelectAllOnPage = () => {
    const next = new Set(selectedIds);
    if (isAllOnPageSelected) {
      students.forEach((s) => next.delete(s.id));
    } else {
      students.forEach((s) => next.add(s.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectUser = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkAction = async (action: "revoke_sessions" | "toggle_block" | "send_credentials") => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const confirmText =
      action === "revoke_sessions"
        ? `Are you sure you want to revoke all active sessions for ${count} selected student(s)? They will be immediately signed out across all devices.`
        : action === "toggle_block"
        ? `Are you sure you want to toggle the block status for ${count} selected student(s)?`
        : `Are you sure you want to regenerate and dispatch new credentials to ${count} selected student(s) via email?`;

    if (!window.confirm(confirmText)) return;

    setBulkProcessing(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>("/superadmin/users/bulk-action", {
        user_ids: Array.from(selectedIds),
        action,
      });
      triggerToast(res.message);
      setSelectedIds(new Set());
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Bulk action failed.", "error");
    } finally {
      setBulkProcessing(false);
    }
  };

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
              : `${total.toLocaleString()} student(s) ${answeredFiltered ? "match this filter" : affiliation === "independent" ? "registered independently" : "enrolled via a partner college"}.`}
            {loaded && fetching && <span className="ml-2 inline-flex items-center gap-1 text-accent-primary"><RefreshCw className="h-3 w-3 animate-spin" aria-hidden />Updating…</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Affiliation filter */}
          <div className="inline-flex items-center rounded-control border border-border-subtle bg-surface p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAffiliation("all")}
              className={cn("rounded px-2.5 py-1 text-2xs transition-colors", affiliation === "all" ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setAffiliation("college")}
              className={cn("rounded px-2.5 py-1 text-2xs transition-colors", affiliation === "college" ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
            >
              College
            </button>
            <button
              type="button"
              onClick={() => setAffiliation("independent")}
              className={cn("rounded px-2.5 py-1 text-2xs transition-colors", affiliation === "independent" ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
            >
              Independent
            </button>
          </div>

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
          <select
            aria-label="Filter by readiness score"
            value={readinessFilter}
            onChange={(e) => setReadinessFilter(e.target.value)}
            className="rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-xs text-primary outline-none focus:border-accent-primary"
          >
            <option value="">All readiness</option>
            <option value="above_60">≥ 60% (Launchpad Gate)</option>
            <option value="above_50">≥ 50% Readiness</option>
            <option value="placement_ready">Placement Ready (≥75%)</option>
            <option value="in_progress">In Progress (45–74%)</option>
            <option value="needs_training">Needs Training (&lt;45%)</option>
            <option value="below_60">&lt; 60% Readiness</option>
          </select>
          <select
            aria-label="Sort by score"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-xs text-primary outline-none focus:border-accent-primary"
          >
            <option value="">Sort: Newest</option>
            <option value="readiness_desc">Score: High → Low</option>
            <option value="readiness_asc">Score: Low → High</option>
            <option value="vault_ai_desc">Vault AI: High → Low</option>
          </select>
          <select
            aria-label="Filter by account origin"
            value={mvSource}
            onChange={(e) => setMvSource(e.target.value as "" | "mellow_vault" | "aptrun_only")}
            className="rounded-control border border-border-subtle bg-surface px-2.5 py-1.5 text-xs text-primary outline-none focus:border-accent-primary"
          >
            <option value="">All Sources</option>
            <option value="mellow_vault">Mellow Vault Synced</option>
            <option value="aptrun_only">AptRun Only (Null MV)</option>
          </select>
          <button
            type="button"
            onClick={handleSyncMvProfiles}
            disabled={syncingMv}
            title="Fetch latest profile completion % from Mellow Vault for all matching users"
            className="inline-flex items-center gap-1.5 rounded-control border border-indigo-500/35 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-subtle hover:bg-indigo-500/20 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncingMv && "animate-spin")} />
            <span>{syncingMv ? "Syncing MV..." : "Sync MV %"}</span>
          </button>
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

          <button
            type="button"
            onClick={() => setShowReadinessModal(true)}
            title="Download student readiness scores report (CSV) with score threshold filtering"
            className="inline-flex items-center gap-1.5 rounded-control border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 shadow-subtle hover:bg-emerald-500/20 hover:border-emerald-500/60 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Readiness Report</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={downloading || total === 0}
            title="Download students report (CSV)"
            className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-primary shadow-subtle hover:bg-surface-hover hover:border-border-strong disabled:opacity-50"
          >
            <Download className={cn("h-3.5 w-3.5 text-accent-primary", downloading && "animate-bounce")} />
            <span>{downloading ? "Exporting..." : "Download Report"}</span>
          </button>
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
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={isAllOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      className="rounded border-border-subtle text-accent-primary focus:ring-accent-primary cursor-pointer"
                      aria-label="Select all students on current page"
                    />
                  </th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">College</th>
                  <th className="px-4 py-3">Department · Branch</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">MV Profile %</th>
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
                    className={cn(
                      "hover:bg-surface-hover/60 transition-colors cursor-pointer",
                      selectedIds.has(s.id) && "bg-accent-primary/5"
                    )}
                  >
                    <td className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.id)}
                        onChange={() => toggleSelectUser(s.id)}
                        className="rounded border-border-subtle text-accent-primary focus:ring-accent-primary cursor-pointer"
                        aria-label={`Select ${s.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-primary">{s.name}</div>
                      <div className="text-3xs font-mono text-text-muted">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 text-text-secondary font-medium">
                      {s.college?.name ?? (
                        <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-3xs font-bold text-violet-600 dark:text-violet-400">
                          Direct / Independent
                        </span>
                      )}
                    </td>
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
                      <MvProfileBadge user={s} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        {s.readiness_tier ? (
                          <div className="flex items-center gap-1.5">
                            {s.readiness_score !== undefined && s.readiness_score !== null && (
                              <span
                                className={cn(
                                  "font-mono font-extrabold text-xs",
                                  s.readiness_score >= 75
                                    ? "text-status-success"
                                    : s.readiness_score >= 50
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : s.readiness_score >= 45
                                    ? "text-accent-secondary"
                                    : "text-status-warning"
                                )}
                              >
                                {s.readiness_score}%
                              </span>
                            )}
                            <span className={cn("px-2 py-0.5 text-3xs font-bold rounded-full border", TIER_BADGE_CLASS[s.readiness_tier])}>
                              {s.readiness_tier}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                        {s.vault_ai_score !== undefined && s.vault_ai_score !== null && (
                          <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            Vault AI: {Number(s.vault_ai_score).toFixed(0)}%
                          </span>
                        )}
                      </div>
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

      {/* Floating Bulk Operations Toolbar for 2k-3k scale operations */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-panel bg-elevated/95 backdrop-blur-md border border-accent-primary/50 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-primary text-3xs font-black text-white">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold text-primary">
              selected
            </span>
          </div>

          <div className="h-4 w-px bg-border-subtle" />

          {/* Credentials Dispatch */}
          <button
            type="button"
            onClick={() => handleBulkAction("send_credentials")}
            disabled={bulkProcessing}
            title="Reset and email new login credentials to selected students"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold bg-accent-primary hover:bg-accent-primary/90 text-white shadow-subtle disabled:opacity-50 transition-all"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{bulkProcessing ? "Processing..." : "Dispatch Credentials"}</span>
          </button>

          {/* Revoke Sessions */}
          <button
            type="button"
            onClick={() => handleBulkAction("revoke_sessions")}
            disabled={bulkProcessing}
            title="Immediately revoke tokens and sign out selected students across all devices"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", bulkProcessing && "animate-spin")} />
            <span>Revoke Sessions</span>
          </button>

          {/* Block / Unblock */}
          <button
            type="button"
            onClick={() => handleBulkAction("toggle_block")}
            disabled={bulkProcessing}
            title="Toggle blocked status for selected students"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold bg-status-danger/15 hover:bg-status-danger/25 text-status-danger border border-status-danger/30 disabled:opacity-50 transition-all"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Toggle Block</span>
          </button>

          <div className="h-4 w-px bg-border-subtle" />

          {/* Deselect */}
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkProcessing}
            className="px-2.5 py-1.5 rounded-control text-xs font-medium text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Deselect
          </button>
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

      {showReadinessModal && (
        <ReadinessReportModal
          collegeId={collegeId}
          department={department}
          affiliation={affiliation}
          onClose={() => setShowReadinessModal(false)}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}
