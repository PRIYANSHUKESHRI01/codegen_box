"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Download, FileText, History } from "lucide-react";
import { HpButton } from "@/components/portal/kit";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { downloadStoredReport, formatBytes, generateStudentReport, listStudentReports, reportWhen, studentReportPaths, type ReportRecord } from "@/lib/reportDocuments";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

/**
 * "Download the full report" for one student, plus the list of every report already made about them.
 *
 * Pressing the button has the server render the report now (readiness, coding, contests, AI interviews, soft skills, drives,
 * integrity record, follow-ups for staff), STORE it, and hands the file back. The history below is the archive: opening an older
 * row downloads that stored file exactly as it was, not a regenerated one. A student's own copy leaves out the college's internal notes.
 */
export function StudentReportPanel({
  studentId,
  studentName,
  variant = "secondary",
  className,
}: {
  /** Omit on a student's own page — the server uses the signed-in student. */
  studentId?: number;
  studentName?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { user } = useAuth();
  const role = user?.role;
  const paths = studentReportPaths(role, studentId);

  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<ReportRecord[] | null>(null);
  const [open, setOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReports(await listStudentReports(role, studentId));
    } catch {
      setReports([]);
    }
  }, [role, studentId]);

  // A different student (the drawer is reused) starts from a clean slate.
  useEffect(() => {
    setReports(null);
    setOpen(false);
  }, [studentId]);

  useEffect(() => {
    if (open && reports === null) void load();
  }, [open, reports, load]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const report = await generateStudentReport(role, studentId);
      await downloadStoredReport(paths.download(report.id), report.filename);
      toast.success(`${studentName ? `${studentName}'s report` : "Your report"} is ready${report.pages ? ` · ${report.pages} pages` : ""} and saved to the history.`);
      setReports((prev) => (prev === null ? prev : [report, ...prev]));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't make the report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (report: ReportRecord) => {
    setDownloadingId(report.id);
    try {
      await downloadStoredReport(paths.download(report.id), report.filename);
      setReports((prev) => prev?.map((r) => (r.id === report.id ? { ...r, downloads: r.downloads + 1 } : r)) ?? prev);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't open that report.");
      // A 410 means the stored file is gone; the row is still listed, so say how to get a fresh one.
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <HpButton variant={variant} size="md" className="w-full" onClick={() => void generate()} isLoading={busy} leftIcon={<FileText className="h-4 w-4" />}>
        {busy ? "Preparing the report…" : "Download full report (PDF)"}
      </HpButton>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-control px-1 py-1 text-2xs font-semibold text-text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <span className="inline-flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" aria-hidden /> Earlier reports{reports ? ` (${reports.length})` : ""}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <ul className="space-y-1.5" aria-label="Earlier reports">
          {reports === null && <li className="px-1 text-2xs text-text-muted">Loading…</li>}
          {reports?.length === 0 && <li className="px-1 text-2xs text-text-muted">Nothing saved yet — the first report you make is kept here.</li>}
          {reports?.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-control border border-border-subtle bg-elevated/60 px-2.5 py-2">
              <div className="min-w-0">
                <p className="truncate text-2xs font-bold text-primary">{reportWhen(r.created_at)}</p>
                <p className="truncate text-3xs text-text-muted">
                  {r.pages ? `${r.pages} pp · ` : ""}
                  {formatBytes(r.size_bytes)}
                  {typeof r.summary.readiness === "number" ? ` · readiness ${r.summary.readiness}` : ""}
                  {r.generated_by?.name ? ` · by ${r.generated_by.name}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void reopen(r)}
                disabled={downloadingId === r.id}
                aria-label={`Download the report made ${reportWhen(r.created_at)}`}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border-strong bg-surface px-2.5 py-1 text-3xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-60"
              >
                <Download className="h-3 w-3" aria-hidden /> {downloadingId === r.id ? "…" : "PDF"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
