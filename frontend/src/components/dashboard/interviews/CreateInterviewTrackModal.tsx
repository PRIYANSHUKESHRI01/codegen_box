"use client";

import { useEffect, useState } from "react";
import { Layers, CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { DriveVisibilityPanel } from "@/components/admin/contests/DriveVisibilityPanel";
import { GenerateQuestionsPanel } from "@/components/dashboard/interviews/GenerateQuestionsPanel";
import { RoundQuestionTargetChecklist } from "@/components/dashboard/interviews/RoundQuestionTargetChecklist";
import type { AttachedInterviewQuestion, BankQuestion } from "@/types/interview";
import type { InterviewRoleTemplate, InterviewTrackSummary, TrackRound } from "@/types/interviewTrack";

interface CreateInterviewTrackModalProps {
  role: "admin" | "tpo" | "company";
  /** e.g. "/admin/interview-tracks" — the role-scoped track controller base. */
  tracksBasePath: string;
  /** e.g. "/admin/interview-role-templates" — the role-scoped template controller base. */
  templatesBasePath: string;
  /** e.g. "/admin/interviews" — where each round's questions are attached (round already IS a plain Interview). */
  interviewsBasePath: string;
  onClose: () => void;
  onDone: () => void;
  onToast: (msg: string) => void;
}

interface CompanyOption {
  id: number;
  name: string;
}

interface DriveOption {
  id: number;
  title: string;
  company_id?: number;
}

/**
 * Creates a "Final Interview" 3-round track from a picked InterviewRoleTemplate,
 * then walks the creator through generating each round's questions —
 * embedding the existing GenerateQuestionsPanel completely unchanged (run
 * once per category to hit a round's weighted target, see
 * RoundQuestionTargetChecklist).
 */
export function CreateInterviewTrackModal({
  role,
  tracksBasePath,
  templatesBasePath,
  interviewsBasePath,
  onClose,
  onDone,
  onToast,
}: CreateInterviewTrackModalProps) {
  const [templates, setTemplates] = useState<InterviewRoleTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [trackType, setTrackType] = useState<"general" | "company">("general");

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [drives, setDrives] = useState<DriveOption[]>([]);
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<number[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTrack, setCreatedTrack] = useState<InterviewTrackSummary | null>(null);

  const selectedTemplate = templates.find((t) => String(t.id) === templateId);
  const needsDrive = role === "company" || (role === "admin" && trackType === "company");

  useEffect(() => {
    api
      .get<{ templates: InterviewRoleTemplate[] }>(templatesBasePath)
      .then((res) => setTemplates(res.templates.filter((t) => t.is_active)))
      .catch(() => setTemplates([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (role === "admin" && trackType === "company" && companies.length === 0) {
      api
        .get<{ companies: CompanyOption[] }>("/admin/companies")
        .then((res) => setCompanies(res.companies))
        .catch(() => setCompanies([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, trackType]);

  useEffect(() => {
    if (role === "admin") {
      if (!selectedCompanyId) {
        setDrives([]);
        return;
      }
      api
        .get<{ drives: DriveOption[] }>(`/admin/placement-drives?company_id=${selectedCompanyId}&status=published`)
        .then((res) => setDrives(res.drives))
        .catch(() => setDrives([]));
    } else if (role === "company") {
      api
        .get<{ drives: DriveOption[] }>("/company/drives")
        .then((res) => setDrives(res.drives))
        .catch(() => setDrives([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, selectedCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title,
        description: description || undefined,
        interview_role_template_id: selectedTemplate.id,
      };
      if (role === "admin") {
        payload.track_type = trackType;
        if (trackType === "company") {
          payload.placement_drive_id = Number(selectedDriveId);
          payload.college_ids = selectedCollegeIds;
        }
      } else if (role === "company") {
        payload.placement_drive_id = Number(selectedDriveId);
      }

      const res = await api.post<{ track: InterviewTrackSummary }>(tracksBasePath, payload);
      setCreatedTrack(res.track);
      onToast(`"${title}" created — now generate each round's questions below.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create this Interview Track.");
    } finally {
      setSaving(false);
    }
  };

  if (createdTrack) {
    return (
      <GenerateRoundsStep
        track={createdTrack}
        template={selectedTemplate!}
        interviewsBasePath={interviewsBasePath}
        tracksBasePath={tracksBasePath}
        onClose={onClose}
        onDone={onDone}
        onToast={onToast}
      />
    );
  }

  return (
    <Modal
      onClose={onClose}
      title="New Final Interview (3 Rounds)"
      icon={Layers}
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-interview-track-form"
            disabled={saving || !selectedTemplate || (needsDrive && !selectedDriveId)}
            className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Track"}
          </button>
        </>
      }
    >
      <form id="create-interview-track-form" onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Role Template *</label>
            <select
              required
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
            >
              <option value="">Select a role template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-3xs text-text-muted mt-1">No role templates yet — create one first.</p>
            )}
          </div>

          {selectedTemplate && (
            <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle space-y-1">
              {selectedTemplate.rounds_config.map((r) => (
                <div key={r.round_number} className="text-3xs text-text-secondary">
                  <span className="font-bold text-primary">
                    Round {r.round_number} — {r.round_name}:
                  </span>{" "}
                  {r.question_count} questions ({Object.entries(r.category_weights).map(([c, w]) => `${c} ${w}%`).join(", ")}), qualifying {r.qualifying_score_percent}%
                </div>
              ))}
            </div>
          )}

          {role === "admin" && (
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Type *</label>
              <div className="flex gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit">
                {(["general", "company"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTrackType(t)}
                    className={cn(
                      "px-3 py-1.5 rounded-control text-2xs font-bold transition-all",
                      trackType === t ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                    )}
                  >
                    {t === "general" ? "General" : "Company / Drive"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {role === "admin" && trackType === "company" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-text-secondary mb-1">Company *</label>
                <select
                  required
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setSelectedDriveId("");
                    setSelectedCollegeIds([]);
                  }}
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
                >
                  <option value="">Select company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-text-secondary mb-1">Drive *</label>
                <select
                  required
                  value={selectedDriveId}
                  onChange={(e) => setSelectedDriveId(e.target.value)}
                  disabled={!selectedCompanyId}
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary disabled:opacity-50"
                >
                  <option value="">Select drive...</option>
                  {drives.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {role === "company" && (
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Job Opening *</label>
              <select
                required
                value={selectedDriveId}
                onChange={(e) => setSelectedDriveId(e.target.value)}
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
              >
                <option value="">Select opening...</option>
                {drives.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {needsDrive && role === "admin" && selectedDriveId && (
            <DriveVisibilityPanel
              driveId={Number(selectedDriveId)}
              onToast={onToast}
              targeting={{ selectedIds: selectedCollegeIds, onChange: setSelectedCollegeIds }}
            />
          )}

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Backend Developer — Final Interview"
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

          {error && <p className="text-2xs text-status-danger">{error}</p>}
      </form>
    </Modal>
  );
}

function GenerateRoundsStep({
  track,
  template,
  interviewsBasePath,
  tracksBasePath,
  onClose,
  onDone,
  onToast,
}: {
  track: InterviewTrackSummary;
  template: InterviewRoleTemplate;
  interviewsBasePath: string;
  tracksBasePath: string;
  onClose: () => void;
  onDone: () => void;
  onToast: (msg: string) => void;
}) {
  const rounds = (track.rounds ?? []).slice().sort((a, b) => a.round_number - b.round_number);
  const [attachedByRound, setAttachedByRound] = useState<Record<number, AttachedInterviewQuestion[]>>({});
  const [publishing, setPublishing] = useState(false);

  const loadAttached = async (round: TrackRound) => {
    try {
      const res = await api.get<{ questions: AttachedInterviewQuestion[] }>(`${interviewsBasePath}/${round.slug}/questions`);
      setAttachedByRound((prev) => ({ ...prev, [round.id]: res.questions }));
    } catch {
      // best-effort refresh — the checklist just stays stale until the next successful add
    }
  };

  useEffect(() => {
    rounds.forEach(loadAttached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddNow = (round: TrackRound) => async (q: BankQuestion) => {
    await api.post(`${interviewsBasePath}/${round.slug}/questions`, { interview_question_bank_id: q.id });
    await loadAttached(round);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await api.post(`${tracksBasePath}/${track.slug}`, { status: "published" });
      onToast(`"${track.title}" is now published — all 3 rounds are live.`);
      onDone();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to publish this track.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={track.title}
      subtitle="Generate each round's questions, then publish when ready."
      icon={CheckCircle2}
      iconClassName="bg-status-success/10 text-status-success"
      size="2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors"
          >
            Finish Later
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-50"
          >
            {publishing ? "Publishing..." : "Publish All 3 Rounds"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {rounds.map((round, i) => {
          const config = template.rounds_config[i];
          return (
            <div key={round.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-3xs font-bold text-accent-primary shrink-0">
                  {round.round_number}
                </span>
                <h4 className="text-xs font-bold text-primary">{round.round_name}</h4>
              </div>
              <RoundQuestionTargetChecklist round={config} attachedQuestions={attachedByRound[round.id] ?? []} />
              <GenerateQuestionsPanel
                key={round.id}
                defaultRole={track.role_title ?? template.name}
                companyId={track.company?.id}
                onAddNow={handleAddNow(round)}
              />
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
