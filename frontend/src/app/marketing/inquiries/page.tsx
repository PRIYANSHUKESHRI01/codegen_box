"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  AlarmClock,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Crown,
  GraduationCap,
  HandHelping,
  Inbox,
  Loader2,
  Mail,
  Phone,
  Search,
  UserPlus,
  Users2,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { ContactRequestDetailDrawer } from "@/components/marketing-site/ContactRequestDetailDrawer";
import { cn } from "@/lib/utils";
import { avatarColorClass, initials } from "@/lib/avatarColor";
import { isOverdue, replyMailto, telLink, waitingFor } from "@/lib/enquiry";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, LEAD_STATUS_BADGE_CLASS, type LeadStatus } from "@/types/lead";
import { CONTACT_REQUEST_AUDIENCE_LABELS, type ContactRequestsResponse, type ContactRequestSummary, type EnquiryScope } from "@/types/contactRequest";

function KpiTile({ icon: Icon, label, value, tone, hint }: { icon: typeof Inbox; label: string; value: number | string; tone?: "danger" | "warning"; hint?: string }) {
  return (
    <div className={cn("rounded-panel border bg-surface p-4 shadow-subtle", tone === "danger" ? "border-status-danger/40" : tone === "warning" ? "border-amber-500/40" : "border-border-subtle")}>
      <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wide text-text-muted">
        <Icon className={cn("h-3.5 w-3.5", tone === "danger" && "text-status-danger", tone === "warning" && "text-amber-500")} />
        <span>{label}</span>
      </div>
      <p className="mt-2 font-mono text-2xl font-black text-primary">{value}</p>
      {hint && <p className="mt-0.5 text-3xs font-medium text-text-muted">{hint}</p>}
    </div>
  );
}

/**
 * The marketing team's enquiry desk: every "Talk to Our Team" submission, as a work list. An employee works the enquiries assigned to
 * them and can open the unassigned queue to take one nobody has; the superadmin sees everything. Newest first, with how long each has
 * been waiting and a flag on any new enquiry nobody has contacted within the day.
 */
export default function MarketingInquiriesPage() {
  const { status, user: me } = useAuthGuard(["admin_marketing", "superadmin"]);
  const isSuper = me?.role === "superadmin";
  const defaultScope: EnquiryScope = isSuper ? "all" : "mine";

  const [scope, setScope] = useState<EnquiryScope | null>(null);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ContactRequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [claiming, setClaiming] = useState<number | null>(null);
  const latest = useRef(0);

  const hasLeadsAccess = userHasPermission(me, "leads");
  const activeScope = scope ?? defaultScope;

  // The search box waits for a pause in typing before it asks the server.
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ scope: activeScope, page: String(page) });
      if (statusFilter) params.set("status", statusFilter);
      if (query) params.set("search", query);
      const res = await api.get<ContactRequestsResponse>(`/marketing/contact-requests?${params}`);
      if (ticket === latest.current) setData(res);
    } catch (err) {
      if (ticket === latest.current) setLoadError(err instanceof ApiError ? err.message : "Failed to load inquiries.");
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [activeScope, page, statusFilter, query]);

  useEffect(() => {
    if (status === "ready" && hasLeadsAccess) void load();
  }, [status, hasLeadsAccess, load]);

  const claim = async (r: ContactRequestSummary) => {
    setClaiming(r.id);
    try {
      await api.post(`/marketing/contact-requests/${r.id}/claim`);
      toast.success(`${r.name} is yours now. Reach out when you can.`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not claim that enquiry.");
      await load();
    } finally {
      setClaiming(null);
    }
  };

  if (status !== "ready") return <SessionLoader />;

  const shellRole = isSuper ? "superadmin" : "admin_marketing";

  if (!hasLeadsAccess) {
    return (
      <DashboardShell role={shellRole} title="Inquiries">
        <AccessDeniedNotice section="Inquiries" />
      </DashboardShell>
    );
  }

  const kpis = data?.kpis;
  const overdueHours = data?.overdue_hours ?? 24;
  const rows = data?.requests.data ?? [];
  const lastPage = data?.requests.last_page ?? 1;
  const tabs: { id: EnquiryScope; label: string; count?: number }[] = isSuper
    ? [{ id: "all", label: "All enquiries" }, { id: "unassigned", label: "Unassigned", count: kpis?.unassigned }]
    : [{ id: "mine", label: "My enquiries" }, { id: "unassigned", label: "Unassigned", count: kpis?.unassigned }];

  return (
    <DashboardShell
      role={shellRole}
      title="Inquiries"
      subtitle={isSuper ? "Every \"Talk to Our Team\" enquiry, platform-wide." : "Every \"Talk to Our Team\" enquiry assigned to you, and the queue nobody has taken yet."}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiTile icon={Inbox} label="Awaiting first contact" value={kpis?.awaiting_first_contact ?? "—"} />
          <KpiTile
            icon={AlarmClock}
            label="Overdue"
            value={kpis?.overdue ?? "—"}
            tone={kpis && kpis.overdue > 0 ? "danger" : undefined}
            hint={`new for more than ${overdueHours}h`}
          />
          <KpiTile icon={Users2} label="Unassigned queue" value={kpis?.unassigned ?? "—"} tone={kpis && kpis.unassigned > 0 && !isSuper ? "warning" : undefined} hint="anyone on the team can take these" />
          <KpiTile icon={UserPlus} label="New this week" value={kpis?.new_this_week ?? "—"} />
        </div>

        <div className="space-y-3">
          <div role="tablist" aria-label="Which enquiries" className="inline-flex rounded-control border border-border-subtle bg-elevated p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeScope === t.id}
                onClick={() => {
                  setScope(t.id);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[7px] px-3 py-1.5 text-xs font-bold transition-colors",
                  activeScope === t.id ? "bg-accent-primary text-white shadow-sm" : "text-text-secondary hover:text-primary"
                )}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className={cn("rounded-full px-1.5 text-3xs font-black", activeScope === t.id ? "bg-white/25" : "bg-amber-500/20 text-amber-700 dark:text-amber-300")}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative lg:max-w-sm lg:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, e-mail, phone or organisation"
                aria-label="Search enquiries"
                className="w-full rounded-control border border-border-subtle bg-elevated py-2 pl-9 pr-3 text-xs text-primary outline-none placeholder:text-text-muted focus:border-accent-primary"
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
              {(["", ...LEAD_STATUSES] as const).map((s) => (
                <button
                  key={s || "all"}
                  type="button"
                  aria-pressed={statusFilter === s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-3xs font-bold transition-colors",
                    statusFilter === s ? (s ? LEAD_STATUS_BADGE_CLASS[s] : "border-accent-primary/40 bg-accent-primary/10 text-accent-primary") : "border-border-subtle bg-elevated text-text-muted hover:text-primary"
                  )}
                >
                  {s ? `${LEAD_STATUS_LABELS[s]}${kpis && activeScope !== "unassigned" ? ` ${kpis.by_status[s] ?? 0}` : ""}` : "All"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle">
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 p-10 text-xs text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading inquiries...
            </div>
          ) : loadError ? (
            <div role="alert" className="p-10 text-center text-xs text-status-danger">
              {loadError}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-xs text-text-muted">
              {query || statusFilter
                ? "No enquiry matches that."
                : activeScope === "unassigned"
                  ? "Nothing is waiting: every enquiry has an owner."
                  : "No inquiries yet — they will show up here, and in your e-mail, as soon as someone submits the \"Talk to Our Team\" form."}
            </div>
          ) : (
            <div className={cn("overflow-x-auto transition-opacity", loading && "opacity-60")}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-2xs font-bold uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Waiting</th>
                    <th className="px-4 py-3 text-right">Quick actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const overdue = isOverdue(r, overdueHours);
                    const tel = telLink(r.phone);
                    return (
                      <tr key={r.id} onClick={() => setActiveId(r.id)} className="cursor-pointer border-b border-border-subtle transition-colors last:border-0 hover:bg-elevated/60">
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-3xs font-bold", avatarColorClass(r.name))}>{initials(r.name)}</div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-primary">{r.name}</p>
                              <p className="truncate text-2xs text-text-muted">{r.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">{r.organization_name}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-text-secondary">
                            {r.audience === "institution" ? <GraduationCap className="h-3.5 w-3.5 text-accent-primary" /> : r.audience === "academy" ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : <Briefcase className="h-3.5 w-3.5 text-accent-secondary" />}
                            {CONTACT_REQUEST_AUDIENCE_LABELS[r.audience]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold", LEAD_STATUS_BADGE_CLASS[r.status])}>{LEAD_STATUS_LABELS[r.status]}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-secondary">
                          {r.assigned_to_name ?? <span className="font-bold text-amber-700 dark:text-amber-300">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className={cn("font-mono", overdue ? "font-bold text-status-danger" : "text-text-muted")} title={new Date(r.created_at).toLocaleString("en-IN")}>
                            {waitingFor(r.created_at)}
                          </span>
                          {overdue && <span className="ml-1.5 rounded-full bg-status-danger/10 px-1.5 py-0.5 text-3xs font-bold uppercase text-status-danger">Overdue</span>}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {r.assigned_to_id === null && !isSuper && (
                              <button
                                type="button"
                                disabled={claiming === r.id}
                                onClick={() => claim(r)}
                                className="inline-flex items-center gap-1 rounded-control bg-accent-primary px-2.5 py-1 text-2xs font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
                              >
                                {claiming === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <HandHelping className="h-3 w-3" />}
                                Claim
                              </button>
                            )}
                            <a href={replyMailto(r)} aria-label={`E-mail ${r.name}`} title="E-mail" className="rounded-control border border-border-subtle p-1.5 text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-accent-primary">
                              <Mail className="h-3.5 w-3.5" />
                            </a>
                            {tel && (
                              <a href={tel} aria-label={`Call ${r.name}`} title="Call" className="rounded-control border border-border-subtle p-1.5 text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-accent-primary">
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data && lastPage > 1 && (
            <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2.5 text-2xs text-text-muted">
              <span>
                Page {data.requests.current_page} of {lastPage} · {data.requests.total} enquiries
              </span>
              <div className="flex gap-1.5">
                <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-control border border-border-subtle p-1.5 hover:text-primary disabled:opacity-40">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button type="button" aria-label="Next page" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} className="rounded-control border border-border-subtle p-1.5 hover:text-primary disabled:opacity-40">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>{activeId !== null && <ContactRequestDetailDrawer requestId={activeId} canClaim={!isSuper} onClose={() => setActiveId(null)} onChanged={load} />}</AnimatePresence>
    </DashboardShell>
  );
}
