"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { ACADEMIC_CHANGED_EVENT } from "@/lib/planSync";
import type { VaultAiAccess } from "@/types/vaultAi";

/**
 * Where the signed-in student stands on the Vault AI Interview (locked? how many days left? readiness short?).
 *
 * The dashboard card, the sidebar item and the page itself all ask, and the sidebar is rebuilt on every navigation, so the answer
 * lives in one module-level store: one request in flight however many components ask, reused for a minute, and re-asked when the
 * tab regains focus (a tab left open overnight must not keep yesterday's countdown). It only ever DISPLAYS the state - the server
 * refuses a locked student's request all the same - so while the answer is unknown (`access === null`) nothing is shown locked.
 */

const FRESH_FOR_MS = 60_000;

interface Store {
  userId: number | null;
  access: VaultAiAccess | null;
  /** True until the first answer for this user arrives (or fails). */
  loading: boolean;
  fetchedAt: number;
}

let store: Store = { userId: null, access: null, loading: false, fetchedAt: 0 };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: Partial<Store>) {
  store = { ...store, ...next };
  listeners.forEach((cb) => cb());
}

async function load(userId: number, force: boolean): Promise<void> {
  if (store.userId !== userId) set({ userId, access: null, loading: true, fetchedAt: 0 });
  else if (!force && store.access && Date.now() - store.fetchedAt < FRESH_FOR_MS) return;

  if (inflight) return inflight;

  inflight = api
    .get<{ access: VaultAiAccess }>("/vault-qualification/access")
    .then((res) => set({ access: res.access, loading: false, fetchedAt: Date.now() }))
    .catch(() => set({ loading: false }))
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Forget what is held (after sign-out, or in tests), so the next student never sees the last one's countdown. */
export function resetVaultAiAccess() {
  inflight = null;
  set({ userId: null, access: null, loading: false, fetchedAt: 0 });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useVaultAiAccess(enabled: boolean = true) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const snapshot = useSyncExternalStore(
    subscribe,
    () => store,
    () => store
  );

  useEffect(() => {
    if (!enabled || userId === null) return;
    void load(userId, false);

    const onFocus = () => void load(userId, false);
    // The college changed this student's year: ask again now rather than waiting out the minute (see lib/planSync).
    const onAcademicChange = () => void load(userId, true);
    window.addEventListener("focus", onFocus);
    window.addEventListener(ACADEMIC_CHANGED_EVENT, onAcademicChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(ACADEMIC_CHANGED_EVENT, onAcademicChange);
    };
  }, [enabled, userId]);

  const reload = useCallback(() => (userId === null ? Promise.resolve() : load(userId, true)), [userId]);

  // Never hand one student's answer to another account that signs in on the same tab.
  const mine = enabled && userId !== null && snapshot.userId === userId;

  return {
    access: mine ? snapshot.access : null,
    loading: enabled && userId !== null && (!mine || snapshot.loading),
    reload,
  };
}
