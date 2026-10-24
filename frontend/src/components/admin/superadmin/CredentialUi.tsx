"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock, LockOpen, ShieldCheck, Clock, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { credentialAccess, useCredentialUnlock, type RevealedLogin } from "./credentialAccess";
import { CopyRow } from "./ResetPasswordModal";
import type { CredentialState } from "./types";

/** A revealed password hides itself after this long, so a screen left open doesn't keep showing it. */
export const REVEAL_VISIBLE_MS = 30_000;

/** "9:41" until the credentials view locks itself. */
function useCountdown(until: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (until === null) return null;
  const left = Math.max(0, Math.round((until - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/**
 * Confirm the superadmin's own password to open the credentials view. A stolen session token alone must
 * not be enough to read logins, so this re-checks the password server-side (a wrong one is a 422, never a
 * sign-out) and the unlock then lasts a few minutes on this session only.
 */
export function UnlockCredentialsModal({ onClose, onUnlocked }: { onClose: () => void; onUnlocked: () => void }) {
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || working) return;
    setWorking(true);
    setError(null);
    try {
      await credentialAccess.unlock(password);
      setPassword("");
      onUnlocked();
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.password?.[0] ?? err.message : "Couldn't unlock. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Unlock login details"
      subtitle="Confirm it's you"
      icon={Lock}
      size="md"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={working} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            form="unlock-credentials-form"
            disabled={working || !password}
            className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {working ? "Checking…" : "Unlock"}
          </button>
        </>
      }
    >
      <form id="unlock-credentials-form" onSubmit={submit} className="space-y-4">
        <p className="text-xs text-text-secondary">
          Logins are hidden by default. Enter <strong className="text-primary">your own</strong> password to look up the temporary passwords accounts were issued. It stays open for 10 minutes on this
          device only, every lookup is written to the audit log, and nobody&apos;s own chosen password can ever be shown.
        </p>
        <div>
          <label htmlFor="unlock-credentials-password" className="block text-xs font-semibold text-text-secondary mb-1">
            Your password
          </label>
          <input
            id="unlock-credentials-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
          />
        </div>
        {error && (
          <div role="alert" className="p-3 rounded-control border border-status-danger/30 bg-status-danger/10 text-status-danger text-xs font-semibold">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

/** The "locked / unlocked for 9:41" strip above a list of accounts. */
export function CredentialLockBar({ className }: { className?: string }) {
  const until = useCredentialUnlock();
  const left = useCountdown(until);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    void credentialAccess.sync();
  }, []);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-control border px-3 py-2 text-xs",
        until ? "border-status-success/30 bg-status-success/10 text-status-success" : "border-border-subtle bg-elevated/60 text-text-secondary",
        className
      )}
    >
      <span className="inline-flex items-center gap-2 font-semibold">
        {until ? <LockOpen className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
        {until ? `Login details unlocked — closes in ${left}` : "Login details are locked. Unlock to see the passwords accounts were issued."}
      </span>
      {until ? (
        <button type="button" onClick={() => void credentialAccess.lock()} className="font-bold underline underline-offset-2 hover:opacity-80">
          Lock now
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors"
        >
          <KeyRound className="w-3 h-3" /> Unlock
        </button>
      )}
      {asking && <UnlockCredentialsModal onClose={() => setAsking(false)} onUnlocked={() => setAsking(false)} />}
    </div>
  );
}

const SOURCE_LABEL: Record<NonNullable<RevealedLogin["source"]>, string> = {
  created: "Issued when the account was created",
  reset: "Issued by a password reset",
  set_by_superadmin: "Set by a superadmin",
  import: "Issued by a bulk import",
};

/**
 * The password cell for one account. Never receives a password from the list: the list only says whether
 * one can be looked up, and the lookup happens here, on demand, against the server (so what is shown is
 * what is true right now — if the owner has changed it since, it says so instead).
 */
export function PasswordReveal({ userId, userName, state, compact = false, onStale }: {
  userId: number;
  userName: string;
  state: CredentialState | undefined;
  compact?: boolean;
  /** The server says the password the list showed as viewable no longer is (the owner changed it): refresh the list. */
  onStale?: () => void;
}) {
  const unlocked = useCredentialUnlock() !== null;
  const [login, setLogin] = useState<RevealedLogin | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
    setLogin(null);
    setCopied(false);
  }, []);

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // Locking the view, or the list saying this account is no longer viewable, takes the password off the screen at once.
  useEffect(() => {
    if (!unlocked || state !== "viewable") hide();
  }, [unlocked, state, hide]);

  const reveal = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await credentialAccess.reveal(userId);
      if (res.password === null) {
        // Changed since the list loaded: say so, and let the list catch up.
        setLogin(res);
        onStale?.();
        return;
      }
      setLogin(res);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(hide, REVEAL_VISIBLE_MS);
    } catch (err) {
      if (err instanceof ApiError && err.code === "credentials_locked") setAsking(true);
      else setError(err instanceof ApiError ? err.message : "Couldn't look that up. Try again.");
    } finally {
      setBusy(false);
    }
  }, [userId, hide, onStale]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the value is on screen to copy by hand.
    }
  };

  if (state === "protected") {
    return (
      <span title="A superadmin's password is never shown. A superadmin changes their own from Settings." className="inline-flex items-center gap-1 text-3xs text-text-muted">
        <ShieldCheck className="w-3 h-3" /> Protected
      </span>
    );
  }

  if (state === "owner_set" || (login && login.password === null && login.state === "owner_set")) {
    return (
      <span title="The user chose their own password. It is stored only as a one-way hash, so nobody — including us — can see it." className="inline-flex items-center gap-1 text-3xs text-text-muted">
        <Lock className="w-3 h-3" /> Private — user chose it
      </span>
    );
  }

  if (state === "not_recorded" || (login && login.password === null)) {
    return (
      <span title="Still a temporary password, but no copy is on file (issued before copies were kept, or it lapsed). Reset the password to issue one you can see." className="inline-flex items-center gap-1 text-3xs text-status-warning">
        <Clock className="w-3 h-3" /> Not on file — reset to issue one
      </span>
    );
  }

  if (login?.password) {
    return (
      <div className={cn("space-y-1", compact ? "min-w-0" : "min-w-[14rem]")}>
        <div className="flex items-center gap-1.5">
          <code data-testid={`revealed-password-${userId}`} className="min-w-0 flex-1 break-all rounded-control border border-border-subtle bg-elevated px-2 py-1 font-mono text-xs text-primary select-all">
            {login.password}
          </code>
          <button type="button" onClick={() => void copy(login.password!)} aria-label={`Copy ${userName}'s password`} className="shrink-0 rounded-control border border-border-subtle bg-elevated px-2 py-1 text-3xs font-bold text-text-secondary hover:text-primary">
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" onClick={hide} aria-label={`Hide ${userName}'s password`} className="shrink-0 rounded-control border border-border-subtle bg-elevated p-1 text-text-secondary hover:text-primary">
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-3xs text-text-muted">
          {login.source ? SOURCE_LABEL[login.source] : "Temporary password"} · hides in 30 s
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => (unlocked ? void reveal() : setAsking(true))}
        disabled={busy}
        aria-label={`Show ${userName}'s password`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-3xs font-bold transition-all disabled:opacity-50"
      >
        <Eye className="w-3 h-3" /> {busy ? "Looking up…" : "Show password"}
      </button>
      {error && (
        <div role="alert" className="text-3xs font-semibold text-status-danger">
          {error}
        </div>
      )}
      {asking && (
        <UnlockCredentialsModal
          onClose={() => setAsking(false)}
          onUnlocked={() => {
            setAsking(false);
            void reveal();
          }}
        />
      )}
    </div>
  );
}

/** Login ID + password pair for the manage drawer, with copy buttons — same lookup, bigger layout. */
export function LoginDetailsRow({ email, userId, userName, state, onStale }: { email: string; userId: number; userName: string; state: CredentialState | undefined; onStale?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2.5">
      <div>
        <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-1">Login ID</div>
        <CopyRow
          value={email}
          copied={copied}
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(email);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              // see PasswordReveal.copy
            }
          }}
        />
      </div>
      <div>
        <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider mb-1">Password</div>
        <PasswordReveal userId={userId} userName={userName} state={state} onStale={onStale} />
      </div>
    </div>
  );
}
