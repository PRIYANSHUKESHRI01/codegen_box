"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { dismissToast, useToastItems, type ToastItem, type ToastTone } from "@/lib/toast";

/** Full literal class strings, because Tailwind only emits the classes it can see in source. */
const TONE: Record<ToastTone, { icon: LucideIcon; tile: string; edge: string; wash: string; bar: string; action: string; label: string }> = {
  success: {
    icon: CheckCircle2,
    tile: "border-status-success/25 bg-status-success/[0.12] text-status-success",
    edge: "bg-status-success",
    wash: "from-status-success/[0.09]",
    bar: "bg-status-success/70",
    action: "text-status-success",
    label: "Success",
  },
  error: {
    icon: XCircle,
    tile: "border-status-danger/25 bg-status-danger/[0.12] text-status-danger",
    edge: "bg-status-danger",
    wash: "from-status-danger/[0.09]",
    bar: "bg-status-danger/70",
    action: "text-status-danger",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    tile: "border-status-warning/30 bg-status-warning/[0.14] text-status-warning",
    edge: "bg-status-warning",
    wash: "from-status-warning/[0.10]",
    bar: "bg-status-warning/70",
    action: "text-status-warning",
    label: "Warning",
  },
  info: {
    icon: Info,
    tile: "border-accent-secondary/25 bg-accent-secondary/[0.12] text-accent-secondary",
    edge: "bg-accent-secondary",
    wash: "from-accent-secondary/[0.09]",
    bar: "bg-accent-secondary/70",
    action: "text-accent-secondary",
    label: "Notice",
  },
};

/** Never dismiss sooner than this after the pointer leaves — a toast that vanishes the instant you let go of it feels broken. */
const GRACE_MS = 1_200;

/**
 * Renders the feedback toasts raised through `lib/toast` (`toast.success("Saved")`, or a page's `triggerToast`).
 * Mounted once, in the root layout, so a toast can be raised from anywhere and always sits above the page's modals
 * and drawers. Bottom-right on a desktop (the top-right belongs to the notification bell's own toasts), a full-width
 * stack along the bottom on a phone.
 *
 * What it does so the callers do not have to: errors announce themselves assertively and stay longer; hovering,
 * focusing or tabbing away pauses the clock; the same message raised twice shows "×2" instead of stacking a twin;
 * the stack is capped; Escape and swipe both dismiss; reduced-motion users get a plain fade.
 */
export function Toaster() {
  const items = useToastItems();

  return (
    <div
      role="region"
      aria-label="Notifications"
      // --toast-offset-bottom: a page with its own fixed bottom bar (the Arena's phone tab bar) publishes its height here so the stack rides above it.
      className="pointer-events-none fixed inset-x-3 bottom-[calc(0.75rem+var(--toast-offset-bottom,0px))] z-[130] flex flex-col items-stretch gap-2.5 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-[calc(1.25rem+var(--toast-offset-bottom,0px))] sm:right-5 sm:w-[min(25rem,calc(100vw-2.5rem))]"
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const { id, tone, message, title, duration, action, count, revision } = item;
  const style = TONE[tone];
  const Icon = item.icon ?? style.icon;
  const reduceMotion = useReducedMotion();

  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const paused = hovered || hidden;
  const sticky = !Number.isFinite(duration);

  // Swiping is a phone gesture; on a desktop it would only fight with selecting the text.
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // A background tab should not burn through the message before anyone has seen it.
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The countdown survives pauses: how much is left is carried between runs of the timer effect below.
  const remaining = useRef(duration);
  const startedAt = useRef(0);

  useEffect(() => {
    remaining.current = duration;
  }, [revision, duration]);

  useEffect(() => {
    if (sticky || paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismissToast(id), Math.max(remaining.current, GRACE_MS));
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [id, sticky, paused, revision, duration]);

  const close = useCallback(() => dismissToast(id), [id]);

  const onDragEnd = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) close();
  };

  const body = (
    <>
      {title && <p className="text-xs font-bold leading-snug text-primary">{title}</p>}
      <p className={cn("whitespace-pre-line break-words text-xs leading-relaxed", title ? "mt-0.5 text-text-secondary" : "font-semibold text-primary")}>{message}</p>
    </>
  );

  return (
    <motion.div
      layout="position"
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      aria-atomic="true"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.96 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 28, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 460, damping: 34, mass: 0.9 }}
      drag={touch ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.5}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
      className="group pointer-events-auto relative overflow-hidden rounded-card border border-border-strong bg-surface shadow-[0_18px_44px_-14px_rgba(39,47,92,0.32),0_2px_8px_-2px_rgba(39,47,92,0.12)] dark:shadow-[0_18px_44px_-14px_rgba(0,0,0,0.75),0_2px_8px_-2px_rgba(0,0,0,0.4)]"
    >
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", style.edge)} />
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0 bg-gradient-to-r to-transparent to-60%", style.wash)} />

      <div className="relative flex items-start gap-3 py-3 pl-4 pr-2.5">
        <motion.span
          aria-hidden="true"
          initial={reduceMotion ? false : { scale: 0.55, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 520, damping: 18, delay: 0.05 }}
          className={cn("mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border", style.tile)}
        >
          <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
        </motion.span>

        <div className="min-w-0 flex-1 pt-1">
          <span className="sr-only">{style.label}: </span>
          {body}
          {action && (
            <div className="mt-2">
              {action.href ? (
                <Link
                  href={action.href}
                  onClick={() => {
                    action.onClick?.();
                    close();
                  }}
                  className={cn("inline-flex rounded-md text-2xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary", style.action)}
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    action.onClick?.();
                    close();
                  }}
                  className={cn("inline-flex rounded-md text-2xs font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary", style.action)}
                >
                  {action.label}
                </button>
              )}
            </div>
          )}
        </div>

        {count > 1 && (
          <span aria-label={`${count} times`} className="tabular mt-1 shrink-0 rounded-full border border-border-subtle bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary">
            ×{count}
          </span>
        )}

        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="mt-0.5 shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!sticky && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden motion-reduce:hidden">
          {/* Re-keyed on every re-raise so the bar restarts together with the timer. */}
          <span
            key={revision}
            className={cn("block h-full w-full origin-left animate-toast-progress", style.bar)}
            style={{ animationDuration: `${duration}ms`, animationPlayState: paused ? "paused" : "running" }}
          />
        </span>
      )}
    </motion.div>
  );
}
