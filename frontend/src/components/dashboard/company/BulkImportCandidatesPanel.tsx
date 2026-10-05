"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  CloudUpload,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HpButton, HpCard, HpIconTile, HpPill, HpSkeleton, HP_TONES, hpEase, type HpTone } from "@/components/portal/kit";
import { HpFormError } from "@/components/portal/pipeline-kit";

interface BulkImportCandidatesPanelProps {
  placementDriveId: number;
  openingTitle: string;
  onImported?: () => void;
}

type ImportStatus = "pending" | "processing" | "completed" | "completed_with_errors" | "failed";

interface ImportError {
  row: number | null;
  email: string | null;
  error: string;
}

interface ApiCandidateImport {
  id: number;
  original_filename: string;
  status: ImportStatus;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  errors: ImportError[] | null;
  created_at: string;
}

const STATUS_META: Record<ImportStatus, { label: string; icon: typeof Clock; tone: HpTone }> = {
  pending: { label: "Queued", icon: Clock, tone: "slate" },
  processing: { label: "Processing", icon: Loader2, tone: "sky" },
  completed: { label: "Completed", icon: CheckCircle2, tone: "emerald" },
  completed_with_errors: { label: "Completed (with errors)", icon: AlertTriangle, tone: "amber" },
  failed: { label: "Failed", icon: XCircle, tone: "rose" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Mirrors BulkImportStudentsPanel's shape (upload + polling import history) but scoped to a job opening's pipeline instead of a college roster — a candidate CSV has no academic columns, only name/email/phone. */
export function BulkImportCandidatesPanel({ placementDriveId, openingTitle, onImported }: BulkImportCandidatesPanelProps) {
  const [imports, setImports] = useState<ApiCandidateImport[]>([]);
  const [loadingImports, setLoadingImports] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeImportId, setActiveImportId] = useState<number | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [expandedErrorsId, setExpandedErrorsId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImports = useCallback(async () => {
    try {
      const res = await api.get<{ imports: ApiCandidateImport[] }>(`/company/drives/${placementDriveId}/candidates/imports`);
      setImports(res.imports);
      return res.imports;
    } catch {
      return [];
    } finally {
      setLoadingImports(false);
    }
  }, [placementDriveId]);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  useEffect(() => {
    if (!activeImportId) return;

    const poll = async () => {
      const list = await loadImports();
      const current = list.find((i) => i.id === activeImportId);
      if (current && (current.status === "completed" || current.status === "completed_with_errors" || current.status === "failed")) {
        if (pollRef.current) clearInterval(pollRef.current);
        setActiveImportId(null);
        onImported?.();
      }
    };

    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeImportId, loadImports, onImported]);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await api.getFile("/company/candidates/import-template");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "candidate-import-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setUploadError("Failed to download the template. Please try again.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.postFormData<{ import: ApiCandidateImport }>(`/company/drives/${placementDriveId}/candidates/import`, formData);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setActiveImportId(res.import.id);
      await loadImports();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Failed to start the import.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <HpCard spotlight={false} className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <HpIconTile icon={FileSpreadsheet} tone="teal" size="md" />
          <div className="min-w-0">
            <h3 className="text-15 font-bold tracking-tight text-primary">Bulk Import Candidates</h3>
            <p className="mt-0.5 max-w-xl text-2xs leading-relaxed text-text-muted">
              Add a whole batch of candidates to {openingTitle} at once — each one gets an emailed invite the moment their row is created.
            </p>
          </div>
        </div>
        <HpButton
          variant="secondary"
          size="sm"
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          isLoading={downloadingTemplate}
          leftIcon={<Download className="h-3.5 w-3.5" />}
        >
          Download CSV Template
        </HpButton>
      </div>

      {/* Drop zone — the native file input is stretched invisibly over the
          whole zone, so click-to-browse and drag-and-drop are both the
          browser's own file-input behaviour (no custom drop handling). */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div
          className={cn(
            "group relative flex min-w-0 flex-1 items-center gap-4 rounded-2xl border-2 border-dashed p-4 transition-all duration-200 focus-within:border-indigo-500/60 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.14)]",
            file
              ? "border-indigo-500/40 bg-indigo-500/[0.05]"
              : "border-border-strong bg-elevated/40 hover:border-indigo-500/40 hover:bg-indigo-500/[0.03]"
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-label="Choose a candidate CSV file"
            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
          />
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:-translate-y-0.5",
              file ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "bg-[rgb(var(--bg-surface-rgb))] text-text-muted ring-1 ring-inset ring-border-subtle"
            )}
          >
            {file ? <FileText className="h-5 w-5" /> : <CloudUpload className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            {file ? (
              <>
                <span className="block truncate text-13 font-semibold text-primary">{file.name}</span>
                <span className="block text-2xs text-text-muted">{formatBytes(file.size)} · click to choose a different file</span>
              </>
            ) : (
              <>
                <span className="block text-13 font-semibold text-primary">
                  Drop a CSV here, or <span className="text-indigo-600 underline decoration-indigo-500/40 underline-offset-4 dark:text-indigo-300">browse</span>
                </span>
                <span className="block text-2xs text-text-muted">name, email and phone columns · .csv only</span>
              </>
            )}
          </span>
        </div>
        <HpButton
          onClick={handleUpload}
          disabled={!file || uploading}
          isLoading={uploading}
          leftIcon={<Upload className="h-4 w-4" />}
          className="h-auto min-h-[44px] w-full sm:w-auto"
        >
          Upload &amp; Import
        </HpButton>
      </div>
      {uploadError && <HpFormError>{uploadError}</HpFormError>}

      <div className="space-y-2.5">
        <h4 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Import history</h4>

        {loadingImports ? (
          <div className="space-y-2" role="status" aria-label="Loading import history">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border-subtle p-3.5">
                <HpSkeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <HpSkeleton className="h-3 w-1/3" />
                  <HpSkeleton className="h-2.5 w-1/5" />
                </div>
                <HpSkeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : imports.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-subtle px-4 py-6 text-center">
            <FileSpreadsheet className="h-5 w-5 text-text-muted" />
            <p className="text-2xs text-text-muted">No imports yet — upload a CSV to add your first batch.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {imports.map((imp) => {
              const meta = STATUS_META[imp.status];
              const StatusIcon = meta.icon;
              const isActive = imp.status === "pending" || imp.status === "processing";
              const progressPct = imp.total_rows > 0 ? Math.round((imp.processed_rows / imp.total_rows) * 100) : 0;
              const expanded = expandedErrorsId === imp.id;

              return (
                <div
                  key={imp.id}
                  className="rounded-2xl border border-border-subtle bg-elevated/40 p-3.5 transition-colors duration-200 hover:border-border-strong"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bg-surface-rgb))] text-text-muted ring-1 ring-inset ring-border-subtle">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-primary">{imp.original_filename}</p>
                        <p className="mt-0.5 text-3xs text-text-muted">{formatDate(imp.created_at)}</p>
                      </div>
                    </div>
                    <HpPill tone={meta.tone} size="sm" className="shrink-0">
                      <StatusIcon className={cn("h-3 w-3", imp.status === "processing" && "animate-spin")} strokeWidth={2.4} />
                      {meta.label}
                    </HpPill>
                  </div>

                  {isActive ? (
                    <div className="mt-3 space-y-1.5">
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-surface-rgb))] ring-1 ring-inset ring-border-subtle"
                        role="progressbar"
                        aria-valuenow={progressPct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${imp.original_filename} import progress`}
                      >
                        <motion.div
                          className={cn("h-full rounded-full", HP_TONES.indigo.bar)}
                          initial={false}
                          animate={{ width: `${progressPct}%` }}
                          transition={{ duration: 0.6, ease: hpEase }}
                        />
                      </div>
                      <p className="tabular text-3xs text-text-muted">
                        {imp.processed_rows} / {imp.total_rows || "…"} rows processed
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs">
                      <span className="tabular inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {imp.successful_rows} added
                      </span>
                      {imp.failed_rows > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedErrorsId(expandedErrorsId === imp.id ? null : imp.id)}
                          aria-expanded={expanded}
                          className="tabular inline-flex items-center gap-1 rounded-md font-semibold text-amber-700 transition-colors hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-amber-300 dark:hover:text-amber-200"
                        >
                          {imp.failed_rows} failed — {expanded ? "hide" : "view"} details
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", expanded && "rotate-180")} />
                        </button>
                      )}
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {expanded && imp.errors && imp.errors.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: hpEase }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-rose-500/15 bg-rose-500/[0.04] p-3">
                          {imp.errors.map((err, i) => (
                            <p key={i} className="font-mono text-3xs leading-relaxed text-text-muted">
                              <span className="font-semibold text-text-secondary">{err.row ? `Row ${err.row}` : "General"}</span>
                              {err.email ? ` (${err.email})` : ""}: <span className="text-rose-700 dark:text-rose-300">{err.error}</span>
                            </p>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </HpCard>
  );
}
