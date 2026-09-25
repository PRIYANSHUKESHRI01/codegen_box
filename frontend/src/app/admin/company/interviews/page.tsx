"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mic, Plus, X, Loader2, Send, FileText, Trash2, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ManageInterviewQuestionsModal } from "@/components/dashboard/interviews/ManageInterviewQuestionsModal";
import { ReviewSessionsModal } from "@/components/dashboard/interviews/ReviewSessionsModal";
import { InviteToInterviewModal } from "@/components/dashboard/company/InviteToInterviewModal";
import { GenerateQuestionsPanel } from "@/components/dashboard/interviews/GenerateQuestionsPanel";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InterviewSummary } from "@/types/interview";

const BASE_PATH = "/company/interviews";

interface ApiDrive {
  id: number;
  title: string;
  role_title: string;
}

/**
 * A company hiring tenant's own AI voice interviews — always tied to one
 * job opening, always invite-only. The usual flow: run an Assessment
 * (contest), review its Results, import qualifiers into the pipeline, then
 * create an interview here and Shortlist that same group — they're
 * notified by email and it appears on their dashboard immediately.
 */
function CompanyInterviewsPageContent() {
  const { status } = useAuthGuard(["admin_company"]);
  const searchParams = useSearchParams();
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<InterviewSummary | null>(null);
  const [inviting, setInviting] = useState<InterviewSummary | null>(null);
  const [reviewing, setReviewing] = useState<InterviewSummary | null>(null);

  // Deep-linked from the Job Openings urgency banner: /admin/company/interviews?drive=X&mock=1|0
  // auto-opens the create modal pre-filled with that drive + mock/final choice.
  const deepLinkDriveId = searchParams?.get("drive");
  const deepLinkMock = searchParams?.get("mock");
  const [prefill, setPrefill] = useState<{ driveId: string; isMock: boolean } | null>(null);

  useEffect(() => {
    if (deepLinkDriveId) {
      setPrefill({ driveId: deepLinkDriveId, isMock: deepLinkMock === "1" });
      setShowCreate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkDriveId, deepLinkMock]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ interviews: InterviewSummary[] }>(BASE_PATH);
      setInterviews(res.interviews);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load interviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const handlePublish = async (interview: InterviewSummary) => {
    try {
      await api.post(`${BASE_PATH}/${interview.slug}`, { status: "published" });
      triggerToast(`"${interview.title}" is now published.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish.");
    }
  };

  const handleDelete = async (interview: InterviewSummary) => {
    if (!window.confirm(`Delete "${interview.title}"? This can't be undone.`)) return;
    try {
      await api.delete(`${BASE_PATH}/${interview.slug}`);
      triggerToast(`"${interview.title}" deleted.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to delete interview.");
    }
  };

  return (
    <DashboardShell
      role="admin_company"
      title="AI Interviews"
      subtitle="Voice interviews tied to your job openings — candidates only see one once you shortlist them."
      actionButton={{ label: "New Interview", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-teal-500/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading interviews...
        </div>
      ) : interviews.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No interviews yet — click &quot;New Interview&quot; to create one for a job opening.
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((interview) => (
            <div
              key={interview.id}
              className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-control bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-500 shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-primary">{interview.title}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded",
                        interview.status === "published"
                          ? "bg-status-success/15 text-status-success"
                          : interview.status === "draft"
                          ? "bg-elevated text-text-muted"
                          : "bg-status-danger/15 text-status-danger"
                      )}
                    >
                      {interview.status}
                    </span>
                    {interview.is_mock && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/15 text-amber-600">
                        <Sparkles className="w-2.5 h-2.5" />
                        Practice Round
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {interview.placement_drive?.title ?? "No linked opening"} · {interview.sessions_count ?? 0} shortlisted
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setInviting(interview)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Shortlist</span>
                </button>
                <button
                  onClick={() => setReviewing(interview)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Responses</span>
                </button>
                <button
                  onClick={() => setManaging(interview)}
                  className="px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors"
                >
                  Manage Questions
                </button>
                {interview.status === "draft" && (
                  <button
                    onClick={() => handlePublish(interview)}
                    className="px-3 py-1.5 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-[11px] font-bold transition-colors"
                  >
                    Publish
                  </button>
                )}
                <button
                  onClick={() => handleDelete(interview)}
                  title="Delete interview"
                  className="p-1.5 rounded-control bg-elevated hover:bg-status-danger/10 border border-border-subtle hover:border-status-danger/30 text-text-muted hover:text-status-danger transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateInterviewModal
          initialDriveId={prefill?.driveId}
          initialIsMock={prefill?.isMock ?? false}
          onClose={() => {
            setShowCreate(false);
            setPrefill(null);
          }}
          onCreated={() => {
            setShowCreate(false);
            setPrefill(null);
            load();
          }}
        />
      )}

      {managing && (
        <ManageInterviewQuestionsModal
          basePath={BASE_PATH}
          interviewSlug={managing.slug}
          interviewTitle={managing.title}
          defaultRole={managing.placement_drive?.role_title}
          onClose={() => setManaging(null)}
          onToast={triggerToast}
        />
      )}

      {inviting && (
        <InviteToInterviewModal
          interviewSlug={inviting.slug}
          interviewTitle={inviting.title}
          placementDriveId={inviting.placement_drive_id!}
          onClose={() => setInviting(null)}
          onInvited={(message) => {
            triggerToast(message);
            setInviting(null);
            load();
          }}
        />
      )}

      {reviewing && (
        <ReviewSessionsModal
          basePath={BASE_PATH}
          listEndpoint="invited"
          interviewSlug={reviewing.slug}
          interviewTitle={reviewing.title}
          onClose={() => setReviewing(null)}
        />
      )}
    </DashboardShell>
  );
}

/** useSearchParams() (for the ?drive=&mock= deep link from the Job Openings urgency banner) requires a Suspense boundary at the export level — mirrors admin/company/candidates/page.tsx's exact wrapping. */
export default function CompanyInterviewsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-xs text-text-muted">Loading...</div>}>
      <CompanyInterviewsPageContent />
    </Suspense>
  );
}

function CreateInterviewModal({
  onClose,
  onCreated,
  initialDriveId,
  initialIsMock = false,
}: {
  onClose: () => void;
  onCreated: () => void;
  initialDriveId?: string;
  initialIsMock?: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [placementDriveId, setPlacementDriveId] = useState(initialDriveId ?? "");
  const [isMock, setIsMock] = useState(initialIsMock);
  const [drives, setDrives] = useState<ApiDrive[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ drives: ApiDrive[] }>("/company/drives")
      .then((res) => setDrives(res.drives))
      .catch(() => setDrives([]));
  }, []);

  const selectedDrive = drives.find((d) => String(d.id) === placementDriveId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ interview: { slug: string } }>(BASE_PATH, {
        title,
        description: description || undefined,
        placement_drive_id: Number(placementDriveId),
        is_mock: isMock,
      });
      const slug = res.interview.slug;
      for (const bankId of acceptedIds) {
        await api.post(`${BASE_PATH}/${slug}/questions`, { interview_question_bank_id: bankId });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create interview.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-primary flex items-center gap-2">
            <Mic className="w-4 h-4 text-teal-500" />
            <span>New AI Interview</span>
          </h3>
          <button onClick={onClose} disabled={saving} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-text-muted">
          Only candidates you explicitly shortlist can ever see this. Starts as a draft — add questions, publish, then shortlist.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Job Opening *</label>
            <select
              required
              value={placementDriveId}
              onChange={(e) => setPlacementDriveId(e.target.value)}
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500"
            >
              <option value="">Select a job opening...</option>
              {drives.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            {drives.length === 0 && (
              <p className="text-[10px] text-status-warning mt-1">Post a job opening first — an interview must belong to one.</p>
            )}
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Round Type *</label>
            <div className="flex gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit">
              <button
                type="button"
                onClick={() => setIsMock(true)}
                className={cn(
                  "px-3 py-1.5 rounded-control text-[11px] font-bold transition-all",
                  isMock ? "bg-amber-500 text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                )}
              >
                Mock (Practice)
              </button>
              <button
                type="button"
                onClick={() => setIsMock(false)}
                className={cn(
                  "px-3 py-1.5 rounded-control text-[11px] font-bold transition-all",
                  !isMock ? "bg-teal-500 text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                )}
              >
                Final (Evaluated)
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              {isMock
                ? "Candidates see this clearly labeled as a practice round — it's never part of the hiring decision."
                : "The real, evaluated round — this is what a human reviewer actually judges."}
            </p>
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Backend Engineer AI Interview"
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500"
            />
          </div>

          <GenerateQuestionsPanel key={placementDriveId} defaultRole={selectedDrive?.role_title} onAcceptedChange={setAcceptedIds} />

          {error && <p className="text-[11px] text-status-danger">{error}</p>}

          <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white font-bold transition-colors disabled:opacity-60">
              {saving ? "Creating..." : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
