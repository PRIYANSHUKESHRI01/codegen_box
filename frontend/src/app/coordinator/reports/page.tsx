"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Users2, Download, Eye, FileText, CheckCircle2, X, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { CohortStudent } from "@/types/cohort";
import type { ReportPreview } from "@/lib/generateTpoReports";
import type { CoordinatorReportsData } from "@/lib/generateCoordinatorReports";

const AT_RISK_THRESHOLD = 60;

type ReportFormat = "PDF" | "Excel";

interface LiveStat {
  text: string;
  tone?: "default" | "danger" | "success";
}

interface ReportDef {
  id: string;
  name: string;
  description: string;
  format: ReportFormat;
  icon: typeof ShieldCheck;
  generate: (data: CoordinatorReportsData) => Promise<{ blob: Blob; filename: string }>;
  preview?: (data: CoordinatorReportsData) => Promise<ReportPreview>;
  liveStat: (summary: SectionSummary) => LiveStat;
}

// jsPDF + ExcelJS (~500kB combined) live behind this dynamic import instead
// of a top-level one — see admin/reports/page.tsx's identical pattern.
function loadReportLib() {
  return import("@/lib/generateCoordinatorReports");
}

/** Real, derived-on-load section figures — the same numbers the snapshot strip and each report card's live stat both read from. */
interface SectionSummary {
  sectionSize: number;
  avgCgpa: number | null;
  avgReadiness: number;
  needsAttentionCount: number;
}

function computeSummary(students: CohortStudent[]): SectionSummary {
  const cgpas = students.filter((s) => s.cgpa !== null).map((s) => Number(s.cgpa));

  return {
    sectionSize: students.length,
    avgCgpa: cgpas.length ? cgpas.reduce((a, b) => a + b, 0) / cgpas.length : null,
    avgReadiness: students.length ? Math.round(students.reduce((sum, s) => sum + s.readiness_score, 0) / students.length) : 0,
    needsAttentionCount: students.filter((s) => s.readiness_score < AT_RISK_THRESHOLD).length,
  };
}

const REPORTS: ReportDef[] = [
  {
    id: "academic",
    name: "Section Readiness & Academic Report",
    description: "CGPA, backlog and readiness-tier breakdown for your section, plus a real follow-up list of who's currently below the readiness threshold.",
    format: "PDF",
    icon: ShieldCheck,
    generate: async (data) => (await loadReportLib()).generateSectionAcademicReport(data),
    liveStat: (s) =>
      s.needsAttentionCount > 0
        ? { text: `${s.needsAttentionCount} student(s) need follow-up`, tone: "danger" }
        : { text: "Nobody currently below the readiness threshold", tone: "success" },
  },
  {
    id: "cohort",
    name: "Section Cohort Report",
    description: "Every student in your section — academic profile, contact info, readiness score and 7-day practice consistency.",
    format: "Excel",
    icon: Users2,
    generate: async (data) => (await loadReportLib()).generateSectionCohortReport(data),
    preview: async (data) => (await loadReportLib()).sectionCohortRows(data),
    liveStat: (s) => ({ text: `${s.sectionSize} student${s.sectionSize === 1 ? "" : "s"} on file` }),
  },
];

const FORMAT_STYLE: Record<ReportFormat, string> = {
  PDF: "bg-status-danger/10 text-status-danger border-status-danger/25",
  Excel: "bg-status-success/10 text-status-success border-status-success/25",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The Section Coordinator's counterpart to the TPO's Placement Reports page
 * — same "live snapshot + real, generated-on-demand reports" pattern, just
 * two reports instead of six, since a coordinator has no drive/placement
 * visibility to report on (that stays TPO-only). Everything here is
 * computed from GET /coordinator/students, the exact same data source the
 * roster page already uses — never a second, driftable data path.
 */
export default function CoordinatorReportsPage() {
  const { user, status } = useAuthGuard(["section_coordinator"]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [students, setStudents] = useState<CohortStudent[]>([]);
  const [section, setSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<{ name: string; preview: ReportPreview } | null>(null);
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ students: CohortStudent[]; section: string | null }>("/coordinator/students");
      setStudents(res.students);
      setSection(res.section);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadData();
  }, [status, loadData]);

  const collegeName = user?.college?.name ?? "your college";
  const data: CoordinatorReportsData | null = section ? { collegeName, section, students } : null;

  // Same real-anchor-not-window.open() approach as the TPO reports page —
  // see that file's docblock for why a synthetic anchor click is the only
  // approach that reliably opens a blob: URL in a new tab (doubly true now
  // that generation is async — window.open() after an await gets popup-blocked).
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const urls: Record<string, string> = {};

    Promise.all(
      REPORTS.filter((r) => !r.preview).map(async (r) => {
        const { blob } = await r.generate(data);
        urls[r.id] = URL.createObjectURL(blob);
      })
    ).then(() => {
      if (!cancelled) setPdfUrls(urls);
    });

    return () => {
      cancelled = true;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [data]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const summary = data ? computeSummary(data.students) : null;

  const handleViewPreview = async (report: ReportDef) => {
    if (!data || !report.preview) return;
    setBusyId(`${report.id}-view`);
    try {
      const preview = await report.preview(data);
      setPreviewReport({ name: report.name, preview });
    } catch {
      triggerToast(`Couldn't load "${report.name}". Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (report: ReportDef) => {
    if (!data) return;
    setBusyId(`${report.id}-download`);
    try {
      const { blob, filename } = await report.generate(data);
      downloadBlob(blob, filename);
      triggerToast(`"${report.name}" downloaded.`);
    } catch {
      triggerToast(`Couldn't generate "${report.name}". Please try again.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardShell
      role="section_coordinator"
      title="Section Reports"
      subtitle={
        section
          ? `Real, live reports generated from Section ${section}'s current roster — view or download any time.`
          : "Real, live reports generated from your section's current roster — view or download any time."
      }
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {loadError && (
        <div className="p-4 rounded-panel bg-status-danger/10 border border-status-danger/25 text-xs text-status-danger flex items-center justify-between">
          <span>{loadError}</span>
          <button onClick={loadData} className="font-bold underline shrink-0">
            Retry
          </button>
        </div>
      )}

      {/* Section snapshot — real, live context before spending a click on either report. */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(
            [
              ["Section Size", String(summary.sectionSize), "text-primary"],
              ["Avg CGPA", summary.avgCgpa !== null ? summary.avgCgpa.toFixed(2) : "—", "text-primary"],
              ["Avg Readiness", `${summary.avgReadiness}/100`, "text-primary"],
              [
                "Needs Attention",
                String(summary.needsAttentionCount),
                summary.needsAttentionCount > 0 ? "text-status-danger" : "text-status-success",
              ],
            ] as [string, string, string][]
          ).map(([label, value, tone]) => (
            <div key={label} className="p-3.5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">{label}</span>
              <div className={cn("text-xl font-black font-mono mt-1.5", tone)}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const downloadBusy = busyId === `${report.id}-download`;
          const viewBusy = busyId === `${report.id}-view`;
          const liveStat = summary ? report.liveStat(summary) : null;

          return (
            <div
              key={report.id}
              className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle hover:border-border-strong transition-all flex flex-col"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-11 h-11 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded-full border", FORMAT_STYLE[report.format])}>
                  {report.format}
                </span>
              </div>

              <h3 className="text-sm font-bold text-primary mb-1.5">{report.name}</h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-3 flex-1">{report.description}</p>

              {liveStat && (
                <p
                  className={cn(
                    "text-[10.5px] font-bold mb-4 flex items-center gap-1.5",
                    liveStat.tone === "danger"
                      ? "text-status-danger"
                      : liveStat.tone === "success"
                        ? "text-status-success"
                        : "text-accent-primary"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                  <span>{liveStat.text}</span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-2">
                {report.preview ? (
                  <button
                    onClick={() => handleViewPreview(report)}
                    disabled={loading || !data || viewBusy}
                    className="py-2.5 rounded-btn bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {viewBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>View</span>
                  </button>
                ) : (
                  <a
                    href={pdfUrls[report.id] ?? "#"}
                    target="_blank"
                    rel="noopener"
                    aria-disabled={!pdfUrls[report.id]}
                    onClick={(e) => {
                      if (!pdfUrls[report.id]) e.preventDefault();
                    }}
                    className={cn(
                      "py-2.5 rounded-btn bg-elevated hover:bg-surface-hover border border-border-subtle text-text-secondary hover:text-primary text-xs font-bold transition-all flex items-center justify-center gap-2",
                      !pdfUrls[report.id] && "opacity-60 pointer-events-none"
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </a>
                )}
                <button
                  onClick={() => handleDownload(report)}
                  disabled={loading || !data || downloadBusy}
                  className="py-2.5 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {downloadBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>Download</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview modal for the tabular (Excel) report */}
      <AnimatePresence>
        {previewReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="w-full max-w-4xl max-h-[85vh] rounded-panel bg-surface border border-border-strong shadow-card flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border-subtle shrink-0">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent-primary" />
                  <span>{previewReport.name}</span>
                  <span className="text-[10px] font-normal text-text-muted">
                    ({previewReport.preview.rows.length} row{previewReport.preview.rows.length === 1 ? "" : "s"})
                  </span>
                </h3>
                <button onClick={() => setPreviewReport(null)} className="p-1 rounded text-text-muted hover:text-primary">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-auto p-4">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-elevated/70 text-text-muted font-bold uppercase tracking-wider text-[10px] sticky top-0">
                    <tr>
                      {previewReport.preview.headers.map((h) => (
                        <th key={h} className="px-3 py-2">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {previewReport.preview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-surface-hover/60">
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2 text-text-secondary">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardShell>
  );
}
