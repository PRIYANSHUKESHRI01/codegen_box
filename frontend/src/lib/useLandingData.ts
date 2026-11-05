"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { DAILY_CONTEST_TIME, VAULT_READINESS_BAR } from "@/data/landing";
import type { LandingData } from "@/types/landing";

/**
 * The landing page's one read (GET /public/landing): tonight's contest, this week's vouchers, the platform's depth, the companies with
 * prep packs and the departments served. The site is a static export, so none of this can be baked in at build time.
 *
 * One module-level store, however many sections use it: the announcement bar, the hero and the rewards card share a single request. A
 * second visit inside five minutes reuses the answer; coming back to a tab that has been hidden for longer than that asks again, so a
 * Monday reset or a new voucher shows up without a refresh. It never throws: a failed first read is `status: "error"` and every
 * section then falls back to what it can say without the numbers.
 */

export interface LandingState {
  data: LandingData | null;
  /** "loading" until the first answer; "error" only when there is nothing to show at all (a failed refresh keeps the last good answer). */
  status: "loading" | "ready" | "error";
}

const STALE_AFTER_MS = 5 * 60_000;
const INITIAL: LandingState = { data: null, status: "loading" };

let state: LandingState = INITIAL;
let fetchedAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: LandingState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Read the landing facts now. Concurrent calls share one request. Never throws. */
export function refreshLanding(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = api
    .get<LandingData>("/public/landing")
    .then((data) => {
      // A server from before this endpoint existed answers something else: treat anything without a policy as "no data".
      if (!data || typeof data !== "object" || !data.policy) throw new Error("unexpected answer");
      fetchedAt = Date.now();
      publish({ data, status: "ready" });
    })
    .catch(() => {
      if (state.data === null) publish({ data: null, status: "error" });
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

const onVisible = () => {
  if (document.visibilityState === "visible" && Date.now() - fetchedAt > STALE_AFTER_MS) void refreshLanding();
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (listeners.size === 1) {
    if (state.data === null || Date.now() - fetchedAt > STALE_AFTER_MS) void refreshLanding();
    document.addEventListener("visibilitychange", onVisible);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) document.removeEventListener("visibilitychange", onVisible);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => INITIAL;

export function useLandingData(): LandingState & { refresh: () => Promise<void> } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snapshot, refresh: refreshLanding };
}

/** Test helper: forget everything this module remembers. */
export function resetLandingData(): void {
  state = INITIAL;
  fetchedAt = 0;
  inFlight = null;
}

/**
 * The few rules the page states in words, resolved from the server's answer and — until it arrives, or if it never does — from the
 * defaults in data/landing.ts, so no sentence ever reads "undefined%".
 */
export interface LandingFacts {
  vaultBar: number;
  /** "8 PM IST" */
  dailyTime: string;
  dailyMinutes: number;
  dailyProblems: number;
  dailyPoints: number | null;
  /** "Monday" */
  weekResets: string;
}

/** "8:00 PM IST" → "8 PM IST" (the way a sentence says it); "8:30 PM IST" stays as it is. */
export function shortClock(label: string): string {
  return label.replace(/:00(?=\s?[AP]M)/i, "");
}

export function landingFacts(data: LandingData | null): LandingFacts {
  return {
    vaultBar: data?.policy.vault_bar ?? VAULT_READINESS_BAR,
    dailyTime: data ? shortClock(data.policy.daily.start_label) : DAILY_CONTEST_TIME,
    dailyMinutes: data?.policy.daily.duration_minutes ?? 60,
    dailyProblems: data?.policy.daily.problems ?? 3,
    dailyPoints: data?.policy.daily.points ?? null,
    weekResets: data?.policy.week.resets_on ?? "Monday",
  };
}

/** The same facts for a component that only wants them: the answer when there is one, the defaults otherwise. */
export function useLandingFacts(): LandingFacts {
  const { data } = useLandingData();
  return landingFacts(data);
}

/**
 * Milliseconds since the epoch, ticking. `null` on the server and on the first client render — so what is drawn matches the static
 * HTML and hydration never disagrees about a clock — then the real time, every `intervalMs`.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

export interface Countdown {
  /** Whole milliseconds left, never negative. */
  ms: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdownTo(targetIso: string, now: number): Countdown {
  const ms = Math.max(0, new Date(targetIso).getTime() - now);
  const total = Math.floor(ms / 1000);

  return { ms, days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
