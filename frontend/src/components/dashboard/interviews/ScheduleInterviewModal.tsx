"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, CalendarClock, Check, Loader2, Search, Users, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { HpButton, HpPill, hpInput, hpLabel } from "@/components/portal/kit";
import { ScNotice } from "@/components/portal/screeningKit";
import { BranchAudienceField, EVERYONE, audienceForRequest, type BranchAudience } from "@/components/branches/BranchAudienceField";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { sectionLabel } from "@/lib/sectionBreakdown";
import type { CohortStudent } from "@/types/cohort";
import type { InterviewSummary } from "@/types/interview";

const BASE_PATH = "/tpo/interviews";

interface Preview {
  count: number;
  blocked: number;
  label: string;
  sections: { section: string; count: number }[];
  sample: { id: number; name: string; roll_number: string | null; section: string | null }[];
}

/** `<input type="datetime-local">` speaks local time without a zone; the server wants an instant. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function inHours(hours: number): string {
  return toLocalInput(new Date(Date.now() + hours * 3_600_000).toISOString());
}

function branchAudienceOf(interview: InterviewSummary): BranchAudience {
  const a = interview.branch_audience as { departments?: string[]; disciplines?: string[]; branches?: string[] } | null | undefined;
  return a ? { departments: a.departments ?? [], disciplines: a.disciplines ?? [], branches: a.branches ?? [] } : EVERYONE;
}

/**
 * Schedule a college mock interview and choose who it is for.
 *
 * When it opens and closes, the score that counts as a pass, and the audience: years of study, sections, branches and individual
 * students — with a live "this reaches N students" count from the same rules the server will use. Saving publishes the interview
 * (when it is still a draft) and, if asked, tells exactly that audience by bell and e-mail.
 */
export function ScheduleInterviewModal({
  interview,
  onClose,
  onSaved,
}: {
  interview: InterviewSummary;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const wasPublished = interview.status === "published";

  const [opensAt, setOpensAt] = useState(toLocalInput(interview.opens_at));
  const [closesAt, setClosesAt] = useState(toLocalInput(interview.closes_at));
  const [target, setTarget] = useState(String(interview.qualifying_score_percent ? Math.round(Number(interview.qualifying_score_percent)) : 60));
  const [years, setYears] = useState<number[]>(interview.audience_filter?.years ?? []);
  const [sections, setSections] = useState<string[]>(interview.audience_filter?.sections ?? []);
  const [studentIds, setStudentIds] = useState<number[]>(interview.audience_filter?.student_ids ?? []);
  const [branches, setBranches] = useState<BranchAudience>(branchAudienceOf(interview));
  const [announce, setAnnounce] = useState(true);

  const [roster, setRoster] = useState<CohortStudent[]>([]);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ students: CohortStudent[] }>("/tpo/students/cohort")
      .then((res) => setRoster(res.students))
      .catch(() => setRoster([]));
  }, []);

  const allSections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of roster) if (s.section) counts.set(s.section, (counts.get(s.section) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  }, [roster]);

  const yearsPresent = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of roster) if (s.study_year) counts.set(s.study_year, (counts.get(s.study_year) ?? 0) + 1);
    return counts;
  }, [roster]);

  const picked = useMemo(() => roster.filter((s) => studentIds.includes(s.id)), [roster, studentIds]);
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return roster.filter((s) => !studentIds.includes(s.id) && (s.name.toLowerCase().includes(q) || (s.roll_number ?? "").toLowerCase().includes(q))).slice(0, 6);
  }, [roster, search, studentIds]);

  const filterBody = useMemo(
    () => ({
      branch_audience: audienceForRequest(branches),
      audience_filter: { years, sections, student_ids: studentIds },
    }),
    [branches, years, sections, studentIds]
  );

  // The head-count follows every change to the audience (debounced), from the server's own rules.
  const seq = useRef(0);
  useEffect(() => {
    const mine = ++seq.current;
    setPreviewing(true);
    const t = setTimeout(() => {
      api
        .post<Preview>(`${BASE_PATH}/audience-preview`, filterBody)
        .then((res) => mine === seq.current && setPreview(res))
        .catch(() => mine === seq.current && setPreview(null))
        .finally(() => mine === seq.current && setPreviewing(false));
    }, 300);
    return () => clearTimeout(t);
  }, [filterBody]);

  const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const opens = fromLocalInput(opensAt);
    const closes = fromLocalInput(closesAt);
    if (opens && closes && new Date(closes) <= new Date(opens)) {
      setError("The closing time must be after the opening time.");
      return;
    }
    const pass = Number(target);
    if (!Number.isFinite(pass) || pass < 1 || pass > 100) {
      setError("The pass mark must be between 1 and 100.");
      return;
    }
    if (preview && preview.count === 0) {
      setError("This audience has nobody in it yet. Widen the audience or add students before publishing.");
      return;
    }

    setSaving(true);
    try {
      await api.post(`${BASE_PATH}/${interview.slug}`, {
        status: "published",
        opens_at: opens,
        closes_at: closes,
        qualifying_score_percent: pass,
        announce,
        ...filterBody,
      });
      onSaved(wasPublished ? `"${interview.title}" schedule saved.` : `"${interview.title}" is scheduled and published.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.closes_at?.[0] ?? err.message : "Couldn't save the schedule.");
      setSaving(false);
    }
  };

  return (
    <Modal
      variant="premium"
      onClose={() => !saving && onClose()}
      title={wasPublished ? "Schedule & audience" : "Schedule & publish"}
      subtitle={interview.title}
      icon={CalendarClock}
      size="xl"
      footer={
        <>
          <HpButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton type="submit" form="schedule-interview-form" isLoading={saving} leftIcon={<Check className="h-4 w-4" />}>
            {saving ? "Saving…" : wasPublished ? "Save changes" : "Publish interview"}
          </HpButton>
        </>
      }
    >
      <form id="schedule-interview-form" onSubmit={submit} className="space-y-6">
        {/* When */}
        <section className="space-y-3" aria-label="When">
          <h3 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">When</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="sch-open" className={hpLabel}>Opens</label>
              <input id="sch-open" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} className={hpInput} />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <QuickButton onClick={() => setOpensAt(inHours(0))}>Now</QuickButton>
                <QuickButton onClick={() => setOpensAt(inHours(24))}>Tomorrow</QuickButton>
                <QuickButton onClick={() => setOpensAt("")}>No start time</QuickButton>
              </div>
            </div>
            <div>
              <label htmlFor="sch-close" className={hpLabel}>Closes</label>
              <input id="sch-close" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className={hpInput} />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <QuickButton onClick={() => setClosesAt(inHours(24 * 2))}>In 2 days</QuickButton>
                <QuickButton onClick={() => setClosesAt(inHours(24 * 7))}>In a week</QuickButton>
                <QuickButton onClick={() => setClosesAt("")}>No deadline</QuickButton>
              </div>
            </div>
          </div>
          <p className="text-2xs text-text-muted">
            Students can start only while it is open. A student who has already started when it closes may finish. Times are in your computer&apos;s time zone.
          </p>
          <div className="max-w-[220px]">
            <label htmlFor="sch-target" className={hpLabel}>Pass mark (%)</label>
            <input id="sch-target" type="number" min={1} max={100} value={target} onChange={(e) => setTarget(e.target.value)} className={hpInput} />
            <p className="mt-1 text-2xs text-text-muted">Scores at or above this count as reaching the target in the report.</p>
          </div>
        </section>

        {/* Who */}
        <section className="space-y-4" aria-label="Who">
          <h3 className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Who is it for</h3>

          <div>
            <p className={hpLabel}>Year of study</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4].map((y) => (
                <Chip key={y} on={years.includes(y)} onClick={() => setYears((p) => toggle(p, y))}>
                  Year {y}
                  {yearsPresent.has(y) && <span className="ml-1 opacity-70">({yearsPresent.get(y)})</span>}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className={hpLabel}>Sections</p>
            {allSections.length === 0 ? (
              <p className="text-2xs text-text-muted">Your students have no sections yet. Set them from the Student Cohort and they will appear here.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {allSections.map(([name, n]) => (
                  <Chip key={name} on={sections.includes(name)} onClick={() => setSections((p) => toggle(p, name))}>
                    {sectionLabel(name)} <span className="ml-1 opacity-70">({n})</span>
                  </Chip>
                ))}
              </div>
            )}
          </div>

          <BranchAudienceField value={branches} onChange={setBranches} />

          <div>
            <p className={hpLabel}>Also invite specific students</p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or roll number" aria-label="Search students to invite" className={cn(hpInput, "pl-9")} />
              {matches.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-control border border-border-strong bg-surface shadow-card">
                  {matches.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentIds((p) => [...p, s.id]);
                          setSearch("");
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-elevated"
                      >
                        <span className="font-semibold text-primary">{s.name}</span>
                        <span className="text-text-muted">{s.roll_number ?? "—"} · {s.section ? `Sec ${s.section}` : "no section"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {picked.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {picked.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1 rounded-full border border-accent-primary/30 bg-accent-primary/10 py-1 pl-2.5 pr-1.5 text-2xs font-bold text-accent-primary">
                    {s.name}
                    <button type="button" onClick={() => setStudentIds((p) => p.filter((id) => id !== s.id))} aria-label={`Remove ${s.name}`} className="rounded-full p-0.5 hover:bg-accent-primary/20">
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-2xs text-text-muted">A named student is invited whatever their section or branch says. With nothing else chosen above, only the named students can see it.</p>
          </div>
        </section>

        {/* Reach */}
        <section aria-label="Who this reaches" aria-live="polite" className="rounded-control border border-border-subtle bg-elevated/50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Users className="h-4 w-4" aria-hidden />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">{preview ? `${preview.count} student${preview.count === 1 ? "" : "s"}` : "Counting…"}</p>
              <p className="text-2xs text-text-muted">{preview?.label ?? "…"}{preview && preview.blocked > 0 ? ` · ${preview.blocked} blocked (not notified)` : ""}</p>
            </div>
          </div>
          {preview && preview.sections.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {preview.sections.map((s) => (
                <HpPill key={s.section} tone="slate" size="sm">{s.section} · {s.count}</HpPill>
              ))}
            </div>
          )}
        </section>

        <label className="flex cursor-pointer items-start gap-3 rounded-control border border-border-subtle p-3">
          <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <BellRing className="h-3.5 w-3.5 text-accent-primary" aria-hidden /> Tell these students
            </span>
            <span className="mt-0.5 block text-2xs leading-relaxed text-text-muted">
              {wasPublished
                ? "Sends a notification and an e-mail with the new timing to the audience above."
                : "Publishing notifies them in the app; this also sends an e-mail. Reminders go out an hour before it opens and before it closes (to those who have not finished)."}
            </span>
          </span>
        </label>

        {error && <ScNotice tone="rose">{error}</ScNotice>}
      </form>
    </Modal>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-2xs font-bold transition-colors",
        on ? "border-transparent bg-accent-primary text-white" : "border-border-strong bg-elevated text-text-secondary hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}

function QuickButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-3xs font-bold text-text-secondary transition-colors hover:text-primary">
      {children}
    </button>
  );
}
