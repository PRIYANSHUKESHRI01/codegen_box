import { useSyncExternalStore } from "react";

/**
 * The app's own "Are you sure?" and "Type a name" boxes — the replacement for `window.confirm` / `window.prompt`,
 * which paint a grey browser chrome dialog (headed with the site's address, in the OS's font, blocking the whole
 * tab, unthemeable and unreadable in dark mode) in the middle of an otherwise polished product.
 *
 * Promise-based so a call site reads exactly like the native one it replaces:
 *
 *   if (!(await confirmDialog({ title: "Delete this draft?", message: "This can't be undone.", tone: "danger" }))) return;
 *
 * Module-level, like `lib/toast`: no provider, callable from any handler. `<DialogHost />` (mounted once in the root
 * layout) draws whatever is requested. If no host is mounted — a unit test, or a render that failed — it falls back
 * to the native dialog rather than silently answering "no", so a destructive confirmation can never be skipped.
 */

export type DialogTone = "default" | "warning" | "danger";

interface BaseOptions {
  title: string;
  /** Plain text under the title. Newlines are kept. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

export interface ConfirmOptions extends BaseOptions {
  /** A short bulleted list under the message — e.g. the reasons something is not ready. */
  items?: string[];
}

export interface PromptOptions extends BaseOptions {
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  /** Return a message to refuse the value (shown under the field), or null to accept. */
  validate?: (value: string) => string | null;
}

export type DialogRequest =
  | ({ kind: "confirm"; id: number; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: "prompt"; id: number; resolve: (value: string | null) => void } & PromptOptions);

let hosts = 0;
let sequence = 0;
let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `<DialogHost />` calls this on mount so requests know a real dialog will answer them. */
export function registerDialogHost(): () => void {
  hosts += 1;
  return () => {
    hosts -= 1;
    // A host that unmounts with questions still open must not leave callers hanging forever.
    if (hosts === 0 && queue.length) {
      const pending = queue;
      queue = [];
      pending.forEach((r) => (r.kind === "confirm" ? r.resolve(false) : r.resolve(null)));
      emit();
    }
  };
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (hosts === 0) {
    const text = [options.title, options.message, ...(options.items ?? []).map((i) => `• ${i}`)].filter(Boolean).join("\n\n");
    return Promise.resolve(window.confirm(text));
  }
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { kind: "confirm", id: ++sequence, resolve, ...options }];
    emit();
  });
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (hosts === 0) return Promise.resolve(window.prompt([options.title, options.message].filter(Boolean).join("\n\n"), options.defaultValue ?? ""));
  return new Promise<string | null>((resolve) => {
    queue = [...queue, { kind: "prompt", id: ++sequence, resolve, ...options }];
    emit();
  });
}

/** Closes the request that is on screen and lets the next one (if any) take its place. */
export function settleDialog(id: number, answer: boolean | string | null): void {
  const request = queue.find((r) => r.id === id);
  if (!request) return;
  queue = queue.filter((r) => r.id !== id);
  if (request.kind === "confirm") request.resolve(answer === true);
  else request.resolve(typeof answer === "string" ? answer : null);
  emit();
}

/** The request being shown now (the oldest unanswered one). */
export function useActiveDialog(): DialogRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => queue[0] ?? null,
    () => null
  );
}

/** Test seam. */
export function resetDialogs(): void {
  const pending = queue;
  queue = [];
  pending.forEach((r) => (r.kind === "confirm" ? r.resolve(false) : r.resolve(null)));
  emit();
}
