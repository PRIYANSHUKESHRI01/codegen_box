"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  Plus,
  Loader2,
  Trash2,
  CheckCircle2,
  Search,
  Users2,
  EyeOff,
  Eye,
  Mic,
  Swords,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import type { ProblemSummary } from "@/types/problem";
import { Modal } from "@/components/ui/Modal";

type AudienceScope = "all" | "college" | "direct";

interface CollegeOption {
  id: number;
  name: string;
  short_code: string;
}

interface TalentPoolContest {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  start_at: string;
  end_at: string;
  status: "draft" | "published" | "cancelled";
  finalized_at: string | null;
  participants_count: number;
  audience_scope: AudienceScope | null;
  qualifying_score_percent: string | number | null;
  college_ids: number[] | null;
}

interface TalentPoolContestProblem {
  id: number;
  points: number;
  display_order: number;
  problem: { id: number; slug: string; title: string; difficulty: string };
}

interface TalentPoolInterviewItem {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: "draft" | "published" | "cancelled";
  sessions_count: number;
  audience_scope: AudienceScope | null;
  college_ids: number[] | null;
}

interface QuestionBankItem {
  id: number;
  question_text: string;
  category: string;
  difficulty: string;
}

interface InterviewQuestionRow {
  id: number;
  display_order: number;
  question_bank: QuestionBankItem;
}

interface TalentPoolCandidateRow {
  id: number;
  score_percent: string;
  qualified_at: string;
  visibility_status: string;
  inquiries_count: number;
  user: {
    id: number;
    name: string;
    email: string;
    college_id: number | null;
    branch: string | null;
    cgpa: string | null;
    college: { id: number; name: string; short_code: string } | null;
  } | null;
  source_contest: { id: number; title: string; slug: string } | null;
  hired_by_company: { id: number; name: string; logo: string | null } | null;
}

interface PaginatedCandidates {
  data: TalentPoolCandidateRow[];
  current_page: number;
  last_page: number;
  total: number;
}

const AUDIENCE_LABEL: Record<AudienceScope, string> = {
  all: "All Users",
  college: "Specific Colleges",
  direct: "Mellow Direct Users",
};

const VISIBILITY_LABEL: Record<string, string> = {
  pending_consent: "Awaiting Consent",
  visible: "Visible to Partners",
  hidden_by_candidate: "Hidden (Candidate)",
  hidden_by_mellow: "Hidden (Mellow)",
  hired: "Hired",
};

const VISIBILITY_BADGE: Record<string, string> = {
  pending_consent: "bg-status-warning/15 text-status-warning",
  visible: "bg-status-success/15 text-status-success",
  hidden_by_candidate: "bg-elevated text-text-muted",
  hidden_by_mellow: "bg-status-danger/15 text-status-danger",
  hired: "bg-accent-primary/15 text-accent-primary",
};

/**
 * Mellow's own scouting funnel — schedule a coding test (and optionally a
 * follow-up interview) targeted at all users / specific colleges / "Mellow
 * Direct" users, then oversee who qualified (score >= that assessment's
 * threshold — see TalentPoolQualificationService on the backend) and is
 * visible to hiring partners in the shared Talent Pool marketplace.
 * Authoring itself reuses the platform's real Contest/Interview engine
 * (contest_type/interview_type = talent_pool) — this page is a filtered lens
 * over /admin/contests and /admin/interviews, plus the marketplace-only
 * oversight actions that have no equivalent anywhere else.
 */
export default function AdminTalentPoolPage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "talent_pool");

  const [tab, setTab] = useState<"assessments" | "candidates">("assessments");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role={user?.role === "admin_tpo" ? "admin_tpo" : "admin_internal"}
      title="Talent Pool"
      subtitle="Schedule Mellow-run coding tests and interviews, then hand qualifying candidates to hiring partners."
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {!hasAccess ? (
        <AccessDeniedNotice section="the Talent Pool" />
      ) : (
        <>
          <div className="flex items-center gap-1 p-1 rounded-control bg-elevated border border-border-subtle w-fit">
            {(["assessments", "candidates"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-4 py-1.5 rounded-control text-xs font-bold transition-colors capitalize",
                  tab === t ? "bg-accent-primary text-white shadow-subtle" : "text-text-muted hover:text-primary"
                )}
              >
                {t === "assessments" ? "Assessments" : "Candidate Pool"}
              </button>
            ))}
          </div>

          {tab === "assessments" ? <AssessmentsTab onToast={triggerToast} /> : <CandidatesTab onToast={triggerToast} />}
        </>
      )}
    </DashboardShell>
  );
}

function AssessmentsTab({ onToast }: { onToast: (msg: string) => void }) {
  const [contests, setContests] = useState<TalentPoolContest[]>([]);
  const [interviews, setInterviews] = useState<TalentPoolInterviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateContest, setShowCreateContest] = useState(false);
  const [showCreateInterview, setShowCreateInterview] = useState(false);
  const [managingContest, setManagingContest] = useState<TalentPoolContest | null>(null);
  const [managingInterview, setManagingInterview] = useState<TalentPoolInterviewItem | null>(null);
  const [collegesById, setCollegesById] = useState<Record<number, CollegeOption>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [contestsRes, interviewsRes, collegesRes] = await Promise.all([
        api.get<{ contests: TalentPoolContest[] }>("/admin/contests"),
        api.get<{ interviews: TalentPoolInterviewItem[] }>("/admin/interviews"),
        api.get<{ colleges: CollegeOption[] }>("/admin/talent-pool/colleges"),
      ]);
      setContests((contestsRes.contests as any[]).filter((c) => c.contest_type === "talent_pool"));
      setInterviews((interviewsRes.interviews as any[]).filter((i) => i.interview_type === "talent_pool"));
      const map: Record<number, CollegeOption> = {};
      collegesRes.colleges.forEach((c) => (map[c.id] = c));
      setCollegesById(map);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load Talent Pool assessments.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePublishContest = async (c: TalentPoolContest) => {
    try {
      await api.post(`/admin/contests/${c.slug}`, { status: "published" });
      onToast(`"${c.title}" is now published.`);
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to publish.");
    }
  };

  const handleFinalizeContest = async (c: TalentPoolContest) => {
    try {
      const res = await api.post<{ finalized?: boolean; already_finalized?: boolean; participants_ranked?: number }>(
        `/admin/contests/${c.slug}/finalize`
      );
      onToast(
        res.already_finalized
          ? "Already finalized."
          : `Finalized — ${res.participants_ranked} ranked. Qualifying candidates (≥ threshold) were added to the Talent Pool.`
      );
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to finalize.");
    }
  };

  const handlePublishInterview = async (i: TalentPoolInterviewItem) => {
    try {
      await api.post(`/admin/interviews/${i.slug}`, { status: "published" });
      onToast(`"${i.title}" is now published.`);
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to publish.");
    }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Swords className="w-4 h-4 text-accent-primary" />
            Coding Tests
          </h2>
          <button
            onClick={() => setShowCreateContest(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary/90 text-white text-2xs font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Coding Test
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : contests.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
            No Talent Pool coding tests yet.
          </div>
        ) : (
          <div className="space-y-3">
            {contests.map((c) => {
              const hasEnded = new Date(c.end_at) < new Date();
              return (
                <div key={c.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-primary">{c.title}</span>
                      <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded", c.status === "published" ? "bg-status-success/15 text-status-success" : c.status === "draft" ? "bg-elevated text-text-muted" : "bg-status-danger/15 text-status-danger")}>
                        {c.status}
                      </span>
                      {c.finalized_at && (
                        <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-status-success/15 text-status-success flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Finalized
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-accent-secondary/15 text-accent-secondary">
                        {c.audience_scope ? AUDIENCE_LABEL[c.audience_scope] : "All Users"}
                      </span>
                    </div>
                    <div className="text-2xs text-text-muted mt-1">
                      Qualify at <strong className="text-primary">{c.qualifying_score_percent ?? 90}%</strong> ·{" "}
                      {new Date(c.start_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      {" – "}
                      {new Date(c.end_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit" })} · {c.participants_count} participant(s)
                      {c.audience_scope === "college" && c.college_ids && (
                        <>
                          {" · "}
                          {c.college_ids.length === 0
                            ? "no colleges selected yet"
                            : c.college_ids.map((id) => collegesById[id]?.short_code ?? id).join(", ")}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setManagingContest(c)} className="px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors">
                      Manage Problems
                    </button>
                    {c.status === "draft" && (
                      <button onClick={() => handlePublishContest(c)} className="px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary/90 text-white text-2xs font-bold transition-colors">
                        Publish
                      </button>
                    )}
                    {c.status === "published" && hasEnded && !c.finalized_at && (
                      <button onClick={() => handleFinalizeContest(c)} className="px-3 py-1.5 rounded-control bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 text-2xs font-bold text-status-success transition-colors">
                        Finalize &amp; Qualify
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-primary flex items-center gap-2">
            <Mic className="w-4 h-4 text-accent-primary" />
            Interviews <span className="text-3xs font-normal text-text-muted normal-case">(optional second stage)</span>
          </h2>
          <button
            onClick={() => setShowCreateInterview(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Interview
          </button>
        </div>

        {!loading && interviews.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
            No Talent Pool interviews yet — optional; only the coding test score gates Talent Pool membership.
          </div>
        ) : (
          <div className="space-y-3">
            {interviews.map((i) => (
              <div key={i.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-primary">{i.title}</span>
                    <span className={cn("px-1.5 py-0.5 text-3xs font-bold uppercase rounded", i.status === "published" ? "bg-status-success/15 text-status-success" : i.status === "draft" ? "bg-elevated text-text-muted" : "bg-status-danger/15 text-status-danger")}>
                      {i.status}
                    </span>
                    <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-accent-secondary/15 text-accent-secondary">
                      {i.audience_scope ? AUDIENCE_LABEL[i.audience_scope] : "All Users"}
                    </span>
                  </div>
                  <div className="text-2xs text-text-muted mt-1">{i.sessions_count} session(s)</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setManagingInterview(i)} className="px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors">
                    Manage Questions
                  </button>
                  {i.status === "draft" && (
                    <button onClick={() => handlePublishInterview(i)} className="px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary/90 text-white text-2xs font-bold transition-colors">
                      Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showCreateContest && (
        <CreateContestModal colleges={Object.values(collegesById)} onClose={() => setShowCreateContest(false)} onCreated={() => { setShowCreateContest(false); load(); }} />
      )}
      {showCreateInterview && (
        <CreateInterviewModal colleges={Object.values(collegesById)} onClose={() => setShowCreateInterview(false)} onCreated={() => { setShowCreateInterview(false); load(); }} />
      )}
      {managingContest && (
        <ManageContestProblemsModal contest={managingContest} onClose={() => setManagingContest(null)} onToast={onToast} />
      )}
      {managingInterview && (
        <ManageInterviewQuestionsModal interview={managingInterview} onClose={() => setManagingInterview(null)} onToast={onToast} />
      )}
    </div>
  );
}

function CreateContestModal({ colleges, onClose, onCreated }: { colleges: CollegeOption[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [audienceScope, setAudienceScope] = useState<AudienceScope>("all");
  const [collegeIds, setCollegeIds] = useState<number[]>([]);
  const [threshold, setThreshold] = useState("90");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCollege = (id: number) => {
    setCollegeIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/admin/contests", {
        title,
        description: description || undefined,
        start_at: localDatetimeInputToUtcIso(startAt),
        end_at: localDatetimeInputToUtcIso(endAt),
        contest_type: "talent_pool",
        audience_scope: audienceScope,
        college_ids: audienceScope === "college" ? collegeIds : undefined,
        qualifying_score_percent: Number(threshold) || 90,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create coding test.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="New Talent Pool Coding Test"
      icon={Swords}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
            Cancel
          </button>
          <button type="submit" form="create-talent-pool-contest-form" disabled={saving || (audienceScope === "college" && collegeIds.length === 0)} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary/90 text-white font-bold transition-colors disabled:opacity-60">
            {saving ? "Creating..." : "Create Draft"}
          </button>
        </>
      }
    >
      <form id="create-talent-pool-contest-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Title *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q4 Talent Pool Screening" className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary" />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Description</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Start *</label>
              <input required type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary" />
            </div>
            <div>
              <label className="block font-semibold text-text-secondary mb-1">End *</label>
              <input required type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary" />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Qualifying Score (%) *</label>
            <input required type="number" min={1} max={100} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-28 px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary" />
            <p className="text-[10.5px] text-text-muted mt-1">A participant scoring at or above this on finalize is added to the Talent Pool.</p>
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Audience *</label>
            <div className="grid grid-cols-3 gap-2">
              {(["all", "college", "direct"] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setAudienceScope(scope)}
                  className={cn(
                    "px-2 py-2 rounded-control border text-2xs font-bold transition-colors",
                    audienceScope === scope ? "bg-accent-primary text-white border-accent-primary" : "bg-elevated border-border-subtle text-text-secondary hover:text-primary"
                  )}
                >
                  {AUDIENCE_LABEL[scope]}
                </button>
              ))}
            </div>
          </div>
          {audienceScope === "college" && (
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Colleges *</label>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-control bg-elevated border border-border-subtle">
                {colleges.length === 0 ? (
                  <p className="text-[10.5px] text-text-muted py-2 text-center">No colleges found.</p>
                ) : (
                  colleges.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-surface-hover cursor-pointer">
                      <input type="checkbox" checked={collegeIds.includes(c.id)} onChange={() => toggleCollege(c.id)} className="accent-accent-primary" />
                      <span className="text-primary">{c.name}</span>
                      <span className="text-text-muted">({c.short_code})</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {error && <p className="text-2xs text-status-danger">{error}</p>}
      </form>
    </Modal>
  );
}

function CreateInterviewModal({ colleges, onClose, onCreated }: { colleges: CollegeOption[]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audienceScope, setAudienceScope] = useState<AudienceScope>("all");
  const [collegeIds, setCollegeIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCollege = (id: number) => {
    setCollegeIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/admin/interviews", {
        title,
        description: description || undefined,
        interview_type: "talent_pool",
        audience_scope: audienceScope,
        college_ids: audienceScope === "college" ? collegeIds : undefined,
      });
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
      title="New Talent Pool Interview"
      icon={Mic}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
            Cancel
          </button>
          <button type="submit" form="create-talent-pool-interview-form" disabled={saving || (audienceScope === "college" && collegeIds.length === 0)} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary/90 text-white font-bold transition-colors disabled:opacity-60">
            {saving ? "Creating..." : "Create Draft"}
          </button>
        </>
      }
    >
      <form id="create-talent-pool-interview-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Title *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary" />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Description</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary" />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Audience *</label>
            <div className="grid grid-cols-3 gap-2">
              {(["all", "college", "direct"] as const).map((scope) => (
                <button key={scope} type="button" onClick={() => setAudienceScope(scope)} className={cn("px-2 py-2 rounded-control border text-2xs font-bold transition-colors", audienceScope === scope ? "bg-accent-primary text-white border-accent-primary" : "bg-elevated border-border-subtle text-text-secondary hover:text-primary")}>
                  {AUDIENCE_LABEL[scope]}
                </button>
              ))}
            </div>
          </div>
          {audienceScope === "college" && (
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Colleges *</label>
              <div className="max-h-40 overflow-y-auto space-y-1 p-2 rounded-control bg-elevated border border-border-subtle">
                {colleges.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-surface-hover cursor-pointer">
                    <input type="checkbox" checked={collegeIds.includes(c.id)} onChange={() => toggleCollege(c.id)} className="accent-accent-primary" />
                    <span className="text-primary">{c.name}</span>
                    <span className="text-text-muted">({c.short_code})</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-2xs text-status-danger">{error}</p>}
      </form>
    </Modal>
  );
}

function ManageContestProblemsModal({ contest, onClose, onToast }: { contest: TalentPoolContest; onClose: () => void; onToast: (msg: string) => void }) {
  const [problems, setProblems] = useState<TalentPoolContestProblem[]>([]);
  const [catalog, setCatalog] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pointsInput, setPointsInput] = useState("100");
  const [addingId, setAddingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [problemsRes, catalogRes] = await Promise.all([
        api.get<{ problems: TalentPoolContestProblem[] }>(`/admin/contests/${contest.slug}/problems`),
        api.get<{ problems: ProblemSummary[] }>("/problems"),
      ]);
      setProblems(problemsRes.problems);
      setCatalog(catalogRes.problems);
    } catch {
      onToast("Failed to load problems.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contest.slug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (problemId: number) => {
    setAddingId(problemId);
    try {
      await api.post(`/admin/contests/${contest.slug}/problems`, { problem_id: problemId, points: Number(pointsInput) || 100 });
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to add problem.");
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (contestProblemId: number) => {
    try {
      await api.delete(`/admin/contests/${contest.slug}/problems/${contestProblemId}`);
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to remove problem.");
    }
  };

  const availableProblems = useMemo(() => {
    const notAdded = catalog.filter((p) => !problems.some((cp) => cp.problem.id === p.id));
    const query = search.trim().toLowerCase();
    if (!query) return notAdded;
    return notAdded.filter((p) => p.title.toLowerCase().includes(query));
  }, [catalog, problems, search]);

  return (
    <Modal onClose={onClose} title={`Problems — ${contest.title}`} size="2xl" bodyClassName="px-6 py-5 text-xs space-y-4">
        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {problems.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">No problems added yet.</p>
              ) : (
                problems.map((cp) => (
                  <div key={cp.id} className="flex items-center justify-between gap-3 p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("px-1.5 py-0.5 text-3xs font-bold rounded capitalize", cp.problem.difficulty === "easy" ? "bg-status-success/15 text-status-success" : cp.problem.difficulty === "medium" ? "bg-status-warning/15 text-status-warning" : "bg-status-danger/15 text-status-danger")}>
                        {cp.problem.difficulty}
                      </span>
                      <span className="font-semibold text-primary truncate">{cp.problem.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-accent-primary">{cp.points} pts</span>
                      <button onClick={() => handleRemove(cp.id)} className="text-text-muted hover:text-status-danger transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-border-subtle space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search problems..." className="w-full pl-8 pr-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary" />
                </div>
                <input type="number" value={pointsInput} onChange={(e) => setPointsInput(e.target.value)} className="w-20 px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary" placeholder="Points" />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {availableProblems.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-2.5 rounded-control bg-elevated/60 border border-border-subtle text-xs">
                    <span className="text-primary truncate">{p.title}</span>
                    <button onClick={() => handleAdd(p.id)} disabled={addingId === p.id} className="px-2.5 py-1 rounded-control bg-accent-primary/10 text-accent-primary hover:bg-accent-primary hover:text-white text-[10.5px] font-bold transition-colors disabled:opacity-50 shrink-0">
                      {addingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
    </Modal>
  );
}

function ManageInterviewQuestionsModal({ interview, onClose, onToast }: { interview: TalentPoolInterviewItem; onClose: () => void; onToast: (msg: string) => void }) {
  const [questions, setQuestions] = useState<InterviewQuestionRow[]>([]);
  const [bank, setBank] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [qRes, bankRes] = await Promise.all([
        api.get<{ questions: InterviewQuestionRow[] }>(`/admin/interviews/${interview.slug}/questions`),
        api.get<{ questions: QuestionBankItem[] }>("/interview-question-bank/browse"),
      ]);
      setQuestions(qRes.questions);
      setBank(bankRes.questions);
    } catch {
      onToast("Failed to load questions.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.slug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (bankId: number) => {
    setAddingId(bankId);
    try {
      await api.post(`/admin/interviews/${interview.slug}/questions`, { interview_question_bank_id: bankId });
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to add question.");
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      await api.delete(`/admin/interviews/${interview.slug}/questions/${id}`);
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to remove question.");
    }
  };

  const available = useMemo(() => bank.filter((b) => !questions.some((q) => q.question_bank.id === b.id)), [bank, questions]);

  return (
    <Modal onClose={onClose} title={`Questions — ${interview.title}`} size="2xl" bodyClassName="px-6 py-5 text-xs space-y-4">
        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {questions.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-4">No questions added yet.</p>
              ) : (
                questions.map((q) => (
                  <div key={q.id} className="flex items-center justify-between gap-3 p-3 rounded-control bg-elevated/60 border border-border-subtle text-xs">
                    <span className="text-primary truncate">{q.question_bank.question_text}</span>
                    <button onClick={() => handleRemove(q.id)} className="text-text-muted hover:text-status-danger transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="pt-3 border-t border-border-subtle space-y-2 max-h-64 overflow-y-auto">
              {available.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 p-2.5 rounded-control bg-elevated/60 border border-border-subtle text-xs">
                  <span className="text-primary truncate">{b.question_text}</span>
                  <button onClick={() => handleAdd(b.id)} disabled={addingId === b.id} className="px-2.5 py-1 rounded-control bg-accent-primary/10 text-accent-primary hover:bg-accent-primary hover:text-white text-[10.5px] font-bold transition-colors disabled:opacity-50 shrink-0">
                    {addingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
    </Modal>
  );
}

function CandidatesTab({ onToast }: { onToast: (msg: string) => void }) {
  const [result, setResult] = useState<PaginatedCandidates | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (visibilityFilter) params.set("visibility_status", visibilityFilter);
      params.set("page", String(page));
      const res = await api.get<{ candidates: PaginatedCandidates }>(`/admin/talent-pool/candidates?${params.toString()}`);
      setResult(res.candidates);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load candidates.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, visibilityFilter, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleToggleVisibility = async (row: TalentPoolCandidateRow) => {
    const action = row.visibility_status === "hidden_by_mellow" ? "unhide" : "hide";
    try {
      await api.post(`/admin/talent-pool/candidates/${row.id}/visibility`, { action });
      onToast(action === "hide" ? "Candidate hidden from hiring partners." : "Candidate unhidden.");
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to update visibility.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search by name or email..." className="w-full pl-8 pr-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary" />
        </div>
        <select value={visibilityFilter} onChange={(e) => { setPage(1); setVisibilityFilter(e.target.value); }} className="px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary">
          <option value="">All Statuses</option>
          {Object.entries(VISIBILITY_LABEL).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-8 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading...
        </div>
      ) : !result || result.data.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No candidates match this filter yet.
        </div>
      ) : (
        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-elevated/60 text-text-muted uppercase text-3xs font-bold">
              <tr>
                <th className="text-left px-4 py-2.5">Candidate</th>
                <th className="text-left px-4 py-2.5">College</th>
                <th className="text-left px-4 py-2.5">Score</th>
                <th className="text-left px-4 py-2.5">Source</th>
                <th className="text-left px-4 py-2.5">Visibility</th>
                <th className="text-left px-4 py-2.5">Interest</th>
                <th className="text-right px-4 py-2.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {result.data.map((row) => (
                <tr key={row.id} className="hover:bg-surface-hover/50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-primary">{row.user?.name ?? "—"}</div>
                    <div className="text-text-muted text-[10.5px]">{row.user?.email}</div>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{row.user?.college?.name ?? "Mellow Direct"}</td>
                  <td className="px-4 py-3 font-mono font-bold text-accent-primary">{row.score_percent}%</td>
                  <td className="px-4 py-3 text-text-secondary truncate max-w-[160px]">{row.source_contest?.title ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("px-1.5 py-0.5 text-3xs font-bold rounded", VISIBILITY_BADGE[row.visibility_status] ?? "bg-elevated text-text-muted")}>
                      {VISIBILITY_LABEL[row.visibility_status] ?? row.visibility_status}
                    </span>
                    {row.hired_by_company && <div className="text-3xs text-text-muted mt-0.5">by {row.hired_by_company.name}</div>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    <span className="flex items-center gap-1"><Users2 className="w-3 h-3" />{row.inquiries_count}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.visibility_status !== "hired" && (row.visibility_status === "visible" || row.visibility_status === "pending_consent" || row.visibility_status === "hidden_by_mellow") && (
                      <button
                        onClick={() => handleToggleVisibility(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[10.5px] font-bold text-text-secondary hover:text-primary transition-colors"
                      >
                        {row.visibility_status === "hidden_by_mellow" ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {row.visibility_status === "hidden_by_mellow" ? "Unhide" : "Hide"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && result.last_page > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-control border border-border-subtle text-xs text-text-secondary disabled:opacity-40">
            Prev
          </button>
          <span className="text-xs text-text-muted">Page {result.current_page} of {result.last_page}</span>
          <button disabled={page >= result.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-control border border-border-subtle text-xs text-text-secondary disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
