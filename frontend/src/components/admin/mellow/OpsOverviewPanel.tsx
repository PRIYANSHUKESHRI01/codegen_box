"use client";

import Link from "next/link";
import {
  Building2,
  Users2,
  Briefcase,
  Swords,
  FileCode2,
  Activity,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useAdminOverviewCounts } from "@/lib/useAdminOverviewCounts";

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
    <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col justify-between hover:border-accent-primary/30 transition-colors">
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

const QUICK_LINKS = [
  { label: "Partner Colleges & TPOs", href: "/admin?view=mellow&tab=colleges", icon: Building2 },
  { label: "Platform Users", href: "/admin?view=mellow&tab=users", icon: Users2 },
  { label: "Problem Bank", href: "/admin?view=mellow&tab=problems", icon: FileCode2 },
  { label: "Placement Drives", href: "/admin/placements", icon: Briefcase },
  { label: "Contests", href: "/admin/contests", icon: Swords },
];

/**
 * Mellow Ops' real front door — every figure here is a live COUNT/SUM query
 * from AdminController::overview(), the same convention as superadmin's own
 * OverviewPanel. Replaces the old top-of-page KPI strip (Problems in
 * Review/Plagiarism Flags/Contest Submission Rate/Support Tickets), all of
 * which were sourced from a hardcoded mock array with no backend behind
 * them at all.
 */
export function OpsOverviewPanel() {
  const { overview, loading } = useAdminOverviewCounts();

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading platform overview...
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-6 rounded-panel bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
        Failed to load the platform overview.
      </div>
    );
  }

  const { segments } = overview;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Partner Colleges" value={segments.colleges.toLocaleString()} icon={Building2} accent="bg-accent-secondary/10 text-accent-secondary" />
        <KpiCard label="Platform Users" value={segments.platform_users.toLocaleString()} icon={Users2} accent="bg-emerald-500/10 text-emerald-500" />
        <KpiCard label="Companies" value={segments.companies.toLocaleString()} icon={Briefcase} accent="bg-accent-primary/10 text-accent-primary" />
        <KpiCard label="Contests" value={segments.contests.toLocaleString()} icon={Swords} accent="bg-amber-500/10 text-amber-500" />
        <KpiCard label="Placement Drives" value={segments.placement_drives.toLocaleString()} icon={Briefcase} accent="bg-cyan-500/10 text-cyan-400" />
        <KpiCard label="Problems in Catalog" value={segments.problems.toLocaleString()} icon={FileCode2} accent="bg-indigo-500/10 text-indigo-400" />
        <KpiCard
          label="Submissions Today"
          value={overview.submissions_today.toLocaleString()}
          icon={Activity}
          accent="bg-status-success/10 text-status-success"
          sub="Real judge submissions, today"
        />
        <KpiCard
          label="Signups (7d)"
          value={`+${overview.signups_last_7_days.toLocaleString()}`}
          icon={UserPlus}
          accent="bg-rose-500/10 text-rose-400"
          sub="New platform user accounts"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-status-warning" />
            <h2 className="text-sm font-bold text-primary">Colleges Renewing Soon</h2>
          </div>
          {overview.colleges_renewing_soon.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-status-success py-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>No college subscriptions expire within the next 2 weeks.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {overview.colleges_renewing_soon.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded-control bg-elevated/60 border border-border-subtle text-xs">
                  <span className="font-semibold text-primary">{c.name}</span>
                  <span className={c.days_remaining <= 3 ? "text-status-danger font-bold font-mono" : "text-status-warning font-bold font-mono"}>
                    {c.days_remaining}d left
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3">
          <h2 className="text-sm font-bold text-primary">Quick Access</h2>
          <div className="space-y-1.5">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center justify-between p-2.5 rounded-control bg-elevated/60 border border-border-subtle hover:border-accent-primary/40 hover:bg-surface-hover transition-all group"
                >
                  <span className="flex items-center gap-2.5 text-xs font-semibold text-text-secondary group-hover:text-primary transition-colors">
                    <Icon className="w-4 h-4 text-accent-primary" />
                    {link.label}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
