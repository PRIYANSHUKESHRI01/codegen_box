"use client";

import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp, Minus, Table2, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessHistory } from "@/types/studentStats";

interface ReadinessTrendProps {
  history: ReadinessHistory;
  /** A listed student only leaves below this; drawn as a faint band under the Vault line. */
  exitThreshold?: number;
  className?: string;
}

// The plot, in viewBox units. The SVG scales to its container; text stays in HTML so it never scales with it.
const W = 640;
const H = 190;
const PAD = { top: 12, right: 10, bottom: 22, left: 28 };
const DAY_MS = 86_400_000;

/** A "YYYY-MM-DD" from the API as a local calendar day (never shifted by the viewer's timezone). */
function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDay(day: string, long = false): string {
  return parseDay(day).toLocaleDateString(undefined, long ? { weekday: "short", day: "numeric", month: "short" } : { day: "numeric", month: "short" });
}

/**
 * The student's readiness, day by day, against the Vault line. One series, so no legend: the heading names it. The line
 * is drawn in the accent colour (theme token), the Vault line is dashed and labelled directly, a day the student did
 * nothing is a hollow dot, and hovering or focusing a day says what that score was made of. A table view is one click away.
 */
export function ReadinessTrend({ history, exitThreshold, className }: ReadinessTrendProps) {
  const { points, summary } = history;
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const chart = useMemo(() => {
    const last = parseDay(points[points.length - 1].date);
    const first = parseDay(points[0].date);
    // At least two weeks on the axis so the first days of a history do not stretch into a wall.
    const span = Math.max(14, Math.round((last.getTime() - first.getTime()) / DAY_MS));
    const start = new Date(last.getTime() - span * DAY_MS);
    const top = Math.max(summary.threshold + 10, Math.ceil((Math.max(...points.map((p) => p.score), summary.best) + 8) / 10) * 10);
    const x = (day: string) => PAD.left + ((parseDay(day).getTime() - start.getTime()) / DAY_MS / span) * (W - PAD.left - PAD.right);
    const y = (score: number) => PAD.top + (1 - score / top) * (H - PAD.top - PAD.bottom);
    const coords = points.map((p) => ({ p, x: x(p.date), y: y(p.score) }));
    const ticks = [0, Math.round(top / 2 / 10) * 10, top].filter((v, i, a) => a.indexOf(v) === i);
    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const base = y(0);
    const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${base} L${coords[0].x.toFixed(1)},${base} Z`;
    const labelDays = [start, new Date(start.getTime() + (span / 2) * DAY_MS), last].map((d) => ({
      x: x(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`),
      text: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    }));

    return { coords, ticks, line, area, y, labelDays, top };
  }, [points, summary.threshold, summary.best]);

  const single = points.length < 2;
  const change = summary.change_7d;
  const active = hover !== null ? chart.coords[hover] : null;
  const ChangeIcon = change === null || change === 0 ? Minus : change > 0 ? TrendingUp : TrendingDown;

  return (
    <section className={cn("rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6", className)} aria-label="Your readiness over time">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
            <LineChart className="h-4 w-4 text-accent-primary" aria-hidden />
            Your readiness, day by day
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            {summary.tracking_since ? `Tracked since ${formatDay(summary.tracking_since)}.` : "Your history starts today."} Hollow dots are days with no activity.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="flex items-center gap-1.5 rounded-control border border-border-subtle px-2.5 py-1.5 text-3xs font-bold text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-primary"
          aria-pressed={asTable}
        >
          {asTable ? <LineChart className="h-3 w-3" aria-hidden /> : <Table2 className="h-3 w-3" aria-hidden />}
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="This week">
          <span
            className={cn(
              "flex items-center gap-1 font-mono text-lg font-black",
              change === null || change === 0 ? "text-text-secondary" : change > 0 ? "text-status-success" : "text-status-danger"
            )}
          >
            <ChangeIcon className="h-4 w-4" aria-hidden />
            {change === null ? "—" : `${change > 0 ? "+" : ""}${change}`}
          </span>
        </Fact>
        <Fact label="Best so far">
          <span className="font-mono text-lg font-black text-primary">{summary.best}</span>
        </Fact>
        <Fact label="First reached the Vault line">
          <span className="text-sm font-bold text-primary">{summary.first_crossed_on ? formatDay(summary.first_crossed_on) : "Not yet"}</span>
        </Fact>
        <Fact label="At this pace">
          <span className="text-sm font-bold text-primary">
            {summary.score >= summary.threshold
              ? "You're past the line"
              : summary.days_to_threshold !== null
                ? `~${summary.days_to_threshold} ${summary.days_to_threshold === 1 ? "day" : "days"} to ${summary.threshold}`
                : "Keep going to see a trend"}
          </span>
        </Fact>
      </dl>

      {asTable ? (
        <div className="mt-4 max-h-72 overflow-auto rounded-control border border-border-subtle">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-elevated text-3xs uppercase tracking-wide text-text-muted">
              <tr>
                <th className="px-3 py-2 font-bold">Day</th>
                <th className="px-3 py-2 font-bold">Score</th>
                <th className="px-3 py-2 font-bold">Earned</th>
                <th className="px-3 py-2 font-bold">Missed-day loss</th>
                <th className="px-3 py-2 font-bold">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-mono">
              {[...points].reverse().map((p) => (
                <tr key={p.date}>
                  <td className="px-3 py-1.5 font-sans text-text-secondary">{formatDay(p.date, true)}</td>
                  <td className="px-3 py-1.5 font-bold text-primary">{p.score}</td>
                  <td className="px-3 py-1.5 text-text-secondary">{p.base_score}</td>
                  <td className={cn("px-3 py-1.5", p.penalty > 0 ? "text-status-danger" : "text-text-muted")}>{p.penalty > 0 ? `−${p.penalty}` : "0"}</td>
                  <td className="px-3 py-1.5 font-sans text-text-secondary">{p.active ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-4">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full touch-none select-none overflow-visible"
            role="img"
            aria-label={`Readiness score over the last ${points.length} tracked days, from ${points[0].score} to ${summary.score}. The Vault line is ${summary.threshold}.`}
            onPointerLeave={() => setHover(null)}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * W;
              let best = 0;
              chart.coords.forEach((c, i) => {
                if (Math.abs(c.x - px) < Math.abs(chart.coords[best].x - px)) best = i;
              });
              setHover(best);
            }}
          >
            {/* grid + axis: recessive */}
            {chart.ticks.map((t) => (
              <g key={t} className="text-border-subtle">
                <line x1={PAD.left} x2={W - PAD.right} y1={chart.y(t)} y2={chart.y(t)} stroke="currentColor" strokeWidth={1} />
                <text x={PAD.left - 6} y={chart.y(t) + 3} textAnchor="end" className="fill-text-muted" fontSize={10}>
                  {t}
                </text>
              </g>
            ))}
            {chart.labelDays.map((d, i) => (
              <text key={i} x={d.x} y={H - 6} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} className="fill-text-muted" fontSize={10}>
                {d.text}
              </text>
            ))}

            {/* the Vault line, labelled directly; the band under it is where a listed student is still safe */}
            {exitThreshold !== undefined && exitThreshold < summary.threshold && (
              <rect
                x={PAD.left}
                width={W - PAD.left - PAD.right}
                y={chart.y(summary.threshold)}
                height={chart.y(exitThreshold) - chart.y(summary.threshold)}
                className="fill-status-success"
                opacity={0.1}
              />
            )}
            <g className="text-status-success">
              <line x1={PAD.left} x2={W - PAD.right} y1={chart.y(summary.threshold)} y2={chart.y(summary.threshold)} stroke="currentColor" strokeWidth={1.5} strokeDasharray="5 4" />
              {/* Left-aligned with a surface-coloured halo, so the line and dots can pass behind it without hiding it. */}
              <text
                x={PAD.left + 6}
                y={chart.y(summary.threshold) - 5}
                className="fill-status-success stroke-surface"
                strokeWidth={4}
                paintOrder="stroke"
                strokeLinejoin="round"
                fontSize={10}
                fontWeight={700}
              >
                Vault line · {summary.threshold}
              </text>
            </g>

            {!single && (
              <>
                <path d={chart.area} className="fill-accent-primary" opacity={0.1} />
                <path d={chart.line} className="stroke-accent-primary" fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </>
            )}

            {active && <line x1={active.x} x2={active.x} y1={PAD.top} y2={H - PAD.bottom} className="stroke-text-muted" strokeWidth={1} strokeDasharray="3 3" />}

            {chart.coords.map((c, i) => {
              const isToday = i === chart.coords.length - 1;
              return (
                <circle
                  key={c.p.date}
                  cx={c.x}
                  cy={c.y}
                  r={isToday ? 5 : i === hover ? 4.5 : 3}
                  className={cn("stroke-surface", c.p.active || isToday ? "fill-accent-primary" : "fill-surface stroke-accent-primary")}
                  strokeWidth={c.p.active || isToday ? 2 : 1.5}
                />
              );
            })}
          </svg>

          {/* The tooltip is HTML, so it wraps and themes like the rest of the page. */}
          {active && (
            <div
              className="pointer-events-none absolute z-10 w-44 -translate-x-1/2 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-3xs shadow-card"
              style={{ left: `${Math.min(88, Math.max(12, (active.x / W) * 100))}%`, top: 0 }}
              role="status"
            >
              <div className="font-bold text-primary">{formatDay(active.p.date, true)}</div>
              <div className="mt-0.5 font-mono text-sm font-black text-primary">{active.p.score}</div>
              <div className="text-text-muted">
                {active.p.penalty > 0 ? `${active.p.base_score} earned − ${active.p.penalty} for missed days` : `${active.p.base_score} earned, nothing lost`}
              </div>
              <div className="text-text-muted">{active.p.active ? "You practised" : "No activity"}</div>
            </div>
          )}

          {single && <p className="mt-2 text-center text-xs text-text-muted">Come back tomorrow — each day you show up adds a point to this line.</p>}
        </div>
      )}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-control border border-border-subtle bg-elevated/50 px-3 py-2.5">
      <dt className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
