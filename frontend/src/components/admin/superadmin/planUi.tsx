import { cn } from "@/lib/utils";
import { formatInr } from "@/lib/pricing";
import type { AdminSubscriptionRow, SubscriptionSource, SubscriptionState } from "@/types/adminSubscriptions";

/** The words and colours the superadmin's subscription screens use for a subscription's state. One place, so the list and the drawer agree. */
export const STATE_STYLE: Record<SubscriptionState, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-status-success/15 text-status-success border-status-success/30" },
  expired: { label: "Expired", className: "bg-elevated text-text-muted border-border-subtle" },
  canceled: { label: "Cancelled", className: "bg-status-danger/10 text-status-danger border-status-danger/30" },
};

export function StateBadge({ state }: { state: SubscriptionState }) {
  const style = STATE_STYLE[state];
  return <span className={cn("inline-block rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", style.className)}>{style.label}</span>;
}

const SOURCE_LABEL: Record<SubscriptionSource, string> = {
  purchase: "Bought online",
  admin_grant: "Given by admin",
  admin_assigned: "Assigned by Mellow",
  system: "Free plan",
  offer_redeemed: "Free offer redeemed",
};

/**
 * How a subscription came to be, in a few words a person can act on — and, for
 * one given by hand, whether any money came in for it (a free gift and a plan
 * paid for by bank transfer look identical on the student's side, very
 * different in the books).
 */
export function describeSource(row: Pick<AdminSubscriptionRow, "source" | "complimentary" | "price_paid" | "is_trial">): string {
  if (row.source === "admin_grant") {
    return row.complimentary ? "Given free by admin" : `Paid outside the gateway${row.price_paid ? ` · ${formatInr(row.price_paid)}` : ""}`;
  }
  if (row.is_trial) return "Demo period";
  return SOURCE_LABEL[row.source] ?? row.source;
}

export function SourceBadge({ row }: { row: Pick<AdminSubscriptionRow, "source" | "complimentary" | "price_paid" | "is_trial"> }) {
  const noRevenue = (row.source === "admin_grant" && row.complimentary) || row.source === "offer_redeemed";
  const tone = noRevenue ? "border-violet-500/30 bg-violet-500/10 text-violet-500" : "border-border-subtle bg-elevated text-text-secondary";
  return <span className={cn("inline-block rounded-full border px-2 py-0.5 text-3xs font-bold", tone)}>{describeSource(row)}</span>;
}

export function formatDay(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

/** "12 Jan 2027 · 91 days left", "Never expires", or "Ended 3 Oct 2026". */
export function describeEnd(row: Pick<AdminSubscriptionRow, "state" | "current_period_end" | "days_remaining" | "canceled_at">): string {
  if (row.state === "canceled") return `Cancelled ${formatDay(row.canceled_at)}`;
  if (row.current_period_end === null) return "Never expires";
  if (row.state === "expired") return `Ended ${formatDay(row.current_period_end)}`;

  const left = row.days_remaining ?? 0;
  return `${formatDay(row.current_period_end)} · ${left} day${left === 1 ? "" : "s"} left`;
}
