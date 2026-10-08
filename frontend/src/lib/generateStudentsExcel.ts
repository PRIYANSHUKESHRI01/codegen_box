import ExcelJS from "exceljs";

export interface ExportableStudent {
  name: string;
  email: string;
  phone: string | null;
  parent_phone: string | null;
  roll_number: string | null;
  branch: string | null;
  section: string | null;
  cgpa: string | null;
  backlogs: number | null;
  readiness_score: number;
  readiness_tier: string;
  practice_score: number;
  eligible_for_active_drive: boolean | null;
  is_blocked: boolean;
}

export async function generateStudentsExcel(students: ExportableStudent[], collegeName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AptRun";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Student Cohort");

  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Parent Phone", key: "parent_phone", width: 16 },
    { header: "Roll Number", key: "roll_number", width: 16 },
    { header: "Branch", key: "branch", width: 10 },
    { header: "Section", key: "section", width: 10 },
    { header: "CGPA", key: "cgpa", width: 8 },
    { header: "Backlogs", key: "backlogs", width: 10 },
    { header: "Readiness Score", key: "readiness_score", width: 16 },
    { header: "Readiness Tier", key: "readiness_tier", width: 18 },
    { header: "7-Day Practice Score", key: "practice_score", width: 18 },
    { header: "Eligible for Active Drive", key: "eligible", width: 22 },
    { header: "Account Status", key: "account_status", width: 15 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

  students.forEach((s) => {
    sheet.addRow({
      name: s.name,
      email: s.email,
      phone: s.phone ?? "—",
      parent_phone: s.parent_phone ?? "—",
      roll_number: s.roll_number ?? "—",
      branch: s.branch ?? "—",
      section: s.section ?? "—",
      cgpa: s.cgpa ?? "—",
      backlogs: s.backlogs ?? "—",
      readiness_score: s.readiness_score,
      readiness_tier: s.readiness_tier,
      practice_score: s.practice_score,
      eligible: s.eligible_for_active_drive === null ? "No active drives" : s.eligible_for_active_drive ? "Yes" : "No",
      account_status: s.is_blocked ? "Blocked" : "Active",
    });
  });

  sheet.autoFilter = { from: "A1", to: "N1" };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fileSafeCollege = collegeName.toLowerCase().replace(/\s+/g, "-");
  a.download = `${fileSafeCollege}-student-cohort.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
