"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BarSeries {
  label: string;
  color: string; // CSS color value
}

interface BarChartProps {
  categories: string[];
  series: { label: string; color: string; values: number[] }[];
  height?: number;
  suffix?: string;
  maxValue?: number;
  /**
   * "premium" is the College TPO portal treatment (gridlines + y ticks,
   * capped rounded bars that grow in, cap value labels, hover/focus readout).
   * Default leaves the original look untouched for every other caller.
   */
  variant?: "default" | "premium";
  /** Accessible name for the chart (premium variant). */
  ariaLabel?: string;
}

/** Simple grouped/single vertical bar chart, no dependency, theme-aware. */
export function BarChart(props: BarChartProps) {
  if (props.variant === "premium") return <PremiumBarChart {...props} />;
  return <DefaultBarChart {...props} />;
}

function DefaultBarChart({ categories, series, height = 220, suffix = "%", maxValue }: BarChartProps) {
  const allValues = series.flatMap((s) => s.values);
  const max = maxValue ?? Math.ceil(Math.max(...allValues, 1) / 10) * 10;
  const groupWidth = 100 / categories.length;
  const barGap = 4;
  const barWidth = (groupWidth - barGap * 2) / series.length;

  return (
    <div className="w-full">
      <div className="flex items-end gap-0" style={{ height }}>
        {categories.map((cat, catIdx) => (
          <div
            key={cat}
            className="flex-1 flex items-end justify-center gap-1 h-full relative group"
            style={{ minWidth: 0 }}
          >
            {series.map((s) => {
              const value = s.values[catIdx] ?? 0;
              const pct = Math.min(100, (value / max) * 100);
              return (
                <div key={s.label} className="flex flex-col items-center justify-end h-full flex-1 relative">
                  <span className="text-3xs font-mono font-bold text-primary mb-1 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5">
                    {value}
                    {suffix}
                  </span>
                  <div
                    className="w-full rounded-t-[3px] transition-all duration-500 group-hover:brightness-110"
                    style={{ height: `${pct}%`, backgroundColor: s.color, minHeight: value > 0 ? 3 : 0 }}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-start gap-0 mt-2 pt-2 border-t border-border-subtle">
        {categories.map((cat) => (
          <div key={cat} className="flex-1 text-center text-3xs font-semibold text-text-muted truncate px-0.5">
            {cat}
          </div>
        ))}
      </div>

      {series.length > 1 && (
        <div className="flex items-center justify-center gap-4 mt-3">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-2xs text-text-secondary">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Premium variant ────────────────────────────────────────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Splits [0, max] into 2–5 equal steps, preferring whole-number ticks. */
function ticksFor(max: number): number[] {
  const divisions = [4, 5, 3, 2].find((d) => Number.isInteger(max / d)) ?? 4;
  return Array.from({ length: divisions + 1 }, (_, i) => (max / divisions) * i);
}

function fmtTick(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function PremiumBarChart({ categories, series, height = 220, suffix = "%", maxValue, ariaLabel }: BarChartProps) {
  const reduce = useReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  // Pointer wins while it's over the plot; otherwise keyboard focus keeps its readout.
  const active = hovered ?? focused;
  // Half the width of a group's bar cluster at full size — the readout sits just beside it.
  const clusterHalf = (series.length * 24 + (series.length - 1) * 2) / 2;

  const allValues = series.flatMap((s) => s.values);
  const max = maxValue ?? Math.ceil(Math.max(...allValues, 1) / 10) * 10;
  const ticks = ticksFor(max);
  // Selective direct labels: every cap while the chart stays sparse, only each
  // series' peak once it gets dense (the hover/focus readout carries the rest).
  const labelAll = categories.length * series.length <= 16;
  const peaks = series.map((s) => Math.max(0, ...s.values));

  return (
    <div className="w-full">
      <div className="flex gap-2">
        {/* Y ticks */}
        <div className="relative w-7 shrink-0" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className="tabular absolute right-0 translate-y-1/2 text-3xs font-medium leading-none text-text-muted"
              style={{ bottom: `${(t / max) * 100}%` }}
            >
              {fmtTick(t)}
            </span>
          ))}
        </div>

        {/* Plot */}
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {ticks.map((t, i) => (
            <span
              key={t}
              aria-hidden
              className={cn("absolute inset-x-0 h-px", i === 0 ? "bg-border-strong" : "bg-border-subtle")}
              style={{ bottom: `${(t / max) * 100}%` }}
            />
          ))}

          <div role="list" aria-label={ariaLabel} className="absolute inset-0 flex items-end" onMouseLeave={() => setHovered(null)}>
            {categories.map((cat, catIdx) => {
              const isActive = active === catIdx;
              const dimmed = active !== null && !isActive;
              const readout = series.map((s) => `${s.label} ${s.values[catIdx] ?? 0}${suffix}`).join(", ");
              // Left-half groups open their readout to the right of the bars, right-half groups to the left,
              // so it never covers the active bars, the card header, or the card edge.
              const opensRight = catIdx < categories.length / 2;
              return (
                <div
                  key={`${cat}-${catIdx}`}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${cat}: ${readout}`}
                  onMouseEnter={() => setHovered(catIdx)}
                  onFocus={() => setFocused(catIdx)}
                  onBlur={() => setFocused(null)}
                  className="group/bar relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center rounded-t-xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/60"
                >
                  {/* Hover band */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-x-[8%] bottom-0 top-0 rounded-t-xl bg-gradient-to-b from-indigo-500/[0.07] to-indigo-500/[0.02] transition-opacity duration-200",
                      isActive ? "opacity-100" : "opacity-0"
                    )}
                  />

                  {/* Readout */}
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute top-1 z-20 min-w-[8.5rem] rounded-xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-3 py-2 shadow-[0_12px_28px_-10px_rgba(39,47,92,0.4)] transition-[opacity,transform] duration-200",
                      isActive ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                    )}
                    style={{ [opensRight ? "left" : "right"]: `calc(50% + ${clusterHalf + 10}px)` }}
                  >
                    <div className="mb-1 max-w-[12rem] truncate text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{cat}</div>
                    {series.map((s) => (
                      <div key={s.label} className="flex items-center gap-2 whitespace-nowrap text-2xs">
                        <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ backgroundColor: s.color }} />
                        <span className="flex-1 text-text-secondary">{s.label}</span>
                        <span className="tabular font-bold text-primary">
                          {s.values[catIdx] ?? 0}
                          {suffix}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div
                    className={cn(
                      "relative flex h-full w-full items-end justify-center gap-0.5 px-[14%] transition-opacity duration-200",
                      dimmed && "opacity-45"
                    )}
                  >
                    {series.map((s, sIdx) => {
                      const value = s.values[catIdx] ?? 0;
                      const pct = Math.min(100, (value / max) * 100);
                      const showLabel = value > 0 && (labelAll || value === peaks[sIdx]);
                      const delay = reduce ? 0 : catIdx * 0.06 + sIdx * 0.04;
                      return (
                        <div key={s.label} className="relative flex h-full min-w-0 max-w-[24px] flex-1 flex-col items-center justify-end">
                          {showLabel && (
                            <motion.span
                              aria-hidden
                              className="tabular mb-1 whitespace-nowrap text-3xs font-bold leading-none text-text-secondary"
                              initial={{ opacity: reduce ? 1 : 0 }}
                              whileInView={{ opacity: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.3, delay: reduce ? 0 : delay + 0.45 }}
                            >
                              {value}
                              {suffix}
                            </motion.span>
                          )}
                          <motion.div
                            aria-hidden
                            className="relative w-full overflow-hidden rounded-t-[4px] transition-[filter] duration-200 group-hover/bar:brightness-110"
                            style={{ backgroundColor: s.color, minHeight: value > 0 ? 3 : 0 }}
                            initial={{ height: reduce ? `${pct}%` : 0 }}
                            whileInView={{ height: `${pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, ease: EASE, delay }}
                          >
                            {/* Gloss — reads the flat fill as a soft vertical gradient without shifting its hue. */}
                            <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 via-white/[0.06] to-black/[0.06]" />
                          </motion.div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X labels */}
      <div className="ml-9 mt-2 flex" aria-hidden>
        {categories.map((cat, catIdx) => (
          <span
            key={`${cat}-${catIdx}`}
            title={cat}
            className={cn(
              "line-clamp-2 min-w-0 flex-1 break-words px-1 text-center text-3xs font-semibold leading-tight transition-colors duration-200",
              active === catIdx ? "text-primary" : "text-text-muted"
            )}
          >
            {cat}
          </span>
        ))}
      </div>

      {series.length > 1 && (
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Legend">
          {series.map((s: BarSeries) => (
            <li key={s.label} className="flex items-center gap-2 text-2xs font-medium text-text-secondary">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: s.color }} aria-hidden />
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
