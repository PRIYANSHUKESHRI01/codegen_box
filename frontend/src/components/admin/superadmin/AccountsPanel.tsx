"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Search, Copy, Check, Ban, CheckCircle2, Clock, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { formatDateTime, type ApiPage, type ApiPlatformUser, type ApiCollege } from "./types";

interface AccountsPanelProps {
  triggerToast: (msg: string) => void;
}

/**
 * Every role the platform has. The shared ROLE_LABEL in ./types only knows the
 * five roles the older tabs deal with (and the Audit Log builds its filter from
 * it), so this panel keeps its own complete map rather than widening that one.
 */
const ACCOUNT_ROLE: Record<string, { label: string; badge: string }> = {
  superadmin: { label: "Superadmin", badge: "bg-amber-500/10 text-amber-500 border-amber-500/25" },
  admin_internal: { label: "Mellow Staff (Ops)", badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" },
  admin_marketing: { label: "Mellow Staff (Marketing)", badge: "bg-rose-500/10 text-rose-400 border-rose-500/25" },
  admin_tpo: { label: "College TPO", badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25" },
  section_coordinator: { label: "Section Coordinator", badge: "bg-sky-500/10 text-sky-400 border-sky-500/25" },
  admin_company: { label: "Hiring Company", badge: "bg-violet-500/10 text-violet-400 border-violet-500/25" },
  user: { label: "Student / Coder", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" },
};

const roleInfo = (role: string) => ACCOUNT_ROLE[role] ?? { label: role, badge: "bg-elevated text-text-secondary border-border-subtle" };

const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All accounts" },
  { value: "admin_tpo", label: "College TPOs" },
  { value: "section_coordinator", label: "Section Coordinators" },
  { value: "user", label: "Students & coders" },
  { value: "admin_company", label: "Hiring companies" },
  { value: "admin_internal,admin_marketing", label: "Mellow staff" },
  { value: "superadmin", label: "Superadmins" },
];

/**
 * Login directory for the whole platform: who can sign in, as what, and whether
 * they are still on the temporary password they were issued.
 *
 * It cannot show anyone's current password and never will: passwords are stored
 * as one-way hashes, and a user replaces their temporary password the first
 * time they sign in, so no copy of it exists to read. What a superadmin can do —
 * and what this panel is for — is issue a fresh temporary password and see it
 * once (ResetPasswordModal), e.g. when a college says it never got the email or
 * the toast showing the original password was missed.
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
  const [collegeId, setCollegeId] = useState("");
  const [colleges, setColleges] = useState<{ id: number; name: string }[]>([]);
  const [resetTarget, setResetTarget] = useState<ApiPlatformUser | null>(null);

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
      if (collegeId) params.set("college_id", collegeId);
      if (searchDebounced) params.set("search", searchDebounced);
      return params;
    },
    [roleFilter, collegeId, searchDebounced]
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Accounts &amp; Logins</h2>
          <p className="text-xs text-text-muted max-w-2xl">
            {total.toLocaleString()} account(s). Passwords are stored as one-way hashes, so a current password can&apos;t be read back — reset an account
            to issue a new temporary password and see it once.
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
          {searchDebounced || roleFilter || collegeId ? "No accounts match this filter." : "No accounts found."}
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
    </div>
  );
}

interface ResetResult {
  temporary_password: string;
  credentials_email_sent: boolean | null;
}

/**
 * Two steps in one dialog: confirm (re-enter your own password — a stolen
 * session alone mustn't be able to take over accounts), then show the new
 * password once. The password only ever lives in this component's state, so
 * closing the dialog discards it.
 */
function ResetPasswordModal({ target, onClose, onReset }: { target: ApiPlatformUser; onClose: () => void; onReset: () => void }) {
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [copied, setCopied] = useState<"login" | "password" | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || working) return;
    setWorking(true);
    setError(null);
    try {
      const res = await api.post<ResetResult>(`/superadmin/users/${target.id}/reset-password`, { password, send_email: sendEmail });
      setResult(res);
      setPassword("");
      onReset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset the password. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  };

  const copy = async (what: "login" | "password", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard can be blocked (insecure origin / permissions); the value is on screen to copy by hand.
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={result ? "New temporary password" : "Reset password"}
      subtitle={`${target.name} · ${roleInfo(target.role).label}`}
      icon={KeyRound}
      size="md"
      closeOnBackdrop={false}
      footer={
        result ? (
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors">
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="reset-password-form"
              disabled={working || !password}
              className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {working ? "Resetting…" : "Reset & show password"}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Login ID</div>
            <CopyRow value={target.email} copied={copied === "login"} onCopy={() => copy("login", target.email)} />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Temporary password</div>
            <CopyRow value={result.temporary_password} copied={copied === "password"} onCopy={() => copy("password", result.temporary_password)} mono />
          </div>

          <div
            className={cn(
              "flex items-start gap-2 p-3 rounded-control border text-xs",
              result.credentials_email_sent === false
                ? "border-status-warning/30 bg-status-warning/10 text-status-warning"
                : "border-border-subtle bg-elevated text-text-secondary"
            )}
          >
            <Mail className="w-4 h-4 shrink-0 mt-px" />
            <span>
              {result.credentials_email_sent === true && <>Login details were emailed to {target.email}.</>}
              {result.credentials_email_sent === false && <>The email to {target.email} could not be sent — pass the password on yourself.</>}
              {result.credentials_email_sent === null && <>Not emailed. Pass these details on yourself.</>}
            </span>
          </div>

          <p className="text-2xs text-text-muted">
            This is the only time this password is shown. The previous password no longer works and every session {target.name} had open has been signed out;
            they will be asked to choose their own password at next login.
          </p>
        </div>
      ) : (
        <form id="reset-password-form" onSubmit={submit} className="space-y-4">
          <p className="text-xs text-text-secondary">
            This replaces <strong className="text-primary">{target.name}</strong>&apos;s password with a new temporary one that you will see on the next
            screen. Their current password stops working immediately and they are signed out everywhere.
          </p>

          <label className="flex items-start gap-2 cursor-pointer text-xs">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 rounded border-border-subtle" />
            <span className="text-primary font-semibold">
              Also email it to <span className="font-mono">{target.email}</span>
            </span>
          </label>

          <div>
            <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-text-secondary mb-1">
              Your password (to confirm it&apos;s you)
            </label>
            <input
              id="reset-confirm-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-control border border-status-danger/30 bg-status-danger/10 text-status-danger text-xs font-semibold">
              {error}
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

function CopyRow({ value, copied, onCopy, mono = true }: { value: string; copied: boolean; onCopy: () => void; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <code className={cn("flex-1 min-w-0 px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-sm break-all select-all", mono && "font-mono")}>
        {value}
      </code>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy"
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-xs font-bold transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
