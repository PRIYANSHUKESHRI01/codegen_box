"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Search, Ban, CheckCircle2, Clock, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, type ApiPage, type ApiPlatformUser, type ApiCollege } from "./types";
import { PLAN_FILTERS, ROLE_FILTERS, roleInfo } from "./accountRoles";
import { ResetPasswordModal } from "./ResetPasswordModal";
import { UserManageDrawer } from "./UserManageDrawer";

interface AccountsPanelProps {
  triggerToast: (msg: string) => void;
}

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
 * The login directory for the whole platform: who can sign in, as what, which plan
 * they hold, and whether they are still on the temporary password they were issued.
 * "Manage" opens the full account drawer (details, plan, sign-in tools, activity).
 *
 * It cannot show anyone's current password and never will: passwords are stored
 * as one-way hashes, and a user replaces their temporary password the first time
 * they sign in, so no copy of it exists to read. What a superadmin can do —
 * and what this panel is for — is issue a fresh temporary password and see it
 * once (ResetPasswordModal), e.g. when a college says it never got the email or
 * the toast showing the original password was missed — or open the account with
 * "View as" from the drawer, which shows what the user sees without touching
 * their password.
 */
export function AccountsPanel({ triggerToast }: AccountsPanelProps) {
  const [accounts, setAccounts] = useState<ApiPlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [colleges, setColleges] = useState<{ id: number; name: string }[]>([]);
  const [resetTarget, setResetTarget] = useState<ApiPlatformUser | null>(null);
  const [managedId, setManagedId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    api
      .get<{ colleges: ApiCollege[] }>("/admin/colleges")
      .then((res) => setColleges(res.colleges.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => {});
  }, []);

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

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams().toString()}`)
      .then((res) => {
        setAccounts(res.data);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
        setTotal(res.total);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load accounts."))
      .finally(() => setLoading(false));
  }, [buildParams, triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = () => {
    setLoadingMore(true);
    api
      .get<ApiPage<ApiPlatformUser>>(`/superadmin/users?${buildParams({ page: String(page + 1) }).toString()}`)
      .then((res) => {
        setAccounts((prev) => [...prev, ...res.data]);
        setPage(res.current_page);
        setHasMore(res.current_page < res.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more accounts."))
      .finally(() => setLoadingMore(false));
  };

  const filtered = !!(searchDebounced || roleFilter || collegeId || planFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Accounts &amp; Logins</h2>
          <p className="text-xs text-text-muted max-w-2xl">
            {total.toLocaleString()} account(s). Passwords are stored as one-way hashes, so a current password can&apos;t be read back — reset an account
            to issue a new temporary password and see it once, or open it with <strong className="text-text-secondary">Manage → View as</strong> to see what its owner sees.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter by account type"
            className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
          >
            {ROLE_FILTERS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            aria-label="Filter by plan"
            className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
          >
            {PLAN_FILTERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={collegeId}
            onChange={(e) => setCollegeId(e.target.value)}
            aria-label="Filter by college"
            className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
          >
            <option value="">All Colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          {filtered ? "No accounts match this filter." : "No accounts found."}
        </div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                <tr>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Login ID</th>
                  <th className="px-4 py-3">College</th>
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
                              Reset password
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
