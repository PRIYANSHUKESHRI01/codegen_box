"use client";

import { useEffect, useState } from "react";
import { Send, CheckCircle2, Users, UserCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { DRIVE_APPLICATION_STAGE_LABELS, type DriveApplication } from "@/types/placement";
import { Modal } from "@/components/ui/Modal";
import { HpButton, HpPill } from "@/components/portal/kit";
import { ScCheckRow, ScInlineEmpty, ScNotice, ScSkeletonList } from "@/components/portal/screeningKit";

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
  const alreadyInvited = candidates.length - invitable.length;

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      title="Invite Candidates"
      subtitle={contestTitle}
      icon={Send}
      size="lg"
      footer={
        <>
          <HpButton type="button" variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </HpButton>
          <HpButton
            onClick={handleSend}
            disabled={selected.size === 0}
            isLoading={sending}
            leftIcon={<CheckCircle2 className="h-4 w-4" />}
          >
            <span>Invite {selected.size > 0 ? `(${selected.size})` : ""}</span>
          </HpButton>
        </>
      }
    >
      <div className="space-y-4">
        <ScNotice tone="indigo">
          Only candidates already in this opening&apos;s pipeline can be invited. They&apos;ll see this assessment the moment you invite
          them — no separate registration step on their end.
        </ScNotice>

        {loading ? (
          <ScSkeletonList rows={4} />
        ) : invitable.length === 0 ? (
          <ScInlineEmpty
            icon={candidates.length === 0 ? Users : UserCheck}
            tone={candidates.length === 0 ? "slate" : "teal"}
            title={candidates.length === 0 ? "Pipeline is empty" : "Everyone's invited"}
            description={
              candidates.length === 0
                ? "No candidates in this opening's pipeline yet."
                : "Everyone in this opening's pipeline has already been invited."
            }
          />
        ) : (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-2xs font-semibold text-text-secondary">
                <span className="tabular">{invitable.length}</span> available to invite
                {alreadyInvited > 0 && (
                  <span className="font-normal text-text-muted">
                    {" "}
                    · <span className="tabular">{alreadyInvited}</span> already invited
                  </span>
                )}
              </p>
              {selected.size > 0 && (
                <HpPill tone="indigo" dot size="sm">
                  <span className="tabular">{selected.size}</span> selected
                </HpPill>
              )}
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {invitable.map((c) => (
                <ScCheckRow
                  key={c.id}
                  name={c.user.name}
                  detail={c.user.email}
                  checked={selected.has(c.user_id)}
                  onChange={() => toggle(c.user_id)}
                  trailing={
                    <HpPill tone="slate" size="sm" className="hidden shrink-0 sm:inline-flex">
                      {DRIVE_APPLICATION_STAGE_LABELS[c.stage] ?? c.stage}
                    </HpPill>
                  }
                />
              ))}
            </div>
          </div>
        )}

        {error && <ScNotice tone="rose">{error}</ScNotice>}
      </div>
    </Modal>
  );
}
