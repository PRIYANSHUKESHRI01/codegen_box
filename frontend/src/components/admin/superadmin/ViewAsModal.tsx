"use client";

import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { beginImpersonation } from "@/lib/impersonation";
import { Modal } from "@/components/ui/Modal";
import type { ViewAsResponse } from "@/types/adminSubscriptions";
import { roleInfo } from "./accountRoles";

interface ViewAsModalProps {
  target: { id: number; name: string; role: string };
  onClose: () => void;
}

/**
 * "View as": see the product exactly as this account's owner does, without
 * knowing or changing their password. Read-only (the server refuses anything that
 * would change their data), time-limited, shown with an unmissable banner on every
 * page, and recorded in the audit log — entering and leaving.
 *
 * Asks for the superadmin's own password: it is access to someone else's
 * account, so a stolen session token alone must not be enough.
 */
export function ViewAsModal({ target, onClose }: ViewAsModalProps) {
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || working) return;
    setWorking(true);
    setError(null);

    try {
      const res = await api.post<ViewAsResponse>(`/superadmin/users/${target.id}/impersonate`, { password });
      const destination = beginImpersonation(res);
      // A full navigation: the new session must start from a clean page, with none of the superadmin's in-memory state.
      window.location.assign(destination);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.errors?.password?.[0] ?? err.errors?.user?.[0] ?? err.message : err instanceof Error ? err.message : "Couldn't start viewing this account. Check your connection and try again."
      );
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={() => !working && onClose()}
      title="View as this user"
      subtitle={`${target.name} · ${roleInfo(target.role).label}`}
      icon={Eye}
      size="md"
      closeOnBackdrop={false}
      showCloseButton={!working}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            form="view-as-form"
            disabled={!password || working}
            className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Start viewing
          </button>
        </>
      }
    >
      <form id="view-as-form" onSubmit={submit} className="space-y-4">
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-text-secondary">
          <li>
            You will see AptRun exactly as <strong className="text-primary">{target.name}</strong> does — their dashboard, plan, locks and data.
          </li>
          <li>
            It is <strong className="text-primary">read-only</strong>: nothing can be submitted, bought or changed as them. Make changes from these superadmin tools.
          </li>
          <li>Their password is not shown or changed, and they are not signed out. The session ends by itself after 60 minutes.</li>
          <li>Starting and leaving are both written to the Audit Log under your name.</li>
        </ul>

        <div>
          <label htmlFor="view-as-password" className="mb-1 block text-xs font-semibold text-text-secondary">
            Your password (to confirm it&apos;s you)
          </label>
          <input
            id="view-as-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
