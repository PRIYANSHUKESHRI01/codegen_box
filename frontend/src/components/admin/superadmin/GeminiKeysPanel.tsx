"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Clock,
  Sparkles,
  Copy,
  Check,
  Loader2,
  ChevronDown,
  Activity,
  Layers,
  ArrowRight,
  Eye,
  EyeOff,
  Zap,
  Radio,
  Gauge,
  Flame,
  Info,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Toggle } from "@/components/ui/Toggle";
import { type ToastTrigger } from "@/lib/toast";

export interface GeminiKeyItem {
  id: number;
  label: string;
  api_key_masked: string;
  has_key: boolean;
  order_index: number;
  duration_hours: number;
  is_active: boolean;
  is_exhausted: boolean;
  exhausted_until: string | null;
  is_available: boolean;
  cooldown_type: "none" | "rpm_cooldown" | "daily_exhausted";
  cooldown_seconds_remaining: number;
  status_badge: "healthy" | "rpm_cooldown" | "daily_exhausted" | "inactive" | "unconfigured";
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  traffic_share_percent: number;
  success_rate_percent: number;
  last_used_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  slot_start_time?: string;
  slot_end_time?: string;
  is_scheduled_now?: boolean;
  is_effective_now?: boolean;
}

export interface PoolSummary {
  routing_strategy: string;
  timezone: string;
  current_time_local: string;
  current_date_local: string;
  total_keys: number;
  active_keys: number;
  healthy_keys: number;
  rpm_cooldown_keys: number;
  daily_exhausted_keys: number;
  inactive_keys: number;
  unconfigured_keys: number;
  aggregate_rpm_capacity: number;
  aggregate_rpd_capacity: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  reliability_rate_percent: number;
  effective_key_label: string;
  fallback_env_available: boolean;
}

export interface PoolDetailsResponse {
  keys: GeminiKeyItem[];
  summary: PoolSummary;
}

// Distinct vibrant colors for keys in the load distribution bar
const KEY_COLORS = [
  "#10B981", // Emerald
  "#6366F1", // Indigo
  "#F59E0B", // Amber
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#84CC16", // Lime
  "#0EA5E9", // Sky
  "#D946EF", // Fuchsia
];

function cleanKeyLabel(label: string): string {
  return label.replace(/\s*\(\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\)/g, "").trim();
}

export function GeminiKeysPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [data, setData] = useState<PoolDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingEnv, setSyncingEnv] = useState(false);
  const [actionLoadingKeyId, setActionLoadingKeyId] = useState<number | null>(null);
  const [testingKeyId, setTestingKeyId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; valid: boolean; message: string; latency_ms?: number } | null>(null);

  // Edit Key Modal State
  const [editingKeyId, setEditingKeyId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editApiKey, setEditApiKey] = useState("");
  const [showEditKey, setShowEditKey] = useState(false);

  // Add Key Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newApiKey, setNewApiKey] = useState("");
  const [showNewKey, setShowNewKey] = useState(false);
  const [modalTesting, setModalTesting] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<{ valid: boolean; message: string; latency_ms?: number } | null>(null);

  // Delete Confirm State
  const [deletingKey, setDeletingKey] = useState<GeminiKeyItem | null>(null);

  // Copied Key Feedback
  const [copiedKeyId, setCopiedKeyId] = useState<number | null>(null);

  const handleCopyKey = (key: GeminiKeyItem) => {
    if (!key.has_key) return;
    navigator.clipboard.writeText(key.api_key_masked);
    setCopiedKeyId(key.id);
    triggerToast(`Copied ${key.label} key mask to clipboard`, "success");
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const res = await api.get<PoolDetailsResponse>("/superadmin/gemini-keys");
        setData(res);
      } catch (err) {
        console.error("Failed to load Gemini key pool data:", err);
        triggerToast("Failed to load Gemini key pool", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [triggerToast]
  );

  useEffect(() => {
    loadData();
    // Auto refresh pool stats every 30 seconds for live monitoring
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Live countdown ticker for any keys in 60s cooldown
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleActive = async (key: GeminiKeyItem) => {
    setActionLoadingKeyId(key.id);
    try {
      const res = await api.post<{ message: string; schedule: PoolDetailsResponse }>(
        `/superadmin/gemini-keys/${key.id}/toggle-active`,
        {}
      );
      setData(res.schedule);
      triggerToast(res.message, "success");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to toggle key status", "error");
    } finally {
      setActionLoadingKeyId(null);
    }
  };

  const handleResetCooldown = async (key: GeminiKeyItem) => {
    setActionLoadingKeyId(key.id);
    try {
      const res = await api.post<{ message: string; schedule: PoolDetailsResponse }>(
        `/superadmin/gemini-keys/${key.id}/reset-status`,
        {}
      );
      setData(res.schedule);
      triggerToast(res.message, "success");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to reset cooldown", "error");
    } finally {
      setActionLoadingKeyId(null);
    }
  };

  const handleTestKey = async (key: GeminiKeyItem) => {
    setTestingKeyId(key.id);
    setTestResult(null);
    try {
      const res = await api.post<{ test_result: { valid: boolean; status: number; message: string; latency_ms?: number }; schedule: PoolDetailsResponse }>(
        `/superadmin/gemini-keys/${key.id}/test`,
        {}
      );
      setData(res.schedule);
      setTestResult({
        id: key.id,
        valid: res.test_result.valid,
        message: res.test_result.message,
        latency_ms: res.test_result.latency_ms,
      });
      triggerToast(
        res.test_result.valid ? `Key passed test (${res.test_result.latency_ms}ms)` : `Test failed: ${res.test_result.message}`,
        res.test_result.valid ? "success" : "error"
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to test key";
      setTestResult({ id: key.id, valid: false, message: msg });
      triggerToast(msg, "error");
    } finally {
      setTestingKeyId(null);
    }
  };

  const handleTestRawKey = async (rawKey: string) => {
    if (!rawKey.trim()) {
      triggerToast("Please enter an API key to test", "warning");
      return;
    }
    setModalTesting(true);
    setModalTestResult(null);
    try {
      // Use slot 1 test endpoint with override raw key
      const firstId = data?.keys[0]?.id ?? 1;
      const res = await api.post<{ test_result: { valid: boolean; status: number; message: string; latency_ms?: number } }>(
        `/superadmin/gemini-keys/${firstId}/test`,
        { api_key: rawKey.trim() }
      );
      setModalTestResult(res.test_result);
      triggerToast(
        res.test_result.valid ? `Key verified live (${res.test_result.latency_ms}ms)` : res.test_result.message,
        res.test_result.valid ? "success" : "error"
      );
    } catch (err) {
      setModalTestResult({ valid: false, message: err instanceof ApiError ? err.message : "Test failed" });
    } finally {
      setModalTesting(false);
    }
  };

  const handleOpenAddModal = () => {
    const nextOrder = (data?.keys.length ?? 0) + 1;
    setNewLabel(`Gemini Key ${nextOrder}`);
    setNewApiKey("");
    setShowNewKey(false);
    setModalTestResult(null);
    setIsAdding(true);
  };

  const handleSaveNewKey = async () => {
    if (!newLabel.trim()) {
      triggerToast("Slot label is required", "error");
      return;
    }
    setActionLoadingKeyId(-1);
    try {
      const res = await api.post<{ message: string; schedule: PoolDetailsResponse }>(
        "/superadmin/gemini-keys",
        {
          label: newLabel.trim(),
          api_key: newApiKey.trim() || null,
          is_active: true,
        }
      );
      setData(res.schedule);
      setIsAdding(false);
      triggerToast(res.message, "success");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to add key slot", "error");
    } finally {
      setActionLoadingKeyId(null);
    }
  };

  const handleOpenEditModal = (key: GeminiKeyItem) => {
    setEditingKeyId(key.id);
    setEditLabel(key.label);
    setEditApiKey(""); // Keep blank unless updating
    setShowEditKey(false);
    setModalTestResult(null);
  };

  const handleSaveEditKey = async () => {
    if (!editingKeyId) return;
    setActionLoadingKeyId(editingKeyId);
    try {
      const payload: { label: string; api_key?: string } = { label: editLabel.trim() };
      if (editApiKey.trim() !== "") {
        payload.api_key = editApiKey.trim();
      }
      const res = await api.put<{ message: string; schedule: PoolDetailsResponse }>(
        `/superadmin/gemini-keys/${editingKeyId}`,
        payload
      );
      setData(res.schedule);
      setEditingKeyId(null);
      triggerToast(res.message, "success");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update key slot", "error");
    } finally {
      setActionLoadingKeyId(null);
    }
  };

  const handleDeleteKey = async () => {
    if (!deletingKey) return;
    setActionLoadingKeyId(deletingKey.id);
    try {
      const res = await api.delete<{ message: string; schedule: PoolDetailsResponse }>(
        `/superadmin/gemini-keys/${deletingKey.id}`
      );
      setData(res.schedule);
      setDeletingKey(null);
      triggerToast(res.message, "success");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to delete key slot", "error");
    } finally {
      setActionLoadingKeyId(null);
    }
  };

  const handleImportFromEnv = async () => {
    setSyncingEnv(true);
    try {
      const res = await api.post<{ message: string; schedule: PoolDetailsResponse }>(
        "/superadmin/gemini-keys/sync-env",
        {}
      );
      setData(res.schedule);
      triggerToast(res.message, "success");
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to import from .env", "error");
    } finally {
      setSyncingEnv(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-text-muted gap-3 rounded-3xl bg-surface border border-border-subtle shadow-sm">
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-accent-primary/20 border-t-accent-primary animate-spin" />
          <KeyRound className="w-5 h-5 text-accent-primary absolute" />
        </div>
        <span className="text-xs font-semibold text-text-secondary">
          Initializing Gemini High-Concurrency Load Balancer Pool...
        </span>
      </div>
    );
  }

  if (!data) return null;

  const { keys, summary } = data;

  return (
    <div className="space-y-6">
      {/* ── HERO HEADER & CONTROL BAR ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-border-subtle bg-gradient-to-r from-surface via-elevated/70 to-surface p-6 shadow-sm backdrop-blur-md">
        {/* Ambient Top Glows */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-48 w-48 rounded-full bg-accent-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 right-10 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Title & Live Status */}
          <div>
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-accent-primary/20 to-accent-primary/10 border border-accent-primary/30 text-accent-primary shadow-sm">
                <KeyRound className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-text-primary">
                    Gemini API Keys & Production Load Balancer Pool
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-500" />
                    Round-Robin Load Balancer ({summary.healthy_keys}/{summary.active_keys} Ready)
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  Distributes live AI requests across all healthy keys. Scales smoothly for 10k+ concurrent students with automatic 60s cooldowns & instant failover.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Clock chip */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-background/80 border border-border-subtle text-xs font-mono text-text-muted shadow-xs">
              <Clock className="w-3.5 h-3.5 text-accent-primary" />
              <span>{summary.current_time_local}</span>
              <span className="text-3xs text-text-secondary font-sans font-bold">({summary.timezone})</span>
            </div>

            {/* Refresh */}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-surface hover:bg-elevated border border-border-subtle text-text-muted hover:text-text-primary transition-all shadow-xs disabled:opacity-50"
              title="Refresh telemetry"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>

            {/* Import from .env (read-only) */}
            <button
              onClick={handleImportFromEnv}
              disabled={syncingEnv}
              className="px-3.5 py-2 rounded-2xl bg-surface hover:bg-elevated border border-border-subtle text-xs font-bold text-text-secondary hover:text-text-primary transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              title="Import existing GEMINI_API_KEY_* values from .env into the database pool (read-only)"
            >
              <RotateCcw className={cn("w-3.5 h-3.5", syncingEnv && "animate-spin")} />
              <span>Import .env</span>
            </button>

            {/* + Add Slot */}
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 rounded-2xl bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-extrabold transition-all shadow-sm shadow-accent-primary/25 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Key Slot</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TOP 4 KPI CARDS: CAPACITY, LOAD BALANCER, COOLDOWNS, RELIABILITY ───── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Aggregate Pool Capacity */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-surface border border-emerald-500/30 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-extrabold text-2xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-500" />
                Aggregate Capacity
              </span>
              <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {summary.active_keys} Active Keys
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-black font-mono text-text-primary tracking-tight">
                ~{summary.aggregate_rpm_capacity} <span className="text-xs font-sans text-text-muted font-bold">RPM</span>
              </div>
              <div className="text-2xs text-text-secondary font-medium">
                ~{summary.aggregate_rpd_capacity.toLocaleString()} requests/day combined burst
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-2xs font-mono text-text-muted">
            <span className="text-emerald-700 dark:text-emerald-300 font-bold">
              {summary.healthy_keys} healthy & serving
            </span>
            <span>{summary.total_keys} total slots</span>
          </div>
        </div>

        {/* Card 2: Routing Strategy & Alignment */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-surface border border-indigo-500/30 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-blue-600" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-extrabold text-2xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Load Balancer
              </span>
              <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                Round-Robin
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-base font-black text-text-primary tracking-tight">
                Equal Request Splitting
              </div>
              <div className="text-2xs text-text-secondary leading-relaxed">
                Requests circular-split 1:1 across healthy keys; fails over on 429 instantly.
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-2xs font-mono">
            <span className="text-accent-primary font-bold">In-Flight Failover: Active</span>
            <span className="text-text-muted">Auto-Retry on 429</span>
          </div>
        </div>

        {/* Card 3: Health & Cooldowns */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-surface border border-amber-500/30 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-600" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-extrabold text-2xs uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-500" />
                Pool Health Status
              </span>
              <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                {summary.rpm_cooldown_keys > 0 ? `${summary.rpm_cooldown_keys} in Cooldown` : "100% Ready"}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-mono font-bold">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  {summary.healthy_keys} Healthy
                </span>
                {summary.rpm_cooldown_keys > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {summary.rpm_cooldown_keys} 60s RPM
                  </span>
                )}
                {summary.daily_exhausted_keys > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300">
                    {summary.daily_exhausted_keys} Daily RPD
                  </span>
                )}
              </div>
              <div className="text-2xs text-text-secondary">
                Auto-recovers without downtime when cooldown window passes.
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-2xs font-mono text-text-muted">
            <span>Inactive: {summary.inactive_keys}</span>
            <span>Blank: {summary.unconfigured_keys}</span>
          </div>
        </div>

        {/* Card 4: Traffic & Reliability */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-surface border border-purple-500/30 flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-violet-600" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-extrabold text-2xs uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-purple-500" />
                Traffic & Reliability
              </span>
              <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                {summary.reliability_rate_percent}% OK
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-black font-mono text-text-primary tracking-tight">
                {summary.total_requests.toLocaleString()}{" "}
                <span className="text-xs font-sans text-text-muted font-bold">requests</span>
              </div>
              <div className="text-2xs text-text-secondary font-medium">
                Across mock AI interviews, speaking, and quiz generators
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-2xs font-mono text-text-muted">
            <span className="text-emerald-700 dark:text-emerald-300 font-bold">
              {summary.successful_requests.toLocaleString()} ok
            </span>
            <span className="text-rose-700 dark:text-rose-300 font-bold">
              {summary.failed_requests.toLocaleString()} errors
            </span>
          </div>
        </div>
      </div>

      {/* ── LOAD BALANCER REQUEST DISTRIBUTION VISUALIZER ─────────────────────── */}
      <div className="p-6 rounded-3xl bg-surface border border-border-subtle shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-wider text-text-primary">
                Live Pool Traffic Distribution & Share
              </h3>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Even load splitting ensures no single key exceeds the 15 RPM ceiling during student traffic rushes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono font-bold px-2.5 py-1 rounded-xl bg-elevated text-text-secondary border border-border-subtle">
              {summary.healthy_keys} Active Keys Serving
            </span>
          </div>
        </div>

        {/* Multi-segment Traffic Share Progress Bar */}
        <div className="h-5 w-full rounded-2xl bg-background border border-border-subtle flex overflow-hidden p-1 gap-1 shadow-inner">
          {summary.total_requests > 0 ? (
            keys
              .filter((k) => k.total_requests > 0)
              .map((k, idx) => (
                <div
                  key={k.id}
                  style={{
                    width: `${Math.max(3, k.traffic_share_percent)}%`,
                    backgroundColor: KEY_COLORS[idx % KEY_COLORS.length],
                  }}
                  className="h-full rounded-xl transition-all duration-300 group relative cursor-pointer opacity-90 hover:opacity-100 hover:scale-y-105"
                  title={`${k.label}: ${k.traffic_share_percent}% (${k.total_requests} requests)`}
                />
              ))
          ) : (
            // Equal representation placeholder if no traffic has been recorded yet
            keys
              .filter((k) => k.is_active && k.has_key)
              .map((k, idx) => (
                <div
                  key={k.id}
                  style={{
                    width: `${100 / Math.max(1, summary.active_keys)}%`,
                    backgroundColor: KEY_COLORS[idx % KEY_COLORS.length],
                  }}
                  className="h-full rounded-xl opacity-75"
                  title={`${k.label}: Ready in pool`}
                />
              ))
          )}
        </div>

        {/* Key Legend Pills */}
        <div className="flex items-center gap-2.5 flex-wrap pt-1">
          {keys.map((k, idx) => {
            const color = KEY_COLORS[idx % KEY_COLORS.length];
            return (
              <div
                key={k.id}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border shadow-xs transition-all",
                  k.is_available
                    ? "bg-surface border-border-subtle text-text-primary"
                    : "bg-surface/50 border-border-subtle/50 text-text-muted opacity-70"
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                <span className="font-bold">#{k.order_index} {cleanKeyLabel(k.label)}</span>
                <span className="font-mono text-2xs px-1.5 py-0.2 rounded-md bg-elevated text-text-secondary">
                  {summary.total_requests > 0 ? `${k.traffic_share_percent}%` : "Ready"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── CONFIGURED KEY SLOTS LIST ─────────────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-surface border border-border-subtle shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black text-text-primary">
                Configured Key Slots ({keys.length} Slots in Pool)
              </h3>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Add as many keys as needed (6, 10, 20+). All keys are stored securely in the database rotation pool without modifying <code className="text-2xs bg-elevated px-1 py-0.5 rounded">.env</code>.
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="self-start sm:self-auto px-4 py-2 rounded-2xl bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-extrabold transition-all shadow-sm shadow-accent-primary/25 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Key Slot</span>
          </button>
        </div>

        {/* Key Slot Cards */}
        <div className="space-y-3 pt-2">
          {keys.map((k) => {
            const isLoading = actionLoadingKeyId === k.id;
            const isTesting = testingKeyId === k.id;
            const testInfo = testResult?.id === k.id ? testResult : null;

            // Compute dynamic cooldown seconds
            let cooldownRemaining = k.cooldown_seconds_remaining;
            if (k.is_exhausted && k.exhausted_until) {
              const diff = Math.max(0, Math.round((new Date(k.exhausted_until).getTime() - Date.now()) / 1000));
              cooldownRemaining = diff;
            }

            return (
              <div
                key={k.id}
                className={cn(
                  "relative overflow-hidden p-5 rounded-2xl border transition-all duration-200 hover:shadow-md space-y-3",
                  k.is_available
                    ? "bg-surface border-border-subtle hover:border-emerald-500/40 border-l-4 border-l-emerald-500"
                    : k.status_badge === "rpm_cooldown"
                    ? "bg-amber-500/[0.04] border-amber-500/30 border-l-4 border-l-amber-500"
                    : k.status_badge === "daily_exhausted"
                    ? "bg-rose-500/[0.04] border-rose-500/30 border-l-4 border-l-rose-500"
                    : "bg-surface/60 border-border-subtle border-l-4 border-l-border-subtle opacity-75"
                )}
              >
                {/* Slot Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-wrap">
                    {/* Slot Order Badge */}
                    <span className="w-7 h-7 rounded-xl flex items-center justify-center font-mono text-xs font-black bg-elevated border border-border-subtle text-text-primary shadow-xs">
                      #{k.order_index}
                    </span>

                    {/* Slot Label */}
                    <span className="text-sm font-black text-text-primary tracking-tight">
                      {cleanKeyLabel(k.label)}
                    </span>

                    {/* Status Badge */}
                    {k.is_available ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Healthy & Ready
                      </span>
                    ) : k.status_badge === "rpm_cooldown" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        <Clock className="w-3 h-3 text-amber-500 animate-spin" />
                        60s RPM Cooldown ({cooldownRemaining}s left)
                      </span>
                    ) : k.status_badge === "daily_exhausted" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                        Daily Quota Exhausted
                      </span>
                    ) : !k.has_key ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        No Key Configured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-elevated text-text-muted border border-border-subtle">
                        Inactive Slot
                      </span>
                    )}

                    {/* Test feedback chip */}
                    {testInfo && (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-mono font-bold border",
                          testInfo.valid
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                        )}
                      >
                        {testInfo.valid ? `Ping OK: ${testInfo.latency_ms}ms` : `Ping Failed`}
                      </span>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {/* Reset Cooldown (if exhausted) */}
                    {k.is_exhausted && (
                      <button
                        onClick={() => handleResetCooldown(k)}
                        disabled={isLoading}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-2xs font-bold transition-all flex items-center gap-1"
                        title="Clear cooldown and re-enter round-robin pool immediately"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Ready Now</span>
                      </button>
                    )}

                    {/* Test Key */}
                    <button
                      onClick={() => handleTestKey(k)}
                      disabled={isTesting || !k.has_key}
                      className="px-3 py-1.5 rounded-xl bg-surface hover:bg-elevated border border-border-subtle text-text-primary text-2xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                      title="Ping Gemini API with this key"
                    >
                      <Zap className={cn("w-3 h-3 text-amber-500", isTesting && "animate-spin")} />
                      <span>{isTesting ? "Testing..." : "Test Latency"}</span>
                    </button>

                    {/* Edit Key */}
                    <button
                      onClick={() => handleOpenEditModal(k)}
                      className="p-1.5 rounded-xl bg-surface hover:bg-elevated border border-border-subtle text-text-muted hover:text-text-primary transition-all shadow-xs"
                      title="Edit key slot"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Key */}
                    <button
                      onClick={() => setDeletingKey(k)}
                      className="p-1.5 rounded-xl bg-surface hover:bg-rose-500/10 border border-border-subtle text-text-muted hover:text-rose-500 transition-all shadow-xs"
                      title="Remove key from pool"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Toggle Active */}
                    <div className="flex items-center gap-1.5 pl-1">
                      <Toggle
                        checked={k.is_active}
                        onChange={() => handleToggleActive(k)}
                        disabled={isLoading}
                        label={`Toggle active status for ${k.label}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Slot Details Row: Masked Key, Metrics, and Diagnostics */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-border-subtle/50 text-2xs font-mono">
                  {/* Masked Key & Copy */}
                  <div className="flex items-center gap-2">
                    <span className="text-text-muted">Key:</span>
                    {k.has_key ? (
                      <span className="px-2 py-0.5 rounded-lg bg-elevated border border-border-subtle text-text-primary font-bold">
                        {k.api_key_masked}
                      </span>
                    ) : (
                      <span className="text-text-muted italic font-sans">Not set (inactive)</span>
                    )}

                    {k.has_key && (
                      <button
                        onClick={() => handleCopyKey(k)}
                        className="p-1 rounded-lg hover:bg-elevated text-text-muted hover:text-text-primary transition-colors"
                        title="Copy key mask"
                      >
                        {copiedKeyId === k.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Traffic Stats */}
                  <div className="flex items-center gap-4 text-text-muted flex-wrap">
                    <span>
                      Requests: <strong className="text-text-primary">{k.total_requests.toLocaleString()}</strong> ({k.traffic_share_percent}%)
                    </span>
                    <span>
                      Success: <strong className="text-emerald-700 dark:text-emerald-300">{k.successful_requests}</strong>
                    </span>
                    {k.failed_requests > 0 && (
                      <span>
                        Errors: <strong className="text-rose-700 dark:text-rose-300">{k.failed_requests}</strong>
                      </span>
                    )}
                    {k.last_used_at && (
                      <span className="text-text-secondary hidden md:inline">
                        Last used: {new Date(k.last_used_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Error message banner if key encountered error */}
                {k.last_error_message && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-3xs font-mono text-amber-800 dark:text-amber-200 truncate">
                    ⚠️ {k.last_error_message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── ADD KEY SLOT MODAL ────────────────────────────────────────────────── */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-surface border border-border-subtle p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-text-primary">Add Gemini Key Slot</h3>
                  <p className="text-xs text-text-secondary">Expands pool capacity by +15 RPM / +1,500 RPD.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdding(false)}
                className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-elevated transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-2xs font-extrabold uppercase tracking-wider text-text-muted mb-1.5">
                  Slot Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Gemini Key 7"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-2xs font-extrabold uppercase tracking-wider text-text-muted">
                    API Key Token
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewKey(!showNewKey)}
                    className="text-2xs font-bold text-accent-primary hover:underline flex items-center gap-1"
                  >
                    {showNewKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showNewKey ? "Mask Key" : "Show Key"}</span>
                  </button>
                </div>
                <input
                  type={showNewKey ? "text" : "password"}
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="Paste AI Studio API key (AIza...)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border-subtle text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              {/* Test key live inside modal */}
              {newApiKey.trim() !== "" && (
                <div className="p-3 rounded-2xl bg-elevated/50 border border-border-subtle flex items-center justify-between gap-3">
                  <div className="text-2xs text-text-secondary min-w-0 truncate">
                    {modalTestResult ? (
                      <span className={modalTestResult.valid ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                        {modalTestResult.valid ? `✓ Valid (${modalTestResult.latency_ms}ms)` : `✕ ${modalTestResult.message}`}
                      </span>
                    ) : (
                      "Test connection before saving"
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTestRawKey(newApiKey)}
                    disabled={modalTesting}
                    className="px-3 py-1.5 rounded-xl bg-surface hover:bg-elevated border border-border-subtle text-2xs font-bold text-accent-primary shrink-0 transition-all flex items-center gap-1"
                  >
                    <Zap className={cn("w-3 h-3", modalTesting && "animate-spin")} />
                    <span>{modalTesting ? "Testing..." : "Test Key"}</span>
                  </button>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-accent-primary/5 border border-accent-primary/20 text-2xs text-text-secondary leading-relaxed">
                💡 <strong>Database Pool Storage:</strong> This key is saved directly in the database rotation pool and joins round-robin load balancing immediately without touching <code className="font-mono text-3xs bg-elevated px-1 py-0.5 rounded">.env</code>.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewKey}
                disabled={actionLoadingKeyId === -1}
                className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-extrabold transition-all shadow-sm shadow-accent-primary/25 flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoadingKeyId === -1 && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Add to Pool</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT KEY SLOT MODAL ────────────────────────────────────────────────── */}
      {editingKeyId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-surface border border-border-subtle p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-2xl bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-text-primary">Edit Gemini Key Slot</h3>
                  <p className="text-xs text-text-secondary">Updates slot parameters in the database rotation pool.</p>
                </div>
              </div>
              <button
                onClick={() => setEditingKeyId(null)}
                className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-elevated transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-2xs font-extrabold uppercase tracking-wider text-text-muted mb-1.5">
                  Slot Label
                </label>
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border-subtle text-xs text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-2xs font-extrabold uppercase tracking-wider text-text-muted">
                    New API Key (Leave blank to keep existing)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowEditKey(!showEditKey)}
                    className="text-2xs font-bold text-accent-primary hover:underline flex items-center gap-1"
                  >
                    {showEditKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showEditKey ? "Mask" : "Show"}</span>
                  </button>
                </div>
                <input
                  type={showEditKey ? "text" : "password"}
                  value={editApiKey}
                  onChange={(e) => setEditApiKey(e.target.value)}
                  placeholder="Paste new key string to replace..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border-subtle text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </div>

              {editApiKey.trim() !== "" && (
                <div className="p-3 rounded-2xl bg-elevated/50 border border-border-subtle flex items-center justify-between gap-3">
                  <div className="text-2xs text-text-secondary min-w-0 truncate">
                    {modalTestResult ? (
                      <span className={modalTestResult.valid ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-rose-500 font-bold"}>
                        {modalTestResult.valid ? `✓ Valid (${modalTestResult.latency_ms}ms)` : `✕ ${modalTestResult.message}`}
                      </span>
                    ) : (
                      "Test new key before saving"
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTestRawKey(editApiKey)}
                    disabled={modalTesting}
                    className="px-3 py-1.5 rounded-xl bg-surface hover:bg-elevated border border-border-subtle text-2xs font-bold text-accent-primary shrink-0 transition-all flex items-center gap-1"
                  >
                    <Zap className={cn("w-3 h-3", modalTesting && "animate-spin")} />
                    <span>{modalTesting ? "Testing..." : "Test Key"}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingKeyId(null)}
                className="px-4 py-2 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditKey}
                disabled={actionLoadingKeyId === editingKeyId}
                className="px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-extrabold transition-all shadow-sm shadow-accent-primary/25 flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoadingKeyId === editingKeyId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE KEY CONFIRMATION MODAL ────────────────────────────────────── */}
      {deletingKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-surface border border-rose-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-text-primary">Remove Key Slot?</h3>
                <p className="text-xs text-text-secondary">Are you sure you want to delete this slot?</p>
              </div>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              This will permanently remove <strong>{deletingKey.label}</strong> from the database round-robin pool.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingKey(null)}
                className="px-4 py-2 rounded-xl border border-border-subtle text-xs font-bold text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteKey}
                disabled={actionLoadingKeyId === deletingKey.id}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold transition-all shadow-sm shadow-rose-600/25 flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoadingKeyId === deletingKey.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Key</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
