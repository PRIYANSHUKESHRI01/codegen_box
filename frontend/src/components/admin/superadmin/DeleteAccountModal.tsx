"use client";

import { useEffect, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import type { DeletionPreview } from "@/types/adminSubscriptions";

const LINES: { key: keyof DeletionPreview["impact"]; singular: string; plural: string }[] = [
  { key: "practice_submissions", singular: "practice submission", plural: "practice submissions" },
  { key: "contest_entries", singular: "contest entry", plural: "contest entries" },
  { key: "interview_sessions", singular: "AI interview", plural: "AI interviews" },
  { key: "drive_applications", singular: "placement-drive application", plural: "placement-drive applications" },
  { key: "subscriptions", singular: "plan record", plural: "plan records" },
];

interface DeleteAccountModalProps {
  account: { id: number; name: string; email: string };
  onClose: () => void;
  /** Called once the account is really gone, so the list can refresh. */
  onDeleted: (name: string) => void;
}

/**
 * Permanent and irreversible, so three deliberate things stand between a click
 * and the delete: seeing what will be destroyed, typing the account's exact
 * email, and re-entering the superadmin's own password. The button stays disabled
 * until both are right, and the server checks both again — this is convenience,
 * not the safeguard. (Same shape as deleting a university.)
 *
 * Payment records are kept: the money trail outlives the person, with their name
 * and email snapshotted on it.
 */
export function DeleteAccountModal({ account, onClose, onDeleted }: DeleteAccountModalProps) {
  const [impact, setImpact] = useState<DeletionPreview["impact"] | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [typedEmail, setTypedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<DeletionPreview>(`/superadmin/users/${account.id}/deletion-preview`)
      .then((res) => !cancelled && setImpact(res.impact))
      .catch((err) => !cancelled && setImpactError(err instanceof ApiError ? err.errors?.user?.[0] ?? err.message : "Could not load what this would delete."));
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  const emailMatches = typedEmail.trim().toLowerCase() === account.email.toLowerCase();
  const canDelete = impact !== null && emailMatches && password.length > 0 && !working;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;
    setWorking(true);
    setError(null);

    try {
      await api.delete(`/superadmin/users/${account.id}`, { password, confirm_email: typedEmail.trim() });
      onDeleted(account.name);
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.password?.[0] ?? err.errors?.confirm_email?.[0] ?? err.message : "Could not delete the account. Check your connection and try again.");
      setWorking(false);
    }
  };

  const shown = impact ? LINES.filter((l) => impact[l.key] > 0) : [];

  return (
    <Modal
      onClose={() => !working && onClose()}
      title="Permanently delete account"
      subtitle={`${account.name} · ${account.email}`}
      icon={Trash2}
      iconClassName="bg-status-danger/10 text-status-danger"
      size="lg"
      closeOnBackdrop={false}
      showCloseButton={!working}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            form="delete-account-form"
            disabled={!canDelete}
            className="rounded-control bg-status-danger px-4 py-2 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {working ? "Deleting…" : "Permanently delete"}
          </button>
        </>
      }
    >
      <form id="delete-account-form" onSubmit={submit} className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
          <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
          <span className="font-semibold">This cannot be undone. There is no recycle bin and no backup is taken. To only stop someone signing in, block the account instead.</span>
        </div>

        <div>
          <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-text-muted">What will be deleted</div>
          {impactError ? (
            <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
              {impactError}
            </div>
          ) : impact === null ? (
            <div className="text-xs text-text-muted">Counting…</div>
          ) : (
            <ul className="space-y-1 text-xs text-primary">
              <li className="font-bold">The account, its sign-ins, profile, photo and resume</li>
              {shown.map((l) => (
                <li key={l.key}>
                  <span className="font-bold tabular-nums">{impact[l.key].toLocaleString()}</span> {impact[l.key] === 1 ? l.singular : l.plural}
                </li>
              ))}
            </ul>
          )}
          {impact !== null && impact.payments_kept > 0 && (
            <p className="mt-2 text-2xs text-text-muted">
              {impact.payments_kept} payment record{impact.payments_kept === 1 ? " is" : "s are"} <strong>kept</strong> for your books — with the payer&apos;s name and email, no longer linked to an account.
            </p>
          )}
          <p className="mt-2 text-2xs text-text-muted">Their email address becomes free to register again.</p>
        </div>

        <div>
          <label htmlFor="delete-account-email" className="mb-1 block text-xs font-semibold text-text-secondary">
            Type <span className="select-all font-mono text-primary">{account.email}</span> to confirm
          </label>
          <input
            id="delete-account-email"
            type="text"
            autoComplete="off"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-status-danger"
          />
        </div>

        <div>
          <label htmlFor="delete-account-password" className="mb-1 block text-xs font-semibold text-text-secondary">
            Your password (to confirm it&apos;s you)
          </label>
          <input
            id="delete-account-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-status-danger"
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
