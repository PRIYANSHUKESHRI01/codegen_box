"use client";

import { useEffect } from "react";
import { X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
} as const;

export interface ModalProps {
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Bg + text classes for the icon's badge, e.g. "bg-teal-500/10 text-teal-500". */
  iconClassName?: string;
  size?: keyof typeof SIZE_CLASSES;
  /** Right-aligned action row, pinned below the scrollable body. Omit for a body that provides its own inline actions. */
  footer?: React.ReactNode;
  /** False for a destructive/multi-step flow where an accidental outside click shouldn't lose progress. */
  closeOnBackdrop?: boolean;
  /** False hides the header's X entirely and disables Escape-to-close, for a step the user must not be able to abandon (e.g. mid-way through a forced password reset). Leave `closeOnBackdrop` false too in that case — the two are independent, but a flow with no visible close button almost always wants no backdrop-dismiss either. */
  showCloseButton?: boolean;
  /** Overrides the body's default `px-6 py-5 text-xs` — for edge-to-edge content (a code viewer, a data table) that needs to manage its own padding. */
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * The one modal shell for the app. Exists because every hand-rolled modal
 * used `items-center` to vertically center itself *and* relied on the page
 * scrolling for overflow — a combination that clips the top of any dialog
 * taller than the viewport (the browser has no way to scroll to negative
 * flex offset), which is exactly what cut off the header on tall forms like
 * "Schedule Drive". This shell sidesteps that entirely: the outer layer
 * scrolls, an inner `min-h-full` flex wrapper does the centering without
 * clipping, and the card itself caps its own height and scrolls its body
 * internally — so the header and footer stay pinned and visible no matter
 * how long the form gets.
 */
export function Modal({
  onClose,
  title,
  subtitle,
  icon: Icon,
  iconClassName = "bg-accent-primary/10 text-accent-primary",
  size = "lg",
  footer,
  closeOnBackdrop = true,
  showCloseButton = true,
  bodyClassName,
  children,
}: ModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showCloseButton) onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, showCloseButton]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div className="flex min-h-full items-center justify-center p-4 py-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-full flex flex-col max-h-[calc(100vh-4rem)] rounded-panel bg-surface border border-border-strong shadow-card animate-modal-in",
            SIZE_CLASSES[size]
          )}
        >
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <span className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconClassName)}>
                  <Icon className="w-4 h-4" />
                </span>
              )}
              <div className="min-w-0">
                <h3 id="modal-title" className="text-base font-bold text-primary truncate">
                  {title}
                </h3>
                {subtitle && <p className="text-2xs text-text-muted truncate mt-0.5">{subtitle}</p>}
              </div>
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-elevated transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className={cn("overflow-y-auto grow", bodyClassName ?? "px-6 py-5 text-xs")}>{children}</div>

          {footer && (
            <div className="px-6 py-4 border-t border-border-subtle shrink-0 flex items-center justify-end gap-2">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
