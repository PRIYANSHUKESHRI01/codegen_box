"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Inbox, Users2, UserPlus, CheckCircle2, Loader2, GraduationCap, Briefcase } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { ContactRequestDetailDrawer } from "@/components/marketing-site/ContactRequestDetailDrawer";
import { cn } from "@/lib/utils";
import { avatarColorClass, initials } from "@/lib/avatarColor";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { LEAD_STATUS_LABELS, LEAD_STATUS_BADGE_CLASS, type LeadStatus } from "@/types/lead";
import { CONTACT_REQUEST_AUDIENCE_LABELS, type ContactRequestSummary, type ContactRequestPage } from "@/types/contactRequest";

interface ContactRequestsResponse {
  requests: ContactRequestPage;
  kpis: {
    total: number;
    new_this_week: number;
    unassigned: number;
    by_status: Record<LeadStatus, number>;
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function KpiSkeleton() {
  return (
    <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle animate-pulse">
      <div className="h-3 w-20 bg-elevated rounded" />
      <div className="h-7 w-14 bg-elevated rounded mt-3" />
    </div>
  );
}

export default function MarketingInquiriesPage() {
  const { status, user: me } = useAuthGuard(["admin_marketing", "superadmin"]);
  const [requests, setRequests] = useState<ContactRequestSummary[]>([]);
  const [kpis, setKpis] = useState<ContactRequestsResponse["kpis"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  const hasLeadsAccess = userHasPermission(me, "leads");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<ContactRequestsResponse>("/marketing/contact-requests");
      setRequests(res.requests.data);
      setKpis(res.kpis);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load inquiries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready" && hasLeadsAccess) load();
  }, [status, hasLeadsAccess, load]);

  if (status !== "ready") {
    return <SessionLoader />;
  }

  if (!hasLeadsAccess) {
    return (
      <DashboardShell role={me?.role === "superadmin" ? "superadmin" : "admin_marketing"} title="Inquiries">
        <AccessDeniedNotice section="Inquiries" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role={me?.role === "superadmin" ? "superadmin" : "admin_marketing"}
      title="Inquiries"
      subtitle={
        me?.role === "superadmin"
          ? "Every \"Talk to Our Team\" submission, platform-wide."
          : "\"Talk to Our Team\" submissions assigned to you."
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loading || !kpis ? (
            <>
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
              <KpiSkeleton />
            </>
          ) : (
            <>
              <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                <div className="flex items-center gap-2 text-text-muted text-2xs font-bold uppercase tracking-wide">
                  <Inbox className="w-3.5 h-3.5" />
                  <span>Total Inquiries</span>
                </div>
                <p className="text-2xl font-black text-primary mt-2 font-mono">{kpis.total}</p>
              </div>
              <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                <div className="flex items-center gap-2 text-text-muted text-2xs font-bold uppercase tracking-wide">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>New This Week</span>
                </div>
                <p className="text-2xl font-black text-primary mt-2 font-mono">{kpis.new_this_week}</p>
              </div>
              <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                <div className="flex items-center gap-2 text-text-muted text-2xs font-bold uppercase tracking-wide">
                  <Users2 className="w-3.5 h-3.5" />
                  <span>Unassigned</span>
                </div>
                <p className="text-2xl font-black text-primary mt-2 font-mono">{kpis.unassigned}</p>
              </div>
              <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
                <div className="flex items-center gap-2 text-text-muted text-2xs font-bold uppercase tracking-wide">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Converted</span>
                </div>
                <p className="text-2xl font-black text-primary mt-2 font-mono">{kpis.by_status.converted}</p>
              </div>
            </>
          )}
        </div>

        <div className="rounded-panel bg-surface border border-border-subtle shadow-subtle overflow-hidden">
          {loading ? (
            <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading inquiries...
            </div>
          ) : loadError ? (
            <div className="p-10 text-center text-xs text-status-danger">{loadError}</div>
          ) : requests.length === 0 ? (
            <div className="p-10 text-center text-xs text-text-muted">
              No inquiries yet — they&apos;ll show up here as soon as someone submits the &quot;Talk to Our
              Team&quot; form.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-left text-2xs font-bold uppercase tracking-wide text-text-muted">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned To</th>
                    <th className="px-4 py-3">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setActiveId(r.id)}
                      className="border-b border-border-subtle last:border-0 hover:bg-elevated/60 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-3xs font-bold shrink-0",
                              avatarColorClass(r.name)
                            )}
                          >
                            {initials(r.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-primary truncate">{r.name}</p>
                            <p className="text-2xs text-text-muted truncate">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{r.organization_name}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-text-secondary">
                          {r.audience === "institution" ? (
                            <GraduationCap className="w-3.5 h-3.5 text-accent-primary" />
                          ) : (
                            <Briefcase className="w-3.5 h-3.5 text-accent-secondary" />
                          )}
                          {CONTACT_REQUEST_AUDIENCE_LABELS[r.audience]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded-full text-3xs font-bold border", LEAD_STATUS_BADGE_CLASS[r.status])}>
                          {LEAD_STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{r.assigned_to_name ?? "—"}</td>
                      <td className="px-4 py-3 text-text-muted text-xs font-mono">{formatDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {activeId !== null && (
          <ContactRequestDetailDrawer requestId={activeId} onClose={() => setActiveId(null)} onChanged={load} />
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}
