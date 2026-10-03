"use client";

import { useEffect, useState } from "react";
import { Send, CheckCircle2, Users, UserCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { DRIVE_APPLICATION_STAGE_LABELS, type DriveApplication } from "@/types/placement";
import type { InterviewSessionRow } from "@/types/interview";
import { Modal } from "@/components/ui/Modal";
import { HpButton, HpPill } from "@/components/portal/kit";
import { ScCheckRow, ScInlineEmpty, ScNotice, ScSkeletonList } from "@/components/portal/screeningKit";

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
  const alreadyShortlisted = candidates.length - invitable.length;

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      title="Shortlist for Interview"
      subtitle={interviewTitle}
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
            <span>Shortlist &amp; Notify {selected.size > 0 ? `(${selected.size})` : ""}</span>
          </HpButton>
        </>
      }
    >
      <div className="space-y-4">
        <ScNotice tone="indigo">
          Only candidates already in this opening&apos;s pipeline can be shortlisted. They&apos;ll get an email with interview
          details and it will appear on their dashboard immediately.
        </ScNotice>

        {loading ? (
          <ScSkeletonList rows={4} />
        ) : invitable.length === 0 ? (
          <ScInlineEmpty
            icon={candidates.length === 0 ? Users : UserCheck}
            tone={candidates.length === 0 ? "slate" : "teal"}
            title={candidates.length === 0 ? "Pipeline is empty" : "Everyone's shortlisted"}
            description={
              candidates.length === 0
                ? "No candidates in this opening's pipeline yet — run an assessment and import qualifiers first."
                : "Everyone in this opening's pipeline has already been shortlisted."
            }
          />
        ) : (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-2xs font-semibold text-text-secondary">
                <span className="tabular">{invitable.length}</span> available to shortlist
                {alreadyShortlisted > 0 && (
                  <span className="font-normal text-text-muted">
                    {" "}
                    · <span className="tabular">{alreadyShortlisted}</span> already shortlisted
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
