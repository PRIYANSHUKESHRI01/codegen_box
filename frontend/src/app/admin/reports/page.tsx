"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { BranchScopeBar } from "@/components/branches/BranchScopeBar";
import { inBranchScope, SCOPE_ALL } from "@/lib/branches";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  Trophy,
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
  Code2,
  CircuitBoard,
  Target,
  TrendingDown,
  TrendingUp,
  Clock,
  Hourglass,
  UserPlus,
  Search,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BarChart } from "@/components/dashboard/tpo/BarChart";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useDepartmentScope } from "@/lib/departments";
import { StudyYearBar } from "@/components/dashboard/tpo/StudyYearBar";
import { PlacementPolicyModal } from "@/components/dashboard/tpo/PlacementPolicyModal";
import { api, ApiError } from "@/lib/api";
import type { TpoReportsData, ReportPreview } from "@/lib/generateTpoReports";
import { Modal } from "@/components/ui/Modal";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import {
  HP_TONES,
  HpAvatar,
  HpButton,
  HpCard,
  HpCompanyLogo,
  HpFunnel,
  HpIconTile,
  HpItem,
  HpPill,
  HpProgress,
  HpSearch,
  HpSectionHeader,
  HpSkeleton,
  HpSkeletonCards,
  HpStagger,
  HpStatCard,
  HpTabs,
  hpBtn,
  hpEase,
  hpTh,
  type HpTone,
} from "@/components/portal/kit";
import { HpErrorCard } from "@/components/portal/pipeline-kit";
import { rollupLanguages } from "@/lib/cohortInsights";
import { languageLabel } from "@/lib/judgeLanguages";
import { useToast } from "@/lib/toast";

const SERIES_PACKAGES = "#0284C7";

const ACTION_ICON: Record<string, LucideIcon> = {
  stale_applications: Clock,
  pending_offers: Hourglass,
  unregistered_eligible: UserPlus,
};

const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const fmtNum = (v: number) => String(Math.round(v * 10) / 10);

function loadReportLib() {
  return import("@/lib/generateTpoReports");
}

type ReportFormat = "PDF" | "Excel" | "CSV";
type ReportCategory = "Compliance" | "Operations" | "Analytics";

interface CohortSummary {
  totalStudents: number;
  branchCount: number;
  sectionCount: number;
  avgCgpa: number | null;
  avgReadiness: number;
  mappedDrives: number;
  nonCompliantTotal: number;
  codingStudents: number;
  activeStudents: number;
  topLanguage: string | null;
  coreStudents: number;
}

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
    codingStudents: students.filter((s) => s.coding.languages.length > 0).length,
    activeStudents: students.filter((s) => s.activity.engagement === "active").length,
    topLanguage: rollupLanguages(students)[0]?.language ?? null,
    coreStudents: students.filter((s) => !!s.core).length,
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
  sectionAware?: boolean;
  available?: (data: TpoReportsData) => boolean;
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
    id: "languages",
    name: "Coding Languages & Progress Report",
    description: "Who practises and how much they've solved, which language each student codes in, and where the batch is struggling — with a per-language roll-up.",
    format: "Excel",
    category: "Analytics",
    icon: Code2,
    generate: async (data, sectionFilter) => (await loadReportLib()).generateLanguageProgressReport(data, sectionFilter),
    preview: async (data, sectionFilter) => (await loadReportLib()).languageProgressRows(data, sectionFilter),
    sectionAware: true,
    liveStat: (s) => ({
      text: s.codingStudents === 0 ? "No code submitted yet" : `${s.codingStudents} coding · ${s.activeStudents} active this week${s.topLanguage ? ` · most use ${languageLabel(s.topLanguage)}` : ""}`,
    }),
  },
  {
    id: "core-proficiency",
    name: "Core Subject Proficiency Report",
    description: "For ECE, EEE, Mechanical and Civil students: accuracy in every Core Prep subject, core readiness, tests taken and each student's weakest subject — one sheet per branch family.",
    format: "Excel",
    category: "Analytics",
    icon: CircuitBoard,
    generate: async (data) => (await loadReportLib()).generateCoreProficiencyReport(data),
    preview: async () => (await loadReportLib()).coreProficiencyRows(),
    available: (data) => data.students.some((s) => !!s.core),
    liveStat: (s) => ({ text: `${s.coreStudents} core-branch student${s.coreStudents === 1 ? "" : "s"} on Core Prep` }),
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
    name: "Management Readiness & Placement Deck",
    description: "Board-ready summary — headline stats, readiness tier mix, placement rate and top recruiting companies.",
    format: "PDF",
    category: "Analytics",
    icon: Presentation,
    generate: async (data) => (await loadReportLib()).generateManagementDeck(data),
    liveStat: (s) => ({ text: `${s.avgReadiness}/100 avg readiness across the batch` }),
  },
  {
    id: "accreditation",
    name: "NAAC / NIRF Accreditation & CTC Audit",
    description: "Statutory summary of unique placed students, opted-out/higher-studies cohort, median & mean CTC, and recruiter breakdown.",
    format: "PDF",
    category: "Compliance",
    icon: ShieldCheck,
    generate: async (data) => (await loadReportLib()).generateAccreditationPdf(data),
    preview: async (data) => (await loadReportLib()).accreditationRows(data),
    liveStat: (s) => ({ text: `${s.totalStudents} cohort · statutory NAAC/NIRF metrics` }),
  },
];

const CATEGORY_FILTERS = ["All", "Compliance", "Operations", "Analytics"] as const;

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
  const { scope: deptScope } = useDepartmentScope();
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_FILTERS)[number]>("All");
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [rawData, setData] = useState<TpoReportsData | null>(null);
  const [branchScope, setBranchScope] = useState<string>(SCOPE_ALL);
  const [studyYear, setStudyYear] = useState<number | null>(null);
  const [showPolicy, setShowPolicy] = useState(false);

  const data = useMemo<TpoReportsData | null>(() => {
    if (!rawData || branchScope === SCOPE_ALL) return rawData;
    const students = rawData.students.filter((s) => inBranchScope(s, branchScope));
    const ids = new Set(students.map((s) => s.id));
    return {
      ...rawData,
      students,
      drives: rawData.drives.map((d) => ({
        ...d,
        non_compliant: d.non_compliant.filter((n) => ids.has(n.id)),
      })),
    };
  }, [rawData, branchScope]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<{ name: string; preview: ReportPreview } | null>(null);

  // Search & filter for placed students table
  const [placementSearch, setPlacementSearch] = useState("");
  const [placementBranchFilter, setPlacementBranchFilter] = useState("ALL");

  const triggerToast = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const qs = new URLSearchParams();
      if (deptScope !== SCOPE_ALL) qs.set("department", deptScope);
      if (studyYear !== null) qs.set("year", String(studyYear));
      const q = qs.toString();
      const reportsRes = await api.get<TpoReportsData>(q ? `/tpo/reports/data?${q}` : "/tpo/reports/data");
      setData(reportsRes);
      setBranchScope(SCOPE_ALL);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  }, [deptScope, studyYear]);

  useEffect(() => {
    if (status === "ready") loadData();
  }, [status, loadData]);

  const handleViewPdf = async (report: ReportDef) => {
    if (!data) return;
    setBusyId(`${report.id}-view`);
    try {
      const { blob } = await report.generate(data, report.sectionAware ? sectionFilter : null);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      triggerToast(`Couldn't prepare "${report.name}". Please try again.`, "error");
    } finally {
      setBusyId(null);
    }
  };

  if (status !== "ready") {
    return <SessionLoader />;
  }

  const reports = data ? REPORTS.filter((r) => !r.available || r.available(data)) : REPORTS;
  const filtered = reports.filter((r) => categoryFilter === "All" || r.category === categoryFilter);
  const summary = data ? computeSummary(data, sectionFilter) : null;

  const handleViewPreview = async (report: ReportDef) => {
    if (!data || !report.preview) return;
    setBusyId(`${report.id}-view`);
    try {
      const preview = await report.preview(data, report.sectionAware ? sectionFilter : null);
      setPreviewReport({ name: report.name, preview });
    } catch {
      triggerToast(`Couldn't load "${report.name}". Please try again.`, "error");
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
      triggerToast(`Couldn't generate "${report.name}". Please try again.`, "error");
    } finally {
      setBusyId(null);
    }
  };

  const tabs = CATEGORY_FILTERS.map((f) => ({
    id: f,
    label: f,
    count: f === "All" ? reports.length : reports.filter((r) => r.category === f).length,
  }));

  // Placement outcomes calculations
  const placements = data?.placements;
  const f = placements?.funnel ?? { batch_enrolled: 0, registered: 0, shortlisted: 0, interviewed: 0, offered: 0, accepted: 0 };
  const target = placements?.target ?? { target_percent: null, target_deadline: null, current_percent: 0 };
  const currentPct = target.current_percent;
  const targetPct = target.target_percent ? Number(target.target_percent) : null;
  const gapToTarget = targetPct !== null ? Math.max(0, targetPct - currentPct) : null;

  // Max and Avg CTC calculated from recruiter data
  const companySummary = placements?.company_summary ?? [];
  const allMaxCtcs = companySummary.map((c) => c.max_ctc).filter((v): v is number => v !== null && v > 0);
  const recentCtcs = (placements?.recent_placements ?? [])
    .map((p) => parseFloat(p.ctc_offered))
    .filter((n) => !isNaN(n) && n > 0);

  const highestCtc = placements?.package_stats?.max_ctc ?? (allMaxCtcs.length > 0 ? Math.max(...allMaxCtcs) : recentCtcs.length > 0 ? Math.max(...recentCtcs) : null);
  const medianCtc = placements?.package_stats?.median_ctc ?? null;
  const totalOffersAccepted = companySummary.reduce((s, c) => s + c.offers_accepted, 0);
  const weightedCtcSum = companySummary.reduce((s, c) => s + (c.avg_ctc ?? 0) * c.offers_accepted, 0);
  const avgCtc =
    placements?.package_stats?.avg_ctc !== undefined && placements.package_stats.avg_ctc !== null
      ? String(placements.package_stats.avg_ctc)
      : totalOffersAccepted > 0 && weightedCtcSum > 0
      ? (weightedCtcSum / totalOffersAccepted).toFixed(1)
      : recentCtcs.length > 0
      ? (recentCtcs.reduce((a, b) => a + b, 0) / recentCtcs.length).toFixed(1)
      : null;

  // Funnel steps
  const funnelSteps: [string, number][] = [
    ["Enrolled", f.batch_enrolled],
    ["Registered", f.registered],
    ["Shortlisted", f.shortlisted],
    ["Interviewed", f.interviewed],
    ["Offered", f.offered],
    ["Accepted", f.accepted],
  ];

  const dropOff = funnelSteps.slice(1).reduce<{ from: string; to: string; rate: number } | null>((worst, [label, value], i) => {
    const [prevLabel, prev] = funnelSteps[i];
    if (prev <= 0) return worst;
    const rate = pctOf(value, prev);
    return worst === null || rate < worst.rate ? { from: prevLabel, to: label, rate } : worst;
  }, null);

  const trendApplications = (placements?.branch_trend ?? []).reduce((s, r) => s + r.applications, 0);
  const trendAccepted = (placements?.branch_trend ?? []).reduce((s, r) => s + r.offers_accepted, 0);

  const totalOffers = (placements?.package_distribution ?? []).reduce((s, b) => s + b.count, 0);
  const peakBracket = (placements?.package_distribution ?? []).reduce<{ bracket: string; count: number } | null>(
    (best, b) => (b.count > 0 && (best === null || b.count > best.count) ? b : best),
    null
  );

  // Placed students filtering
  const allRecentPlacements = placements?.recent_placements ?? [];
  const placementBranches = Array.from(new Set(allRecentPlacements.map((p) => p.branch).filter((b): b is string => !!b)));
  const filteredPlacements = allRecentPlacements.filter((p) => {
    if (placementBranchFilter !== "ALL" && p.branch !== placementBranchFilter) return false;
    if (!placementSearch.trim()) return true;
    const q = placementSearch.toLowerCase();
    return (
      p.student_name.toLowerCase().includes(q) ||
      (p.roll_number ?? "").toLowerCase().includes(q) ||
      p.company.toLowerCase().includes(q) ||
      p.role_title.toLowerCase().includes(q)
    );
  });

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Placement Reports"
      subtitle="Comprehensive placement outcomes, drive conversion funnels, recruiter hiring records, package distributions, and downloadable official reports."
    >
      {loadError && <HpErrorCard message={loadError} onRetry={loadData} />}

      {loading ? (
        <ReportsSkeleton />
      ) : data && placements ? (
        <HpStagger className="space-y-6">
          {/* Context Card & Scope Selector */}
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
                      <HpPill tone="emerald" size="sm" dot>
                        Placement Season Records
                      </HpPill>
                      <span>
                        {f.accepted} placed students · {data.drives.length} drives · {companySummary.length} recruiters
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <StudyYearBar availableYears={placements.available_years} value={studyYear} onChange={setStudyYear} />
                  {rawData && <BranchScopeBar students={rawData.students} value={branchScope} onChange={setBranchScope} />}
                  <HpButton variant="secondary" size="sm" onClick={() => setShowPolicy(true)} leftIcon={<ShieldCheck className="h-4 w-4" />}>
                    Placement Policy
                  </HpButton>
                  <Link href="/admin/analytics" className={hpBtn("secondary", "sm", "h-9 shrink-0")}>
                    <Gauge className="h-4 w-4" />
                    Readiness Analytics
                  </Link>
                </div>
              </div>
            </HpCard>
          </HpItem>

          {/* Headline Placement KPIs */}
          <HpItem>
            <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <HpStatCard
                label="Unique Placed %"
                value={currentPct}
                suffix="%"
                decimals={Number.isInteger(currentPct) ? 0 : 1}
                icon={Target}
                tone="violet"
                hint={
                  targetPct !== null
                    ? gapToTarget && gapToTarget > 0
                      ? `Target ${fmtNum(targetPct)}% · ${gapToTarget.toFixed(1)} pts to go`
                      : `Target ${fmtNum(targetPct)}% · reached`
                    : `${f.unique_placed ?? f.accepted} of ${f.seeking_placement ?? f.batch_enrolled} seeking`
                }
              />
              <HpStatCard
                label="Offers Accepted"
                value={f.accepted}
                icon={Trophy}
                tone="emerald"
                hint={`${f.unique_placed ?? f.accepted} unique · ${f.offered} extended`}
              />
              <HpStatCard
                label="Highest Package"
                value={highestCtc !== null ? highestCtc : 0}
                suffix=" LPA"
                icon={IndianRupee}
                tone="indigo"
                hint={highestCtc !== null ? "Top offer secured" : "No offers yet"}
              />
              <HpStatCard
                label="Median / Avg CTC"
                value={medianCtc !== null ? medianCtc : avgCtc !== null ? Number(avgCtc) : 0}
                suffix=" LPA"
                decimals={1}
                icon={BarChart3}
                tone="sky"
                hint={medianCtc !== null && avgCtc !== null ? `Median · Avg ${avgCtc} LPA` : "Across accepted offers"}
              />
              <HpStatCard
                label="Campus Recruiters"
                value={companySummary.length}
                icon={Building2}
                tone="teal"
                hint="with accepted offers"
              />
            </div>
          </HpItem>

          {/* Placement Funnel + Action Attention */}
          <HpItem>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <HpCard className="p-5 sm:p-6 xl:col-span-2">
                <HpSectionHeader
                  title="Season Placement Pipeline Funnel"
                  subtitle="Stage-by-stage candidate progression from cohort enrollment down to accepted offers"
                  icon={Filter}
                  tone="indigo"
                  action={
                    f.batch_enrolled > 0 ? (
                      <HpPill tone="emerald" size="sm" className="hidden sm:inline-flex">
                        <span className="tabular">{fmtNum((f.accepted / f.batch_enrolled) * 100)}% enrolled → placed</span>
                      </HpPill>
                    ) : undefined
                  }
                />
                {f.batch_enrolled === 0 ? (
                  <InlineEmpty icon={Filter} title="No students enrolled yet" description="The funnel fills in as students register and proceed through campus drives." />
                ) : (
                  <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_14rem]">
                    <HpFunnel stages={funnelSteps.map(([label, value]) => ({ label, value, tone: "indigo" as const }))} />
                    <div className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-5 sm:grid-cols-2 sm:items-center xl:flex xl:flex-col xl:items-stretch xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                      <div className="flex items-center gap-4 xl:flex-col xl:items-start">
                        <TargetRing value={currentPct} target={targetPct} />
                        <div>
                          <div className="text-xs font-bold text-primary">Placement vs Target</div>
                          <p className="tabular mt-0.5 text-2xs leading-relaxed text-text-muted">
                            {targetPct !== null ? (
                              <>
                                Target {fmtNum(targetPct)}%
                                {target.target_deadline &&
                                  ` by ${new Date(target.target_deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                                .
                              </>
                            ) : (
                              "No placement target set for this season."
                            )}
                          </p>
                        </div>
                      </div>
                      {dropOff && dropOff.rate < 100 && (
                        <div className="rounded-2xl bg-elevated/60 p-3 ring-1 ring-inset ring-border-subtle">
                          <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                            <TrendingDown className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" aria-hidden />
                            Biggest stage drop-off
                          </div>
                          <div className="mt-1 text-xs font-bold text-primary">
                            {dropOff.from} → {dropOff.to}
                          </div>
                          <div className="tabular text-2xs text-text-muted">{dropOff.rate}% carried through</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </HpCard>

              <AttentionCard items={placements.action_items} />
            </div>
          </HpItem>

          {/* Package Distribution & Branch Placement Trend */}
          <HpItem>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Package Distribution */}
              <HpCard className="flex flex-col p-5 sm:p-6">
                <HpSectionHeader
                  title="Salary / CTC Package Distribution"
                  subtitle="Accepted job offers distributed across salary compensation brackets"
                  icon={IndianRupee}
                  tone="sky"
                  action={
                    totalOffers > 0 ? (
                      <span className="tabular text-2xs font-semibold text-text-muted">
                        {totalOffers} {totalOffers === 1 ? "offer" : "offers"}
                      </span>
                    ) : undefined
                  }
                />
                {placements.package_distribution.every((b) => b.count === 0) ? (
                  <InlineEmpty icon={IndianRupee} title="No accepted offers yet" description="Salary distribution appears once students accept offers." />
                ) : (
                  <>
                    <div className="mt-8">
                      <BarChart
                        variant="premium"
                        ariaLabel="Accepted offers by CTC bracket"
                        categories={placements.package_distribution.map((b) => b.bracket)}
                        series={[{ label: "Students Placed", color: SERIES_PACKAGES, values: placements.package_distribution.map((b) => b.count) }]}
                        suffix=""
                        height={180}
                        maxValue={Math.max(4, Math.ceil(Math.max(...placements.package_distribution.map((b) => b.count)) / 2) * 2)}
                      />
                    </div>
                    <div className="mt-auto pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4 text-2xs text-text-muted">
                        <span className="tabular">
                          <span className="font-bold text-primary">{totalOffers}</span> total accepted {totalOffers === 1 ? "offer" : "offers"}
                        </span>
                        {peakBracket && (
                          <span className="tabular">
                            Most common: <span className="font-semibold text-text-secondary">{peakBracket.bracket}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </HpCard>

              {/* Branch Placement Rates */}
              <HpCard className="flex flex-col p-5 sm:p-6">
                <HpSectionHeader
                  title="Branch Placement Rate & Conversions"
                  subtitle="Accepted offers per application by academic branch"
                  icon={TrendingUp}
                  tone="emerald"
                />
                {placements.branch_trend.length === 0 ? (
                  <InlineEmpty
                    icon={TrendingUp}
                    tone="emerald"
                    title="No placement outcomes yet"
                    description="Outcomes record here as drives complete and offers are extended."
                  />
                ) : (
                  <ul className="mt-6 space-y-4">
                    {placements.branch_trend.map((row) => (
                      <li key={`${row.year}-${row.branch}`}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-xs font-semibold text-primary">{row.branch}</span>
                            <HpPill tone="slate" size="sm">
                              <span className="tabular">{row.year}</span>
                            </HpPill>
                          </span>
                          <span className="flex shrink-0 items-baseline gap-2">
                            <span className="tabular text-3xs font-semibold text-text-muted">
                              {row.offers_accepted} of {row.applications}
                            </span>
                            <span className="tabular text-sm font-extrabold text-primary">{row.placement_rate}%</span>
                          </span>
                        </div>
                        <HpProgress value={row.placement_rate} tone="emerald" className="h-2" />
                      </li>
                    ))}
                  </ul>
                )}
                {trendApplications > 0 && (
                  <div className="mt-auto pt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4 text-2xs text-text-muted">
                      <span className="tabular">
                        <span className="font-bold text-primary">{trendAccepted}</span> of {trendApplications}{" "}
                        {trendApplications === 1 ? "application" : "applications"} placed
                      </span>
                      <span className="tabular">
                        Overall <span className="font-semibold text-text-secondary">{pctOf(trendAccepted, trendApplications)}%</span>
                      </span>
                    </div>
                  </div>
                )}
              </HpCard>
            </div>
          </HpItem>

          {/* Company-wise Hiring Summary */}
          <HpItem>
            <CompanyTable rows={placements.company_summary} />
          </HpItem>

          {/* Placed Students Ledger & Offer Registry */}
          <HpItem>
            <HpCard spotlight={false} className="overflow-hidden">
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <HpSectionHeader
                    title="Placed Students & Offer Registry"
                    subtitle="Verified record of student placements, recruiters, roles and compensation packages"
                    icon={Trophy}
                    tone="emerald"
                    action={
                      filteredPlacements.length > 0 ? (
                        <HpPill tone="emerald" size="sm">
                          <span className="tabular">{filteredPlacements.length} of {allRecentPlacements.length} placed</span>
                        </HpPill>
                      ) : undefined
                    }
                  />

                  {/* Search and branch filter */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative w-full sm:w-60">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={placementSearch}
                        onChange={(e) => setPlacementSearch(e.target.value)}
                        placeholder="Search student or recruiter…"
                        className="h-8.5 w-full rounded-xl border border-border-subtle bg-elevated/40 pl-8.5 pr-3 text-xs text-primary placeholder:text-text-muted focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      {placementSearch && (
                        <button
                          type="button"
                          onClick={() => setPlacementSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {placementBranches.length > 1 && (
                      <select
                        value={placementBranchFilter}
                        onChange={(e) => setPlacementBranchFilter(e.target.value)}
                        className="h-8.5 rounded-xl border border-border-subtle bg-elevated/40 px-3 text-xs text-primary focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="ALL">All Branches</option>
                        {placementBranches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {allRecentPlacements.length === 0 ? (
                <div className="border-t border-border-subtle px-5 pb-5 sm:px-6">
                  <InlineEmpty
                    icon={Trophy}
                    tone="emerald"
                    title="No placements recorded yet"
                    description="As students accept offers in campus drives, their verified placement records appear here."
                  />
                </div>
              ) : filteredPlacements.length === 0 ? (
                <div className="border-t border-border-subtle px-5 pb-5 sm:px-6">
                  <InlineEmpty
                    icon={Search}
                    title="No matching student records"
                    description="No placed student records matched your current search or branch filter."
                  />
                </div>
              ) : (
                <div className="max-h-[30rem] overflow-x-auto overflow-y-auto border-t border-border-subtle">
                  <table className="w-full min-w-[700px] text-left">
                    <thead>
                      <tr>
                        <th scope="col" className={cn(hpTh, STICKY_TH)}>Candidate</th>
                        <th scope="col" className={cn(hpTh, STICKY_TH)}>Branch</th>
                        <th scope="col" className={cn(hpTh, STICKY_TH)}>Recruiter &amp; Role</th>
                        <th scope="col" className={cn(hpTh, STICKY_TH, "text-right")}>Package (CTC)</th>
                        <th scope="col" className={cn(hpTh, STICKY_TH, "text-right")}>Placed Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {filteredPlacements.map((p, i) => (
                        <tr key={i} className="transition-colors duration-150 hover:bg-indigo-500/[0.04]">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <HpAvatar name={p.student_name} size="sm" />
                              <div className="min-w-0">
                                <div className="truncate text-xs font-bold text-primary">{p.student_name}</div>
                                <div className="tabular text-3xs text-text-muted">{p.roll_number ?? "No Roll No"}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <HpPill tone="slate" size="sm">
                              {p.branch ?? "General"}
                            </HpPill>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <CompanyLogo name={p.company} size="sm" />
                              <div className="min-w-0">
                                <span className="font-semibold text-primary text-xs">{p.company}</span>
                                <span className="text-3xs text-text-muted block truncate">{p.role_title}</span>
                              </div>
                            </div>
                          </td>
                          <td className="tabular px-5 py-3 text-right">
                            <HpPill tone="emerald" size="sm" icon={IndianRupee}>
                              <span className="font-bold">{p.ctc_offered} LPA</span>
                            </HpPill>
                          </td>
                          <td className="tabular px-5 py-3 text-right text-2xs text-text-muted">
                            {new Date(p.placed_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </HpCard>
          </HpItem>

          {/* Drive Coverage & Directory Snapshot */}
          <HpItem>
            <div className="grid grid-cols-1 gap-6">
              <DriveCoverage drives={data.drives} />
            </div>
          </HpItem>

          {/* Official Report Library */}
          <HpItem className="space-y-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <HpSectionHeader
                title="Official Placement Documents & Exports"
                subtitle="Generated in your browser on demand for accreditation (NAAC/NIRF), executive briefings, and department archives"
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
                            <HpButton
                              variant="secondary"
                              className="w-full"
                              onClick={() => void handleViewPdf(report)}
                              disabled={loading || !data || viewBusy}
                              isLoading={viewBusy}
                              leftIcon={<Eye className="h-4 w-4" />}
                            >
                              View PDF
                            </HpButton>
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
        </HpStagger>
      ) : null}

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
      {showPolicy && <PlacementPolicyModal onClose={() => setShowPolicy(false)} onSaved={() => void loadData()} />}
    </DashboardShell>
  );
}

/* ── Sections ───────────────────────────────────────────────────────────── */

function AttentionCard({ items }: { items: TpoReportsData["placements"]["action_items"] }) {
  return (
    <HpCard className="flex flex-col p-5 sm:p-6">
      <HpSectionHeader
        title="Needs Your Attention"
        subtitle="Follow-ups your placement pipeline is waiting on"
        icon={AlertTriangle}
        tone="amber"
        action={
          <HpPill tone={items.length > 0 ? "amber" : "slate"} size="sm" dot={items.length > 0} pulse={items.length > 0}>
            <span className="tabular">{items.length}</span>
          </HpPill>
        }
      />
      {items.length === 0 ? (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center">
          <HpIconTile icon={CheckCircle2} tone="emerald" size="lg" />
          <p className="mt-3 text-13 font-bold text-primary">All caught up</p>
          <p className="mt-1 text-2xs text-text-muted">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2.5">
            {items.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: hpEase, delay: 0.2 + i * 0.06 }}
                className="flex items-start gap-3 rounded-2xl bg-amber-500/[0.06] p-3.5 ring-1 ring-inset ring-amber-500/20 transition-colors duration-200 hover:bg-amber-500/10"
              >
                <HpIconTile icon={ACTION_ICON[item.type] ?? AlertTriangle} tone="amber" size="sm" />
                <p className="pt-1 text-xs leading-relaxed text-text-secondary">{item.message}</p>
              </motion.li>
            ))}
          </ul>
          <div className="mt-auto pt-4">
            <Link href="/admin/drives" className={hpBtn("soft", "sm", "w-full")}>
              Open Campus Drives
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </HpCard>
  );
}

function CompanyTable({ rows }: { rows: TpoReportsData["placements"]["company_summary"] }) {
  const totalAccepted = rows.reduce((s, c) => s + c.offers_accepted, 0);
  return (
    <HpCard spotlight={false} className="overflow-hidden">
      <div className="px-5 py-4 sm:px-6">
        <HpSectionHeader
          title="Company-wise Recruiter Performance"
          subtitle="Accepted job offers and salary packages by recruiting partner"
          icon={Building2}
          tone="sky"
          action={
            rows.length > 0 ? (
              <HpPill tone="sky" size="sm" className="hidden sm:inline-flex">
                <span className="tabular">
                  {rows.length} {rows.length === 1 ? "company" : "companies"}
                </span>
              </HpPill>
            ) : undefined
          }
        />
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-border-subtle px-5 pb-5 sm:px-6">
          <InlineEmpty
            icon={Building2}
            title="No accepted offers yet"
            description="Accepted offers will appear by company as placement drives conclude."
          />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-border-subtle">
          <table className="w-full min-w-[600px]">
            <thead className="bg-elevated/50">
              <tr>
                <th scope="col" className={hpTh}>Company</th>
                <th scope="col" className={cn(hpTh, "w-56")}>Offers accepted</th>
                <th scope="col" className={cn(hpTh, "text-right")}>Avg CTC</th>
                <th scope="col" className={cn(hpTh, "text-right")}>Max CTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((c) => (
                <tr key={c.company} className="group transition-colors duration-200 hover:bg-indigo-500/[0.035]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <CompanyLogo name={c.company} size="sm" />
                      <span className="max-w-[18rem] truncate text-13 font-bold text-primary">{c.company}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="tabular w-6 shrink-0 text-13 font-extrabold text-primary">{c.offers_accepted}</span>
                      <HpProgress value={pctOf(c.offers_accepted, totalAccepted)} tone="sky" className="flex-1" />
                      <span className="tabular w-9 shrink-0 text-right text-3xs font-semibold text-text-muted">{pctOf(c.offers_accepted, totalAccepted)}%</span>
                    </div>
                  </td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-xs font-bold text-primary">
                    <Ctc value={c.avg_ctc} />
                  </td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-xs font-bold text-primary">
                    <Ctc value={c.max_ctc} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HpCard>
  );
}

function Ctc({ value }: { value: number | null }) {
  if (value === null) return <span className="font-medium text-text-muted">—</span>;
  return (
    <>
      {value} <span className="text-3xs font-semibold text-text-muted">LPA</span>
    </>
  );
}

function TargetRing({ value, target, size = 100, stroke = 9 }: { value: number; target: number | null; size?: number; stroke?: number }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const t = target !== null ? Math.max(0, Math.min(100, target)) : null;
  const angle = t !== null ? (t / 100) * 2 * Math.PI : 0;
  const cx = size / 2;
  const inner = r - stroke / 2 - 2;
  const outer = r + stroke / 2 + 2;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`${fmtNum(value)}% placed${t !== null ? `, against a ${fmtNum(t)}% target` : ""}`}
      >
        <circle cx={cx} cy={cx} r={r} fill="none" strokeWidth={stroke} className="stroke-border-subtle" />
        <motion.circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="#10B981"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c - (c * pct) / 100 : c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 1.1, ease: hpEase, delay: 0.2 }}
        />
        {t !== null && (
          <line
            x1={cx + inner * Math.cos(angle)}
            y1={cx + inner * Math.sin(angle)}
            x2={cx + outer * Math.cos(angle)}
            y2={cx + outer * Math.sin(angle)}
            stroke="#6366F1"
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-extrabold tracking-tight text-primary">{fmtNum(value)}%</span>
        <span className="mt-1 text-3xs font-semibold uppercase tracking-[0.08em] text-text-muted">placed</span>
      </div>
    </div>
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
      <Icon className={cn("h-3.5 w-3.5 shrink-0", !danger && !success && "text-sky-700 dark:text-sky-300")} aria-hidden />
      <span className="tabular min-w-0">{stat.text}</span>
    </div>
  );
}

const STICKY_TH = "sticky top-0 z-10 whitespace-nowrap bg-[rgb(var(--bg-surface-rgb))] shadow-[inset_0_-1px_0_var(--border-subtle)]";

const DRIVE_STATUS_TONE: Record<string, HpTone> = {
  published: "sky",
  completed: "slate",
  draft: "slate",
  cancelled: "rose",
};

function DriveCoverage({ drives }: { drives: TpoReportsData["drives"] }) {
  return (
    <HpCard spotlight={false} className="overflow-hidden">
      <div className="px-5 py-4 sm:px-6">
        <HpSectionHeader
          title="Campus Drive Catalog &amp; Eligibility Reach"
          subtitle="All mapped corporate drives, scheduled dates, and batch eligibility breakdown"
          icon={BarChart3}
          tone="indigo"
          action={
            <Link href="/admin/drives" className={hpBtn("ghost", "sm")}>
              <span className="hidden sm:inline">Manage Drives</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
      </div>
      {drives.length === 0 ? (
        <div className="border-t border-border-subtle px-5 pb-5 sm:px-6">
          <InlineEmpty icon={Building2} title="No drives mapped yet" description="Drives appear here once companies map opportunities to your college." />
        </div>
      ) : (
        <div className="max-h-[26rem] overflow-auto border-t border-border-subtle">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr>
                <th scope="col" className={cn(hpTh, STICKY_TH)}>Drive &amp; Recruiter</th>
                <th scope="col" className={cn(hpTh, STICKY_TH)}>Scheduled Date</th>
                <th scope="col" className={cn(hpTh, STICKY_TH)}>Fully eligible cohort</th>
                <th scope="col" className={cn(hpTh, STICKY_TH, "text-right")}>Compliance Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {drives.map((d) => {
                const eligiblePct = d.funnel.total > 0 ? Math.round((d.funnel.fully_eligible / d.funnel.total) * 100) : 0;
                return (
                  <tr key={d.id} className="transition-colors duration-200 hover:bg-indigo-500/[0.035]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <CompanyLogo name={d.company.name} logo={d.company.logo} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="max-w-[11rem] truncate text-xs font-bold text-primary 2xl:max-w-[15rem]" title={d.title}>
                              {d.title}
                            </span>
                            <HpPill tone={DRIVE_STATUS_TONE[d.status] ?? "slate"} size="sm" className="capitalize">
                              {d.status}
                            </HpPill>
                          </div>
                          <div className="max-w-[16rem] truncate text-3xs text-text-muted">
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
                      <div className="flex min-w-[7rem] items-center gap-2.5">
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
    <div className="space-y-6" role="status" aria-label="Loading placement reports">
      <HpCard spotlight={false} className="flex items-center gap-3.5 p-4 sm:p-5">
        <HpSkeleton className="h-11 w-11 rounded-[14px]" />
        <div className="flex-1 space-y-2">
          <HpSkeleton className="h-3.5 w-48 max-w-full" />
          <HpSkeleton className="h-3 w-64 max-w-full" />
        </div>
        <HpSkeleton className="hidden h-7 w-32 rounded-full sm:block" />
      </HpCard>
      <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <HpStatCard label="Placement Rate" value={0} icon={Target} tone="violet" loading />
        <HpStatCard label="Offers Accepted" value={0} icon={Trophy} tone="emerald" loading />
        <HpStatCard label="Highest Package" value={0} icon={IndianRupee} tone="indigo" loading />
        <HpStatCard label="Average Package" value={0} icon={BarChart3} tone="sky" loading />
        <HpStatCard label="Campus Recruiters" value={0} icon={Building2} tone="teal" loading />
      </div>
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
