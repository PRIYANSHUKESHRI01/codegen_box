"use client";

import { useCallback, useEffect, useState } from "react";
import { Cpu, Server, RefreshCw, Sliders, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Toggle } from "@/components/ui/Toggle";

interface JudgeNodeStatus {
  name: string;
  status: "healthy" | "busy" | "degraded" | "offline";
  latency_ms: number | null;
  in_flight: number;
  max_jobs: number;
  breaker_open: boolean;
  runtimes: string[];
}

interface JudgeTelemetry {
  nodes: JudgeNodeStatus[];
  queues: Record<string, { name: string; depth: number }>;
  totals: {
    nodes: number;
    healthy_nodes: number;
    capacity: number;
    in_flight: number;
    queued: number;
    estimated_wait_seconds: number | null;
  };
  stats: {
    completed: number;
    failed: number;
    avg_wait_ms: number | null;
    avg_exec_ms: number | null;
    window_minutes: number;
    throughput_per_minute: number;
  };
}

const TELEMETRY_REFRESH_MS = 5000;

interface FeatureFlag {
  id: number;
  key: string;
  name: string;
  description: string | null;
  category: string;
  enabled: boolean;
  updated_by_name: string | null;
  updated_at: string;
}

/**
 * Judge telemetry is live: every node is probed and every queue measured at
 * request time (see JudgeStatusService), then refreshed every few seconds.
 * Nothing here is stored or hand-entered - this replaced a table of invented
 * "clusters" that implied capacity the platform never had. Feature flags are
 * real, persisted toggles; application code does not branch on them yet.
 */
export function InfrastructurePanel({ triggerToast }: { triggerToast: (msg: string) => void }) {
  const [telemetry, setTelemetry] = useState<JudgeTelemetry | null>(null);
  const [nodesLoading, setNodesLoading] = useState(true);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadNodes = useCallback(
    (silent = false) => {
      if (!silent) setNodesLoading(true);
      api
        .get<JudgeTelemetry>("/superadmin/judge-nodes")
        .then(setTelemetry)
        .catch((err) => {
          if (!silent) triggerToast(err instanceof ApiError ? err.message : "Failed to load judge telemetry.");
        })
        .finally(() => setNodesLoading(false));
    },
    [triggerToast]
  );

  const loadFlags = useCallback(() => {
    setFlagsLoading(true);
    api
      .get<{ flags: FeatureFlag[] }>("/superadmin/feature-flags")
      .then((res) => setFlags(res.flags))
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load feature flags."))
      .finally(() => setFlagsLoading(false));
  }, [triggerToast]);

  useEffect(() => {
    loadNodes();
    loadFlags();
  }, [loadNodes, loadFlags]);

  // Live: keep the pool + queue numbers fresh while this tab is open.
  useEffect(() => {
    const timer = setInterval(() => loadNodes(true), TELEMETRY_REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadNodes]);

  const handleToggleFlag = async (flag: FeatureFlag) => {
    setTogglingId(flag.id);
    try {
      const res = await api.post<{ flag: FeatureFlag }>(`/superadmin/feature-flags/${flag.id}/toggle`);
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? res.flag : f)));
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update flag.");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section id="judge-nodes" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <Cpu className="w-5 h-5 text-accent-primary" />
              <span>Code Execution Pool</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-status-success/15 text-status-success border border-status-success/30 font-bold uppercase tracking-wide">Live</span>
            </h2>
            <p className="text-xs text-text-muted">
              Measured right now from the real Piston nodes and judge queues — refreshes every {TELEMETRY_REFRESH_MS / 1000}s.
            </p>
          </div>
          <button
            onClick={() => loadNodes()}
            className="p-1.5 rounded-control border border-border-subtle hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
            title="Refresh now"
          >
            <RefreshCw className={cn("w-4 h-4", nodesLoading && "animate-spin")} />
          </button>
        </div>

        {nodesLoading && !telemetry ? (
          <div className="p-8 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
            <Loader2 className="w-4 h-4 animate-spin" />
            Probing execution nodes...
          </div>
        ) : telemetry ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Capacity", value: telemetry.totals.capacity, sub: `${telemetry.totals.healthy_nodes}/${telemetry.totals.nodes} nodes healthy` },
                { label: "Executing", value: telemetry.totals.in_flight, sub: "jobs in flight now" },
                {
                  label: "Queued",
                  value: telemetry.totals.queued,
                  sub: telemetry.totals.estimated_wait_seconds === null ? "no backlog estimate" : `~${telemetry.totals.estimated_wait_seconds}s to drain`,
                },
                { label: "Throughput", value: telemetry.stats.throughput_per_minute, sub: `jobs/min (last ${telemetry.stats.window_minutes} min)` },
                {
                  label: "Avg wait / exec",
                  value: `${telemetry.stats.avg_wait_ms ?? "—"} / ${telemetry.stats.avg_exec_ms ?? "—"}`,
                  sub: `ms · ${telemetry.stats.failed} failed`,
                },
              ].map((c) => (
                <div key={c.label} className="p-3.5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                  <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block">{c.label}</span>
                  <span className="text-xl font-black text-primary font-mono mt-1 block">{c.value}</span>
                  <span className="text-[10px] text-text-muted">{c.sub}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-text-muted font-semibold uppercase tracking-wider">Queues</span>
              {Object.entries(telemetry.queues).map(([key, q]) => (
                <span key={key} className="px-2 py-1 rounded-control bg-elevated border border-border-subtle text-text-secondary">
                  {key} <span className="text-text-muted font-mono">({q.name})</span>{" "}
                  <strong className={cn("font-mono", q.depth > 0 ? "text-status-warning" : "text-primary")}>{q.depth < 0 ? "n/a" : q.depth}</strong>
                </span>
              ))}
            </div>

            {telemetry.nodes.length === 0 ? (
              <div className="p-6 text-center text-xs text-status-danger rounded-panel bg-status-danger/10 border border-status-danger/25">
                No Piston nodes are configured (PISTON_NODES / PISTON_BASE_URL) — code cannot be executed.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {telemetry.nodes.map((node) => {
                  const pct = Math.min(100, Math.round((node.in_flight / Math.max(1, node.max_jobs)) * 100));
                  return (
                    <div key={node.name} className="p-4 rounded-panel bg-surface border border-border-subtle hover:border-border-strong transition-all space-y-3 shadow-subtle">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-accent-secondary" />
                          <span className="font-semibold text-xs text-primary font-mono">{node.name}</span>
                        </div>
                        <span
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase",
                            node.status === "healthy" && "bg-status-success/15 text-status-success",
                            node.status === "busy" && "bg-status-warning/15 text-status-warning",
                            (node.status === "degraded" || node.status === "offline") && "bg-status-danger/15 text-status-danger"
                          )}
                        >
                          {node.status}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-text-secondary">
                          <span>Execution slots</span>
                          <span className="font-mono font-medium">
                            {node.in_flight} / {node.max_jobs}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all duration-500", pct >= 100 ? "bg-status-danger" : pct >= 75 ? "bg-status-warning" : "bg-accent-primary")} style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
                        <span>
                          Runtimes: <strong className="text-primary">{node.runtimes.length}</strong>
                          {node.breaker_open && <span className="ml-2 text-status-danger font-bold">circuit open</span>}
                        </span>
                        <span className="font-mono text-status-success font-medium">{node.latency_ms === null ? "unreachable" : `${node.latency_ms}ms`}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="p-6 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Couldn&apos;t load judge telemetry.</div>
        )}
      </section>

      <section className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-4">
        <div>
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            <Sliders className="w-4 h-4 text-accent-primary" />
            <span>Platform Feature Flags</span>
          </h2>
          <p className="text-[11px] text-text-muted mt-1">
            Real, persisted toggles — they survive a reload. Application code doesn't branch on these yet; that wiring is a separate initiative.
          </p>
        </div>

        {flagsLoading ? (
          <div className="p-6 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading flags...
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => (
              <div key={flag.id} className="p-3 rounded-control bg-elevated/60 border border-border-subtle flex items-center justify-between gap-3 hover:bg-surface-hover transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary truncate">{flag.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-surface text-text-muted border border-border-subtle font-mono">{flag.category}</span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{flag.description}</p>
                  {flag.updated_by_name && (
                    <p className="text-[10px] text-text-muted mt-1">Last changed by {flag.updated_by_name}</p>
                  )}
                </div>

                <Toggle
                  checked={flag.enabled}
                  onChange={() => handleToggleFlag(flag)}
                  label={flag.name}
                  disabled={togglingId === flag.id}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
