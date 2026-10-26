"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Power, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DISCIPLINE_LABEL } from "@/lib/core";
import { resetBranchCatalog } from "@/lib/branches";
import type { CoverageCollege, CoverageDiscipline, CoverageSubject } from "@/types/core";
import { CorePilotColleges } from "./CorePilotColleges";
import { type ToastTrigger } from "@/lib/toast";
import { confirmDialog } from "@/lib/dialogs";

/** Colour a cell by how it compares with the bar a subject needs to carry tests. */
const cell = (n: number, bar: number) => (n === 0 ? "bg-status-danger/10 text-status-danger" : n < bar ? "bg-status-warning/10 text-status-warning" : "bg-status-success/10 text-status-success");

/**
 * Core Prep → Coverage: how much can we actually build tests from, per branch and subject — and the switch that
 * shows Core Prep to a branch's students.
 *
 * Only PUBLISHED questions count. Red/amber cells are the content to commission next. Going live refuses while a
 * branch is too thin (the bar is in config/core_prep.php); a superadmin can override that knowingly. Switching a
 * branch off hides Core Prep from its students again immediately. Before going live, a branch can be piloted at
 * chosen colleges (CorePilotColleges) — the stage badge says which of live / pilot / hidden a branch is in.
 */
export function CoreCoveragePanel({ isSuperadmin, onToast }: { isSuperadmin: boolean; onToast: ToastTrigger }) {
  const [data, setData] = useState<CoverageDiscipline[] | null>(null);
  const [colleges, setColleges] = useState<CoverageCollege[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get<{ disciplines: CoverageDiscipline[]; colleges?: CoverageCollege[] }>("/admin/core/coverage");
      setData(res.disciplines);
      setColleges(res.colleges ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load coverage.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setLive = async (d: CoverageDiscipline, live: boolean, force = false) => {
    setBusy(d.discipline);
    try {
      await api.post(`/superadmin/core/disciplines/${d.discipline}/live`, { live, force });
      resetBranchCatalog();
      onToast(live ? `Core Prep is now live for ${DISCIPLINE_LABEL[d.discipline]} students.` : `Core Prep is hidden from ${DISCIPLINE_LABEL[d.discipline]} students.`);
      await load();
    } catch (err) {
      const reasons = err instanceof ApiError ? err.errors?.live : undefined;
      if (live && !force && reasons && (await confirmDialog({ title: "Switch it on anyway?", message: "Students would see a thin bank.", items: reasons, tone: "warning", confirmLabel: "Switch on anyway" }))) {
        setBusy(null);
        return setLive(d, true, true);
      }
      if (!reasons) onToast(err instanceof ApiError ? err.message : "That didn't work.", "error");
    } finally {
      setBusy(null);
    }
  };

  if (error) return <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-xs text-status-danger">{error} <button onClick={() => void load()} className="font-bold underline">Retry</button></div>;
  if (!data) return <div className="h-64 animate-pulse rounded-panel bg-elevated" aria-busy="true" />;

  return (
    <div className="space-y-6">
      {data.map((d) => {
        const bar = d.go_live.rules.min_per_subject;
        return (
          <section key={d.discipline} className="overflow-hidden rounded-panel border border-border-subtle bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-elevated/50 px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-primary">
                  {DISCIPLINE_LABEL[d.discipline]}
                  <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", d.stage === "live" ? "bg-status-success/15 text-status-success" : d.stage === "pilot" ? "bg-status-warning/15 text-status-warning" : "bg-elevated text-text-muted")}>
                    {d.stage === "live" ? "Live to students" : d.stage === "pilot" ? `Pilot · ${d.pilots.length} ${d.pilots.length === 1 ? "college" : "colleges"}` : "Hidden from students"}
                  </span>
                </h3>
                <p className="mt-0.5 text-2xs text-text-muted">
                  <strong className="tabular text-primary">{d.totals.test}</strong> published test questions · <strong className="tabular text-primary">{d.totals.practice}</strong> for practice · {d.totals.in_review} in review · {d.totals.draft} drafts
                </p>
              </div>
              {isSuperadmin ? (
                <button onClick={() => setLive(d, !d.is_live)} disabled={busy === d.discipline} className={cn("inline-flex items-center gap-1.5 rounded-control px-3.5 py-2 text-2xs font-bold disabled:opacity-50", d.is_live ? "border border-border-strong bg-elevated text-primary" : "bg-accent-primary text-white")}>
                  {busy === d.discipline ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />} {d.is_live ? "Hide from students" : "Go live"}
                </button>
              ) : (
                <span className="text-2xs text-text-muted">Only a superadmin can switch a branch on or off.</span>
              )}
            </header>

            <CorePilotColleges discipline={d} colleges={colleges} editable={isSuperadmin} onSaved={load} onToast={onToast} />

            {!d.is_live && (
              <div className={cn("flex items-start gap-2 px-5 py-2.5 text-2xs", d.go_live.ready ? "bg-status-success/5 text-status-success" : "bg-status-warning/5 text-text-secondary")}>
                {d.go_live.ready ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> : <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden />}
                <span>{d.go_live.ready ? "Enough published questions to go live." : d.go_live.reasons.join(" ")}</span>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-2xs">
                <thead className="text-3xs uppercase tracking-wide text-text-muted">
                  <tr className="border-b border-border-subtle">
                    <th className="px-5 py-2">Subject</th><th className="px-3 py-2 text-center">Easy</th><th className="px-3 py-2 text-center">Medium</th><th className="px-3 py-2 text-center">Hard</th>
                    <th className="px-3 py-2 text-center">Practice</th><th className="px-3 py-2 text-center">Tests</th><th className="px-3 py-2 text-center">Topics covered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {d.subjects.map((s: CoverageSubject) => (
                    <tr key={s.id}>
                      <td className="px-5 py-2 font-semibold text-primary">{s.name}</td>
                      {[s.easy, s.medium, s.hard].map((n, i) => <td key={i} className="px-3 py-1.5 text-center"><span className={cn("tabular inline-block min-w-[2.5rem] rounded px-2 py-0.5 font-bold", cell(n, Math.ceil(bar / 3)))}>{n}</span></td>)}
                      <td className="px-3 py-1.5 text-center"><span className={cn("tabular inline-block min-w-[2.5rem] rounded px-2 py-0.5 font-bold", cell(s.practice, bar))}>{s.practice}</span></td>
                      <td className="px-3 py-1.5 text-center"><span className={cn("tabular inline-block min-w-[2.5rem] rounded px-2 py-0.5 font-bold", cell(s.test, bar))}>{s.test}</span></td>
                      <td className="tabular px-3 py-1.5 text-center text-text-secondary">{s.topics_covered}/{s.topics_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border-subtle px-5 py-2 text-3xs text-text-muted">Green = at least {bar} (a third of that per difficulty). Only published questions count.</p>
          </section>
        );
      })}
    </div>
  );
}
