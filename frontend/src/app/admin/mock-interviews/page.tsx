"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { Mic, Plus, Loader2, FileText, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ManageInterviewQuestionsModal } from "@/components/dashboard/interviews/ManageInterviewQuestionsModal";
import { ReviewSessionsModal } from "@/components/dashboard/interviews/ReviewSessionsModal";
import { GenerateQuestionsPanel } from "@/components/dashboard/interviews/GenerateQuestionsPanel";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InterviewSummary } from "@/types/interview";
import { Modal } from "@/components/ui/Modal";

const BASE_PATH = "/tpo/interviews";

/**
 * A college TPO's own private "mock" AI interviews — practice rounds
 * visible only to their own students, entirely separate from Mellow's
 * platform-run interviews. Direct mirror of the Mock Contests page.
 */
export default function MockInterviewsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<InterviewSummary | null>(null);
  const [reviewing, setReviewing] = useState<InterviewSummary | null>(null);

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
      triggerToast(err instanceof ApiError ? err.message : "Failed to load mock interviews.");
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
      triggerToast(err instanceof ApiError ? err.message : "Failed to delete mock interview.");
    }
  };

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Mock Interviews"
      subtitle="Private AI voice-interview practice for your own students only — questions come from the shared bank."
      actionButton={{ label: "New Mock Interview", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading mock interviews...
        </div>
      ) : interviews.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No mock interviews yet — click &quot;New Mock Interview&quot; to create one for your students.
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((interview) => (
            <div
              key={interview.id}
              className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-primary">{interview.title}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-3xs font-bold uppercase rounded",
                        interview.status === "published"
                          ? "bg-status-success/15 text-status-success"
                          : interview.status === "draft"
                          ? "bg-elevated text-text-muted"
                          : "bg-status-danger/15 text-status-danger"
                      )}
                    >
                      {interview.status}
                    </span>
                  </div>
                  <div className="text-2xs text-text-muted mt-0.5">{interview.sessions_count ?? 0} taken</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setReviewing(interview)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Responses</span>
                </button>
                <button
                  onClick={() => setManaging(interview)}
                  className="px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors"
                >
                  Manage Questions
                </button>
                {interview.status === "draft" && (
                  <button
                    onClick={() => handlePublish(interview)}
                    className="px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors"
                  >
                    Publish
                  </button>
                )}
                <button
                  onClick={() => handleDelete(interview)}
                  title="Delete mock interview"
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
        <CreateMockInterviewModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {managing && (
        <ManageInterviewQuestionsModal
          basePath={BASE_PATH}
          interviewSlug={managing.slug}
          interviewTitle={managing.title}
          onClose={() => setManaging(null)}
          onToast={triggerToast}
        />
      )}

      {reviewing && (
        <ReviewSessionsModal
          basePath={BASE_PATH}
          listEndpoint="sessions"
          interviewSlug={reviewing.slug}
          interviewTitle={reviewing.title}
          onClose={() => setReviewing(null)}
        />
      )}
    </DashboardShell>
  );
}

function CreateMockInterviewModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ interview: { slug: string } }>(BASE_PATH, { title, description: description || undefined });
      const slug = res.interview.slug;
      for (const bankId of acceptedIds) {
        await api.post(`${BASE_PATH}/${slug}/questions`, { interview_question_bank_id: bankId });
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create mock interview.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="New Mock Interview"
      icon={Mic}
      size="xl"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
            Cancel
          </button>
          <button type="submit" form="create-mock-interview-form" disabled={saving} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-60">
            {saving ? "Creating..." : "Create Draft"}
          </button>
        </>
      }
    >
        <p className="text-2xs text-text-muted mb-3">
          Only your own students can ever see this. Starts as a draft — generate questions with AI or add them from the shared bank, then publish.
        </p>

        <form id="create-mock-interview-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pre-Placement Mock HR Round"
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            />
          </div>

          <GenerateQuestionsPanel onAcceptedChange={setAcceptedIds} />

          {error && <p className="text-2xs text-status-danger">{error}</p>}
        </form>
    </Modal>
  );
}
