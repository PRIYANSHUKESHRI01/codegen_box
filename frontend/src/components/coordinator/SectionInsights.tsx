"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Crown, Flame, Minus, TrendingUp } from "lucide-react";
import { HpAvatar, HpCard, HpPill, HpSectionHeader } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import type { CoordinatorInsights, CoordinatorStudent, Mover, TrendPoint } from "@/types/coordinator";

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-bold", value > 0 && "text-emerald-600 dark:text-emerald-300", value < 0 && "text-rose-600 dark:text-rose-300", value === 0 && "text-text-muted")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

/** The width of an element, kept current: the chart is drawn at real pixels so its labels never scale up with the card. */
function useElementWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

/** The section's average readiness over time as a small area chart (pure SVG), with the Vault line at 60. */
function TrendChart({ points }: { points: TrendPoint[] }) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const W = Math.max(280, measured || 560);
  const H = 168;
  const pad = { l: 30, r: 10, t: 10, b: 22 };
  const xs = (i: number) => pad.l + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  const ys = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${xs(i).toFixed(1)},${ys(p.average).toFixed(1)}`).join(" ");
  const area = `${line} L${xs(points.length - 1).toFixed(1)},${ys(0)} L${xs(0).toFixed(1)},${ys(0)} Z`;
  const last = points[points.length - 1];

  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Average readiness over ${points.length} days, now ${last.average}`}>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(v)} y2={ys(v)} className="stroke-border-subtle" strokeWidth={1} />
            <text x={pad.l - 6} y={ys(v) + 3} textAnchor="end" fontSize={10} className="fill-text-muted">
              {v}
            </text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={ys(60)} y2={ys(60)} className="stroke-emerald-500/60" strokeWidth={1} strokeDasharray="4 3" />
        <text x={W - pad.r} y={ys(60) - 4} textAnchor="end" fontSize={10} fontWeight={700} className="fill-emerald-600 dark:fill-emerald-300">
          Vault line 60
        </text>
        <path d={area} className="fill-indigo-500/10" />
        <path d={line} className="fill-none stroke-indigo-500" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={xs(points.length - 1)} cy={ys(last.average)} r={3.5} className="fill-indigo-500" />
        <text x={pad.l} y={H - 6} fontSize={10} className="fill-text-muted">
          {shortDate(points[0].date)}
        </text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize={10} className="fill-text-muted">
          {shortDate(last.date)}
        </text>
      </svg>
    </div>
  );
}

/** How the section has moved: average readiness over the last weeks, against the college, and how many practise each day. */
export function SectionTrendCard({ insights, currentAverage }: { insights: CoordinatorInsights | null; currentAverage: number }) {
  const points = insights?.trend.points ?? [];
  const college = insights?.college.average ?? null;
  const days = points.slice(-14);
  // The college figure is read from the same daily history, so the section number is too (the roster's live score can differ by a few points).
  const sectionNow = points.length > 0 ? points[points.length - 1].average : currentAverage;
  const maxActive = Math.max(1, ...days.map((d) => d.active));

  return (
    <HpCard spotlight={false} className="p-5">
      <HpSectionHeader
        title="How the section is moving"
        subtitle="Average readiness by day, from each student's own history"
        icon={TrendingUp}
        tone="indigo"
        action={
          <div className="text-right text-2xs text-text-muted">
            <p>
              7 days <Delta value={insights?.trend.change_7d ?? null} />
            </p>
            <p>
              4 weeks <Delta value={insights?.trend.change_28d ?? null} />
            </p>
          </div>
        }
      />

      {points.length < 2 ? (
        <p className="mt-4 rounded-control border border-dashed border-border-strong px-4 py-8 text-center text-2xs text-text-muted">
          The trend appears once your students have a few days of history. Their scores are saved every day, so it fills in by itself.
        </p>
      ) : (
        <div className="mt-3">
          <TrendChart points={points} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-control border border-border-subtle bg-elevated/40 p-3">
          <p className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">Against the college</p>
          <p className="mt-1 flex items-baseline gap-2 text-sm text-text-secondary">
            <span className="tabular text-xl font-extrabold text-primary">{sectionNow}</span> section
            <span className="text-text-muted">vs</span>
            <span className="tabular text-xl font-extrabold text-primary">{college ?? "—"}</span> college
          </p>
          {college !== null && (
            <p className="mt-0.5 text-2xs">
              <Delta value={sectionNow - college} /> <span className="text-text-muted">{sectionNow >= college ? "ahead of" : "behind"} the college average</span>
            </p>
          )}
        </div>

        <div className="rounded-control border border-border-subtle bg-elevated/40 p-3">
          <p className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">Practising each day (last {days.length || 14})</p>
          {days.length === 0 ? (
            <p className="mt-2 text-2xs text-text-muted">No daily activity recorded yet.</p>
          ) : (
            <div className="mt-2 flex h-12 items-end gap-1" role="img" aria-label="Students who practised each day">
              {days.map((d) => (
                <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${shortDate(d.date)}: ${d.active} practised`}>
                  <div className="w-full rounded-t bg-emerald-500/70 transition-colors group-hover:bg-emerald-500" style={{ height: `${Math.max(6, (d.active / maxActive) * 100)}%` }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </HpCard>
  );
}

function MoverRow({ m, tone }: { m: Mover; tone: "up" | "down" }) {
  return (
    <li className="flex items-center justify-between gap-2 text-2xs">
      <span className="flex min-w-0 items-center gap-2">
        <HpAvatar name={m.name} size="sm" />
        <span className="truncate font-semibold text-primary">{m.name}</span>
      </span>
      <span className="shrink-0 tabular text-text-muted">
        {m.from} → <b className="text-primary">{m.to}</b> <span className={tone === "up" ? "font-bold text-emerald-600 dark:text-emerald-300" : "font-bold text-rose-600 dark:text-rose-300"}>({m.change > 0 ? "+" : ""}{m.change})</span>
      </span>
    </li>
  );
}

/** Three short lists a coordinator can act on: who leads, who improved most in two weeks, who slipped. */
export function SectionLeaders({ students, insights, onOpen }: { students: CoordinatorStudent[]; insights: CoordinatorInsights | null; onOpen: (id: number) => void }) {
  const ranked = [...students].filter((s) => !s.is_blocked).sort((a, b) => b.readiness_score - a.readiness_score);
  const top = ranked.slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <HpCard spotlight={false} className="p-5">
        <HpSectionHeader title="Leading the section" icon={Crown} tone="amber" />
        {top.length === 0 ? (
          <p className="mt-3 text-2xs text-text-muted">No students yet.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {top.map((s, i) => (
              <li key={s.id}>
                <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center justify-between gap-2 rounded-control px-1 py-1 text-left text-2xs hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-center font-bold text-text-muted">{i + 1}</span>
                    <HpAvatar name={s.name} size="sm" />
                    <span className="truncate font-semibold text-primary">{s.name}</span>
                  </span>
                  <HpPill tone="emerald" size="sm">
                    {s.readiness_score}
                  </HpPill>
                </button>
              </li>
            ))}
          </ol>
        )}
      </HpCard>

      <HpCard spotlight={false} className="p-5">
        <HpSectionHeader title="Most improved" subtitle="Last two weeks" icon={Flame} tone="emerald" />
        <ul className="mt-3 space-y-2">
          {(insights?.movers.improved ?? []).map((m) => (
            <MoverRow key={m.student_id} m={m} tone="up" />
          ))}
          {(insights?.movers.improved.length ?? 0) === 0 && <li className="text-2xs text-text-muted">{insights ? "Nobody has gained yet. Scores are compared once there are two weeks of history." : "Loading…"}</li>}
        </ul>
      </HpCard>

      <HpCard spotlight={false} className="p-5">
        <HpSectionHeader title="Slipping" subtitle="Worth a call this week" icon={ArrowDownRight} tone="rose" />
        <ul className="mt-3 space-y-2">
          {(insights?.movers.slipped ?? []).map((m) => (
            <MoverRow key={m.student_id} m={m} tone="down" />
          ))}
          {(insights?.movers.slipped.length ?? 0) === 0 && <li className="text-2xs text-text-muted">{insights ? "Nobody has lost ground. Good." : "Loading…"}</li>}
        </ul>
      </HpCard>
    </div>
  );
}
