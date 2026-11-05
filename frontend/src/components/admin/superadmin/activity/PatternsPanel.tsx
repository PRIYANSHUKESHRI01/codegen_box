"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { PatternsResponse } from "@/types/activity";
import { ago, span } from "./format";
import { Card, Empty, ErrorBox, Heatmap, ScrollMeter, Segmented, Spinner, Th } from "./ui";

type Who = "all" | "user" | "admin_tpo" | "section_coordinator";

/** Usage patterns across the whole platform: when people visit (weekday × hour) and which screens are used most. */
export function PatternsPanel() {
  const [who, setWho] = useState<Who>("all");
  const [days, setDays] = useState(14);
  const [data, setData] = useState<PatternsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ days: String(days) });
    if (who !== "all") p.set("role", who);
    api
      .get<PatternsResponse>(`/superadmin/activity/patterns?${p.toString()}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load usage patterns."));
  }, [who, days]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Spinner label="Loading usage patterns…" />;

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={who} onChange={setWho} label="Whose usage" options={[{ id: "all", label: "Everyone" }, { id: "user", label: "Students" }, { id: "admin_tpo", label: "TPOs" }, { id: "section_coordinator", label: "Coordinators" }]} />
        <Segmented value={String(days) as "7" | "14" | "30"} onChange={(v) => setDays(Number(v))} label="Period" options={[{ id: "7", label: "7 days" }, { id: "14", label: "14 days" }, { id: "30", label: "30 days" }]} />
      </div>

      <Card title="When people visit" subtitle={`Visits started in the last 4 weeks by weekday and hour, India time (${data.heatmap.visits.toLocaleString()} visits). Darker = busier — a good time to ship, or to schedule a contest.`}>
        {data.heatmap.visits === 0 ? <Empty>No visits recorded yet.</Empty> : <Heatmap cells={data.heatmap.cells} max={data.heatmap.max} />}
      </Card>

      <Card title="Most used screens" subtitle={`Last ${days} days across every college. Time = average on the screen · Scroll = how far down people read, on average. A screen with high views but very low time or scroll is one people open and leave.`}>
        {data.sections.length === 0 ? (
          <Empty>No screens recorded yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle">
                  <Th>Section</Th>
                  <Th>Opened</Th>
                  <Th>People</Th>
                  <Th>Time</Th>
                  <Th>Scroll</Th>
                  <Th>Last</Th>
                </tr>
              </thead>
              <tbody>
                {data.sections.map((s) => (
                  <tr key={s.section} className="border-b border-border-subtle last:border-0">
                    <td className="py-2.5 pr-3 font-semibold text-primary">{s.section}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{s.views.toLocaleString()}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{s.users.toLocaleString()}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{span(s.avg_seconds)}</td>
                    <td className="py-2.5 pr-3">
                      <ScrollMeter value={s.avg_scroll} />
                    </td>
                    <td className="py-2.5 text-text-muted">{ago(s.last_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
