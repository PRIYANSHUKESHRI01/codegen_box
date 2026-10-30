"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { MARKETING_PERMISSIONS, type Permission } from "@/types/permissions";
import { AccessFields } from "./AccessFields";
import type { TeamMember } from "./types";

/** Change which sections of the Marketing dashboard one employee may reach. Takes effect on their very next request. */
export function EditAccessModal({ member, onClose, onSaved }: { member: TeamMember; onClose: () => void; onSaved: (message: string) => void }) {
  const [permissions, setPermissions] = useState<Permission[]>(member.permissions.filter((p): p is Permission => (MARKETING_PERMISSIONS as readonly string[]).includes(p)));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const same = permissions.length === member.permissions.length && permissions.every((p) => member.permissions.includes(p));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (same || working) return;
    setWorking(true);
    setError(null);
    try {
      await api.post(`/superadmin/users/${member.id}/permissions`, { permissions });
      onSaved(`Updated access for ${member.name}.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Edit access"
      subtitle={`${member.name} · ${member.email}`}
      icon={ShieldCheck}
      size="md"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="edit-access-form" disabled={same || working} className="rounded-control bg-accent-primary px-4 py-2 font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
            {working ? "Saving…" : "Save access"}
          </button>
        </>
      }
    >
      <form id="edit-access-form" onSubmit={submit} className="space-y-4">
        <AccessFields value={permissions} onChange={setPermissions} />
        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
