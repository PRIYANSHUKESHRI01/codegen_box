"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle, XCircle, Clock, FileSpreadsheet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

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

const STATUS_META: Record<ImportStatus, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: "Queued", icon: Clock, className: "bg-elevated text-text-muted" },
  processing: { label: "Processing", icon: Loader2, className: "bg-teal-500/15 text-teal-500" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-status-success/15 text-status-success" },
  completed_with_errors: { label: "Completed (with errors)", icon: AlertTriangle, className: "bg-status-warning/15 text-status-warning" },
  failed: { label: "Failed", icon: XCircle, className: "bg-status-danger/15 text-status-danger" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
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
    <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-sm text-primary flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-teal-500" />
            <span>Bulk Import Candidates</span>
          </h3>
          <p className="text-[11px] text-text-muted mt-0.5">
            Add a whole batch of candidates to {openingTitle} at once — each one gets an emailed invite the moment their row is created.
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors disabled:opacity-50 shrink-0"
        >
          {downloadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span>Download CSV Template</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2 p-3 rounded-control bg-elevated/60 border border-dashed border-border-subtle">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex-1 w-full text-[11px] text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-control file:border-0 file:bg-teal-500/10 file:text-teal-500 file:text-[11px] file:font-bold"
        />
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-[11px] font-bold transition-colors disabled:opacity-50 shrink-0 w-full sm:w-auto justify-center"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <span>Upload &amp; Import</span>
        </button>
      </div>
      {uploadError && <p className="text-[11px] text-status-danger">{uploadError}</p>}

      {loadingImports ? (
        <div className="p-6 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading import history...
        </div>
      ) : imports.length === 0 ? (
        <p className="text-[11px] text-text-muted text-center py-4">No imports yet — upload a CSV to add your first batch.</p>
      ) : (
        <div className="space-y-2">
          {imports.map((imp) => {
            const meta = STATUS_META[imp.status];
            const StatusIcon = meta.icon;
            const isActive = imp.status === "pending" || imp.status === "processing";
            const progressPct = imp.total_rows > 0 ? Math.round((imp.processed_rows / imp.total_rows) * 100) : 0;

            return (
              <div key={imp.id} className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary truncate">{imp.original_filename}</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{formatDate(imp.created_at)}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
                      meta.className
                    )}
                  >
                    <StatusIcon className={cn("w-3 h-3", imp.status === "processing" && "animate-spin")} />
                    {meta.label}
                  </span>
                </div>

                {isActive ? (
                  <div className="mt-2.5 space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="text-[10px] text-text-muted">
                      {imp.processed_rows} / {imp.total_rows || "…"} rows processed
                    </p>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center gap-4 text-[11px]">
                    <span className="text-status-success font-semibold">{imp.successful_rows} added</span>
                    {imp.failed_rows > 0 && (
                      <button
                        onClick={() => setExpandedErrorsId(expandedErrorsId === imp.id ? null : imp.id)}
                        className="text-status-warning font-semibold hover:underline"
                      >
                        {imp.failed_rows} failed — {expandedErrorsId === imp.id ? "hide" : "view"} details
                      </button>
                    )}
                  </div>
                )}

                {expandedErrorsId === imp.id && imp.errors && imp.errors.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-border-subtle space-y-1 max-h-40 overflow-y-auto">
                    {imp.errors.map((err, i) => (
                      <p key={i} className="text-[10px] text-text-muted font-mono">
                        {err.row ? `Row ${err.row}` : "General"}
                        {err.email ? ` (${err.email})` : ""}: <span className="text-status-danger">{err.error}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
