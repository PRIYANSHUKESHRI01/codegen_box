"use client";

import { useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";

interface DeleteSuperadminModalProps {
  account: { id: number; name: string; email: string };
  onClose: () => void;
  onDeleted: (name: string) => void;
}

export function DeleteSuperadminModal({ account, onClose, onDeleted }: DeleteSuperadminModalProps) {
  const [typedEmail, setTypedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailMatches = typedEmail.trim().toLowerCase() === account.email.toLowerCase();
  const canDelete = emailMatches && password.length > 0 && !working;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;
    setWorking(true);
    setError(null);

    try {
      await api.delete(`/superadmin/superadmins/${account.id}`, {
        password,
        confirm_email: typedEmail.trim(),
      });
      onDeleted(account.name);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.errors?.password?.[0] ?? err.errors?.confirm_email?.[0] ?? err.errors?.user?.[0] ?? err.message
          : "Could not delete the superadmin account."
      );
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={() => !working && onClose()}
      title="Permanently delete superadmin"
      subtitle={`${account.name} · ${account.email}`}
      icon={Trash2}
      iconClassName="bg-status-danger/10 text-status-danger"
      size="lg"
      closeOnBackdrop={false}
      showCloseButton={!working}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="rounded-control border border-border-subtle px-4 py-2 text-xs text-text-muted hover:text-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="delete-superadmin-form"
            disabled={!canDelete}
            className="rounded-control bg-status-danger px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {working ? "Deleting…" : "Delete Superadmin"}
          </button>
        </>
      }
    >
      <form id="delete-superadmin-form" onSubmit={submit} className="space-y-4 text-xs">
        <div className="flex items-start gap-2.5 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-status-danger">
          <TriangleAlert className="mt-px h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">This permanently deletes the superadmin account and ends all its open sessions.</p>
            <p className="text-2xs opacity-90">
              Platform content they created (assessments, programs, etc.) is safely reassigned to your account, and historical security login logs are preserved for auditing.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="delete-sa-email" className="mb-1 block font-semibold text-text-secondary">
            Type <span className="select-all font-mono text-primary">{account.email}</span> to confirm
          </label>
          <input
            id="delete-sa-email"
            type="text"
            autoComplete="off"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-status-danger"
          />
        </div>

        <div>
          <label htmlFor="delete-sa-password" className="mb-1 block font-semibold text-text-secondary">
            Your Superadmin Password (to confirm)
          </label>
          <input
            id="delete-sa-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-primary outline-none focus:border-status-danger"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
