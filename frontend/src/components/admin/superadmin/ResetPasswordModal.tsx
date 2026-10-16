"use client";

import { useState } from "react";
import { KeyRound, Copy, Check, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { roleInfo } from "./accountRoles";

/** Just enough of an account to reset its password: works from the accounts table and from the manage drawer alike. */
export interface ResetTarget {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface ResetResult {
  temporary_password: string;
  credentials_email_sent: boolean | null;
}

/**
 * Two steps in one dialog: confirm (re-enter your own password — a stolen
 * session alone mustn't be able to take over accounts), then show the new
 * password once. The password only ever lives in this component's state, so
 * closing the dialog discards it.
 *
 * It cannot show an account's CURRENT password and never will: passwords are
 * stored as one-way hashes, and a user replaces their temporary password the
 * first time they sign in, so no copy of it exists to read. This is the honest
 * way to get a working login for someone — and "View as" (in the manage drawer)
 * is the way to see what they see without touching their password at all.
 */
export function ResetPasswordModal({ target, onClose, onReset }: { target: ResetTarget; onClose: () => void; onReset: () => void }) {
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [copied, setCopied] = useState<"login" | "password" | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || working) return;
    setWorking(true);
    setError(null);
    try {
      const res = await api.post<ResetResult>(`/superadmin/users/${target.id}/reset-password`, { password, send_email: sendEmail });
      setResult(res);
      setPassword("");
      onReset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset the password. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  };

  const copy = async (what: "login" | "password", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard can be blocked (insecure origin / permissions); the value is on screen to copy by hand.
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={result ? "New temporary password" : "Reset password"}
      subtitle={`${target.name} · ${roleInfo(target.role).label}`}
      icon={KeyRound}
      size="md"
      closeOnBackdrop={false}
      footer={
        result ? (
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors">
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="reset-password-form"
              disabled={working || !password}
              className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {working ? "Resetting…" : "Reset & show password"}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Login ID</div>
            <CopyRow value={target.email} copied={copied === "login"} onCopy={() => copy("login", target.email)} />
          </div>
          <div className="space-y-1.5">
            <div className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Temporary password</div>
            <CopyRow value={result.temporary_password} copied={copied === "password"} onCopy={() => copy("password", result.temporary_password)} mono />
          </div>

          <div
            className={cn(
              "flex items-start gap-2 p-3 rounded-control border text-xs",
              result.credentials_email_sent === false
                ? "border-status-warning/30 bg-status-warning/10 text-status-warning"
                : "border-border-subtle bg-elevated text-text-secondary"
            )}
          >
            <Mail className="w-4 h-4 shrink-0 mt-px" />
            <span>
              {result.credentials_email_sent === true && <>Login details were emailed to {target.email}.</>}
              {result.credentials_email_sent === false && <>The email to {target.email} could not be sent — pass the password on yourself.</>}
              {result.credentials_email_sent === null && <>Not emailed. Pass these details on yourself.</>}
            </span>
          </div>

          <p className="text-2xs text-text-muted">
            This is the only time this password is shown. The previous password no longer works and every session {target.name} had open has been signed out;
            they will be asked to choose their own password at next login.
          </p>
        </div>
      ) : (
        <form id="reset-password-form" onSubmit={submit} className="space-y-4">
          <p className="text-xs text-text-secondary">
            This replaces <strong className="text-primary">{target.name}</strong>&apos;s password with a new temporary one that you will see on the next
            screen. Their current password stops working immediately and they are signed out everywhere.
          </p>

          <label className="flex items-start gap-2 cursor-pointer text-xs">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 rounded border-border-subtle" />
            <span className="text-primary font-semibold">
              Also email it to <span className="font-mono">{target.email}</span>
            </span>
          </label>

          <div>
            <label htmlFor="reset-confirm-password" className="block text-xs font-semibold text-text-secondary mb-1">
              Your password (to confirm it&apos;s you)
            </label>
            <input
              id="reset-confirm-password"
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
      )}
    </Modal>
  );
}

export function CopyRow({ value, copied, onCopy, mono = true }: { value: string; copied: boolean; onCopy: () => void; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <code className={cn("flex-1 min-w-0 px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-sm break-all select-all", mono && "font-mono")}>
        {value}
      </code>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy"
        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-xs font-bold transition-colors"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-status-success" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
