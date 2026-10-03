"use client";

/**
 * Screening-surface primitives for the Hiring Partner portal's evaluation
 * screens (Assessments, AI Interviews, Proctoring, Soft Skills and their
 * modals). Built strictly on top of kit.tsx — same tokens, same tones, same
 * motion curve — for the few patterns the shared kit doesn't carry: a
 * checkable candidate row, an inline notice, a segmented form control, a
 * calendar date tile, a compact metric tile and a list-reveal wrapper.
 */

import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HP_TONES, HpAvatar, HpIconTile, HpSkeleton, hpEase, type HpTone } from "@/components/portal/kit";

/* ── Time helpers ───────────────────────────────────────────────────────── */

/** "45m", "2h 30m", "3d 4h" — a compact span for windows and countdowns. */
export function formatSpan(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

/** "in 2h 15m" / "3d ago" / "just now" relative to `now`. Past spans are coarsened to their largest unit. */
export function formatRelative(target: Date, now: Date = new Date()): string {
  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < 60000) return diff >= 0 ? "in under a minute" : "just now";
  if (diff > 0) return `in ${formatSpan(abs)}`;
  const mins = Math.round(abs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ── Calendar date tile ─────────────────────────────────────────────────── */

export function ScDateTile({ date, tone = "indigo", className }: { date: Date; tone?: HpTone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-12 w-12 shrink-0 flex-col overflow-hidden rounded-[14px] border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] text-center shadow-[0_1px_2px_rgba(39,47,92,0.06),0_6px_14px_-8px_rgba(39,47,92,0.25)]",
        className
      )}
    >
      <span className={cn("py-[3px] text-3xs font-bold uppercase leading-none tracking-[0.1em] text-white", HP_TONES[tone].bar)}>
        {date.toLocaleString("en-IN", { month: "short" })}
      </span>
      <span className="tabular flex flex-1 items-center justify-center text-lg font-extrabold leading-none tracking-tight text-primary">
        {date.getDate()}
      </span>
    </span>
  );
}

/* ── Inline meta / metric ───────────────────────────────────────────────── */

/** One "icon + text" fact in a card's meta line. */
export function ScMeta({ icon: Icon, children, className }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-2xs font-medium text-text-muted", className)}>
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Compact labelled number tile used inside list cards. */
export function ScMetric({
  icon: Icon,
  label,
  value,
  tone,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: HpTone;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border-subtle bg-elevated/50 px-3 py-2.5 transition-colors duration-200 group-hover:bg-elevated/80", className)}>
      <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
        <Icon className={cn("h-3 w-3 shrink-0", tone && HP_TONES[tone].text)} aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <div className="tabular mt-1 truncate text-sm font-extrabold tracking-tight text-primary">{value}</div>
    </div>
  );
}

/* ── Notice ─────────────────────────────────────────────────────────────── */

const NOTICE_TONES = {
  indigo: "border-indigo-500/20 bg-indigo-500/[0.06]",
  amber: "border-amber-500/25 bg-amber-500/[0.07]",
  rose: "border-rose-500/25 bg-rose-500/[0.07]",
  emerald: "border-emerald-500/25 bg-emerald-500/[0.07]",
  violet: "border-violet-500/20 bg-violet-500/[0.06]",
} as const;

/** Soft tinted inline message — info (indigo), attention (amber), error (rose). */
export function ScNotice({
  tone = "indigo",
  icon,
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof NOTICE_TONES;
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = icon ?? (tone === "rose" || tone === "amber" ? AlertTriangle : Info);
  return (
    <div
      role={tone === "rose" ? "alert" : undefined}
      className={cn("flex items-start gap-3 rounded-2xl border px-3.5 py-3", NOTICE_TONES[tone], className)}
    >
      <Icon className={cn("mt-px h-4 w-4 shrink-0", HP_TONES[tone].text)} aria-hidden />
      <div className="min-w-0 flex-1 text-2xs leading-relaxed text-text-secondary">
        {title && <p className="text-xs font-bold text-primary">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/* ── Checkable candidate row ────────────────────────────────────────────── */

/**
 * A selectable person row: real (visually hidden) checkbox for a11y and
 * keyboard, a custom animated box, an avatar, and optional leading/trailing
 * slots (rank, score, stage pill).
 */
export function ScCheckRow({
  name,
  detail,
  checked,
  onChange,
  disabled = false,
  leading,
  trailing,
  className,
}: {
  name: string;
  detail?: ReactNode;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all duration-200",
        disabled
          ? "cursor-not-allowed border-border-subtle bg-elevated/30 opacity-60"
          : checked
          ? "cursor-pointer border-indigo-500/40 bg-indigo-500/[0.06] shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
          : "cursor-pointer border-border-subtle bg-[rgb(var(--bg-surface-rgb))] hover:border-indigo-500/25 hover:bg-elevated/50",
        className
      )}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={onChange} disabled={disabled} />
      <span
        aria-hidden
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))]",
          checked
            ? "border-transparent bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_10px_-4px_rgba(99,102,241,0.8)]"
            : "border-border-strong bg-[rgb(var(--bg-surface-rgb))] group-hover:border-indigo-500/40"
        )}
      >
        <Check className={cn("h-3 w-3 transition-transform duration-200", checked ? "scale-100" : "scale-0")} strokeWidth={3.2} />
      </span>
      {leading}
      <HpAvatar name={name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-13 font-semibold text-primary">{name}</span>
        {detail && <span className="block truncate text-2xs text-text-muted">{detail}</span>}
      </span>
      {trailing}
    </label>
  );
}

/* ── Icon button ────────────────────────────────────────────────────────── */

export interface ScIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  tone?: "neutral" | "accent" | "danger";
  spinning?: boolean;
}

/** Square icon-only action with an accessible label and a tinted hover per intent. */
export const ScIconButton = forwardRef<HTMLButtonElement, ScIconButtonProps>(function ScIconButton(
  { icon: Icon, label, tone = "neutral", spinning = false, className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-text-muted transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-90 disabled:pointer-events-none disabled:opacity-50",
        tone === "danger"
          ? "hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300"
          : tone === "accent"
          ? "hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-300"
          : "hover:bg-elevated hover:text-primary",
        className
      )}
      {...props}
    >
      <Icon className={cn("h-4 w-4", spinning && "animate-spin")} aria-hidden />
    </button>
  );
});

/* ── Inline empty / skeleton (for modal bodies) ─────────────────────────── */

export function ScInlineEmpty({
  icon,
  title,
  description,
  tone = "indigo",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  tone?: HpTone;
  className?: string;
}) {
  return (
    <div className={cn("relative flex flex-col items-center overflow-hidden rounded-2xl border border-dashed border-border-strong bg-elevated/30 px-6 py-10 text-center", className)}>
      <div aria-hidden className="hp-dots pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(55%_70%_at_50%_35%,#000,transparent)]" />
      <HpIconTile icon={icon} tone={tone} size="lg" className="relative" />
      <p className="relative mt-4 text-sm font-bold tracking-tight text-primary">{title}</p>
      {description && <p className="relative mt-1 max-w-sm text-2xs leading-relaxed text-text-muted">{description}</p>}
    </div>
  );
}

export function ScSkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border-subtle px-3 py-3">
          <HpSkeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <HpSkeleton className="h-3 w-1/3" />
            <HpSkeleton className="h-2.5 w-1/2" />
          </div>
          <HpSkeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ── Segmented form control ─────────────────────────────────────────────── */

/** A single-choice segmented control for forms (aria-pressed buttons, gliding gradient pill). Buttons are type="button" so it's safe inside a <form>. */
export function ScSegmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}) {
  const gid = useId();
  const reduce = useReducedMotion();
  return (
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full items-center gap-1 rounded-[14px] border border-border-subtle bg-elevated/70 p-1", className)}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative cursor-pointer rounded-[10px] px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              active ? "text-white" : "text-text-muted hover:text-primary"
            )}
          >
            {active && (
              <motion.span
                layoutId={`sc-seg-${gid}`}
                className="absolute inset-0 rounded-[10px] bg-gradient-to-b from-indigo-500 to-violet-600 shadow-[0_6px_14px_-6px_rgba(99,102,241,0.8)]"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Risk meter ─────────────────────────────────────────────────────────── */

/** Three-segment severity meter. `level` is 1–3. */
export function ScRiskMeter({ level, tone, className }: { level: 1 | 2 | 3; tone: HpTone; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1", className)} aria-hidden>
      {[1, 2, 3].map((i) => (
        <span key={i} className={cn("h-1.5 w-5 rounded-full transition-colors duration-300", i <= level ? HP_TONES[tone].fill : "bg-border-strong")} />
      ))}
    </span>
  );
}

/* ── List reveal ────────────────────────────────────────────────────────── */

/**
 * Wrap each item of an AnimatePresence list: rises in on mount (staggered
 * by index), collapses out on removal, and glides when siblings reorder.
 * Falls back to an instant render under prefers-reduced-motion.
 */
export const ScReveal = forwardRef<HTMLDivElement, { children: ReactNode; index?: number; className?: string; id?: string }>(function ScReveal(
  { children, index = 0, className, id },
  ref
) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      id={id}
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, transition: { duration: 0.18 } }}
      transition={{ duration: 0.4, ease: hpEase, delay: reduce ? 0 : Math.min(index, 8) * 0.04 }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

/** Height-collapsing panel for expand/collapse regions (wrap in AnimatePresence). */
export function ScCollapse({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      id={id}
      initial={reduce ? false : { height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
      transition={{ duration: 0.3, ease: hpEase }}
      className={cn("overflow-hidden", className)}
    >
      {children}
    </motion.div>
  );
}
