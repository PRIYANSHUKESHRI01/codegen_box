"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Layers, Plus, Loader2, Trash2, ClipboardList, Users, X } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { DriveVisibilityPanel } from "@/components/admin/contests/DriveVisibilityPanel";
import { RoleTemplateModal } from "@/components/dashboard/interviews/RoleTemplateModal";
import { CreateInterviewTrackModal } from "@/components/dashboard/interviews/CreateInterviewTrackModal";
import { ReviewSessionsModal } from "@/components/dashboard/interviews/ReviewSessionsModal";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InterviewRoleTemplate, InterviewTrackSummary, TrackRound } from "@/types/interviewTrack";

const TRACKS_PATH = "/admin/interview-tracks";
const TEMPLATES_PATH = "/admin/interview-role-templates";
const INTERVIEWS_PATH = "/admin/interviews";

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-elevated text-text-muted",
  published: "bg-status-success/15 text-status-success",
  cancelled: "bg-status-danger/15 text-status-danger",
};

/**
 * Ops's "Final Interview" surface: reusable Role Templates (60/40-style
 * category weighting per round) and the 3-round Interview Tracks built from
 * them. Each round is a plain Interview under the hood — question
 * generation and candidate review reuse the existing, unchanged
 * GenerateQuestionsPanel/ReviewSessionsModal.
 */
export default function AdminInterviewTracksPage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "interviews");

  const [templates, setTemplates] = useState<InterviewRoleTemplate[]>([]);
  const [tracks, setTracks] = useState<InterviewTrackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InterviewRoleTemplate | null>(null);
  const [showCreateTrack, setShowCreateTrack] = useState(false);
  const [visibilityTrack, setVisibilityTrack] = useState<InterviewTrackSummary | null>(null);
  const [reviewingRound, setReviewingRound] = useState<{ track: InterviewTrackSummary; round: TrackRound } | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templatesRes, tracksRes] = await Promise.all([
        api.get<{ templates: InterviewRoleTemplate[] }>(TEMPLATES_PATH),
        api.get<{ tracks: InterviewTrackSummary[] }>(TRACKS_PATH),
      ]);
      setTemplates(templatesRes.templates);
      setTracks(tracksRes.tracks);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load Final Interview data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready" && hasAccess) load();
  }, [status, hasAccess, load]);

  if (status !== "ready") return <SessionLoader />;

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="Final Interviews">
        <AccessDeniedNotice section="Final Interviews" />
      </DashboardShell>
    );
  }

  const handlePublishTrack = async (track: InterviewTrackSummary) => {
    try {
      await api.post(`${TRACKS_PATH}/${track.slug}`, { status: "published" });
      triggerToast(`"${track.title}" published — all 3 rounds are live.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish this track.");
    }
  };

  const handleDeleteTrack = async (track: InterviewTrackSummary) => {
    if (!window.confirm(`Delete "${track.title}"? This can't be undone.`)) return;
    try {
      await api.delete(`${TRACKS_PATH}/${track.slug}`);
      triggerToast(`"${track.title}" deleted.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to delete this track.");
    }
  };

  return (
    <DashboardShell
      role="admin_internal"
      title="Final Interviews"
      subtitle="Reusable role templates and the 3-round Interview Tracks built from them."
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      <Link href="/admin/interviews" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent-primary hover:underline mb-1">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to AI Interviews
      </Link>

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-accent-primary" />
                Role Templates
              </h2>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setShowTemplateModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Template
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                No role templates yet — create one to start building Final Interviews.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setEditingTemplate(t);
                      setShowTemplateModal(true);
                    }}
                    className="text-left p-3.5 rounded-panel bg-surface border border-border-subtle hover:border-accent-primary/40 shadow-subtle transition-colors"
                  >
                    <div className="text-xs font-bold text-primary">{t.name}</div>
                    {t.tech_stack_tags && t.tech_stack_tags.length > 0 && (
                      <div className="text-[10px] text-text-muted mt-0.5">{t.tech_stack_tags.join(" · ")}</div>
                    )}
                    <div className="text-[10.5px] text-text-secondary mt-1.5 space-y-0.5">
                      {t.rounds_config.map((r) => (
                        <div key={r.round_number}>
                          R{r.round_number} {r.round_name}: {r.question_count}q, qualifying {r.qualifying_score_percent}%
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent-primary" />
                Interview Tracks
              </h2>
              <button
                onClick={() => setShowCreateTrack(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                New Final Interview
              </button>
            </div>

            {tracks.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
                No Interview Tracks yet.
              </div>
            ) : (
              <div className="space-y-3">
                {tracks.map((track) => (
                  <div key={track.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-primary">{track.title}</span>
                        <span className={cn("px-1.5 py-0.5 text-[9px] font-bold uppercase rounded", STATUS_COLOR[track.status])}>{track.status}</span>
                        {track.role_template && <span className="text-[10.5px] text-text-muted">{track.role_template.name}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {track.track_type === "company" && (
                          <button
                            onClick={() => setVisibilityTrack(track)}
                            className="px-2.5 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[10.5px] font-bold text-text-secondary hover:text-primary transition-colors"
                          >
                            Manage Visibility
                          </button>
                        )}
                        {track.status === "draft" && (
                          <button
                            onClick={() => handlePublishTrack(track)}
                            className="px-2.5 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[10.5px] font-bold transition-colors"
                          >
                            Publish
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteTrack(track)}
                          title="Delete track"
                          className="p-1.5 rounded-control bg-elevated hover:bg-status-danger/10 border border-border-subtle hover:border-status-danger/30 text-text-muted hover:text-status-danger transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(track.rounds ?? [])
                        .slice()
                        .sort((a, b) => a.round_number - b.round_number)
                        .map((round) => (
                          <div key={round.id} className="p-2.5 rounded-control bg-elevated/60 border border-border-subtle space-y-1.5">
                            <div className="text-[11px] font-bold text-primary">
                              R{round.round_number} — {round.round_name}
                            </div>
                            <div className="text-[10px] text-text-muted">
                              {round.sessions_count ?? 0} candidate{round.sessions_count === 1 ? "" : "s"} · qualifying {round.qualifying_score_percent}%
                            </div>
                            <button
                              onClick={() => setReviewingRound({ track, round })}
                              className="flex items-center gap-1 text-[10.5px] font-semibold text-accent-primary hover:underline"
                            >
                              <Users className="w-3 h-3" />
                              Review Candidates
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {showTemplateModal && (
        <RoleTemplateModal
          basePath={TEMPLATES_PATH}
          template={editingTemplate ?? undefined}
          onClose={() => setShowTemplateModal(false)}
          onSaved={() => {
            setShowTemplateModal(false);
            load();
          }}
          onToast={triggerToast}
        />
      )}

      {showCreateTrack && (
        <CreateInterviewTrackModal
          role="admin"
          tracksBasePath={TRACKS_PATH}
          templatesBasePath={TEMPLATES_PATH}
          interviewsBasePath={INTERVIEWS_PATH}
          onClose={() => setShowCreateTrack(false)}
          onDone={() => {
            setShowCreateTrack(false);
            load();
          }}
          onToast={triggerToast}
        />
      )}

      {visibilityTrack?.placement_drive && (
        <ManageTrackVisibilityModal
          track={visibilityTrack}
          onClose={() => {
            setVisibilityTrack(null);
            load();
          }}
          onToast={triggerToast}
        />
      )}

      {reviewingRound && (
        <ReviewSessionsModal
          basePath={INTERVIEWS_PATH}
          listEndpoint="sessions"
          interviewSlug={reviewingRound.round.slug}
          interviewTitle={`${reviewingRound.track.title} — R${reviewingRound.round.round_number} ${reviewingRound.round.round_name}`}
          onClose={() => setReviewingRound(null)}
        />
      )}
    </DashboardShell>
  );
}

function ManageTrackVisibilityModal({
  track,
  onClose,
  onToast,
}: {
  track: InterviewTrackSummary;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<number[]>(track.college_ids ?? []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`${TRACKS_PATH}/${track.slug}/colleges`, { college_ids: selectedCollegeIds });
      onToast("College targeting updated.");
      onClose();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to save college targeting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div>
            <h3 className="text-base font-bold text-primary">College Visibility</h3>
            <p className="text-[11px] text-text-muted mt-0.5">{track.title}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <DriveVisibilityPanel
          driveId={track.placement_drive!.id}
          onToast={onToast}
          targeting={{ selectedIds: selectedCollegeIds, onChange: setSelectedCollegeIds }}
        />
        <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Targeting"}
          </button>
        </div>
      </div>
    </div>
  );
}
