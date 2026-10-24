"use client";

import { useSyncExternalStore } from "react";
import { api, ApiError } from "@/lib/api";

/**
 * In-app notifications — the client half of the bell.
 *
 * One module-level store however many components read it: a single timer and a single request in flight, so a page with
 * the bell, the toaster and the notifications list open costs the API one poll, not three.
 *
 * "Real time" is a cheap poll (GET /notifications/signal: unread count + newest id, ~100 bytes, one index scan) every
 * ~15 s while the tab is visible, plus an immediate check when a hidden tab comes back, the window regains focus or the
 * network returns. Only when that signal moves does it fetch the list. PHP-FPM can't hold a socket open per student; this
 * survives proxies, sleeping laptops and flaky mobile data, and a returning student sees a new drive within a heartbeat.
 *
 * It only DISPLAYS state: reading and dismissing are optimistic and reconciled with the server's unread count, and a
 * failed write puts things back. Nothing here can create a notification or see anyone else's.
 */

export type NotificationSeverity = "info" | "success" | "warning" | "critical";

export type NotificationCategory = "drives" | "assessments" | "hackathons" | "announcements" | "vault" | "progress" | "operations" | "plan" | "account";

export interface AppNotification {
  id: number;
  type: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  /** An in-app path ("/dashboard/drives") or null. Always validated again before navigating. */
  url: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export interface NotificationPreference {
  category: NotificationCategory;
  label: string;
  description: string;
  /** Plan and account notifications can't be switched off. */
  mandatory: boolean;
  enabled: boolean;
}

interface ListResponse {
  data: AppNotification[];
  next_before: number | null;
  unread_count: number;
}

interface SignalResponse {
  unread_count: number;
  latest_id: number;
}

export const NOTIFICATION_POLL_MS = 15_000;
const POLL_JITTER_MS = 3_000;
const MAX_BACKOFF_MS = 120_000;
const HEAD_PAGE = 20;

/** Plan changes already get their own toast (PlanSyncWatcher), so they appear in the bell without a second one. */
const NO_TOAST_TYPES = new Set(["plan.changed"]);

export interface NotificationState {
  /** idle until started; loading for the first fetch; ready after; error if the first fetch failed. */
  status: "idle" | "loading" | "ready" | "error";
  items: AppNotification[];
  unread: number;
  latestId: number;
  nextBefore: number | null;
  loadingMore: boolean;
}

const INITIAL: NotificationState = { status: "idle", items: [], unread: 0, latestId: 0, nextBefore: null, loadingMore: false };

let state: NotificationState = INITIAL;
let owner: number | null = null;
let starts = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let failures = 0;
let cleanup: (() => void) | null = null;

const listeners = new Set<() => void>();
const arrivalListeners = new Set<(items: AppNotification[]) => void>();

function set(next: Partial<NotificationState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** An in-app path only: "/dashboard/drives" yes; "https://…", "//x", "javascript:…" no. */
export function safeInternalPath(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("/") && !url.startsWith("//") && !url.includes("\\") ? url : null;
}

// ───────────────────────────── polling ─────────────────────────────

function schedule() {
  if (timer) clearTimeout(timer);
  const backoff = failures > 0 ? Math.min(MAX_BACKOFF_MS, NOTIFICATION_POLL_MS * 2 ** failures) : NOTIFICATION_POLL_MS;
  timer = setTimeout(() => void check(), backoff + Math.random() * POLL_JITTER_MS);
}

/** Ask the server whether anything moved; fetch the list only if it did. */
async function check(force = false): Promise<void> {
  if (owner === null) return;
  if (!force && typeof document !== "undefined" && document.visibilityState === "hidden") {
    schedule();
    return;
  }
  if (inFlight) return inFlight;

  const run = async () => {
    try {
      const signal = await api.get<SignalResponse>("/notifications/signal");
      failures = 0;
      if (signal && (force || signal.latest_id !== state.latestId || signal.unread_count !== state.unread || state.status !== "ready")) {
        await fetchHead();
      }
    } catch (err) {
      // A session the server ended is announced app-wide by lib/api; anything else is a blip — back off and try again.
      failures = Math.min(failures + 1, 6);
      if (state.status === "loading") set({ status: "error" });
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) failures = 6;
    } finally {
      inFlight = null;
      if (owner !== null) schedule();
    }
  };

  inFlight = run();
  return inFlight;
}

async function fetchHead(): Promise<void> {
  const res = await api.get<ListResponse>(`/notifications?limit=${HEAD_PAGE}`);
  if (!res || !Array.isArray(res.data)) return;

  const wasReady = state.status === "ready";
  const known = new Set(state.items.map((n) => n.id));
  // What arrived since we last looked: unread, newer than anything we had, and only once we had a baseline to compare with.
  const arrived = wasReady ? res.data.filter((n) => !n.read && !known.has(n.id) && n.id > state.latestId) : [];

  // The fresh head replaces the top of the list; older pages already loaded are kept beneath it.
  const oldest = res.data.length > 0 ? res.data[res.data.length - 1].id : Infinity;
  const older = state.items.filter((n) => n.id < oldest && !res.data.some((f) => f.id === n.id));
  const items = [...res.data, ...older];

  set({
    status: "ready",
    items,
    unread: res.unread_count,
    latestId: Math.max(state.latestId, res.data[0]?.id ?? 0),
    nextBefore: older.length > 0 ? state.nextBefore : res.next_before,
  });

  if (arrived.length > 0) {
    const toast = arrived.filter((n) => !NO_TOAST_TYPES.has(n.type));
    if (toast.length > 0) arrivalListeners.forEach((l) => l(toast));
  }
}

/**
 * Begin polling for this signed-in user. Safe to call from many components (reference-counted); returns the stop function.
 * A different user (sign-out then sign-in on the same tab) starts from a clean slate — nothing of the previous account's
 * notifications survives in memory.
 */
export function startNotifications(userId: number): () => void {
  if (owner !== null && owner !== userId) {
    resetNotifications();
  }
  owner = userId;
  starts += 1;

  if (starts === 1) {
    if (state.status === "idle") set({ status: "loading" });

    const wake = () => void check(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", onVisible);
    cleanup = () => {
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", onVisible);
    };

    void check(true);
  }

  return () => {
    starts = Math.max(0, starts - 1);
    if (starts === 0) {
      if (timer) clearTimeout(timer);
      timer = null;
      cleanup?.();
      cleanup = null;
    }
  };
}

/** Forget everything — on sign-out, or when a different account signs in. */
export function resetNotifications() {
  if (timer) clearTimeout(timer);
  timer = null;
  cleanup?.();
  cleanup = null;
  starts = 0;
  owner = null;
  inFlight = null;
  failures = 0;
  bellOpen = false;
  state = INITIAL;
  listeners.forEach((l) => l());
}

// ───────────────────────────── actions (optimistic) ─────────────────────────────

/** Put the server's truth back after an optimistic change that the server refused. */
async function resync() {
  try {
    await fetchHead();
  } catch {
    // the next poll catches up
  }
}

export async function markRead(id: number): Promise<void> {
  const target = state.items.find((n) => n.id === id);
  if (!target || target.read) return;

  set({ items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)), unread: Math.max(0, state.unread - 1) });
  try {
    const res = await api.post<{ unread_count: number }>(`/notifications/${id}/read`);
    if (res && typeof res.unread_count === "number") set({ unread: res.unread_count });
  } catch {
    await resync();
  }
}

export async function markAllRead(category?: NotificationCategory): Promise<void> {
  set({
    items: state.items.map((n) => (!category || n.category === category ? { ...n, read: true } : n)),
    unread: category ? state.items.filter((n) => !n.read && n.category !== category).length : 0,
  });
  try {
    const res = await api.post<{ unread_count: number }>("/notifications/read-all", category ? { category } : undefined);
    if (res && typeof res.unread_count === "number") set({ unread: res.unread_count });
  } catch {
    await resync();
  }
}

export async function dismiss(id: number): Promise<void> {
  const target = state.items.find((n) => n.id === id);
  if (!target) return;

  set({ items: state.items.filter((n) => n.id !== id), unread: target.read ? state.unread : Math.max(0, state.unread - 1) });
  try {
    const res = await api.delete<{ unread_count: number }>(`/notifications/${id}`);
    if (res && typeof res.unread_count === "number") set({ unread: res.unread_count });
  } catch {
    await resync();
  }
}

export async function clearRead(): Promise<void> {
  set({ items: state.items.filter((n) => !n.read) });
  try {
    await api.delete("/notifications/read");
  } catch {
    await resync();
  }
}

/** The next page of older notifications (the notifications page's "Load more"). */
export async function loadMore(): Promise<void> {
  if (state.nextBefore === null || state.loadingMore) return;
  set({ loadingMore: true });
  try {
    const res = await api.get<ListResponse>(`/notifications?limit=30&before=${state.nextBefore}`);
    const have = new Set(state.items.map((n) => n.id));
    set({ items: [...state.items, ...res.data.filter((n) => !have.has(n.id))], nextBefore: res.next_before, loadingMore: false });
  } catch {
    set({ loadingMore: false });
  }
}

/** Force a fresh look now (e.g. the bell was just opened). */
export function refreshNotifications(): Promise<void> {
  return check(true);
}

// ───────────────────────────── preferences ─────────────────────────────

export async function fetchPreferences(): Promise<NotificationPreference[]> {
  const res = await api.get<{ categories: NotificationPreference[] }>("/notifications/preferences");
  return res.categories;
}

export async function savePreferences(categories: Partial<Record<NotificationCategory, boolean>>): Promise<NotificationPreference[]> {
  const res = await api.put<{ categories: NotificationPreference[] }>("/notifications/preferences", { categories });
  return res.categories;
}

// ───────────────────────────── the bell being open ─────────────────────────────

/**
 * While the bell's popover is open the list updates live beneath the person's eyes, so a toast on top of it (they sit in the
 * same corner) would be both redundant and in the way. The bell reports its state here; the toaster listens.
 */
let bellOpen = false;
const bellListeners = new Set<(open: boolean) => void>();

export function setBellOpen(open: boolean) {
  if (bellOpen === open) return;
  bellOpen = open;
  bellListeners.forEach((l) => l(open));
}

export function isBellOpen(): boolean {
  return bellOpen;
}

export function subscribeToBellOpen(listener: (open: boolean) => void): () => void {
  bellListeners.add(listener);
  return () => {
    bellListeners.delete(listener);
  };
}

// ───────────────────────────── subscribing ─────────────────────────────

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called with the notifications that arrived while the page was open (never the first load). */
export function subscribeToArrivals(listener: (items: AppNotification[]) => void): () => void {
  arrivalListeners.add(listener);
  return () => {
    arrivalListeners.delete(listener);
  };
}

export function useNotifications(): NotificationState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

// ───────────────────────────── presentation helpers ─────────────────────────────

/** "now", "5m", "3h", "2d", then a date — short enough for a popover row. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return "now";
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.round(seconds / 86400)}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
