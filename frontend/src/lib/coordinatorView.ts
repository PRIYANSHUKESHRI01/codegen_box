import type { AttentionItem, CoordinatorStudent, FollowUp } from "@/types/coordinator";

/**
 * Pure helpers behind the Section Coordinator dashboard: the follow-up wording, the extra filters that sit on top of the
 * shared cohort filters, and the CSV "call list" a coordinator takes to the phone. No network, no React — so each of
 * them is unit-tested.
 */

/** "Overdue · 3 Oct", "Due today", "Due 9 Oct" — or null when there is nothing open with a date. */
export function followUpLabel(f: FollowUp | undefined | null, today: Date = new Date()): { label: string; tone: "rose" | "amber" | "sky" } | null {
  if (!f || f.open === 0) return null;

  if (f.next_due) {
    const due = new Date(`${f.next_due}T00:00:00`);
    const short = due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (f.overdue || due < start) return { label: `Overdue · ${short}`, tone: "rose" };
    if (f.due_today || due.getTime() === start.getTime()) return { label: "Due today", tone: "amber" };

    return { label: `Due ${short}`, tone: "sky" };
  }

  return { label: f.open === 1 ? "1 open note" : `${f.open} open notes`, tone: "sky" };
}

export type FollowUpFilter = "all" | "due" | "open";

export interface CoordinatorExtraFilters {
  /** Only students in the "needs your attention" queue. */
  attention: boolean;
  /** "due" = overdue or due today; "open" = any open follow-up. */
  followUp: FollowUpFilter;
}

export const DEFAULT_EXTRA_FILTERS: CoordinatorExtraFilters = { attention: false, followUp: "all" };

export function hasExtraFilters(f: CoordinatorExtraFilters): boolean {
  return f.attention || f.followUp !== "all";
}

export function matchesExtraFilters(student: CoordinatorStudent, filters: CoordinatorExtraFilters, attentionIds: ReadonlySet<number>): boolean {
  if (filters.attention && !attentionIds.has(student.id)) return false;
  if (filters.followUp === "due" && !(student.follow_up.overdue || student.follow_up.due_today)) return false;
  if (filters.followUp === "open" && student.follow_up.open === 0) return false;

  return true;
}

/** The reasons for one student as a single readable line. */
export function reasonsLine(item: AttentionItem | undefined): string {
  return item ? item.reasons.map((r) => r.label).join(" · ") : "";
}

/**
 * One CSV cell. Quotes are doubled and anything containing a comma, quote or line break is wrapped. A cell that starts with
 * `=`, `+`, `-`, `@`, tab or carriage return is prefixed with an apostrophe: names and notes are typed by other people,
 * and a spreadsheet would otherwise run them as a formula.
 */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const CALL_LIST_HEADERS = ["Name", "Roll number", "Branch", "Section", "Phone", "Parent phone", "Email", "Readiness", "Last practice", "Why they are on this list", "Follow-up"];

/** The call list: one row per student with the numbers to ring and the reason to ring them. UTF-8 with a BOM so Excel reads names correctly. */
export function buildCallList(students: readonly CoordinatorStudent[], attention: ReadonlyMap<number, AttentionItem>, today: Date = new Date()): string {
  const rows = students.map((s) => [
    s.name,
    s.roll_number ?? "",
    s.branch ?? "",
    s.section ?? "",
    s.phone ?? "",
    s.parent_phone ?? "",
    s.email,
    s.readiness_score,
    s.activity.days_since_practice === null ? "Never" : s.activity.days_since_practice === 0 ? "Today" : `${s.activity.days_since_practice} days ago`,
    reasonsLine(attention.get(s.id)),
    followUpLabel(s.follow_up, today)?.label ?? "",
  ]);

  return "﻿" + [CALL_LIST_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function attentionById(items: readonly AttentionItem[]): Map<number, AttentionItem> {
  return new Map(items.map((i) => [i.student_id, i]));
}
