"use client";

import { useEffect, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { HandoverPicker, defaultHandover, handoverReady } from "./HandoverPicker";
import type { Colleague, Handover, TeamMember, Workload } from "./types";

interface Props {
  member: TeamMember;
  onClose: () => void;
  /** Called once the account is really gone, with a sentence for the toast. */
  onDeleted: (message: string) => void;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * Permanently deletes a marketing employee. Three things stand between a click and the delete: deciding what happens to the leads and
 * enquiries they carry (nothing a prospect asked for is dropped by accident), typing the account's email, and re-entering the superadmin's
 * own password. The button stays off until all are right; the server re-checks every one. Blocking is offered as the gentler alternative.
 */
export function DeleteMarketingModal({ member, onClose, onDeleted }: Props) {
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [handover, setHandover] = useState<Handover>({ mode: "leave", to: null });
  const [typedEmail, setTypedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .get<{ workload: Workload; colleagues: Colleague[] }>(`/superadmin/marketing-team/${member.id}/workload`)
      .then((res) => {
        if (!live) return;
        setWorkload(res.workload);
        setColleagues(res.colleagues);
        setHandover(defaultHandover(res.colleagues));
      })
      .catch((err) => live && setLoadError(err instanceof ApiError ? err.message : "Couldn't load what this would affect."));
    return () => {
      live = false;
    };
  }, [member.id]);

  const leads = workload ? workload.leads_open + workload.leads_closed : 0;
  const enquiries = workload ? workload.enquiries_open + workload.enquiries_closed : 0;
  const holdsWork = leads + enquiries > 0;
  const emailMatches = typedEmail.trim().toLowerCase() === member.email.toLowerCase();
  const emailLooksWrong = typedEmail.trim() !== "" && !emailMatches;
  const canDelete = workload !== null && emailMatches && password.length > 0 && (!holdsWork || handoverReady(handover)) && !working;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDelete) return;
    setWorking(true);
    setError(null);
    try {
      const res = await api.delete<{ leads: number; enquiries: number }>(`/superadmin/marketing-team/${member.id}`, {
        password,
        confirm_email: typedEmail.trim(),
        reassign_mode: holdsWork ? handover.mode : "leave",
        reassign_to: holdsWork && handover.mode === "to" ? handover.to : null,
      });
      onDeleted(
        holdsWork
          ? `${member.name} was deleted. ${plural(res.leads, "lead")} and ${plural(res.enquiries, "enquiry", "enquiries")} ${handover.mode === "leave" ? "are waiting unassigned." : "were handed over."}`
          : `${member.name} was deleted.`
      );
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.password?.[0] ?? err.errors?.confirm_email?.[0] ?? err.errors?.reassign_mode?.[0] ?? err.errors?.reassign_to?.[0] ?? err.message) : "Couldn't delete. Check your connection and try again.");
      setPassword("");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Delete marketing employee"
      subtitle={`${member.name} · ${member.email}`}
      icon={Trash2}
      iconClassName="bg-status-danger/10 text-status-danger"
      size="lg"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="delete-marketing-form" disabled={!canDelete} className="rounded-control bg-status-danger px-4 py-2 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            {working ? "Deleting…" : "Delete permanently"}
          </button>
        </>
      }
    >
      {loadError ? (
        <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
          {loadError}
        </div>
      ) : !workload ? (
        <div className="space-y-2" role="status" aria-label="Loading what this affects">
          <div className="h-16 animate-pulse rounded-control bg-elevated" />
          <div className="h-32 animate-pulse rounded-control bg-elevated" />
        </div>
      ) : (
        <form id="delete-marketing-form" onSubmit={submit} className="space-y-5">
          <div className="flex items-start gap-2.5 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
            <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
            <span>
              This removes {member.name}&apos;s account and signs them out everywhere. It can&apos;t be undone. If you only want them to stop receiving new work, <strong>block</strong> them instead.
            </span>
          </div>

          {holdsWork ? (
            <>
              <p className="text-xs text-text-secondary">
                {member.name} holds <strong className="text-primary">{plural(leads, "lead")}</strong> and <strong className="text-primary">{plural(enquiries, "enquiry", "enquiries")}</strong> (open and closed). Decide where they go before the account is removed.
              </p>
              <HandoverPicker colleagues={colleagues} value={handover} onChange={setHandover} name={member.name} />
            </>
          ) : (
            <p className="rounded-control border border-border-subtle bg-elevated p-3 text-xs text-text-muted">{member.name} holds no leads or enquiries, so nothing needs to be handed over.</p>
          )}

          <div>
            <label htmlFor="delete-marketing-email" className="mb-1 block text-xs font-semibold text-text-secondary">
              Type <span className="font-mono text-primary">{member.email}</span> to confirm
            </label>
            <input
              id="delete-marketing-email"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 font-mono text-xs text-primary outline-none focus:border-accent-primary"
            />
            {emailLooksWrong && <p className="mt-1 text-2xs text-text-muted">That doesn&apos;t match yet.</p>}
          </div>

          <div>
            <label htmlFor="delete-marketing-password" className="mb-1 block text-xs font-semibold text-text-secondary">
              Your password (to confirm it&apos;s you)
            </label>
            <input
              id="delete-marketing-password"
              type="password"
              autoComplete="current-password"
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
      )}
    </Modal>
  );
}
