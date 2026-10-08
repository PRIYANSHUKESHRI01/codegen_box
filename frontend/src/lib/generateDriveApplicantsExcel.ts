import ExcelJS from "exceljs";
import { DRIVE_APPLICATION_STAGE_LABELS, type DriveApplication } from "@/types/placement";

export async function generateDriveApplicantsExcel(
  applications: DriveApplication[],
  driveName: string,
  collegeName: string
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AptRun";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Applicants");

  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Email", key: "email", width: 30 },
    { header: "Roll Number", key: "roll_number", width: 16 },
    { header: "Branch", key: "branch", width: 10 },
    { header: "Stage", key: "stage", width: 20 },
    { header: "CTC Offered (LPA)", key: "ctc_offered", width: 18 },
    { header: "Stage Updated", key: "stage_updated_at", width: 20 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };

  applications.forEach((a) => {
    sheet.addRow({
      name: a.user.name,
      email: a.user.email,
      roll_number: a.user.roll_number ?? "—",
      branch: a.user.branch ?? "—",
      stage: DRIVE_APPLICATION_STAGE_LABELS[a.stage],
      ctc_offered: a.ctc_offered ?? "—",
      stage_updated_at: new Date(a.stage_updated_at).toLocaleString("en-IN"),
    });
  });

  sheet.autoFilter = { from: "A1", to: "G1" };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fileSafeDrive = `${collegeName}-${driveName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  a.download = `${fileSafeDrive}-applicants.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
