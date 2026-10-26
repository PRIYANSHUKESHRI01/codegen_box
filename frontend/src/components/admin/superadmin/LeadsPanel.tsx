"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Users2, UserPlus, CheckCircle2, TrendingUp, StickyNote, Ban, ExternalLink, UserCog, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { LeadDetailDrawer } from "@/components/leads/LeadDetailDrawer";
import { UserManageDrawer } from "./UserManageDrawer";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_BADGE_CLASS, type LeadFacets, type LeadStatus, type LeadSummary, type LeadPage } from "@/types/lead";
import { formatDate } from "./types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { type ToastTrigger } from "@/lib/toast";

interface LeadsResponse {
  leads: LeadPage;
  kpis: { total_leads: number; new_this_week: number; converted_count: number; conversion_rate: number };
  facets?: LeadFacets;
}

/** After this long a first load is worth explaining rather than leaving a bare placeholder on screen. */
const SLOW_AFTER_MS = 4_000;

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
 *
 * Search, the status chips and "unassigned only" are all answered by the server (the list is paged, 50 at a time — a
 * search that only looked through the page already on screen would miss every lead beyond it), and the number on each
 * chip is what picking it then lists.
 */
export function LeadsPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [kpis, setKpis] = useState<LeadsResponse["kpis"] | null>(null);
  const [facets, setFacets] = useState<LeadFacets | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  // See StudentsPanel: `loaded` flips on the first answer; afterwards a new filter keeps the old rows on screen, dimmed.
  const [loaded, setLoaded] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [answeredFiltered, setAnsweredFiltered] = useState(false);

  const [status, setStatus] = useState<LeadStatus | "">("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [managedId, setManagedId] = useState<number | null>(null);
  // A block/unblock the superadmin just did, shown at once; every fresh load starts from the server's own flags again.
  const [blockOverrides, setBlockOverrides] = useState<Map<number, boolean>>(new Map());

  const buildParams = useCallback(
    (extra: Record<string, string> = {}) => {
      const params = new URLSearchParams(extra);
      if (status) params.set("status", status);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (unassignedOnly) params.set("assigned", "unassigned");
      return params;
    },
    [status, debouncedSearch, unassignedOnly]
  );

  // Only the newest request may write to the screen (see StudentsPanel).
  const latest = useRef(0);

  const load = useCallback(() => {
    const ticket = ++latest.current;
    const askedFiltered = Boolean(status || debouncedSearch.trim() || unassignedOnly);
    setFetching(true);
    setError(null);

    api
      .get<LeadsResponse>(`/marketing/leads?${buildParams().toString()}`)
      .then((res) => {
        if (ticket !== latest.current) return;
        setLeads(res.leads.data);
        setKpis(res.kpis);
        setFacets(res.facets ?? null);
        setTotal(res.leads.total);
        setPage(res.leads.current_page);
        setHasMore(res.leads.current_page < res.leads.last_page);
        setBlockOverrides(new Map());
        setAnsweredFiltered(askedFiltered);
        setLoaded(true);
      })
      .catch((err) => {
        if (ticket !== latest.current) return;
        const message = err instanceof ApiError ? err.message : "Failed to load leads.";
        setError(message);
        triggerToast(message, "error");
      })
      .finally(() => {
        if (ticket === latest.current) setFetching(false);
      });
  }, [buildParams, status, debouncedSearch, unassignedOnly, triggerToast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!fetching) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [fetching]);

  const loadMore = () => {
    const ticket = latest.current;
    setLoadingMore(true);
    api
      .get<LeadsResponse>(`/marketing/leads?${buildParams({ page: String(page + 1) }).toString()}`)
      .then((res) => {
        if (ticket !== latest.current) return;
        setLeads((prev) => [...prev, ...res.leads.data]);
        setPage(res.leads.current_page);
        setHasMore(res.leads.current_page < res.leads.last_page);
      })
      .catch((err) => triggerToast(err instanceof ApiError ? err.message : "Failed to load more leads.", "error"))
      .finally(() => setLoadingMore(false));
  };

  const handleToggleBlock = async (lead: LeadSummary) => {
    try {
      const res = await api.post<{ user: { is_blocked: boolean } }>(`/superadmin/users/${lead.id}/toggle-block`);
      setBlockOverrides((prev) => new Map(prev).set(lead.id, res.user.is_blocked));
      triggerToast(res.user.is_blocked ? `${lead.name}'s account blocked.` : `${lead.name}'s account unblocked.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to update account.", "error");
    }
  };

  const filtered = Boolean(status || debouncedSearch.trim() || unassignedOnly);
  const clearFilters = () => {
    setStatus("");
    setUnassignedOnly(false);
    setSearch("");
  };

  const chips: { value: LeadStatus | ""; label: string; count: number | null }[] = [
    { value: "", label: "All", count: facets?.total ?? null },
    ...LEAD_STATUSES.map((s) => ({ value: s as LeadStatus | "", label: LEAD_STATUS_LABELS[s], count: facets?.by_status?.[s] ?? null })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">Mellow Direct Leads</h2>
          <p className="text-xs text-text-muted" aria-live="polite">
            {total === null
              ? error
                ? "Couldn't load the leads."
                : "Loading leads…"
              : `${total.toLocaleString()} lead(s) ${answeredFiltered ? "match this filter" : "who signed up without a college"}.`}
            {loaded && fetching && (
              <span className="ml-2 inline-flex items-center gap-1 text-accent-primary">
                <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
                Updating…
              </span>
            )}
          </p>
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            aria-label="Search leads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Users2 className="w-3.5 h-3.5" /> Total Leads
          </span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{kpis?.total_leads ?? "—"}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> New This Week
          </span>
          <div className="text-2xl font-black text-accent-secondary font-mono mt-2">{kpis?.new_this_week ?? "—"}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Converted
          </span>
          <div className="text-2xl font-black text-status-success font-mono mt-2">{kpis?.converted_count ?? "—"}</div>
        </div>
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Conversion Rate
          </span>
          <div className="text-2xl font-black text-primary font-mono mt-2">{kpis ? `${kpis.conversion_rate}%` : "—"}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by lead status" className="flex flex-wrap items-center gap-1.5 rounded-control border border-border-subtle bg-elevated p-1">
          {chips.map((c) => (
            <button
              key={c.value || "all"}
              type="button"
              onClick={() => setStatus(c.value)}
              aria-pressed={status === c.value}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-control px-3 py-1 text-2xs font-bold transition-all",
                status === c.value ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
              )}
            >
              {c.label}
              {c.count !== null && (
                <span className={cn("rounded-full px-1.5 text-3xs font-bold tabular-nums", status === c.value ? "bg-white/20" : "bg-surface text-text-muted")}>{c.count.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setUnassignedOnly((v) => !v)}
          aria-pressed={unassignedOnly}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-control border px-3 py-1.5 text-2xs font-bold transition-colors",
            unassignedOnly ? "border-status-warning/50 bg-status-warning/15 text-status-warning" : "border-border-subtle bg-elevated text-text-secondary hover:text-primary"
          )}
        >
          Unassigned only
          {facets && <span className="rounded-full bg-surface px-1.5 text-3xs font-bold tabular-nums text-text-muted">{facets.unassigned.toLocaleString()}</span>}
        </button>

        {filtered && (
          <button type="button" onClick={clearFilters} className="text-2xs font-bold text-accent-primary hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {!loaded && !error ? (
        <div role="status" aria-label="Loading leads" className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="divide-y divide-border-subtle" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-elevated" />
                  <div className="h-2.5 w-56 animate-pulse rounded bg-elevated" />
                </div>
                <div className="hidden h-3 w-24 animate-pulse rounded bg-elevated sm:block" />
                <div className="hidden h-5 w-20 animate-pulse rounded-full bg-elevated md:block" />
                <div className="h-6 w-40 animate-pulse rounded bg-elevated" />
              </div>
            ))}
          </div>
          {slow && <p className="border-t border-border-subtle px-4 py-3 text-center text-xs text-text-muted">Still working — this is taking longer than usual. The server may be busy.</p>}
        </div>
      ) : !loaded && error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-panel border border-status-danger/30 bg-status-danger/5 p-8 text-center">
          <AlertTriangle className="h-5 w-5 text-status-danger" aria-hidden />
          <p className="text-xs font-semibold text-primary">{error}</p>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-surface px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-hover">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        </div>
      ) : leads.length === 0 ? (
        <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          {answeredFiltered ? "No leads match these filters." : "No Mellow Direct leads yet."}
        </div>
      ) : (
        <div className={cn("rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle transition-opacity", fetching && "opacity-60")} aria-busy={fetching}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
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
                {leads.map((lead) => {
                  const isBlocked = blockOverrides.get(lead.id) ?? lead.is_blocked;
                  return (
                    <tr key={lead.id} className="hover:bg-surface-hover/60 transition-colors">
                      <td className="px-4 py-3 cursor-pointer" onClick={() => setActiveLeadId(lead.id)}>
                        <div className="font-bold text-primary">{lead.name}</div>
                        <div className="text-3xs text-text-muted">{lead.email}</div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatDate(lead.created_at)}</td>
                      <td className="px-4 py-3">
                        {lead.assigned_to_name ? (
                          <span className="text-text-secondary font-medium">{lead.assigned_to_name}</span>
                        ) : (
                          <span className="text-3xs font-bold text-status-warning bg-status-warning/10 px-2 py-0.5 rounded-full border border-status-warning/25">
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
                        <span className={cn("px-2 py-0.5 rounded-full text-3xs font-bold border whitespace-nowrap", LEAD_STATUS_BADGE_CLASS[lead.lead_status])}>
                          {LEAD_STATUS_LABELS[lead.lead_status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setManagedId(lead.id)}
                            aria-label={`Manage ${lead.name}`}
                            className="px-2 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors text-2xs font-medium flex items-center gap-1"
                            title="Plan, details, sign-in tools and activity for this person — including giving or ending a plan."
                          >
                            <UserCog className="w-3 h-3" />
                            <span>Manage</span>
                          </button>
                          <Link
                            href={`/marketing?leadId=${lead.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary transition-colors text-2xs font-medium flex items-center gap-1"
                            title="Opens the Marketing team's own dashboard in a new tab — bulk-email tools, full unfiltered lead list, etc. Status/notes can be edited right here without leaving this page."
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Marketing Hub</span>
                          </Link>
                          <button
                            onClick={() => handleToggleBlock(lead)}
                            className={cn(
                              "px-2 py-1 rounded-control border text-2xs font-semibold transition-colors flex items-center gap-1",
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
          {hasMore && (
            <div className="p-3 border-t border-border-subtle flex flex-col items-center gap-1">
              <button
                onClick={loadMore}
                disabled={loadingMore || fetching}
                className="px-4 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
              {total !== null && (
                <span className="text-3xs text-text-muted">
                  Showing {leads.length.toLocaleString()} of {total.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {activeLeadId && <LeadDetailDrawer leadId={activeLeadId} onClose={() => setActiveLeadId(null)} onChanged={load} />}

      {managedId !== null && <UserManageDrawer userId={managedId} onClose={() => setManagedId(null)} onChanged={load} triggerToast={triggerToast} />}
    </div>
  );
}
