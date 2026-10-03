"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
  Mail,
  Phone,
  Trophy,
  UserX,
  ArrowRight,
  BarChart3,
  CalendarDays,
  FileSpreadsheet,
  Gauge,
  GitBranch,
  GraduationCap,
  IndianRupee,
  LayoutGrid,
  Library,
  Sheet,
  Sparkles,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import type { TpoReportsData, ReportPreview } from "@/lib/generateTpoReports";
import { computeSectionStats, type SectionCoordinatorInfo } from "@/lib/sectionBreakdown";
import { Modal } from "@/components/ui/Modal";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import {
  HP_TONES,
  HpAvatar,
  HpButton,
  HpCard,
  HpCompanyLogo,
  HpIconTile,
  HpItem,
  HpPill,
  HpProgress,
  HpSectionHeader,
  HpSkeleton,
  HpSkeletonCards,
  HpStagger,
  HpTabs,
  HpToast,
  hpBtn,
  hpEase,
  hpTh,
  type HpTone,
} from "@/components/portal/kit";
import { HpErrorCard } from "@/components/portal/pipeline-kit";

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

/** Category → identity tone for the card's icon tile (amber/rose stay reserved for risk). */
const CATEGORY_TONE: Record<ReportCategory, HpTone> = {
  Compliance: "violet",
  Operations: "sky",
  Analytics: "indigo",
};

const FORMAT_ICON: Record<ReportFormat, LucideIcon> = {
  PDF: FileText,
  Excel: FileSpreadsheet,
  CSV: Sheet,
};

/** Readiness meter tone — same thresholds the section list has always used. */
function readinessTone(score: number): HpTone {
  return score >= 75 ? "emerald" : score >= 45 ? "sky" : "amber";
}

function scopeLabel(section: string): string {
  return section === "Unassigned" ? "No Section" : `Section ${section}`;
}

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

  const tabs = CATEGORY_FILTERS.map((f) => ({
    id: f,
    label: f,
    count: f === "All" ? REPORTS.length : REPORTS.filter((r) => r.category === f).length,
  }));

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Placement Reports"
      subtitle="Real, live reports generated from your current student cohort and mapped drives — view or download any time."
    >
      <HpToast message={toastMessage} tone={toastMessage?.startsWith("Couldn't") ? "rose" : "emerald"} />

      {loadError && <HpErrorCard message={loadError} onRetry={loadData} />}

      {loading ? (
        <ReportsSkeleton />
      ) : (
        <HpStagger className="space-y-6">
          {/* Report context + active scope */}
          {data && (
            <HpItem>
              <HpCard spotlight={false} className="relative overflow-hidden p-4 sm:p-5">
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_160%_at_0%_0%,rgb(var(--hp-id)/0.10),transparent_60%),radial-gradient(50%_160%_at_100%_0%,rgba(99,102,241,0.10),transparent_60%)]" />
                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <HpCompanyLogo name={data.college.name} size="md" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-15 font-bold tracking-tight text-primary">{data.college.name}</span>
                        {data.college.tier && (
                          <HpPill tone="slate" size="sm">
                            {data.college.tier}
                          </HpPill>
                        )}
                      </div>
                      <div className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-muted">
                        <HpPill tone="sky" size="sm" dot>
                          Generated on demand
                        </HpPill>
                        <span>{REPORTS.length} reports · PDF, Excel &amp; CSV</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Scope</span>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={sectionFilter ?? "all"}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.2, ease: hpEase }}
                      >
                        <HpPill tone={sectionFilter ? "indigo" : "slate"} icon={sectionFilter ? Filter : LayoutGrid}>
                          {sectionFilter ? scopeLabel(sectionFilter) : "All sections"}
                        </HpPill>
                      </motion.span>
                    </AnimatePresence>
                    {sectionFilter && (
                      <HpButton variant="ghost" size="sm" onClick={() => setSectionFilter(null)} leftIcon={<X className="h-3.5 w-3.5" />}>
                        Clear filter ({sectionFilter})
                      </HpButton>
                    )}
                  </div>
                </div>
              </HpCard>
            </HpItem>
          )}

          {/* Cohort snapshot — real, live context so a TPO knows what these
              reports actually contain before spending a click on any of them. */}
          {summary && (
            <HpItem>
              <SnapshotStrip summary={summary} sectionFilter={sectionFilter} />
            </HpItem>
          )}

          {/* Section Performance — ranked best-average-first, so a TPO can see at
              a glance which section is doing well and which needs attention,
              plus who to actually contact about it. Clicking a row (or the
              Filter button on the reports below) scopes the section-aware
              reports to just that section. */}
          {sectionStats.length > 0 && (
            <HpItem>
              <HpCard spotlight={false} className="p-5 sm:p-6">
                <HpSectionHeader
                  title="Section Performance"
                  subtitle="Ranked by average readiness · select a section to scope section-aware reports"
                  icon={Trophy}
                  tone="sky"
                  action={
                    <span className="tabular text-2xs font-semibold text-text-muted">
                      {sectionStats.length} {sectionStats.length === 1 ? "section" : "sections"}
                    </span>
                  }
                />
                <div className="mt-5 hidden grid-cols-[minmax(0,1fr)_15rem] gap-4 px-3 pb-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted lg:grid">
                  <div className="grid grid-cols-[2rem_9rem_minmax(0,1fr)_5.5rem] gap-4">
                    <span>#</span>
                    <span>Section</span>
                    <span>Avg readiness</span>
                    <span className="text-right">Avg CGPA</span>
                  </div>
                  <span>Coordinator</span>
                </div>
                <ul className="mt-3 space-y-2 lg:mt-0">
                  {sectionStats.map((s, i) => {
                    const selected = sectionFilter === s.section;
                    return (
                      <li
                        key={s.section}
                        className={cn(
                          "flex flex-col gap-3 rounded-2xl border p-3 transition-all duration-200 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center lg:gap-4",
                          selected
                            ? "border-indigo-500/40 bg-indigo-500/[0.06] shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
                            : "border-border-subtle bg-elevated/30 hover:border-indigo-500/25 hover:bg-elevated/60"
                        )}
                      >
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setSectionFilter(sectionFilter === s.section ? null : s.section)}
                          className="group flex w-full min-w-0 cursor-pointer flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))] lg:grid lg:grid-cols-[2rem_9rem_minmax(0,1fr)_5.5rem]"
                        >
                          <span
                            className={cn(
                              "tabular inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-3xs font-extrabold ring-1 ring-inset transition-colors",
                              selected
                                ? "bg-gradient-to-b from-indigo-500 to-violet-600 text-white ring-white/20"
                                : i === 0
                                ? "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300"
                                : "bg-elevated text-text-muted ring-border-subtle group-hover:text-primary"
                            )}
                          >
                            {selected ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : `#${i + 1}`}
                          </span>
                          <span className="min-w-0 flex-1 lg:flex-none">
                            <span className="block truncate text-13 font-bold text-primary">{scopeLabel(s.section)}</span>
                            <span className="tabular block text-2xs text-text-muted">
                              {s.studentCount} {s.studentCount === 1 ? "student" : "students"}
                            </span>
                          </span>
                          <span className="order-last flex w-full min-w-0 items-center gap-2.5 lg:order-none lg:w-auto">
                            <HpProgress value={s.avgReadiness} tone={readinessTone(s.avgReadiness)} className="h-2 flex-1" />
                            <span className="tabular w-14 shrink-0 text-right text-xs font-bold text-primary">
                              {s.avgReadiness}
                              <span className="text-3xs font-semibold text-text-muted">/100</span>
                            </span>
                          </span>
                          <span className="tabular shrink-0 text-right text-xs font-semibold text-text-secondary">
                            {s.avgCgpa !== null ? (
                              <>
                                <span className="text-3xs font-semibold text-text-muted lg:hidden">CGPA </span>
                                {s.avgCgpa.toFixed(2)}
                              </>
                            ) : (
                              "—"
                            )}
                          </span>
                        </button>

                        <div className="flex min-w-0 items-center justify-between gap-2 border-t border-border-subtle pt-3 lg:justify-start lg:border-0 lg:pt-0">
                          {s.coordinator ? (
                            <>
                              <span className="flex min-w-0 items-center gap-2">
                                <HpAvatar name={s.coordinator.name} size="xs" />
                                <span className="truncate text-xs font-semibold text-text-secondary">{s.coordinator.name}</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-0.5 lg:ml-auto">
                                <a
                                  href={`mailto:${s.coordinator.email}`}
                                  title={`Email ${s.coordinator.name}`}
                                  aria-label={`Email ${s.coordinator.name}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-text-muted transition-colors hover:bg-indigo-500/10 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-indigo-300"
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                </a>
                                {s.coordinator.phone && (
                                  <a
                                    href={`tel:${s.coordinator.phone}`}
                                    title={`Call ${s.coordinator.name}`}
                                    aria-label={`Call ${s.coordinator.name}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-text-muted transition-colors hover:bg-indigo-500/10 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-indigo-300"
                                  >
                                    <Phone className="h-3.5 w-3.5" />
                                  </a>
                                )}
                              </span>
                            </>
                          ) : (
                            <HpPill tone="amber" size="sm" icon={UserX}>
                              No coordinator
                            </HpPill>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </HpCard>
            </HpItem>
          )}

          {/* Report library */}
          <HpItem className="space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <HpSectionHeader
                title="Report Library"
                subtitle="Built in your browser from the live data above"
                icon={Library}
                tone="indigo"
              />
              <HpTabs tabs={tabs} value={categoryFilter} onChange={setCategoryFilter} className="self-start md:self-auto" />
            </div>

            <motion.div layout className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout" initial={false}>
                {filtered.map((report) => {
                  const downloadBusy = busyId === `${report.id}-download`;
                  const viewBusy = busyId === `${report.id}-view`;
                  const liveStat = summary ? report.liveStat(summary) : null;
                  return (
                    <motion.div
                      key={report.id}
                      layout
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.35, ease: hpEase }}
                    >
                      <ReportCard
                        report={report}
                        sectionFilter={sectionFilter}
                        liveStat={liveStat}
                        viewAction={
                          report.preview ? (
                            <HpButton
                              variant="secondary"
                              className="w-full"
                              onClick={() => handleViewPreview(report)}
                              disabled={loading || !data || viewBusy}
                              isLoading={viewBusy}
                              leftIcon={<Eye className="h-4 w-4" />}
                            >
                              View
                            </HpButton>
                          ) : (
                            <a
                              href={pdfUrls[report.id] ?? "#"}
                              target="_blank"
                              rel="noopener"
                              aria-disabled={!pdfUrls[report.id]}
                              title={pdfUrls[report.id] ? undefined : "Preparing preview…"}
                              onClick={(e) => {
                                if (!pdfUrls[report.id]) e.preventDefault();
                              }}
                              className={cn(hpBtn("secondary", "md", "w-full"), !pdfUrls[report.id] && "opacity-60 pointer-events-none")}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </a>
                          )
                        }
                        downloadAction={
                          <HpButton
                            className="w-full"
                            onClick={() => handleDownload(report)}
                            disabled={loading || !data || downloadBusy}
                            isLoading={downloadBusy}
                            leftIcon={<Download className="h-4 w-4" />}
                          >
                            Download
                          </HpButton>
                        }
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          </HpItem>

          {/* What the drive + placement reports draw on, at a glance */}
          {data && (
            <HpItem>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <DriveCoverage drives={data.drives} />
                <RecentPlacements rows={data.placements.recent_placements} />
              </div>
            </HpItem>
          )}
        </HpStagger>
      )}

      {/* Preview modal for tabular (Excel/CSV) reports */}
      {previewReport && (
        <OverlayPortal>
          <Modal
            onClose={() => setPreviewReport(null)}
            title={previewReport.name}
            subtitle={`${previewReport.preview.rows.length} row${previewReport.preview.rows.length === 1 ? "" : "s"}`}
            icon={FileText}
            size="4xl"
            variant="premium"
            bodyClassName="p-0"
          >
            {previewReport.preview.rows.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <HpIconTile icon={Table2} tone="slate" size="lg" />
                <p className="mt-3 text-sm font-bold text-primary">Nothing to show</p>
                <p className="mt-1 max-w-xs text-2xs leading-relaxed text-text-muted">This report has no rows for the current scope.</p>
              </div>
            ) : (
              <table className="w-full whitespace-nowrap text-left">
                <thead>
                  <tr>
                    {previewReport.preview.headers.map((h) => (
                      <th key={h} scope="col" className={cn(hpTh, STICKY_TH, "px-4 py-3")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {previewReport.preview.rows.map((row, i) => (
                    <tr key={i} className="transition-colors duration-150 even:bg-elevated/30 hover:bg-indigo-500/[0.05]">
                      {row.map((cell, j) => (
                        <td key={j} className={cn("tabular px-4 py-2.5 text-xs", j === 0 ? "font-semibold text-primary" : "text-text-secondary")}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Modal>
        </OverlayPortal>
      )}
    </DashboardShell>
  );
}

/* ── Sections ───────────────────────────────────────────────────────────── */

function SnapshotStrip({ summary, sectionFilter }: { summary: CohortSummary; sectionFilter: string | null }) {
  const flagged = summary.nonCompliantTotal > 0;
  const cells: { label: string; icon: LucideIcon; tone: HpTone; value: ReactNode; foot?: ReactNode }[] = [
    { label: "Total Students", icon: Users2, tone: "indigo", value: <AnimatedCounter target={summary.totalStudents} /> },
    { label: "Branches", icon: GitBranch, tone: "sky", value: <AnimatedCounter target={summary.branchCount} /> },
    { label: "Sections", icon: LayoutGrid, tone: "violet", value: <AnimatedCounter target={summary.sectionCount} /> },
    {
      label: "Avg CGPA",
      icon: GraduationCap,
      tone: "teal",
      value: summary.avgCgpa !== null ? <AnimatedCounter target={summary.avgCgpa} decimals={2} /> : "—",
    },
    {
      label: "Avg Readiness",
      icon: Gauge,
      tone: "indigo",
      value: (
        <>
          <AnimatedCounter target={summary.avgReadiness} />
          <span className="text-sm font-bold text-text-muted">/100</span>
        </>
      ),
      foot: <HpProgress value={summary.avgReadiness} tone={readinessTone(summary.avgReadiness)} className="mt-2.5" />,
    },
    {
      label: "Compliance Flags",
      icon: flagged ? AlertTriangle : ShieldCheck,
      tone: flagged ? "rose" : "emerald",
      value: <AnimatedCounter target={summary.nonCompliantTotal} />,
      foot: (
        <HpPill tone={flagged ? "rose" : "emerald"} size="sm" icon={flagged ? AlertTriangle : CheckCircle2} className="mt-2">
          {flagged ? "Needs review" : "All clear"}
        </HpPill>
      ),
    },
  ];

  return (
    <HpCard spotlight={false} className="overflow-hidden">
      <div className="flex min-h-[1.5rem] flex-wrap items-center justify-between gap-2 px-5 pt-4 sm:px-6">
        <span className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Cohort snapshot</span>
        {sectionFilter && (
          <HpPill tone="indigo" size="sm" icon={Filter}>
            Student figures · {scopeLabel(sectionFilter)}
          </HpPill>
        )}
      </div>
      {/* 1px grid gaps over a hairline-coloured backdrop = dividers that stay correct at 2, 3 or 6 columns. */}
      <dl className="mt-3 grid grid-cols-2 gap-px border-t border-border-subtle bg-border-subtle sm:grid-cols-3 xl:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className="min-w-0 bg-[rgb(var(--bg-surface-rgb))] px-5 py-4 sm:px-6 xl:px-5">
            <dt className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.06em] text-text-muted">
              <c.icon className={cn("h-3.5 w-3.5 shrink-0", HP_TONES[c.tone].text)} aria-hidden />
              <span className="min-w-0 leading-tight">{c.label}</span>
            </dt>
            <dd className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-primary">{c.value}</dd>
            {c.foot}
          </div>
        ))}
      </dl>
    </HpCard>
  );
}

function ReportCard({
  report,
  sectionFilter,
  liveStat,
  viewAction,
  downloadAction,
}: {
  report: ReportDef;
  sectionFilter: string | null;
  liveStat: LiveStat | null;
  viewAction: ReactNode;
  downloadAction: ReactNode;
}) {
  const Icon = report.icon;
  const FormatIcon = FORMAT_ICON[report.format];
  return (
    <HpCard className="hp-card-hover group flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <HpIconTile
          icon={Icon}
          tone={CATEGORY_TONE[report.category]}
          size="lg"
          className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
        />
        <HpPill tone="slate" size="sm" icon={FormatIcon}>
          {report.format}
        </HpPill>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className={cn("text-3xs font-bold uppercase tracking-[0.1em]", HP_TONES[CATEGORY_TONE[report.category]].text)}>{report.category}</span>
        {report.sectionAware && sectionFilter && (
          <HpPill tone="indigo" size="sm" icon={Filter}>
            {scopeLabel(sectionFilter)}
          </HpPill>
        )}
      </div>
      <h3 className="mt-1.5 text-15 font-bold tracking-tight text-primary">{report.name}</h3>
      <p className="mt-1.5 flex-1 text-xs leading-relaxed text-text-secondary">{report.description}</p>

      {liveStat && <LiveStatLine stat={liveStat} />}

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle pt-4">
        {viewAction}
        {downloadAction}
      </div>
    </HpCard>
  );
}

function LiveStatLine({ stat }: { stat: LiveStat }) {
  const danger = stat.tone === "danger";
  const success = stat.tone === "success";
  const Icon = danger ? AlertTriangle : success ? CheckCircle2 : Sparkles;
  return (
    <div
      className={cn(
        "mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-2xs font-semibold ring-1 ring-inset",
        danger
          ? "bg-rose-500/[0.06] text-rose-700 ring-rose-500/20 dark:text-rose-300"
          : success
          ? "bg-emerald-500/[0.06] text-emerald-700 ring-emerald-500/20 dark:text-emerald-300"
          : "bg-elevated/60 text-text-secondary ring-border-subtle"
      )}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", !danger && !success && "text-sky-600 dark:text-sky-300")} aria-hidden />
      <span className="tabular min-w-0">{stat.text}</span>
    </div>
  );
}

/** Header cell pinned to the top of a scrolling table panel, with a hairline under it. */
const STICKY_TH = "sticky top-0 z-10 whitespace-nowrap bg-[rgb(var(--bg-surface-rgb))] shadow-[inset_0_-1px_0_var(--border-subtle)]";

const DRIVE_STATUS_TONE: Record<string, HpTone> = {
  published: "sky",
  completed: "slate",
  draft: "slate",
  cancelled: "rose",
};

function DriveCoverage({ drives }: { drives: TpoReportsData["drives"] }) {
  return (
    <HpCard spotlight={false} className="overflow-hidden xl:col-span-2">
      <div className="px-5 py-4 sm:px-6">
        <HpSectionHeader
          title="Drive Eligibility at a Glance"
          subtitle="What the Directory, Funnel and Compliance reports are built from"
          icon={BarChart3}
          tone="indigo"
          action={
            <Link href="/admin/drives" className={hpBtn("ghost", "sm")}>
              <span className="hidden sm:inline">Campus Drives</span>
              <ArrowRight className="h-3.5 w-3.5" />
              <span className="sr-only sm:hidden">Campus Drives</span>
            </Link>
          }
        />
      </div>
      {drives.length === 0 ? (
        <div className="border-t border-border-subtle px-5 pb-5 sm:px-6">
          <InlineEmpty icon={Building2} title="No drives mapped yet" description="Drives appear here once a company maps one to your college." />
        </div>
      ) : (
        <div className="max-h-[26rem] overflow-auto border-t border-border-subtle">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr>
                <th scope="col" className={cn(hpTh, STICKY_TH)}>Drive</th>
                <th scope="col" className={cn(hpTh, STICKY_TH)}>Date</th>
                <th scope="col" className={cn(hpTh, STICKY_TH, "w-48")}>Fully eligible</th>
                <th scope="col" className={cn(hpTh, STICKY_TH, "text-right")}>Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {drives.map((d) => {
                const eligiblePct = d.funnel.total > 0 ? Math.round((d.funnel.fully_eligible / d.funnel.total) * 100) : 0;
                return (
                  <tr key={d.id} className="transition-colors duration-200 hover:bg-indigo-500/[0.035]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <HpCompanyLogo name={d.company.name} logo={d.company.logo} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="max-w-[15rem] truncate text-xs font-bold text-primary">{d.title}</span>
                            <HpPill tone={DRIVE_STATUS_TONE[d.status] ?? "slate"} size="sm" className="capitalize">
                              {d.status}
                            </HpPill>
                          </div>
                          <div className="max-w-[18rem] truncate text-3xs text-text-muted">
                            {d.company.name} · {d.role_title}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="tabular whitespace-nowrap px-5 py-3 text-2xs font-medium text-text-secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-text-muted" aria-hidden />
                        {new Date(d.drive_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex min-w-[9rem] items-center gap-2.5">
                        <HpProgress value={eligiblePct} tone="indigo" className="flex-1" />
                        <span className="tabular w-12 shrink-0 text-right text-2xs font-semibold text-text-secondary">
                          {d.funnel.fully_eligible}/{d.funnel.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {d.non_compliant.length > 0 ? (
                        <HpPill tone="amber" size="sm">
                          <span className="tabular">{d.non_compliant.length}</span>
                        </HpPill>
                      ) : (
                        <span className="text-2xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </HpCard>
  );
}

function RecentPlacements({ rows }: { rows: TpoReportsData["placements"]["recent_placements"] }) {
  return (
    <HpCard spotlight={false} className="flex flex-col overflow-hidden">
      <div className="px-5 py-4 sm:px-6">
        <HpSectionHeader
          title="Recent Placements"
          subtitle="Latest accepted offers"
          icon={Trophy}
          tone="emerald"
          action={
            rows.length > 0 ? (
              <HpPill tone="emerald" size="sm">
                <span className="tabular">{rows.length}</span>
              </HpPill>
            ) : undefined
          }
        />
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-border-subtle px-5 pb-5 sm:px-6">
          <InlineEmpty icon={Trophy} tone="emerald" title="No placements yet" description="Accepted offers land here with the company and package." />
        </div>
      ) : (
        <ul className="max-h-[26rem] flex-1 divide-y divide-border-subtle overflow-y-auto border-t border-border-subtle">
          {rows.map((p, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: hpEase, delay: 0.15 + Math.min(i, 8) * 0.03 }}
              className="flex items-center gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-indigo-500/[0.035] sm:px-6"
            >
              <HpAvatar name={p.student_name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-13 font-bold text-primary">{p.student_name}</div>
                <div className="truncate text-2xs text-text-muted">
                  {p.company} · {p.role_title}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <HpPill tone="emerald" size="sm" icon={IndianRupee}>
                  <span className="tabular">{p.ctc_offered} LPA</span>
                </HpPill>
                <div className="tabular mt-1 text-3xs text-text-muted">
                  {new Date(p.placed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
      <div className="mt-auto border-t border-border-subtle px-5 py-3.5 sm:px-6">
        <Link href="/admin/analytics" className={hpBtn("soft", "sm", "w-full")}>
          Open Readiness Analytics
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </HpCard>
  );
}

/* ── Small pieces ───────────────────────────────────────────────────────── */

/**
 * DashboardShell lifts the portal's <main> onto its own stacking layer
 * (`relative z-[1]`), so a `fixed` modal rendered inside the page can't rise
 * above the sticky header or the sidebar rail. Re-parenting it onto <body>
 * (inside `.hp-portal` so --hp-id still resolves) fixes that — purely
 * structural, the modal and its handlers are untouched.
 */
function OverlayPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div className="hp-portal" data-portal="tpo">
      {children}
    </div>,
    document.body
  );
}

function InlineEmpty({
  icon,
  title,
  description,
  tone = "slate",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "slate" | "emerald";
}) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center">
      <HpIconTile icon={icon} tone={tone} size="md" />
      <p className="mt-3 text-13 font-bold text-primary">{title}</p>
      <p className="mt-1 max-w-xs text-2xs leading-relaxed text-text-muted">{description}</p>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading reports">
      <HpCard spotlight={false} className="flex items-center gap-3.5 p-4 sm:p-5">
        <HpSkeleton className="h-11 w-11 rounded-[14px]" />
        <div className="flex-1 space-y-2">
          <HpSkeleton className="h-3.5 w-48 max-w-full" />
          <HpSkeleton className="h-3 w-64 max-w-full" />
        </div>
        <HpSkeleton className="hidden h-7 w-32 rounded-full sm:block" />
      </HpCard>
      <HpCard spotlight={false} className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-3 sm:p-6 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2.5">
            <HpSkeleton className="h-3 w-20" />
            <HpSkeleton className="h-6 w-14" />
          </div>
        ))}
      </HpCard>
      <HpCard spotlight={false} className="space-y-3 p-5 sm:p-6">
        <HpSkeleton className="h-4 w-44" />
        {Array.from({ length: 3 }).map((_, i) => (
          <HpSkeleton key={i} className="h-14 rounded-2xl" />
        ))}
      </HpCard>
      <HpSkeletonCards count={6} />
    </div>
  );
}
