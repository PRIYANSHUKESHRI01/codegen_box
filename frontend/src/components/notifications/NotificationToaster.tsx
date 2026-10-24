"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBellOpen, markRead, safeInternalPath, subscribeToArrivals, subscribeToBellOpen, type AppNotification } from "@/lib/notifications";
import { NotificationIcon, SEVERITY_STYLE } from "./notificationUi";

const MAX_TOASTS = 3;
const SHOW_MS = 8_000;
const SHOW_LONG_MS = 12_000;

/** Pages where nothing may interrupt: a proctored attempt owns the whole screen (see DashboardShell's hideChrome). */
const QUIET_PATHS = ["/dashboard/contests/problem", "/dashboard/core/session", "/dashboard/interviews/session", "/dashboard/soft-skills/session"];

interface Toast {
  key: string;
  notification: AppNotification | null;
  /** A summary toast ("5 new notifications") when too many arrived at once to show one by one. */
  summary?: { count: number };
}

/**
 * The "it just happened" layer: when a notification arrives while the page is open, a small card slides in at the top
 * right — click it to go there, or ignore it and it leaves by itself (it stays in the bell either way). Hovering or
 * focusing a card holds it. If a lot arrives at once (a laptop waking after an hour) it collapses to one summary card
 * instead of a pile. Silent on proctored exam pages.
 */
export function NotificationToaster() {
  const router = useRouter();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const quiet = QUIET_PATHS.some((p) => pathname?.startsWith(p));
  const quietRef = useRef(quiet);
  quietRef.current = quiet;

  useEffect(
    () =>
      subscribeToArrivals((items) => {
        // Nothing on proctored pages; nothing while the bell is open (the list is updating in front of them).
        if (quietRef.current || isBellOpen() || items.length === 0) return;

        const next: Toast[] =
          items.length > MAX_TOASTS
            ? [{ key: `summary-${items[0].id}`, notification: null, summary: { count: items.length } }]
            : items.map((n) => ({ key: `n-${n.id}`, notification: n }));

        setToasts((prev) => [...next, ...prev].slice(0, MAX_TOASTS + 1));
      }),
    []
  );

  // Opening the bell clears whatever is showing: the popover sits where the toasts do.
  useEffect(() => subscribeToBellOpen((open) => open && setToasts([])), []);

  const remove = useCallback((key: string) => setToasts((prev) => prev.filter((t) => t.key !== key)), []);

  const open = (toast: Toast) => {
    const n = toast.notification;
    remove(toast.key);

    if (!n) {
      router.push("/notifications");
      return;
    }
    void markRead(n.id);
    const path = safeInternalPath(n.url);
    if (path) router.push(path);
  };

  return (
    <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed right-3 top-[4.5rem] z-[80] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 sm:right-5">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard key={toast.key} toast={toast} onOpen={() => open(toast)} onClose={() => remove(toast.key)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ toast, onOpen, onClose }: { toast: Toast; onOpen: () => void; onClose: () => void }) {
  const n = toast.notification;
  const [held, setHeld] = useState(false);
  const duration = n && (n.severity === "warning" || n.severity === "critical") ? SHOW_LONG_MS : SHOW_MS;

  useEffect(() => {
    if (held) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [held, duration, onClose]);

  const style = SEVERITY_STYLE[n?.severity ?? "info"];

  return (
    <motion.div
      layout
      role="status"
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      className="pointer-events-auto relative overflow-hidden rounded-panel border border-border-strong bg-surface shadow-card"
    >
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", style.bar)} />
      <div className="flex items-start gap-3 py-3 pl-4 pr-3">
        {n ? (
          <NotificationIcon notification={n} />
        ) : (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent-primary/25 bg-accent-primary/10 text-accent-primary">
            <Bell className="h-4 w-4" />
          </span>
        )}
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary">
          <span className="block text-xs font-bold leading-snug text-primary">{n ? n.title : `${toast.summary?.count} new notifications`}</span>
          <span className="mt-0.5 line-clamp-2 block text-2xs leading-relaxed text-text-secondary">{n ? n.body : "Open your notifications to see what you missed."}</span>
        </button>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
