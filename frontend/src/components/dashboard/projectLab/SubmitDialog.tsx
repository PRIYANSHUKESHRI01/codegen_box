"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, FileArchive, Loader2, Save, Send, ShieldCheck, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { saveBlob } from "@/lib/reportDocuments";
import { errorMessage, formatBytes } from "@/lib/projectLab";
import { PROJECT_LAB_ERROR, type EnrollmentData, type EnrollmentResponse, type SaveData } from "@/types/projectLab";

interface SubmitDialogProps {
  enrollment: EnrollmentData;
  /** The editor is open, so AptRun can pack the code out of it. */
  workspaceRunning: boolean;
  onClose: () => void;
  onSubmitted: (res: EnrollmentResponse["enrollment"]) => void;
  /** Runs just before the project is saved or sent (the workspace page uses it to deliver any pending authorship report first). */
  beforeSubmit?: () => Promise<void>;
  /** The project asks students to write the code themselves: say what the reviewer will see. */
  authorshipChecked?: boolean;
}

const inputClass =
  "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-medium text-primary outline-none placeholder:text-text-muted focus:border-accent-primary";

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * Save and hand in. All of a project's code is written in the AptRun editor, and AptRun itself packs it out of the open workspace into
 * a zip — there is nothing to upload and no way to: "Save progress" keeps a checkpoint you (and your reviewer) can see, and "Submit for
 * review" sends the latest. So this dialog is about telling the student exactly what will be sent, and keeping the list of what has
 * been saved.
 */
export function SubmitDialog({ enrollment, workspaceRunning, onClose, onSubmitted, beforeSubmit, authorshipChecked = false }: SubmitDialogProps) {
  const [liveUrl, setLiveUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saves, setSaves] = useState<SaveData[]>([]);

  const { done, total } = enrollment.progress;
  const canAct = workspaceRunning && busy === null;

  const loadSaves = useCallback(() => {
    api
      .get<{ saves: SaveData[] }>(`/project-lab/enrollments/${enrollment.id}/saves`)
      .then((res) => setSaves(res.saves))
      .catch(() => undefined);
  }, [enrollment.id]);

  useEffect(() => {
    loadSaves();
  }, [loadSaves]);

  const explain = (err: unknown, fallback: string): string => {
    if (err instanceof ApiError && err.code === PROJECT_LAB_ERROR.notRunning) {
      return "Your workspace isn't open. AptRun packs your code out of the editor, so open the workspace first, then try again.";
    }
    if (err instanceof ApiError && err.errors) return Object.values(err.errors)[0]?.[0] ?? err.message;
    return errorMessage(err, fallback);
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      await beforeSubmit?.().catch(() => undefined);
      const res = await api.post<{ save: SaveData; saves: SaveData[] }>(`/project-lab/enrollments/${enrollment.id}/saves`);
      setSaves(res.saves);
      setNotice(`Saved at ${when(res.save.saved_at)} — ${res.save.files} file${res.save.files === 1 ? "" : "s"}, ${formatBytes(res.save.size_bytes)}, zipped by AptRun.`);
    } catch (err) {
      setError(explain(err, "We couldn't save your progress. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    setBusy("submit");
    setError(null);
    setNotice(null);
    try {
      // So the evidence frozen with this submission includes everything up to this moment. Never a reason to fail.
      await beforeSubmit?.().catch(() => undefined);
      const res = await api.post<{ enrollment: EnrollmentData }>(`/project-lab/enrollments/${enrollment.id}/submit`, {
        live_url: liveUrl.trim() || null,
        notes: notes.trim() || null,
      });
      onSubmitted(res.enrollment);
    } catch (err) {
      setError(explain(err, "We couldn't submit your project. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  const download = async (s: SaveData) => {
    try {
      saveBlob(await api.getFile(`/project-lab/enrollments/${enrollment.id}/saves/${s.id}/download`), `project-${enrollment.id}-save-${s.id}.zip`);
    } catch (err) {
      setError(explain(err, "We couldn't download that save."));
    }
  };

  return (
    <Modal
      onClose={busy ? () => {} : onClose}
      closeOnBackdrop={busy === null}
      title="Save & submit your project"
      subtitle={enrollment.topic.title}
      icon={Send}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            className="rounded-btn border border-border-strong bg-elevated px-4 py-2 text-xs font-bold text-primary hover:bg-surface-hover disabled:opacity-60"
          >
            Close
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canAct}
            className="inline-flex items-center gap-2 rounded-btn border border-accent-primary/40 bg-accent-primary/10 px-4 py-2 text-xs font-bold text-accent-primary hover:bg-accent-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save progress
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canAct}
            className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "submit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Submit for review
          </button>
        </>
      }
    >
      <div className="space-y-4 text-xs">
        <div className="rounded-control border border-border-subtle bg-elevated p-3.5">
          <p className="flex items-center gap-2 font-bold text-primary">
            <FileArchive className="h-4 w-4 text-accent-primary" />
            {workspaceRunning ? "AptRun zips your project from the editor" : "Open your workspace to save or submit"}
          </p>
          <p className="mt-1.5 leading-relaxed text-text-secondary">
            {workspaceRunning
              ? "Your project files are packed into a zip by AptRun, straight from the editor you are working in — there is nothing to upload. Left out: node_modules, vendor, build output, tool caches, and any .env or key files — keep a .env.example so the reviewer knows what to set."
              : "AptRun can only pack your code out of the open editor — nothing can be uploaded, and a link to code written somewhere else isn't a submission. Open the workspace, then save or submit from it."}
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

        <section aria-label="Saved progress">
          <h3 className="font-bold text-primary">Saved progress</h3>
          <p className="text-3xs text-text-muted">Your reviewer can see how the project grew. The newest 10 are kept.</p>
          {saves.length === 0 ? (
            <p className="mt-1.5 rounded-control border border-dashed border-border-strong px-3 py-3 text-2xs text-text-muted">Nothing saved yet. Press “Save progress” whenever you reach a good point.</p>
          ) : (
            <ul className="mt-1.5 divide-y divide-border-subtle rounded-control border border-border-subtle">
              {saves.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block font-semibold text-primary">{when(s.saved_at)}</span>
                    <span className="block text-2xs text-text-muted">
                      {s.files} file{s.files === 1 ? "" : "s"} · {formatBytes(s.size_bytes)} · {s.milestones_done}/{s.milestones_total} milestones
                    </span>
                  </span>
                  <button type="button" onClick={() => download(s)} className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-2.5 py-1 text-2xs font-bold text-primary hover:bg-surface-hover">
                    <Download className="h-3 w-3" aria-hidden /> .zip
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

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
          <p className="flex items-start gap-2 rounded-control border border-border-subtle bg-elevated p-3 leading-relaxed text-text-secondary">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />
            <span>
              <strong className="text-primary">What your reviewer also sees:</strong> a short summary of how the code was written — how many pastes from
              outside were refused (count and size only, never what you copied), typing patterns, your commit history, and whether files were copied
              in from outside AptRun. It points the reviewer to what is worth a closer look; it does not change your milestones.
            </span>
          </p>
        )}

        {notice && (
          <p role="status" className="flex items-start gap-2 rounded-control border border-status-success/30 bg-status-success/10 p-3 text-status-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
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
