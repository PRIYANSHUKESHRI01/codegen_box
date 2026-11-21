"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, Users, Bot, Zap, Sparkles, RefreshCw, Radio, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TrafficPulseData {
  concurrent_online: number;
  active_ai_interviews: number;
  pending_ai_scoring: number;
  submissions_last_hour: number;
  gemini_key: {
    index: number;
    name: string;
    hour_slot: string;
  };
  mellow_vault_transfers_today: {
    total: number;
    delivered: number;
    failed: number;
  };
  server_timestamp: string;
}

export function TrafficPulseBar() {
  const [data, setData] = useState<TrafficPulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchPulse = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await api.get<TrafficPulseData>("/superadmin/traffic-pulse");
      setData(res);
      setLastRefreshed(new Date());
    } catch (err) {
      // Fail silently on polling to avoid disturbing admin view
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPulse(false);
    // Poll every 12 seconds for real-time scale telemetry
    const interval = setInterval(() => fetchPulse(true), 12000);
    return () => clearInterval(interval);
  }, [fetchPulse]);

  return (
    <div className="w-full rounded-panel border border-border-subtle bg-surface/80 backdrop-blur-sm p-3 shadow-subtle transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Section Title with Live Beacon */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </div>
          <span className="text-2xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-accent-primary animate-pulse" />
            High-Concurrency System Pulse
          </span>
          <span className="text-3xs font-medium text-text-muted hidden sm:inline-block">
            (2,000–3,000 Concurrent Telemetry)
          </span>
        </div>

        {/* Right: Metrics Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Concurrent Online */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-elevated/70 border border-border-subtle text-xs">
            <Users className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-text-muted text-3xs font-semibold">Online (5m):</span>
            <span className="font-bold text-primary">
              {data ? data.concurrent_online.toLocaleString() : "..."}
            </span>
          </div>

          {/* 2. Active AI Interviews */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-elevated/70 border border-border-subtle text-xs">
            <Bot className="w-3.5 h-3.5 text-cyan-500" />
            <span className="text-text-muted text-3xs font-semibold">Live Interviews:</span>
            <span className="font-bold text-cyan-400">
              {data ? data.active_ai_interviews.toLocaleString() : "..."}
            </span>
          </div>

          {/* 3. AI Scoring Queue Pressure */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-control border text-xs",
              (data?.pending_ai_scoring ?? 0) > 10
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                : "bg-elevated/70 border-border-subtle text-text-secondary"
            )}
            title="Completed interviews awaiting Gemini AI evaluation"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-text-muted text-3xs font-semibold">Scoring Queue:</span>
            <span className="font-bold text-primary">
              {data ? data.pending_ai_scoring : "..."}
            </span>
            {(data?.pending_ai_scoring ?? 0) > 10 && (
              <span className="text-3xs font-bold px-1 rounded bg-amber-500/20 text-amber-600">
                Backlog
              </span>
            )}
          </div>

          {/* 4. Active Gemini Rotating Key */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-purple-500/5 border border-purple-500/20 text-xs"
            title={`Active 4-hour slot: ${data?.gemini_key.hour_slot ?? "Active"}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-text-muted text-3xs font-semibold">Gemini Slot:</span>
            <span className="font-bold text-purple-400 text-3xs">
              {data ? `Key #${data.gemini_key.index}` : "..."}
            </span>
            <span className="text-3xs text-text-muted font-mono hidden md:inline">
              ({data?.gemini_key.hour_slot})
            </span>
          </div>

          {/* 5. Mellow Vault Sync Today */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-emerald-500/5 border border-emerald-500/20 text-xs"
            title={`Transfers today: ${data?.mellow_vault_transfers_today.delivered ?? 0} delivered of ${data?.mellow_vault_transfers_today.total ?? 0}`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-text-muted text-3xs font-semibold">Vault Sync:</span>
            <span className="font-bold text-emerald-400 text-3xs">
              {data
                ? `${data.mellow_vault_transfers_today.delivered}/${data.mellow_vault_transfers_today.total}`
                : "..."}
            </span>
          </div>

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={() => fetchPulse(false)}
            disabled={loading}
            title="Refresh pulse telemetry"
            className="p-1 rounded-control hover:bg-elevated text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-accent-primary")} />
          </button>
        </div>
      </div>
    </div>
  );
}
