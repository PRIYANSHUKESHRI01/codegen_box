/**
 * How the rest of the app learns that the server has ended this browser's
 * session behind its back — a superadmin blocked the account, or signed it out
 * of every device — instead of every page discovering it separately as a failed
 * request and showing "Unauthenticated." in a toast.
 *
 * lib/api.ts raises the event the moment an authenticated request is refused for
 * that reason; AuthProvider listens, clears the session and sends the person to
 * the login page, where `takeSignedOutNotice()` explains what happened.
 */

export const SESSION_ENDED_EVENT = "aptrun:session-ended";
const NOTICE_KEY = "aptrun_signed_out_notice";

export type SessionEndReason = "blocked" | "signed_out";

export interface SessionEndedDetail {
  reason: SessionEndReason;
  message: string;
}

/** The `code` the API attaches when it refuses a blocked account (EnsureAccountIsActive). */
export const ACCOUNT_BLOCKED_CODE = "account_blocked";

let announced = false;

/** Tell the app the session is over. Fires once per page load: a burst of failing requests is one event. */
export function announceSessionEnded(detail: SessionEndedDetail): void {
  if (typeof window === "undefined" || announced) return;
  announced = true;

  try {
    window.sessionStorage.setItem(NOTICE_KEY, detail.message);
  } catch {
    /* private mode: the redirect still happens, just without the explanation */
  }

  window.dispatchEvent(new CustomEvent<SessionEndedDetail>(SESSION_ENDED_EVENT, { detail }));
}

/** The explanation to show on the login page once, if the person was sent there because the session ended. */
export function takeSignedOutNotice(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const message = window.sessionStorage.getItem(NOTICE_KEY);
    if (message) window.sessionStorage.removeItem(NOTICE_KEY);
    return message;
  } catch {
    return null;
  }
}

/** A new sign-in starts a fresh session, which can end (and be announced) again. */
export function resetSessionEndedFlag(): void {
  announced = false;
}
