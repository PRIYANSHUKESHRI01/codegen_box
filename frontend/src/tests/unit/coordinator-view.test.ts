import { describe, expect, it } from "vitest";
import { attentionById, buildCallList, csvCell, followUpLabel, matchesExtraFilters, reasonsLine } from "@/lib/coordinatorView";
import type { AttentionItem, CoordinatorStudent, FollowUp } from "@/types/coordinator";

const NONE: FollowUp = { open: 0, next_due: null, overdue: false, due_today: false, last_note_at: null };
const TODAY = new Date(2026, 9, 21); // 21 Oct 2026

const student = (over: Partial<CoordinatorStudent> = {}): CoordinatorStudent =>
  ({
    id: 1, name: "Asha Rao", email: "asha@example.com", roll_number: "21CS001", branch: "CSE", section: "A", phone: "9876543210", parent_phone: "9123456780",
    readiness_score: 42, activity: { engagement: "dormant", days_since_practice: 34, last_practice_at: null, last_seen_at: null, active_days_30: 0 },
    follow_up: NONE, ...over,
  }) as CoordinatorStudent;

describe("follow-up wording", () => {
  it("says nothing when there is nothing open", () => {
    expect(followUpLabel(NONE, TODAY)).toBeNull();
    expect(followUpLabel(undefined, TODAY)).toBeNull();
  });

  it("calls out overdue, due today and upcoming follow-ups in that order of urgency", () => {
    expect(followUpLabel({ open: 1, next_due: "2026-10-18", overdue: true, due_today: false, last_note_at: null }, TODAY)).toEqual({ label: "Overdue · 18 Oct", tone: "rose" });
    expect(followUpLabel({ open: 1, next_due: "2026-10-21", overdue: false, due_today: true, last_note_at: null }, TODAY)).toEqual({ label: "Due today", tone: "amber" });
    expect(followUpLabel({ open: 2, next_due: "2026-10-25", overdue: false, due_today: false, last_note_at: null }, TODAY)).toEqual({ label: "Due 25 Oct", tone: "sky" });
  });

  it("falls back to a count for open notes with no date", () => {
    expect(followUpLabel({ open: 1, next_due: null, overdue: false, due_today: false, last_note_at: null }, TODAY)?.label).toBe("1 open note");
    expect(followUpLabel({ open: 3, next_due: null, overdue: false, due_today: false, last_note_at: null }, TODAY)?.label).toBe("3 open notes");
  });
});

describe("extra roster filters", () => {
  const due = student({ id: 2, follow_up: { open: 1, next_due: "2026-10-20", overdue: true, due_today: false, last_note_at: null } });
  const open = student({ id: 3, follow_up: { open: 1, next_due: "2026-11-01", overdue: false, due_today: false, last_note_at: null } });
  const plain = student({ id: 4 });
  const queue = new Set([4]);

  it("keeps everything by default", () => {
    for (const s of [due, open, plain]) expect(matchesExtraFilters(s, { attention: false, followUp: "all" }, queue)).toBe(true);
  });

  it("narrows to the attention queue", () => {
    expect([due, open, plain].filter((s) => matchesExtraFilters(s, { attention: true, followUp: "all" }, queue)).map((s) => s.id)).toEqual([4]);
  });

  it("narrows to follow-ups that are due, or to any open one", () => {
    expect([due, open, plain].filter((s) => matchesExtraFilters(s, { attention: false, followUp: "due" }, queue)).map((s) => s.id)).toEqual([2]);
    expect([due, open, plain].filter((s) => matchesExtraFilters(s, { attention: false, followUp: "open" }, queue)).map((s) => s.id)).toEqual([2, 3]);
  });
});

describe("CSV call list", () => {
  it("escapes quotes, commas and line breaks", () => {
    expect(csvCell('He said "hi", twice')).toBe('"He said ""hi"", twice"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("defuses spreadsheet formulas typed into a name or a note", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd"]) {
      expect(csvCell(evil).replace(/^"/, "")).toMatch(/^'/);
    }
    expect(csvCell("Anna-Marie")).toBe("Anna-Marie");
  });

  it("lists who to ring, their numbers and why", () => {
    const item: AttentionItem = { student_id: 1, name: "Asha Rao", roll_number: "21CS001", readiness_score: 42, score: 40, reasons: [{ code: "dormant", label: "No practice for 34 days" }, { code: "needs_training", label: "Readiness 42 — needs training" }] };
    const csv = buildCallList([student(), student({ id: 5, name: "=cmd|' /C calc'!A0", phone: null, activity: { engagement: "not_started", days_since_practice: null, last_practice_at: null, last_seen_at: null, active_days_30: 0 } })], attentionById([item]), TODAY);

    const lines = csv.replace("﻿", "").trimEnd().split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Name,Roll number,Branch,Section,Phone,Parent phone,Email,Readiness,Last practice,Why they are on this list,Follow-up");
    expect(lines[1]).toBe("Asha Rao,21CS001,CSE,A,9876543210,9123456780,asha@example.com,42,34 days ago,No practice for 34 days · Readiness 42 — needs training,");
    expect(lines[2].startsWith("'=cmd")).toBe(true);
    expect(lines[2]).toContain(",Never,");
    expect(reasonsLine(undefined)).toBe("");
  });
});
