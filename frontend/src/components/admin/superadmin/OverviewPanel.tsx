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
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { LiveDot } from "./activity/ui";
import { usePoll } from "./activity/usePoll";
import type { AttentionItem, Glance } from "@/types/activity";
import { formatDateTime, formatInr, type ApiAuditLog } from "./types";

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
  sub,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 rounded-control flex items-center justify-center ${accent}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-black text-primary tracking-tight font-mono">{value}</div>
        {sub && <div className="text-2xs text-text-muted mt-1 font-medium">{sub}</div>}
      </div>
    </div>
  );
}

const SEVERITY = {
  critical: { icon: AlertTriangle, tone: "border-status-danger/30 bg-status-danger/10 text-status-danger" },
  warning: { icon: AlertTriangle, tone: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300" },
  info: { icon: Info, tone: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300" },
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
    <button type="button" onClick={onOpen} className="group flex w-full flex-wrap items-center gap-x-8 gap-y-3 rounded-panel border border-emerald-500/25 bg-gradient-to-r from-emerald-500/[0.07] to-transparent p-4 text-left shadow-subtle transition-colors hover:border-emerald-500/50">
      <span className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
        <Radio className="h-4 w-4" aria-hidden /> Live
        <LiveDot />
      </span>
      {cells.map(([label, value, hint]) => (
        <span key={label} className="min-w-0" title={hint}>
          <span className="block font-mono text-2xl font-black leading-none text-primary">{value.toLocaleString()}</span>
          <span className="mt-1 block text-3xs font-semibold uppercase tracking-wider text-text-muted">{label}</span>
        </span>
      ))}
      <span className="ml-auto flex items-center gap-1 text-2xs font-bold text-accent-primary">
        {glance.tracking ? "Open Live Activity" : "Tracking is switched off"} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
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
    <section className="space-y-3 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle" aria-label="Needs attention">
      <h2 className="text-sm font-bold text-primary">Needs your attention</h2>
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden /> Nothing needs you right now: the scheduler is running, tonight&apos;s contest exists, no login is waiting and no payment is stuck.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const sev = SEVERITY[item.severity];
            const Icon = sev.icon;
            return (
              <li key={item.key} className={cn("rounded-control border p-3.5", sev.tone)}>
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-primary">{item.title}</h3>
                      <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-3xs font-bold">{item.count}</span>
                    </div>
                    <p className="mt-0.5 text-2xs text-text-secondary">{item.detail}</p>
                    {item.examples.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {item.examples.map((e) => (
                          <li key={e.label}>
                            <button type="button" onClick={() => onOpen("activity", e.id)} className="rounded-full border border-current/25 bg-background/60 px-2 py-0.5 text-3xs font-semibold text-primary hover:bg-background">
                              {e.label}
                              {e.note ? <span className="font-normal text-text-muted"> · {e.note}</span> : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button type="button" onClick={() => onOpen(item.tab)} className="mt-2 inline-flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline">
                      Open <ArrowRight className="h-3 w-3" aria-hidden />
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
      <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading platform overview...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-panel bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
        {error ?? "Failed to load overview."}
      </div>
    );
  }

  const { segments } = data;

  const open = (tab: string, collegeId?: number) => onOpenTab?.(tab, collegeId);

  return (
    <div className="space-y-6">
      <LiveStrip onOpen={() => open("activity")} />
      <AttentionList onOpen={open} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Students" value={segments.students.toLocaleString()} icon={GraduationCap} accent="bg-accent-primary/10 text-accent-primary" sub="Enrolled via a college" />
        <KpiCard label="Mellow Direct Leads" value={segments.leads.toLocaleString()} icon={UserSearch} accent="bg-rose-500/10 text-rose-400" sub="Self-registered, no college" />
        <KpiCard label="Partner Colleges" value={segments.colleges.toLocaleString()} icon={Building2} accent="bg-accent-secondary/10 text-accent-secondary" />
        <KpiCard label="College TPOs" value={segments.admin_tpo.toLocaleString()} icon={Users2} accent="bg-cyan-500/10 text-cyan-400" />
        <KpiCard label="Mellow Ops Staff" value={segments.admin_internal.toLocaleString()} icon={Shield} accent="bg-indigo-500/10 text-indigo-400" />
        <KpiCard label="Mellow Marketing Staff" value={segments.admin_marketing.toLocaleString()} icon={Megaphone} accent="bg-rose-500/10 text-rose-400" />
        <KpiCard label="Superadmins" value={segments.superadmin.toLocaleString()} icon={Crown} accent="bg-amber-500/10 text-amber-500" />
        <KpiCard label="Submissions Today" value={data.submissions_today.toLocaleString()} icon={Activity} accent="bg-status-success/10 text-status-success" sub="Real judge submissions, today" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Signups (7d)"
          value={`+${data.signups_last_7_days.toLocaleString()}`}
          icon={UserPlus}
          accent="bg-accent-primary/10 text-accent-primary"
          sub="New accounts, any role, last 7 days"
        />
        <KpiCard
          label="Individual Recurring Value"
          value={`₹${formatInr(data.individual_recurring.monthly_total)}/mo`}
          icon={Wallet}
          accent="bg-status-success/10 text-status-success"
          sub={`${data.individual_recurring.count} active subscription(s) · list price, not collected cash`}
        />
        <KpiCard
          label="Institutional Recurring Value"
          value={`₹${formatInr(data.institutional_recurring.annual_total)}/yr`}
          icon={Landmark}
          accent="bg-amber-500/10 text-amber-500"
          sub={`${data.institutional_recurring.count} priced college(s) · ${data.institutional_recurring.custom_priced_count} on custom pricing (excluded)`}
        />
      </div>

      <section className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-primary">Recent Admin Activity</h2>
          <button
            onClick={onViewAuditLog}
            className="flex items-center gap-1 text-2xs font-bold text-accent-primary hover:text-accent-primary-hover transition-colors"
          >
            <span>View full audit log</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {data.recent_activity.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">No admin activity logged yet.</p>
        ) : (
          <div className="space-y-2">
            {data.recent_activity.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 p-2.5 rounded-control bg-elevated/60 border border-border-subtle text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-primary">{log.actor_name}</span>
                  <span className="text-text-secondary">
                    {" "}
                    {log.action}
                    {log.target_label && <> — <strong className="text-primary">{log.target_label}</strong></>}
                  </span>
                </div>
                <span className="text-3xs font-mono text-text-muted shrink-0">{formatDateTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
