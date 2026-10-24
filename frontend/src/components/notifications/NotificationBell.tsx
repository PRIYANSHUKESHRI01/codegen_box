"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, BellRing, CheckCheck, RefreshCw, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { markAllRead, dismiss, refreshNotifications, setBellOpen, subscribeToArrivals, useNotifications } from "@/lib/notifications";
import { NotificationRow } from "./notificationUi";
import { useOpenNotification } from "./useOpenNotification";

const VISIBLE_IN_POPOVER = 8;
const POPOVER_GUTTER = 12;
const RING_MS = 2_600;

function formatCount(n: number) {
  return n > 99 ? "99+" : String(n);
}

/**
 * The bell in every dashboard header: an unread badge that updates by itself, and a popover with the latest
 * notifications, mark-all-read, and links to the full list and to the settings. Opening it checks for news straight away.
 * While it is closed, a brief ring tells you something just arrived.
 */
export function NotificationBell() {
  const { status, items, unread } = useNotifications();
  const [open, setOpen] = useState(false);
  const [ringing, setRinging] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  // Where the popover goes, measured from the bell. It is portalled to <body> because the dashboard header clips
  // everything that overflows it (overflow-hidden, for its decorative glow) — inside it the popover was cut to a sliver.
  const [pos, setPos] = useState<{ top: number; right: number; narrow: boolean } | null>(null);

  const close = useCallback(() => setOpen(false), []);
  const openNotification = useOpenNotification(close);

  // A brief ring when something arrives while the bell is closed — the popover itself updates silently.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = subscribeToArrivals(() => {
      setRinging(true);
      clearTimeout(timer);
      timer = setTimeout(() => setRinging(false), RING_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, []);

  // Opening it is a "look now": check for news immediately rather than waiting for the next beat — and tell the toaster
  // to step aside, since it sits in the same corner.
  useEffect(() => {
    setBellOpen(open);
    if (open) void refreshNotifications();
    return () => setBellOpen(false);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.bottom + 8, right: Math.max(POPOVER_GUTTER, window.innerWidth - rect.right), narrow: window.innerWidth < 640 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!root.current?.contains(target) && !popover.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shown = items.slice(0, VISIBLE_IN_POPOVER);
  const label = unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

  return (
    <div className="relative" ref={root}>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-[10px] border transition-all duration-200 hover:scale-105 hover:border-accent-primary/40 hover:bg-surface-hover hover:text-accent-primary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
          open ? "border-accent-primary/40 bg-accent-primary/5 text-accent-primary ring-[6px] ring-accent-primary/[0.07]" : "border-border-subtle bg-surface text-text-muted"
        )}
        title="Notifications"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {ringing ? <BellRing className="h-4 w-4 animate-wiggle text-accent-primary" /> : <Bell className="h-4 w-4" />}
        {unread > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-danger px-1 text-3xs font-bold leading-none text-white ring-2 ring-surface"
          >
            {formatCount(unread)}
          </span>
        )}
      </button>

      {typeof document !== "undefined" &&
        createPortal(
      <AnimatePresence>
        {open && pos && (
          <motion.div
            ref={popover}
            // On a phone it spans the screen (the bell is mid-bar, a bell-anchored card would run off the left edge).
            style={pos.narrow ? { position: "fixed", top: pos.top, left: POPOVER_GUTTER, right: POPOVER_GUTTER } : { position: "fixed", top: pos.top, right: pos.right }}
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="z-[70] w-auto overflow-hidden sm:w-96 rounded-panel border border-border-strong bg-surface shadow-card"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary">Notifications</h2>
                {unread > 0 && <span className="rounded-full border border-accent-primary/20 bg-accent-primary/10 px-1.5 py-0.5 text-3xs font-bold text-accent-primary">{formatCount(unread)} new</span>}
              </div>
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={unread === 0}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs font-semibold text-accent-primary transition-colors hover:bg-accent-primary/10 disabled:cursor-default disabled:text-text-muted disabled:hover:bg-transparent"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            </div>

            <div className="max-h-[26rem] overflow-y-auto p-1.5">
              {status === "loading" && items.length === 0 ? (
                <ul aria-label="Loading notifications" className="space-y-1.5 p-1">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex animate-pulse items-start gap-3 rounded-control px-2 py-2">
                      <span className="h-9 w-9 shrink-0 rounded-xl bg-elevated" />
                      <span className="flex-1 space-y-2 pt-1">
                        <span className="block h-2.5 w-2/3 rounded bg-elevated" />
                        <span className="block h-2 w-full rounded bg-elevated" />
                      </span>
                    </li>
                  ))}
                </ul>
              ) : status === "error" && items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <p className="text-xs font-semibold text-primary">Couldn&apos;t load your notifications</p>
                  <button type="button" onClick={() => void refreshNotifications()} className="inline-flex items-center gap-1.5 rounded-control border border-border-subtle bg-elevated px-3 py-1.5 text-2xs font-bold text-text-secondary hover:text-primary">
                    <RefreshCw className="h-3 w-3" /> Try again
                  </button>
                </div>
              ) : shown.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle bg-elevated text-text-muted">
                    <BellOff className="h-5 w-5" />
                  </span>
                  <p className="text-xs font-bold text-primary">You&apos;re all caught up</p>
                  <p className="max-w-[16rem] text-2xs leading-relaxed text-text-muted">New drives, hackathons, tests and plan updates will show up here the moment they happen.</p>
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {shown.map((n) => (
                    <NotificationRow key={n.id} notification={n} onOpen={openNotification} onDismiss={(x) => void dismiss(x.id)} />
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border-subtle bg-elevated/50 px-4 py-2.5">
              <Link href="/notifications" onClick={close} className="text-2xs font-bold text-accent-primary hover:underline">
                {items.length > VISIBLE_IN_POPOVER ? `View all (${items.length}+)` : "View all"}
              </Link>
              <Link href="/settings?tab=notifications" onClick={close} className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-primary">
                <Settings2 className="h-3 w-3" /> Settings
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
          , document.body)}
    </div>
  );
}
