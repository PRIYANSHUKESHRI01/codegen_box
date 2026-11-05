"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { downloadStoredReport } from "@/lib/reportDocuments";
import { cn } from "@/lib/utils";
import type { ToastTrigger } from "@/lib/toast";
import type { VaultAiReportRecord, VaultAiResult } from "@/types/vaultAiResults";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const pct = (n: number | null) => (n === null ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`);

/**
 * The student's Vault AI Interview RESULTS (distinct from the hand tools below it): the final average of the three sets of their best
 * series per stack, the attempts behind it, and the stored PDF report. `refreshKey` changes whenever an admin action above has run, so
 * the numbers follow a correction at once.
 */
export function VaultAiResultsBlock({ studentId, refreshKey, triggerToast }: { studentId: number; refreshKey: unknown; triggerToast: ToastTrigger }) {
  const [results, setResults] = useState<VaultAiResult[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    api
      .get<{ results: VaultAiResult[] }>(`/admin/vault-ai/students/${studentId}/results`)
      .then((res) => setResults(res.results))
      .catch(() => setResults([]));
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!results || results.length === 0) return null;

  const report = async (r: VaultAiResult) => {
    setBusy(r.id);
    try {
      let id = r.report_id;
      let filename = `AptRun-Vault-AI-${r.stack_key}.pdf`;

      if (!id) {
        const res = await api.post<{ report: VaultAiReportRecord }>(`/admin/vault-ai/results/${r.id}/report`);
        id = res.report.id;
        filename = res.report.filename;
        load();
      }

      await downloadStoredReport(`/admin/reports/${id}/download`, filename);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't get that report.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="Interview results" className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
      <h3 className="text-sm font-extrabold text-primary">Results &amp; reports</h3>
      <p className="mt-0.5 text-3xs text-text-muted">Final average of the three sets (best series kept), and the PDF AptRun stores for it.</p>
      <ul className="mt-3 divide-y divide-border-subtle">
        {results.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-primary">{r.stack_name ?? r.stack_key}</span>
                <span className={cn("rounded-full px-2 py-0.5 font-mono text-2xs font-extrabold ring-1 ring-inset", r.ever_qualified ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300")}>
                  {pct(r.best_average)}
                </span>
                <span className="font-mono text-2xs text-text-secondary">{["1", "2", "3"].map((s) => (r.best_scores[s] !== undefined ? `${r.best_scores[s]}%` : "—")).join(" · ")}</span>
              </div>
              <p className="mt-0.5 text-3xs text-text-muted">
                {r.attempts} attempt{r.attempts === 1 ? "" : "s"} · last {when(r.last_at)}
                {r.history.some((h) => h.reset) ? " · includes a result from before a reset" : ""}
              </p>
            </div>
            <button type="button" onClick={() => report(r)} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary hover:bg-surface-hover disabled:opacity-60">
              {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : r.report_id ? <Download className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
              {r.report_id ? "Download PDF" : "Generate PDF"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
