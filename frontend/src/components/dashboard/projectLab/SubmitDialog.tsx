"use client";

import { useState } from "react";
import { FileArchive, Loader2, Send, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/projectLab";
import { PROJECT_LAB_ERROR, type EnrollmentData, type EnrollmentResponse } from "@/types/projectLab";

interface SubmitDialogProps {
  enrollment: EnrollmentData;
  /** The editor is open, so a code snapshot can be taken. */
  workspaceRunning: boolean;
  onClose: () => void;
  onSubmitted: (res: EnrollmentResponse["enrollment"]) => void;
  /** Runs just before the project is sent (the workspace page uses it to deliver any pending authorship report first). */
  beforeSubmit?: () => Promise<void>;
  /** The project asks students to write the code themselves: say what the reviewer will see. */
  authorshipChecked?: boolean;
}

const inputClass =
  "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-medium text-primary outline-none placeholder:text-text-muted focus:border-accent-primary";

/**
 * Hand-in. The code is captured from the open workspace at the moment of
 * submitting — there's nothing to upload — so this dialog is mostly about
 * telling the student exactly what will and won't be sent.
 */
export function SubmitDialog({ enrollment, workspaceRunning, onClose, onSubmitted, beforeSubmit, authorshipChecked = false }: SubmitDialogProps) {
  const [repoUrl, setRepoUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { done, total } = enrollment.progress;
  const needsRepo = !workspaceRunning;
  const canSubmit = !busy && (!needsRepo || repoUrl.trim() !== "");

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // So the evidence frozen with this submission includes everything up to this moment. Never a reason to fail.
      await beforeSubmit?.().catch(() => undefined);
      const res = await api.post<{ enrollment: EnrollmentData }>(`/project-lab/enrollments/${enrollment.id}/submit`, {
        repo_url: repoUrl.trim() || null,
        live_url: liveUrl.trim() || null,
        notes: notes.trim() || null,
      });
      onSubmitted(res.enrollment);
    } catch (err) {
      if (err instanceof ApiError && err.code === PROJECT_LAB_ERROR.notRunning) {
        setError("Your workspace isn't open, so there's no code to capture. Open it again, or add a repository link.");
      } else if (err instanceof ApiError && err.errors) {
        setError(Object.values(err.errors)[0]?.[0] ?? err.message);
      } else {
        setError(errorMessage(err, "We couldn't submit your project. Please try again."));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      onClose={busy ? () => {} : onClose}
      closeOnBackdrop={!busy}
      title="Submit your project"
      subtitle={enrollment.topic.title}
      icon={Send}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-btn border border-border-strong bg-elevated px-4 py-2 text-xs font-bold text-primary hover:bg-surface-hover disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Submit for review
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="rounded-control border border-border-subtle bg-elevated p-3.5">
          <p className="flex items-center gap-2 font-bold text-primary">
            <FileArchive className="h-4 w-4 text-accent-primary" />
            {workspaceRunning ? "A snapshot of your workspace will be sent" : "No workspace snapshot (it isn't open)"}
          </p>
          <p className="mt-1.5 leading-relaxed text-text-secondary">
            {workspaceRunning
              ? "Your project files are captured as they are right now. Left out: node_modules, vendor, build output, tool caches, and any .env or key files — keep a .env.example so the reviewer knows what to set."
              : "Open your workspace to include your code. Without it, the reviewer only has the repository link below."}
          </p>
          <p className="mt-2 font-semibold text-primary">
            {done} of {total} milestones ticked
          </p>
          {done === 0 && total > 0 && (
            <p className="mt-1 flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              You haven&apos;t ticked any milestones. Reviewers check what you claim is done.
            </p>
          )}
        </div>

        <label className="block">
          <span className="mb-1 block font-bold text-primary">
            Repository link {needsRepo ? <span className="text-status-danger">(required)</span> : <span className="font-medium text-text-secondary">(optional)</span>}
          </span>
          <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/you/your-project" inputMode="url" className={inputClass} />
        </label>

        <label className="block">
          <span className="mb-1 block font-bold text-primary">
            Live demo link <span className="font-medium text-text-secondary">(optional)</span>
          </span>
          <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} placeholder="https://your-project.example.com" inputMode="url" className={inputClass} />
        </label>

        <label className="block">
          <span className="mb-1 block font-bold text-primary">
            Notes for the reviewer <span className="font-medium text-text-secondary">(optional)</span>
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            maxLength={4000}
            placeholder="How to run it, test logins, what's unfinished, decisions you made…"
            className={`${inputClass} resize-none`}
          />
        </label>

        {authorshipChecked && (
          <p className="rounded-control border border-border-subtle bg-elevated p-3 leading-relaxed text-text-secondary">
            <strong className="text-primary">What your reviewer also sees:</strong> a short summary of how the code was written — how many pastes from
            outside were refused (count and size only, never what you copied), typing patterns, and your commit history. It points the reviewer
            to what is worth a closer look; it does not change your milestones.
          </p>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-status-danger">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
