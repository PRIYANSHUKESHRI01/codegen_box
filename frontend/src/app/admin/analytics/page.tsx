"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, TrendingUp, Building2, Award, Loader2, AlertTriangle, Target } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BarChart } from "@/components/dashboard/tpo/BarChart";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { TpoReportsData } from "@/lib/generateTpoReports";

export default function ReadinessAnalyticsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [data, setData] = useState<TpoReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<TpoReportsData>("/tpo/reports/data");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  // Real branch-wise readiness, computed client-side from the already-real
  // per-student readiness_score/practice_score (User::readinessScore()) —
  // replaces the previously-fictional avgDsaScore/avgSpeedScore mock.
  const branchReadiness = (() => {
    if (!data) return [];
    const groups = new Map<string, { readiness: number[]; practice: number[] }>();
    for (const s of data.students) {
      if (!s.branch) continue;
      const g = groups.get(s.branch) ?? { readiness: [], practice: [] };
      g.readiness.push(s.readiness_score);
      g.practice.push(s.practice_score);
      groups.set(s.branch, g);
    }
    return Array.from(groups.entries()).map(([branch, g]) => ({
      branch,
      avgReadiness: Math.round(g.readiness.reduce((a, b) => a + b, 0) / g.readiness.length),
      avgPractice: Math.round(g.practice.reduce((a, b) => a + b, 0) / g.practice.length),
    }));
  })();

  const placements = data?.placements;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Readiness Analytics"
      subtitle="Real branch-wise readiness, package distribution, and placement trends — derived from your actual cohort and recorded outcomes."
    >
      {error && (
        <div className="p-4 rounded-panel bg-status-danger/10 border border-status-danger/25 flex items-center justify-between gap-3 text-xs text-status-danger">
          <span>{error}</span>
          <button onClick={load} className="font-bold underline shrink-0">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading analytics...
        </div>
      ) : data && placements ? (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Avg Readiness</span>
              <div className="text-2xl font-black text-primary font-mono mt-2">
                {branchReadiness.length > 0 ? Math.round(branchReadiness.reduce((s, b) => s + b.avgReadiness, 0) / branchReadiness.length) : 0}
                <span className="text-sm text-text-muted">/100</span>
              </div>
            </div>
            <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Companies Hired</span>
              <div className="text-2xl font-black text-accent-secondary font-mono mt-2">{placements.company_summary.length}</div>
            </div>
            <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Total Offers Accepted</span>
              <div className="text-2xl font-black text-status-success font-mono mt-2">{placements.funnel.accepted}</div>
            </div>
            <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Current Placement %</span>
              <div className="text-2xl font-black text-status-success font-mono mt-2">{placements.target.current_percent}%</div>
              {placements.target.target_percent && (
                <p className="text-3xs text-text-muted mt-1">Target: {placements.target.target_percent}%</p>
              )}
            </div>
          </div>

          {/* Action items */}
          {placements.action_items.length > 0 && (
            <section className="p-4 rounded-panel bg-status-warning/5 border border-status-warning/25 space-y-2">
              <h2 className="text-xs font-bold text-primary flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-status-warning" />
                <span>Needs Your Attention</span>
              </h2>
              {placements.action_items.map((item, i) => (
                <p key={i} className="text-2xs text-text-secondary pl-5">• {item.message}</p>
              ))}
            </section>
          )}

          {/* Funnel */}
          <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
            <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-5">
              <Target className="w-4 h-4 text-accent-primary" />
              <span>Placement Funnel</span>
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
              {([
                ["Enrolled", placements.funnel.batch_enrolled],
                ["Registered", placements.funnel.registered],
                ["Shortlisted", placements.funnel.shortlisted],
                ["Interviewed", placements.funnel.interviewed],
                ["Offered", placements.funnel.offered],
                ["Accepted", placements.funnel.accepted],
              ] as [string, number][]).map(([label, value]) => (
                <div key={label} className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="text-lg font-black text-primary font-mono">{value}</div>
                  <div className="text-3xs text-text-muted uppercase tracking-wider mt-1">{label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Branch readiness bars */}
          {branchReadiness.length > 0 && (
            <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent-primary" />
                  <span>Branch-wise Readiness</span>
                </h2>
              </div>
              <BarChart
                categories={branchReadiness.map((d) => d.branch.split(" ")[0])}
                series={[
                  { label: "Avg Readiness", color: "var(--accent-primary)", values: branchReadiness.map((d) => d.avgReadiness) },
                  { label: "Avg Practice Consistency", color: "var(--accent-secondary)", values: branchReadiness.map((d) => d.avgPractice) },
                ]}
                suffix=""
                maxValue={100}
              />
            </section>
          )}

          {/* Branch placement trend + package distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-5">
                <TrendingUp className="w-4 h-4 text-status-success" />
                <span>Branch Placement Rate</span>
              </h2>
              {placements.branch_trend.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-8">
                  No placement outcomes recorded yet this season — this fills in as offers are accepted.
                </p>
              ) : (
                <div className="space-y-4">
                  {placements.branch_trend.map((row) => (
                    <div key={`${row.year}-${row.branch}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-primary">
                          {row.branch} <span className="text-text-muted font-normal">({row.year})</span>
                        </span>
                        <span className="font-mono text-status-success font-bold">{row.placement_rate}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-elevated overflow-hidden">
                        <div className="h-full rounded-full bg-status-success transition-all" style={{ width: `${row.placement_rate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Package Distribution</span>
              </h2>
              {placements.package_distribution.every((b) => b.count === 0) ? (
                <p className="text-xs text-text-muted text-center py-8">No accepted offers recorded yet.</p>
              ) : (
                <>
                  <BarChart
                    categories={placements.package_distribution.map((b) => b.bracket)}
                    series={[{ label: "Students", color: "var(--accent-primary)", values: placements.package_distribution.map((b) => b.count) }]}
                    suffix=""
                    maxValue={Math.max(4, Math.ceil(Math.max(...placements.package_distribution.map((b) => b.count)) / 2) * 2)}
                  />
                  <p className="mt-4 pt-4 border-t border-border-subtle text-2xs text-text-muted text-center">
                    {placements.package_distribution.reduce((s, b) => s + b.count, 0)} total accepted offers.
                  </p>
                </>
              )}
            </section>
          </div>

          {/* Company-wise hiring */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-primary flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent-secondary" />
              <span>Company-wise Hiring Summary</span>
            </h2>

            {placements.company_summary.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                No accepted offers recorded yet — this fills in as your placement pipeline records outcomes.
              </div>
            ) : (
              <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                      <tr>
                        <th className="px-4 py-3">Company</th>
                        <th className="px-4 py-3">Offers Accepted</th>
                        <th className="px-4 py-3">Avg CTC</th>
                        <th className="px-4 py-3 text-right">Max CTC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {placements.company_summary.map((c) => (
                        <tr key={c.company} className="hover:bg-surface-hover/60 transition-colors">
                          <td className="px-4 py-3 font-bold text-primary">{c.company}</td>
                          <td className="px-4 py-3 font-mono font-bold text-primary">{c.offers_accepted}</td>
                          <td className="px-4 py-3 font-mono text-status-success font-bold">{c.avg_ctc ?? "—"} LPA</td>
                          <td className="px-4 py-3 text-right font-mono text-amber-500 font-bold">{c.max_ctc ?? "—"} LPA</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className={cn("p-10 text-center text-xs text-text-muted")}>No data available.</div>
      )}
    </DashboardShell>
  );
}
