"use client";

import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { PublicPlan, PublicPlansResponse } from "@/types/pricing";

/**
 * The live price list. Whatever the superadmin sets in Plans & Pricing reaches
 * every open pricing page within one poll — no redeploy, no refresh.
 *
 * Why polling and not a socket: the API runs on PHP-FPM, where a held-open
 * connection pins a worker per visitor; a 20-second poll of a three-row,
 * ETag'd endpoint (the server answers an unchanged list with an empty 304)
 * costs next to nothing and survives proxies, sleeping laptops and flaky
 * mobile data. A refresh also fires the moment a hidden tab becomes visible
 * again, the network comes back, or the superadmin saves in another tab of the
 * same browser (BroadcastChannel) — so in practice a change shows up at once,
 * and the poll is only the safety net for everyone else.
 *
 * One module-level store, however many components use it: the page header, the
 * plan cards and an upgrade panel share a single timer and a single request.
 * The timer runs only while at least one component is subscribed and the tab is
 * visible.
 *
 * It only ever DISPLAYS prices. What a purchase costs is decided by the server
 * at checkout, which refuses (409 price_changed) a price the buyer did not see.
 */

export const PLANS_POLL_MS = 20_000;
const CHANNEL_NAME = "aptrun-pricing";

export interface PublicPlansState {
  plans: PublicPlan[] | null;
  /** "loading" until the first answer; "error" only if there is nothing to show at all (a failed refresh keeps the last good list). */
  status: "loading" | "ready" | "error";
  /** When the displayed list was last confirmed by the server (ms since epoch). */
  checkedAt: number | null;
}

const INITIAL: PublicPlansState = { plans: null, status: "loading", checkedAt: null };

let state: PublicPlansState = INITIAL;
let inFlight: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();

function publish(next: PublicPlansState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Fetch the list now. Concurrent calls share one request. Never throws. */
export function refreshPlans(): Promise<void> {
  if (inFlight) return inFlight;

  inFlight = api
    .get<PublicPlansResponse>("/public/plans")
    .then((res) => {
      const plans = Array.isArray(res?.plans) ? res.plans : [];
      const unchanged = state.plans !== null && JSON.stringify(state.plans) === JSON.stringify(plans);
      // Keep the same array identity when nothing changed, so memoised consumers don't re-render every poll.
      publish({ plans: unchanged ? state.plans : plans, status: "ready", checkedAt: Date.now() });
    })
    .catch(() => {
      if (state.plans === null) publish({ ...state, status: "error" });
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Tell every open pricing surface — this tab and the browser's other tabs — to re-read the list now. Called after the superadmin saves. */
export function notifyPricingChanged(): void {
  void refreshPlans();
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const sender = new BroadcastChannel(CHANNEL_NAME);
    sender.postMessage("changed");
    sender.close();
  } catch {
    /* no BroadcastChannel (old browser, privacy mode): the poll still catches up */
  }
}

const onVisible = () => {
  if (document.visibilityState === "visible") void refreshPlans();
};
const onOnline = () => void refreshPlans();

function start() {
  void refreshPlans();

  timer = setInterval(() => {
    if (document.visibilityState === "visible") void refreshPlans();
  }, PLANS_POLL_MS);

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);

  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = () => void refreshPlans();
    }
  } catch {
    channel = null;
  }
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("online", onOnline);
  channel?.close();
  channel = null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) start();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => INITIAL;

/** The live individual plans (Coder, Expert, and the team-sold Grandmaster), kept fresh while the component is mounted. */
export function usePublicPlans(): PublicPlansState & { refresh: () => Promise<void> } {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snapshot, refresh: refreshPlans };
}

/** One live plan by code, or undefined until the list has loaded (or if that plan is not on sale). */
export function usePublicPlan(code: string): PublicPlan | undefined {
  return usePublicPlans().plans?.find((p) => p.code === code);
}

/** Test seam: forget everything, as if the page had just loaded. */
export function __resetPublicPlansForTests(): void {
  stop();
  listeners.clear();
  state = INITIAL;
  inFlight = null;
}
