import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { pdfSafe } from "@/lib/pdfTextSafe";
import { ACCENT, SUCCESS, MUTED, fileSafe, reportHeader, reportFooter, avg, type GeneratedReport } from "@/lib/generateTpoReports";
import type { ReportPreview } from "@/lib/generateTpoReports";
import type { CohortStudent } from "@/types/cohort";

/** A section-wide readiness threshold below which a student is flagged as needing follow-up — same value the roster page's own "At Risk" quick filter uses. */
const AT_RISK_THRESHOLD = 60;

export interface CoordinatorReportsData {
  collegeName: string;
  section: string;
  students: CohortStudent[];
}

// ---------------------------------------------------------------------------
// 1. Section Readiness & Academic Report (PDF)
// ---------------------------------------------------------------------------
/**
 * The Section Coordinator's counterpart to the TPO's Batch Readiness report
 * — same stat-tile/tier-distribution shape, but scoped to one section and,
 * unlike the TPO version, ends with a real "Needs Attention" follow-up list
 * (who's below the at-risk threshold, by name) since a coordinator's whole
 * job is per-student follow-up rather than batch-wide aggregate trends.
 */
export function generateSectionAcademicReport(data: CoordinatorReportsData): GeneratedReport {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = reportHeader(doc, `Section ${data.section} Readiness & Academic Report`, {
    name: data.collegeName,
    city: null,
    state: null,
    tier: "",
  });

  const { students } = data;
  const avgCgpa = avg(students.filter((s) => s.cgpa !== null).map((s) => Number(s.cgpa)));
  const avgReadiness = avg(students.map((s) => s.readiness_score));
  const zeroBacklog = students.filter((s) => s.backlogs === 0).length;

  const stats: [string, string][] = [
    ["Section Size", String(students.length)],
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

  const tiers: CohortStudent["readiness_tier"][] = ["Placement Ready", "In Progress", "Needs Training"];
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
  doc.text("Needs Attention", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Students below ${AT_RISK_THRESHOLD}% readiness — worth a direct follow-up.`, margin, y + 10);
  y += 16;

  const atRisk = students.filter((s) => s.readiness_score < AT_RISK_THRESHOLD).sort((a, b) => a.readiness_score - b.readiness_score);

  if (atRisk.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...SUCCESS);
    doc.text("No students currently below the readiness threshold — nice work.", margin, y + 8);
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Student", "Roll Number", "CGPA", "Backlogs", "Readiness"]],
      body: atRisk.map((s) => [
        pdfSafe(s.name),
        s.roll_number ?? "—",
        s.cgpa ?? "—",
        s.backlogs ?? "—",
        `${s.readiness_score}/100`,
      ]),
      headStyles: { fillColor: [217, 119, 6], fontSize: 8 },
      bodyStyles: { fontSize: 9 },
      theme: "grid",
    });
  }

  reportFooter(doc);
  return {
    blob: doc.output("blob"),
    filename: `${fileSafe(data.collegeName)}-section-${fileSafe(data.section)}-academic-readiness-report.pdf`,
  };
}

// ---------------------------------------------------------------------------
// 2. Section Cohort Report (Excel)
// ---------------------------------------------------------------------------
/** The single source of truth for the Section Cohort report's rows — used by both the real .xlsx export and its "View" preview, so the two can never drift apart. */
export function sectionCohortRows(data: CoordinatorReportsData): ReportPreview {
  return {
    headers: ["Name", "Roll Number", "Branch", "CGPA", "Backlogs", "Readiness Score", "Readiness Tier", "7-Day Practice", "Phone", "Parent Phone"],
    rows: data.students.map((s) => [
      s.name,
      s.roll_number ?? "—",
      s.branch ?? "—",
      s.cgpa ?? "—",
      s.backlogs ?? "—",
      s.readiness_score,
      s.readiness_tier,
      s.practice_score,
      s.phone ?? "—",
      s.parent_phone ?? "—",
    ]),
  };
}

export async function generateSectionCohortReport(data: CoordinatorReportsData): Promise<GeneratedReport> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CodeGen Box";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(`Section ${data.section}`);
  const { headers, rows } = sectionCohortRows(data);

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  sheet.columns.forEach((col) => (col.width = 18));
  rows.forEach((row) => sheet.addRow(row));
  sheet.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + headers.length)}1` };

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    blob: new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: `${fileSafe(data.collegeName)}-section-${fileSafe(data.section)}-cohort-report.xlsx`,
  };
}
