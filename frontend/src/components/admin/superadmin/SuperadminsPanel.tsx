"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  Globe,
  Laptop,
  Lock,
  Network,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { type ToastTrigger } from "@/lib/toast";
import { formatDateTime, type ApiPage } from "./types";
import { timeAgo } from "./manage/shared";
import {
  eventMeta,
  formatLocation,
  type SuperadminAccountRow,
  type SuperadminLoginLog,
  type SuperadminSummary,
} from "./superadminSecurityTypes";
import { CreateSuperadminModal } from "./CreateSuperadminModal";
import { DeleteSuperadminModal } from "./DeleteSuperadminModal";
import { LoginTelemetryDetailModal } from "./LoginTelemetryDetailModal";
import { SuperadminSecurityDrawer } from "./SuperadminSecurityDrawer";
import { TrustDeviceModal } from "./TrustDeviceModal";

interface SuperadminsPanelProps {
  triggerToast: ToastTrigger;
}

type SubView = "accounts" | "logs";

const EVENT_FILTERS = [
  { value: "all", label: "All Events" },
  { value: "login", label: "Signed In" },
  { value: "login_failed", label: "Failed Attempts" },
  { value: "login_blocked", label: "Blocked Accounts" },
  { value: "login_rejected_device_ip", label: "Untrusted Laptop / IP" },
  { value: "logout", label: "Signed Out" },
  { value: "password_changed", label: "Password Changes" },
];

export function SuperadminsPanel({ triggerToast }: SuperadminsPanelProps) {
  const [subView, setSubView] = useState<SubView>("accounts");
  const [accounts, setAccounts] = useState<SuperadminAccountRow[]>([]);
  const [summary, setSummary] = useState<SuperadminSummary | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountSearch, setAccountSearch] = useState("");

  // Login logs feed
  const [logs, setLogs] = useState<SuperadminLoginLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLastPage, setLogsLastPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logEvent, setLogEvent] = useState("all");
  const [logUserId, setLogUserId] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [logSearchDebounced, setLogSearchDebounced] = useState("");

  // Modals / Drawers
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SuperadminAccountRow | null>(null);
  const [securityDrawerUserId, setSecurityDrawerUserId] = useState<number | null>(null);
  const [inspectLog, setInspectLog] = useState<SuperadminLoginLog | null>(null);
  const [trustTargetLog, setTrustTargetLog] = useState<SuperadminLoginLog | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLogSearchDebounced(logSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [logSearch]);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      const params = new URLSearchParams();
      if (accountSearch.trim()) params.set("search", accountSearch.trim());
      const res = await api.get<{ superadmins: SuperadminAccountRow[]; summary: SuperadminSummary }>(
        `/superadmin/superadmins?${params.toString()}`
      );
      setAccounts(res.superadmins);
      setSummary(res.summary);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load superadmin accounts.";
      setAccountsError(msg);
      triggerToast(msg, "error");
    } finally {
      setLoadingAccounts(false);
    }
  }, [accountSearch, triggerToast]);

  const loadLogs = useCallback(
    async (page = 1) => {
      setLoadingLogs(true);
      try {
        const params = new URLSearchParams({ page: String(page), per_page: "25" });
        if (logEvent !== "all") params.set("event", logEvent);
        if (logUserId) params.set("user_id", logUserId);
        if (logSearchDebounced) params.set("search", logSearchDebounced);
        const res = await api.get<ApiPage<SuperadminLoginLog>>(`/superadmin/superadmin-logins?${params.toString()}`);
        setLogs(res.data);
        setLogsPage(res.current_page);
        setLogsLastPage(res.last_page);
        setLogsTotal(res.total);
      } catch (err) {
        triggerToast(err instanceof ApiError ? err.message : "Failed to load login security logs.", "error");
      } finally {
        setLoadingLogs(false);
      }
    },
    [logEvent, logUserId, logSearchDebounced, triggerToast]
  );

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (subView === "logs") {
      void loadLogs(1);
    }
  }, [subView, loadLogs]);

  const handleToggleBlock = async (target: SuperadminAccountRow) => {
    try {
      await api.post(`/superadmin/users/${target.id}/toggle-block`);
      triggerToast(target.is_blocked ? `Unblocked ${target.name}.` : `Blocked ${target.name}.`);
      void loadAccounts();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update account status.", "error");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            <span>Superadmins &amp; Login Security</span>
          </h2>
          <p className="text-xs text-text-muted max-w-3xl">
            Create or remove superadmin accounts, inspect full sign-in telemetry (IP, ISP/network, browser, OS, laptop GPU, hardware fingerprint), and manage approved laptop &amp; IP rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void loadAccounts();
              if (subView === "logs") void loadLogs(logsPage);
            }}
            className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-text-secondary hover:text-primary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (loadingAccounts || loadingLogs) && "animate-spin")} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover px-3.5 py-1.5 text-xs font-bold text-white transition-colors shadow-subtle"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Superadmin
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-panel border border-border-subtle bg-surface p-3.5 shadow-subtle">
            <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">Superadmin Accounts</div>
            <div className="mt-1 text-xl font-black text-primary tabular-nums">{summary.total}</div>
            <div className="mt-0.5 text-3xs text-text-muted">
              {summary.active} active · {summary.blocked} blocked
            </div>
          </div>
          <div className="rounded-panel border border-border-subtle bg-surface p-3.5 shadow-subtle">
            <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">Sign-ins (24h)</div>
            <div className="mt-1 text-xl font-black text-status-success tabular-nums">{summary.logins_24h}</div>
            <div className="mt-0.5 text-3xs text-status-danger">{summary.failed_24h} failed / blocked</div>
          </div>
          <div className="rounded-panel border border-border-subtle bg-surface p-3.5 shadow-subtle">
            <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">Unique IPs &amp; Laptops (30d)</div>
            <div className="mt-1 text-xl font-black text-primary tabular-nums">
              {summary.unique_ips_30d} <span className="text-xs font-semibold text-text-muted">IPs</span> · {summary.unique_devices_30d}{" "}
              <span className="text-xs font-semibold text-text-muted">laptops</span>
            </div>
            <div className="mt-0.5 text-3xs text-text-muted">Hardware fingerprint tracked</div>
          </div>
          <div className="rounded-panel border border-border-subtle bg-surface p-3.5 shadow-subtle">
            <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">Laptop + IP Lock</div>
            <div className="mt-1 text-xl font-black text-amber-500 tabular-nums">{summary.strict_locked}</div>
            <div className="mt-0.5 text-3xs text-text-muted">Accounts with strict enforcement ON</div>
          </div>
        </div>
      )}

      {/* Sub-view switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-control border border-border-subtle bg-elevated p-1">
          <button
            type="button"
            onClick={() => setSubView("accounts")}
            className={cn(
              "rounded-control px-3 py-1.5 text-xs font-bold transition-colors",
              subView === "accounts" ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
            )}
          >
            Superadmin Accounts ({accounts.length})
          </button>
          <button
            type="button"
            onClick={() => setSubView("logs")}
            className={cn(
              "rounded-control px-3 py-1.5 text-xs font-bold transition-colors",
              subView === "logs" ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
            )}
          >
            Login Security Logs (IP · Network · Laptop)
          </button>
        </div>

        {subView === "accounts" && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              placeholder="Search superadmin name or email..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary w-64"
            />
          </div>
        )}
      </div>

      {/* Sub-view 1: Superadmin Accounts */}
      {subView === "accounts" && (
        <>
          {loadingAccounts && accounts.length === 0 ? (
            <div className="rounded-panel border border-border-subtle bg-surface p-8 text-center text-xs text-text-muted">
              Loading superadmin accounts…
            </div>
          ) : accountsError && accounts.length === 0 ? (
            <div className="rounded-panel border border-status-danger/30 bg-status-danger/5 p-8 text-center text-xs text-status-danger space-y-2">
              <AlertTriangle className="h-5 w-5 mx-auto" />
              <p className="font-semibold">{accountsError}</p>
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-panel border border-border-subtle bg-surface p-8 text-center text-xs text-text-muted">
              No superadmin accounts match your search.
            </div>
          ) : (
            <div className="rounded-panel border border-border-subtle bg-surface overflow-hidden shadow-subtle">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                    <tr>
                      <th className="px-4 py-3">Superadmin</th>
                      <th className="px-4 py-3">Status &amp; Lock</th>
                      <th className="px-4 py-3">Latest Login IP &amp; Network</th>
                      <th className="px-4 py-3">Latest Laptop &amp; Browser</th>
                      <th className="px-4 py-3">Sessions</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {accounts.map((sa) => {
                      const last = sa.last_login;
                      return (
                        <tr key={sa.id} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 font-black text-xs flex items-center justify-center shrink-0">
                                {sa.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-primary flex items-center gap-1.5">
                                  <span>{sa.name}</span>
                                  {sa.is_self && (
                                    <span className="rounded-full bg-accent-primary/15 px-1.5 py-0.5 text-3xs font-bold text-accent-primary">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="font-mono text-3xs text-text-muted">
                                  {sa.handle ? `@${sa.handle} · ` : ""}
                                  {sa.email}
                                </div>
                                <div className="text-3xs text-text-muted mt-0.5">
                                  Added {formatDateTime(sa.created_at)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 space-y-1">
                            <div>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-full",
                                  sa.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success"
                                )}
                              >
                                {sa.is_blocked ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                {sa.is_blocked ? "Blocked" : "Active"}
                              </span>
                            </div>
                            <div>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 text-3xs font-semibold px-2 py-0.5 rounded-full border",
                                  sa.enforce_trusted_login
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                    : "border-border-subtle bg-elevated text-text-muted"
                                )}
                              >
                                {sa.enforce_trusted_login ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                                {sa.enforce_trusted_login
                                  ? `Strict Lock (${sa.trusted_devices_count})`
                                  : `Monitor (${sa.trusted_devices_count} trusted)`}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {last ? (
                              <div className="space-y-0.5">
                                <div className="font-mono font-bold text-primary flex items-center gap-1">
                                  <Network className="w-3 h-3 text-accent-primary shrink-0" />
                                  <span>{last.ip_address ?? "—"}</span>
                                </div>
                                <div className="text-3xs text-text-secondary truncate max-w-[200px]">
                                  {last.isp ?? (last.is_private_ip ? "Private / LAN" : "Public IP")}
                                </div>
                                <div className="text-3xs text-text-muted flex items-center gap-1">
                                  <Globe className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate max-w-[180px]">{formatLocation(last)}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-3xs text-text-muted">No tracked login yet</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {last ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-primary flex items-center gap-1">
                                  <Laptop className="w-3 h-3 text-accent-primary shrink-0" />
                                  <span>
                                    {[last.os, last.os_version].filter(Boolean).join(" ") || "OS"} ·{" "}
                                    {[last.browser, last.browser_version].filter(Boolean).join(" ") || "Browser"}
                                  </span>
                                </div>
                                <div className="text-3xs text-text-secondary truncate max-w-[210px]">
                                  {last.gpu_renderer ?? last.device_label ?? "—"}
                                </div>
                                <div className="text-3xs text-text-muted" title={formatDateTime(last.created_at)}>
                                  {timeAgo(last.created_at)} · FP {last.device_fingerprint?.slice(0, 10) ?? "—"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-3xs text-text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-primary tabular-nums">{sa.active_sessions_count}</span>
                            <span className="block text-3xs text-text-muted">{sa.login_logs_count} log(s)</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSecurityDrawerUserId(sa.id)}
                                className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover px-2.5 py-1.5 text-xs font-bold text-primary"
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-accent-primary" />
                                Security &amp; Logins
                              </button>
                              {!sa.is_self && (
                                <button
                                  type="button"
                                  onClick={() => void handleToggleBlock(sa)}
                                  className={cn(
                                    "rounded-control border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                                    sa.is_blocked
                                      ? "border-status-success/30 bg-status-success/10 text-status-success hover:bg-status-success/20"
                                      : "border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                                  )}
                                >
                                  {sa.is_blocked ? "Unblock" : "Block"}
                                </button>
                              )}
                              {sa.can_delete && (
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(sa)}
                                  className="inline-flex items-center gap-1 rounded-control border border-status-danger/30 bg-status-danger/10 px-2.5 py-1.5 text-xs font-bold text-status-danger hover:bg-status-danger/20"
                                  title="Permanently delete superadmin account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
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
            </div>
          )}
        </>
      )}

      {/* Sub-view 2: Global Superadmin Login Security Logs */}
      {subView === "logs" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search IP, email, laptop, GPU, ISP, city, fingerprint..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary w-72"
              />
            </div>

            <select
              value={logUserId}
              onChange={(e) => setLogUserId(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
            >
              <option value="">All Superadmins</option>
              {accounts.map((sa) => (
                <option key={sa.id} value={sa.id}>
                  {sa.name} ({sa.email})
                </option>
              ))}
            </select>

            <select
              value={logEvent}
              onChange={(e) => setLogEvent(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
            >
              {EVENT_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <span className="text-2xs text-text-muted ml-auto">{logsTotal.toLocaleString()} event(s)</span>
          </div>

          {loadingLogs && logs.length === 0 ? (
            <div className="rounded-panel border border-border-subtle bg-surface p-8 text-center text-xs text-text-muted">
              Loading login security logs…
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-panel border border-border-subtle bg-surface p-8 text-center text-xs text-text-muted">
              No superadmin login events match your filters yet. Every sign-in, failed attempt, blocked attempt, and logout is recorded here.
            </div>
          ) : (
            <div className="rounded-panel border border-border-subtle bg-surface overflow-hidden shadow-subtle">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Superadmin &amp; Event</th>
                      <th className="px-4 py-3">IP &amp; Network</th>
                      <th className="px-4 py-3">Laptop, OS &amp; Browser</th>
                      <th className="px-4 py-3">Hardware Fingerprint</th>
                      <th className="px-4 py-3 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {logs.map((log) => {
                      const meta = eventMeta(log.event);
                      return (
                        <tr key={log.id} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-primary">{formatDateTime(log.created_at)}</div>
                            <div className="text-3xs text-text-muted">{timeAgo(log.created_at)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-primary">{log.user_name ?? "—"}</div>
                            <div className="font-mono text-3xs text-text-muted">{log.email ?? "—"}</div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold", meta.badge)}>{meta.label}</span>
                              {log.reason && <span className="text-3xs text-status-danger">{log.reason}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono font-bold text-primary">{log.ip_address ?? "—"}</div>
                            {log.forwarded_for && (
                              <div className="font-mono text-3xs text-text-muted truncate max-w-[180px]" title={log.forwarded_for}>
                                fwd: {log.forwarded_for}
                              </div>
                            )}
                            <div className="text-3xs text-text-secondary truncate max-w-[200px]">
                              {[log.isp, log.asn].filter(Boolean).join(" · ") || (log.is_private_ip ? "Local / LAN" : "—")}
                            </div>
                            <div className="text-3xs text-text-muted">
                              {formatLocation(log)}
                              {log.network_type || log.effective_type ? ` · ${log.network_type ?? log.effective_type?.toUpperCase()}` : ""}
                              {log.rtt_ms !== null ? ` · ${log.rtt_ms}ms` : ""}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-primary">
                              {[log.os, log.os_version].filter(Boolean).join(" ") || "—"} ·{" "}
                              {[log.browser, log.browser_version].filter(Boolean).join(" ") || "—"}
                            </div>
                            <div className="text-3xs text-text-secondary truncate max-w-[220px]" title={log.gpu_renderer ?? undefined}>
                              {log.gpu_renderer ?? "GPU not reported"}
                            </div>
                            <div className="text-3xs text-text-muted">
                              {[
                                log.device_type,
                                log.cpu_cores ? `${log.cpu_cores}c` : null,
                                log.device_memory_gb ? `${log.device_memory_gb}GB` : null,
                                log.screen_resolution,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-3xs text-primary">
                              {log.device_fingerprint ? `${log.device_fingerprint.slice(0, 16)}…` : "—"}
                            </div>
                            {log.device_id && <div className="font-mono text-3xs text-text-muted">{log.device_id.slice(0, 16)}…</div>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setInspectLog(log)}
                                className="inline-flex items-center gap-1 rounded-control border border-border-subtle bg-elevated px-2.5 py-1 text-3xs font-bold text-primary hover:bg-surface-hover"
                              >
                                <Eye className="w-3 h-3" /> Full Details
                              </button>
                              {log.user_id && (log.ip_address || log.device_fingerprint) && (
                                <button
                                  type="button"
                                  onClick={() => setTrustTargetLog(log)}
                                  className="inline-flex items-center gap-1 rounded-control border border-accent-primary/30 bg-accent-primary/10 px-2 py-1 text-3xs font-bold text-accent-primary hover:bg-accent-primary/20"
                                  title="Trust this laptop & IP for future enforcement"
                                >
                                  <ShieldCheck className="w-3 h-3" /> Trust
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

              {logsLastPage > 1 && (
                <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 text-2xs text-text-muted">
                  <span>
                    Page {logsPage} of {logsLastPage}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={logsPage <= 1 || loadingLogs}
                      onClick={() => void loadLogs(logsPage - 1)}
                      className="rounded-control border border-border-subtle px-2.5 py-1 font-semibold hover:text-primary disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={logsPage >= logsLastPage || loadingLogs}
                      onClick={() => void loadLogs(logsPage + 1)}
                      className="rounded-control border border-border-subtle px-2.5 py-1 font-semibold hover:text-primary disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals & Drawers */}
      {showCreate && (
        <CreateSuperadminModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            void loadAccounts();
          }}
          triggerToast={triggerToast}
        />
      )}

      {deleteTarget && (
        <DeleteSuperadminModal
          account={{ id: deleteTarget.id, name: deleteTarget.name, email: deleteTarget.email }}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(deletedName) => {
            setDeleteTarget(null);
            triggerToast(`Deleted superadmin account ${deletedName}.`);
            void loadAccounts();
          }}
        />
      )}

      {securityDrawerUserId !== null && (
        <SuperadminSecurityDrawer
          userId={securityDrawerUserId}
          onClose={() => setSecurityDrawerUserId(null)}
          onChanged={() => {
            void loadAccounts();
            if (subView === "logs") void loadLogs(logsPage);
          }}
          triggerToast={triggerToast}
        />
      )}

      {inspectLog && (
        <LoginTelemetryDetailModal
          log={inspectLog}
          onClose={() => setInspectLog(null)}
          onTrustDevice={(l) => {
            setInspectLog(null);
            setTrustTargetLog(l);
          }}
        />
      )}

      {trustTargetLog && trustTargetLog.user_id && (
        <TrustDeviceModal
          userId={trustTargetLog.user_id}
          accountLabel={trustTargetLog.user_name ?? trustTargetLog.email ?? `Superadmin #${trustTargetLog.user_id}`}
          prefill={trustTargetLog}
          onClose={() => setTrustTargetLog(null)}
          onAdded={() => {
            setTrustTargetLog(null);
            void loadAccounts();
          }}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}
