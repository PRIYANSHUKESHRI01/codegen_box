"use client";

/**
 * Small hiring-portal primitives shared by the Job Openings, Partner
 * Colleges and Candidates screens (and their modals) that the core kit
 * (./kit.tsx) doesn't carry: a soft error card with retry, a styled native
 * select, a switch, an inline callout and a custom checkbox. Pure
 * presentation — every one of them forwards the caller's own handlers.
 */

import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertCircle, Check, ChevronDown, RotateCw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HpButton, hpInput } from "@/components/portal/kit";

/* ── Error card ─────────────────────────────────────────────────────────── */

export function HpErrorCard({
  message,
  onRetry,
  className,
}: {
  message: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-[20px] border border-rose-500/20 bg-gradient-to-r from-rose-500/[0.08] via-rose-500/[0.04] to-transparent p-4 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300">
          <AlertCircle className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-13 font-semibold text-primary">Something went wrong</p>
          <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">{message}</p>
        </div>
      </div>
      {onRetry && (
        <HpButton variant="danger" size="sm" onClick={onRetry} leftIcon={<RotateCw className="h-3.5 w-3.5" />} className="self-start sm:self-auto">
          Retry
        </HpButton>
      )}
    </div>
  );
}

/** Inline field / form error line (inside modals and panels). */
export function HpFormError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3 py-2.5 text-2xs font-medium leading-relaxed text-rose-700 dark:text-rose-300",
        className
      )}
    >
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/* ── Select ─────────────────────────────────────────────────────────────── */

export interface HpSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
  /** Element pinned inside the left edge (e.g. a status dot); the select pads for it. */
  leading?: ReactNode;
  /** "sm" is the dense inline-control size used in card footers and table rows. */
  inputSize?: "sm" | "md";
}

export const HpSelect = forwardRef<HTMLSelectElement, HpSelectProps>(function HpSelect(
  { wrapperClassName, leading, inputSize = "md", className, children, ...props },
  ref
) {
  return (
    <div className={cn("group/select relative", wrapperClassName)}>
      {leading && <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center">{leading}</span>}
      <select
        ref={ref}
        className={cn(
          hpInput,
          "cursor-pointer appearance-none truncate pr-9 font-semibold",
          inputSize === "sm" ? "h-8 rounded-[10px] py-0 text-xs" : "h-10 py-0",
          leading ? "pl-8" : inputSize === "sm" ? "pl-3" : "",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted transition-colors group-focus-within/select:text-indigo-500" />
    </div>
  );
});

/* ── Switch ─────────────────────────────────────────────────────────────── */

export function HpSwitch({
  checked,
  onChange,
  disabled,
  label,
  title,
  className,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      title={title}
      className={cn(
        "group/switch inline-flex select-none items-center gap-2.5 rounded-full py-1 pl-1 pr-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "text-teal-700 dark:text-teal-300" : "text-text-secondary hover:text-primary",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 ring-inset transition-colors duration-300",
          checked ? "bg-gradient-to-r from-teal-400 to-cyan-500 ring-teal-500/30" : "bg-elevated ring-border-strong group-hover/switch:ring-indigo-500/30"
        )}
      >
        <span
          className={cn(
            "absolute left-0.5 h-4 w-4 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/* ── Callout ────────────────────────────────────────────────────────────── */

const CALLOUT_TONES = {
  indigo: { box: "border-indigo-500/20 bg-indigo-500/[0.05]", icon: "text-indigo-600 dark:text-indigo-300" },
  teal: { box: "border-teal-500/20 bg-teal-500/[0.05]", icon: "text-teal-600 dark:text-teal-300" },
  amber: { box: "border-amber-500/25 bg-amber-500/[0.06]", icon: "text-amber-600 dark:text-amber-300" },
} as const;

export function HpCallout({
  icon: Icon,
  tone = "indigo",
  children,
  className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof CALLOUT_TONES;
  children: ReactNode;
  className?: string;
}) {
  const t = CALLOUT_TONES[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-2xs leading-relaxed text-text-secondary", t.box, className)}>
      <Icon className={cn("mt-px h-4 w-4 shrink-0", t.icon)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ── Checkbox visual ────────────────────────────────────────────────────── */

/**
 * The visible box for a native checkbox rendered as `className="peer sr-only"`
 * immediately before it — so the real input keeps keyboard + screen-reader
 * semantics and this just paints the state.
 */
export function HpCheckboxBox({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-surface",
        checked
          ? "border-transparent bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-[0_4px_10px_-4px_rgba(79,70,229,0.7)]"
          : "border-border-strong bg-[rgb(var(--bg-surface-rgb))]",
        className
      )}
    >
      <Check className={cn("h-3 w-3 transition-transform duration-200", checked ? "scale-100" : "scale-0")} strokeWidth={3.2} />
    </span>
  );
}
