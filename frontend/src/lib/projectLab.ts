import { ApiError } from "@/lib/api";
import { PROJECT_LAB_ERROR, type AuthorshipLabel, type Difficulty, type SubmissionStatus, type WorkspaceState } from "@/types/projectLab";

/**
 * Fired on `window` after anything that changes what a student has bought, so
 * chrome that cached it (the sidebar's Project Lab lock) can refresh itself.
 */
export const SUBSCRIPTION_CHANGED_EVENT = "aptrun:subscription-changed";

export function notifySubscriptionChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SUBSCRIPTION_CHANGED_EVENT));
}

/** True when a request failed because the student's plan doesn't include Project Lab (the upgrade prompt case). */
export function isProjectLabRequired(err: unknown): boolean {
  return err instanceof ApiError && err.code === PROJECT_LAB_ERROR.required;
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export const DIFFICULTY_META: Record<Difficulty, { label: string; className: string }> = {
  beginner: { label: "Beginner", className: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300" },
  intermediate: { label: "Intermediate", className: "bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300" },
  advanced: { label: "Advanced", className: "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300" },
};

export const SUBMISSION_STATUS_META: Record<SubmissionStatus, { label: string; className: string }> = {
  pending_review: { label: "Waiting for review", className: "bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300" },
  in_review: { label: "Being reviewed", className: "bg-sky-500/10 border-sky-500/25 text-sky-700 dark:text-sky-300" },
  reviewed: { label: "Reviewed", className: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300" },
  needs_changes: { label: "Changes requested", className: "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300" },
};

/** How the authorship label reads in the review queue and on a submission. A pointer for a human, never a verdict. */
export const AUTHORSHIP_LABEL_META: Record<AuthorshipLabel, { label: string; className: string }> = {
  clear: { label: "Clear", className: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300" },
  review: { label: "Worth a look", className: "bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300" },
  attention: { label: "Needs attention", className: "bg-rose-500/10 border-rose-500/25 text-rose-700 dark:text-rose-300" },
  not_checked: { label: "Not checked", className: "bg-elevated border-border-subtle text-text-secondary" },
};

/** What each thing the editor's guard reports means, in plain words for the reviewer's timeline. */
export const GUARD_KIND_LABELS: Record<string, string> = {
  paste_blocked: "Paste from outside refused",
  clipboard_read_blocked: "Paste (menu or terminal) from outside refused",
  drop_blocked: "Drag-and-drop from outside refused",
  upload_blocked: "File upload refused",
  bulk_insert_blocked: "Large text insertion by a script refused",
  bulk_insert: "Large text insertion noted",
  synthetic_blocked: "Script-made input refused",
  window_blocked: "Extra editor window refused",
  fast_typing: "Typing faster than a person can type",
  robotic_typing: "Keystrokes at perfectly regular intervals",
  paste_internal: "Copy-and-paste inside the workspace",
  paste_trusted: "Command pasted from the SOW",
  drop_asset: "Image or font added",
};

/** Whole percent for a 0–1 share, or "—" when unknown. */
export function formatPercent(share: number | null): string {
  return share === null ? "—" : `${Math.round(share * 100)}%`;
}

/** "3 h 20 min" / "45 min" for a length of time in seconds. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** Why a workspace stopped, in words a student can act on. */
export function stopReasonText(reason: WorkspaceState["stop_reason"]): string | null {
  switch (reason) {
    case "submitted":
      return "Your project was submitted, so the workspace was stopped. Your files are kept — if the reviewer asks for changes you can open it again.";
    case "idle":
      return "Your workspace was stopped because the page was closed for a while. Your files are safe.";
    case "max_session":
      return "Your workspace reached the 8-hour session limit and was stopped. Your files are safe — start it again to keep going.";
    case "lapsed":
      return "Your Project Lab plan has ended, so the workspace was stopped. Your files are kept — renew to continue.";
    case "hours_exhausted":
      return "You've used all your workspace hours for this period, so the workspace was stopped. Your files are safe.";
    case "disk_full":
      return "Your workspace was stopped because it went over its disk limit. Free some space (delete node_modules or build output), then start it again.";
    case "host_error":
      return "Your workspace stopped unexpectedly. Start it again — your files are safe.";
    default:
      return null;
  }
}

/** Hours as "12.5 h" — one decimal at most, no trailing ".0". */
export function formatHours(hours: number): string {
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Saves a Blob the way the other authenticated downloads in the app do (a Bearer-token fetch can't be a plain <a href>). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
