"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle,
  AlertTriangle,
  Activity,
  Users,
  Clock,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Code2,
  Cpu,
  Bot,
  Mic,
  Brain,
  Briefcase,
  Trophy,
  Eye,
  Target,
  Flame,
  Zap,
  Filter,
  X,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { FeatureUsageResponse, RankedFeature, FeatureCategoryGroup } from "@/types/activity";

interface Props {
  className?: string;
  defaultDays?: number;
  initialRole?: string;
  compact?: boolean;
}

const CATEGORY_ICONS: Record<string, typeof Code2> = {
  "Coding & Problem Solving": Code2,
  "Coding & Contests": Trophy,
  "Core Technical Prep": Cpu,
  "AI Mock Interviews": Bot,
  "Communication & Voice": Mic,
  "Aptitude & Soft Skills": Brain,
  "Project Engineering": Layers,
  "Hackathons & Projects": Sparkles,
  "Company Prep & Placement": Briefcase,
  "Dashboard & Navigation": Activity,
  "Gamification & Rewards": Award,
};

export function PlatformUsageAnalytics({
  className,
  defaultDays = 30,
  initialRole = "user",
  compact = false,
}: Props) {
  const [days, setDays] = useState<number>(defaultDays);
  const [role, setRole] = useState<string>(initialRole);
  const [data, setData] = useState<FeatureUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<"all" | "top" | "untouched">("all");
  const [showZeroCategories, setShowZeroCategories] = useState(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);

      try {
        const query = new URLSearchParams({ days: String(days) });
        if (role && role !== "all") query.set("role", role);

        const res = await api.get<FeatureUsageResponse>(`/superadmin/activity/feature-usage?${query.toString()}`);
        setData(res);
      } catch (err) {
        console.error("Failed to load platform usage data:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [days, role]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Active vs Zero Categories separation for clutter-free display
  const { activeCategories, zeroCategories } = useMemo(() => {
    if (!data) return { activeCategories: [], zeroCategories: [] };
    const active: FeatureCategoryGroup[] = [];
    const zero: FeatureCategoryGroup[] = [];

    // Sort by share descending
    const sorted = [...data.categories].sort((a, b) => b.share_percentage - a.share_percentage);
    for (const c of sorted) {
      if (c.share_percentage > 0 || c.engagements > 0) {
        active.push(c);
      } else {
        zero.push(c);
      }
    }
    return { activeCategories: active, zeroCategories: zero };
  }, [data]);

  // Filter features by search query, category, and tier
  const filteredFeatures = useMemo(() => {
    if (!data) return [];
    return data.ranked_features.filter((f) => {
      const matchesSearch =
        search === "" ||
        f.section.toLowerCase().includes(search.toLowerCase()) ||
        f.category.toLowerCase().includes(search.toLowerCase());
      const matchesCat = selectedCategory === "all" || f.category === selectedCategory;

      let matchesTier = true;
      if (filterTier === "top") matchesTier = f.rank <= 3 || f.total_engagements > 0;
      else if (filterTier === "untouched") matchesTier = f.total_engagements === 0;

      return matchesSearch && matchesCat && matchesTier;
    });
  }, [data, search, selectedCategory, filterTier]);

  const maxEngagements = useMemo(() => {
    if (!data || data.ranked_features.length === 0) return 1;
    return Math.max(1, ...data.ranked_features.map((f) => f.total_engagements));
  }, [data]);

  const maxDailyViews = useMemo(() => {
    if (!data || data.daily_trend.length === 0) return 1;
    return Math.max(1, ...data.daily_trend.map((d) => d.views));
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-14 text-text-muted gap-3 rounded-3xl bg-surface border border-border-subtle shadow-sm">
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-accent-primary/20 border-t-accent-primary animate-spin" />
          <BarChart3 className="w-5 h-5 text-accent-primary absolute" />
        </div>
        <span className="text-xs font-semibold text-text-secondary">
          Analyzing student practice telemetry across all platform modules...
        </span>
      </div>
    );
  }

  if (!data) return null;

  const { summary, most_used, least_used, categories, daily_trend, practice_totals } = data;
  const topModule = most_used[0];
  const leastModule = least_used[0];

  return (
    <div className={cn("space-y-6", className)}>
      {/* ── HERO HEADER & CONTROL STRIP ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-border-subtle bg-gradient-to-r from-surface via-elevated/70 to-surface p-6 shadow-sm backdrop-blur-md">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-24 -left-16 h-48 w-48 rounded-full bg-accent-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -top-20 right-10 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Title and live status badge */}
          <div>
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-accent-primary/20 to-accent-primary/10 border border-accent-primary/30 text-accent-primary shadow-sm">
                <BarChart3 className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-text-primary">
                    Platform Usage & Practice Analytics
                  </h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-500" />
                    Live Telemetry
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  Real-time telemetry of which platform modules students practice the most vs least.
                </p>
              </div>
            </div>
          </div>

          {/* Controls: Segmented Filters + Refresh */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Role Filter */}
            <div className="flex items-center rounded-2xl bg-background/80 p-1 border border-border-subtle shadow-inner">
              {[
                { id: "user", label: "Students" },
                { id: "all", label: "Everyone" },
                { id: "admin_tpo", label: "TPOs" },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200",
                    role === r.id
                      ? "bg-accent-primary text-white shadow-sm shadow-accent-primary/30"
                      : "text-text-muted hover:text-text-primary hover:bg-surface/50"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Timeframe Filter */}
            <div className="flex items-center rounded-2xl bg-background/80 p-1 border border-border-subtle shadow-inner">
              {[
                { id: 7, label: "7d" },
                { id: 14, label: "14d" },
                { id: 30, label: "30d" },
                { id: 90, label: "90d" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDays(p.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200",
                    days === p.id
                      ? "bg-accent-primary text-white shadow-sm shadow-accent-primary/30"
                      : "text-text-muted hover:text-text-primary hover:bg-surface/50"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-surface hover:bg-elevated border border-border-subtle text-text-muted hover:text-text-primary transition-all shadow-sm disabled:opacity-50 group"
              title="Refresh telemetry"
            >
              <RefreshCw className={cn("w-4 h-4 transition-transform group-hover:rotate-180 duration-500", refreshing && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* ── HIGHLIGHT SPOTLIGHT CARDS: MOST USED VS LEAST USED ──────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Top Most Used Feature */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-surface border border-emerald-500/30 flex flex-col justify-between shadow-sm hover:shadow-md transition-all group">
          {/* Top Emerald Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-extrabold text-2xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-emerald-500" />
                #1 Most Practiced
              </span>
              <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs">
                {topModule?.share_percentage ?? 0}% Share
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-xl font-black text-text-primary tracking-tight truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {topModule?.section ?? "None"}
              </div>
              <div className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/20 max-w-full truncate">
                <Code2 className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">{topModule?.category ?? "General"}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-2xs font-mono text-text-muted">
            <span className="font-bold text-text-primary">
              {topModule?.total_engagements.toLocaleString()} total actions
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-text-muted" />
              {topModule?.users} students
            </span>
          </div>
        </div>

        {/* Card 2: Least Used / Needs Attention */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-surface border border-rose-500/30 flex flex-col justify-between shadow-sm hover:shadow-md transition-all group">
          {/* Top Rose Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-600" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-rose-500/10 rounded-full blur-2xl" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-extrabold text-2xs uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                Least Used / Untouched
              </span>
              <span className="font-mono text-2xs font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30 shadow-xs">
                Low Adoption
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-xl font-black text-text-primary tracking-tight truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                {leastModule?.section ?? "None"}
              </div>
              <div className="text-2xs text-rose-700 dark:text-rose-300/90 font-medium">
                Minimal student practice recorded in this time window.
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-2xs font-mono">
            <span className="text-text-muted font-bold">
              {leastModule?.total_engagements ?? 0} actions
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-sans font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
              Promote in cohort
            </span>
          </div>
        </div>

        {/* Card 3: Total Practice Volume */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-surface border border-border-subtle flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
          {/* Top Indigo Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-blue-600" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-extrabold text-2xs uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                Total Practice Volume
              </span>
              <span className="font-mono text-3xs font-bold px-2 py-0.5 rounded-full bg-elevated text-text-secondary border border-border-subtle">
                All Tracks
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-3xl font-black font-mono text-text-primary tracking-tight">
                {(summary.total_views + summary.total_practice_actions).toLocaleString()}
              </div>
              <div className="text-2xs text-text-secondary">
                combined sessions & problem submissions
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-2xs font-mono text-text-muted">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Code: <strong className="text-text-primary font-mono">{practice_totals.coding_submissions}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              Core: <strong className="text-text-primary font-mono">{practice_totals.core_answers}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              Voice: <strong className="text-text-primary font-mono">{practice_totals.speaking_attempts}</strong>
            </span>
          </div>
        </div>

        {/* Card 4: Active Practice Time */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-surface border border-border-subtle flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
          {/* Top Purple Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-fuchsia-400 to-violet-600" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-extrabold text-2xs uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                Active Practice Time
              </span>
              <span className="font-mono text-3xs font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                ● Live Tracked
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-3xl font-black font-mono text-text-primary tracking-tight">
                {Math.round(summary.total_minutes / 60)}h {Math.round(summary.total_minutes % 60)}m
              </div>
              <div className="text-2xs text-text-secondary">
                across {summary.total_features_tracked} active platform sections
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-subtle/60 flex items-center justify-between text-2xs text-text-muted">
            <span>Period: Last {days} Days</span>
            <span className="text-accent-primary font-bold">Continuous Log</span>
          </div>
        </div>
      </div>

      {/* ── CATEGORY DISTRIBUTION PROGRESS BAR ─────────────────────────────────── */}
      <div className="p-6 rounded-3xl bg-surface border border-border-subtle shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                <Layers className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-black uppercase tracking-wider text-text-primary">
                Platform Category Share
              </h4>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Distribution of student engagement across major platform skill tracks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xs font-mono font-bold px-2.5 py-1 rounded-xl bg-elevated text-text-secondary border border-border-subtle">
              {activeCategories.length} Active / {categories.length} Total Tracks
            </span>
          </div>
        </div>

        {/* Multi-segment Progress Bar with smooth rounded corners and glow */}
        <div className="h-5 w-full rounded-2xl bg-background border border-border-subtle flex overflow-hidden p-1 gap-1 shadow-inner">
          {activeCategories.map((cat) => (
            <div
              key={cat.category}
              style={{
                width: `${Math.max(2.5, cat.share_percentage)}%`,
                backgroundColor: cat.color,
              }}
              className="h-full rounded-xl transition-all duration-300 group relative cursor-pointer opacity-90 hover:opacity-100 hover:scale-y-105"
              onClick={() => setSelectedCategory(selectedCategory === cat.category ? "all" : cat.category)}
              title={`${cat.category}: ${cat.share_percentage}% (${cat.engagements} actions)`}
            />
          ))}
        </div>

        {/* Category Legend Pills - Active Tracks First */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* All Categories Pill */}
            <button
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-xs",
                selectedCategory === "all"
                  ? "bg-accent-primary text-white border-accent-primary shadow-accent-primary/25"
                  : "bg-elevated/70 text-text-secondary border-border-subtle hover:text-text-primary hover:bg-elevated"
              )}
            >
              <span>All Tracks</span>
              <span className="font-mono text-3xs opacity-80">({categories.length})</span>
            </button>

            {/* Active Categories with colorful dots */}
            {activeCategories.map((c) => {
              const Icon = CATEGORY_ICONS[c.category] ?? Layers;
              const isSelected = selectedCategory === c.category;

              return (
                <button
                  key={c.category}
                  onClick={() => setSelectedCategory(isSelected ? "all" : c.category)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border shadow-xs",
                    isSelected
                      ? "bg-accent-primary text-white border-accent-primary shadow-accent-primary/25 font-bold"
                      : "bg-surface text-text-primary border-border-subtle hover:border-border-default hover:bg-elevated/50"
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: c.color }}
                  />
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span>{c.category}</span>
                  <span
                    className={cn(
                      "font-mono text-2xs font-bold px-1.5 py-0.2 rounded-md",
                      isSelected ? "bg-white/20 text-white" : "bg-elevated text-text-secondary"
                    )}
                  >
                    {c.share_percentage}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Collapsible Zero Usage Categories */}
          {zeroCategories.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowZeroCategories(!showZeroCategories)}
                className="inline-flex items-center gap-1.5 text-2xs font-bold text-text-muted hover:text-text-primary transition-colors"
              >
                <span>{zeroCategories.length} categories with 0% practice</span>
                {showZeroCategories ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>

              {showZeroCategories && (
                <div className="flex items-center gap-2 flex-wrap mt-2 p-3 rounded-2xl bg-elevated/40 border border-border-subtle/60">
                  {zeroCategories.map((c) => {
                    const Icon = CATEGORY_ICONS[c.category] ?? Layers;
                    const isSelected = selectedCategory === c.category;

                    return (
                      <button
                        key={c.category}
                        onClick={() => setSelectedCategory(isSelected ? "all" : c.category)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-2xs font-medium transition-all flex items-center gap-1.5 border",
                          isSelected
                            ? "bg-accent-primary text-white border-accent-primary"
                            : "bg-surface/60 text-text-muted border-border-subtle hover:text-text-primary"
                        )}
                      >
                        <span className="w-2 h-2 rounded-full opacity-50" style={{ backgroundColor: c.color }} />
                        <Icon className="w-3 h-3 opacity-60" />
                        <span>{c.category}</span>
                        <span className="font-mono text-3xs opacity-60">(0%)</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── PRIMARY CHART: RANKED FEATURE COMPARISON (MOST TO LEAST) ────────────── */}
      <div className="p-6 rounded-3xl bg-surface border border-border-subtle shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h4 className="text-base font-black text-text-primary">
                Most Used to Least Used Platform Modules
              </h4>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              Ranked by combined student engagement (interactive sessions, problem attempts, time spent).
            </p>
          </div>

          {/* Quick Filters + Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Quick Filter Segment */}
            <div className="flex items-center rounded-2xl bg-background/80 p-1 border border-border-subtle shadow-inner">
              {[
                { id: "all", label: "All Modules" },
                { id: "top", label: "Active" },
                { id: "untouched", label: "Zero Practice" },
              ].map((tier) => (
                <button
                  key={tier.id}
                  onClick={() => setFilterTier(tier.id as any)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-2xs font-bold transition-all",
                    filterTier === tier.id
                      ? "bg-accent-primary text-white shadow-xs"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {tier.label}
                </button>
              ))}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search feature or track..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-background/80 border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Ranked Feature Cards */}
        <div className="space-y-3 pt-2">
          {filteredFeatures.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-elevated/40 border border-border-subtle text-xs text-text-muted">
              No platform features match the current filters or search term.
            </div>
          ) : (
            filteredFeatures.map((f) => {
              const barWidthPercent = (f.total_engagements / maxEngagements) * 100;
              const Icon = CATEGORY_ICONS[f.category] ?? Activity;
              const isTop3 = f.rank <= 3;
              const isChampion = f.rank === 1;
              const isZero = f.total_engagements === 0;

              return (
                <div
                  key={f.section}
                  className={cn(
                    "relative overflow-hidden p-4 rounded-2xl border transition-all duration-200 hover:shadow-md space-y-3",
                    isChampion
                      ? "bg-gradient-to-r from-amber-500/[0.06] via-surface to-surface border-amber-500/40 shadow-xs"
                      : isTop3
                      ? "bg-gradient-to-r from-emerald-500/[0.05] via-surface to-surface border-emerald-500/30"
                      : isZero
                      ? "bg-surface/50 border-border-subtle/60 opacity-80"
                      : "bg-surface border-border-subtle hover:border-border-default"
                  )}
                >
                  {/* Row Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      {/* Rank Podium Badge */}
                      <span
                        className={cn(
                          "w-7 h-7 rounded-xl flex items-center justify-center font-mono text-xs font-black shrink-0 shadow-xs",
                          isChampion
                            ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/30 ring-2 ring-amber-400/30"
                            : f.rank === 2
                            ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 ring-1 ring-slate-300"
                            : f.rank === 3
                            ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white ring-1 ring-amber-600/30"
                            : "bg-elevated border border-border-subtle text-text-muted"
                        )}
                      >
                        #{f.rank}
                      </span>

                      {/* Feature Name */}
                      <span className="text-sm font-black text-text-primary tracking-tight truncate">
                        {f.section}
                      </span>

                      {/* Category Chip */}
                      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-0.5 rounded-lg bg-elevated border border-border-subtle text-text-secondary">
                        <Icon className="w-3 h-3 shrink-0" style={{ color: f.color }} />
                        <span className="truncate">{f.category}</span>
                      </span>

                      {/* Highlight Tags */}
                      {isChampion && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-xs">
                          <Crown className="w-2.5 h-2.5 text-amber-500" />
                          #1 Most Practiced
                        </span>
                      )}

                      {!isChampion && isTop3 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs">
                          <Flame className="w-2.5 h-2.5 text-emerald-500" />
                          Top Practiced
                        </span>
                      )}

                      {f.direct_attempts > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                          <Zap className="w-2.5 h-2.5 text-indigo-500" />
                          Interactive Submissions
                        </span>
                      )}

                      {isZero && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-extrabold uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                          <AlertTriangle className="w-2.5 h-2.5 text-rose-500" />
                          No Student Activity
                        </span>
                      )}
                    </div>

                    {/* Share % and Actions Count */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-mono font-bold text-text-primary">
                        {f.total_engagements.toLocaleString()} actions
                      </span>
                      <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-accent-primary/10 text-accent-primary border border-accent-primary/20 min-w-[3.5rem] text-center">
                        {f.share_percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar Track with Gradient Fill */}
                  <div className="h-2.5 w-full rounded-full bg-background/80 border border-border-subtle overflow-hidden relative shadow-inner">
                    <div
                      style={{
                        width: `${Math.max(1.5, barWidthPercent)}%`,
                        backgroundColor: f.color,
                      }}
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        isTop3 && "shadow-xs"
                      )}
                    />
                  </div>

                  {/* Detailed Micro Stats Pill Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-y-1 text-2xs text-text-muted font-mono pt-0.5">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3 h-3 text-text-muted" />
                        Views: <strong className="text-text-primary font-bold">{f.views}</strong>
                      </span>
                      {f.direct_attempts > 0 && (
                        <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                          <Target className="w-3 h-3 text-emerald-500" />
                          Direct Attempts: <strong>{f.direct_attempts}</strong>
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-text-muted" />
                        Students: <strong className="text-text-primary font-bold">{f.users}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-text-muted" />
                        Practice Time: <strong className="text-text-primary font-bold">{f.total_minutes}m</strong>
                      </span>
                      {f.avg_minutes > 0 && (
                        <span className="text-text-secondary hidden sm:inline">
                          (avg {f.avg_minutes}m / session)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── DAILY PRACTICE TREND CHART (LAST 30 DAYS SCALING) ──────────────────── */}
      {daily_trend.length > 0 && (
        <div className="p-6 rounded-3xl bg-surface border border-border-subtle shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black uppercase tracking-wider text-text-primary">
                  Daily Student Practice Velocity (Last {daily_trend.length} Days)
                </h4>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Daily volume of student practice sessions and problem submissions scaling over time.
              </p>
            </div>
            <span className="text-2xs font-mono font-bold px-2.5 py-1 rounded-xl bg-elevated text-accent-primary border border-border-subtle">
              Peak: {maxDailyViews} views/day
            </span>
          </div>

          {/* SVG Area / Column Visualization with hover glass tooltips */}
          <div className="h-36 w-full flex items-end gap-1.5 pt-6 pb-2 px-1">
            {daily_trend.map((point) => {
              const heightPercent = (point.views / maxDailyViews) * 100;
              return (
                <div
                  key={point.day}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                    <div className="bg-popover/95 backdrop-blur-md text-text-primary text-[10px] rounded-xl py-2 px-3 shadow-xl border border-border-subtle whitespace-nowrap font-mono space-y-0.5">
                      <div className="font-black text-accent-primary">{point.label}</div>
                      <div>{point.views} sessions</div>
                      <div>{point.users} practicing students</div>
                      <div>{point.minutes} total minutes</div>
                    </div>
                  </div>

                  {/* Bar */}
                  <div
                    style={{ height: `${Math.max(6, heightPercent)}%` }}
                    className={cn(
                      "w-full rounded-t-lg transition-all duration-200 group-hover:brightness-110",
                      point.views > 0
                        ? "bg-gradient-to-t from-accent-primary/60 to-accent-primary group-hover:from-accent-primary group-hover:to-accent-primary-hover shadow-xs"
                        : "bg-border-subtle/50"
                    )}
                  />

                  {/* Date label */}
                  <span className="text-[9px] text-text-muted mt-1 font-mono truncate max-w-full">
                    {point.label.split(" ")[1]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Mini Crown helper icon for #1 champion module
function Crown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
  );
}
