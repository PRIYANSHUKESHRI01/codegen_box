"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, ApiError } from "@/lib/api";
import { HandoverPicker, defaultHandover, handoverReady } from "./HandoverPicker";
import type { Colleague, Handover, TeamMember, Workload } from "./types";

interface Props {
  member: TeamMember;
  onClose: () => void;
  /** The work moved; `message` is the toast. The list should refetch. */
  onDone: (message: string) => void;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** Moves a marketing employee's open leads and enquiries to someone else (or back into the unassigned pile), without touching their account. */
export function ReassignModal({ member, onClose, onDone }: Props) {
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [handover, setHandover] = useState<Handover>({ mode: "leave", to: null });
  const [includeClosed, setIncludeClosed] = useState(false);
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
      .catch((err) => live && setLoadError(err instanceof ApiError ? err.message : "Couldn't load their work."));
    return () => {
      live = false;
    };
  }, [member.id]);

  const moving = workload ? (includeClosed ? workload.leads_open + workload.leads_closed + workload.enquiries_open + workload.enquiries_closed : workload.leads_open + workload.enquiries_open) : 0;
  const leads = workload ? workload.leads_open + (includeClosed ? workload.leads_closed : 0) : 0;
  const enquiries = workload ? workload.enquiries_open + (includeClosed ? workload.enquiries_closed : 0) : 0;
  const canSend = workload !== null && moving > 0 && handoverReady(handover) && !working;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setWorking(true);
    setError(null);
    try {
      const res = await api.post<{ leads: number; enquiries: number }>(`/superadmin/marketing-team/${member.id}/reassign`, {
        reassign_mode: handover.mode,
        reassign_to: handover.mode === "to" ? handover.to : null,
        include_closed: includeClosed,
      });
      onDone(`Moved ${plural(res.leads, "lead")} and ${plural(res.enquiries, "enquiry", "enquiries")} from ${member.name}.`);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.reassign_to?.[0] ?? err.errors?.reassign_mode?.[0] ?? err.message) : "Couldn't move the work. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Reassign work"
      subtitle={`${member.name} · ${member.email}`}
      icon={ArrowRightLeft}
      size="lg"
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="reassign-form" disabled={!canSend} className="rounded-control bg-accent-primary px-4 py-2 font-bold text-white shadow-subtle transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
            {working ? "Moving…" : moving > 0 ? `Move ${plural(moving, "item")}` : "Nothing to move"}
          </button>
        </>
      }
    >
      {loadError ? (
        <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
          {loadError}
        </div>
      ) : !workload ? (
        <div className="space-y-2" role="status" aria-label="Loading their work">
          <div className="h-14 animate-pulse rounded-control bg-elevated" />
          <div className="h-32 animate-pulse rounded-control bg-elevated" />
        </div>
      ) : (
        <form id="reassign-form" onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-control border border-border-subtle bg-elevated p-3">
              <div className="tabular text-xl font-black text-primary">{workload.leads_open}</div>
              <div className="text-2xs text-text-muted">open leads{workload.leads_closed > 0 ? ` · ${workload.leads_closed} closed` : ""}</div>
            </div>
            <div className="rounded-control border border-border-subtle bg-elevated p-3">
              <div className="tabular text-xl font-black text-primary">{workload.enquiries_open}</div>
              <div className="text-2xs text-text-muted">open enquiries{workload.enquiries_closed > 0 ? ` · ${workload.enquiries_closed} closed` : ""}</div>
            </div>
          </div>

          {workload.leads_closed + workload.enquiries_closed > 0 && (
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-border-subtle" />
              <span>
                <span className="font-semibold text-primary">Also move their closed ones (won or lost)</span>
                <span className="block text-text-muted">Leave this off to keep {member.name}&apos;s conversion history with them.</span>
              </span>
            </label>
          )}

          {moving === 0 ? (
            <p className="rounded-control border border-border-subtle bg-elevated p-3 text-xs text-text-muted">{member.name} has nothing open right now, so there is nothing to hand over.</p>
          ) : (
            <HandoverPicker colleagues={colleagues} value={handover} onChange={setHandover} name={member.name} />
          )}

          {moving > 0 && (
            <p className="text-2xs text-text-muted">
              This moves {plural(leads, "lead")} and {plural(enquiries, "enquiry", "enquiries")}. The people who receive them are told in their bell.
            </p>
          )}

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
