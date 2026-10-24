"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CloudUpload, Download, FileArchive, FileSpreadsheet, Loader2, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DISCIPLINE_LABEL } from "@/lib/core";
import { DisciplineOptions } from "@/components/admin/core/DisciplineOptions";
import { type CoreDiscipline, type CoreImport } from "@/types/core";

const sel = "px-2.5 py-1.5 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary text-2xs";
const STATUS_TONE: Record<CoreImport["status"], string> = {
  pending: "bg-elevated text-text-muted",
  processing: "bg-sky-500/15 text-sky-500",
  checked: "bg-status-warning/15 text-status-warning",
  completed: "bg-status-success/15 text-status-success",
  completed_with_errors: "bg-status-warning/15 text-status-warning",
  failed: "bg-status-danger/10 text-status-danger",
};
const STATUS_TEXT: Record<CoreImport["status"], string> = {
  pending: "Queued",
  processing: "Working…",
  checked: "Checked — not imported yet",
  completed: "Imported",
  completed_with_errors: "Imported with errors",
  failed: "Failed",
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * Core Prep → Import: how the question banks get fed.
 *
 * 1. Download the template (an Excel workbook with the exact subject codes and a drop-down on the key columns).
 * 2. Upload your filled file (and a ZIP of figures if any) — it is CHECKED first: every row is validated with the
 *    same rules as the editor and nothing is written.
 * 3. Read the report, fix the file if rows failed, and import. Re-uploading a corrected sheet UPDATES questions by
 *    their id instead of duplicating them.
 */
export function CoreImportPanel({ onToast, onImported }: { onToast: (m: string) => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [discipline, setDiscipline] = useState<CoreDiscipline | "">("");
  const [defaultStatus, setDefaultStatus] = useState("draft");
  const [busy, setBusy] = useState<"check" | "commit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<CoreImport | null>(null);
  const [history, setHistory] = useState<CoreImport[]>([]);
  const [templateFor, setTemplateFor] = useState<CoreDiscipline | "">("");
  const fileInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      setHistory((await api.get<{ imports: CoreImport[] }>("/admin/core/imports")).imports);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // A large file is processed by the queue: poll until it settles.
  useEffect(() => {
    if (!current || !["pending", "processing"].includes(current.status)) return;
    const timer = setInterval(async () => {
      try {
        const res = await api.get<{ import: CoreImport }>(`/admin/core/imports/${current.id}`);
        setCurrent(res.import);
        if (!["pending", "processing"].includes(res.import.status)) {
          void loadHistory();
          if (res.import.mode === "commit") onImported();
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [current, loadHistory, onImported]);

  const downloadTemplate = async (format: "xlsx" | "csv") => {
    try {
      const blob = await api.getFile(`/admin/core/import-template?format=${format}${templateFor ? `&discipline=${templateFor}` : ""}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `core-questions-template${templateFor ? `-${templateFor}` : ""}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      onToast("Couldn't download the template.");
    }
  };

  const check = async () => {
    if (!file) return;
    setBusy("check");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (zip) form.append("images", zip);
      form.append("mode", "dry_run");
      if (discipline) form.append("discipline", discipline);
      form.append("status", defaultStatus);
      const res = await api.postFormData<{ import: CoreImport }>("/admin/core/imports", form);
      setCurrent(res.import);
      void loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.file?.[0] ?? err.errors?.images?.[0] ?? err.message : "Couldn't check that file.");
    } finally {
      setBusy(null);
    }
  };

  const commit = async () => {
    if (!current) return;
    if (current.has_failures && !window.confirm(`${current.failed_rows} row(s) with errors will be skipped and only the ${current.valid_rows} valid row(s) imported. Continue?`)) return;
    setBusy("commit");
    setError(null);
    try {
      const res = await api.post<{ import: CoreImport }>(`/admin/core/imports/${current.id}/commit`);
      setCurrent(res.import);
      setFile(null);
      setZip(null);
      if (fileInput.current) fileInput.current.value = "";
      if (zipInput.current) zipInput.current.value = "";
      onToast(`Imported: ${res.import.created_rows} new, ${res.import.updated_rows} updated.`);
      onImported();
      void loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The import failed.");
    } finally {
      setBusy(null);
    }
  };

  const working = current !== null && ["pending", "processing"].includes(current.status);

  return (
    <div className="space-y-6">
      <section className="rounded-panel border border-border-subtle bg-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-primary"><FileSpreadsheet className="h-4 w-4 text-accent-primary" /> 1 · Get the template</h3>
        <p className="mt-1 max-w-2xl text-xs text-text-secondary">An Excel workbook with a Questions sheet, a “Subjects &amp; topics” sheet listing the exact codes accepted, and a Guide. Content vendors can fill it without asking you anything.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={templateFor} onChange={(e) => setTemplateFor(e.target.value as CoreDiscipline | "")} aria-label="Template for" className={sel}>
            <option value="">All branch families</option>
            <DisciplineOptions />
          </select>
          <button onClick={() => downloadTemplate("xlsx")} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary"><Download className="h-3.5 w-3.5" /> Excel template</button>
          <button onClick={() => downloadTemplate("csv")} className="text-2xs font-semibold text-text-muted underline-offset-4 hover:text-primary hover:underline">CSV instead</button>
        </div>
      </section>

      <section className="rounded-panel border border-border-subtle bg-surface p-5">
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-primary"><CloudUpload className="h-4 w-4 text-accent-primary" /> 2 · Check your file</h3>
        <p className="mt-1 text-xs text-text-secondary">Nothing is saved yet — every row is checked and you get a report.</p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors", file ? "border-accent-primary/50 bg-accent-primary/5" : "border-border-strong hover:border-accent-primary/40")}>
            <FileSpreadsheet className="h-6 w-6 shrink-0 text-text-muted" aria-hidden />
            <span className="min-w-0 flex-1 text-xs">
              <span className="block truncate font-bold text-primary">{file ? file.name : "Choose the questions file"}</span>
              <span className="text-text-muted">.xlsx, .csv or .json · up to 10 MB</span>
            </span>
            <input ref={fileInput} type="file" accept=".xlsx,.csv,.json,.txt" className="sr-only" aria-label="Questions file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setCurrent(null); }} />
          </label>
          <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors", zip ? "border-accent-primary/50 bg-accent-primary/5" : "border-border-strong hover:border-accent-primary/40")}>
            <FileArchive className="h-6 w-6 shrink-0 text-text-muted" aria-hidden />
            <span className="min-w-0 flex-1 text-xs">
              <span className="block truncate font-bold text-primary">{zip ? zip.name : "Figures ZIP (optional)"}</span>
              <span className="text-text-muted">PNG / JPG / WebP named in the “image” column</span>
            </span>
            <input ref={zipInput} type="file" accept=".zip" className="sr-only" aria-label="Figures ZIP" onChange={(e) => { setZip(e.target.files?.[0] ?? null); setCurrent(null); }} />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-2xs font-semibold text-text-secondary">
            All rows belong to
            <select value={discipline} onChange={(e) => setDiscipline(e.target.value as CoreDiscipline | "")} className={sel}>
              <option value="">the family written in each row</option>
              <DisciplineOptions />
            </select>
          </label>
          <label className="flex items-center gap-2 text-2xs font-semibold text-text-secondary">
            Rows without a status become
            <select value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value)} className={sel}>
              <option value="draft">Draft</option><option value="in_review">In review</option><option value="published">Published</option>
            </select>
          </label>
          <button onClick={check} disabled={!file || busy !== null || working} className="ml-auto inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-2xs font-bold text-white disabled:opacity-50">
            {busy === "check" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Check file
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-2xs font-semibold text-status-danger">{error}</p>}
      </section>

      {current && (
        <section className="rounded-panel border border-border-subtle bg-surface p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-extrabold text-primary">
              {current.status === "failed" ? <TriangleAlert className="h-4 w-4 text-status-danger" /> : working ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-status-success" />}
              {current.mode === "dry_run" ? "3 · Report" : "Import result"} <span className="font-normal text-text-muted">— {current.filename}</span>
            </h3>
            <span className={cn("rounded-full px-2.5 py-1 text-3xs font-bold uppercase tracking-wide", STATUS_TONE[current.status])}>{STATUS_TEXT[current.status]}</span>
          </div>

          {!working && current.status !== "failed" && (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  { k: "Rows", v: current.total_rows },
                  { k: current.mode === "dry_run" ? "Valid" : "Imported", v: current.mode === "dry_run" ? current.valid_rows : current.created_rows + current.updated_rows, tone: "text-status-success" },
                  { k: current.mode === "dry_run" ? "Will be new" : "New", v: current.created_rows, tone: undefined },
                  { k: current.mode === "dry_run" ? "Will update" : "Updated", v: current.updated_rows, tone: undefined },
                  { k: "Errors", v: current.failed_rows, tone: current.failed_rows > 0 ? "text-status-danger" : undefined },
                ].map((s) => (
                  <div key={s.k} className="rounded-control border border-border-subtle bg-elevated/50 px-3 py-2.5">
                    <dd className={cn("tabular text-lg font-extrabold text-primary", s.tone)}>{s.v.toLocaleString("en-IN")}</dd>
                    <dt className="text-3xs font-semibold uppercase tracking-wide text-text-muted">{s.k}</dt>
                  </div>
                ))}
              </dl>

              {current.summary && Object.keys(current.summary.by_subject).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-3xs font-bold uppercase tracking-wide text-text-muted">By subject</h4>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(current.summary.by_subject).map(([name, n]) => (
                      <li key={name} className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-2xs text-text-secondary">{name} <strong className="text-primary">{n}</strong></li>
                    ))}
                  </ul>
                  {(current.summary.without_external_id > 0 || current.summary.downgraded_to_review > 0) && (
                    <p className="mt-2 text-2xs text-text-muted">
                      {current.summary.without_external_id > 0 && <>{current.summary.without_external_id} row(s) have no id, so re-uploading them would create duplicates. </>}
                      {current.summary.downgraded_to_review > 0 && <>{current.summary.downgraded_to_review} row(s) asked to publish were set to “in review” (a second person must publish).</>}
                    </p>
                  )}
                </div>
              )}

              {current.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-3xs font-bold uppercase tracking-wide text-status-danger">What needs fixing {current.errors.length >= 300 && "(first 300)"}</h4>
                  <div className="mt-1.5 max-h-72 overflow-auto rounded-control border border-border-subtle">
                    <table className="w-full text-left text-2xs">
                      <thead className="sticky top-0 bg-elevated text-3xs uppercase tracking-wide text-text-muted"><tr><th className="px-3 py-1.5">Row</th><th className="px-3 py-1.5">Id</th><th className="px-3 py-1.5">Column</th><th className="px-3 py-1.5">Problem</th></tr></thead>
                      <tbody className="divide-y divide-border-subtle">
                        {current.errors.map((e, i) => (
                          <tr key={i}><td className="tabular px-3 py-1.5 font-bold text-primary">{e.row}</td><td className="px-3 py-1.5 font-mono text-text-muted">{e.external_id ?? "—"}</td><td className="px-3 py-1.5 font-semibold text-text-secondary">{e.field}</td><td className="px-3 py-1.5 text-text-secondary">{e.message}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {current.mode === "dry_run" && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                  <p className="max-w-xl text-2xs text-text-secondary">
                    {current.failed_rows === 0 ? "Everything checks out." : "Fix the rows above in your file and check it again — or import the valid rows now and fix the rest after."}
                  </p>
                  <button onClick={commit} disabled={!current.can_commit || busy !== null} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-2xs font-bold text-white disabled:opacity-40">
                    {busy === "commit" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Import {current.valid_rows.toLocaleString("en-IN")} valid row{current.valid_rows === 1 ? "" : "s"}
                  </button>
                </div>
              )}
            </>
          )}
          {current.status === "failed" && current.errors[0] && <p role="alert" className="mt-3 text-xs font-semibold text-status-danger">{current.errors[0].message}</p>}
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h3 className="mb-2 text-2xs font-bold uppercase tracking-wide text-text-muted">Recent imports</h3>
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-panel border border-border-subtle bg-surface">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-2xs">
                <span className="min-w-0 flex-1 truncate font-semibold text-primary">{h.filename}</span>
                <span className="text-text-muted">{h.mode === "dry_run" ? "Check" : "Import"} · {fmt(h.created_at)}</span>
                <span className="tabular text-text-secondary">{h.total_rows} rows{h.failed_rows > 0 ? ` · ${h.failed_rows} errors` : ""}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", STATUS_TONE[h.status])}>{STATUS_TEXT[h.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
