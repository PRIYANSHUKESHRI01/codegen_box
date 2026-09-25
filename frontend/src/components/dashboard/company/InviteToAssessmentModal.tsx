"use client";

import { useEffect, useState } from "react";
import { X, Send, Loader2, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { DriveApplication } from "@/types/placement";

interface InviteToAssessmentModalProps {
  /** Contest::getRouteKeyName() is 'slug' — every /company/contests/{contest}/* route binds by slug, never the numeric id. */
  contestSlug: string;
  contestTitle: string;
  placementDriveId: number;
  onClose: () => void;
  onInvited: (message: string) => void;
}

interface InvitedParticipant {
  id: number;
  user_id: number;
}

/**
 * The only way a candidate gets access to a company_hiring assessment (see
 * Contest::isVisibleToUser() on the backend) — picks from the job opening's
 * OWN pipeline only, since inviteCandidates() silently skips anyone not
 * already a candidate of this opening. No TPO analog exists: a tpo_mock
 * contest has no per-candidate invite step at all.
 */
export function InviteToAssessmentModal({ contestSlug, contestTitle, placementDriveId, onClose, onInvited }: InviteToAssessmentModalProps) {
  const [candidates, setCandidates] = useState<DriveApplication[]>([]);
  const [invitedUserIds, setInvitedUserIds] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ applications: DriveApplication[] }>(`/company/drives/${placementDriveId}/candidates`),
      api.get<{ participants: InvitedParticipant[] }>(`/company/contests/${contestSlug}/invited`),
    ])
      .then(([candidatesRes, invitedRes]) => {
        setCandidates(candidatesRes.applications);
        setInvitedUserIds(new Set(invitedRes.participants.map((p) => p.user_id)));
      })
      .catch(() => setError("Failed to load candidates for this opening."))
      .finally(() => setLoading(false));
  }, [placementDriveId, contestSlug]);

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
      const res = await api.post<{ message: string; invited: number }>(`/company/contests/${contestSlug}/invite`, {
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
            <span>Invite Candidates — {contestTitle}</span>
          </h3>
          <button onClick={onClose} disabled={sending} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-text-muted">
          Only candidates already in this opening&apos;s pipeline can be invited. They&apos;ll see this assessment
          the moment you invite them — no separate registration step on their end.
        </p>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading candidates...
          </div>
        ) : invitable.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">
            {candidates.length === 0
              ? "No candidates in this opening's pipeline yet."
              : "Everyone in this opening's pipeline has already been invited."}
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
            <span>Invite {selected.size > 0 ? `(${selected.size})` : ""}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
