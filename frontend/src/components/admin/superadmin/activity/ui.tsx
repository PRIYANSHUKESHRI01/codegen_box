"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { Loader2, Monitor, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityRole, CollegeStatus } from "@/types/activity";
import { ROLE_NAME, ROLE_TONE, STATE_META, span } from "./format";

export function RoleChip({ role }: { role: ActivityRole | null | undefined }) {
  if (!role) return null;
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-3xs font-bold", ROLE_TONE[role])}>{ROLE_NAME[role]}</span>;
}

export function StateBadge({ state, label, className }: { state: CollegeStatus; label?: string; className?: string }) {
  const meta = STATE_META[state];
  return (
    <span title={meta.hint} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-3xs font-bold", meta.tone, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {label ?? meta.label}
    </span>
  );
}

/** A pulsing green dot: "on the platform right now". */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

export function DeviceIcon({ device, className }: { device: string | null; className?: string }) {
  const Icon = device === "mobile" ? Smartphone : device === "tablet" ? Tablet : Monitor;
  return <Icon className={cn("h-3.5 w-3.5 text-text-muted", className)} aria-label={device ?? "device"} />;
}

export function Card({ title, subtitle, action, children, className }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-bold text-primary">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-2xs text-text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "bg-accent-primary/10 text-accent-primary",
  live = false,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  tone?: string;
  live?: boolean;
  onClick?: () => void;
}) {
  const isClickable = Boolean(onClick);

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={isClickable ? (e) => (e.key === "Enter" || e.key === " ") && onClick?.() : undefined}
      className={cn(
        "flex flex-col justify-between rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle transition-all text-left",
        isClickable && "cursor-pointer hover:border-accent-primary/60 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 group focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">
          {live && <LiveDot />}
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {Icon && (
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-control transition-transform", tone, isClickable && "group-hover:scale-105")}>
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-mono text-2xl font-black tracking-tight text-primary">{value}</div>
          {isClickable && (
            <span className="text-3xs font-semibold text-text-muted group-hover:text-accent-primary transition-colors">
              View list &rarr;
            </span>
          )}
        </div>
        {sub && <div className="mt-1 text-2xs font-medium text-text-muted">{sub}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-10 text-xs text-text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-status-danger/25 bg-status-danger/10 p-4 text-xs text-status-danger">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-control border border-status-danger/30 px-3 py-1 font-bold hover:bg-status-danger/10">
          Retry
        </button>
      )}
    </div>
  );
}

/** A segmented control: one choice of several, drawn like the page's own tab strip. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex w-fit flex-wrap items-center gap-1 rounded-control border border-border-subtle bg-elevated p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn("whitespace-nowrap rounded-control px-3 py-1 text-2xs font-bold transition-colors", value === o.id ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ charts

/**
 * Plain bars, one per point, with the value on hover and the labels spaced out underneath. Drawn with divs so it scales with its card,
 * reads in light and dark, and needs no charting library.
 */
export function Bars({
  points,
  height = 120,
  color = "bg-indigo-500",
  highlightLast = true,
  labelEvery = 1,
  ariaLabel,
}: {
  points: { label: string; value: number; title?: string; accent?: boolean }[];
  height?: number;
  color?: string;
  highlightLast?: boolean;
  labelEvery?: number;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="relative flex items-end gap-[3px]" style={{ height }}>
        {points.map((p, i) => (
          <div
            key={`${p.label}-${i}`}
            className="group relative flex h-full flex-1 items-end"
            title={p.title ?? `${p.label}: ${p.value}`}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className={cn("w-full rounded-t-[3px] transition-opacity", p.accent || (highlightLast && i === points.length - 1) ? color : `${color}/55`, hover !== null && hover !== i && "opacity-60")}
              style={{ height: `${p.value === 0 ? 2 : Math.max(4, (p.value / max) * 100)}%` }}
            />
          </div>
        ))}
        {hover !== null && (
          <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-control bg-primary px-2 py-0.5 text-3xs font-bold text-background shadow-card">
            {points[hover].title ?? `${points[hover].label}: ${points[hover].value}`}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-3xs text-text-muted" aria-hidden>
        {points.map((p, i) => (
          <div key={`${p.label}-l-${i}`} className="flex-1 overflow-visible whitespace-nowrap text-center">
            {i % labelEvery === 0 ? p.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/** When people visit: weekday rows by hour columns, darker = more visits. */
export function Heatmap({ cells, max }: { cells: number[][]; max: number }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

  return (
    <div className="overflow-x-auto" role="img" aria-label="Visits by weekday and hour, India time">
      <div className="min-w-[34rem]">
        <div className="ml-9 grid grid-cols-24 gap-[2px] text-3xs text-text-muted" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center">
              {h % 3 === 0 ? hourLabel(h) : ""}
            </span>
          ))}
        </div>
        {cells.map((row, d) => (
          <div key={days[d]} className="mt-[2px] flex items-center gap-1.5">
            <span className="w-7 shrink-0 text-3xs font-semibold text-text-muted">{days[d]}</span>
            <div className="grid flex-1 gap-[2px]" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
              {row.map((n, h) => (
                <span
                  key={h}
                  title={`${days[d]} ${hourLabel(h)}: ${n} visit${n === 1 ? "" : "s"}`}
                  className="aspect-square rounded-[3px] bg-indigo-500"
                  style={{ opacity: n === 0 ? 0.06 : 0.18 + (n / max) * 0.82 }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** How far down a screen people read: a small bar with the number beside it. */
export function ScrollMeter({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={value > 0 ? `Scrolled ${value}% of the way down` : "Did not scroll"}>
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-elevated">
        <span className="block h-full rounded-full bg-cyan-500" style={{ width: `${value}%` }} />
      </span>
      <span className="w-8 font-mono text-3xs text-text-muted">{value > 0 ? `${value}%` : "—"}</span>
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-control border border-dashed border-border-strong px-4 py-8 text-center text-2xs text-text-muted">{children}</p>;
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("py-2 pr-3 text-left text-3xs font-bold uppercase tracking-wider text-text-muted", className)}>{children}</th>;
}

export function TimeSpent({ seconds }: { seconds: number }) {
  return <span className="tabular-nums">{span(seconds)}</span>;
}
