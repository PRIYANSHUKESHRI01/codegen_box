"use client";

import { useEffect, useState } from "react";
import { CircuitBoard, Lightbulb } from "lucide-react";
import { HpCard, HpItem, HpSectionHeader, hpTh } from "@/components/portal/kit";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CoreHeatmapResponse } from "@/types/core";

const cell = (accuracy: number | null) =>
  accuracy === null
    ? "bg-elevated text-text-muted"
    : accuracy >= 75
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : accuracy >= 50
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-rose-500/15 text-rose-700 dark:text-rose-300";

/**
 * Where each core branch of this college is strong and weak, by subject — drawn from what their students have actually
 * answered in Core Prep (practice and tests, last 180 days). Appears only for a college with students in a core branch
 * whose Core Prep is live; for every other college it renders nothing at all.
 */
export function CoreHeatmapCard() {
  const [data, setData] = useState<CoreHeatmapResponse | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<CoreHeatmapResponse>("/tpo/core-insights/heatmap")
      .then((res) => alive && setData(res))
      .catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!data || data.disciplines.length === 0) return null;

  return (
    <HpItem>
      <HpCard spotlight={false} className="space-y-6 p-5 sm:p-6">
        <HpSectionHeader
          title="Core subject strength by branch"
          subtitle="Accuracy across everything your core-branch students have answered in Core Prep — practice and timed tests"
        />

        {data.insights.length > 0 && (
          <ul className="space-y-2" aria-label="Subjects worth a remedial session">
            {data.insights.map((i) => (
              <li key={`${i.discipline}-${i.subject}`} className="flex items-start gap-2.5 rounded-control border border-amber-500/25 bg-amber-500/[0.07] px-3.5 py-2.5 text-xs text-text-secondary">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
                {i.message}
              </li>
            ))}
          </ul>
        )}

        {data.disciplines.map((d) => (
          <div key={d.code}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-extrabold text-primary">
              <CircuitBoard className="h-3.5 w-3.5 text-accent-primary" aria-hidden /> {d.name}
              <span className="font-semibold text-text-muted">· {d.students} student{d.students === 1 ? "" : "s"}</span>
            </h3>

            {d.subjects.length === 0 ? (
              <p className="rounded-control border border-dashed border-border-subtle px-4 py-5 text-center text-2xs text-text-muted">
                No Core Prep answers yet — this fills in as your students practise.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-control border border-border-subtle">
                <table className="w-full min-w-[32rem] text-left text-xs">
                  <thead>
                    <tr className="bg-elevated/50">
                      <th scope="col" className={cn(hpTh, "px-3 py-2")}>Branch</th>
                      {d.subjects.map((s) => (
                        <th key={s.id} scope="col" className={cn(hpTh, "px-2 py-2 text-center")} title={s.name}>
                          <span className="mx-auto block min-w-[5rem] max-w-[9rem] whitespace-normal leading-tight">{s.name}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {d.branches.map((b) => (
                      <tr key={b.code ?? "unmapped"}>
                        <th scope="row" className="px-3 py-2 font-semibold text-primary">
                          {b.name} <span className="font-normal text-text-muted">· {b.students}</span>
                        </th>
                        {d.subjects.map((s) => {
                          const c = b.cells[String(s.id)];
                          return (
                            <td key={s.id} className="px-1.5 py-1.5 text-center">
                              <span
                                className={cn("tabular inline-block min-w-[2.75rem] rounded-md px-1.5 py-1 text-2xs font-bold", cell(c?.accuracy ?? null))}
                                title={c ? `${c.attempts} answers from ${c.students} student${c.students === 1 ? "" : "s"}` : "No answers yet"}
                              >
                                {c?.accuracy != null ? `${c.accuracy}%` : "—"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-elevated/40">
                      <th scope="row" className="px-3 py-2 font-extrabold text-primary">All {d.code.toUpperCase()}</th>
                      {d.subjects.map((s) => (
                        <td key={s.id} className="px-1.5 py-1.5 text-center">
                          <span className={cn("tabular inline-block min-w-[2.75rem] rounded-md px-1.5 py-1 text-2xs font-extrabold", cell(s.accuracy))} title={`${s.attempts} answers from ${s.students} student${s.students === 1 ? "" : "s"}`}>
                            {s.accuracy != null ? `${s.accuracy}%` : "—"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </HpCard>
    </HpItem>
  );
}
