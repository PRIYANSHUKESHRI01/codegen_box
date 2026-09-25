"use client";

import { useEffect, useState } from "react";
import { Megaphone, Users2, UserPlus, CheckCircle2, TrendingUp, Loader2, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";

interface MarketingEmployee {
  id: number;
  name: string;
  email: string;
  is_blocked: boolean;
  assigned_count: number;
  new_count: number;
  converted_count: number;
  assigned_this_week: number;
  conversion_rate: number;
}

interface MarketingPerformanceResponse {
  employees: MarketingEmployee[];
  totals: {
    employee_count: number;
    total_assigned: number;
    total_converted: number;
    overall_conversion_rate: number;
    unassigned_leads: number;
  };
}

/**
 * Superadmin's answer to "how is each marketing employee actually doing" —
 * every other lead surface (the marketing dashboard, the superadmin Leads
 * tab, OverviewPanel's segment counts) is either scoped to one employee's
 * own book or aggregated across the whole platform. This is the one place
 * that breaks assigned/converted/conversion-rate down per employee, backed
 * by SuperAdminController::marketingPerformance().
 */
export function MarketingPerformancePanel() {
  const [data, setData] = useState<MarketingPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<MarketingPerformanceResponse>("/superadmin/marketing-performance")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load marketing performance."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading marketing performance...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-panel bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">
        {error ?? "Failed to load marketing performance."}
      </div>
    );
  }

  const { employees, totals } = data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-rose-400" />
          <span>Marketing Team Performance</span>
        </h2>
        <p className="text-xs text-text-muted">
          How many leads each employee was assigned via least-loaded auto-assignment, and how many they converted.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Users2 className="w-3.5 h-3.5" /> Marketing Employees
          </span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{totals.employee_count}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Total Assigned
          </span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{totals.total_assigned}</div>
          {totals.unassigned_leads > 0 && (
            <div className="text-[10px] text-status-warning font-medium mt-1">{totals.unassigned_leads} unassigned</div>
          )}
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Total Converted
          </span>
          <div className="text-2xl font-black text-status-success font-mono mt-2">{totals.total_converted}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Overall Conversion Rate
          </span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{totals.overall_conversion_rate}%</div>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No marketing employees yet. Create one from the Mellow Staff tab to start assigning leads.
        </div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3 text-right">Assigned</th>
                  <th className="px-4 py-3 text-right">New (Untouched)</th>
                  <th className="px-4 py-3 text-right">This Week</th>
                  <th className="px-4 py-3 text-right">Converted</th>
                  <th className="px-4 py-3 text-right">Conversion Rate</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {employees.map((e) => (
                  <tr key={e.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-400 font-bold text-xs flex items-center justify-center">
                          {e.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-primary">{e.name}</div>
                          <div className="text-[10px] font-mono text-text-muted">{e.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">{e.assigned_count}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">{e.new_count}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">{e.assigned_this_week}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-status-success">{e.converted_count}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono",
                          e.conversion_rate >= 20
                            ? "bg-status-success/15 text-status-success border-status-success/30"
                            : e.conversion_rate >= 5
                            ? "bg-status-warning/15 text-status-warning border-status-warning/30"
                            : "bg-elevated text-text-muted border-border-subtle"
                        )}
                      >
                        {e.conversion_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                          e.is_blocked ? "bg-status-danger/15 text-status-danger" : "bg-status-success/15 text-status-success"
                        )}
                      >
                        {e.is_blocked ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        <span>{e.is_blocked ? "Blocked" : "Active"}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
