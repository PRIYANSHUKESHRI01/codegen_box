"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users2, UserPlus, CheckCircle2, StickyNote } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerDetailDrawer } from "@/components/customers/CustomerDetailDrawer";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import type { CustomerSummary, CustomerPage } from "@/types/customer";

interface CustomersResponse {
  customers: CustomerPage;
  kpis: { total_customers: number; new_this_week: number };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Mellow Internal's "My Customers" dashboard — the other half of the lead
 * pipeline from /marketing. A lead lands here the instant it converts (buys
 * a real paid plan — see SubscriptionService::subscribeIndividual ->
 * LeadAssignmentService::convertLead) and is handed off from Marketing to
 * whichever internal employee has the lightest book, exactly mirroring how
 * /marketing itself is scoped to "my own leads" for an admin_marketing
 * actor. Superadmin sees every converted customer, same convention as the
 * Leads tab on /superadmin.
 */
export default function InternalCustomersPage() {
  const { status, user: me } = useAuthGuard(["admin_internal", "superadmin"]);

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [kpis, setKpis] = useState<CustomersResponse["kpis"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [activeCustomerId, setActiveCustomerId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadCustomers = useCallback(async (s: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = s ? `?search=${encodeURIComponent(s)}` : "";
      const res = await api.get<CustomersResponse>(`/admin/customers${qs}`);
      setCustomers(res.customers.data);
      setKpis(res.kpis);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, []);

  const hasAccess = userHasPermission(me, "customers");

  useEffect(() => {
    if (status === "ready" && hasAccess) loadCustomers(searchDebounced);
  }, [status, hasAccess, searchDebounced, loadCustomers]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  if (!hasAccess) {
    return (
      <DashboardShell role={me?.role === "superadmin" ? "superadmin" : "admin_internal"} title="My Customers">
        <AccessDeniedNotice section="My Customers" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      role={me?.role === "superadmin" ? "superadmin" : "admin_internal"}
      title="My Customers"
      subtitle="Converted Mellow Direct leads handed off from the Marketing team — real subscribers, now yours to onboard and support."
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary"
          >
            <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
            <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Users2 className="w-3.5 h-3.5" /> My Customers
            </span>
            <div className="text-2xl font-black text-primary font-mono mt-2">{kpis?.total_customers ?? "—"}</div>
          </div>
          <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
            <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Converted This Week
            </span>
            <div className="text-2xl font-black text-status-success font-mono mt-2">{kpis?.new_this_week ?? "—"}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-control bg-surface border border-border-subtle text-primary placeholder-text-muted outline-none focus:border-accent-primary"
            />
          </div>
        </div>

        {loadError && (
          <div className="p-4 rounded-panel bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger">{loadError}</div>
        )}

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
            {searchDebounced ? "No customers match your search." : "No converted customers assigned to you yet."}
          </div>
        ) : (
          <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Converted</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Converted By</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-surface-hover/60 transition-colors cursor-pointer"
                      onClick={() => setActiveCustomerId(customer.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-primary">{customer.name}</div>
                        <div className="text-3xs text-text-muted">{customer.email}</div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatDate(customer.converted_at)}</td>
                      <td className="px-4 py-3 text-text-secondary">{customer.plan_name ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{customer.converted_by_name ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {customer.note_count > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <StickyNote className="w-3 h-3" /> {customer.note_count}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-3xs font-bold border whitespace-nowrap inline-flex items-center gap-1",
                            customer.is_blocked
                              ? "bg-status-danger/15 text-status-danger border-status-danger/30"
                              : "bg-status-success/15 text-status-success border-status-success/30"
                          )}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {customer.is_blocked ? "Blocked" : "Active"}
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

      {activeCustomerId && (
        <CustomerDetailDrawer
          customerId={activeCustomerId}
          onClose={() => setActiveCustomerId(null)}
          onChanged={() => loadCustomers(searchDebounced)}
        />
      )}
    </DashboardShell>
  );
}
