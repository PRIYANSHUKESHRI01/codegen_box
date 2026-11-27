"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { api } from "./api";
import { getToken } from "./auth";
import { SUBSCRIPTION_CHANGED_EVENT } from "./projectLab";
import type { MyStats } from "@/types/studentStats";

export const STATS_CHANGED_EVENT = "aptrun:stats-changed";

export function notifyStatsChanged() {
  store = { ...store, fetchedAt: 0 };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STATS_CHANGED_EVENT));
  }
}

const FRESH_FOR_MS = 45_000;
const IS_VITEST = typeof process !== "undefined" && Boolean(process.env?.VITEST);

interface StatsStore {
  tokenKey: string | null;
  refreshKey: string;
  stats: MyStats | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number;
}

let store: StatsStore = { tokenKey: null, refreshKey: "", stats: null, loading: false, error: null, fetchedAt: 0 };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

function setStore(next: Partial<StatsStore>) {
  store = { ...store, ...next };
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function resetMyStats() {
  inFlight = null;
  setStore({ tokenKey: null, refreshKey: "", stats: null, loading: false, error: null, fetchedAt: 0 });
}

async function fetchStats(refreshKey: string, force: boolean): Promise<void> {
  const tokenKey = getToken() ?? "anon";
  const sameAccount = store.tokenKey === tokenKey;
  const sameKey = store.refreshKey === refreshKey;
  const fresh = !IS_VITEST && !force && sameAccount && sameKey && store.stats !== null && Date.now() - store.fetchedAt < FRESH_FOR_MS;

  if (!sameAccount) {
    setStore({ tokenKey, refreshKey, stats: null, loading: true, error: null, fetchedAt: 0 });
  } else if (fresh) {
    if (store.loading) setStore({ loading: false });
    return;
  } else {
    setStore({ refreshKey, loading: store.stats === null, error: null });
  }

  if (inFlight && !force) return inFlight;

  const run = api
    .get<MyStats>("/me/stats")
    .then((res) => {
      if ((getToken() ?? "anon") === tokenKey) {
        setStore({ tokenKey, refreshKey, stats: res, loading: false, error: null, fetchedAt: Date.now() });
      }
    })
    .catch(() => {
      setStore({ loading: false, error: "Failed to load your stats." });
    })
    .finally(() => {
      if (inFlight === run) inFlight = null;
    });

  inFlight = run;
  return run;
}

/**
 * Real solved-count/streak/topic-mastery/readiness stats for the signed-in student.
 * Backed by one module-level shared store so Sidebar, Home Overview, Practice Arena,
 * and Reports share the same fresh answer across navigations instead of triggering
 * duplicate /me/stats calls on every route transition.
 */
export function useMyStats(enabled: boolean = true, refreshKey: string = "") {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => store,
    () => store
  );
  const currentTokenKey = typeof window !== "undefined" ? (getToken() ?? "anon") : null;
  const mine = enabled && currentTokenKey !== null && snapshot.tokenKey === currentTokenKey;
  const prevRefreshKeyRef = useRef(refreshKey);

  const reload = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return fetchStats(refreshKey, true);
  }, [enabled, refreshKey]);

  useEffect(() => {
    if (!enabled) return;

    const keyChanged = prevRefreshKeyRef.current !== refreshKey && store.stats !== null && store.refreshKey !== refreshKey;
    prevRefreshKeyRef.current = refreshKey;
    void fetchStats(refreshKey, keyChanged);

    const onChanged = () => void fetchStats(refreshKey, true);
    window.addEventListener(STATS_CHANGED_EVENT, onChanged);
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, onChanged);

    return () => {
      window.removeEventListener(STATS_CHANGED_EVENT, onChanged);
      window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, onChanged);
    };
  }, [enabled, refreshKey]);

  return {
    stats: mine ? snapshot.stats : null,
    loading: enabled ? (!mine || snapshot.loading) : false,
    error: mine ? snapshot.error : null,
    reload,
  };
}
