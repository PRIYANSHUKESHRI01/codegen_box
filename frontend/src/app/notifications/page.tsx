"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BellOff, CheckCheck, Loader2, Settings2, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { CATEGORY_META, NotificationRow } from "@/components/notifications/notificationUi";
import { useOpenNotification } from "@/components/notifications/useOpenNotification";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { cn } from "@/lib/utils";
import { clearRead, dismiss, loadMore, markAllRead, refreshNotifications, useNotifications, type NotificationCategory } from "@/lib/notifications";

type Filter = "all" | "unread" | NotificationCategory;

/**
 * Every notification, not just the latest eight: filter by unread or by kind, mark everything read, clear the ones you
 * have dealt with, and page back through older ones. The same live store as the bell, so it fills in by itself while
 * the page is open. Shared by every role — the notifications are each person's own.
 */
export default function NotificationsPage() {
  const { user, status } = useAuthGuard();
  const { items, unread, status: loadStatus, nextBefore, loadingMore } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const openNotification = useOpenNotification();

  useEffect(() => {
    void refreshNotifications();
  }, []);

  const categories = useMemo(() => Array.from(new Set(items.map((n) => n.category))), [items]);
  const shown = useMemo(
    () => items.filter((n) => (filter === "all" ? true : filter === "unread" ? !n.read : n.category === filter)),
    [items, filter]
  );
  const hasRead = items.some((n) => n.read);

  if (status !== "ready" || !user) return <SessionLoader />;

  return (
    <DashboardShell role={user.role} currentTpoView={user.role === "admin_tpo" ? "tpo" : "mellow"} title="Notifications" subtitle="Everything that happened, newest first.">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Filter notifications" className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
            <FilterChip active={filter === "unread"} onClick={() => setFilter("unread")} label="Unread" count={unread} />
            {categories.map((c) => (
              <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)} label={CATEGORY_META[c]?.label ?? c} />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unread === 0}
              className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-2xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
            <button
              type="button"
              onClick={() => void clearRead()}
              disabled={!hasRead}
              className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-2xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear read
            </button>
            <Link
              href="/settings?tab=notifications"
              aria-label="Notification settings"
              title="Notification settings"
              className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-border-subtle bg-surface text-text-muted transition-colors hover:text-primary"
            >
              <Settings2 className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-panel border border-border-subtle bg-surface p-2 shadow-subtle">
          {loadStatus === "loading" && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your notifications…
            </div>
          ) : loadStatus === "error" && items.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-xs font-semibold text-primary">Couldn&apos;t load your notifications</p>
              <button type="button" onClick={() => void refreshNotifications()} className="mt-3 rounded-control border border-border-subtle bg-elevated px-3 py-1.5 text-2xs font-bold text-text-secondary hover:text-primary">
                Try again
              </button>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle bg-elevated text-text-muted">
                <BellOff className="h-5 w-5" />
              </span>
              <p className="text-sm font-bold text-primary">{filter === "all" ? "You're all caught up" : "Nothing here"}</p>
              <p className="max-w-xs text-xs leading-relaxed text-text-muted">
                {filter === "all" ? "New drives, hackathons, tests and plan updates will show up here the moment they happen." : "No notifications match this filter."}
              </p>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((n) => (
                <NotificationRow key={n.id} notification={n} onOpen={openNotification} onDismiss={(x) => void dismiss(x.id)} />
              ))}
            </ul>
          )}

          {nextBefore !== null && (
            <div className="flex justify-center border-t border-border-subtle p-3">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-control border border-border-subtle bg-elevated px-4 py-1.5 text-2xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="h-3 w-3 animate-spin" />} {loadingMore ? "Loading…" : "Load older"}
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-2xs font-semibold transition-colors",
        active ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-surface text-text-secondary hover:bg-surface-hover hover:text-primary"
      )}
    >
      {label}
      {count !== undefined && count > 0 && <span className="rounded-full bg-status-danger px-1.5 text-3xs font-bold leading-4 text-white">{count > 99 ? "99+" : count}</span>}
    </button>
  );
}
