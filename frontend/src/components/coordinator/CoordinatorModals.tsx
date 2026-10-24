"use client";

import { useState } from "react";
import { NotebookPen, ShieldAlert, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { HpButton, hpLabel } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import { NoteForm } from "./NotesPanel";
import type { CoordinatorNote, CoordinatorStudent } from "@/types/coordinator";

/** The quick "Log a follow-up" dialog — one student, one note, optionally a date to come back to it. */
export function FollowUpModal({ student, onClose, onSaved }: { student: CoordinatorStudent; onClose: () => void; onSaved: (note: CoordinatorNote) => void }) {
  return (
    <Modal variant="premium" onClose={onClose} title="Log a follow-up" subtitle={`${student.name}${student.roll_number ? ` · ${student.roll_number}` : ""}`} icon={NotebookPen} size="md">
      <p className="mb-4 text-2xs leading-relaxed text-text-muted">
        What you write is kept for you and your TPO — the student never sees it. A date puts them back on your list when it comes due.
      </p>
      <NoteForm
        basePath={`/coordinator/students/${student.id}/notes`}
        autoFocus
        onSaved={(note) => {
          onSaved(note);
          onClose();
        }}
      />
    </Modal>
  );
}

const BLOCK_REASONS = ["Sharing an account with someone else", "Misconduct in a contest or test", "Has left the college", "Asked to by the TPO"];

/** Blocking asks WHY: the reason is kept (the TPO can read it) and the student is signed out on their next request. */
export function BlockStudentModal({ student, onClose, onConfirm }: { student: CoordinatorStudent; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [preset, setPreset] = useState<string>("");
  const [detail, setDetail] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reason = [preset, detail.trim()].filter(Boolean).join(" — ");
  const valid = reason.length >= 3;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || working) return;
    setWorking(true);
    setError(null);
    try {
      await onConfirm(reason.slice(0, 255));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't block this account.");
      setWorking(false);
    }
  };

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      closeOnBackdrop={false}
      title={`Block ${student.name}?`}
      subtitle="They are signed out on their next request and can't sign back in until the account is unblocked."
      icon={ShieldAlert}
      iconClassName="bg-rose-500/10 text-rose-600"
      size="md"
      footer={
        <>
          <HpButton type="button" variant="secondary" onClick={onClose} disabled={working}>Cancel</HpButton>
          <HpButton type="submit" form="block-student-form" variant="danger" isLoading={working} disabled={!valid}>Block account</HpButton>
        </>
      }
    >
      <form id="block-student-form" onSubmit={submit} className="space-y-4">
        <div role="radiogroup" aria-label="Why block this account" className="flex flex-wrap gap-1.5">
          {BLOCK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={preset === r}
              onClick={() => setPreset(preset === r ? "" : r)}
              className={cn(
                "rounded-full px-3 py-1 text-2xs font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500",
                preset === r ? "bg-rose-500/10 text-rose-700 ring-rose-500/30 dark:text-rose-300" : "bg-[rgb(var(--bg-surface-rgb))] text-text-secondary ring-border-subtle hover:bg-elevated"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="block-detail" className={hpLabel}>Add detail {preset ? "(optional)" : "*"}</label>
          <textarea
            id="block-detail"
            rows={3}
            maxLength={200}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="What happened, so your TPO understands later"
            className="w-full resize-y rounded-xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-3 py-2.5 text-xs text-primary outline-none transition-colors placeholder:text-text-muted focus:border-rose-500"
          />
        </div>
        <p className="rounded-xl bg-elevated/50 px-3 py-2 text-2xs leading-relaxed text-text-muted">
          Your TPO can see who blocked this account and why. If it was a mistake, you can unblock it from the roster.
        </p>
        {error && <p role="alert" className="text-2xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
      </form>
    </Modal>
  );
}

/** Lifting a block the coordinator placed — a plain confirmation. */
export function UnblockStudentModal({ student, onClose, onConfirm }: { student: CoordinatorStudent; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setWorking(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unblock this account.");
      setWorking(false);
    }
  };

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      title={`Unblock ${student.name}?`}
      subtitle="They will be able to sign in and practise again."
      icon={ShieldCheck}
      iconClassName="bg-emerald-500/10 text-emerald-600"
      size="sm"
      footer={
        <>
          <HpButton type="button" variant="secondary" onClick={onClose} disabled={working}>Cancel</HpButton>
          <HpButton type="button" variant="success" onClick={go} isLoading={working}>Unblock account</HpButton>
        </>
      }
    >
      {student.blocked?.reason && (
        <p className="rounded-xl bg-elevated/50 px-3 py-2 text-2xs leading-relaxed text-text-secondary">
          <span className="font-bold text-text-muted">Blocked because: </span>
          {student.blocked.reason}
        </p>
      )}
      {error && <p role="alert" className="mt-3 text-2xs font-semibold text-rose-600 dark:text-rose-300">{error}</p>}
    </Modal>
  );
}
