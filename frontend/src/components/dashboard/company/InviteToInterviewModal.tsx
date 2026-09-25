"use client";

import { useEffect, useState } from "react";
import { X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { DriveApplication } from "@/types/placement";
import type { InterviewSessionRow } from "@/types/interview";

interface InviteToInterviewModalProps {
  interviewSlug: string;
  interviewTitle: string;
  placementDriveId: number;
  onClose: () => void;
  onInvited: (message: string) => void;
}

/**
 * The only way a candidate gets access to a company_hiring interview (see
 * Interview::isVisibleToUser() on the backend) — same shape as
 * InviteToAssessmentModal, picking from the job opening's own
 * DriveApplication pipeline only. Sending an invite here also queues the
 * "you've been shortlisted" email (SendInterviewShortlistEmail) — the
 * candidate doesn't need to do anything else to see it on their dashboard.
 */
export function InviteToInterviewModal({ interviewSlug, interviewTitle, placementDriveId, onClose, onInvited }: InviteToInterviewModalProps) {
  const [candidates, setCandidates] = useState<DriveApplication[]>([]);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ applications: DriveApplication[] }>(`/company/drives/${placementDriveId}/candidates`),
      api.get<{ sessions: InterviewSessionRow[] }>(`/company/interviews/${interviewSlug}/invited`),
    ])
      .then(([candidatesRes, invitedRes]) => {
        setCandidates(candidatesRes.applications);
        setInvitedUserIds(new Set(invitedRes.sessions.map((s) => s.user_id)));
      })
      .catch(() => setError("Failed to load candidates for this opening."))
      .finally(() => setLoading(false));
  }, [placementDriveId, interviewSlug]);

  const toggle = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.post<{ message: string; invited: number }>(`/company/interviews/${interviewSlug}/invite`, {
        user_ids: Array.from(selected),
      });
      onInvited(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send invites.");
    } finally {
      setSending(false);
    }
  };

  const invitable = candidates.filter((c) => !invitedUserIds.has(c.user_id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-primary flex items-center gap-2">
            <Send className="w-4 h-4 text-teal-500" />
            <span>Shortlist for Interview — {interviewTitle}</span>
          </h3>
          <button onClick={onClose} disabled={sending} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-text-muted">
          Only candidates already in this opening&apos;s pipeline can be shortlisted. They&apos;ll get an email with
          interview details and it will appear on their dashboard immediately.
        </p>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading candidates...
          </div>
        ) : invitable.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">
            {candidates.length === 0
              ? "No candidates in this opening's pipeline yet — run an assessment and import qualifiers first."
              : "Everyone in this opening's pipeline has already been shortlisted."}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {invitable.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2.5 p-2.5 rounded-control bg-elevated/60 border border-border-subtle text-xs cursor-pointer hover:bg-elevated transition-colors"
              >
                <input type="checkbox" checked={selected.has(c.user_id)} onChange={() => toggle(c.user_id)} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-primary truncate">{c.user.name}</span>
                  <span className="block text-[10px] text-text-muted truncate">{c.user.email}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-[11px] text-status-danger">{error}</p>}

        <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0}
            className="px-4 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Shortlist &amp; Notify {selected.size > 0 ? `(${selected.size})` : ""}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
