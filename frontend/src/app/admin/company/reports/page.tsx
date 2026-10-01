"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useEffect, useState } from "react";
import { Download, Loader2, AlertTriangle, TrendingUp, Clock, Target, Users2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { CompanyReportsData } from "@/types/hiring";

/**
 * A company hiring tenant's Hiring Reports — mirrors the shape of the TPO's
 * Placement Reports page (funnel, distributions, action items) but with
 * every section-shaped piece (Section Performance, coordinator contacts)
 * omitted entirely, since there's no section concept for a company, plus
 * the hiring-only metrics (time to hire, offer accept rate, candidate
 * source) HiringReportService adds.
 */
export default function HiringReportsPage() {
  const { status } = useAuthGuard(["admin_company"]);
  const [data, setData] = useState<CompanyReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (status !== "ready") return;
    setLoading(true);
    api
      .get<CompanyReportsData>("/company/reports/data")
      .then(setData)
      .catch(() => triggerToast("Failed to load hiring reports."))
      .finally(() => setLoading(false));
  }, [status]);

  if (status !== "ready") {
    return <SessionLoader />;
  }

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const { generateHiringReportExcel } = await import("@/lib/generateHiringReports");
      await generateHiringReportExcel(data.hiring, data.company.name);
    } catch {
      triggerToast("Failed to generate the export.");
    } finally {
      setExporting(false);
    }
  };

  const funnelSteps: [string, number][] = data
    ? [
        ["Registered", data.hiring.funnel.registered],
        ["Shortlisted", data.hiring.funnel.shortlisted],
        ["Interviewed", data.hiring.funnel.interviewed],
        ["Offered", data.hiring.funnel.offered],
        ["Accepted", data.hiring.funnel.accepted],
      ]
    : [];

  return (
    <DashboardShell
      role="admin_company"
      title="Hiring Reports"
      subtitle="Real funnel, time-to-hire and offer metrics — derived entirely from your own candidate pipeline."
      actionButton={{ label: exporting ? "Exporting..." : "Export Excel", icon: Download, onClick: handleExport }}
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-teal-500/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading hiring reports...
        </div>
      ) : !data ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          Couldn&apos;t load your hiring data. Please refresh.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Total Candidates</span>
                <Users2 className="w-4 h-4 text-teal-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-primary mt-4">{data.hiring.funnel.total_candidates}</div>
            </div>
            <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Hired</span>
                <TrendingUp className="w-4 h-4 text-status-success" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-status-success mt-4">{data.hiring.funnel.accepted}</div>
            </div>
            <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Avg. Time to Hire</span>
                <Clock className="w-4 h-4 text-accent-secondary" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-primary mt-4">
                {data.hiring.time_to_hire_days !== null ? `${data.hiring.time_to_hire_days}d` : "—"}
              </div>
            </div>
            <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Offer Accept Rate</span>
                <Target className="w-4 h-4 text-teal-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-primary mt-4">
                {data.hiring.offer_accept_rate !== null ? `${data.hiring.offer_accept_rate}%` : "—"}
              </div>
            </div>
          </div>

          {/* Funnel */}
          <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
            <h3 className="font-bold text-sm sm:text-base text-primary mb-5">Hiring Funnel</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              {funnelSteps.map(([label, value]) => (
                <div key={label} className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="text-base font-black text-primary font-mono">{value}</div>
                  <div className="text-3xs text-text-muted uppercase tracking-wider mt-1">{label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Action items + source breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-primary flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-status-warning" />
                  <span>Needs Your Attention</span>
                </h3>
                <span className="text-3xs font-mono px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger border border-status-danger/25">
                  {data.hiring.action_items.length}
                </span>
              </div>
              <div className="space-y-2.5">
                {data.hiring.action_items.length === 0 ? (
                  <p className="text-2xs text-text-muted text-center py-4">Nothing needs your attention right now.</p>
                ) : (
                  data.hiring.action_items.map((item, i) => (
                    <div key={i} className="p-3 rounded-control border text-xs space-y-1.5 bg-elevated/60 border-border-subtle">
                      <p className="text-text-secondary leading-relaxed">{item.message}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <h3 className="font-bold text-sm text-primary mb-4">Candidate Source</h3>
              <div className="space-y-3">
                {([
                  ["Company Invited", data.hiring.source_breakdown.company_invited],
                  ["Existing Platform Student", data.hiring.source_breakdown.existing_platform_student],
                  ["Other", data.hiring.source_breakdown.other],
                ] as [string, number][]).map(([label, count]) => {
                  const total = data.hiring.funnel.total_candidates || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={label} className="flex items-center gap-3 text-xs">
                      <span className="w-40 shrink-0 text-text-secondary">{label}</span>
                      <span className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
                        <span className="block h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-10 shrink-0 text-right font-mono font-bold text-primary">{count}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* By opening */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-primary">By Job Opening</h2>
            {data.hiring.drive_summary.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                No candidates yet.
              </div>
            ) : (
              <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle divide-y divide-border-subtle overflow-hidden">
                {data.hiring.drive_summary.map((d, i) => (
                  <div key={i} className="p-3.5 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-primary truncate">{d.opening}</div>
                      <div className="text-3xs text-text-muted truncate">{d.role_title}</div>
                    </div>
                    <div className="flex items-center gap-4 text-2xs shrink-0">
                      <span className="text-text-muted">{d.candidates} candidates</span>
                      <span className="text-status-success font-semibold">{d.offers_accepted} hired</span>
                      {d.avg_ctc !== null && <span className="font-mono font-bold text-primary">{d.avg_ctc} LPA avg</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent hires */}
          <section className="space-y-4">
            <h2 className="text-base font-bold text-primary">Recent Hires</h2>
            {data.hiring.recent_hires.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                No offers accepted yet.
              </div>
            ) : (
              <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle divide-y divide-border-subtle overflow-hidden">
                {data.hiring.recent_hires.map((h, i) => (
                  <div key={i} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-primary truncate">{h.candidate_name}</div>
                      <div className="text-3xs text-text-muted truncate">
                        {h.opening} · {h.role_title}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-status-success">{h.ctc_offered} LPA</div>
                      <div className="text-3xs text-text-muted">
                        {new Date(h.hired_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardShell>
  );
}
