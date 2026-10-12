"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import "@/app/arena/detail.css";

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ArenaDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** False while a request is in flight, so Escape / backdrop clicks can't abandon it half-done. */
  dismissible?: boolean;
  /** A glyph for the header medallion — what this dialog is about, at a glance. */
  icon?: ReactNode;
  /** "danger" tints the medallion rose for destructive confirmations. */
  tone?: "accent" | "danger";
}

/**
 * The arena's modal. Locks page scroll, traps Tab inside, closes on Escape / backdrop, and hands
 * focus back to whatever opened it. It renders inside `.arena-root` (not a portal) so it inherits
 * the page's accent colours and design tokens. It arrives with a spring (a bottom sheet on phones)
 * over a blurred backdrop; under reduced motion it simply fades.
 */
export function ArenaDialog({ open, onClose, title, description, children, footer, size = "md", dismissible = true, icon, tone = "accent" }: ArenaDialogProps) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the first field (not the close button) so typing can start straight away.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const first = panel?.querySelector<HTMLElement>("[data-autofocus], input, textarea, select") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      returnTo.current?.focus?.();
    };
  }, [open, onClose, dismissible]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[65] overflow-y-auto bg-[#03040a]/70 backdrop-blur-md"
          onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}
        >
          <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6" onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose()}>
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descId : undefined}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 44, scale: 0.94 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.16 } }}
              transition={{ type: "spring", stiffness: 360, damping: 28, mass: 0.9 }}
              className={cn(
                "dt-dialog relative w-full overflow-hidden rounded-t-[28px] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[28px] sm:p-7",
                "max-h-[92dvh] overflow-y-auto",
                size === "sm" && "sm:max-w-md",
                size === "md" && "sm:max-w-lg",
                size === "lg" && "sm:max-w-2xl"
              )}
            >
              <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-white/20 sm:hidden" />

              <button
                type="button"
                onClick={onClose}
                disabled={!dismissible}
                aria-label="Close"
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--ar-text-3)] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <X className="h-[18px] w-[18px]" aria-hidden />
              </button>

              <div className="flex items-start gap-4 pr-9">
                {icon && (
                  <span
                    className={cn(
                      "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 shadow-[0_16px_30px_-14px_var(--dlg-glow)]",
                      tone === "danger" ? "bg-rose-500/15 text-rose-200 ring-rose-300/35 [--dlg-glow:rgba(244,63,94,0.7)]" : "bg-gradient-to-br from-[rgb(var(--ar-a)/0.45)] to-[rgb(var(--ar-b)/0.3)] text-white ring-white/25 [--dlg-glow:rgb(var(--ar-a)/0.8)]"
                    )}
                  >
                    {icon}
                  </span>
                )}
                <div className="min-w-0">
                  <h2 id={titleId} className="text-[20px] font-bold leading-snug tracking-[-0.02em] text-white">
                    {title}
                  </h2>
                  {description && (
                    <p id={descId} className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--ar-text-2)]">
                      {description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6">{children}</div>

              {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
