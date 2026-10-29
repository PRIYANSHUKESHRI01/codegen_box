"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, BadgeCheck, Ban, CalendarPlus, ChevronLeft, ChevronRight, Gift, RefreshCw, Search, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { formatInr } from "@/lib/pricing";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { AdminSubscriptionRow, AdminSubscriptionsResponse, SubscriptionChangeResponse } from "@/types/adminSubscriptions";
import { GrantPlanModal, type GrantTarget } from "./GrantPlanModal";
import { PlanActionModal } from "./PlanActionModal";
import { SourceBadge, StateBadge, describeEnd } from "./planUi";
import { UserManageDrawer } from "./UserManageDrawer";
import { type ToastTrigger } from "@/lib/toast";

const STATE_FILTERS: { value: string; label: string }[] = [
  { value: "active", label: "Running" },
  { value: "expired", label: "Ended" },
  { value: "canceled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const SELECT = "rounded-control border border-border-subtle bg-elevated px-2.5 py-2 text-xs text-primary outline-none focus:border-accent-primary";

const HOLDER_TYPE: Record<string, string> = { user: "Student", college: "College", company: "Company", deleted: "Deleted" };

function Stat({ label, value, hint, onClick, active, tone }: { label: string; value: number; hint?: string; onClick?: () => void; active?: boolean; tone?: "violet" | "warning" }) {
  const body = (
    <>
      <div className="text-3xs font-bold uppercase tracking-wide text-text-muted">{label}</div>
      <div className={cn("mt-1.5 font-mono text-xl font-extrabold", tone === "violet" ? "text-violet-500" : tone === "warning" ? "text-status-warning" : "text-primary")}>{value.toLocaleString("en-IN")}</div>
      {hint && <div className="mt-0.5 text-3xs text-text-muted">{hint}</div>}
    </>
  );

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-panel border bg-surface p-4 text-left shadow-subtle transition-colors hover:border-accent-primary/40",
        active ? "border-accent-primary" : "border-border-subtle"
      )}
    >
      {body}
    </button>
  ) : (
    <div className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">{body}</div>
  );
}

/**
 * Superadmin → Subscriptions: every plan anyone holds — students, colleges and
 * companies — in one place, with the hand tools to give a student a plan, add
 * days, or end one. Everything here is live: the holder's access changes on their
 * very next request and their open screen follows within seconds; each action is
 * written to the audit log with who did it and why.
 *
 * The free Coder plan every student starts on is hidden by default (there would be
 * thousands of them); "Show free plans" brings them back.
 */
export function SubscriptionsPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [data, setData] = useState<AdminSubscriptionsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [state, setState] = useState("active");
  const [audience, setAudience] = useState("");
  const [source, setSource] = useState("");
  const [endingSoon, setEndingSoon] = useState(false);
  const [includeFree, setIncludeFree] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);

  // The page number belongs to the filters it was chosen under: change any filter (or the search) and it is page 1 again
  // in the SAME render. Resetting it from an effect instead sent one request for the old page number under the new
  // filters and then a second for page 1, and whichever answered last won.
  const filterKey = [state, audience, source, endingSoon, includeFree, debouncedSearch.trim()].join("|");
  const [pageAt, setPageAt] = useState<{ key: string; page: number }>({ key: filterKey, page: 1 });
  const page = pageAt.key === filterKey ? pageAt.page : 1;
  const goToPage = (next: number) => setPageAt({ key: filterKey, page: next });

  const [granting, setGranting] = useState(false);
  const [action, setAction] = useState<{ mode: "extend" | "cancel"; row: AdminSubscriptionRow } | null>(null);
  const [managedUserId, setManagedUserId] = useState<number | null>(null);

  // Only the newest request may write to the screen: a slow answer to an old filter must never land on top of the
  // answer to the current one.
  const latest = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++latest.current;
    setLoadError(null);
    setRefreshing(true);

    const params = new URLSearchParams({ state });
    if (audience) params.set("audience", audience);
    if (source) params.set("source", source);
    if (endingSoon) params.set("ending_within", "7");
    if (includeFree) params.set("include_free", "1");
    if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
    if (page > 1) params.set("page", String(page));

    try {
      const res = await api.get<AdminSubscriptionsResponse>(`/superadmin/subscriptions?${params}`);
      if (ticket === latest.current) setData(res);
    } catch (err) {
      if (ticket === latest.current) setLoadError(err instanceof ApiError ? err.message : "Couldn't load the subscriptions.");
    } finally {
      if (ticket === latest.current) setRefreshing(false);
    }
  }, [state, audience, source, endingSoon, includeFree, debouncedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const granted = (result: SubscriptionChangeResponse, student: GrantTarget) => {
    setGranting(false);
    triggerToast(`${student.name} is now on ${result.subscription.plan?.name ?? "the plan"}${result.subscription.current_period_end ? ` until ${new Date(result.subscription.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}.`);
    if (result.warning) triggerToast(result.warning, "warning");
    void load();
  };

  const acted = (result: SubscriptionChangeResponse, mode: "extend" | "cancel") => {
    setAction(null);
    triggerToast(
      mode === "extend"
        ? `${result.subscription.subscriber.name}'s ${result.subscription.plan?.name} now runs until ${new Date(result.subscription.current_period_end ?? Date.now()).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`
        : `${result.subscription.subscriber.name}'s ${result.subscription.plan?.name} plan has been ended.`
    );
    void load();
  };

  if (loadError && !data) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
        <span>{loadError}</span>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-panel border border-border-subtle bg-surface" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-panel border border-border-subtle bg-surface" />
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-base font-extrabold text-primary">
            <BadgeCheck className="h-4 w-4 text-accent-primary" /> Subscriptions
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Every plan anyone holds. Give a student a plan, add days, or end one — it takes effect on their very next request and their open screen follows within seconds. Each action is recorded in the Audit Log with
            who did it and why.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover disabled:opacity-60"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setGranting(true)}
            className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3.5 py-2 text-2xs font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover"
          >
            <Gift className="h-3.5 w-3.5" /> Give a plan
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-7">
        <Stat label="Paid students" value={summary.paid_individual} hint="on a paid plan now" />
        <Stat label="Given free" value={summary.complimentary} hint="no revenue" tone="violet" />
        <Stat label="Redeemed offers" value={summary.redeemed ?? 0} hint="free offer, no payment" tone="violet" />
        <Stat label="Colleges" value={summary.colleges} hint="with a running plan" />
        <Stat label="Companies" value={summary.companies} hint="with a running plan" />
        <Stat
          label="Ending in 7 days"
          value={summary.ending_7_days}
          hint={endingSoon ? "showing — click to clear" : "click to list them"}
          tone={summary.ending_7_days > 0 ? "warning" : undefined}
          onClick={() => {
            setEndingSoon((v) => !v);
            setState("active");
          }}
          active={endingSoon}
        />
        <Stat label="Cancelled" value={summary.canceled_30_days} hint="in the last 30 days" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-border-subtle bg-elevated p-1" role="group" aria-label="Filter by state">
          {STATE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setState(f.value);
                // "Ending in 7 days" lists RUNNING plans only — keeping it on under Ended / Cancelled could only ever be empty.
                if (f.value !== "active") setEndingSoon(false);
              }}
              aria-pressed={state === f.value}
              className={cn("rounded-control px-3 py-1 text-2xs font-bold transition-all", state === f.value ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary")}
            >
              {f.label}
            </button>
          ))}
        </div>

        <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Filter by holder" className={SELECT}>
          <option value="">Students, colleges &amp; companies</option>
          <option value="individual">Students only</option>
          <option value="institution">Colleges only</option>
          <option value="company">Companies only</option>
        </select>

        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by how it was obtained" className={SELECT}>
          <option value="">Any source</option>
          <option value="purchase">Bought online</option>
          <option value="admin_grant">Given by an admin</option>
          <option value="offer_redeemed">Free offer redeemed</option>
        </select>

        <label className="flex cursor-pointer items-center gap-1.5 text-2xs font-semibold text-text-secondary">
          <input type="checkbox" checked={includeFree} onChange={(e) => setIncludeFree(e.target.checked)} className="h-3.5 w-3.5 rounded border-border-subtle" />
          Show free plans
        </label>

        <label className="relative ml-auto w-full max-w-xs">
          <span className="sr-only">Search subscriptions</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, college or company"
            className="w-full rounded-control border border-border-subtle bg-elevated py-2 pl-9 pr-3 text-xs text-primary outline-none focus:border-accent-primary"
          />
        </label>
      </div>

      {loadError && (
        <div role="alert" className="flex items-center gap-2 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {loadError}
        </div>
      )}

      <div className={cn("overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle transition-opacity", refreshing && "opacity-70")}>
        <table className="w-full min-w-[980px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border-subtle text-3xs font-bold uppercase tracking-wide text-text-muted">
              <th scope="col" className="p-3">Holder</th>
              <th scope="col" className="p-3">Plan</th>
              <th scope="col" className="p-3">How</th>
              <th scope="col" className="p-3">Status</th>
              <th scope="col" className="p-3">Ends</th>
              <th scope="col" className="p-3">Paid</th>
              <th scope="col" className="p-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.subscriptions.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-text-muted">
                  No subscriptions match.
                </td>
              </tr>
            )}
            {data.subscriptions.map((row) => (
              <tr key={row.id} className="border-b border-border-subtle align-top last:border-b-0">
                <td className="p-3">
                  {row.subscriber.type === "user" && row.subscriber.id ? (
                    <button type="button" onClick={() => setManagedUserId(row.subscriber.id)} className="text-left font-semibold text-primary hover:text-accent-primary hover:underline">
                      {row.subscriber.name}
                    </button>
                  ) : (
                    <div className="font-semibold text-primary">{row.subscriber.name}</div>
                  )}
                  <div className="text-text-muted">
                    <span className="mr-1.5 rounded-full border border-border-subtle bg-elevated px-1.5 py-px text-3xs font-bold uppercase">{HOLDER_TYPE[row.subscriber.type]}</span>
                    {row.subscriber.email ?? row.subscriber.detail}
                  </div>
                </td>
                <td className="p-3 font-semibold text-primary">{row.plan?.name ?? "—"}</td>
                <td className="p-3">
                  <SourceBadge row={row} />
                  {row.reason && <div className="mt-1 max-w-[220px] text-text-muted">{row.reason}</div>}
                  {row.granted_by && <div className="text-3xs text-text-muted">by {row.granted_by}</div>}
                </td>
                <td className="p-3">
                  <StateBadge state={row.state} />
                  {row.cancel_reason && <div className="mt-1 max-w-[200px] text-text-muted">{row.cancel_reason}</div>}
                </td>
                <td className="whitespace-nowrap p-3 text-text-secondary">
                  {describeEnd(row)}
                  {row.extensions > 0 && <div className="text-3xs text-text-muted">extended {row.extensions}×</div>}
                </td>
                <td className="whitespace-nowrap p-3 font-mono text-primary">{row.price_paid === null ? "—" : row.price_paid === 0 ? "Free" : formatInr(row.price_paid)}</td>
                <td className="p-3 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-1.5">
                    {row.subscriber.type === "user" && row.subscriber.id && (
                      <button
                        type="button"
                        onClick={() => setManagedUserId(row.subscriber.id)}
                        aria-label={`Manage ${row.subscriber.name}`}
                        className="inline-flex items-center gap-1 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover"
                      >
                        <UserCog className="h-3 w-3" /> Manage
                      </button>
                    )}
                    {row.can_extend && (
                      <button
                        type="button"
                        onClick={() => setAction({ mode: "extend", row })}
                        aria-label={`Extend ${row.subscriber.name}'s ${row.plan?.name}`}
                        className="inline-flex items-center gap-1 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover"
                      >
                        <CalendarPlus className="h-3 w-3" /> Extend
                      </button>
                    )}
                    {row.can_cancel && (
                      <button
                        type="button"
                        onClick={() => setAction({ mode: "cancel", row })}
                        aria-label={`End ${row.subscriber.name}'s ${row.plan?.name}`}
                        className="inline-flex items-center gap-1 rounded-control border border-status-danger/30 bg-status-danger/10 px-2.5 py-1.5 text-2xs font-bold text-status-danger transition-colors hover:bg-status-danger/20"
                      >
                        <Ban className="h-3 w-3" /> End
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.pagination.last_page > 1 ? (
        <div className="flex items-center justify-between text-2xs text-text-muted">
          <span>
            Page {data.pagination.current_page} of {data.pagination.last_page} · {data.pagination.total} subscriptions
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page <= 1 || refreshing}
              className="inline-flex items-center gap-1 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 font-bold text-primary disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(Math.min(data.pagination.last_page, page + 1))}
              disabled={page >= data.pagination.last_page || refreshing}
              className="inline-flex items-center gap-1 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 font-bold text-primary disabled:opacity-50"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-2xs text-text-muted" aria-live="polite">
          {data.pagination.total.toLocaleString()} subscription{data.pagination.total === 1 ? "" : "s"}
        </p>
      )}

      {granting && <GrantPlanModal onClose={() => setGranting(false)} onGranted={granted} />}
      {action && <PlanActionModal mode={action.mode} row={action.row} onClose={() => setAction(null)} onDone={acted} />}
      {managedUserId !== null && (
        <UserManageDrawer userId={managedUserId} onClose={() => setManagedUserId(null)} onChanged={() => void load()} triggerToast={triggerToast} />
      )}
    </div>
  );
}
