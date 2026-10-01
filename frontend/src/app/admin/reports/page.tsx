"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Users2,
  Building2,
  AlertTriangle,
  Filter,
  Presentation,
  Download,
  Eye,
  FileText,
  CheckCircle2,
  X,
  Loader2,
  Mail,
  Phone,
  Trophy,
  UserX,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { TpoReportsData, ReportPreview } from "@/lib/generateTpoReports";
import { computeSectionStats, type SectionCoordinatorInfo } from "@/lib/sectionBreakdown";
import { Modal } from "@/components/ui/Modal";

// jsPDF + jspdf-autotable + ExcelJS (~500kB combined) live behind this one
// dynamic import instead of a top-level one — every REPORTS entry below
// calls through it on demand (view/download click, or the one-time PDF
// pre-generation effect), so the module is fetched as its own chunk after
// the page has already rendered and become interactive, never as part of
// this route's initial JS.
function loadReportLib() {
  return import("@/lib/generateTpoReports");
}

type ReportFormat = "PDF" | "Excel" | "CSV";
type ReportCategory = "Compliance" | "Operations" | "Analytics";

/** Real, derived-on-load cohort figures — the same numbers every report
 * below is built from, surfaced once here so both the page's snapshot strip
 * and each report card's live stat read from one source of truth. */
interface CohortSummary {
  totalStudents: number;
  branchCount: number;
  sectionCount: number;
  avgCgpa: number | null;
  avgReadiness: number;
  mappedDrives: number;
  nonCompliantTotal: number;
}

/**
 * `sectionFilter` narrows only the student-derived figures (total/branch/
 * section counts, avg CGPA/readiness) — `mappedDrives`/`nonCompliantTotal`
 * stay college-wide always, since a drive isn't a per-section concept (its
 * funnel is server-precomputed across the whole cohort, same reasoning as
 * complianceAuditRows in generateTpoReports.ts).
 */
function computeSummary(data: TpoReportsData, sectionFilter: string | null): CohortSummary {
  const { drives } = data;
  const students = sectionFilter ? data.students.filter((s) => (s.section ?? "Unassigned") === sectionFilter) : data.students;
  const cgpas = students.filter((s) => s.cgpa !== null).map((s) => Number(s.cgpa));

  return {
    totalStudents: students.length,
    branchCount: new Set(students.map((s) => s.branch).filter((b): b is string => !!b)).size,
    sectionCount: new Set(data.students.map((s) => s.section).filter((sec): sec is string => !!sec)).size,
    avgCgpa: cgpas.length ? cgpas.reduce((a, b) => a + b, 0) / cgpas.length : null,
    avgReadiness: students.length ? Math.round(students.reduce((sum, s) => sum + s.readiness_score, 0) / students.length) : 0,
    mappedDrives: drives.length,
    nonCompliantTotal: drives.reduce((sum, d) => sum + d.non_compliant.length, 0),
  };
}

interface LiveStat {
  text: string;
  tone?: "default" | "danger" | "success";
}

interface ReportDef {
  id: string;
  name: string;
  description: string;
  format: ReportFormat;
  category: ReportCategory;
  icon: typeof ShieldCheck;
  generate: (
    data: TpoReportsData,
    sectionFilter: string | null
  ) => Promise<{ blob: Blob; filename: string }> | { blob: Blob; filename: string };
  preview?: (data: TpoReportsData, sectionFilter: string | null) => Promise<ReportPreview>;
  /** Whether this report is meaningfully scoped by section — Directory/Funnel/Deck operate on drives, not per-student data, so the section filter never changes their output. */
  sectionAware?: boolean;
  /** A real, computed-on-the-spot figure shown on the card itself — so a TPO
   * knows roughly what a report contains before spending a click on it. */
  liveStat: (summary: CohortSummary) => LiveStat;
}

const REPORTS: ReportDef[] = [
  {
    id: "academic",
    name: "Batch Readiness & Academic Report",
    description: "Branch- and section-wise CGPA, backlog and readiness-tier breakdown, plus batch-wide summary stats.",
    format: "PDF",
    category: "Compliance",
    icon: ShieldCheck,
    generate: async (data, sectionFilter) => (await loadReportLib()).generateAcademicReport(data, sectionFilter),
    sectionAware: true,
    liveStat: (s) => ({
      text: `Avg CGPA ${s.avgCgpa !== null ? s.avgCgpa.toFixed(2) : "—"} · ${s.branchCount} branch${s.branchCount === 1 ? "" : "es"}, ${s.sectionCount} section${s.sectionCount === 1 ? "" : "s"}`,
    }),
  },
  {
    id: "cohort",
    name: "Student Cohort Report",
    description: "Every student in your batch — branch, section, academic profile, readiness score and 7-day practice consistency.",
    format: "Excel",
    category: "Operations",
    icon: Users2,
    generate: async (data, sectionFilter) => (await loadReportLib()).generateCohortExcelReport(data, sectionFilter),
    preview: async (data, sectionFilter) => (await loadReportLib()).cohortRows(data, sectionFilter),
    sectionAware: true,
    liveStat: (s) => ({ text: `${s.totalStudents} student${s.totalStudents === 1 ? "" : "s"} on file` }),
  },
  {
    id: "directory",
    name: "Company & Drive Directory",
    description: "Every company and drive currently mapped to your college, with eligibility criteria and reach.",
    format: "Excel",
    category: "Operations",
    icon: Building2,
    generate: async (data) => (await loadReportLib()).generateDriveDirectoryReport(data),
    preview: async (data) => (await loadReportLib()).driveDirectoryRows(data),
    liveStat: (s) => ({ text: `${s.mappedDrives} drive${s.mappedDrives === 1 ? "" : "s"} mapped` }),
  },
  {
    id: "compliance",
    name: "Eligibility & Compliance Audit",
    description: "Students who fail a mapped drive's CGPA, backlog or branch requirement, with exact reasons — flagged per drive.",
    format: "CSV",
    category: "Compliance",
    icon: AlertTriangle,
    generate: async (data, sectionFilter) => (await loadReportLib()).generateComplianceAuditReport(data, sectionFilter),
    preview: async (data, sectionFilter) => (await loadReportLib()).complianceAuditRows(data, sectionFilter),
    sectionAware: true,
    liveStat: (s) =>
      s.nonCompliantTotal > 0
        ? { text: `${s.nonCompliantTotal} flagged across active drives`, tone: "danger" }
        : { text: "No compliance issues found", tone: "success" },
  },
  {
    id: "funnel",
    name: "Drive Eligibility Funnel Report",
    description: "Per drive: how many students clear the CGPA bar, backlog limit and branch filter, down to fully eligible.",
    format: "PDF",
    category: "Analytics",
    icon: Filter,
    generate: async (data) => (await loadReportLib()).generateDriveFunnelReport(data),
    liveStat: (s) => ({ text: `${s.mappedDrives} drive${s.mappedDrives === 1 ? "" : "s"} tracked` }),
  },
  {
    id: "deck",
    name: "Management Readiness Deck",
    description: "Board-ready summary — headline stats, readiness tier mix, and your top mapped companies.",
    format: "PDF",
    category: "Analytics",
    icon: Presentation,
    generate: async (data) => (await loadReportLib()).generateManagementDeck(data),
    liveStat: (s) => ({ text: `${s.avgReadiness}/100 avg readiness across the batch` }),
  },
];

const CATEGORY_FILTERS = ["All", "Compliance", "Operations", "Analytics"] as const;

const FORMAT_STYLE: Record<ReportFormat, string> = {
  PDF: "bg-status-danger/10 text-status-danger border-status-danger/25",
  Excel: "bg-status-success/10 text-status-success border-status-success/25",
  CSV: "bg-accent-primary/10 text-accent-primary border-accent-primary/25",
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PlacementReportsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_FILTERS)[number]>("All");
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [data, setData] = useState<TpoReportsData | null>(null);
  const [coordinators, setCoordinators] = useState<(SectionCoordinatorInfo & { section: string })[]>([]);
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
      const [reportsRes, coordinatorsRes] = await Promise.all([
        api.get<TpoReportsData>("/tpo/reports/data"),
        api.get<{ coordinators: (SectionCoordinatorInfo & { section: string })[] }>("/tpo/coordinators"),
      ]);
      setData(reportsRes);
      setCoordinators(coordinatorsRes.coordinators);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadData();
  }, [status, loadData]);

  // "View" for the 3 PDF reports (no in-app preview table makes sense for a
  // PDF) is a real <a href target="_blank">, not a JS-triggered
  // window.open() — a real anchor's native click handling is the only
  // approach that reliably opened a blob: URL in a new tab in testing;
  // window.open() (even called synchronously from the onClick, even via a
  // synthetic anchor.click()) silently produced a blank tab when triggered
  // through React's event dispatch, and that restriction gets even stricter
  // once generation is itself async (a dynamic import + jsPDF work) — by the
  // time it resolves, it's no longer inside the original click's gesture, so
  // window.open() would get popup-blocked. Pre-building each PDF's blob URL
  // here — once per data load (and whenever the section filter changes, for
  // section-aware reports) — sidesteps that entirely: the report lib chunk
  // loads once in the background while the rest of the page is already
  // interactive, and by the time anyone clicks View, the anchor's href is
  // just a plain blob: URL.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const urls: Record<string, string> = {};

    Promise.all(
      REPORTS.filter((r) => !r.preview).map(async (r) => {
        const { blob } = await r.generate(data, r.sectionAware ? sectionFilter : null);
        urls[r.id] = URL.createObjectURL(blob);
      })
    ).then(() => {
      if (!cancelled) setPdfUrls(urls);
    });

    return () => {
      cancelled = true;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [data, sectionFilter]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const filtered = REPORTS.filter((r) => categoryFilter === "All" || r.category === categoryFilter);
  const summary = data ? computeSummary(data, sectionFilter) : null;
  const sectionStats = data ? computeSectionStats(data.students, coordinators) : [];

  const handleViewPreview = async (report: ReportDef) => {
    if (!data || !report.preview) return;
    setBusyId(`${report.id}-view`);
    try {
      const preview = await report.preview(data, report.sectionAware ? sectionFilter : null);
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
      const { blob, filename } = await report.generate(data, report.sectionAware ? sectionFilter : null);
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
      role="admin_tpo"
      currentTpoView="tpo"
      title="Placement Reports"
      subtitle="Real, live reports generated from your current student cohort and mapped drives — view or download any time."
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

      {/* Cohort snapshot — real, live context so a TPO knows what these
          reports actually contain before spending a click on any of them. */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(
            [
              ["Total Students", String(summary.totalStudents), "text-primary"],
              ["Branches", String(summary.branchCount), "text-primary"],
              ["Sections", String(summary.sectionCount), "text-primary"],
              ["Avg CGPA", summary.avgCgpa !== null ? summary.avgCgpa.toFixed(2) : "—", "text-primary"],
              ["Avg Readiness", `${summary.avgReadiness}/100`, "text-primary"],
              [
                "Compliance Flags",
                String(summary.nonCompliantTotal),
                summary.nonCompliantTotal > 0 ? "text-status-danger" : "text-status-success",
              ],
            ] as [string, string, string][]
          ).map(([label, value, tone]) => (
            <div key={label} className="p-3.5 rounded-panel bg-surface border border-border-subtle shadow-subtle">
              <span className="text-3xs font-semibold text-text-muted uppercase tracking-wider">{label}</span>
              <div className={cn("text-xl font-black font-mono mt-1.5", tone)}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Section Performance — ranked best-average-first, so a TPO can see at
          a glance which section is doing well and which needs attention,
          plus who to actually contact about it. Clicking a row (or the
          Filter button on the reports below) scopes the section-aware
          reports to just that section. */}
      {sectionStats.length > 0 && (
        <div className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-2xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-accent-primary" />
              Section Performance
            </h3>
            {sectionFilter && (
              <button
                onClick={() => setSectionFilter(null)}
                className="text-3xs font-bold text-accent-primary hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear filter ({sectionFilter})
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {sectionStats.map((s, i) => (
              <button
                key={s.section}
                onClick={() => setSectionFilter(sectionFilter === s.section ? null : s.section)}
                className={cn(
                  "w-full flex items-center gap-3 p-2.5 rounded-control border text-left transition-all",
                  sectionFilter === s.section
                    ? "bg-accent-primary/10 border-accent-primary/40"
                    : "bg-elevated/50 border-border-subtle hover:border-border-strong"
                )}
              >
                <span className="w-5 text-center text-2xs font-black text-text-muted font-mono shrink-0">#{i + 1}</span>
                <span className="text-xs font-bold text-primary w-24 shrink-0 truncate">
                  {s.section === "Unassigned" ? "No Section" : `Section ${s.section}`}
                </span>
                <span className="text-2xs text-text-muted font-mono w-20 shrink-0">{s.studentCount} students</span>
                <span className="flex-1 flex items-center gap-2 min-w-[80px]">
                  <span className="flex-1 h-1.5 rounded-full bg-background/60 overflow-hidden">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        s.avgReadiness >= 75 ? "bg-status-success" : s.avgReadiness >= 45 ? "bg-accent-secondary" : "bg-status-warning"
                      )}
                      style={{ width: `${s.avgReadiness}%` }}
                    />
                  </span>
                  <span className="text-2xs font-mono font-bold text-text-secondary w-16 text-right shrink-0">
                    {s.avgReadiness}/100
                  </span>
                </span>
                <span className="text-2xs text-text-muted font-mono w-16 shrink-0 text-right">
                  {s.avgCgpa !== null ? `CGPA ${s.avgCgpa.toFixed(2)}` : "—"}
                </span>
                <span className="w-52 shrink-0 flex items-center justify-end gap-2 text-2xs" onClick={(e) => e.stopPropagation()}>
                  {s.coordinator ? (
                    <>
                      <span className="font-semibold text-text-secondary truncate">{s.coordinator.name}</span>
                      <a
                        href={`mailto:${s.coordinator.email}`}
                        title={`Email ${s.coordinator.name}`}
                        className="p-1 rounded text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors shrink-0"
                      >
                        <Mail className="w-3 h-3" />
                      </a>
                      {s.coordinator.phone && (
                        <a
                          href={`tel:${s.coordinator.phone}`}
                          title={`Call ${s.coordinator.name}`}
                          className="p-1 rounded text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors shrink-0"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-status-warning font-semibold">
                      <UserX className="w-3 h-3" />
                      No coordinator
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setCategoryFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-control text-2xs font-bold transition-all border",
              categoryFilter === f
                ? "bg-accent-primary text-white border-accent-primary shadow-subtle"
                : "bg-surface text-text-secondary border-border-subtle hover:border-border-strong hover:text-primary"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((report) => {
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
                <span className={cn("px-2 py-0.5 text-3xs font-bold rounded-full border", FORMAT_STYLE[report.format])}>
                  {report.format}
                </span>
              </div>

              <h3 className="text-sm font-bold text-primary mb-1.5 flex items-center gap-1.5 flex-wrap">
                <span>{report.name}</span>
                {report.sectionAware && sectionFilter && (
                  <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-accent-primary/15 text-accent-primary">
                    Section {sectionFilter}
                  </span>
                )}
              </h3>
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

      {/* Preview modal for tabular (Excel/CSV) reports */}
      {previewReport && (
        <Modal
          onClose={() => setPreviewReport(null)}
          title={previewReport.name}
          subtitle={`${previewReport.preview.rows.length} row${previewReport.preview.rows.length === 1 ? "" : "s"}`}
          icon={FileText}
          size="4xl"
          bodyClassName="p-4"
        >
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-elevated/70 text-text-muted font-bold uppercase tracking-wider text-3xs sticky top-0">
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
        </Modal>
      )}
    </DashboardShell>
  );
}
