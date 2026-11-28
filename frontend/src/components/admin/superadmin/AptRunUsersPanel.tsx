"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock,
  Download,
  FilterX,
  GraduationCap,
  KeyRound,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserCheck,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { downloadApiFile } from "@/lib/download";
import { formatDateTime, type ApiPage, type ApiPlatformUser } from "./types";
import { MvProfileBadge } from "./MvProfileBadge";
import { APTRUN_USER_ROLES, PLAN_FILTERS, roleInfo } from "./accountRoles";
import { UserManageDrawer } from "./UserManageDrawer";
import { RoleChips, UniversityPicker, useDirectoryFacets } from "./DirectoryFilters";
import { ago } from "./activity/format";
import { type ToastTrigger } from "@/lib/toast";

interface AptRunUsersPanelProps {
  triggerToast: ToastTrigger;
}

export function AptRunUsersPanel({ triggerToast }: AptRunUsersPanelProps) {
  const [users, setUsers] = useState<ApiPlatformUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "blocked">("");
  const [affiliation, setAffiliation] = useState<"all" | "college" | "independent">("all");
  const [readinessFilter, setReadinessFilter] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("");
  const [mvSource, setMvSource] = useState<"" | "mellow_vault" | "aptrun_only">("");
  const [syncingMv, setSyncingMv] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [managedId, setManagedId] = useState<number | null>(null);

  // Bulk operations for scale concurrency
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [marketingEmployees, setMarketingEmployees] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    api
      .get<{ employees?: { id: number; name: string }[] }>("/superadmin/marketing-employees")
      .then((res) => {
        if (res && Array.isArray(res.employees)) {
          setMarketingEmployees(res.employees);
        } else {
          setMarketingEmployees([]);
        }
      })
      .catch(() => setMarketingEmployees([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Facets for counts across roles, universities, etc. (strictly excluding superadmin)
  const facets = useDirectoryFacets({
    role: roleFilter,
    collegeId,
    search: searchDebounced,
    plan: planFilter,
    status: statusFilter,
    excludeRole: "superadmin",
  });

  const buildParams = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams(extra);
      // Strictly exclude superadmins from the AptRun Users directory
      params.set("exclude_role", "superadmin");

      if (roleFilter.includes(",")) {
        params.set("roles", roleFilter);
      } else if (roleFilter) {
        params.set("role", roleFilter);
      }

      if (collegeId) params.set("college_id", collegeId);
      if (searchDebounced) params.set("search", searchDebounced);
      if (planFilter) params.set("plan", planFilter);
      if (statusFilter) params.set("status", statusFilter);

      if (affiliation === "college") params.set("has_college", "1");
      else if (affiliation === "independent") params.set("has_college", "0");
      if (readinessFilter === "above_60") params.set("min_readiness", "60");
      else if (readinessFilter === "above_50") params.set("min_readiness", "50");
      else if (readinessFilter === "placement_ready") params.set("readiness_tier", "Placement Ready");
      else if (readinessFilter === "in_progress") params.set("readiness_tier", "In Progress");
      else if (readinessFilter === "needs_training") params.set("readiness_tier", "Needs Training");
      else if (readinessFilter === "below_60") params.set("max_readiness", "59");
      if (sortOrder) params.set("sort", sortOrder);
      if (mvSource) params.set("mv_source", mvSource);

      return params;
    },
    [roleFilter, collegeId, searchDebounced, planFilter, statusFilter, affiliation, readinessFilter, sortOrder, mvSource]
  );

  const latest = useRef(0);

  const load = useCallback(() => {
    const ticket = ++latest.current;
    setFetching(true);
    setError(null);

    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams().toString()}`)
      .then((res) => {
        if (ticket !== latest.current) return;
        setUsers(res.data);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
        setTotal(res.total);
        setLoaded(true);
      })
      .catch((err) => {
        if (ticket !== latest.current) return;
        const msg = err instanceof ApiError ? err.message : "Failed to load AptRun users.";
        setError(msg);
        triggerToast(msg, "error");
      })
      .finally(() => {
        if (ticket === latest.current) setFetching(false);
      });
  }, [buildParams, triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!fetching) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, [fetching]);

  const loadMore = () => {
    const ticket = latest.current;
    setLoadingMore(true);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams({ page: String(page + 1) }).toString()}`)
      .then((res) => {
        if (ticket !== latest.current) return;
        setUsers((prev) => [...prev, ...res.data]);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more users.", "error"))
      .finally(() => {
        if (ticket === latest.current) setLoadingMore(false);
      });
  };

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const params = buildParams();
      await downloadApiFile(`/superadmin/users/export?${params.toString()}`, "aptrun-users-report.csv");
      triggerToast("AptRun users report downloaded successfully.");
    } catch {
      triggerToast("Failed to download users report.", "error");
    } finally {
      setDownloading(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setSearchDebounced("");
    setRoleFilter("");
    setCollegeId("");
    setPlanFilter("");
    setStatusFilter("");
    setAffiliation("all");
    setReadinessFilter("");
    setSortOrder("");
    setMvSource("");
  };

  const handleSyncMvProfiles = async () => {
    setSyncingMv(true);
    try {
      const res = await api.post<{ configured: boolean; matched_users: number; eligible_90: number }>(
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

  const isFiltered = Boolean(search || roleFilter || collegeId || planFilter || statusFilter || affiliation !== "all" || readinessFilter || sortOrder || mvSource);

  const isAllOnPageSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));

  const toggleSelectAllOnPage = () => {
    const next = new Set(selectedIds);
    if (isAllOnPageSelected) {
      users.forEach((u) => next.delete(u.id));
    } else {
      users.forEach((u) => next.add(u.id));
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
        ? `Are you sure you want to revoke all active sessions for ${count} selected user(s)? They will be immediately signed out across all devices.`
        : action === "toggle_block"
        ? `Are you sure you want to toggle the block status for ${count} selected user(s)?`
        : `Are you sure you want to regenerate and dispatch new credentials to ${count} selected user(s) via email?`;

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
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-primary">AptRun Users</h2>
            <span className="rounded-full bg-accent-primary/10 px-2.5 py-0.5 text-2xs font-bold text-accent-primary">
              All Platform Accounts
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5" aria-live="polite">
            {total === null
              ? "Loading users..."
              : `${total.toLocaleString()} user(s) on AptRun across all colleges and independent learners (excluding superadmin).`}
            {loaded && fetching && (
              <span className="ml-2 inline-flex items-center gap-1 text-accent-primary">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> Updating…
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSyncMvProfiles}
            disabled={syncingMv}
            title="Fetch latest profile completion % from Mellow Vault for all matching users"
            className="inline-flex items-center gap-1.5 rounded-control border border-indigo-500/35 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-subtle hover:bg-indigo-500/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncingMv && "animate-spin")} />
            <span>{syncingMv ? "Syncing MV..." : "Sync MV %"}</span>
          </button>
          <button
            type="button"
            onClick={load}
            disabled={fetching}
            title="Refresh list"
            className="rounded-control border border-border-subtle p-2 text-text-muted transition-colors hover:bg-elevated hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", fetching && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={handleDownloadReport}
            disabled={downloading || total === 0}
            title="Download full user directory as CSV"
            className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs font-bold text-primary shadow-subtle hover:bg-surface-hover hover:border-border-strong disabled:opacity-50 transition-colors"
          >
            <Download className={cn("h-3.5 w-3.5 text-accent-primary", downloading && "animate-bounce")} />
            <span>{downloading ? "Exporting..." : "Download Report"}</span>
          </button>
        </div>
      </div>

      {/* Role chips */}
      <RoleChips
        choices={APTRUN_USER_ROLES}
        value={roleFilter}
        onChange={(r) => {
          setRoleFilter(r);
          // If changing away from students, clear plan filter
          if (r && r !== "user") setPlanFilter("");
        }}
        facets={facets}
      />

      {/* Secondary filter controls bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-surface p-2.5 shadow-subtle">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, roll no, handle..."
            className="h-8 w-full rounded-control border border-border-subtle bg-elevated pl-8 pr-3 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />
        </div>

        {/* University picker */}
        <UniversityPicker value={collegeId} onChange={setCollegeId} facets={facets} />

        {/* Affiliation filter (all / college / independent) */}
        {(!roleFilter || roleFilter === "user") && (
          <div className="inline-flex items-center rounded-control border border-border-subtle bg-elevated p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAffiliation("all")}
              className={cn("rounded px-2.5 py-1 text-2xs transition-colors", affiliation === "all" ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
            >
              All Affiliations
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
        )}

        {/* Plan filter (applicable when viewing students or all) */}
        {(!roleFilter || roleFilter === "user") && (
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            aria-label="Filter by plan"
            className="h-8 rounded-control border border-border-subtle bg-elevated px-2.5 text-xs text-primary outline-none focus:border-accent-primary"
          >
            {PLAN_FILTERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        )}

        {/* Status filter (Active / Blocked) */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "blocked")}
          aria-label="Filter by status"
          className="h-8 rounded-control border border-border-subtle bg-elevated px-2.5 text-xs text-primary outline-none focus:border-accent-primary"
        >
          <option value="">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="blocked">Blocked Only</option>
        </select>

        {/* Readiness / Score filter & sort (when viewing students or all) */}
        {(!roleFilter || roleFilter === "user") && (
          <>
            <select
              value={readinessFilter}
              onChange={(e) => setReadinessFilter(e.target.value)}
              aria-label="Filter by student score"
              className="h-8 rounded-control border border-border-subtle bg-elevated px-2.5 text-xs text-primary outline-none focus:border-accent-primary"
            >
              <option value="">All Scores</option>
              <option value="above_60">Readiness ≥ 60%</option>
              <option value="above_50">Readiness ≥ 50%</option>
              <option value="placement_ready">Placement Ready (≥75%)</option>
              <option value="in_progress">In Progress (45–74%)</option>
              <option value="needs_training">Needs Training (&lt;45%)</option>
              <option value="below_60">Readiness &lt; 60%</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              aria-label="Sort by student score"
              className="h-8 rounded-control border border-border-subtle bg-elevated px-2.5 text-xs text-primary outline-none focus:border-accent-primary"
            >
              <option value="">Sort: Newest</option>
              <option value="readiness_desc">Score: High → Low</option>
              <option value="readiness_asc">Score: Low → High</option>
              <option value="vault_ai_desc">Vault AI: High → Low</option>
            </select>
          </>
        )}

        {/* Account origin filter */}
        <select
          value={mvSource}
          onChange={(e) => setMvSource(e.target.value as "" | "mellow_vault" | "aptrun_only")}
          aria-label="Filter by account origin"
          className="h-8 rounded-control border border-border-subtle bg-elevated px-2.5 text-xs text-primary outline-none focus:border-accent-primary"
        >
          <option value="">All Sources</option>
          <option value="mellow_vault">Mellow Vault Synced</option>
          <option value="aptrun_only">AptRun Only (Null MV)</option>
        </select>

        {isFiltered && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 h-8 rounded-control border border-border-subtle bg-elevated px-3 text-xs font-semibold text-text-secondary hover:text-primary hover:bg-surface-hover transition-colors"
          >
            <FilterX className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Users table */}
      {!loaded && !error ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-12 text-center text-xs text-text-muted">
          <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-accent-primary" />
          <span>Loading AptRun users...</span>
          {slow && <p className="mt-2 text-2xs text-text-muted">The server is processing a large user directory...</p>}
        </div>
      ) : error && !loaded ? (
        <div className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-6 text-center text-xs text-status-danger">
          <p className="font-bold">{error}</p>
          <button type="button" onClick={load} className="mt-2 text-2xs font-bold underline hover:no-underline">
            Try again
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-12 text-center text-xs text-text-muted">
          <Users className="mx-auto mb-2 h-8 w-8 text-text-muted/60" />
          <p className="font-bold text-primary">No AptRun users found.</p>
          <p className="mt-1 text-2xs text-text-muted">
            {isFiltered ? "No users match your current search or filter combination." : "No users exist in the database."}
          </p>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3 py-1.5 text-xs font-bold text-white shadow-subtle hover:bg-accent-primary-hover"
            >
              <FilterX className="h-3.5 w-3.5" /> Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border-subtle bg-elevated/70 text-3xs font-bold uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={isAllOnPageSelected}
                      onChange={toggleSelectAllOnPage}
                      className="rounded border-border-subtle text-accent-primary focus:ring-accent-primary cursor-pointer"
                      aria-label="Select all users on current page"
                    />
                  </th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Affiliation / College</th>
                  <th className="px-4 py-3">Plan / Access</th>
                  <th className="px-4 py-3">MV Profile %</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Last Seen</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {users.map((u) => {
                  const role = roleInfo(u.role);
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setManagedId(u.id)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-surface-hover/70",
                        selectedIds.has(u.id) && "bg-accent-primary/5"
                      )}
                    >
                      <td className="px-3 py-3 w-8" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelectUser(u.id)}
                          className="rounded border-border-subtle text-accent-primary focus:ring-accent-primary cursor-pointer"
                          aria-label={`Select ${u.name}`}
                        />
                      </td>

                      {/* User identity */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-primary/20 bg-accent-primary/10 text-2xs font-extrabold text-accent-primary">
                            {u.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="block font-bold text-primary truncate">{u.name}</span>
                            <span className="block font-mono text-3xs text-text-muted truncate">{u.email}</span>
                            {(u.phone || u.roll_number) && (
                              <span className="block font-mono text-3xs text-text-secondary truncate">
                                {[u.phone, u.roll_number].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-3xs font-bold", role.badge)}>
                          {role.label}
                        </span>
                      </td>

                      {/* Affiliation / College */}
                      <td className="px-4 py-3">
                        {u.college ? (
                          <div>
                            <span className="font-semibold text-primary">{u.college.name}</span>
                            {u.branch && <span className="block text-3xs text-text-muted">{u.branch}</span>}
                          </div>
                        ) : u.role === "user" ? (
                          <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-3xs font-bold text-violet-600 dark:text-violet-400">
                            Direct / Independent
                          </span>
                        ) : (
                          <span className="text-text-muted text-3xs">Platform Level</span>
                        )}
                      </td>

                      {/* Plan / Access */}
                      <td className="px-4 py-3">
                        {u.subscription ? (
                          <div>
                            <span className="font-semibold text-primary">{u.subscription.plan_name}</span>
                            <span className="block text-3xs text-text-muted">
                              {u.subscription.source === "institution"
                                ? "via college"
                                : u.subscription.days_remaining === null
                                ? "never expires"
                                : u.subscription.days_remaining <= 0
                                ? "ended"
                                : `${u.subscription.days_remaining} days left`}
                            </span>
                          </div>
                        ) : u.subscription_plan_name ? (
                          <span className="font-semibold text-primary">{u.subscription_plan_name}</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>

                      {/* Mellow Vault Profile % / Account Origin */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <MvProfileBadge user={u} />
                      </td>

                      {/* Readiness & Vault AI Score */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {u.role === "user" ? (
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={cn(
                                "font-mono text-xs font-extrabold",
                                (u.readiness_score ?? 0) >= 75
                                  ? "text-status-success"
                                  : (u.readiness_score ?? 0) >= 60
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-text-secondary"
                              )}
                            >
                              {u.readiness_score !== undefined && u.readiness_score !== null ? `${u.readiness_score}%` : "—"}
                            </span>
                            {u.vault_ai_score !== undefined && u.vault_ai_score !== null && (
                              <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                AI: {Number(u.vault_ai_score).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="px-4 py-3 text-text-muted text-2xs whitespace-nowrap">
                        <span title={formatDateTime(u.created_at)}>{ago(u.created_at)}</span>
                      </td>

                      {/* Last Seen */}
                      <td className="px-4 py-3 text-text-muted text-2xs whitespace-nowrap">
                        {u.last_seen_at ? (
                          <span title={formatDateTime(u.last_seen_at)}>{ago(u.last_seen_at)}</span>
                        ) : (
                          <span className="text-3xs text-text-muted">Never</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-full",
                            u.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success"
                          )}
                        >
                          {u.is_blocked ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          <span>{u.is_blocked ? "Blocked" : "Active"}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManagedId(u.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-surface px-2.5 py-1 text-2xs font-bold text-primary shadow-subtle hover:border-accent-primary hover:bg-accent-primary hover:text-white transition-all"
                        >
                          <UserCog className="h-3 w-3" />
                          <span>Manage</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Load more pagination */}
          {hasMore && (
            <div className="border-t border-border-subtle p-3.5 flex justify-center bg-elevated/20">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore || fetching}
                className="rounded-control border border-border-subtle bg-elevated px-4 py-1.5 text-xs font-bold text-text-secondary hover:bg-surface-hover hover:text-primary transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading more users..." : "Load More Users"}
              </button>
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
            title="Reset and email new login credentials to selected users"
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
            title="Immediately revoke tokens and sign out selected users across all devices"
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
            title="Toggle blocked status for selected users"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold bg-status-danger/15 hover:bg-status-danger/25 text-status-danger border border-status-danger/30 disabled:opacity-50 transition-all"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Toggle Block</span>
          </button>

          {/* Assign to Marketing */}
          {marketingEmployees.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                const empList = marketingEmployees.map((e, idx) => `${idx + 1}. ${e.name}`).join("\n");
                const chosen = window.prompt(
                  `Assign ${selectedIds.size} selected user(s) to which marketing employee?\n\nType the number or employee name:\n${empList}\n\n(Or type "auto" to auto-distribute)`
                );
                if (!chosen) return;
                let targetId: number | null = null;
                const trimmed = chosen.trim().toLowerCase();
                if (trimmed !== "auto") {
                  const num = parseInt(trimmed, 10);
                  if (!isNaN(num) && num >= 1 && num <= marketingEmployees.length) {
                    targetId = marketingEmployees[num - 1].id;
                  } else {
                    const match = marketingEmployees.find((e) => e.name.toLowerCase().includes(trimmed));
                    if (match) targetId = match.id;
                    else {
                      triggerToast("Marketing employee not found.", "error");
                      return;
                    }
                  }
                }
                setBulkProcessing(true);
                try {
                  const res = await api.post<{ success: boolean; message: string }>("/superadmin/marketing-team/assign-leads", {
                    user_ids: Array.from(selectedIds),
                    marketing_id: targetId,
                    mode: targetId ? "single" : "auto_distribute",
                  });
                  triggerToast(res.message);
                  setSelectedIds(new Set());
                  load();
                } catch (err) {
                  triggerToast(err instanceof ApiError ? err.message : "Failed to assign marketing staff.", "error");
                } finally {
                  setBulkProcessing(false);
                }
              }}
              disabled={bulkProcessing}
              title="Assign selected users to a marketing employee"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-subtle disabled:opacity-50 transition-all cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Assign Marketing</span>
            </button>
          )}

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

      {/* User Management & Full Activity Drawer */}
      {managedId !== null && (
        <UserManageDrawer
          userId={managedId}
          onClose={() => setManagedId(null)}
          onChanged={load}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}
