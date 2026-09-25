"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Mail,
  Loader2,
  AlertCircle,
  Users2,
  UserPlus,
  CheckCircle2,
  TrendingUp,
  StickyNote,
  Send,
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Inbox,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { LeadDetailDrawer } from "@/components/leads/LeadDetailDrawer";
import { LeadPipelineBar } from "@/components/leads/LeadPipelineBar";
import { LeadKanbanBoard } from "@/components/leads/LeadKanbanBoard";
import { cn } from "@/lib/utils";
import { avatarColorClass, initials } from "@/lib/avatarColor";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_BADGE_CLASS,
  type LeadStatus,
  type LeadSummary,
  type LeadPage,
} from "@/types/lead";

interface LeadsResponse {
  leads: LeadPage;
  kpis: {
    total_leads: number;
    new_this_week: number;
    converted_count: number;
    conversion_rate: number;
    by_status: Record<LeadStatus, number>;
  };
}

type ViewMode = "board" | "table";
type SortKey = "created_at" | "solved_score";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle hover:border-accent-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">{label}</span>
        <div className={cn("w-7 h-7 rounded-control flex items-center justify-center", accent)}>
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="text-2xl font-black text-primary font-mono mt-2">{value}</div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle animate-pulse">
      <div className="h-3 w-20 bg-elevated rounded" />
      <div className="h-7 w-14 bg-elevated rounded mt-3" />
    </div>
  );
}

function MarketingLeadsPageContent() {
  const { status, user: me } = useAuthGuard(["admin_marketing", "superadmin"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = (searchParams?.get("status") as LeadStatus | null) ?? null;
  const deepLinkedLeadId = searchParams?.get("leadId");

  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [kpis, setKpis] = useState<LeadsResponse["kpis"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<number | null>(null);
  const [notifyConfirmOpen, setNotifyConfirmOpen] = useState(false);
  const [sendingNotify, setSendingNotify] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [movingIds, setMovingIds] = useState<Set<number>>(new Set());

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadLeads = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setLoadError(null);
      try {
        const qs = statusFilter ? `?status=${statusFilter}` : "";
        const res = await api.get<LeadsResponse>(`/marketing/leads${qs}`);
        setLeads(res.leads.data);
        setKpis(res.kpis);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load leads.");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [statusFilter]
  );

  const hasLeadsAccess = userHasPermission(me, "leads");
  const hasOutreachAccess = userHasPermission(me, "lead_outreach");

  useEffect(() => {
    if (status === "ready" && hasLeadsAccess) loadLeads();
  }, [status, hasLeadsAccess, loadLeads]);

  // Superadmin's Leads tab links here with ?leadId= to jump straight into a
  // specific lead's full drawer (notes/status) instead of duplicating that
  // workflow on the superadmin dashboard itself.
  useEffect(() => {
    if (deepLinkedLeadId) setActiveLeadId(Number(deepLinkedLeadId));
  }, [deepLinkedLeadId]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  if (!hasLeadsAccess) {
    return (
      <DashboardShell role={me?.role === "superadmin" ? "superadmin" : "admin_marketing"} title="Lead Management">
        <AccessDeniedNotice section="Lead Management" />
      </DashboardShell>
    );
  }

  const searched = leads.filter(
    (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...searched].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "solved_score") return (a.solved_score - b.solved_score) * dir;
    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const setStatusFilter = (s: LeadStatus | null) => {
    router.push(s ? `/marketing?status=${s}` : "/marketing");
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((l) => l.id)));
  };

  const handleNotifySelected = async () => {
    setSendingNotify(true);
    try {
      const res = await api.post<{ message: string; queued_count: number }>("/marketing/leads/notify", {
        lead_ids: Array.from(selectedIds),
      });
      triggerToast(res.message);
      setSelectedIds(new Set());
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to send the notification.");
    } finally {
      setSendingNotify(false);
      setNotifyConfirmOpen(false);
    }
  };

  /**
   * Optimistic move: the card visually lands in its new column immediately,
   * then the real POST /marketing/leads/{id}/status runs in the background.
   * A silent reload afterward reconciles KPIs/pipeline counts with the real
   * server totals without flashing the loading skeleton; a failure reverts
   * the card and surfaces why.
   */
  const handleMoveLead = async (leadId: number, newStatus: LeadStatus) => {
    const previous = leads;
    setLeads((ls) => ls.map((l) => (l.id === leadId ? { ...l, lead_status: newStatus } : l)));
    setMovingIds((prev) => new Set(prev).add(leadId));

    try {
      await api.post(`/marketing/leads/${leadId}/status`, { status: newStatus });
      triggerToast(`Moved to ${LEAD_STATUS_LABELS[newStatus]}.`);
      await loadLeads({ silent: true });
    } catch (err) {
      setLeads(previous);
      triggerToast(err instanceof ApiError ? err.message : "Failed to update status.");
    } finally {
      setMovingIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  return (
    <DashboardShell
      role={me?.role === "superadmin" ? "superadmin" : "admin_marketing"}
      title="Lead Management"
      subtitle={
        me?.role === "superadmin"
          ? "Every Mellow Direct lead, platform-wide — track progress, log outreach, and convert."
          : "Mellow Direct leads assigned to you — track progress, log outreach, and convert."
      }
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* KPI strip — real aggregates from the backend, not derived from the current page */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && !kpis ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard label="Total Leads" value={kpis?.total_leads ?? "—"} icon={Users2} accent="bg-accent-secondary/10 text-accent-secondary" />
              <StatCard label="New This Week" value={kpis?.new_this_week ?? "—"} icon={UserPlus} accent="bg-accent-primary/10 text-accent-primary" />
              <StatCard label="Converted" value={kpis?.converted_count ?? "—"} icon={CheckCircle2} accent="bg-status-success/10 text-status-success" />
              <StatCard label="Conversion Rate" value={`${kpis?.conversion_rate ?? "—"}%`} icon={TrendingUp} accent="bg-status-warning/10 text-status-warning" />
            </>
          )}
        </div>

        {/* Real pipeline distribution — same per-status counts as the KPI strip above */}
        {kpis && <LeadPipelineBar byStatus={kpis.by_status} total={kpis.total_leads} />}

        {/* Toolbar: view toggle, status tabs (table view only), search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-control bg-elevated border border-border-subtle shrink-0">
              <button
                onClick={() => setViewMode("board")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-control text-[11px] font-bold transition-all",
                  viewMode === "board" ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Board</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-control text-[11px] font-bold transition-all",
                  viewMode === "table" ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                )}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>

            {viewMode === "table" && (
              <div className="flex items-center gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle overflow-x-auto">
                <button
                  onClick={() => setStatusFilter(null)}
                  className={cn(
                    "px-3 py-1.5 rounded-control text-[11px] font-bold transition-all whitespace-nowrap",
                    !statusFilter ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                  )}
                >
                  All
                </button>
                {LEAD_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-control text-[11px] font-bold transition-all whitespace-nowrap",
                      statusFilter === s ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                    )}
                  >
                    <span>{LEAD_STATUS_LABELS[s]}</span>
                    {kpis && <span className="opacity-70 font-mono">{kpis.by_status[s] ?? 0}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="pl-8 pr-3 py-1.5 w-full rounded-control bg-surface border border-border-subtle text-xs text-primary placeholder:text-text-muted outline-none focus:border-accent-primary transition-colors"
            />
          </div>
        </div>

        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-3 rounded-panel bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-between gap-3 overflow-hidden"
            >
              <span className="text-xs font-semibold text-primary">{selectedIds.size} lead(s) selected</span>
              {hasOutreachAccess ? (
                <button
                  onClick={() => setNotifyConfirmOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-bold transition-colors shadow-subtle"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Selected ({selectedIds.size})</span>
                </button>
              ) : (
                <span className="text-[11px] text-text-muted">Bulk email isn&apos;t granted to your account.</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {loadError && (
          <div className="p-4 rounded-panel bg-status-danger/10 border border-status-danger/25 flex items-center justify-between gap-3 text-xs text-status-danger">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {loadError}
            </span>
            <button onClick={() => loadLeads()} className="font-bold underline shrink-0">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          viewMode === "board" ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex-shrink-0 w-[280px] rounded-panel border border-border-subtle bg-elevated/40 p-3 space-y-2 animate-pulse">
                  <div className="h-4 w-20 bg-elevated rounded mb-2" />
                  <div className="h-16 bg-surface rounded-control border border-border-subtle" />
                  <div className="h-16 bg-surface rounded-control border border-border-subtle" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden animate-pulse">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="p-4 border-b border-border-subtle last:border-0 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-elevated shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-elevated rounded" />
                    <div className="h-2.5 w-48 bg-elevated rounded" />
                  </div>
                  <div className="h-5 w-16 bg-elevated rounded-full shrink-0" />
                </div>
              ))}
            </div>
          )
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center rounded-panel bg-surface border border-border-subtle flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-elevated flex items-center justify-center">
              <Inbox className="w-5 h-5 text-text-muted" />
            </div>
            <p className="text-xs text-text-muted max-w-xs">
              {leads.length === 0
                ? "No Mellow Direct leads yet — they'll show up here as soon as someone signs up without a college."
                : "No leads match your search."}
            </p>
          </div>
        ) : viewMode === "board" ? (
          <LeadKanbanBoard leads={sorted} onOpenLead={setActiveLeadId} onMoveLead={handleMoveLead} movingIds={movingIds} />
        ) : (
          <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === sorted.length && sorted.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">
                      <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1 hover:text-primary transition-colors">
                        Signed Up {sortIcon("created_at")}
                      </button>
                    </th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">
                      <button onClick={() => toggleSort("solved_score")} className="flex items-center gap-1 hover:text-primary transition-colors">
                        Solved Score {sortIcon("solved_score")}
                      </button>
                    </th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {sorted.map((lead) => (
                    <tr key={lead.id} className="hover:bg-surface-hover/60 transition-colors group">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => setActiveLeadId(lead.id)}>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                              avatarColorClass(lead.name)
                            )}
                          >
                            {initials(lead.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-primary group-hover:text-accent-primary transition-colors truncate">{lead.name}</div>
                            <div className="text-[10px] text-text-muted truncate">{lead.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{formatDate(lead.created_at)}</td>
                      <td className="px-4 py-3 text-text-secondary">{lead.plan_name ?? "—"}</td>
                      <td className="px-4 py-3 font-mono font-bold text-primary">{lead.solved_score}</td>
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
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                            LEAD_STATUS_BADGE_CLASS[lead.lead_status]
                          )}
                        >
                          {LEAD_STATUS_LABELS[lead.lead_status]}
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

      {activeLeadId && (
        <LeadDetailDrawer leadId={activeLeadId} onClose={() => setActiveLeadId(null)} onChanged={loadLeads} />
      )}

      {notifyConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4"
          >
            <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center">
              <Send className="w-4.5 h-4.5 text-accent-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold text-primary">Send Check-in Email</h3>
              <p className="text-xs text-text-secondary mt-1">
                Send a check-in email to <strong className="text-primary">{selectedIds.size}</strong> lead(s)?
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNotifyConfirmOpen(false)}
                disabled={sendingNotify}
                className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleNotifySelected}
                disabled={sendingNotify}
                className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {sendingNotify && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{sendingNotify ? "Sending..." : "Send"}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </DashboardShell>
  );
}

/**
 * useSearchParams() forces this whole tree to opt out of static
 * prerendering unless wrapped in Suspense — without this, `next build`
 * fails outright on this route (not just a dev warning). Same fix as
 * admin/page.tsx's AdminPage/AdminPageContent split.
 */
export default function MarketingLeadsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-xs text-text-muted">
          Loading Marketing Portal...
        </div>
      }
    >
      <MarketingLeadsPageContent />
    </Suspense>
  );
}
