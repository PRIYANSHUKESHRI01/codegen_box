"use client";

import { Bell, Briefcase, ClipboardCheck, CreditCard, Gem, Inbox, Megaphone, Rocket, ShieldAlert, TrendingDown, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime, type AppNotification, type NotificationCategory, type NotificationSeverity } from "@/lib/notifications";

/** What each category looks like — and what it is called in filters and settings. */
export const CATEGORY_META: Record<NotificationCategory, { label: string; icon: LucideIcon }> = {
  drives: { label: "Drives", icon: Briefcase },
  assessments: { label: "Tests & contests", icon: ClipboardCheck },
  hackathons: { label: "Hackathons", icon: Rocket },
  announcements: { label: "Messages", icon: Megaphone },
  vault: { label: "Vault", icon: Gem },
  progress: { label: "Readiness", icon: TrendingDown },
  operations: { label: "Team", icon: Inbox },
  plan: { label: "Plans & payments", icon: CreditCard },
  account: { label: "Account", icon: ShieldAlert },
};

/** Icon tile + accent per severity. Every colour is a theme token, so it reads in both themes. */
export const SEVERITY_STYLE: Record<NotificationSeverity, { tile: string; dot: string; bar: string }> = {
  info: { tile: "bg-accent-secondary/12 text-accent-secondary border-accent-secondary/25", dot: "bg-accent-secondary", bar: "bg-accent-secondary" },
  success: { tile: "bg-status-success/12 text-status-success border-status-success/25", dot: "bg-status-success", bar: "bg-status-success" },
  warning: { tile: "bg-status-warning/12 text-status-warning border-status-warning/25", dot: "bg-status-warning", bar: "bg-status-warning" },
  critical: { tile: "bg-status-danger/12 text-status-danger border-status-danger/25", dot: "bg-status-danger", bar: "bg-status-danger" },
};

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_META[category as NotificationCategory]?.icon ?? Bell;
}

/** The icon tile at the left of every notification. */
export function NotificationIcon({ notification, className }: { notification: Pick<AppNotification, "category" | "severity">; className?: string }) {
  const Icon = categoryIcon(notification.category);
  const style = SEVERITY_STYLE[notification.severity] ?? SEVERITY_STYLE.info;

  return (
    <span aria-hidden="true" className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", style.tile, className)}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

/**
 * One notification, as a row: a tile, the title (bold while unread), up to two lines of body, how long ago, an unread dot
 * and — on hover or keyboard focus — a dismiss button. The row itself is the button that opens it.
 */
export function NotificationRow({
  notification,
  onOpen,
  onDismiss,
  now,
  className,
}: {
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
  onDismiss?: (n: AppNotification) => void;
  now?: number;
  className?: string;
}) {
  const n = notification;
  const style = SEVERITY_STYLE[n.severity] ?? SEVERITY_STYLE.info;

  return (
    <li className={cn("group relative", className)}>
      <button
        type="button"
        onClick={() => onOpen(n)}
        className={cn(
          "flex w-full items-start gap-3 rounded-control border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
          n.read ? "border-transparent hover:bg-surface-hover" : "border-accent-primary/20 bg-accent-primary/[0.05] hover:bg-accent-primary/[0.09]"
        )}
      >
        <NotificationIcon notification={n} />
        <span className="min-w-0 flex-1 pr-5">
          <span className="flex items-start justify-between gap-2">
            <span className={cn("text-xs leading-snug text-primary", n.read ? "font-semibold" : "font-bold")}>{n.title}</span>
            <span className="shrink-0 pt-px text-3xs font-medium text-text-muted">{relativeTime(n.created_at, now)}</span>
          </span>
          {n.body && <span className="mt-0.5 line-clamp-2 block text-2xs leading-relaxed text-text-secondary">{n.body}</span>}
        </span>
        {!n.read && <span aria-label="Unread" className={cn("absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full group-hover:opacity-0 group-focus-within:opacity-0", style.dot)} />}
      </button>
      {onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(n)}
          aria-label={`Dismiss: ${n.title}`}
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-text-muted opacity-0 transition-opacity hover:bg-elevated hover:text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
