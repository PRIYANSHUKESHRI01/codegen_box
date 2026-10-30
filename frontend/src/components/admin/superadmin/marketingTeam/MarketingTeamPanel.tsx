"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, Ban, CheckCircle2, Inbox, Megaphone, MessageSquareText, Pencil, Search, Settings2, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { api, ApiError } from "@/lib/api";
import { confirmDialog } from "@/lib/dialogs";
import { cn } from "@/lib/utils";
import { PERMISSION_LABELS, type Permission } from "@/types/permissions";
import type { ToastTrigger } from "@/lib/toast";
import { UserManageDrawer } from "../UserManageDrawer";
import { AddMarketingModal } from "./AddMarketingModal";
import { DeleteMarketingModal } from "./DeleteMarketingModal";
import { EditAccessModal } from "./EditAccessModal";
import { ReassignModal } from "./ReassignModal";
import type { TeamMember, TeamTotals } from "./types";

type StatusFilter = "all" | "active" | "blocked";

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "blocked", label: "Blocked" },
];

function Kpi({ icon: Icon, label, value, tone, hint }: { icon: typeof Users; label: string; value: React.ReactNode; tone?: string; hint?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone ?? "bg-accent-primary/10 text-accent-primary")}>
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-3xs font-semibold uppercase leading-tight tracking-wider text-text-muted">{label}</div>
        <div className="tabular mt-0.5 text-xl font-black leading-none text-primary">{value}</div>
        {hint && <div className="mt-1 truncate text-3xs text-text-muted">{hint}</div>}
      </div>
    </div>
  );
}

/**
 * Superadmin -> Marketing Team: add, manage and remove the people who answer "Talk to Our Team" enquiries and chase leads.
 *
 * Everything about one person's ACCOUNT (details, password, sign-out, activity) is the existing Manage drawer; what lives here is the team
 * view the generic staff list could not give: what each person is carrying, a warning when nobody can take new work, handing work over,
 * and deleting someone without dropping what a prospect asked for.
 */
export function MarketingTeamPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [totals, setTotals] = useState<TeamTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const [adding, setAdding] = useState(false);
  const [managedId, setManagedId] = useState<number | null>(null);
  const [accessFor, setAccessFor] = useState<TeamMember | null>(null);
  const [reassignFor, setReassignFor] = useState<TeamMember | null>(null);
  const [deleteFor, setDeleteFor] = useState<TeamMember | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    return api
      .get<{ employees: TeamMember[]; totals: TeamTotals }>("/superadmin/marketing-team")
      .then((res) => {
        setMembers(res.employees);
        setTotals(res.totals);
      })
      .catch((err) => {
        setFailed(true);
        triggerToast(err instanceof ApiError ? err.message : "Couldn't load the marketing team.", "error");
      })
      .finally(() => setLoading(false));
  }, [triggerToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleBlock = async (m: TeamMember) => {
    const blocking = !m.is_blocked;
    const holds = m.leads.open + m.enquiries.open;

    if (blocking) {
      const ok = await confirmDialog({
        title: `Block ${m.name}?`,
        message: "They are signed out and can't sign in. New leads and enquiries stop going to them.",
        items: holds > 0 ? [`They still hold ${m.leads.open} open lead(s) and ${m.enquiries.open} open enquiry(ies). You can hand those over next.`] : undefined,
        confirmLabel: "Block",
        tone: "warning",
      });
      if (!ok) return;
    }

    try {
      await api.post(`/superadmin/users/${m.id}/toggle-block`);
      triggerToast(blocking ? `${m.name} was blocked.` : `${m.name} was unblocked. Anything waiting without an owner has been dealt out.`);
      await load();

      if (blocking && holds > 0) {
        const handOver = await confirmDialog({
          title: "Hand over their open work now?",
          message: `${m.name} is blocked but still holds ${m.leads.open} open lead(s) and ${m.enquiries.open} open enquiry(ies), which nobody is looking at.`,
          confirmLabel: "Hand over…",
          cancelLabel: "Later",
        });
        if (handOver) setReassignFor({ ...m, is_blocked: true });
      }
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't update the account.", "error");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => (filter === "all" || (filter === "active" ? !m.is_blocked : m.is_blocked)) && (q === "" || [m.name, m.email, m.handle ?? ""].some((v) => v.toLowerCase().includes(q))));
  }, [members, filter, search]);

  const waiting = totals ? totals.unassigned_leads + totals.unassigned_enquiries : 0;
  const nobodyCanTake = totals !== null && totals.active === 0;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <Megaphone className="h-5 w-5 shrink-0 text-accent-primary" />
            <span>Marketing Team</span>
          </h2>
          <p className="mt-1 text-xs text-text-muted">The people who answer &quot;Talk to Our Team&quot; enquiries and chase leads. New work goes to whoever holds the least.</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-control bg-accent-primary px-3.5 py-2 text-xs font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover hover:shadow-glow"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Add marketing employee</span>
        </button>
      </div>

      {totals && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi icon={Users} label="Team" value={`${totals.active} / ${totals.employees}`} hint="active / total" />
          <Kpi icon={Inbox} label="Open leads" value={totals.open_leads.toLocaleString()} />
          <Kpi icon={MessageSquareText} label="Open enquiries" value={totals.open_enquiries.toLocaleString()} />
          <Kpi
            icon={AlertTriangle}
            label="Waiting for an owner"
            value={waiting.toLocaleString()}
            tone={waiting > 0 ? "bg-status-warning/15 text-status-warning" : undefined}
            hint={waiting > 0 ? `${totals.unassigned_enquiries} enquiries · ${totals.unassigned_leads} leads` : "nothing is waiting"}
          />
        </div>
      )}

      {totals && waiting > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-panel border border-status-warning/30 bg-status-warning/10 p-4 text-xs text-status-warning">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-bold">
              {waiting.toLocaleString()} {waiting === 1 ? "item is" : "items are"} waiting for an owner.
            </p>
            <p className="mt-0.5">
              {nobodyCanTake ? "There is no active marketing employee, so nobody is being told about new enquiries. Add or unblock one and everything waiting is dealt out at once." : "They are dealt out the next time someone is added or unblocked."}
            </p>
          </div>
        </div>
      )}

      {members.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              aria-label="Search the marketing team"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-control border border-border-subtle bg-surface py-2 pl-8 pr-3 text-xs text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-primary"
            />
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn("rounded-full border px-3 py-1.5 text-2xs font-bold transition-colors", filter === f.id ? "border-accent-primary bg-accent-primary text-white" : "border-border-subtle bg-surface text-text-secondary hover:text-primary")}
              >
                {f.label}
              </button>
            ))}
            {(search || filter !== "all") && (
              <button type="button" onClick={() => { setSearch(""); setFilter("all"); }} className="inline-flex items-center gap-1 px-2 text-2xs font-bold text-text-muted hover:text-primary">
                <X className="h-3 w-3" aria-hidden /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2 rounded-panel border border-border-subtle bg-surface p-4" role="status" aria-label="Loading the marketing team">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-3" aria-hidden>
              <div className="h-9 w-9 rounded-full bg-elevated" />
              <div className="h-4 flex-1 rounded bg-elevated" />
              <div className="h-7 w-24 rounded bg-elevated" />
            </div>
          ))}
        </div>
      ) : failed && members.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center">
          <p className="text-sm font-bold text-primary">Couldn&apos;t load the marketing team</p>
          <button type="button" onClick={() => { setLoading(true); void load(); }} className="mt-4 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-bold text-text-secondary hover:text-primary">
            Retry
          </button>
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-panel border border-dashed border-border-strong bg-surface p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-primary/10 text-accent-primary">
            <Megaphone className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm font-bold text-primary">No marketing employees yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">Until you add one, enquiries from &quot;Talk to Our Team&quot; and new sign-ups have nobody to go to.</p>
          <button type="button" onClick={() => setAdding(true)} className="mt-4 rounded-control bg-accent-primary px-3.5 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover">
            Add the first one
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center text-xs text-text-muted">No one matches. Try a different search or clear the filter.</div>
      ) : (
        <div className="relative overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
          <table className="w-full min-w-[40rem] border-collapse text-xs" data-testid="team-table">
            <thead className="border-b border-border-subtle bg-elevated/60">
              <tr className="text-left text-3xs font-bold uppercase tracking-wider text-text-muted">
                <th scope="col" className="py-2.5 pl-4 pr-3">Member</th>
                <th scope="col" className="hidden px-3 py-2.5 lg:table-cell">Access</th>
                <th scope="col" className="px-3 py-2.5">Carrying</th>
                <th scope="col" className="px-3 py-2.5">Status</th>
                <th scope="col" className="py-2.5 pl-3 pr-4"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filtered.map((m) => (
                <tr key={m.id} className={cn("transition-colors hover:bg-surface-hover/60", m.is_blocked && "opacity-80")} data-testid="team-row">
                  <td className="max-w-[18rem] py-3 pl-4 pr-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-primary/15 text-sm font-bold text-accent-primary" aria-hidden>
                        {m.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-primary">{m.name}</div>
                        <div className="truncate font-mono text-3xs text-text-muted" title={m.email}>{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 lg:table-cell">
                    {m.permissions.length === 0 ? (
                      <span className="text-2xs text-status-warning">No access</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.permissions.map((p) => (
                          <span key={p} className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-bold text-text-secondary">
                            {PERMISSION_LABELS[p as Permission] ?? p}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="tabular whitespace-nowrap text-xs font-bold text-primary">
                      {m.leads.open} <span className="font-normal text-text-muted">leads</span> · {m.enquiries.open} <span className="font-normal text-text-muted">enquiries</span>
                    </div>
                    <div className="tabular text-3xs text-text-muted">{m.leads.converted} converted · {m.leads.total + m.enquiries.total} handled in all</div>
                  </td>
                  <td className="px-3 py-3">
                    {m.is_blocked ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-status-danger/25 bg-status-danger/10 px-2 py-0.5 text-3xs font-bold text-status-danger">
                        <Ban className="h-3 w-3" aria-hidden /> Blocked
                      </span>
                    ) : m.must_change_password ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-status-warning/25 bg-status-warning/10 px-2 py-0.5 text-3xs font-bold text-status-warning">Not signed in yet</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/25 bg-status-success/10 px-2 py-0.5 text-3xs font-bold text-status-success">
                        <CheckCircle2 className="h-3 w-3" aria-hidden /> Active
                      </span>
                    )}
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right">
                    <ActionMenu
                      label="Manage"
                      icon={Settings2}
                      ariaLabel={`Manage ${m.name}`}
                      groups={[
                        [
                          { key: "account", label: "Account & password", icon: Pencil, onSelect: () => setManagedId(m.id) },
                          { key: "access", label: "Edit access", icon: ShieldCheck, onSelect: () => setAccessFor(m) },
                        ],
                        [{ key: "reassign", label: "Reassign work", icon: ArrowRightLeft, onSelect: () => setReassignFor(m) }],
                        [
                          { key: "block", label: m.is_blocked ? "Unblock" : "Block", icon: Ban, tone: m.is_blocked ? "success" : "default", onSelect: () => void toggleBlock(m) },
                          { key: "delete", label: "Delete", icon: Trash2, tone: "danger", onSelect: () => setDeleteFor(m) },
                        ],
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <AddMarketingModal onClose={() => setAdding(false)} onCreated={() => void load()} />}

      {accessFor && (
        <EditAccessModal
          member={accessFor}
          onClose={() => setAccessFor(null)}
          onSaved={(message) => {
            triggerToast(message);
            void load();
          }}
        />
      )}

      {reassignFor && (
        <ReassignModal
          member={reassignFor}
          onClose={() => setReassignFor(null)}
          onDone={(message) => {
            triggerToast(message);
            void load();
          }}
        />
      )}

      {deleteFor && (
        <DeleteMarketingModal
          member={deleteFor}
          onClose={() => setDeleteFor(null)}
          onDeleted={(message) => {
            setDeleteFor(null);
            triggerToast(message);
            void load();
          }}
        />
      )}

      {managedId !== null && <UserManageDrawer userId={managedId} onClose={() => setManagedId(null)} onChanged={() => void load()} triggerToast={triggerToast} />}
    </div>
  );
}
