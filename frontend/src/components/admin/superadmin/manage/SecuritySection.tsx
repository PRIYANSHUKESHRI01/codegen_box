"use client";

import { useState } from "react";
import { Ban, CheckCircle2, Clock, Eye, KeyRound, LogOut, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "../types";
import { DeleteAccountModal } from "../DeleteAccountModal";
import { ResetPasswordModal } from "../ResetPasswordModal";
import { ViewAsModal } from "../ViewAsModal";
import { Card, Row, SectionTitle, dangerButton, ghostButton, inputClass, primaryButton, timeAgo, type SectionProps } from "./shared";

/**
 * Sign-in, access and the destructive tools for one account.
 *
 * Passwords can't be read back — they are stored as one-way hashes, and a user
 * replaces their temporary one at first login, so there is nothing to show. The two
 * honest ways to deal with "I need to get into / see this account" are here:
 * issue a fresh temporary password (shown once), or "View as" — see exactly what
 * they see, read-only, without touching their password at all.
 */
export function SecuritySection({ data, reload, triggerToast, onDeleted }: SectionProps & { onDeleted: () => void }) {
  const { user, login, capabilities } = data;
  const [resetting, setResetting] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [askBlock, setAskBlock] = useState(false);
  const [busy, setBusy] = useState<"signout" | "block" | null>(null);

  const signOutEverywhere = async () => {
    setBusy("signout");
    try {
      const res = await api.post<{ revoked: number }>(`/superadmin/users/${user.id}/revoke-sessions`);
      triggerToast(res.revoked > 0 ? `${user.name} was signed out of ${res.revoked} device${res.revoked === 1 ? "" : "s"}.` : `${user.name} had no open sessions.`);
      setConfirmSignOut(false);
      await reload();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.errors?.user?.[0] ?? err.message : "Couldn't sign them out.");
    } finally {
      setBusy(null);
    }
  };

  const toggleBlock = async () => {
    setBusy("block");
    try {
      await api.post(`/superadmin/users/${user.id}/toggle-block`, user.is_blocked ? undefined : { reason: blockReason.trim() || undefined });
      triggerToast(user.is_blocked ? `${user.name}'s account was unblocked.` : `${user.name}'s account was blocked — any session they have open ends on its next request.`);
      setAskBlock(false);
      setBlockReason("");
      await reload();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't update the account.");
    } finally {
      setBusy(null);
    }
  };

  const passwordBadge = user.is_blocked ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-status-danger/15 px-2 py-0.5 text-3xs font-bold text-status-danger">
      <Ban className="h-3 w-3" /> Blocked
    </span>
  ) : login.password_state === "temporary" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-status-warning/15 px-2 py-0.5 text-3xs font-bold text-status-warning" title="Still the temporary password they were issued — they have not signed in to choose their own yet.">
      <Clock className="h-3 w-3" /> Temporary — not changed yet
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-status-success/15 px-2 py-0.5 text-3xs font-bold text-status-success" title="The user set their own password.">
      <CheckCircle2 className="h-3 w-3" /> Set by user
    </span>
  );

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Sign-in</SectionTitle>
        <Card>
          <dl>
            <Row label="Login ID" mono>
              {login.login_id}
            </Row>
            <Row label="Password">{passwordBadge}</Row>
            <Row label="Login email sent">{login.credentials_email_sent_at ? formatDateTime(login.credentials_email_sent_at) : "—"}</Row>
            <Row label="Last seen">{login.last_seen_at ? timeAgo(login.last_seen_at) : "—"}</Row>
            <Row label="Open sessions">{login.active_sessions}</Row>
          </dl>
          <p className="mt-3 border-t border-border-subtle pt-3 text-2xs leading-relaxed text-text-muted">
            A password can&apos;t be read back: it&apos;s stored as a one-way hash, and a user replaces a temporary one the first time they sign in. To get into or see an account, reset it to a fresh temporary
            password, or use <strong className="text-text-secondary">View as</strong> to see what they see without touching their password.
          </p>
        </Card>
      </div>

      <div>
        <SectionTitle>Access</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {capabilities.view_as && (
            <button type="button" onClick={() => setViewing(true)} className={cn(primaryButton, "justify-start py-2.5")}>
              <Eye className="h-3.5 w-3.5" /> View as this user
            </button>
          )}
          {capabilities.reset_password && (
            <button type="button" onClick={() => setResetting(true)} className={cn(ghostButton, "justify-start py-2.5")}>
              <KeyRound className="h-3.5 w-3.5" /> Reset password &amp; show it
            </button>
          )}
          {capabilities.revoke_sessions && (
            <button type="button" onClick={() => setConfirmSignOut(true)} disabled={busy !== null || login.active_sessions === 0} className={cn(ghostButton, "justify-start py-2.5")}>
              <LogOut className="h-3.5 w-3.5" /> Sign out of all devices
            </button>
          )}
        </div>

        {confirmSignOut && (
          <Card className="mt-3 space-y-2.5">
            <p className="text-text-secondary">
              End all {login.active_sessions} open session{login.active_sessions === 1 ? "" : "s"} for <strong className="text-primary">{user.name}</strong>? They can sign straight back in with their password.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void signOutEverywhere()} disabled={busy !== null} className={primaryButton}>
                Sign them out
              </button>
              <button type="button" onClick={() => setConfirmSignOut(false)} disabled={busy !== null} className={ghostButton}>
                Cancel
              </button>
            </div>
          </Card>
        )}
      </div>

      {capabilities.block && (
        <div>
          <SectionTitle>Account status</SectionTitle>
          <Card className="space-y-3">
            <div className="flex items-start gap-2">
              {user.is_blocked ? <ShieldAlert className="mt-px h-4 w-4 shrink-0 text-status-danger" /> : <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-status-success" />}
              <div>
                <div className={cn("font-bold", user.is_blocked ? "text-status-danger" : "text-status-success")}>{user.is_blocked ? "Blocked" : "Active"}</div>
                {user.is_blocked && (
                  <div className="text-text-muted">
                    {user.blocked_reason ? `“${user.blocked_reason}”` : "No reason recorded"}
                    {user.blocked_by ? ` · by ${user.blocked_by}` : ""}
                    {user.blocked_at ? ` · ${timeAgo(user.blocked_at)}` : ""}
                  </div>
                )}
              </div>
            </div>

            {user.is_blocked ? (
              <button type="button" onClick={() => void toggleBlock()} disabled={busy !== null} className={cn(ghostButton, "w-full")}>
                Unblock account
              </button>
            ) : askBlock ? (
              <div className="space-y-2">
                <label htmlFor="block-reason" className="block text-2xs font-semibold text-text-secondary">
                  Reason (shown to staff, not to the user)
                </label>
                <input id="block-reason" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} maxLength={255} placeholder="e.g. Cheating in the October contest" className={inputClass} autoFocus />
                <p className="text-3xs text-text-muted">Blocking takes effect on their very next request — a session they have open ends there.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void toggleBlock()} disabled={busy !== null} className={dangerButton}>
                    Block account
                  </button>
                  <button type="button" onClick={() => setAskBlock(false)} disabled={busy !== null} className={ghostButton}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAskBlock(true)} disabled={busy !== null} className={cn(dangerButton, "w-full")}>
                Block account…
              </button>
            )}
          </Card>
        </div>
      )}

      {capabilities.delete && (
        <div>
          <SectionTitle>Danger zone</SectionTitle>
          <Card className="flex items-center justify-between gap-3 border-status-danger/30">
            <div>
              <div className="font-bold text-primary">Delete this account</div>
              <div className="text-text-muted">Permanent. Removes the account and everything it owns.</div>
            </div>
            <button type="button" onClick={() => setDeleting(true)} className={cn(dangerButton, "shrink-0")}>
              <Trash2 className="h-3 w-3" /> Delete…
            </button>
          </Card>
        </div>
      )}

      {resetting && (
        <ResetPasswordModal
          target={{ id: user.id, name: user.name, email: user.email, role: user.role }}
          onClose={() => setResetting(false)}
          onReset={() => {
            // The password state, "email sent" time and open sessions all changed server-side.
            void reload();
          }}
        />
      )}
      {viewing && <ViewAsModal target={{ id: user.id, name: user.name, role: user.role }} onClose={() => setViewing(false)} />}
      {deleting && (
        <DeleteAccountModal
          account={{ id: user.id, name: user.name, email: user.email }}
          onClose={() => setDeleting(false)}
          onDeleted={(name) => {
            setDeleting(false);
            triggerToast(`${name}'s account was permanently deleted.`);
            onDeleted();
          }}
        />
      )}
    </div>
  );
}
