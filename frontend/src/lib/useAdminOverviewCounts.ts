"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import { getToken } from "./auth";
import type { AdminOverview } from "@/types/adminOverview";

const FRESH_FOR_MS = 30_000;
const IS_VITEST = typeof process !== "undefined" && Boolean(process.env?.VITEST);

interface Store {
  tokenKey: string | null;
  overview: AdminOverview | null;
  loading: boolean;
  fetchedAt: number;
}

let store: Store = { tokenKey: null, overview: null, loading: false, fetchedAt: 0 };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setStore(next: Partial<Store>) {
  store = { ...store, ...next };
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

async function fetchOverview(force: boolean): Promise<void> {
  const tokenKey = getToken() ?? "anon";
  const sameAccount = store.tokenKey === tokenKey;
  const fresh = !IS_VITEST && !force && sameAccount && store.overview !== null && Date.now() - store.fetchedAt < FRESH_FOR_MS;

  if (!sameAccount) {
    setStore({ tokenKey, overview: null, loading: true, fetchedAt: 0 });
  } else if (fresh) {
    if (store.loading) setStore({ loading: false });
    return;
  } else if (store.overview === null && !store.loading) {
    setStore({ loading: true });
  }

  if (inFlight && !force) return inFlight;

  const run = api
    .get<AdminOverview>("/admin/overview")
    .then((res) => {
      if ((getToken() ?? "anon") === tokenKey) {
        setStore({ tokenKey, overview: res, loading: false, fetchedAt: Date.now() });
      }
    })
    .catch(() => {
      setStore({ loading: false });
    })
    .finally(() => {
      if (inFlight === run) inFlight = null;
    });

  inFlight = run;
  return run;
}

/**
 * Real segment counts for Mellow Ops — shared via module-level cache across sidebar and
 * overview tabs so navigating between admin pages does not re-fetch on every route change.
 */
export function useAdminOverviewCounts(enabled: boolean = true) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => store,
    () => store
  );
  const currentTokenKey = typeof window !== "undefined" ? (getToken() ?? "anon") : null;
  const mine = enabled && currentTokenKey !== null && snapshot.tokenKey === currentTokenKey;

  const reload = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return fetchOverview(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void fetchOverview(false);
  }, [enabled]);

  return {
    overview: mine ? snapshot.overview : null,
    loading: enabled ? (!mine || snapshot.loading) : false,
    reload,
  };
}
