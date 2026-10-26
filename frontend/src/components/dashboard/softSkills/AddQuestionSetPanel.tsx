"use client";

import { useState } from "react";
import { ChevronDown, Library, Loader2, Lock, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AppliedQuestionSet, QuestionSetItem } from "@/types/softSkill";
import { QuestionSetPicker } from "./QuestionSetPicker";
import { type ToastTrigger } from "@/lib/toast";

interface AddQuestionSetPanelProps {
  /** The caller's own question-set library endpoint. */
  setsPath: string;
  /** e.g. "/tpo/soft-skills" — the test's own endpoint. */
  basePath: string;
  assessmentSlug: string;
  /** Sets this test was already built from (shown as chips, and not offered again). */
  appliedSets: AppliedQuestionSet[];
  /** Why no more questions can be added (candidates have started, or the test is cancelled); null when open. */
  lockedReason: string | null;
  onAdded: (result: { added: number; skipped: number; setLabel: string; appliedSets: AppliedQuestionSet[] }) => void;
  onToast: ToastTrigger;
}

/**
 * "Add a ready-made question set" inside Manage Questions: for a test that already exists (a draft created without
 * a set, or one that should combine two). Same library and same "already used" markers as the create flow; the
 * set's questions are copied in, skipping any the test already has.
 */
export function AddQuestionSetPanel({ setsPath, basePath, assessmentSlug, appliedSets, lockedReason, onAdded, onToast }: AddQuestionSetPanelProps) {
  const [open, setOpen] = useState(appliedSets.length === 0 && !lockedReason);
  const [chosen, setChosen] = useState<QuestionSetItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!chosen) return;
    setAdding(true);
    setError(null);
    try {
      const res = await api.post<{ added: number; skipped: number; applied_sets: AppliedQuestionSet[] }>(`${basePath}/${assessmentSlug}/question-sets`, { question_set_id: chosen.id });
      onAdded({ added: res.added, skipped: res.skipped, setLabel: chosen.label, appliedSets: res.applied_sets });
      onToast(
        `Added ${res.added} question${res.added === 1 ? "" : "s"} from ${chosen.label}${res.skipped > 0 ? ` (${res.skipped} already in the test were skipped)` : ""}.`
      );
      setChosen(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that question set.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="space-y-3 rounded-[20px] border border-border-subtle bg-elevated/30 p-4 sm:p-5" aria-label="Add a question set">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent-primary/25 bg-accent-primary/10 text-accent-primary">
            <Library className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-13 font-bold tracking-tight text-primary">Add a ready-made question set</h3>
            <p className="text-2xs text-text-muted">AptRun&apos;s numbered papers of 25 questions. Sets you have used before are marked.</p>
          </div>
        </div>
        {!lockedReason && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1 rounded-control border border-border-subtle bg-surface px-3 py-1.5 text-2xs font-bold text-text-secondary hover:text-primary"
          >
            {open ? "Hide sets" : "Browse sets"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        )}
      </div>

      {appliedSets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">Built from</span>
          {appliedSets.map((s) => (
            <span key={s.id} title={`${s.set_title} — ${s.questions_added} questions added`} className="rounded-full bg-accent-primary/10 px-2 py-0.5 text-3xs font-bold text-accent-primary">
              {s.set_number !== null ? `Set ${s.set_number}` : s.set_title}
            </span>
          ))}
        </div>
      )}

      {lockedReason ? (
        <p className="flex items-start gap-2 rounded-control border border-border-subtle bg-surface px-3 py-2 text-2xs text-text-muted">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {lockedReason}
        </p>
      ) : (
        open && (
          <div className="space-y-3">
            <QuestionSetPicker catalogueUrl={setsPath} selected={chosen} onSelect={setChosen} disabledIds={appliedSets.map((s) => s.question_set_id).filter((id): id is number => id !== null)} listClassName="max-h-[340px] overflow-y-auto pr-1" />
            {error && (
              <p role="alert" className="text-2xs text-status-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={add}
              disabled={!chosen || adding}
              className="flex items-center gap-1.5 rounded-control bg-accent-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-primary-hover disabled:opacity-60"
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
              {chosen ? `Add ${chosen.label} to this test` : "Choose a set to add"}
            </button>
          </div>
        )
      )}
    </section>
  );
}
