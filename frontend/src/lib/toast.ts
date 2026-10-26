import { useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The one feedback-toast store for the app ("Profile saved", "Failed to publish", "Exported 40 students").
 *
 * Before this, ~45 pages each carried a private copy of the same four things — a `useState` message, a `setTimeout`
 * that never got cleared (so a second toast was cut short by the first one's timer), a hand-pasted card and a
 * z-index guess. Every message looked identical whether it was a success or an error, and two messages in quick
 * succession simply replaced each other. This module is the single replacement: a module-level store (so it can be
 * called from a page, a panel, a hook or plain TypeScript, and never needs a provider to exist) rendered by
 * `<Toaster />`, which the root layout mounts once.
 *
 * It is deliberately a different system from `lib/notifications` — that one is the server-driven bell ("your drive
 * was mapped") and links somewhere; this one is the immediate answer to something the person just did.
 */

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  /** Runs, then the toast closes. */
  onClick?: () => void;
  /** A client-side link instead of a callback. */
  href?: string;
}

export interface ToastOptions {
  tone?: ToastTone;
  /** A bold first line. Without it the message itself is the bold line. */
  title?: string;
  /** How long it stays, in ms. `Infinity` keeps it until dismissed. Default depends on tone and length. */
  duration?: number;
  action?: ToastAction;
  /** Replaces the tone's default icon. */
  icon?: LucideIcon;
  /**
   * Same id = same toast: showing it again updates the one on screen (new text, timer restarts) instead of piling up.
   * Without an id, an identical tone + message that is still on screen is treated as the same toast.
   */
  id?: string;
}

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  title?: string;
  duration: number;
  action?: ToastAction;
  icon?: LucideIcon;
  /** How many times this exact toast was raised while on screen ("×3"). */
  count: number;
  /** Bumps whenever the toast is re-raised, so its timer and progress bar restart. */
  revision: number;
}

/** A call site can pass a bare tone, or a full options bag. */
export type ToastInput = ToastTone | ToastOptions;

/**
 * What pages hand to their panels as `triggerToast`. Existing panels only ever call it with one argument, which still
 * works — the tone is then worked out from the wording (see `inferTone`). Pass the tone when the caller knows it.
 */
export type ToastTrigger = (message: string, input?: ToastInput) => unknown;

/** More than this on screen at once is noise: the oldest goes. */
export const MAX_VISIBLE_TOASTS = 4;

const BASE_MS: Record<ToastTone, number> = { success: 3_800, info: 4_800, warning: 6_000, error: 7_000 };
const PER_CHAR_MS = 32;
const MAX_MS = 14_000;

/** How long to leave a message up: a floor per tone, plus reading time for longer text, so a long server error is not gone before it is read. */
export function toastDuration(tone: ToastTone, text: string): number {
  return Math.min(MAX_MS, BASE_MS[tone] + Math.max(0, text.length - 40) * PER_CHAR_MS);
}

const ERROR_RE =
  /^(failed|couldn['’]?t|could not|can['’]?t|cannot|unable|error|something went wrong|not allowed|forbidden|denied|invalid)\b|\b(failed to|went wrong|was rejected|was declined|timed out)\b|\bfailed[.!:]|\bfailed$/i;
const WARNING_RE =
  /^(please|enter|select|choose|pick|add|provide|fill|set|confirm|use an?|no |nothing|there (is|are) no|at least|you (need|must|have to)|already|(that|this|those|these)\b[^.]*\balready)\b|\b(is required|are required|must be|needs? to be|not (yet )?(ready|available)|nothing to|could not|couldn['’]?t|unable to|ran short|no [a-z ]{0,30}found)\b/i;
const INFO_RE = /\b(isn['’]t available|is not available|coming soon|no changes|nothing changed|not supported|had no)\b/i;

/**
 * For the older call sites that still pass a bare string. Errors and nudges are recognised by their wording; anything
 * else is a success, because that is overwhelmingly what a one-line "X was Y." message is. A call site that knows
 * better should say so — an explicit tone always wins over this.
 */
export function inferTone(message: string): ToastTone {
  const text = message.trim();
  if (INFO_RE.test(text)) return "info";
  if (ERROR_RE.test(text)) return "error";
  if (WARNING_RE.test(text)) return "warning";
  return "success";
}

// ── Store ────────────────────────────────────────────────────────────────────────────────────────────────────────

let items: ToastItem[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const EMPTY: ToastItem[] = [];

function emit(next: ToastItem[]) {
  items = next;
  listeners.forEach((l) => l());
}

export function subscribeToToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts(): ToastItem[] {
  return items;
}

function normalise(input: ToastInput | undefined): ToastOptions {
  return typeof input === "string" ? { tone: input } : input ?? {};
}

/** Raise a toast. Returns its id, which `dismissToast` accepts. */
export function showToast(message: string, input?: ToastInput): string {
  const text = String(message ?? "").trim();
  const opts = normalise(input);
  const tone = opts.tone ?? inferTone(text);

  if (!text && !opts.title) return "";

  const key = opts.id ?? `${tone}:${opts.title ?? ""}:${text}`;
  const existing = items.find((t) => t.id === key);
  const duration = opts.duration ?? toastDuration(tone, `${opts.title ?? ""}${text}`);

  if (existing) {
    // Re-raised while still visible (a double-click, a retry): count it and restart the clock rather than stacking a twin.
    const sameId = opts.id !== undefined;
    emit(
      items.map((t) =>
        t.id === key
          ? { ...t, tone, message: text, title: opts.title, duration, action: opts.action, icon: opts.icon, count: sameId ? 1 : t.count + 1, revision: t.revision + 1 }
          : t
      )
    );
    return key;
  }

  const next: ToastItem = { id: key, tone, message: text, title: opts.title, duration, action: opts.action, icon: opts.icon, count: 1, revision: ++sequence };
  const merged = [...items, next];
  emit(merged.length > MAX_VISIBLE_TOASTS ? merged.slice(merged.length - MAX_VISIBLE_TOASTS) : merged);
  return key;
}

export function dismissToast(id: string): void {
  if (items.some((t) => t.id === id)) emit(items.filter((t) => t.id !== id));
}

export function clearToasts(): void {
  if (items.length) emit(EMPTY);
}

/** Test seam: back to a clean slate. */
export function resetToasts(): void {
  items = [];
  sequence = 0;
  listeners.forEach((l) => l());
}

// ── The callable API ─────────────────────────────────────────────────────────────────────────────────────────────

export interface ToastApi {
  (message: string, input?: ToastInput): string;
  success: (message: string, opts?: Omit<ToastOptions, "tone">) => string;
  error: (message: string, opts?: Omit<ToastOptions, "tone">) => string;
  warning: (message: string, opts?: Omit<ToastOptions, "tone">) => string;
  info: (message: string, opts?: Omit<ToastOptions, "tone">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

function build(): ToastApi {
  const api = ((message: string, input?: ToastInput) => showToast(message, input)) as ToastApi;
  api.success = (message, opts) => showToast(message, { ...opts, tone: "success" });
  api.error = (message, opts) => showToast(message, { ...opts, tone: "error" });
  api.warning = (message, opts) => showToast(message, { ...opts, tone: "warning" });
  api.info = (message, opts) => showToast(message, { ...opts, tone: "info" });
  api.dismiss = dismissToast;
  api.clear = clearToasts;
  return api;
}

/**
 * Usable anywhere, hook or not: `toast.success("Saved")`, `toast.error(err.message)`,
 * `toast("Moved to Interview", { action: { label: "Undo", onClick } })`.
 */
export const toast: ToastApi = build();

/**
 * The hook form, for components: `const triggerToast = useToast();`. The returned function is the same stable object
 * every render (safe in dependency arrays) and calling it needs no provider.
 */
export function useToast(): ToastApi {
  return toast;
}

/** What `<Toaster />` renders. */
export function useToastItems(): ToastItem[] {
  return useSyncExternalStore(subscribeToToasts, getToasts, () => EMPTY);
}
