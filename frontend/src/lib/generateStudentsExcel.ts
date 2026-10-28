import ExcelJS from "exceljs";
import { ENGAGEMENT_LABEL, rollupLanguages } from "./cohortInsights";
import { languageLabel } from "./judgeLanguages";
import { cohortVaultAiLabel } from "./vaultAi";
import type { CohortStudent } from "@/types/cohort";

export type ExportableStudent = Pick<
  CohortStudent,
  | "name"
  | "email"
  | "phone"
  | "parent_phone"
  | "roll_number"
  | "branch"
  | "section"
  | "year_label"
  | "vault_ai"
  | "cgpa"
  | "backlogs"
  | "readiness_score"
  | "readiness_tier"
  | "practice_score"
  | "eligible_for_active_drive"
  | "is_blocked"
  | "activated"
  | "onboarded"
  | "solved"
  | "activity"
  | "coding"
>;

const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } } as const;

function styleHeader(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = HEADER_FILL;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

/** A calendar date a TPO can sort on — blank when there isn't one. */
function dateCell(iso: string | null): Date | string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date;
}

/**
 * The roster as a spreadsheet: who they are, how ready they are, how actively
 * they practise, and which languages they code in (plus a second sheet that
 * rolls the languages up for the whole list). Exports exactly the rows passed —
 * the Student Cohort page hands it the current filtered, sorted view.
 */
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
    { header: "Branch", key: "branch", width: 14 },
    { header: "Section", key: "section", width: 10 },
    { header: "Year", key: "year", width: 12 },
    { header: "CGPA", key: "cgpa", width: 8 },
    { header: "Backlogs", key: "backlogs", width: 10 },
    { header: "Readiness Score", key: "readiness_score", width: 16 },
    { header: "Readiness Tier", key: "readiness_tier", width: 18 },
    { header: "7-Day Practice Score", key: "practice_score", width: 18 },
    { header: "Eligible for Active Drive", key: "eligible", width: 22 },
    { header: "Account Status", key: "account_status", width: 15 },
    { header: "Signed In Yet", key: "activated", width: 14 },
    { header: "Practice Status", key: "engagement", width: 16 },
    { header: "Last Practised", key: "last_practice", width: 16, style: { numFmt: "dd mmm yyyy" } },
    { header: "Days Since Practice", key: "days_since", width: 18 },
    { header: "Last Seen", key: "last_seen", width: 16, style: { numFmt: "dd mmm yyyy" } },
    { header: "Active Days (30d)", key: "active_days", width: 16 },
    { header: "Problems Solved", key: "solved_total", width: 16 },
    { header: "Easy", key: "solved_easy", width: 8 },
    { header: "Medium", key: "solved_medium", width: 9 },
    { header: "Hard", key: "solved_hard", width: 8 },
    { header: "Main Language (actual)", key: "primary_language", width: 22 },
    { header: "Says They Code In", key: "stated_language", width: 18 },
    { header: "Languages Used (solved)", key: "languages", width: 34 },
    { header: "Struggling In", key: "needs_work", width: 20 },
    { header: "Onboarding Answered", key: "onboarded", width: 18 },
    { header: "Vault AI Interview", key: "vault_ai", width: 24 },
  ];

  styleHeader(sheet);

  students.forEach((s) => {
    sheet.addRow({
      name: s.name,
      email: s.email,
      phone: s.phone ?? "—",
      parent_phone: s.parent_phone ?? "—",
      roll_number: s.roll_number ?? "—",
      branch: s.branch ?? "—",
      section: s.section ?? "—",
      year: s.year_label ?? "Not set",
      cgpa: s.cgpa ?? "—",
      backlogs: s.backlogs ?? "—",
      readiness_score: s.readiness_score,
      readiness_tier: s.readiness_tier,
      practice_score: s.practice_score,
      eligible: s.eligible_for_active_drive === null ? "No active drives" : s.eligible_for_active_drive ? "Yes" : "No",
      account_status: s.is_blocked ? "Blocked" : "Active",
      activated: s.activated ? "Yes" : "No — still on emailed password",
      engagement: ENGAGEMENT_LABEL[s.activity.engagement],
      last_practice: dateCell(s.activity.last_practice_at),
      days_since: s.activity.days_since_practice ?? "—",
      last_seen: dateCell(s.activity.last_seen_at),
      active_days: s.activity.active_days_30,
      solved_total: s.solved.total,
      solved_easy: s.solved.easy,
      solved_medium: s.solved.medium,
      solved_hard: s.solved.hard,
      primary_language: s.coding.primary_language ? languageLabel(s.coding.primary_language) : "—",
      stated_language: s.coding.stated_language ? languageLabel(s.coding.stated_language) : "—",
      languages: s.coding.languages.length ? s.coding.languages.map((l) => `${languageLabel(l.language)} (${l.solved})`).join(", ") : "—",
      needs_work: s.coding.needs_work.length ? s.coding.needs_work.map(languageLabel).join(", ") : "—",
      onboarded: s.onboarded ? "Yes" : "No",
      vault_ai: cohortVaultAiLabel(s.vault_ai),
    });
  });

  sheet.autoFilter = { from: "A1", to: { row: 1, column: sheet.columns.length } };

  // Second sheet: the same students, rolled up by language.
  const rollup = rollupLanguages(students as CohortStudent[]);
  const languages = workbook.addWorksheet("Languages");
  languages.columns = [
    { header: "Language", key: "language", width: 18 },
    { header: "Students Using It", key: "students", width: 18 },
    { header: "Students Mainly Using It", key: "mainly", width: 24 },
    { header: "Submissions", key: "attempts", width: 14 },
    { header: "Accepted %", key: "acceptance", width: 12 },
    { header: "Problems Solved", key: "solved", width: 16 },
    { header: "Students Struggling", key: "needs_work", width: 20 },
  ];
  styleHeader(languages);
  rollup.forEach((r) =>
    languages.addRow({
      language: languageLabel(r.language),
      students: r.students,
      mainly: r.mainly,
      attempts: r.attempts,
      acceptance: r.acceptanceRate,
      solved: r.solved,
      needs_work: r.needsWork,
    })
  );
  if (rollup.length === 0) languages.addRow({ language: "No code submitted yet" });

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
