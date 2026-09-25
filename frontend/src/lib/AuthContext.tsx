"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "./api";
import { AuthUser, clearSession, getStoredUser, getToken, saveSession } from "./auth";

export type AuthStatus = "loading" | "ready" | "signed_out";

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** Force a fresh /me check (e.g. after an action that might change role/block state). */
  refresh: () => Promise<void>;
  /**
   * Persists a new session AND updates the shared context in the same tick.
   * Login/signup must call this instead of auth.ts's saveSession() directly
   * — writing only to localStorage would leave this provider's in-memory
   * state stale ("signed_out") until a full reload, which would bounce the
   * user straight back to /login the instant they land on a guarded page.
   */
  login: (token: string, user: AuthUser) => void;
  /** Mirror of login() for sign-out — clears storage AND context state together. */
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Next.js server-renders this "use client" provider too (for the initial
// HTML/hydration), and the server has no localStorage — so reading it
// straight in a useState initializer would make the server's markup and the
// client's first render disagree (a real hydration-mismatch bug this
// actually hit: React discarded the whole tree and fell back to full
// client-side rendering). useLayoutEffect only ever runs in the browser,
// strictly after the first hydration-safe commit and before the browser
// paints, so the optimistic read below is both mismatch-free and invisible.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Verifies the session against the real backend exactly once per app
 * session (not once per page navigation) and holds the result in memory for
 * every route to share. This is what makes clicking between dashboard pages
 * instant instead of re-showing "Verifying your session..." on every click:
 * without this, each page's own useAuthGuard used to re-fetch GET /api/me
 * from scratch on every mount, since Next.js remounts page components on
 * navigation and none of them shared state.
 *
 * Renders optimistically from the cached user in localStorage (before the
 * browser ever paints, so there's no visible flash) and silently reconciles
 * with a real /me call in the background — a stale/blocked/invalid session
 * still gets caught and signed out, just without blocking the first paint.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Both server and client always start from this exact same neutral state
  // — that's what keeps hydration consistent. The optimistic correction
  // happens only in the layout effect below, which is client-only.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const hasVerifiedOnce = useRef(false);

  const verify = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setStatus("signed_out");
      return;
    }
    try {
      const { user: freshUser } = await api.get<{ user: AuthUser }>("/me");
      saveSession(token, freshUser);
      setUser(freshUser);
      setStatus("ready");
    } catch {
      clearSession();
      setUser(null);
      setStatus("signed_out");
    }
  }, []);

  // Runs client-only, before paint: if a cached session exists, jump
  // straight to "ready" with it so the very first frame the user actually
  // sees already has the right content — no server/client mismatch, no
  // flash. A token with no cached user yet (rare) is left at "loading"
  // until the real verify() below resolves.
  useIsomorphicLayoutEffect(() => {
    const cachedUser = getStoredUser();
    if (cachedUser) {
      setUser(cachedUser);
      setStatus("ready");
    } else if (!getToken()) {
      setStatus("signed_out");
    }
  }, []);

  useEffect(() => {
    if (hasVerifiedOnce.current) return;
    hasVerifiedOnce.current = true;
    verify();
  }, [verify]);

  // Re-check when the tab regains focus after being hidden/backgrounded —
  // catches a session that was blocked or expired elsewhere in the
  // meantime, without paying that cost on every in-app navigation.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && getToken()) verify();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [verify]);

  const login = useCallback((token: string, freshUser: AuthUser) => {
    saveSession(token, freshUser);
    setUser(freshUser);
    setStatus("ready");
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setStatus("signed_out");
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, refresh: verify, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
