import { cn } from "@/lib/utils";
import type { ManagedUserResponse } from "@/types/adminSubscriptions";
import { type ToastTrigger } from "@/lib/toast";

/** What every section of the manage drawer is given. */
export interface SectionProps {
  data: ManagedUserResponse;
  /** Re-read this account from the server (and tell the list behind the drawer it changed). */
  reload: () => Promise<void>;
  triggerToast: ToastTrigger;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-control border border-border-subtle bg-elevated/60 p-3.5 text-xs", className)}>{children}</div>;
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h4 className="text-2xs font-bold uppercase tracking-wider text-text-muted">{children}</h4>
      {aside}
    </div>
  );
}

/** A label/value line inside a Card. */
export function Row({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-text-secondary">{label}</dt>
      <dd className={cn("min-w-0 break-words text-right font-semibold text-primary", mono && "font-mono")}>{children}</dd>
    </div>
  );
}

export const ghostButton =
  "inline-flex items-center justify-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButton =
  "inline-flex items-center justify-center gap-1.5 rounded-control bg-accent-primary px-3 py-2 text-2xs font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50";

export const dangerButton =
  "inline-flex items-center justify-center gap-1.5 rounded-control border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-2xs font-bold text-status-danger transition-colors hover:bg-status-danger/20 disabled:cursor-not-allowed disabled:opacity-50";

export const inputClass = "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary";

/** "3 days ago" style, from an ISO timestamp; falls back to a date for anything older than a month. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";

  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";

  const units: [number, string][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
  ];
  let chosen: [number, string] = [60, "minute"];
  for (const unit of units) {
    if (seconds >= unit[0]) chosen = unit;
  }

  const value = Math.floor(seconds / chosen[0]);
  if (chosen[1] === "day" && value > 30) return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return `${value} ${chosen[1]}${value === 1 ? "" : "s"} ago`;
}
