"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle, XCircle, Clock, FileSpreadsheet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface BulkImportStudentsPanelProps {
  /** Omit for the TPO self-serve path (scoped to the caller's own college
   * server-side); pass an explicit college id for the Mellow-staff-assisted
   * path (a college that sent us their roster instead of uploading it
   * themselves). */
  collegeId?: number;
  collegeName: string;
}

type ImportStatus = "pending" | "processing" | "completed" | "completed_with_errors" | "failed";

interface ImportError {
  row: number | null;
  email: string | null;
  error: string;
}

interface ApiStudentImport {
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
  processing: { label: "Processing", icon: Loader2, className: "bg-accent-primary/15 text-accent-primary" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-status-success/15 text-status-success" },
  completed_with_errors: { label: "Completed (with errors)", icon: AlertTriangle, className: "bg-status-warning/15 text-status-warning" },
  failed: { label: "Failed", icon: XCircle, className: "bg-status-danger/15 text-status-danger" },
};

function basePath(collegeId?: number) {
  return collegeId ? `/admin/colleges/${collegeId}/students` : "/tpo/students";
}

/** The template download is a static, college-agnostic file, so — unlike
 * every other endpoint here — it's registered flat (`/admin/students/...`,
 * `/tpo/students/...`) with no `/colleges/{id}/` segment. Reusing
 * `basePath()` for it 404s in the Mellow-staff-assisted path. */
function templatePath(collegeId?: number) {
  return collegeId ? "/admin/students/import-template" : "/tpo/students/import-template";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function BulkImportStudentsPanel({ collegeId, collegeName }: BulkImportStudentsPanelProps) {
  const [imports, setImports] = useState<ApiStudentImport[]>([]);
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
      const res = await api.get<{ imports: ApiStudentImport[] }>(`${basePath(collegeId)}/imports`);
      setImports(res.imports);
      return res.imports;
    } catch {
      return [];
    } finally {
      setLoadingImports(false);
    }
  }, [collegeId]);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  // Poll the active import until it leaves pending/processing, then stop —
  // this is the only network chatter this panel generates once an import
  // settles, so it's cheap to leave running while someone watches it work.
  useEffect(() => {
    if (!activeImportId) return;

    const poll = async () => {
      const list = await loadImports();
      const current = list.find((i) => i.id === activeImportId);
      if (current && (current.status === "completed" || current.status === "completed_with_errors" || current.status === "failed")) {
        if (pollRef.current) clearInterval(pollRef.current);
        setActiveImportId(null);
      }
    };

    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeImportId, loadImports]);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await api.getFile(templatePath(collegeId));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "student-import-template.csv";
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
      const res = await api.postFormData<{ import: ApiStudentImport }>(`${basePath(collegeId)}/import`, formData);
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
            <FileSpreadsheet className="w-4 h-4 text-accent-primary" />
            <span>Bulk Import Students</span>
          </h3>
          <p className="text-2xs text-text-muted mt-0.5">
            Add {collegeName}&apos;s whole batch at once — each new student gets an emailed login the moment their row is created.
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          disabled={downloadingTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-semibold text-text-secondary hover:text-primary transition-colors disabled:opacity-50 shrink-0"
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
          className="flex-1 w-full text-2xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-control file:border-0 file:bg-accent-primary/10 file:text-accent-primary file:text-2xs file:font-bold"
        />
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors disabled:opacity-50 shrink-0 w-full sm:w-auto justify-center"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          <span>Upload &amp; Import</span>
        </button>
      </div>
      {uploadError && <p className="text-2xs text-status-danger">{uploadError}</p>}

      {loadingImports ? (
        <div className="p-6 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading import history...
        </div>
      ) : imports.length === 0 ? (
        <p className="text-2xs text-text-muted text-center py-4">No imports yet — upload a CSV to add your first batch.</p>
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
                    <p className="text-3xs text-text-muted mt-0.5">{formatDate(imp.created_at)}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-3xs font-bold",
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
                      <div className="h-full rounded-full bg-accent-primary transition-all" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="text-3xs text-text-muted">
                      {imp.processed_rows} / {imp.total_rows || "…"} rows processed
                    </p>
                  </div>
                ) : (
                  <div className="mt-2.5 flex items-center gap-4 text-2xs">
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
                      <p key={i} className="text-3xs text-text-muted font-mono">
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
