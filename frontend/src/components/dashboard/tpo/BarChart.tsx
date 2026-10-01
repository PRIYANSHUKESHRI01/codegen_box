"use client";

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
}

/** Simple grouped/single vertical bar chart, no dependency, theme-aware. */
export function BarChart({ categories, series, height = 220, suffix = "%", maxValue }: BarChartProps) {
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
