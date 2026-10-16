import { API_URL, api } from "./api";
import { AuthUser, getStoredUser, getToken, homeRouteForRole, saveSession, clearSession } from "./auth";

/**
 * "View as": a superadmin looks at the product exactly as one user sees it.
 *
 * The server hands back a short-lived READ-ONLY token for that account (see
 * SuperAdminAccountController::impersonate). This module is the browser half:
 * it parks the superadmin's own session, swaps in the viewing one, and puts the
 * superadmin back when they exit — or when the viewing token runs out, which must
 * land them back in their own console and not on a login page.
 *
 * Everything lives in localStorage, next to the normal session, so every tab of
 * the browser is in the same state (and shows the same banner) and a reload does
 * not end it. A superadmin who closes the browser mid-way is simply still viewing
 * on return, with the banner to leave; the token itself dies on the server within
 * the hour either way.
 */

const KEY = "aptrun_impersonation";
export const IMPERSONATION_CHANGED_EVENT = "aptrun:impersonation-changed";

export interface ImpersonationState {
  /** The superadmin's own session, parked while they look. */
  original: { token: string; user: AuthUser };
  /** Who they are looking at. */
  target: { id: number; name: string; role: AuthUser["role"] };
  /** When the viewing token stops working (ISO). */
  expiresAt: string;
}

export function getImpersonation(): ImpersonationState | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as ImpersonationState;
    return state?.original?.token && state?.target?.id ? state : null;
  } catch {
    return null;
  }
}

function announceChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(IMPERSONATION_CHANGED_EVENT));
}

/**
 * Park the current (superadmin) session and sign in as the viewed account with the
 * read-only token. Returns where to send the browser — the viewed account's own
 * home, so the superadmin lands exactly where that person would.
 */
export function beginImpersonation(viewing: { token: string; user: AuthUser; expires_at: string }): string {
  const token = getToken();
  const user = getStoredUser();

  if (!token || !user) throw new Error("No signed-in session to return to.");

  const state: ImpersonationState = {
    // Already viewing someone? Keep the real superadmin session, never the previous view.
    original: getImpersonation()?.original ?? { token, user },
    target: { id: viewing.user.id, name: viewing.user.name, role: viewing.user.role },
    expiresAt: viewing.expires_at,
  };

  window.localStorage.setItem(KEY, JSON.stringify(state));
  saveSession(viewing.token, viewing.user);
  announceChange();

  return homeRouteForRole(viewing.user.role);
}

/**
 * Put the superadmin's own session back and forget the view. Returns the restored
 * user, or null when there was nothing to restore. Does not touch the server —
 * see endImpersonation() for the version that also discards the viewing token.
 */
export function restoreOriginalSession(): AuthUser | null {
  const state = getImpersonation();
  if (!state) return null;

  saveSession(state.original.token, state.original.user);
  window.localStorage.removeItem(KEY);
  announceChange();

  return state.original.user;
}

/**
 * Leave "view as": discard the viewing token on the server (best effort — it
 * expires on its own anyway, and the server records that the view ended) and
 * restore the superadmin's session. Returns the restored user.
 */
export async function endImpersonation(): Promise<AuthUser | null> {
  if (!getImpersonation()) return null;

  try {
    await api.post("/logout");
  } catch {
    /* already expired or unreachable: the token dies by itself, and leaving must not depend on the network */
  }

  return restoreOriginalSession();
}

/**
 * Forget a view whose session is being cleared some other way — signing out while
 * viewing is a full sign-out, not a way back to the console. The parked
 * superadmin token is also revoked on the server (best effort), so a token that
 * is no longer in anyone's browser does not stay valid.
 */
export function discardImpersonation(): void {
  if (typeof window === "undefined") return;

  const state = getImpersonation();
  if (!state) return;

  window.localStorage.removeItem(KEY);
  announceChange();

  void fetch(`${API_URL}/logout`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${state.original.token}` },
  }).catch(() => {
    /* offline: it simply stays valid until it is next used or revoked from the server */
  });
}

/** Sign out completely, including any parked superadmin session. */
export function clearEverything(): void {
  discardImpersonation();
  clearSession();
}
