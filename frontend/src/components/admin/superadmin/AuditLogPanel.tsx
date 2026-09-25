"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldAlert, Search, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { ROLE_LABEL, formatDateTime, type ApiAuditLog, type ApiPage, type PlatformRole } from "./types";

const TARGET_TYPES = ["User", "College", "Plan", "FeatureFlag"];

export function AuditLogPanel() {
  const [logs, setLogs] = useState<ApiAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [actorRole, setActorRole] = useState("all");
  const [targetType, setTargetType] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildParams = useCallback((extra: Record<string, string> = {}) => {
    const params = new URLSearchParams(extra);
    if (actorRole !== "all") params.set("actor_role", actorRole);
    if (targetType !== "all") params.set("target_type", targetType);
    if (searchDebounced) params.set("search", searchDebounced);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }, [actorRole, targetType, searchDebounced, from, to]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<{ logs: ApiPage<ApiAuditLog> }>(`/superadmin/audit-logs?${buildParams().toString()}`)
      .then((res) => {
        setLogs(res.logs.data);
        setPage(res.logs.current_page);
        setHasMore(res.logs.current_page < res.logs.last_page);
        setTotal(res.logs.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load the audit log."))
      .finally(() => setLoading(false));
  }, [buildParams]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = () => {
    setLoadingMore(true);
    api
      .get<{ logs: ApiPage<ApiAuditLog> }>(`/superadmin/audit-logs?${buildParams({ page: String(page + 1) }).toString()}`)
      .then((res) => {
        setLogs((prev) => [...prev, ...res.logs.data]);
        setPage(res.logs.current_page);
        setHasMore(res.logs.current_page < res.logs.last_page);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load more log entries."))
      .finally(() => setLoadingMore(false));
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-primary flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-status-warning" />
          <span>Administrative Audit Trail</span>
        </h2>
        <p className="text-xs text-text-muted">{total.toLocaleString()} sensitive admin action(s) recorded — every row comes from a real write path.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={actorRole}
          onChange={(e) => setActorRole(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
        >
          <option value="all">All Actor Roles</option>
          {(Object.keys(ROLE_LABEL) as PlatformRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>

        <select
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary"
        >
          <option value="all">All Target Types</option>
          {TARGET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary" />
        <span className="text-xs text-text-muted">to</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-2.5 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary outline-none focus:border-accent-primary" />

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, target, actor..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-panel bg-status-danger/10 border border-status-danger/25 flex items-center justify-between gap-3 text-xs text-status-danger">
          <span>{error}</span>
          <button onClick={load} className="font-bold underline shrink-0">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading audit trail...
        </div>
      ) : logs.length === 0 ? (
        <p className="p-8 text-xs text-text-muted text-center rounded-panel bg-surface border border-border-subtle">
          No admin actions match this filter.
        </p>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <div className="space-y-2.5 p-4">
            {logs.map((log) => (
              <div key={log.id} className="p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs space-y-1.5 hover:bg-surface-hover transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-primary truncate">{log.actor_name}</span>
                  <span className="text-[10px] font-mono text-text-muted shrink-0">{formatDateTime(log.created_at)}</span>
                </div>
                <p className="text-text-secondary text-[11px] leading-relaxed">
                  {log.action}
                  {log.target_label && (
                    <>
                      {" — "}
                      <strong className="text-primary">{log.target_label}</strong>
                    </>
                  )}
                </p>
                <div className="flex items-center justify-between text-[10px] text-text-muted font-mono pt-1 border-t border-border-subtle/50">
                  <span>{ROLE_LABEL[log.actor_role as PlatformRole] ?? log.actor_role}</span>
                  {log.target_type && <span>Target: {log.target_type}</span>}
                </div>
              </div>
            ))}
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
