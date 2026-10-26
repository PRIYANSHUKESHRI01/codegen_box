"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Search, Ban, CheckCircle2, Clock, UserCog, FilterX, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, type ApiPage, type ApiPlatformUser } from "./types";
import { PLAN_FILTERS, ROLE_FILTERS, roleInfo } from "./accountRoles";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { UserManageDrawer } from "./UserManageDrawer";
import { CredentialLockBar, PasswordReveal } from "./CredentialUi";
import { ROLES_WITHOUT_UNIVERSITY, RoleChips, UniversityPicker, useDirectoryFacets } from "./DirectoryFilters";
import { type ToastTrigger } from "@/lib/toast";

interface AccountsPanelProps {
  triggerToast: ToastTrigger;
}

/** How often the table quietly re-reads what is on screen, so a password the owner just changed stops looking viewable. */
const REFRESH_EVERY_MS = 20_000;
/** Silent refresh only re-reads this many pages (50 rows each); the rest update the next time they are loaded. */
const REFRESH_MAX_PAGES = 2;

/** What the Plan column says for one account: its plan, and whether that plan is its own or its college's. */
function planCell(account: ApiPlatformUser) {
  const sub = account.subscription;
  if (account.role !== "user") return <span className="text-text-muted">—</span>;
  if (!sub) return <span className="text-text-muted">No plan</span>;

  return (
    <div>
      <div className="font-semibold text-primary">{sub.plan_name}</div>
      <div className="text-3xs text-text-muted">
        {sub.source === "institution" ? "via college" : sub.days_remaining === null ? "never expires" : sub.days_remaining <= 0 ? "ended" : `${sub.days_remaining} days left`}
      </div>
    </div>
  );
}

/**
 * The login directory for the whole platform: who can sign in, as what, which university and plan they
 * belong to, and what state their password is in. "Manage" opens the full account drawer.
 *
 * Passwords are stored as one-way hashes, so a password an owner CHOSE can never be shown. What can be
 * shown — after the superadmin re-enters their own password — is the temporary password an account was
 * issued, until its owner replaces it (PasswordReveal). Anything else is handled by "Change password":
 * generate a fresh one, or type one, and see it. The table refreshes itself every few seconds, so the
 * state shown follows what the account owners are doing.
 */
export function AccountsPanel({ triggerToast }: AccountsPanelProps) {
  const [accounts, setAccounts] = useState<ApiPlatformUser[]>([]);
  // `loaded` flips on the first answer; afterwards a new filter keeps the old rows on screen, dimmed (see StudentsPanel).
  const [loaded, setLoaded] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answeredFiltered, setAnsweredFiltered] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [resetTarget, setResetTarget] = useState<ApiPlatformUser | null>(null);
  const [managedId, setManagedId] = useState<number | null>(null);

  const facets = useDirectoryFacets({ role: roleFilter, collegeId, search: searchDebounced, plan: planFilter });

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildParams = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams(extra);
      if (roleFilter.includes(",")) params.set("roles", roleFilter);
      else if (roleFilter) params.set("role", roleFilter);
      // A plan only means something for students.
      if (planFilter) {
        params.set("plan", planFilter);
        if (!roleFilter) params.set("role", "user");
      }
      if (collegeId) params.set("college_id", collegeId);
      if (searchDebounced) params.set("search", searchDebounced);
      return params;
    },
    [roleFilter, planFilter, collegeId, searchDebounced]
  );

  // Which filter set the rows on screen belong to — an answer for an older one must never land on a newer one.
  const filterKey = buildParams().toString();
  const currentFilterKey = useRef(filterKey);
  currentFilterKey.current = filterKey;

  // Only the newest request may write to the screen.
  const latest = useRef(0);
  const filtered = !!(searchDebounced || roleFilter || collegeId || planFilter);

  const load = useCallback(() => {
    const ticket = ++latest.current;
    const askedFiltered = !!(searchDebounced || roleFilter || collegeId || planFilter);
    setFetching(true);
    setError(null);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams().toString()}`)
      .then((res) => {
        if (ticket !== latest.current) return;
        setAccounts(res.data);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
        setTotal(res.total);
        setAnsweredFiltered(askedFiltered);
        setLoaded(true);
      })
      .catch((err) => {
        if (ticket !== latest.current) return;
        const message = err instanceof ApiError ? err.message : "Failed to load accounts.";
        setError(message);
        triggerToast(message, "error");
      })
      .finally(() => {
        if (ticket === latest.current) setFetching(false);
      });
  }, [buildParams, searchDebounced, roleFilter, collegeId, planFilter, triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!fetching) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 4_000);
    return () => clearTimeout(t);
  }, [fetching]);

  const loadMore = () => {
    setLoadingMore(true);
    const ticket = latest.current;
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams({ page: String(page + 1) }).toString()}`)
      .then((res) => {
        if (ticket !== latest.current) return;
        setAccounts((prev) => [...prev, ...res.data]);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more accounts.", "error"))
      .finally(() => setLoadingMore(false));
  };

  // Keep the rows on screen true: re-read the loaded pages and update matching rows in place (no spinner, no scroll jump).
  const pageRef = useRef(page);
  pageRef.current = page;
  const refreshQuietly = useCallback(() => {
    const requestedFor = buildParams().toString();
    const pages = Array.from({ length: Math.min(pageRef.current, REFRESH_MAX_PAGES) }, (_, i) => i + 1);
    Promise.all(pages.map((p) => api.get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams({ page: String(p) }).toString()}`)))
      .then((results) => {
        if (requestedFor !== currentFilterKey.current) return;
        const fresh = new Map(results.flatMap((r) => r.data).map((row) => [row.id, row]));
        setAccounts((prev) => prev.map((row) => fresh.get(row.id) ?? row));
        setTotal(results[0].total);      })
      .catch(() => {
        // A missed refresh is invisible; the next one catches up.
      });
  }, [buildParams]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") refreshQuietly();
    };
    const timer = setInterval(tick, REFRESH_EVERY_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refreshQuietly]);

  const chooseRole = (value: string) => {
    setRoleFilter(value);
    // Staff, hiring companies and superadmins never belong to a university: keeping one chosen would only show an empty list.
    if (collegeId && ROLES_WITHOUT_UNIVERSITY.includes(value)) setCollegeId("");
    // A plan only exists for students.
    if (value && value !== "user") setPlanFilter("");
  };

  const clearFilters = () => {
    setSearch("");
    setSearchDebounced("");
    setRoleFilter("");
    setPlanFilter("");
    setCollegeId("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Accounts &amp; Logins</h2>
          <p className="text-xs text-text-muted max-w-2xl" aria-live="polite">
            {total === null ? (error ? "Couldn't load the accounts." : "Loading accounts…") : `${total.toLocaleString()} account(s)${answeredFiltered ? " match" : ""}.`}
            {loaded && fetching && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-accent-primary">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                Updating…
              </span>
            )}{" "}
            Unlock to see the temporary password an account was issued — it&apos;s available until the owner chooses their own, which then
            stays private. <strong className="text-text-secondary">Change password</strong> sets a new one you can read. This list refreshes by itself.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <UniversityPicker value={collegeId} onChange={setCollegeId} facets={facets} />
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            aria-label="Filter by plan"
            disabled={!!roleFilter && roleFilter !== "user"}
            title={roleFilter && roleFilter !== "user" ? "Plans belong to students" : undefined}
            className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary disabled:opacity-50"
          >
            {PLAN_FILTERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, handle, email..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
            />
          </div>
          {filtered && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-control border border-border-subtle bg-elevated text-xs font-semibold text-text-secondary hover:text-primary"
            >
              <FilterX className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <RoleChips choices={ROLE_FILTERS} value={roleFilter} onChange={chooseRole} facets={facets} />

      <CredentialLockBar />

      {!loaded && !error ? (
        <div role="status" aria-label="Loading accounts" className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="divide-y divide-border-subtle" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-elevated" />
                  <div className="h-2.5 w-24 animate-pulse rounded-full bg-elevated" />
                </div>
                <div className="hidden h-3 w-48 animate-pulse rounded bg-elevated sm:block" />
                <div className="hidden h-3 w-32 animate-pulse rounded bg-elevated md:block" />
                <div className="h-6 w-36 animate-pulse rounded bg-elevated" />
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
      ) : accounts.length === 0 ? (
        <div className="space-y-3 p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <p>{answeredFiltered ? "No accounts match this filter." : "No accounts found."}</p>
          {answeredFiltered && (
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
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Login ID</th>
                  <th className="px-4 py-3">University</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Password</th>
                  <th className="px-4 py-3">Login email sent</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {accounts.map((a) => {
                  const info = roleInfo(a.role);
                  return (
                    <tr key={a.id} className="hover:bg-surface-hover/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-primary">{a.name}</div>
                        <span className={cn("inline-block mt-1 px-2 py-0.5 text-3xs font-bold rounded-full border", info.badge)}>{info.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-text-primary">{a.email}</div>
                        {a.handle && <div className="text-3xs font-mono text-text-muted">@{a.handle}</div>}
                      </td>
                      <td className="px-4 py-3 text-text-secondary font-medium">{a.college?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{planCell(a)}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5">
                          {a.is_blocked ? (
                            <span className="inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-full bg-status-danger/15 text-status-danger">
                              <Ban className="w-3 h-3" />
                              <span>Blocked</span>
                            </span>
                          ) : a.must_change_password ? (
                            <span
                              title="Still the temporary password it was issued. The account has not chosen its own yet."
                              className="inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-full bg-status-warning/15 text-status-warning"
                            >
                              <Clock className="w-3 h-3" />
                              <span>Temporary — not changed yet</span>
                            </span>
                          ) : (
                            <span
                              title="The user has set their own password."
                              className="inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-full bg-status-success/15 text-status-success"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Set by user</span>
                            </span>
                          )}
                          <div>
                            <PasswordReveal userId={a.id} userName={a.name} state={a.credential_state} onStale={refreshQuietly} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-muted">{a.credentials_email_sent_at ? formatDateTime(a.credentials_email_sent_at) : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            onClick={() => setManagedId(a.id)}
                            aria-label={`Manage ${a.name}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-xs font-bold transition-all"
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            Manage
                          </button>
                          {a.role === "superadmin" ? (
                            <span title="A superadmin changes their own password from Settings." className="text-3xs text-text-muted">
                              Managed by owner
                            </span>
                          ) : (
                            <button
                              onClick={() => setResetTarget(a)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-xs font-bold transition-all"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Change password
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
              {total !== null && (
                <span className="text-3xs text-text-muted">
                  Showing {accounts.length.toLocaleString()} of {total.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {resetTarget && (
        <ResetPasswordModal
          target={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={() => {
            // The row's status/"email sent" columns changed server-side.
            load();
          }}
        />
      )}

      {managedId !== null && <UserManageDrawer userId={managedId} onClose={() => setManagedId(null)} onChanged={load} triggerToast={triggerToast} />}
    </div>
  );
}
