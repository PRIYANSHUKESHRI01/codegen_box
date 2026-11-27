"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/projectLab";
import type { MySubscriptionResponse } from "@/types/subscription";

export interface MyPlanState {
  /** The last answer, or null until the first one arrives (and for anyone who has no plan of their own to show). */
  plan: MySubscriptionResponse | null;
  loading: boolean;
  /** Fetch again now. */
  refresh: () => Promise<void>;
}

const FRESH_FOR_MS = 60_000;
const IS_VITEST = typeof process !== "undefined" && Boolean(process.env?.VITEST);

interface Store {
  tokenKey: string | null;
  plan: MySubscriptionResponse | null;
  loading: boolean;
  fetchedAt: number;
}

let store: Store = { tokenKey: null, plan: null, loading: false, fetchedAt: 0 };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

function setStore(next: Partial<Store>) {
  store = { ...store, ...next };
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function resetMyPlan() {
  inFlight = null;
  setStore({ tokenKey: null, plan: null, loading: false, fetchedAt: 0 });
}

async function fetchPlan(force: boolean): Promise<void> {
  const tokenKey = getToken() ?? "anon";
  const isSameAccount = store.tokenKey === tokenKey;
  const fresh = !IS_VITEST && !force && isSameAccount && store.plan !== null && Date.now() - store.fetchedAt < FRESH_FOR_MS;

  if (!isSameAccount) {
    setStore({ tokenKey, plan: null, loading: true, fetchedAt: 0 });
  } else if (fresh) {
    if (store.loading) setStore({ loading: false });
    return;
  } else if (store.plan === null && !store.loading) {
    setStore({ loading: true });
  }

  if (inFlight && !force) return inFlight;

  const run = api
    .get<MySubscriptionResponse>("/me/subscription")
    .then((res) => {
      if ((getToken() ?? "anon") === tokenKey) {
        setStore({ tokenKey, plan: res, loading: false, fetchedAt: Date.now() });
      }
    })
    .catch(() => {
      /* keep the last answer; the server still enforces everything */
      setStore({ loading: false });
    })
    .finally(() => {
      if (inFlight === run) inFlight = null;
    });

  inFlight = run;
  return run;
}

/**
 * The signed-in account's plan (GET /me/subscription), shared across the header PlanChip,
 * DashboardSidebar, and feature gates so navigating or mounting multiple widgets triggers
 * at most one cached request instead of 2-3 duplicate fetches per page.
 *
 * `enabled` false (staff, a role with no plan chip) makes no request at all.
 */
export function useMyPlan(enabled = true): MyPlanState {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => store,
    () => store
  );
  const currentTokenKey = typeof window !== "undefined" ? (getToken() ?? "anon") : null;
  const sameAccount = enabled && currentTokenKey !== null && snapshot.tokenKey === currentTokenKey;

  const refresh = useCallback(async () => {
    if (!enabled) return;
    await fetchPlan(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    void fetchPlan(false);

    const onSubChanged = () => {
      void fetchPlan(true);
    };
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, onSubChanged);

    return () => {
      window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, onSubChanged);
    };
  }, [enabled]);

  return {
    plan: sameAccount ? snapshot.plan : null,
    loading: enabled && (!sameAccount || snapshot.loading),
    refresh,
  };
}
