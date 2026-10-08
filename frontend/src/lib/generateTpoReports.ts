import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { pdfSafe } from "@/lib/pdfTextSafe";
import type { PlacementReportData } from "@/types/placement";
import type { CohortStudent } from "@/types/cohort";
import { computeSectionStats, sectionLabel } from "@/lib/sectionBreakdown";

export interface TpoReportStudent {
  id: number;
  name: string;
  email: string;
  roll_number: string | null;
  branch: string | null;
  section: string | null;
  cgpa: string | null;
  backlogs: number | null;
  readiness_score: number;
  readiness_tier: "Placement Ready" | "In Progress" | "Needs Training";
  practice_score: number;
}

export interface TpoReportDrive {
  id: number;
  title: string;
  role_title: string;
  ctc_range: string | null;
  drive_date: string;
  status: string;
  company: { id: number; name: string; logo: string | null };
  eligibility: { min_cgpa: string | null; max_backlogs: number | null; eligible_branches: string[] | null };
  funnel: { total: number; meets_cgpa: number; meets_backlogs: number; meets_branch: number; fully_eligible: number };
  non_compliant: { id: number; name: string; roll_number: string | null; branch: string | null; reasons: string[] }[];
}

export interface TpoReportsData {
  college: { name: string; city: string | null; state: string | null; tier: string };
  students: TpoReportStudent[];
  drives: TpoReportDrive[];
  /** Real placement pipeline data (see PlacementReportService) — added alongside the pre-existing academic/eligibility data above. */
  placements: PlacementReportData;
}

export interface GeneratedReport {
  blob: Blob;
  filename: string;
}

export const ACCENT: [number, number, number] = [79, 70, 229];
export const MUTED: [number, number, number] = [107, 114, 128];
export const DANGER: [number, number, number] = [220, 38, 38];
export const SUCCESS: [number, number, number] = [16, 185, 129];

export function fileSafe(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function reportHeader(doc: jsPDF, title: string, college: TpoReportsData["college"]): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text(pdfSafe(title), margin, y);

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(pdfSafe(`${college.name}${college.city ? ` · ${college.city}, ${college.state ?? ""}` : ""}`), margin, y);
  doc.text(
    new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
    pageWidth - margin,
    y,
    { align: "right" }
  );

  y += 20;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);

  return y + 24;
}

export function reportFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `AptRun · Generated ${new Date().toLocaleString("en-IN")} · Page ${i} of ${pageCount} · All figures reflect live records at generation time`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" }
    );
  }
}

export function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

// ---------------------------------------------------------------------------
// 1. Batch Readiness & Academic Report (PDF)
// ---------------------------------------------------------------------------
export function generateAcademicReport(data: TpoReportsData, sectionFilter: string | null = null): GeneratedReport {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const title = sectionFilter ? `Batch Readiness & Academic Report — Section ${sectionFilter}` : "Batch Readiness & Academic Report";
  let y = reportHeader(doc, title, data.college);

  const students = sectionFilter ? data.students.filter((s) => sectionLabel(s.section) === sectionFilter) : data.students;
  const avgCgpa = avg(students.filter((s) => s.cgpa !== null).map((s) => Number(s.cgpa)));
  const avgReadiness = avg(students.map((s) => s.readiness_score));
  const zeroBacklog = students.filter((s) => s.backlogs === 0).length;

  const stats: [string, string][] = [
    ["Total Students", String(students.length)],
    ["Average CGPA", avgCgpa ? avgCgpa.toFixed(2) : "—"],
    ["Average Readiness", `${Math.round(avgReadiness)}/100`],
    ["Zero-Backlog Students", `${zeroBacklog} (${students.length ? Math.round((zeroBacklog / students.length) * 100) : 0}%)`],
  ];
  const colWidth = (pageWidth - margin * 2) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = margin + i * colWidth;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text(value, x, y + 16);
  });
  y += 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text("Readiness Tier Distribution", margin, y);
  y += 10;

  const tiers: TpoReportStudent["readiness_tier"][] = ["Placement Ready", "In Progress", "Needs Training"];
  const tierColors: Record<string, [number, number, number]> = {
    "Placement Ready": SUCCESS,
    "In Progress": ACCENT,
    "Needs Training": [217, 119, 6],
  };
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Tier", "Students", "Share"]],
    body: tiers.map((t) => {
      const count = students.filter((s) => s.readiness_tier === t).length;
      return [t, String(count), students.length ? `${Math.round((count / students.length) * 100)}%` : "0%"];
    }),
    headStyles: { fillColor: ACCENT, fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    theme: "grid",
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 0) {
        const tier = hookData.cell.raw as string;
        hookData.cell.styles.textColor = tierColors[tier] ?? [17, 24, 39];
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
  y = doc.lastAutoTable.finalY + 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Branch-Wise Breakdown", margin, y);
  y += 10;

  const branches = Array.from(new Set(students.map((s) => s.branch ?? "Unassigned"))).sort();
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Branch", "Students", "Avg CGPA", "Avg Backlogs", "Avg Readiness"]],
    body: branches.map((branch) => {
      const cohort = students.filter((s) => (s.branch ?? "Unassigned") === branch);
      const cgpas = cohort.filter((s) => s.cgpa !== null).map((s) => Number(s.cgpa));
      const backlogs = cohort.filter((s) => s.backlogs !== null).map((s) => Number(s.backlogs));
      return [
        branch,
        String(cohort.length),
        cgpas.length ? avg(cgpas).toFixed(2) : "—",
        backlogs.length ? avg(backlogs).toFixed(1) : "—",
        `${Math.round(avg(cohort.map((s) => s.readiness_score)))}/100`,
      ];
    }),
    headStyles: { fillColor: ACCENT, fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    theme: "grid",
  });

  // Section-wise cut is only meaningful once at least one student actually
  // has a section on file (a college that hasn't adopted sections yet
  // shouldn't see an empty/all-"Unassigned" table) AND there's more than one
  // section left to compare — once the report is already scoped to a single
  // section (sectionFilter set), a one-row "breakdown" is redundant with the
  // headline stats above.
  const sectionStats = computeSectionStats(students);
  if (!sectionFilter && students.some((s) => s.section)) {
    // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
    y = doc.lastAutoTable.finalY + 24;

    if (y > 680) {
      doc.addPage();
      y = 50;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text("Section-Wise Breakdown (best average readiness first)", margin, y);
    y += 10;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Section", "Students", "Avg CGPA", "Avg Backlogs", "Avg Readiness"]],
      body: sectionStats.map((s) => [
        s.section,
        String(s.studentCount),
        s.avgCgpa !== null ? s.avgCgpa.toFixed(2) : "—",
        s.avgBacklogs !== null ? s.avgBacklogs.toFixed(1) : "—",
        `${s.avgReadiness}/100`,
      ]),
      headStyles: { fillColor: ACCENT, fontSize: 8 },
      bodyStyles: { fontSize: 9 },
      theme: "grid",
    });
  }

  reportFooter(doc);
  const suffix = sectionFilter ? `-section-${fileSafe(sectionFilter)}` : "";
  return { blob: doc.output("blob"), filename: `${fileSafe(data.college.name)}-academic-readiness-report${suffix}.pdf` };
}

export interface ReportPreview {
  headers: string[];
  rows: (string | number)[][];
}

/** The single source of truth for the Cohort report's rows — used to build
 * both the real .xlsx (generateCohortExcelReport) and the "View" preview
 * table, so the two can never drift apart. */
export function cohortRows(data: TpoReportsData, sectionFilter: string | null = null): ReportPreview {
  const students = sectionFilter ? data.students.filter((s) => sectionLabel(s.section) === sectionFilter) : data.students;

  return {
    headers: ["Name", "Email", "Roll Number", "Branch", "Section", "CGPA", "Backlogs", "Readiness Score", "Readiness Tier", "7-Day Practice Score"],
    rows: students.map((s) => [
      s.name,
      s.email,
      s.roll_number ?? "—",
      s.branch ?? "—",
      s.section ?? "—",
      s.cgpa ?? "—",
      s.backlogs ?? "—",
      s.readiness_score,
      s.readiness_tier,
      s.practice_score,
    ]),
  };
}

/** Shared by generateDriveDirectoryReport and its "View" preview. */
export function driveDirectoryRows(data: TpoReportsData): ReportPreview {
  return {
    headers: ["Company", "Role", "CTC Range", "Drive Date", "Status", "Min CGPA", "Max Backlogs", "Eligible Branches", "Fully Eligible", "Total Cohort"],
    rows: data.drives.map((d) => [
      d.company.name,
      d.role_title,
      d.ctc_range ?? "—",
      new Date(d.drive_date).toLocaleDateString("en-IN"),
      d.status,
      d.eligibility.min_cgpa ?? "Open",
      d.eligibility.max_backlogs ?? "Open",
      d.eligibility.eligible_branches?.join(", ") || "All branches",
      d.funnel.fully_eligible,
      d.funnel.total,
    ]),
  };
}

/**
 * Shared by generateComplianceAuditReport and its "View" preview. Note this
 * deliberately keeps `studentsById` built from the FULL (unfiltered)
 * `data.students` even when `sectionFilter` is set — `d.non_compliant` is
 * server-precomputed per drive across the whole college, so filtering has to
 * happen on the final rows (by each row's looked-up section), not by
 * pre-narrowing the id lookup, or an out-of-section student's row would
 * still appear with its section wrongly blanked out instead of being
 * excluded.
 */
export function complianceAuditRows(data: TpoReportsData, sectionFilter: string | null = null): ReportPreview {
  const rows: (string | number)[][] = [];
  const studentsById = new Map(data.students.map((s) => [s.id, s]));
  data.drives.forEach((d) => {
    d.non_compliant.forEach((s) => {
      const section = studentsById.get(s.id)?.section ?? null;
      if (sectionFilter && sectionLabel(section) !== sectionFilter) return;

      rows.push([d.title, d.company.name, s.name, s.roll_number ?? "—", s.branch ?? "—", section ?? "—", s.reasons.join(" | ")]);
    });
  });
  if (rows.length === 0) {
    rows.push(["—", "—", "No non-compliant students found across any active drive", "—", "—", "—", "—"]);
  }
  return { headers: ["Drive", "Company", "Student Name", "Roll Number", "Branch", "Section", "Reason(s)"], rows };
}

// ---------------------------------------------------------------------------
// 2. Student Cohort Report (Excel)
// ---------------------------------------------------------------------------
export async function generateCohortExcelReport(data: TpoReportsData, sectionFilter: string | null = null): Promise<GeneratedReport> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AptRun";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sectionFilter ? `Section ${sectionFilter}` : "Student Cohort");
  const { headers, rows } = cohortRows(data, sectionFilter);

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  sheet.columns.forEach((col) => (col.width = 18));
  rows.forEach((row) => sheet.addRow(row));
  sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + headers.length)}1` };

  const buffer = await workbook.xlsx.writeBuffer();
  const suffix = sectionFilter ? `-section-${fileSafe(sectionFilter)}` : "";
  return {
    blob: new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: `${fileSafe(data.college.name)}-student-cohort-report${suffix}.xlsx`,
  };
}

// ---------------------------------------------------------------------------
// 3. Company & Drive Directory (Excel)
// ---------------------------------------------------------------------------
export async function generateDriveDirectoryReport(data: TpoReportsData): Promise<GeneratedReport> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AptRun";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Company & Drive Directory");
  const { headers, rows } = driveDirectoryRows(data);

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  sheet.columns.forEach((col) => (col.width = 18));
  rows.forEach((row) => sheet.addRow(row));
  sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + headers.length)}1` };

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    blob: new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: `${fileSafe(data.college.name)}-company-drive-directory.xlsx`,
  };
}

// ---------------------------------------------------------------------------
// 4. Eligibility & Compliance Audit (CSV)
// ---------------------------------------------------------------------------
export function generateComplianceAuditReport(data: TpoReportsData, sectionFilter: string | null = null): GeneratedReport {
  const { headers, rows } = complianceAuditRows(data, sectionFilter);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const suffix = sectionFilter ? `-section-${fileSafe(sectionFilter)}` : "";
  return {
    blob: new Blob([csv], { type: "text/csv;charset=utf-8" }),
    filename: `${fileSafe(data.college.name)}-eligibility-compliance-audit${suffix}.csv`,
  };
}

// ---------------------------------------------------------------------------
// 5. Drive Eligibility Funnel Report (PDF)
// ---------------------------------------------------------------------------
export function generateDriveFunnelReport(data: TpoReportsData): GeneratedReport {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = reportHeader(doc, "Drive Eligibility Funnel Report", data.college);

  if (data.drives.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text("No drives are currently mapped to this college.", margin, y);
  }

  const barMaxWidth = pageWidth - margin * 2 - 140;

  data.drives.forEach((drive) => {
    if (y > 680) {
      doc.addPage();
      y = 50;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(pdfSafe(`${drive.company.name} — ${drive.role_title}`), margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      `${new Date(drive.drive_date).toLocaleDateString("en-IN")} · ${pdfSafe(drive.ctc_range ?? "CTC not disclosed")}`,
      pageWidth - margin,
      y,
      { align: "right" }
    );
    y += 16;

    const stages: [string, number][] = [
      ["Total Cohort", drive.funnel.total],
      ["Meets CGPA Bar", drive.funnel.meets_cgpa],
      ["Meets Backlog Limit", drive.funnel.meets_backlogs],
      ["Meets Branch Filter", drive.funnel.meets_branch],
      ["Fully Eligible", drive.funnel.fully_eligible],
    ];
    const total = drive.funnel.total || 1;

    stages.forEach(([label, count], i) => {
      const barWidth = (count / total) * barMaxWidth;
      const isLast = i === stages.length - 1;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(55, 65, 81);
      doc.text(label, margin, y + 9);

      doc.setFillColor(229, 231, 235);
      doc.rect(margin + 120, y, barMaxWidth, 12, "F");
      doc.setFillColor(...(isLast ? SUCCESS : ACCENT));
      doc.rect(margin + 120, y, Math.max(barWidth, 2), 12, "F");

      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(String(count), margin + 120 + barMaxWidth + 10, y + 9);
      y += 18;
    });

    if (drive.non_compliant.length > 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...DANGER);
      doc.text(`${drive.non_compliant.length} student(s) flagged as not eligible — see Compliance Audit report.`, margin, y + 4);
      y += 14;
    }

    y += 16;
    doc.setDrawColor(243, 244, 246);
    doc.line(margin, y - 8, pageWidth - margin, y - 8);
  });

  reportFooter(doc);
  return { blob: doc.output("blob"), filename: `${fileSafe(data.college.name)}-drive-eligibility-funnel-report.pdf` };
}

// ---------------------------------------------------------------------------
// 6. Management Readiness Deck (PDF)
// ---------------------------------------------------------------------------
export function generateManagementDeck(data: TpoReportsData): GeneratedReport {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = reportHeader(doc, "Management Readiness Deck", data.college);

  const { students, drives } = data;
  const avgReadiness = Math.round(avg(students.map((s) => s.readiness_score)));

  const stats: [string, string, [number, number, number]][] = [
    ["Total Students", String(students.length), ACCENT],
    ["Avg Readiness Score", `${avgReadiness}/100`, avgReadiness >= 60 ? SUCCESS : [217, 119, 6]],
    ["Mapped Drives", String(drives.length), ACCENT],
    ["Below 60% Readiness", String(students.filter((s) => s.readiness_score < 60).length), DANGER],
  ];
  const colWidth = (pageWidth - margin * 2) / stats.length;
  stats.forEach(([label, value, color], i) => {
    const x = margin + i * colWidth;
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(x, y, colWidth - 12, 60, 4, 4, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 12, y + 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...color);
    doc.text(value, x + 12, y + 46);
  });
  y += 90;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(17, 24, 39);
  doc.text("Readiness Tier Distribution", margin, y);
  y += 14;

  const tiers: [string, number, [number, number, number]][] = [
    ["Placement Ready", students.filter((s) => s.readiness_tier === "Placement Ready").length, SUCCESS],
    ["In Progress", students.filter((s) => s.readiness_tier === "In Progress").length, ACCENT],
    ["Needs Training", students.filter((s) => s.readiness_tier === "Needs Training").length, [217, 119, 6]],
  ];
  const total = students.length || 1;
  let barX = margin;
  const barY = y;
  const barTotalWidth = pageWidth - margin * 2;
  const barHeight = 24;
  tiers.forEach(([, count, color]) => {
    const w = (count / total) * barTotalWidth;
    doc.setFillColor(...color);
    doc.rect(barX, barY, Math.max(w, 0), barHeight, "F");
    barX += w;
  });
  y += barHeight + 10;
  tiers.forEach(([label, count, color]) => {
    doc.setFillColor(...color);
    doc.rect(margin, y, 8, 8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text(`${label}: ${count} (${Math.round((count / total) * 100)}%)`, margin + 14, y + 8);
    y += 16;
  });
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Top Mapped Companies", margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Company", "Role", "CTC Range", "Fully Eligible / Cohort"]],
    body: drives
      .slice(0, 8)
      .map((d) => [d.company.name, d.role_title, pdfSafe(d.ctc_range ?? "—"), `${d.funnel.fully_eligible} / ${d.funnel.total}`]),
    headStyles: { fillColor: ACCENT, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    theme: "grid",
  });

  reportFooter(doc);
  return { blob: doc.output("blob"), filename: `${fileSafe(data.college.name)}-management-readiness-deck.pdf` };
}

// ---------------------------------------------------------------------------
// 7. Individual Student Report (PDF)
// ---------------------------------------------------------------------------
/**
 * The one-candidate counterpart to the Cohort report — usable anywhere a
 * single CohortStudent row is already loaded (the TPO cohort table, the
 * Section Coordinator's section-scoped roster, or the shared
 * StudentProfileDrawer both dashboards use) with zero extra network round
 * trip, since every field it needs is already on the row.
 */
export function generateIndividualStudentReport(student: CohortStudent, collegeName: string): GeneratedReport {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = reportHeader(doc, `${student.name} — Student Report`, { name: collegeName, city: null, state: null, tier: "" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(
    pdfSafe(
      `${student.roll_number ?? "No roll number on file"} · ${student.branch ?? "Branch not on file"}`+
        `${student.section ? ` · Section ${student.section}` : ""}`
    ),
    margin,
    y
  );
  y += 30;

  const tierColor: [number, number, number] =
    student.readiness_tier === "Placement Ready" ? SUCCESS : student.readiness_tier === "In Progress" ? ACCENT : [217, 119, 6];

  const stats: [string, string, [number, number, number]][] = [
    ["CGPA", student.cgpa ?? "—", ACCENT],
    ["Backlogs", student.backlogs !== null ? String(student.backlogs) : "—", (student.backlogs ?? 0) > 0 ? DANGER : SUCCESS],
    ["Readiness Score", `${student.readiness_score}/100`, tierColor],
    ["7-Day Practice", `${student.practice_score}%`, ACCENT],
  ];
  const colWidth = (pageWidth - margin * 2) / stats.length;
  stats.forEach(([label, value, color], i) => {
    const x = margin + i * colWidth;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...color);
    doc.text(value, x, y + 20);
  });
  y += 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text("Placement Readiness", margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Tier", "Score", "Eligibility"]],
    body: [
      [
        student.readiness_tier,
        `${student.readiness_score}/100`,
        student.eligible_for_active_drive === null
          ? "No active drives currently mapped"
          : `Eligible for ${student.eligible_drive_count} of ${student.active_drive_count} active drive(s)`,
      ],
    ],
    headStyles: { fillColor: ACCENT, fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    theme: "grid",
  });

  // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
  y = doc.lastAutoTable.finalY + 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Contact & Account", margin, y);
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Email", "Phone", "Parent Phone", "Account Status"]],
    body: [[student.email, student.phone ?? "—", student.parent_phone ?? "—", student.is_blocked ? "Blocked" : "Active"]],
    headStyles: { fillColor: ACCENT, fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    theme: "grid",
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 3) {
        hookData.cell.styles.textColor = student.is_blocked ? DANGER : SUCCESS;
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  reportFooter(doc);
  return { blob: doc.output("blob"), filename: `${fileSafe(collegeName)}-${fileSafe(student.name)}-student-report.pdf` };
}
