"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState } from "react";
import { Mic, Plus, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, FileText, BookOpen, Trash2, Sparkles, Layers } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { DriveVisibilityPanel } from "@/components/admin/contests/DriveVisibilityPanel";
import { ManageInterviewQuestionsModal } from "@/components/dashboard/interviews/ManageInterviewQuestionsModal";
import { GenerateQuestionsPanel } from "@/components/dashboard/interviews/GenerateQuestionsPanel";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { InterviewSummary, InterviewType } from "@/types/interview";
import { Modal } from "@/components/ui/Modal";

const BASE_PATH = "/admin/interviews";

interface AdminInterview extends InterviewSummary {
  visibility_summary: { selected: number; live: number; pending: number } | null;
  college_ids: number[] | null;
  owning_college: { id: number; name: string; short_code: string } | null;
}

interface CompanyOption {
  id: number;
  name: string;
  logo: string | null;
}

interface DriveOption {
  id: number;
  title: string;
  company_id: number;
}

const TYPE_LABEL: Record<InterviewType, string> = {
  general: "General",
  company: "Company",
  tpo_mock: "TPO Mock",
  company_hiring: "Company Hiring",
};

const TYPE_BADGE: Record<InterviewType, string> = {
  general: "bg-elevated text-text-muted",
  company: "bg-accent-secondary/15 text-accent-secondary",
  tpo_mock: "bg-cyan-500/15 text-cyan-400",
  company_hiring: "bg-teal-500/15 text-teal-500",
};

/**
 * Mellow-curated AI Interviews (general/company types only) — mirrors the
 * Contests page structurally. TPO/company each own their own types via
 * their own dashboards (Mock Interviews / AI Interviews), still listed here
 * for platform-wide oversight but not editable from this screen.
 */
export default function AdminInterviewsPage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "interviews");
  const [interviews, setInterviews] = useState<AdminInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<AdminInterview | null>(null);
  const [visibilityInterview, setVisibilityInterview] = useState<AdminInterview | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ interviews: AdminInterview[] }>(BASE_PATH);
      setInterviews(res.interviews);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load interviews.");
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
      <DashboardShell role="admin_internal" title="AI Interviews">
        <AccessDeniedNotice section="AI Interviews" />
      </DashboardShell>
    );
  }

  const handlePublish = async (interview: AdminInterview) => {
    try {
      await api.post(`${BASE_PATH}/${interview.slug}`, { status: "published" });
      triggerToast(`"${interview.title}" is now published.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish.");
    }
  };

  const handleDelete = async (interview: AdminInterview) => {
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
      role="admin_internal"
      title="AI Interviews"
      subtitle="Create and curate platform-run voice interviews — students only ever see published ones."
      actionButton={{ label: "New Interview", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Link
          href="/admin/interviews/tracks"
          className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Final Interviews (3-Round Tracks)</span>
        </Link>
        <Link
          href="/admin/interviews/question-bank"
          className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Manage Question Bank</span>
        </Link>
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading interviews...
        </div>
      ) : interviews.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No interviews yet — click &quot;New Interview&quot; to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {interviews.map((interview) => (
            <div key={interview.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-primary">{interview.title}</span>
                    <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded", TYPE_BADGE[interview.interview_type])}>
                      {TYPE_LABEL[interview.interview_type]}
                    </span>
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
                    {interview.is_mock && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-amber-500/15 text-amber-600">
                        <Sparkles className="w-2.5 h-2.5" />
                        Practice Round
                      </span>
                    )}
                    {interview.visibility_summary && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-3xs font-bold uppercase rounded flex items-center gap-1",
                          interview.visibility_summary.live > 0
                            ? "bg-status-success/15 text-status-success"
                            : "bg-status-warning/15 text-status-warning"
                        )}
                      >
                        {interview.visibility_summary.live > 0 ? <ShieldCheck className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                        {interview.visibility_summary.live}/{interview.visibility_summary.selected} college{interview.visibility_summary.selected === 1 ? "" : "s"} live
                      </span>
                    )}
                  </div>
                  <div className="text-2xs text-text-muted mt-0.5">
                    {interview.sessions_count ?? 0} taken
                    {interview.company && <> · {interview.company.name}</>}
                    {interview.owning_college && <> · {interview.owning_college.short_code} (TPO-owned)</>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {interview.interview_type === "tpo_mock" || interview.interview_type === "company_hiring" ? (
                  <span className="text-3xs text-text-muted italic px-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Managed by its owning {interview.interview_type === "tpo_mock" ? "college's TPO" : "company"}
                  </span>
                ) : (
                  <>
                    {interview.interview_type === "company" && interview.placement_drive && (
                      <button
                        onClick={() => setVisibilityInterview(interview)}
                        className="px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors"
                      >
                        Manage Visibility
                      </button>
                    )}
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
                      title="Delete interview"
                      className="p-1.5 rounded-control bg-elevated hover:bg-status-danger/10 border border-border-subtle hover:border-status-danger/30 text-text-muted hover:text-status-danger transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateInterviewModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
          onToast={triggerToast}
        />
      )}

      {managing && (
        <ManageInterviewQuestionsModal
          basePath={BASE_PATH}
          interviewSlug={managing.slug}
          interviewTitle={managing.title}
          restrictedToCompanyNote={
            managing.interview_type === "company"
              ? "Only questions tagged to this company (Companies → Recommended Interview Questions) can be added."
              : undefined
          }
          companyId={managing.interview_type === "company" ? managing.company?.id : undefined}
          defaultRole={managing.placement_drive?.role_title}
          onClose={() => setManaging(null)}
          onToast={triggerToast}
        />
      )}

      {visibilityInterview?.placement_drive && (
        <ManageVisibilityModal
          interview={visibilityInterview}
          onClose={() => {
            setVisibilityInterview(null);
            load();
          }}
          onToast={triggerToast}
        />
      )}
    </DashboardShell>
  );
}

function ManageVisibilityModal({
  interview,
  onClose,
  onToast,
}: {
  interview: AdminInterview;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<number[]>(interview.college_ids ?? []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`${BASE_PATH}/${interview.slug}/colleges`, { college_ids: selectedCollegeIds });
      onToast("College targeting updated.");
      onClose();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to save college targeting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="College Visibility"
      subtitle={interview.title}
      size="md"
      footer={
        <>
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
        </>
      }
    >
        <p className="text-[10.5px] text-text-muted mb-3">
          The drive may be live at more colleges than this interview targets — check only the ones this interview
          should actually go to.
        </p>
        <DriveVisibilityPanel
          driveId={interview.placement_drive!.id}
          onToast={onToast}
          targeting={{ selectedIds: selectedCollegeIds, onChange: setSelectedCollegeIds }}
        />
    </Modal>
  );
}

function CreateInterviewModal({
  onClose,
  onCreated,
  onToast,
}: {
  onClose: () => void;
  onCreated: () => void;
  onToast: (msg: string) => void;
}) {
  const [interviewType, setInterviewType] = useState<"general" | "company">("general");
  const [isMock, setIsMock] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [drives, setDrives] = useState<DriveOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [drivesLoading, setDrivesLoading] = useState(false);
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<number[]>([]);
  const [acceptedIds, setAcceptedIds] = useState<number[]>([]);

  const selectedDrive = drives.find((d) => String(d.id) === selectedDriveId);

  useEffect(() => {
    if (interviewType !== "company" || companies.length > 0) return;
    api
      .get<{ companies: CompanyOption[] }>("/admin/companies")
      .then((res) => setCompanies(res.companies))
      .catch(() => setCompanies([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewType]);

  useEffect(() => {
    if (!selectedCompanyId) {
      setDrives([]);
      return;
    }
    setDrivesLoading(true);
    api
      .get<{ drives: DriveOption[] }>(`/admin/placement-drives?company_id=${selectedCompanyId}&status=published`)
      .then((res) => setDrives(res.drives))
      .catch(() => setDrives([]))
      .finally(() => setDrivesLoading(false));
  }, [selectedCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ interview: { slug: string } }>(BASE_PATH, {
        title,
        description: description || undefined,
        interview_type: interviewType,
        placement_drive_id: interviewType === "company" ? Number(selectedDriveId) : undefined,
        college_ids: interviewType === "company" ? selectedCollegeIds : undefined,
        is_mock: interviewType === "company" ? isMock : undefined,
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
    <Modal
      onClose={onClose}
      title="New Interview"
      icon={Mic}
      size="xl"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
            Cancel
          </button>
          <button type="submit" form="create-interview-form" disabled={saving} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-60">
            {saving ? "Creating..." : "Create Draft"}
          </button>
        </>
      }
    >
        <p className="text-2xs text-text-muted mb-3">
          Starts as a draft — invisible to students until you add questions and click Publish.
        </p>

        <form id="create-interview-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Type *</label>
            <div className="flex gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit">
              {(["general", "company"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setInterviewType(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-control text-2xs font-bold transition-all",
                    interviewType === t ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                  )}
                >
                  {t === "general" ? "General" : "Company / Drive"}
                </button>
              ))}
            </div>
            {interviewType === "company" && (
              <p className="text-3xs text-text-muted mt-1">
                Only visible to students at colleges where this drive is mapped &amp; approved. Questions must
                already be tagged to the company.
              </p>
            )}
          </div>

          {interviewType === "company" && (
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
                  onChange={(e) => {
                    setSelectedDriveId(e.target.value);
                    setSelectedCollegeIds([]);
                  }}
                  disabled={!selectedCompanyId || drivesLoading}
                  className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary disabled:opacity-50"
                >
                  <option value="">{drivesLoading ? "Loading..." : "Select drive..."}</option>
                  {drives.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {interviewType === "company" && selectedDriveId && (
            <DriveVisibilityPanel
              driveId={Number(selectedDriveId)}
              onToast={onToast}
              targeting={{ selectedIds: selectedCollegeIds, onChange: setSelectedCollegeIds }}
            />
          )}

          {interviewType === "company" && (
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Round Type *</label>
              <div className="flex gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit">
                <button
                  type="button"
                  onClick={() => setIsMock(true)}
                  className={cn(
                    "px-3 py-1.5 rounded-control text-2xs font-bold transition-all",
                    isMock ? "bg-amber-500 text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                  )}
                >
                  Mock (Practice)
                </button>
                <button
                  type="button"
                  onClick={() => setIsMock(false)}
                  className={cn(
                    "px-3 py-1.5 rounded-control text-2xs font-bold transition-all",
                    !isMock ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                  )}
                >
                  Final (Evaluated)
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Engineering Foundations Interview"
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

          {(interviewType === "general" || (interviewType === "company" && selectedDriveId)) && (
            <GenerateQuestionsPanel
              key={`${interviewType}-${selectedCompanyId}`}
              defaultRole={selectedDrive?.title}
              companyId={interviewType === "company" ? Number(selectedCompanyId) : undefined}
              onAcceptedChange={setAcceptedIds}
            />
          )}

          {error && <p className="text-2xs text-status-danger">{error}</p>}
        </form>
    </Modal>
  );
}
