"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, CheckCircle2, Loader2, MessageSquareText, Phone, Trash2, Undo2, Users, StickyNote, type LucideIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HpPill, hpBtn } from "@/components/portal/kit";
import type { CoordinatorNote, NoteKind } from "@/types/coordinator";
import { confirmDialog } from "@/lib/dialogs";

export const NOTE_KINDS: { id: NoteKind; label: string; icon: LucideIcon }[] = [
  { id: "call", label: "Call", icon: Phone },
  { id: "message", label: "Message", icon: MessageSquareText },
  { id: "meeting", label: "Meeting", icon: Users },
  { id: "note", label: "Note", icon: StickyNote },
];

const KIND_ICON: Record<NoteKind, LucideIcon> = { call: Phone, message: MessageSquareText, meeting: Users, note: StickyNote };

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
};

const QUICK_DUE: { label: string; days: number }[] = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];

const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

/**
 * The form that writes one note — what was done, and (optionally) when to come back to it. Used inline in the student
 * drawer and on its own in the quick "Log follow-up" dialog. Posts to `${basePath}` and hands the saved note to `onSaved`.
 */
export function NoteForm({ basePath, onSaved, autoFocus = false, compact = false }: { basePath: string; onSaved: (note: CoordinatorNote) => void; autoFocus?: boolean; compact?: boolean }) {
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<NoteKind>("call");
  const [due, setDue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (body.trim().length < 2 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ note: CoordinatorNote }>(basePath, { body: body.trim(), kind, follow_up_on: due || undefined });
      onSaved(res.note);
      setBody("");
      setDue("");
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.body?.[0] ?? err.errors?.follow_up_on?.[0] ?? err.message : "Couldn't save that note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Log a follow-up">
      <div role="radiogroup" aria-label="What kind of follow-up" className="flex flex-wrap gap-1.5">
        {NOTE_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={kind === k.id}
            onClick={() => setKind(k.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-2xs font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              kind === k.id ? "bg-indigo-500/10 text-indigo-700 ring-indigo-500/30 dark:text-indigo-300" : "bg-[rgb(var(--bg-surface-rgb))] text-text-secondary ring-border-subtle hover:bg-elevated hover:text-primary"
            )}
          >
            <k.icon className="h-3 w-3" aria-hidden /> {k.label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="note-body" className="sr-only">What happened, or what needs doing</label>
        <textarea
          id="note-body"
          autoFocus={autoFocus}
          rows={compact ? 2 : 3}
          maxLength={1000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g. Spoke to the parent — Rahul will retake the aptitude test by Friday."
          className="w-full resize-y rounded-xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-3 py-2.5 text-xs text-primary outline-none transition-colors placeholder:text-text-muted focus:border-indigo-500"
        />
        <p className="mt-1 text-right text-3xs tabular text-text-muted">{body.length}/1000</p>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
          <CalendarClock className="h-3 w-3" aria-hidden /> Follow up on <span className="font-medium normal-case tracking-normal">(optional)</span>
        </legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_DUE.map((q) => (
            <button
              key={q.label}
              type="button"
              aria-pressed={due === inDays(q.days)}
              onClick={() => setDue(due === inDays(q.days) ? "" : inDays(q.days))}
              className={cn(
                "rounded-full px-2.5 py-1 text-2xs font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                due === inDays(q.days) ? "bg-amber-500/10 text-amber-700 ring-amber-500/30 dark:text-amber-300" : "bg-[rgb(var(--bg-surface-rgb))] text-text-secondary ring-border-subtle hover:bg-elevated"
              )}
            >
              {q.label}
            </button>
          ))}
          <input
            type="date"
            aria-label="Pick a follow-up date"
            min={isoDay(new Date())}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="h-7 rounded-lg border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-2 text-2xs text-primary outline-none focus:border-indigo-500"
          />
        </div>
      </fieldset>

      {error && <p role="alert" className="text-2xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}

      <button type="submit" disabled={saving || body.trim().length < 2} className={hpBtn("primary", "sm", "w-full disabled:opacity-50")}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save to the log
      </button>
    </form>
  );
}

/**
 * A student's follow-up log: the form to add to it, and every note with who wrote it, when, and whether it is done.
 * `readOnly` (the TPO's view) hides the form and the actions — a TPO can see what the coordinator did but never edits it.
 */
export function NotesPanel({
  listPath,
  notePath,
  readOnly = false,
  onChanged,
}: {
  /** GET (and POST, unless read-only) here: `/coordinator/students/{id}/notes` or the TPO's read-only twin. */
  listPath: string;
  /** Base for changing one note: `/coordinator/notes` (PUT/DELETE `${notePath}/{id}`). */
  notePath?: string;
  readOnly?: boolean;
  /** Fired after anything changes, so the page can refresh its summary and queue. */
  onChanged?: () => void;
}) {
  const [notes, setNotes] = useState<CoordinatorNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setNotes((await api.get<{ notes: CoordinatorNote[] }>(listPath)).notes);
    } catch (err) {
      setNotes([]);
      setError(err instanceof ApiError ? err.message : "Couldn't load the follow-up log.");
    }
  }, [listPath]);

  useEffect(() => {
    setNotes(null);
    void load();
  }, [load]);

  const toggle = async (note: CoordinatorNote) => {
    if (!notePath) return;
    setBusyId(note.id);
    try {
      const res = await api.put<{ note: CoordinatorNote }>(`${notePath}/${note.id}`, { resolved: !note.resolved });
      setNotes((prev) => (prev ?? []).map((n) => (n.id === note.id ? res.note : n)));
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update that note.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (note: CoordinatorNote) => {
    if (!notePath || !(await confirmDialog({ title: "Delete this note?", message: "This can't be undone.", tone: "danger", confirmLabel: "Delete note" }))) return;
    setBusyId(note.id);
    try {
      await api.delete(`${notePath}/${note.id}`);
      setNotes((prev) => (prev ?? []).filter((n) => n.id !== note.id));
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that note.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <NoteForm
          basePath={listPath}
          compact
          onSaved={(note) => {
            setNotes((prev) => [note, ...(prev ?? [])]);
            onChanged?.();
          }}
        />
      )}

      {error && <p role="alert" className="text-2xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}

      {notes === null ? (
        <div className="space-y-2" aria-busy="true" role="status" aria-label="Loading the follow-up log">
          {[0, 1].map((i) => <div key={i} className="hp-skeleton h-16 rounded-xl" />)}
        </div>
      ) : notes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-subtle px-4 py-6 text-center text-2xs text-text-muted">
          {readOnly ? "The coordinator hasn't logged anything for this student." : "Nothing logged yet. Notes you write here are seen by you and the TPO — never by the student."}
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Follow-up log">
          {notes.map((n) => {
            const Icon = KIND_ICON[n.kind] ?? StickyNote;
            return (
              <li key={n.id} className={cn("rounded-xl border border-border-subtle p-3", n.resolved && "bg-elevated/40")}>
                <div className="flex items-start gap-2.5">
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", n.resolved ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20" : "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300")}>
                    {n.resolved ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Icon className="h-3.5 w-3.5" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("whitespace-pre-wrap break-words text-xs leading-relaxed", n.resolved ? "text-text-muted line-through decoration-text-muted/40" : "text-primary")}>{n.body}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-3xs text-text-muted">
                      <span>{n.author?.name ?? "A former coordinator"}{n.created_at ? ` · ${shortDate(n.created_at)}` : ""}</span>
                      {n.follow_up_on && !n.resolved && (
                        <HpPill tone={n.overdue ? "rose" : "amber"} icon={CalendarClock} size="sm">
                          {n.overdue ? "Overdue" : "Due"} {shortDate(n.follow_up_on)}
                        </HpPill>
                      )}
                      {n.resolved && <span className="font-semibold text-emerald-700 dark:text-emerald-300">Done</span>}
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggle(n)}
                        disabled={busyId === n.id}
                        aria-label={n.resolved ? "Reopen this follow-up" : "Mark this follow-up done"}
                        title={n.resolved ? "Reopen" : "Mark done"}
                        className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                      >
                        {busyId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : n.resolved ? <Undo2 className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      {n.mine && (
                        <button
                          type="button"
                          onClick={() => remove(n)}
                          disabled={busyId === n.id}
                          aria-label="Delete this note"
                          title="Delete"
                          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
