import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RecentSubmission, TopicMastery, VerdictStat, LanguageUsage } from "@/types/studentStats";
import { pdfSafe } from "@/lib/pdfTextSafe";

interface DriveEligibilityRow {
  company: string;
  role: string;
  ctcRange: string | null;
  status: "eligible" | "not_eligible" | "unknown";
}

interface ReportPdfInput {
  studentName: string;
  /** Omitted for a "Mellow Direct" student with no college — never fabricate one. */
  college?: string;
  /** "Unrated" for a student who hasn't entered a contest yet — never a default-looking number. */
  ratingLabel: string;
  solvedTotal: number;
  streakCurrent: number;
  streakMax: number;
  readinessScore: number;
  readinessTier: string;
  acceptanceRate: number;
  accepted: number;
  totalSubmissions: number;
  verdictStats: VerdictStat[];
  languageUsage: LanguageUsage[];
  topicMastery: TopicMastery[];
  recentSubmissions: RecentSubmission[];
  driveEligibility: DriveEligibilityRow[];
}

const ACCENT: [number, number, number] = [79, 70, 229];
const MUTED: [number, number, number] = [107, 114, 128];

const STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
};

export function generateReportPdf(input: ReportPdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text("CodeGen Box — Performance Report", margin, y);

  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(input.college ? `${input.studentName} · ${input.college}` : input.studentName, margin, y);
  doc.text(
    new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
    pageWidth - margin,
    y,
    { align: "right" }
  );

  y += 14;
  doc.text(`Rating: ${input.ratingLabel} · Readiness: ${input.readinessTier} (${input.readinessScore}%)`, margin, y);

  y += 20;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  const stats: [string, string][] = [
    ["Acceptance Rate", `${input.acceptanceRate}% (${input.accepted}/${input.totalSubmissions})`],
    ["Problems Solved", String(input.solvedTotal)],
    ["Current Streak", `${input.streakCurrent} days (best ${input.streakMax})`],
    ["Readiness", `${input.readinessScore}% · ${input.readinessTier}`],
  ];
  const colWidth = (pageWidth - margin * 2) / stats.length;
  stats.forEach(([label, value], i) => {
    const x = margin + i * colWidth;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(value, x, y + 16);
  });

  y += 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text("Verdict Distribution", margin, y);
  y += 14;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Verdict", "Count", "Share"]],
    body: input.verdictStats.map((v) => [
      STATUS_LABEL[v.status] ?? v.status,
      String(v.count),
      input.totalSubmissions > 0 ? `${Math.round((v.count / input.totalSubmissions) * 100)}%` : "0%",
    ]),
    headStyles: { fillColor: ACCENT, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    theme: "grid",
    tableWidth: pageWidth / 2 - margin,
  });

  const verdictTableEndY =
    // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
    doc.lastAutoTable.finalY;

  autoTable(doc, {
    startY: y,
    margin: { left: pageWidth / 2 + 10, right: margin },
    head: [["Language", "Submissions"]],
    body: input.languageUsage.map((l) => [l.language, String(l.count)]),
    headStyles: { fillColor: ACCENT, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    theme: "grid",
  });

  // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
  y = Math.max(verdictTableEndY, doc.lastAutoTable.finalY) + 24;

  if (y > 680) {
    doc.addPage();
    y = 50;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Topic Mastery", margin, y);
  y += 14;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Topic", "Solved", "Accuracy"]],
    body: input.topicMastery.map((t) => [t.topic, `${t.solved}/${t.total}`, `${t.accuracy}%`]),
    headStyles: { fillColor: ACCENT, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    theme: "grid",
  });

  // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
  y = doc.lastAutoTable.finalY + 24;

  if (y > 620) {
    doc.addPage();
    y = 50;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Recent Submissions", margin, y);
  y += 14;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Problem", "Difficulty", "Language", "Verdict", "Submitted"]],
    body: input.recentSubmissions.slice(0, 15).map((s) => [
      s.problem_title,
      s.difficulty,
      s.language,
      STATUS_LABEL[s.status] ?? s.status,
      new Date(s.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    ]),
    headStyles: { fillColor: ACCENT, fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    theme: "grid",
  });

  // @ts-expect-error jspdf-autotable augments doc with lastAutoTable at runtime
  y = doc.lastAutoTable.finalY + 24;

  if (y > 600) {
    doc.addPage();
    y = 50;
  }

  if (input.driveEligibility.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Placement Drive Eligibility", margin, y);
    y += 14;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Company", "Role", "CTC", "Status"]],
      body: input.driveEligibility.map((c) => [
        c.company,
        c.role,
        pdfSafe(c.ctcRange ?? "Not disclosed"),
        c.status === "eligible" ? "Eligible" : c.status === "not_eligible" ? "Not Eligible" : "Unknown",
      ]),
      headStyles: { fillColor: ACCENT, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      theme: "grid",
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `CodeGen Box · Generated ${new Date().toLocaleString("en-IN")} · Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" }
    );
  }

  const fileSafeName = input.studentName.toLowerCase().replace(/\s+/g, "-");
  doc.save(`codegen-box-performance-report-${fileSafeName}.pdf`);
}
