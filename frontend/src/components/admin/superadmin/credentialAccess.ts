"use client";

import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";

/**
 * Whether this browser tab has unlocked the superadmin's credentials view, shared by every
 * place that can show a login (the accounts table, the manage drawer).
 *
 * The truth lives on the server — an unlock is tied to the exact session token and lasts a few
 * minutes — so this is only a mirror used to decide what to draw. If it ever disagrees (the
 * server answers "locked"), the reveal call flips it back and the UI asks for the password
 * again. No password and no revealed secret is ever kept here.
 */

export interface RevealedLogin {
  login_id: string;
  /** null = nothing to show (the owner chose their own, or no copy was kept). */
  password: string | null;
  state: "viewable" | "owner_set" | "not_recorded" | "protected";
  source: "created" | "reset" | "set_by_superadmin" | "import" | null;
  issued_at: string | null;
  expires_at: string | null;
}

/** Kept in step with SuperAdminCredentialController::UNLOCK_MINUTES. */
const FALLBACK_UNLOCK_MS = 10 * 60 * 1000;

let unlockedUntil: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setUnlockedUntil(value: number | null) {
  unlockedUntil = value;
  if (timer) clearTimeout(timer);
  timer = null;
  if (value !== null) {
    // Re-draw the moment the window closes, so a "Show" button doesn't linger past its welcome.
    timer = setTimeout(() => {
      unlockedUntil = null;
      emit();
    }, Math.max(0, value - Date.now()) + 50);
  }
  emit();
}

export const credentialAccess = {
  unlockedUntil: () => (unlockedUntil !== null && unlockedUntil > Date.now() ? unlockedUntil : null),

  /** Ask the server whether this session is still unlocked (e.g. after a page reload). */
  async sync(): Promise<void> {
    try {
      const res = await api.get<{ unlocked: boolean }>("/superadmin/credentials/status");
      if (res?.unlocked) {
        if (credentialAccess.unlockedUntil() === null) setUnlockedUntil(Date.now() + FALLBACK_UNLOCK_MS);
      } else if (unlockedUntil !== null) {
        setUnlockedUntil(null);
      }
    } catch {
      // Leave it locked: the worst case is being asked for the password once more.
    }
  },

  /** Confirm the superadmin's own password. Throws the API's ApiError on a wrong password. */
  async unlock(password: string): Promise<void> {
    const res = await api.post<{ unlocked: boolean; expires_at?: string }>("/superadmin/credentials/unlock", { password });
    const expires = res?.expires_at ? new Date(res.expires_at).getTime() : Date.now() + FALLBACK_UNLOCK_MS;
    setUnlockedUntil(Number.isFinite(expires) ? expires : Date.now() + FALLBACK_UNLOCK_MS);
  },

  async lock(): Promise<void> {
    setUnlockedUntil(null);
    try {
      await api.post("/superadmin/credentials/lock");
    } catch {
      // Already closed locally; the server's window lapses by itself within minutes.
    }
  },

  /** Fetch one account's issued login. A "locked" answer closes the local mirror and rethrows so the caller can re-prompt. */
  async reveal(userId: number): Promise<RevealedLogin> {
    try {
      return await api.post<RevealedLogin>(`/superadmin/users/${userId}/credentials`);
    } catch (err) {
      if ((err as { code?: string }).code === "credentials_locked") setUnlockedUntil(null);
      throw err;
    }
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** The time the unlock lapses (ms epoch), or null while locked. Re-renders when it changes. */
export function useCredentialUnlock(): number | null {
  return useSyncExternalStore(credentialAccess.subscribe, credentialAccess.unlockedUntil, () => null);
}
