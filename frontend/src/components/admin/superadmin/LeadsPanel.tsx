"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Users2, UserPlus, CheckCircle2, TrendingUp, StickyNote, Ban, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { LeadDetailDrawer } from "@/components/leads/LeadDetailDrawer";
import { LEAD_STATUS_LABELS, LEAD_STATUS_BADGE_CLASS, type LeadSummary, type LeadPage } from "@/types/lead";
import { formatDate } from "./types";

interface LeadsResponse {
  leads: LeadPage;
  kpis: { total_leads: number; new_this_week: number; converted_count: number; conversion_rate: number };
}

/**
 * The same "Mellow Direct" leads the Marketing team's own /marketing
 * dashboard manages, viewed and fully editable right here — superadmin
 * already has unrestricted backend access to every lead (unlike a marketing
 * employee, who's scoped to their own), so status changes and notes work
 * in-place via the shared LeadDetailDrawer (not `readOnly` here, unlike its
 * use on /marketing for a scoped employee). Block/unblock is the one
 * governance action unique to this table. "Marketing Hub" opens the full
 * team dashboard (bulk-email, unfiltered list) in a new tab rather than
 * navigating away from this page.
 */
export function LeadsPanel({ triggerToast }: { triggerToast: (msg: string) => void }) {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [kpis, setKpis] = useState<LeadsResponse["kpis"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<LeadsResponse>("/marketing/leads")
      .then((res) => {
        setLeads(res.leads.data);
        setKpis(res.kpis);
        setBlockedIds(new Set(res.leads.data.filter((l) => l.is_blocked).map((l) => l.id)));
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load leads."))
      .finally(() => setLoading(false));
  }, [triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleBlock = async (lead: LeadSummary) => {
    try {
      const res = await api.post<{ user: { is_blocked: boolean } }>(`/superadmin/users/${lead.id}/toggle-block`);
      setBlockedIds((prev) => {
        const next = new Set(prev);
        res.user.is_blocked ? next.add(lead.id) : next.delete(lead.id);
        return next;
      });
      triggerToast(res.user.is_blocked ? `${lead.name}'s account blocked.` : `${lead.name}'s account unblocked.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update account.");
    }
  };

  const filtered = leads.filter(
    (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Mellow Direct Leads</h2>
          <p className="text-xs text-text-muted">Self-registered users with no college — read-only here; full outreach lives in the Marketing dashboard.</p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Users2 className="w-3.5 h-3.5" /> Total Leads
          </span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{kpis?.total_leads ?? "—"}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> New This Week
          </span>
          <div className="text-2xl font-black text-accent-secondary font-mono mt-2">{kpis?.new_this_week ?? "—"}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Converted
          </span>
          <div className="text-2xl font-black text-status-success font-mono mt-2">{kpis?.converted_count ?? "—"}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Conversion Rate
          </span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{kpis?.conversion_rate ?? "—"}%</div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Loading leads...</div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          {leads.length === 0 ? "No Mellow Direct leads yet." : "No leads match your search."}
        </div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Signed Up</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((lead) => {
                  const isBlocked = blockedIds.has(lead.id);
                  return (
                    <tr key={lead.id} className="hover:bg-surface-hover/60 transition-colors">
                      <td className="px-4 py-3 cursor-pointer" onClick={() => setActiveLeadId(lead.id)}>
                        <div className="font-bold text-primary">{lead.name}</div>
                        <div className="text-[10px] text-text-muted">{lead.email}</div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatDate(lead.created_at)}</td>
                      <td className="px-4 py-3">
                        {lead.assigned_to_name ? (
                          <span className="text-text-secondary font-medium">{lead.assigned_to_name}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-status-warning bg-status-warning/10 px-2 py-0.5 rounded-full border border-status-warning/25">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{lead.plan_name ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {lead.note_count > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <StickyNote className="w-3 h-3" /> {lead.note_count}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap", LEAD_STATUS_BADGE_CLASS[lead.lead_status])}>
                          {LEAD_STATUS_LABELS[lead.lead_status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/marketing?leadId=${lead.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors text-[11px] font-medium flex items-center gap-1"
                            title="Opens the Marketing team's own dashboard in a new tab — bulk-email tools, full unfiltered lead list, etc. Status/notes can be edited right here without leaving this page."
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Marketing Hub</span>
                          </Link>
                          <button
                            onClick={() => handleToggleBlock(lead)}
                            className={cn(
                              "px-2 py-1 rounded-control border text-[11px] font-semibold transition-colors flex items-center gap-1",
                              isBlocked
                                ? "bg-status-success/10 hover:bg-status-success/20 text-status-success border-status-success/30"
                                : "bg-status-danger/10 hover:bg-status-danger/20 text-status-danger border-status-danger/30"
                            )}
                          >
                            <Ban className="w-3 h-3" />
                            <span>{isBlocked ? "Unblock" : "Block"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeLeadId && (
        <LeadDetailDrawer leadId={activeLeadId} onClose={() => setActiveLeadId(null)} onChanged={load} />
      )}
    </div>
  );
}
