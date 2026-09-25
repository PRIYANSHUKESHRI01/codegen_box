import ExcelJS from "exceljs";
import type { HiringReportData } from "@/types/hiring";

/**
 * Mirrors generateDriveApplicantsExcel.ts's dynamic-import ExcelJS pattern —
 * ExcelJS is only ever loaded when someone actually clicks Export. A single
 * workbook rather than the TPO's six separate report cards: a company
 * hiring tenant has one report to export (its own pipeline), not a whole
 * academic/compliance/eligibility suite tied to a college roster.
 */
export async function generateHiringReportExcel(report: HiringReportData, companyName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CodeGen Box";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Hiring Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 32 },
    { header: "Value", key: "value", width: 20 },
  ];
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summarySheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };

  const f = report.funnel;
  summarySheet.addRows([
    { metric: "Total Candidates", value: f.total_candidates },
    { metric: "Registered", value: f.registered },
    { metric: "Shortlisted", value: f.shortlisted },
    { metric: "Interviewed", value: f.interviewed },
    { metric: "Offered", value: f.offered },
    { metric: "Accepted", value: f.accepted },
    { metric: "Time to Hire (avg days)", value: report.time_to_hire_days ?? "—" },
    { metric: "Offer Accept Rate", value: report.offer_accept_rate !== null ? `${report.offer_accept_rate}%` : "—" },
    { metric: "Candidates — Company Invited", value: report.source_breakdown.company_invited },
    { metric: "Candidates — Existing Platform Student", value: report.source_breakdown.existing_platform_student },
    { metric: "Candidates — Other", value: report.source_breakdown.other },
  ]);

  const hiresSheet = workbook.addWorksheet("Recent Hires");
  hiresSheet.columns = [
    { header: "Candidate", key: "candidate_name", width: 24 },
    { header: "Opening", key: "opening", width: 28 },
    { header: "Role", key: "role_title", width: 24 },
    { header: "CTC Offered (LPA)", key: "ctc_offered", width: 18 },
    { header: "Hired At", key: "hired_at", width: 22 },
  ];
  hiresSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  hiresSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
  report.recent_hires.forEach((h) => {
    hiresSheet.addRow({
      candidate_name: h.candidate_name,
      opening: h.opening,
      role_title: h.role_title,
      ctc_offered: h.ctc_offered,
      hired_at: new Date(h.hired_at).toLocaleString("en-IN"),
    });
  });

  const drivesSheet = workbook.addWorksheet("By Opening");
  drivesSheet.columns = [
    { header: "Opening", key: "opening", width: 28 },
    { header: "Role", key: "role_title", width: 24 },
    { header: "Candidates", key: "candidates", width: 14 },
    { header: "Offers Accepted", key: "offers_accepted", width: 16 },
    { header: "Avg CTC (LPA)", key: "avg_ctc", width: 16 },
  ];
  drivesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  drivesSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0D9488" } };
  report.drive_summary.forEach((d) => {
    drivesSheet.addRow({
      opening: d.opening,
      role_title: d.role_title,
      candidates: d.candidates,
      offers_accepted: d.offers_accepted,
      avg_ctc: d.avg_ctc ?? "—",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fileSafeCompany = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  a.download = `${fileSafeCompany}-hiring-report.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
