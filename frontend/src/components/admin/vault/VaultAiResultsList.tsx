"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Loader2, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { downloadStoredReport, saveBlob } from "@/lib/reportDocuments";
import { cn } from "@/lib/utils";
import type { ToastTrigger } from "@/lib/toast";
import type { VaultAiResultList, VaultAiResultRow, VaultAiReportRecord } from "@/types/vaultAiResults";

type Scope = "tpo" | "platform";

const PATHS: Record<Scope, { list: string; generate: (id: number) => string; download: (id: string) => string }> = {
  tpo: { list: "/tpo/vault-ai/results", generate: (id) => `/tpo/vault-ai/results/${id}/report`, download: (id) => `/tpo/reports/${id}/download` },
  platform: { list: "/admin/vault-ai/results", generate: (id) => `/admin/vault-ai/results/${id}/report`, download: (id) => `/admin/reports/${id}/download` },
};

const SELECT = "h-9 rounded-control border border-border-subtle bg-surface px-2 text-xs text-primary focus:border-accent-primary focus:outline-none";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const pct = (n: number | null) => (n === null ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)}%`);

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Every student who has completed a Vault AI Interview series: the FINAL AVERAGE of the three sets of their best series, the set
 * scores, how many attempts it took, and the PDF report AptRun keeps for each. A college's TPO sees their own college; Mellow's team
 * sees every college. Reports are generated automatically when a series completes; "Generate" is for one that predates that.
 */
export function VaultAiResultsList({ scope, triggerToast }: { scope: Scope; triggerToast: ToastTrigger }) {
  const paths = PATHS[scope];
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [stack, setStack] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("best");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<VaultAiResultList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useCallback(
    (p: number, per = 25) => {
      const params = new URLSearchParams({ page: String(p), per_page: String(per), sort });
      if (debounced) params.set("q", debounced);
      if (stack) params.set("stack", stack);
      if (status) params.set("status", status);
      return params.toString();
    },
    [debounced, stack, status, sort]
  );

  const load = useCallback(() => {
    api
      .get<VaultAiResultList>(`${paths.list}?${query(page)}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the results."));
  }, [paths.list, query, page]);

  useEffect(() => {
    load();
  }, [load]);

  const report = async (row: VaultAiResultRow) => {
    setBusy(`r${row.id}`);
    try {
      let id = row.report_id;
      let filename = `AptRun-Vault-AI-${row.student.name.replace(/\s+/g, "-")}.pdf`;

      if (!id) {
        const res = await api.post<{ report: VaultAiReportRecord }>(paths.generate(row.id));
        id = res.report.id;
        filename = res.report.filename;
        load();
      }

      await downloadStoredReport(paths.download(id), filename);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't get that report.", "error");
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setBusy("csv");
    try {
      const rows: VaultAiResultRow[] = [];
      let p = 1;
      let total = 0;
      do {
        const res = await api.get<VaultAiResultList>(`${paths.list}?${query(p, 100)}`);
        rows.push(...res.rows);
        total = res.total;
        p += 1;
      } while (rows.length < total && p <= 50);

      const header = ["Student", "Roll number", "E-mail", "Branch", "Section", ...(scope === "platform" ? ["College"] : []), "Stack", "Final average (best series) %", "Set 1 %", "Set 2 %", "Set 3 %", "Attempts", "Qualified", "Last attempt"];
      const lines = rows.map((r) =>
        [
          r.student.name, r.student.roll_number, r.student.email, r.student.branch, r.student.section, ...(scope === "platform" ? [r.college] : []),
          r.stack_name ?? r.stack_key, r.best_average, r.best_scores["1"], r.best_scores["2"], r.best_scores["3"], r.attempts, r.ever_qualified ? "Yes" : "No", r.last_at ? r.last_at.slice(0, 10) : "",
        ].map(csvCell).join(",")
      );
      saveBlob(new Blob(["﻿" + [header.map(csvCell).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" }), `Vault-AI-Interview-results-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't export the results.", "error");
    } finally {
      setBusy(null);
    }
  };

  if (error && !data) {
    return (
      <div role="alert" className="rounded-panel border border-status-danger/25 bg-status-danger/10 p-4 text-xs text-status-danger">
        {error}{" "}
        <button type="button" className="font-bold underline" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div role="status" className="flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-10 text-xs text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading results…
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(data.total / data.per_page));

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Students who sat it", data.totals.students],
          ["Results (stacks)", data.totals.results],
          ["Qualified", data.totals.qualified],
          ["Average of best series", data.totals.average === null ? "—" : `${data.totals.average}%`],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
            <div className="text-2xs font-semibold uppercase tracking-wider text-text-muted">{label}</div>
            <div className="mt-2 font-mono text-2xl font-black text-primary">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block">
            <span className="sr-only">Search students</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, roll number or e-mail" className="h-9 w-60 rounded-control border border-border-subtle bg-surface pl-8 pr-2 text-xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none" />
          </label>
          <select aria-label="Stack" value={stack} onChange={(e) => { setStack(e.target.value); setPage(1); }} className={SELECT}>
            <option value="">All stacks</option>
            {data.stacks.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
          <select aria-label="Result" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={SELECT}>
            <option value="">Qualified and not</option>
            <option value="qualified">Qualified</option>
            <option value="not_qualified">Not qualified yet</option>
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className={SELECT}>
            <option value="best">Highest average first</option>
            <option value="recent">Most recent first</option>
            <option value="attempts">Most attempts first</option>
            <option value="name">Name</option>
          </select>
        </div>
        <button type="button" onClick={exportCsv} disabled={busy !== null || data.total === 0} className="inline-flex h-9 items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 text-2xs font-bold text-primary hover:bg-surface-hover disabled:opacity-50">
          {busy === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} Export CSV
        </button>
      </div>

      {data.rows.length === 0 ? (
        <p className="rounded-control border border-dashed border-border-strong px-4 py-10 text-center text-2xs text-text-muted">
          {debounced || stack || status ? "No result matches." : "Nobody has completed a Vault AI Interview series yet. Results appear here the moment a student finishes the third set."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle bg-elevated/50 text-left text-3xs font-bold uppercase tracking-wider text-text-muted">
                <th className="py-2.5 pl-4 pr-3">Student</th>
                {scope === "platform" && <th className="py-2.5 pr-3">College</th>}
                <th className="py-2.5 pr-3">Stack</th>
                <th className="py-2.5 pr-3">Final average</th>
                <th className="py-2.5 pr-3">Sets 1 · 2 · 3</th>
                <th className="py-2.5 pr-3">Attempts</th>
                <th className="py-2.5 pr-3">Last</th>
                <th className="py-2.5 pr-4 text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b border-border-subtle last:border-0">
                  <td className="py-3 pl-4 pr-3">
                    <div className="font-bold text-primary">{r.student.name}</div>
                    <div className="text-2xs text-text-muted">{[r.student.roll_number, r.student.branch, r.student.section ? `Sec ${r.student.section}` : null].filter(Boolean).join(" · ") || r.student.email}</div>
                  </td>
                  {scope === "platform" && <td className="py-3 pr-3 text-text-secondary">{r.college ?? "—"}</td>}
                  <td className="py-3 pr-3 font-semibold text-primary">{r.stack_name ?? r.stack_key}</td>
                  <td className="py-3 pr-3">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-2xs font-extrabold ring-1 ring-inset", r.ever_qualified ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300")}>
                      {pct(r.best_average)}
                    </span>
                    <span className="ml-1.5 text-3xs text-text-muted">{r.ever_qualified ? "qualified" : `below ${data.pass_mark}%`}</span>
                  </td>
                  <td className="py-3 pr-3 font-mono text-2xs text-text-secondary">{["1", "2", "3"].map((s) => (r.best_scores[s] !== undefined ? `${r.best_scores[s]}%` : "—")).join(" · ")}</td>
                  <td className="py-3 pr-3 tabular-nums">{r.attempts}</td>
                  <td className="py-3 pr-3 text-text-muted">{when(r.last_at)}</td>
                  <td className="py-3 pr-4 text-right">
                    <button type="button" onClick={() => report(r)} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 text-2xs font-bold text-primary hover:bg-surface-hover disabled:opacity-60">
                      {busy === `r${r.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : r.report_id ? <Download className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      {r.report_id ? "PDF" : "Generate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-2xs text-text-muted">
          <span>
            {data.total} results · page {data.page} of {pages}
          </span>
          <div className="flex gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page" className="rounded-control border border-border-subtle p-1.5 disabled:opacity-40">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page" className="rounded-control border border-border-subtle p-1.5 disabled:opacity-40">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
