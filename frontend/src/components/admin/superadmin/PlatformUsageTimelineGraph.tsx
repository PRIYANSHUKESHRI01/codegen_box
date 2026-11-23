"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Calendar,
  Clock,
  Flame,
  HelpCircle,
  Loader2,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type {
  UsageTimelineDataPoint,
  UsageTimelineResponse,
} from "@/types/activity";

interface Props {
  className?: string;
  defaultPeriod?: "today" | "yesterday" | "this_week" | "this_month" | "day";
  initialDate?: string;
}

type MetricMode = "users" | "minutes" | "visits" | "actions";

export function PlatformUsageTimelineGraph({
  className,
  defaultPeriod = "today",
  initialDate,
}: Props) {
  const [period, setPeriod] = useState<"today" | "yesterday" | "this_week" | "this_month" | "day">(defaultPeriod);
  const [customDate, setCustomDate] = useState<string>(initialDate || "");
  const [metricMode, setMetricMode] = useState<MetricMode>("users");
  const [data, setData] = useState<UsageTimelineResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<UsageTimelineDataPoint | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const query = new URLSearchParams({ period });
        if (period === "day" && customDate) {
          query.set("date", customDate);
        }

        const res = await api.get<UsageTimelineResponse>(
          `/superadmin/activity/usage-timeline?${query.toString()}`
        );
        setData(res);
        if (period === "day" && !customDate && res.selected_date) {
          setCustomDate(res.selected_date);
        }
      } catch (err) {
        console.error("Failed to load usage timeline:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period, customDate]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePeriodChange = (newPeriod: "today" | "yesterday" | "this_week" | "this_month" | "day") => {
    setPeriod(newPeriod);
    setHoveredPoint(null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDate(val);
    setPeriod("day");
    setHoveredPoint(null);
  };

  const graphPoints = data?.graph ?? [];
  const kpis = data?.kpis;

  // Determine max value for the selected metric
  const getMetricValue = (pt: UsageTimelineDataPoint): number => {
    switch (metricMode) {
      case "minutes":
        return pt.minutes;
      case "visits":
        return pt.visits;
      case "actions":
        return pt.actions;
      case "users":
      default:
        return pt.users;
    }
  };

  const metricLabel = {
    users: "Active Users",
    minutes: "Time Spent (Minutes)",
    visits: "Sessions / Visits",
    actions: "Activities Completed",
  }[metricMode];

  const metricUnit = {
    users: "users",
    minutes: "mins",
    visits: "visits",
    actions: "actions",
  }[metricMode];

  const maxMetric = Math.max(1, ...graphPoints.map(getMetricValue));

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border-subtle bg-surface p-6 shadow-sm",
        className
      )}
    >
      {/* Background ambient gradient accent */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/5 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />

      {/* Header bar: Title & Timeframe Selector */}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Activity className="h-4 w-4" />
            </span>
            <h2 className="text-base font-black tracking-tight text-primary">
              Platform Usage &amp; Traffic Graph
            </h2>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-3xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Excluding Superadmin
            </span>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Authentic, real-time engagement data of all students and users on AptRun · {data?.date_formatted ?? "Loading..."}
          </p>
        </div>

        {/* Action Controls & Date Picker */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center rounded-2xl border border-border-subtle bg-elevated/70 p-1 shadow-xs">
            <button
              type="button"
              onClick={() => handlePeriodChange("today")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-2xs font-bold transition-all",
                period === "today"
                  ? "bg-accent-primary text-white shadow-xs"
                  : "text-text-secondary hover:text-primary"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("yesterday")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-2xs font-bold transition-all",
                period === "yesterday"
                  ? "bg-accent-primary text-white shadow-xs"
                  : "text-text-secondary hover:text-primary"
              )}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("this_week")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-2xs font-bold transition-all",
                period === "this_week"
                  ? "bg-accent-primary text-white shadow-xs"
                  : "text-text-secondary hover:text-primary"
              )}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("this_month")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-2xs font-bold transition-all",
                period === "this_month"
                  ? "bg-accent-primary text-white shadow-xs"
                  : "text-text-secondary hover:text-primary"
              )}
            >
              This Month
            </button>
          </div>

          {/* Any Day Date Picker */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-border-subtle bg-elevated/70 px-3 py-1 shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-text-muted shrink-0" />
            <label htmlFor="custom-date-picker" className="text-2xs font-bold text-text-secondary shrink-0">
              Pick Day:
            </label>
            <input
              id="custom-date-picker"
              type="date"
              value={period === "day" ? customDate || data?.selected_date || "" : ""}
              min={data?.available_range?.min_date}
              max={data?.available_range?.max_date}
              onChange={handleDateChange}
              className="bg-transparent text-2xs font-bold text-primary focus:outline-none cursor-pointer"
              title="Select any calendar day to inspect"
            />
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="flex h-8 w-8 items-center justify-center rounded-2xl border border-border-subtle bg-elevated/70 text-text-secondary hover:text-primary shadow-xs transition-colors disabled:opacity-50"
            title="Refresh authentic data"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin text-accent-primary")} />
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: Unique Active Users */}
        <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-4 transition-all hover:bg-elevated/70">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-2xs font-bold uppercase tracking-wider">Active Users</span>
            <Users className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-primary">
              {kpis?.unique_users ?? 0}
            </span>
            <span className="text-3xs font-semibold text-text-muted">students</span>
          </div>
          <p className="mt-1 text-3xs text-text-secondary">Excluding superadmin</p>
        </div>

        {/* Metric 2: Total Time Spent */}
        <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-4 transition-all hover:bg-elevated/70">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-2xs font-bold uppercase tracking-wider">Total Time Spent</span>
            <Clock className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-primary">
              {kpis ? (kpis.total_hours >= 1 ? `${kpis.total_hours} hrs` : `${kpis.total_minutes} mins`) : "0 mins"}
            </span>
          </div>
          <p className="mt-1 text-3xs text-text-secondary">
            {kpis?.avg_minutes_per_user ?? 0} min avg / active user
          </p>
        </div>

        {/* Metric 3: Total Sessions / Visits */}
        <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-4 transition-all hover:bg-elevated/70">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-2xs font-bold uppercase tracking-wider">Sessions &amp; Visits</span>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-primary">
              {kpis?.total_visits ?? 0}
            </span>
            <span className="text-3xs font-semibold text-text-muted">visits</span>
          </div>
          <p className="mt-1 text-3xs text-text-secondary">
            {kpis?.sign_ins_total ?? 0} sign-in logins
          </p>
        </div>

        {/* Metric 4: Platform Activities */}
        <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-4 transition-all hover:bg-elevated/70">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-2xs font-bold uppercase tracking-wider">Activities Done</span>
            <Zap className="h-4 w-4 text-fuchsia-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-primary">
              {(kpis?.interviews_total ?? 0) + (kpis?.submissions_total ?? 0)}
            </span>
            <span className="text-3xs font-semibold text-text-muted">actions</span>
          </div>
          <p className="mt-1 text-3xs text-text-secondary">
            {kpis?.interviews_total ?? 0} interviews · {kpis?.submissions_total ?? 0} code tests
          </p>
        </div>
      </div>

      {/* Peak Activity Banner */}
      <div className="mt-3.5 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2 text-xs text-amber-700 dark:text-amber-300">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="font-bold">{kpis?.peak_metric_label ?? "No activity recorded"}</span>
        </div>
        <span className="text-3xs font-semibold text-amber-600/80 dark:text-amber-400/80">
          Timezone: {data?.timezone ?? "Asia/Kolkata (IST)"}
        </span>
      </div>

      {/* Metric Mode Filter Tabs */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-extrabold uppercase tracking-wider text-text-muted mr-1">
            Graph Metric:
          </span>
          {(
            [
              { id: "users", label: "Active Users" },
              { id: "minutes", label: "Time Spent (Mins)" },
              { id: "visits", label: "Sessions / Visits" },
              { id: "actions", label: "Interviews & Tests" },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetricMode(m.id)}
              className={cn(
                "rounded-xl px-2.5 py-1 text-2xs font-bold transition-all",
                metricMode === m.id
                  ? "bg-primary text-background shadow-xs font-black"
                  : "bg-elevated/60 text-text-secondary hover:text-primary"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Hovered bar inspector badge */}
        {hoveredPoint ? (
          <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-2xs font-bold text-indigo-700 dark:text-indigo-300 shadow-xs">
            <span>{hoveredPoint.full_label}:</span>
            <span className="font-mono font-black text-primary">
              {getMetricValue(hoveredPoint)} {metricUnit}
            </span>
            <span className="text-text-muted">
              ({hoveredPoint.users} users · {hoveredPoint.minutes}m · {hoveredPoint.actions} acts)
            </span>
          </div>
        ) : (
          <span className="text-3xs text-text-muted italic">Hover over any bar to view exact details</span>
        )}
      </div>

      {/* Main Interactive Bar Chart */}
      <div className="mt-4">
        {loading ? (
          <div className="flex h-52 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border-subtle bg-elevated/20 text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-accent-primary" />
            <span>Loading authentic telemetry...</span>
          </div>
        ) : graphPoints.length === 0 ? (
          <div className="flex h-52 w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border-subtle bg-elevated/20 text-center p-6">
            <Users className="h-8 w-8 text-text-muted opacity-40 mb-1" />
            <p className="text-xs font-bold text-primary">No activity recorded for this period</p>
            <p className="text-3xs text-text-muted max-w-sm">
              No students or platform users were active during this timeframe. Try picking another date or selecting &ldquo;This Month&rdquo;.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Chart Area */}
            <div className="relative flex h-56 items-end gap-1 sm:gap-1.5 pt-8 pb-1 px-1">
              {/* Background horizontal guide lines */}
              <div className="pointer-events-none absolute inset-x-0 top-8 border-b border-border-subtle/40" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-border-subtle/40" />
              <div className="pointer-events-none absolute inset-x-0 bottom-1 border-b border-border-subtle" />

              {graphPoints.map((pt, idx) => {
                const val = getMetricValue(pt);
                const percent = Math.max(3, (val / maxMetric) * 100);
                const isHovered = hoveredPoint?.time_key === pt.time_key;
                const isPeak = val === maxMetric && val > 0;

                return (
                  <div
                    key={pt.time_key}
                    onMouseEnter={() => setHoveredPoint(pt)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    className="group relative flex h-full flex-1 cursor-pointer flex-col justify-end items-center"
                  >
                    {/* Floating top label on peak or hover */}
                    {(isHovered || (isPeak && !hoveredPoint)) && (
                      <span
                        className={cn(
                          "absolute -top-6 whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-3xs font-black shadow-sm transition-all",
                          isHovered
                            ? "bg-primary text-background z-20 scale-105"
                            : "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                        )}
                      >
                        {val}
                      </span>
                    )}

                    {/* Bar Pillar */}
                    <div
                      style={{ height: `${percent}%` }}
                      className={cn(
                        "w-full rounded-t-md transition-all duration-300",
                        val === 0
                          ? "bg-border-subtle/50 opacity-40 hover:opacity-80"
                          : isHovered
                          ? "bg-gradient-to-t from-accent-primary to-indigo-400 shadow-md shadow-indigo-500/30"
                          : isPeak
                          ? "bg-gradient-to-t from-indigo-600 to-indigo-400"
                          : "bg-indigo-500/60 hover:bg-indigo-500/90"
                      )}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-axis Labels */}
            <div className="mt-2 flex gap-1 sm:gap-1.5 text-3xs font-semibold text-text-muted px-1">
              {graphPoints.map((pt, idx) => {
                // If 24 hourly points, label every 3rd hour for cleanliness
                const shouldShowLabel =
                  graphPoints.length <= 14
                    ? true
                    : idx % 3 === 0 || idx === graphPoints.length - 1;

                return (
                  <div
                    key={`lbl-${pt.time_key}`}
                    className="flex-1 overflow-visible whitespace-nowrap text-center text-3xs font-mono"
                  >
                    {shouldShowLabel ? pt.label : ""}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Meta & Legend */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3 text-3xs text-text-muted">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-gradient-to-t from-indigo-600 to-indigo-400 inline-block" />
            <span>Platform Usage Intensity</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-border-subtle/70 inline-block" />
            <span>Idle / Zero Activity</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          <span>Real, verified database aggregates (logins, sessions, tests &amp; interviews)</span>
        </div>
      </div>
    </section>
  );
}
