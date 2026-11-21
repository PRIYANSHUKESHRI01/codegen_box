"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users2,
  UserSearch,
  Building2,
  GraduationCap,
  Shield,
  Megaphone,
  Crown,
  Activity,
  UserPlus,
  Wallet,
  Landmark,
  Loader2,
  ArrowRight,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  Sparkles,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LiveDot } from "./activity/ui";
import { usePoll } from "./activity/usePoll";
import type { AttentionItem, Glance } from "@/types/activity";
import { formatDateTime, formatInr, type ApiAuditLog } from "./types";
import { PlatformUsageAnalytics } from "./PlatformUsageAnalytics";

interface OverviewResponse {
  segments: {
    students: number;
    leads: number;
    colleges: number;
    admin_tpo: number;
    admin_internal: number;
    admin_marketing: number;
    superadmin: number;
  };
  submissions_today: number;
  signups_last_7_days: number;
  individual_recurring: { count: number; monthly_total: number };
  institutional_recurring: { count: number; annual_total: number; custom_priced_count: number };
  recent_activity: ApiAuditLog[];
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  accentLine,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  accentLine?: string;
  sub?: string;
}) {
  return (
    <div className="relative overflow-hidden p-5 rounded-3xl bg-surface border border-border-subtle shadow-xs hover:shadow-md hover:border-border-default transition-all duration-200 flex flex-col justify-between group">
      {accentLine && (
        <div className={cn("absolute top-0 left-0 right-0 h-1", accentLine)} />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-extrabold text-text-muted uppercase tracking-wider">{label}</span>
        <div className={cn("w-8 h-8 rounded-2xl flex items-center justify-center border border-border-subtle/60 shadow-xs transition-transform group-hover:scale-105", accent)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="mt-3.5">
        <div className="text-2xl font-black text-text-primary tracking-tight font-mono">{value}</div>
        {sub && <div className="text-2xs text-text-secondary mt-1 font-medium leading-relaxed">{sub}</div>}
      </div>
    </div>
  );
}

const SEVERITY = {
  critical: { icon: AlertTriangle, tone: "border-status-danger/30 bg-status-danger/10 text-status-danger" },
  warning: { icon: AlertTriangle, tone: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  info: { icon: Info, tone: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
} as const;

/** Who is on AptRun this minute, today and this week — the part of the Overview that moves. Links to Live Activity. */
function LiveStrip({ onOpen }: { onOpen: () => void }) {
  const [glance, setGlance] = useState<Glance | null>(null);
  const load = useCallback(() => {
    api.get<Glance>("/superadmin/activity/glance").then(setGlance).catch(() => undefined);
  }, []);
  useEffect(() => load(), [load]);
  usePoll(load, 15_000);

  if (!glance) return null;

  const cells: [string, number, string][] = [
    ["Online now", glance.online, "people on the platform this minute"],
    ["Today", glance.today, "different people so far"],
    ["Last 7 days", glance.last_7_days, "weekly active"],
    ["Sign-ins today", glance.sign_ins_today, "logins and demo logins opened"],
  ];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative overflow-hidden flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-4 rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/[0.08] via-surface to-surface p-5 text-left shadow-sm hover:shadow-md transition-all hover:border-emerald-500/60"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
      <div className="pointer-events-none absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />

      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-xs">
          <Radio className="h-5 w-5 animate-pulse" aria-hidden />
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>
        <div>
          <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Live Platform Heartbeat
          </span>
          <span className="text-2xs text-text-secondary font-medium">Real-time user engagement telemetry</span>
        </div>
      </div>

      <div className="flex items-center gap-6 sm:gap-10 flex-wrap">
        {cells.map(([label, value, hint]) => (
          <div key={label} className="min-w-0" title={hint}>
            <span className="block font-mono text-2xl sm:text-3xl font-black leading-none text-text-primary tracking-tight">
              {value.toLocaleString()}
            </span>
            <span className="mt-1 block text-3xs font-extrabold uppercase tracking-wider text-text-muted">
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-xs font-bold text-accent-primary group-hover:bg-accent-primary group-hover:text-white transition-all shadow-xs">
        <span>{glance.tracking ? "Open Live Activity" : "Tracking is switched off"}</span>
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
      </div>
    </button>
  );
}

/** What needs the superadmin today. An empty list is the good outcome, and says so. */
function AttentionList({ onOpen }: { onOpen: (tab: string, collegeId?: number) => void }) {
  const [items, setItems] = useState<AttentionItem[] | null>(null);
  const load = useCallback(() => {
    api.get<{ items: AttentionItem[] }>("/superadmin/attention").then((r) => setItems(r.items)).catch(() => setItems([]));
  }, []);
  useEffect(() => load(), [load]);
  usePoll(load, 60_000);

  if (items === null) return null;

  return (
    <section className="space-y-4 rounded-3xl border border-border-subtle bg-surface p-6 shadow-sm" aria-label="Needs attention">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-black uppercase tracking-wider text-text-primary">Needs Your Attention</h2>
        </div>
        {items.length > 0 && (
          <span className="text-2xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-status-danger/10 text-status-danger border border-status-danger/20">
            {items.length} {items.length === 1 ? "Issue" : "Issues"} Pending
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-text-secondary">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden />
          <span>
            <strong className="text-text-primary font-bold">All systems nominal:</strong> The scheduler is running smoothly, tonight&apos;s contest exists, no student signups are stalled, and all payment reconciliations are verified.
          </span>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          {items.map((item) => {
            const sev = SEVERITY[item.severity];
            const Icon = sev.icon;
            return (
              <li key={item.key} className={cn("rounded-2xl border p-4 shadow-xs transition-all hover:shadow-md", sev.tone)}>
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-xl bg-surface/80 border border-current/20 shrink-0 mt-0.5">
                    <Icon className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-black text-text-primary">{item.title}</h3>
                      <span className="rounded-full bg-background/90 px-2 py-0.5 font-mono text-3xs font-black border border-current/20">
                        {item.count}
                      </span>
                    </div>
                    <p className="mt-1 text-2xs text-text-secondary font-medium leading-relaxed">{item.detail}</p>
                    {item.examples.length > 0 && (
                      <ul className="mt-2.5 flex flex-wrap gap-1.5">
                        {item.examples.map((e) => (
                          <li key={e.label}>
                            <button
                              type="button"
                              onClick={() => onOpen("activity", e.id)}
                              className="rounded-lg border border-current/20 bg-background/80 px-2 py-0.5 text-3xs font-semibold text-text-primary hover:bg-background transition-colors"
                            >
                              {e.label}
                              {e.note ? <span className="font-normal text-text-muted"> · {e.note}</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpen(item.tab)}
                      className="mt-3 inline-flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline"
                    >
                      <span>Resolve in {item.tab}</span>
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function OverviewPanel({ onViewAuditLog, onOpenTab }: { onViewAuditLog: () => void; onOpenTab?: (tab: string, collegeId?: number) => void }) {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<OverviewResponse>("/superadmin/overview")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load platform overview."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-14 flex flex-col items-center justify-center gap-3 text-xs text-text-muted rounded-3xl bg-surface border border-border-subtle shadow-sm">
        <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
        <span className="font-medium text-text-secondary">Loading executive platform overview...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-3xl bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger shadow-sm">
        {error ?? "Failed to load overview."}
      </div>
    );
  }

  const { segments } = data;
  const open = (tab: string, collegeId?: number) => onOpenTab?.(tab, collegeId);

  return (
    <div className="space-y-6">
      {/* Live Activity Strip */}
      <LiveStrip onOpen={() => open("activity")} />

      {/* Immediate Attention Items */}
      <AttentionList onOpen={open} />

      {/* Core Platform Demographics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Students"
          value={segments.students.toLocaleString()}
          icon={GraduationCap}
          accent="bg-accent-primary/10 text-accent-primary"
          accentLine="bg-gradient-to-r from-accent-primary to-indigo-500"
          sub="Enrolled via a college"
        />
        <KpiCard
          label="Mellow Direct Leads"
          value={segments.leads.toLocaleString()}
          icon={UserSearch}
          accent="bg-rose-500/10 text-rose-500"
          accentLine="bg-gradient-to-r from-rose-500 to-pink-500"
          sub="Self-registered, no college"
        />
        <KpiCard
          label="Partner Colleges"
          value={segments.colleges.toLocaleString()}
          icon={Building2}
          accent="bg-accent-secondary/10 text-accent-secondary"
          accentLine="bg-gradient-to-r from-sky-500 to-blue-500"
        />
        <KpiCard
          label="College TPOs"
          value={segments.admin_tpo.toLocaleString()}
          icon={Users2}
          accent="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
          accentLine="bg-gradient-to-r from-cyan-500 to-teal-500"
        />
        <KpiCard
          label="Mellow Ops Staff"
          value={segments.admin_internal.toLocaleString()}
          icon={Shield}
          accent="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          accentLine="bg-gradient-to-r from-indigo-500 to-purple-500"
        />
        <KpiCard
          label="Mellow Marketing Staff"
          value={segments.admin_marketing.toLocaleString()}
          icon={Megaphone}
          accent="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          accentLine="bg-gradient-to-r from-fuchsia-500 to-rose-500"
        />
        <KpiCard
          label="Superadmins"
          value={segments.superadmin.toLocaleString()}
          icon={Crown}
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          accentLine="bg-gradient-to-r from-amber-400 to-amber-600"
        />
        <KpiCard
          label="Submissions Today"
          value={data.submissions_today.toLocaleString()}
          icon={Activity}
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          accentLine="bg-gradient-to-r from-emerald-500 to-teal-500"
          sub="Real judge submissions, today"
        />
      </div>

      {/* Growth & Financial Recurring Value */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Signups (7d)"
          value={`+${data.signups_last_7_days.toLocaleString()}`}
          icon={UserPlus}
          accent="bg-accent-primary/10 text-accent-primary"
          accentLine="bg-gradient-to-r from-accent-primary via-indigo-500 to-purple-500"
          sub="New accounts, any role, last 7 days"
        />
        <KpiCard
          label="Individual Recurring Value"
          value={`₹${formatInr(data.individual_recurring.monthly_total)}/mo`}
          icon={Wallet}
          accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          accentLine="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600"
          sub={`${data.individual_recurring.count} active subscription(s) · list price`}
        />
        <KpiCard
          label="Institutional Recurring Value"
          value={`₹${formatInr(data.institutional_recurring.annual_total)}/yr`}
          icon={Landmark}
          accent="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          accentLine="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-600"
          sub={`${data.institutional_recurring.count} priced college(s) · ${data.institutional_recurring.custom_priced_count} custom`}
        />
      </div>

      {/* Platform Practice & Feature Usage Analytics (Most Used vs Least Used Graphs) */}
      <PlatformUsageAnalytics defaultDays={30} initialRole="user" />

      {/* Recent Admin Operations Strip */}
      <section className="p-6 rounded-3xl bg-surface border border-border-subtle shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
              <Shield className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-black uppercase tracking-wider text-text-primary">Recent Admin Operations</h2>
          </div>
          <button
            onClick={onViewAuditLog}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-2xs font-bold bg-elevated hover:bg-elevated/80 text-accent-primary border border-border-subtle hover:border-accent-primary/30 transition-all shadow-xs"
          >
            <span>View Full Audit Log</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {data.recent_activity.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">No administrative actions logged yet.</p>
        ) : (
          <div className="space-y-2">
            {data.recent_activity.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-elevated/40 hover:bg-elevated/80 border border-border-subtle text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-accent-primary/10 text-accent-primary font-bold text-3xs flex items-center justify-center shrink-0 border border-accent-primary/20">
                    {log.actor_name ? log.actor_name[0]?.toUpperCase() : "A"}
                  </span>
                  <div className="truncate">
                    <span className="font-bold text-text-primary">{log.actor_name}</span>
                    <span className="text-text-secondary">
                      {" "}
                      {log.action}
                      {log.target_label && (
                        <>
                          {" "}
                          — <strong className="text-text-primary font-bold">{log.target_label}</strong>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <span className="text-3xs font-mono text-text-muted shrink-0 px-2 py-0.5 rounded-md bg-surface border border-border-subtle">
                  {formatDateTime(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
