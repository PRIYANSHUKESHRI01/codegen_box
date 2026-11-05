import { api } from "@/lib/api";

/**
 * The PDF reports the server makes and keeps (student reports, mock interview reports …). A report is generated once, stored,
 * and every later download is that same stored file — the history lists below are what the archive remembers.
 */
export type ReportKind = "student_report" | "interview_report" | "interview_session_report" | "section_report";

export interface ReportRecord {
  id: string;
  kind: ReportKind;
  title: string;
  filename: string;
  /** "staff" reports include the college's internal follow-up notes; "student" reports (the student's own copy) never do. */
  audience: "staff" | "student";
  size_bytes: number;
  pages: number | null;
  /** The headline figures as they were the day it was made, so a history row can show them without opening the file. */
  summary: Record<string, number | string | null>;
  student: { id: number; name: string; roll_number: string | null; section: string | null; branch: string | null } | null;
  interview: { slug: string; title: string } | null;
  generated_by: { name: string | null; role: string | null } | null;
  downloads: number;
  last_downloaded_at: string | null;
  created_at: string;
}

/** Whose screen is asking — decides which API prefix the reports live under (the server re-checks every request). */
export type ReportRole = "admin_tpo" | "section_coordinator" | "admin_internal" | "superadmin" | "user";

export function reportBase(role: ReportRole | string | undefined): string {
  switch (role) {
    case "admin_tpo":
      return "/tpo";
    case "section_coordinator":
      return "/coordinator";
    case "admin_internal":
    case "superadmin":
      return "/admin";
    default:
      return "/me";
  }
}

/** Where the list / generate / download calls of one student's reports live, for this role. */
export function studentReportPaths(role: ReportRole | string | undefined, studentId?: number) {
  const base = reportBase(role);
  const own = base === "/me";

  return {
    generate: own ? "/me/report" : `${base}/students/${studentId}/reports`,
    list: own ? "/me/reports" : `${base}/students/${studentId}/reports`,
    download: (id: string) => `${base}/reports/${id}/download`,
  };
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking at once can cancel the download in some browsers; give it a moment.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Fetches the STORED file (with the caller's token — a plain link cannot carry it) and saves it. */
export async function downloadStoredReport(downloadPath: string, filename: string): Promise<void> {
  const blob = await api.getFile(downloadPath);
  saveBlob(blob, filename);
}

export async function generateStudentReport(role: ReportRole | string | undefined, studentId?: number): Promise<ReportRecord> {
  const res = await api.post<{ report: ReportRecord }>(studentReportPaths(role, studentId).generate);
  return res.report;
}

export async function listStudentReports(role: ReportRole | string | undefined, studentId?: number): Promise<ReportRecord[]> {
  const res = await api.get<{ reports: ReportRecord[] }>(studentReportPaths(role, studentId).list);
  return res.reports;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function reportWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
