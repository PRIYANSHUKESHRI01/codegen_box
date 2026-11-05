"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarCheck, CalendarClock, CalendarX2, CheckCircle2, Download, FileText, History, Mic, UserRound } from "lucide-react";
import { HpButton, HpCard, HpEmptyState, HpPill, HpSectionHeader, type HpTone } from "@/components/portal/kit";
import { api, ApiError } from "@/lib/api";
import { confirmDialog } from "@/lib/dialogs";
import { downloadStoredReport, formatBytes, reportWhen, type ReportRecord } from "@/lib/reportDocuments";
import { whenLabel } from "@/lib/interviewSchedule";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { CoordinatorInsights, FollowUpItem, FollowUpStatus, SectionEvent } from "@/types/coordinator";

/* ── Follow-ups ─────────────────────────────────────────────────────────── */

const COLUMNS: { status: FollowUpStatus; title: string; tone: HpTone; empty: string }[] = [
  { status: "overdue", title: "Overdue", tone: "rose", empty: "Nothing overdue." },
  { status: "today", title: "Due today", tone: "amber", empty: "Nothing due today." },
  { status: "upcoming", title: "Coming up", tone: "sky", empty: "Nothing scheduled." },
  { status: "no_date", title: "No date set", tone: "slate", empty: "Every follow-up has a date." },
];

const dueLabel = (iso: string | null) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "No date");

/** Every open follow-up on the section in one place, most urgent first. A click opens the student; one more marks it done. */
export function FollowUpBoard({ items, onOpen, onChanged }: { items: FollowUpItem[]; onOpen: (studentId: number) => void; onChanged: () => void }) {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);

  const visible = items.filter((i) => !done.has(i.id));

  const resolve = async (item: FollowUpItem) => {
    setBusy(item.id);
    try {
      await api.put(`/coordinator/notes/${item.id}`, { resolved: true });
      setDone((prev) => new Set(prev).add(item.id));
      toast.success(`Marked done for ${item.student.name ?? "the student"}.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update that follow-up.");
    } finally {
      setBusy(null);
    }
  };

  if (visible.length === 0) {
    return <HpEmptyState icon={CheckCircle2} tone="emerald" title="All caught up" description="No open follow-ups. Log a call or a note from any student's profile and it will show up here with its due date." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const list = visible.filter((i) => i.status === col.status);
        return (
          <HpCard key={col.status} spotlight={false} className="flex flex-col p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-primary">{col.title}</h3>
              <HpPill tone={col.tone} size="sm">
                {list.length}
              </HpPill>
            </div>
            <ul className="mt-3 flex-1 space-y-2.5">
              {list.length === 0 && <li className="text-2xs text-text-muted">{col.empty}</li>}
              {list.map((i) => (
                <li key={i.id} className="rounded-control border border-border-subtle bg-elevated/40 p-3">
                  <button type="button" onClick={() => i.student.id && onOpen(i.student.id)} className="flex w-full items-center gap-1.5 text-left text-xs font-bold text-primary hover:underline">
                    <UserRound className="h-3 w-3 shrink-0 text-text-muted" aria-hidden />
                    <span className="truncate">{i.student.name ?? "Student"}</span>
                  </button>
                  <p className="mt-1 line-clamp-3 text-2xs leading-relaxed text-text-secondary">{i.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className={cn("text-3xs font-bold uppercase tracking-wide", i.status === "overdue" ? "text-rose-600 dark:text-rose-300" : "text-text-muted")}>{dueLabel(i.follow_up_on)}</span>
                    <button
                      type="button"
                      onClick={() => void resolve(i)}
                      disabled={busy === i.id}
                      className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface px-2.5 py-1 text-3xs font-bold text-text-secondary transition-colors hover:text-primary disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> Done
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </HpCard>
        );
      })}
    </div>
  );
}

/* ── Scheduled events ───────────────────────────────────────────────────── */

const STATE: Record<SectionEvent["schedule_state"], { label: string; tone: HpTone }> = {
  unscheduled: { label: "Open any time", tone: "sky" },
  upcoming: { label: "Scheduled", tone: "indigo" },
  open: { label: "Open now", tone: "emerald" },
  closed: { label: "Closed", tone: "slate" },
};

/** What the college has scheduled for the section — mock AI interviews — and who has not done them yet. */
export function SectionEvents({ events, loading, onOpen }: { events: SectionEvent[]; loading: boolean; onOpen: (studentId: number) => void }) {
  const [reminding, setReminding] = useState<number | null>(null);

  const remind = async (e: SectionEvent) => {
    if (e.not_started === 0) return;
    const ok = await confirmDialog({
      title: `Remind ${e.not_started} student${e.not_started === 1 ? "" : "s"}?`,
      message: `They get a notification in the app about "${e.title}". Students who have already started or finished are not contacted.`,
      confirmLabel: "Send reminder",
    });
    if (!ok) return;

    setReminding(e.id);
    try {
      const closes = e.closes_at ? ` It closes ${whenLabel(e.closes_at)}.` : "";
      await api.post("/coordinator/students/bulk-notify", {
        student_ids: e.not_started_students.map((s) => s.id),
        channel: "in_app",
        title: `Reminder: ${e.title}`.slice(0, 120),
        message: `Your section coordinator is reminding you to take the AI mock interview "${e.title}".${closes}`.slice(0, 500),
      });
      toast.success(`Reminder sent to ${e.not_started_students.length} student(s).`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send the reminder.");
    } finally {
      setReminding(null);
    }
  };

  if (loading) return <p className="py-10 text-center text-2xs text-text-muted">Loading what the college has scheduled…</p>;

  if (events.length === 0) {
    return (
      <HpEmptyState
        icon={CalendarX2}
        tone="slate"
        title="Nothing scheduled for your section"
        description="When your TPO schedules a mock AI interview for your students, it appears here with how many have taken it and who still needs a nudge."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {events.map((e) => {
        const state = STATE[e.schedule_state];
        const pct = e.in_section > 0 ? Math.round((e.completed / e.in_section) * 100) : 0;

        return (
          <HpCard key={e.id} spotlight={false} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">
                  <Mic className="h-3 w-3" aria-hidden /> AI mock interview
                </p>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold text-primary">{e.title}</h3>
                <p className="mt-1 flex items-center gap-1.5 text-2xs text-text-muted">
                  <CalendarClock className="h-3 w-3" aria-hidden />
                  {e.opens_at ? `Opens ${whenLabel(e.opens_at)}` : "Open already"}
                  {e.closes_at ? ` · closes ${whenLabel(e.closes_at)}` : " · no deadline"}
                </p>
              </div>
              <HpPill tone={state.tone} size="sm">
                {state.label}
              </HpPill>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-2xs">
                <span className="font-bold text-primary">
                  {e.completed} of {e.in_section} done
                </span>
                <span className="text-text-muted">{e.average_score !== null ? `${e.average_score}% average` : "no scores yet"}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-2xs text-text-muted">
                {e.in_progress} part-way · <b className={e.not_started > 0 ? "text-amber-600 dark:text-amber-300" : "text-text-secondary"}>{e.not_started} not started</b>
              </p>
            </div>

            {e.not_started > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {e.not_started_students.slice(0, 12).map((s) => (
                    <button key={s.id} type="button" onClick={() => onOpen(s.id)} className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-2xs text-text-secondary transition-colors hover:text-primary" title={s.roll_number ?? undefined}>
                      {s.name}
                    </button>
                  ))}
                  {e.not_started > 12 && <span className="px-1 py-1 text-2xs text-text-muted">+{e.not_started - 12} more</span>}
                </div>
                <HpButton className="mt-3" variant="secondary" size="sm" leftIcon={<BellRing className="h-3.5 w-3.5" />} isLoading={reminding === e.id} onClick={() => void remind(e)}>
                  Remind {e.not_started_students.length} student{e.not_started_students.length === 1 ? "" : "s"}
                </HpButton>
              </div>
            )}
          </HpCard>
        );
      })}
    </div>
  );
}

/* ── Reports ────────────────────────────────────────────────────────────── */

/** The section report as a PDF, kept for good: make one, and every earlier one stays here to download again. */
export function SectionReports({ studentCount, sectionLabel }: { studentCount: number; sectionLabel: string }) {
  const [reports, setReports] = useState<ReportRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReports((await api.get<{ reports: ReportRecord[] }>("/coordinator/reports/section")).reports);
    } catch {
      setReports([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const make = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.post<{ report: ReportRecord }>("/coordinator/reports/section");
      await downloadStoredReport(`/coordinator/reports/${res.report.id}/download`, res.report.filename);
      toast.success(`Section ${sectionLabel} report is ready${res.report.pages ? ` · ${res.report.pages} pages` : ""}.`);
      void load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't make the report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (r: ReportRecord) => {
    setOpenId(r.id);
    try {
      await downloadStoredReport(`/coordinator/reports/${r.id}/download`, r.filename);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't open that report.");
    } finally {
      setOpenId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <HpCard spotlight={false} className="p-5 lg:col-span-1">
        <HpSectionHeader title="Section report" subtitle="A PDF you can hand to the faculty or the placement cell" icon={FileText} tone="indigo" />
        <ul className="mt-3 list-disc space-y-1 pl-5 text-2xs leading-relaxed text-text-secondary">
          <li>Headline numbers, readiness mix and the trend</li>
          <li>Who needs a conversation, who leads, who slipped</li>
          <li>Scheduled interviews and who has not done them</li>
          <li>Open follow-ups and every student&apos;s standing</li>
        </ul>
        <HpButton className="mt-4 w-full" onClick={() => void make()} isLoading={busy} disabled={studentCount === 0} leftIcon={<FileText className="h-4 w-4" />}>
          {busy ? "Preparing…" : `Generate report (${studentCount} students)`}
        </HpButton>
        <p className="mt-2 text-3xs text-text-muted">Each report is saved below exactly as it was made.</p>
      </HpCard>

      <HpCard spotlight={false} className="p-5 lg:col-span-2">
        <HpSectionHeader title="Earlier reports" icon={History} tone="slate" />
        {reports === null ? (
          <p className="mt-3 text-2xs text-text-muted">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="mt-3 rounded-control border border-dashed border-border-strong px-4 py-8 text-center text-2xs text-text-muted">No reports yet. The first one you generate is kept here.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border-subtle">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-13 font-bold text-primary">{r.title}</p>
                  <p className="text-2xs text-text-muted">
                    {reportWhen(r.created_at)} · {r.pages ?? "?"} pp · {formatBytes(r.size_bytes)}
                    {typeof r.summary.average_readiness === "number" ? ` · avg readiness ${r.summary.average_readiness}` : ""}
                  </p>
                </div>
                <HpButton variant="secondary" size="sm" isLoading={openId === r.id} leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => void reopen(r)}>
                  PDF
                </HpButton>
              </li>
            ))}
          </ul>
        )}
      </HpCard>
    </div>
  );
}

/** A short "this week" strip for the page header: what to do first. */
export function WeekAtAGlance({ insights, overdue, attention }: { insights: CoordinatorInsights | null; overdue: number; attention: number }) {
  const notStarted = (insights?.events ?? []).reduce((n, e) => n + (e.schedule_state === "closed" ? 0 : e.not_started), 0);
  const lines: { text: string; tone: HpTone }[] = [];

  if (overdue > 0) lines.push({ text: `${overdue} follow-up${overdue === 1 ? " is" : "s are"} overdue`, tone: "rose" });
  if (attention > 0) lines.push({ text: `${attention} student${attention === 1 ? "" : "s"} need a conversation`, tone: "amber" });
  if (notStarted > 0) lines.push({ text: `${notStarted} still to take a scheduled interview`, tone: "sky" });

  if (lines.length === 0) {
    return (
      <p className="flex items-center gap-2 text-2xs font-semibold text-emerald-600 dark:text-emerald-300">
        <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> Nothing urgent this week.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {lines.map((l) => (
        <HpPill key={l.text} tone={l.tone} size="sm">
          {l.text}
        </HpPill>
      ))}
    </div>
  );
}
