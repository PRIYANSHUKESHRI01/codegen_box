"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText, Loader2, RefreshCw, Trophy } from "lucide-react";
import { Reveal, ScoreRing } from "@/components/dashboard/vaultAi/vaultKit";
import { api, ApiError } from "@/lib/api";
import { downloadStoredReport } from "@/lib/reportDocuments";
import { cn } from "@/lib/utils";
import type { MyVaultAiResults, VaultAiReportRecord, VaultAiResult } from "@/types/vaultAiResults";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/**
 * "Your Vault AI Interview results": for every stack the student has completed a series in, the FINAL AVERAGE of the three sets (their
 * best series — sitting again never lowers it), the three set scores, the attempts behind it, and the PDF report AptRun keeps for it.
 * Draws nothing until they have finished a series.
 */
export function VaultAiResultsCard() {
  const [data, setData] = useState<MyVaultAiResults | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<MyVaultAiResults>("/me/vault-ai/results")
      .then(setData)
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data || data.results.length === 0) return null;

  const run = async (result: VaultAiResult, regenerate: boolean) => {
    setBusy(result.stack_key);
    setError(null);
    try {
      let id = result.report_id;
      let filename = `AptRun-Vault-AI-Interview-${result.stack_key}.pdf`;

      if (regenerate || !id) {
        const res = await api.post<{ report: VaultAiReportRecord; result: VaultAiResult }>(`/me/vault-ai/results/${result.stack_key}/report`);
        id = res.report.id;
        filename = res.report.filename;
        load();
      }

      await downloadStoredReport(`/me/reports/${id}/download`, filename);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't prepare your report. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Reveal>
      <section aria-label="Your Vault AI Interview results" className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-primary">
          <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> Your results
        </h2>

        {error && (
          <p role="alert" className="rounded-control border border-status-danger/25 bg-status-danger/10 p-3 text-2xs text-status-danger">
            {error}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {data.results.map((r) => (
            <article key={r.id} className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-subtle">
              <div className="flex items-start gap-4">
                <ScoreRing value={r.best_average} size={84} stroke={8} tone={r.ever_qualified ? "emerald" : "indigo"} label={`${r.stack_name ?? r.stack_key} final average`}>
                  <span className="tabular text-base font-extrabold text-primary">{r.best_average !== null ? pct(r.best_average) : "—"}</span>
                </ScoreRing>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-extrabold text-primary">{r.stack_name ?? r.stack_key}</h3>
                    {r.ever_qualified ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-3xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">Qualified</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-3xs font-bold text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">Below {r.pass_mark}%</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-2xs text-text-muted">
                    Final average of your three sets{r.attempts > 1 ? " — your best series" : ""}. {r.attempts} attempt{r.attempts === 1 ? "" : "s"}, last {when(r.last_at)}.
                  </p>

                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Set scores of your best series">
                    {["1", "2", "3"].map((set) => (
                      <li key={set} className="rounded-lg bg-elevated px-2.5 py-1 font-mono text-2xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
                        Set {set} <span className="text-primary">{r.best_scores[set] !== undefined ? `${r.best_scores[set]}%` : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {r.history.length > 1 && (
                <details className="mt-4 rounded-xl border border-border-subtle bg-elevated/40">
                  <summary className="cursor-pointer list-none px-3 py-2 text-2xs font-bold text-primary">Every attempt ({r.history.length})</summary>
                  <ul className="divide-y divide-border-subtle border-t border-border-subtle">
                    {r.history.map((h, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-2xs">
                        <span className="font-semibold text-primary">
                          Series {h.series} {h.is_best && <span className="ml-1 rounded-full bg-indigo-500/10 px-1.5 py-px text-3xs font-bold text-indigo-600 dark:text-indigo-300">Best</span>}
                        </span>
                        <span className="font-mono text-text-secondary">
                          {["1", "2", "3"].map((s) => (h.scores[s] !== undefined ? `${h.scores[s]}%` : "—")).join(" · ")} → <b className={cn(h.passed ? "text-emerald-600 dark:text-emerald-300" : "text-text-primary")}>{pct(h.average)}</b>
                        </span>
                        <span className="text-text-muted">{when(h.at)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => run(r, false)}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-4 py-2 text-2xs font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
                >
                  {busy === r.stack_key ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : r.report_id ? <Download className="h-3.5 w-3.5" aria-hidden /> : <FileText className="h-3.5 w-3.5" aria-hidden />}
                  {r.report_id ? "Download report (PDF)" : "Create my report (PDF)"}
                </button>
                {r.report_id && (
                  <button
                    type="button"
                    onClick={() => run(r, true)}
                    disabled={busy !== null}
                    title="Write the report again from your latest results"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-elevated px-3 py-2 text-2xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-60"
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden /> Refresh
                  </button>
                )}
                {r.report_generated_at && <span className="text-3xs text-text-muted">Report made {when(r.report_generated_at)}</span>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
