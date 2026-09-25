"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  Search,
  Loader2,
  X,
  GraduationCap,
  Star,
  CheckCircle2,
  CalendarClock,
  Briefcase,
  Send,
  Video,
  MapPin,
  Linkedin,
  Github,
  FileText,
  Download,
  Gauge,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";

interface CollegeOption {
  id: number;
  name: string;
  short_code: string;
}

/** The recruiter-facing profile fields — see StudentProfileController/User::computeProfileCompletion() on the backend. Shared shape between the browse card and the detail view. */
interface RecruiterProfileFields {
  bio: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  skills: string[] | null;
  has_resume: boolean;
  profile_completion_percent: number;
}

interface TalentPoolCandidateCard {
  id: number;
  score_percent: string;
  qualified_at: string;
  my_inquiry_status: string | null;
  user:
    | ({
        id: number;
        name: string;
        branch: string | null;
        cgpa: string | null;
        current_rating: number;
        rated_contests_count: number;
        college: { id: number; name: string; short_code: string } | null;
      } & RecruiterProfileFields)
    | null;
}

interface TalentPoolCandidateDetail {
  id: number;
  score_percent: string;
  qualified_at: string;
  my_inquiry_status: string | null;
  source_contest: { id: number; title: string; slug: string; start_at: string } | null;
  user:
    | ({
        id: number;
        name: string;
        branch: string | null;
        cgpa: string | null;
        backlogs: number | null;
        current_rating: number;
        rated_contests_count: number;
        college: { id: number; name: string; short_code: string; city: string | null; state: string | null } | null;
      } & RecruiterProfileFields)
    | null;
}

interface InquiryMessage {
  id: number;
  message: string;
  created_at: string;
  sender: { id: number; name: string } | null;
}

interface Inquiry {
  id: number;
  status: string;
  interview_scheduled_at: string | null;
  interview_mode: string | null;
  interview_location: string | null;
  interview_notes: string | null;
  ctc_offered: string | null;
  messages?: InquiryMessage[];
}

interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

const STATUS_LABEL: Record<string, string> = {
  interested: "Interested",
  interview_scheduled: "HR Interview Scheduled",
  interview_completed: "Interview Completed",
  hired: "Hired",
  declined_by_company: "Declined by You",
  declined_by_candidate: "Declined by Candidate",
  withdrawn: "Withdrawn",
};

const STATUS_BADGE: Record<string, string> = {
  interested: "bg-accent-secondary/15 text-accent-secondary",
  interview_scheduled: "bg-status-warning/15 text-status-warning",
  interview_completed: "bg-sky-500/15 text-sky-400",
  hired: "bg-status-success/15 text-status-success",
  declined_by_company: "bg-elevated text-text-muted",
  declined_by_candidate: "bg-status-danger/15 text-status-danger",
  withdrawn: "bg-elevated text-text-muted",
};

/**
 * A hiring partner's window into the shared Talent Pool — candidates Mellow
 * itself already tested and scored, independent of any job opening this
 * company created. Browse → View Profile → Express Interest / Schedule HR
 * Interview / Hire / Send a Message, all mediated by the platform (never a
 * raw candidate email/phone in any response here — see
 * CompanyTalentPoolController's docblock on the backend).
 */
export default function CompanyTalentPoolPage() {
  const { status } = useAuthGuard(["admin_company"]);
  const [tab, setTab] = useState<"browse" | "engagements">("browse");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [viewingCandidateId, setViewingCandidateId] = useState<number | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="admin_company"
      title="Talent Pool"
      subtitle="Candidates Mellow already tested and scored — browse, express interest, schedule an HR interview, or hire directly."
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-teal-500/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      <div className="flex items-center gap-1 p-1 rounded-control bg-elevated border border-border-subtle w-fit">
        {(["browse", "engagements"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn("px-4 py-1.5 rounded-control text-xs font-bold transition-colors", tab === t ? "bg-teal-500 text-white shadow-subtle" : "text-text-muted hover:text-primary")}
          >
            {t === "browse" ? "Browse Candidates" : "My Engagements"}
          </button>
        ))}
      </div>

      {tab === "browse" ? (
        <BrowseTab onToast={triggerToast} onView={(id) => setViewingCandidateId(id)} />
      ) : (
        <EngagementsTab onView={(id) => setViewingCandidateId(id)} />
      )}

      {viewingCandidateId !== null && (
        <CandidateProfileModal
          candidateId={viewingCandidateId}
          onClose={() => setViewingCandidateId(null)}
          onToast={triggerToast}
        />
      )}
    </DashboardShell>
  );
}

function BrowseTab({ onToast, onView }: { onToast: (msg: string) => void; onView: (id: number) => void }) {
  const [result, setResult] = useState<Paginated<TalentPoolCandidateCard> | null>(null);
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<{ colleges: CollegeOption[] }>("/company/colleges").then((res) => setColleges(res.colleges)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (minScore) params.set("min_score", minScore);
      if (collegeId) params.set("college_id", collegeId);
      params.set("page", String(page));
      const res = await api.get<{ candidates: Paginated<TalentPoolCandidateCard> }>(`/company/talent-pool?${params.toString()}`);
      setResult(res.candidates);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load the Talent Pool.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, minScore, collegeId, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search by name or skill..." className="w-full pl-8 pr-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-teal-500" />
        </div>
        <input type="number" min={1} max={100} value={minScore} onChange={(e) => { setPage(1); setMinScore(e.target.value); }} placeholder="Min score %" className="w-28 px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-teal-500" />
        <select value={collegeId} onChange={(e) => { setPage(1); setCollegeId(e.target.value); }} className="px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-teal-500">
          <option value="">All Colleges</option>
          {colleges.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading candidates...
        </div>
      ) : !result || result.data.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No candidates match these filters yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {result.data.map((c) => (
            <button key={c.id} onClick={() => onView(c.id)} className="text-left p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle hover:border-teal-500/50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-primary truncate">{c.user?.name ?? "Candidate"}</div>
                  <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" />
                    {c.user?.college?.name ?? "Mellow Direct"}
                  </div>
                </div>
                <span className="px-2 py-1 rounded-control bg-status-success/15 text-status-success text-[11px] font-bold shrink-0">{c.score_percent}%</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-[10.5px] text-text-muted flex-wrap">
                {c.user?.branch && <span className="px-1.5 py-0.5 rounded bg-elevated">{c.user.branch}</span>}
                {c.user && c.user.rated_contests_count > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-elevated flex items-center gap-1">
                    <Star className="w-2.5 h-2.5" />
                    {c.user.current_rating}
                  </span>
                )}
                {c.user && c.user.profile_completion_percent > 0 && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded flex items-center gap-1 font-bold",
                      c.user.profile_completion_percent >= 100
                        ? "bg-status-success/15 text-status-success"
                        : "bg-elevated text-text-muted"
                    )}
                  >
                    <Gauge className="w-2.5 h-2.5" />
                    {c.user.profile_completion_percent}%
                  </span>
                )}
              </div>
              {c.user?.skills && c.user.skills.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                  {c.user.skills.slice(0, 3).map((skill) => (
                    <span key={skill} className="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 text-[10px] font-semibold">
                      {skill}
                    </span>
                  ))}
                  {c.user.skills.length > 3 && (
                    <span className="text-[10px] text-text-muted">+{c.user.skills.length - 3} more</span>
                  )}
                </div>
              )}
              {c.my_inquiry_status && (
                <div className={cn("mt-3 px-2 py-1 rounded text-[10px] font-bold w-fit", STATUS_BADGE[c.my_inquiry_status] ?? "bg-elevated text-text-muted")}>
                  {STATUS_LABEL[c.my_inquiry_status] ?? c.my_inquiry_status}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {result && result.last_page > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-control border border-border-subtle text-xs text-text-secondary disabled:opacity-40">Prev</button>
          <span className="text-xs text-text-muted">Page {result.current_page} of {result.last_page}</span>
          <button disabled={page >= result.last_page} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-control border border-border-subtle text-xs text-text-secondary disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}

function EngagementsTab({ onView }: { onView: (id: number) => void }) {
  const [inquiries, setInquiries] = useState<(Inquiry & { candidate: TalentPoolCandidateCard })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ inquiries: (Inquiry & { candidate: TalentPoolCandidateCard })[] }>("/company/talent-pool/inquiries")
      .then((res) => setInquiries(res.inquiries))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (inquiries.length === 0) {
    return (
      <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
        No engagements yet — express interest in a candidate from the Browse tab to start one.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inquiries.map((inq) => (
        <button key={inq.id} onClick={() => onView(inq.candidate.id)} className="w-full text-left p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap hover:border-teal-500/40 transition-colors">
          <div className="min-w-0">
            <div className="text-sm font-bold text-primary">{inq.candidate.user?.name ?? "Candidate"}</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {inq.candidate.user?.college?.name ?? "Mellow Direct"} · {inq.candidate.score_percent}%
              {inq.interview_scheduled_at && (
                <> · HR interview {new Date(inq.interview_scheduled_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</>
              )}
            </div>
          </div>
          <span className={cn("px-2 py-1 rounded-control text-[11px] font-bold shrink-0", STATUS_BADGE[inq.status] ?? "bg-elevated text-text-muted")}>
            {STATUS_LABEL[inq.status] ?? inq.status}
          </span>
        </button>
      ))}
    </div>
  );
}

function CandidateProfileModal({ candidateId, onClose, onToast }: { candidateId: number; onClose: () => void; onToast: (msg: string) => void }) {
  const [detail, setDetail] = useState<{ candidate: TalentPoolCandidateDetail; readiness_score: number | null; display_rating: string | null; inquiry: Inquiry | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [showHireForm, setShowHireForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<typeof detail>(`/company/talent-pool/${candidateId}`);
      setDetail(res);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load candidate profile.");
      onClose();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInterest = async () => {
    setBusy(true);
    try {
      await api.post(`/company/talent-pool/${candidateId}/interest`);
      onToast("Marked interest — the candidate has been notified.");
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to express interest.");
    } finally {
      setBusy(false);
    }
  };

  const handleResumeDownload = async () => {
    setDownloadingResume(true);
    try {
      const blob = await api.getFile(`/company/talent-pool/${candidateId}/resume`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${detail?.candidate.user?.name ?? "candidate"}-resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to download resume.");
    } finally {
      setDownloadingResume(false);
    }
  };

  const inquiry = detail?.inquiry;
  const isTerminal = inquiry && ["hired", "declined_by_company", "declined_by_candidate", "withdrawn"].includes(inquiry.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-primary flex items-center gap-2">
            <Award className="w-4 h-4 text-teal-500" />
            Talent Pool Profile
          </h3>
          <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !detail ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-primary">{detail.candidate.user?.name}</div>
                  <div className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {detail.candidate.user?.college?.name ?? "Mellow Direct (no college)"}
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-control bg-status-success/15 text-status-success text-sm font-extrabold shrink-0">{detail.candidate.score_percent}%</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="text-text-muted text-[10px] uppercase font-bold">Branch</div>
                  <div className="text-primary font-semibold mt-0.5">{detail.candidate.user?.branch ?? "—"}</div>
                </div>
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="text-text-muted text-[10px] uppercase font-bold">CGPA</div>
                  <div className="text-primary font-semibold mt-0.5">{detail.candidate.user?.cgpa ?? "—"}</div>
                </div>
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="text-text-muted text-[10px] uppercase font-bold">Platform Rating</div>
                  <div className="text-primary font-semibold mt-0.5">{detail.display_rating ?? "Unrated"}</div>
                </div>
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="text-text-muted text-[10px] uppercase font-bold">Readiness Score</div>
                  <div className="text-primary font-semibold mt-0.5">{detail.readiness_score ?? "—"}/100</div>
                </div>
              </div>

              {(detail.candidate.user?.bio || detail.candidate.user?.linkedin_url || detail.candidate.user?.github_url || (detail.candidate.user?.skills?.length ?? 0) > 0 || detail.candidate.user?.has_resume) && (
                <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-text-muted">Recruiter Profile</span>
                    {detail.candidate.user && detail.candidate.user.profile_completion_percent > 0 && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-bold",
                          detail.candidate.user.profile_completion_percent >= 100
                            ? "bg-status-success/15 text-status-success"
                            : "bg-teal-500/15 text-teal-600"
                        )}
                      >
                        {detail.candidate.user.profile_completion_percent}% complete
                      </span>
                    )}
                  </div>

                  {detail.candidate.user?.bio && <p className="text-xs text-text-secondary leading-relaxed">{detail.candidate.user.bio}</p>}

                  {detail.candidate.user?.skills && detail.candidate.user.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {detail.candidate.user.skills.map((skill) => (
                        <span key={skill} className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 text-[10.5px] font-semibold">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {detail.candidate.user?.linkedin_url && (
                      <a
                        href={detail.candidate.user.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-control bg-surface hover:bg-elevated border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors"
                      >
                        <Linkedin className="w-3.5 h-3.5" />
                        LinkedIn
                      </a>
                    )}
                    {detail.candidate.user?.github_url && (
                      <a
                        href={detail.candidate.user.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-control bg-surface hover:bg-elevated border border-border-subtle text-[11px] font-semibold text-text-secondary hover:text-primary transition-colors"
                      >
                        <Github className="w-3.5 h-3.5" />
                        GitHub
                      </a>
                    )}
                    {detail.candidate.user?.has_resume && (
                      <button
                        onClick={handleResumeDownload}
                        disabled={downloadingResume}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-control bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/25 text-[11px] font-bold text-teal-600 transition-colors disabled:opacity-50"
                      >
                        {downloadingResume ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                        {downloadingResume ? "Downloading..." : "Resume"}
                        {!downloadingResume && <Download className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-text-muted">
                Qualified via &quot;{detail.candidate.source_contest?.title ?? "a Mellow assessment"}&quot; on{" "}
                {new Date(detail.candidate.qualified_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.
                Contact details are never shared directly — every action below notifies the candidate through Mellow.
              </p>
            </div>

            {inquiry && (
              <div className="p-3 rounded-control bg-elevated/60 border border-border-subtle space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-text-secondary">Your Engagement</span>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", STATUS_BADGE[inquiry.status] ?? "bg-elevated text-text-muted")}>
                    {STATUS_LABEL[inquiry.status] ?? inquiry.status}
                  </span>
                </div>
                {inquiry.interview_scheduled_at && (
                  <div className="text-[11px] text-text-muted flex items-center gap-1.5">
                    <CalendarClock className="w-3 h-3" />
                    {new Date(inquiry.interview_scheduled_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {inquiry.interview_mode} · {inquiry.interview_location}
                  </div>
                )}
                {inquiry.ctc_offered && (
                  <div className="text-[11px] text-text-muted">Offered CTC: ₹{Number(inquiry.ctc_offered).toLocaleString("en-IN")}</div>
                )}
                {inquiry.messages && inquiry.messages.length > 0 && (
                  <div className="pt-1.5 mt-1.5 border-t border-border-subtle space-y-1.5">
                    {inquiry.messages.map((m) => (
                      <div key={m.id} className="text-[10.5px] text-text-muted">
                        <span className="font-semibold text-text-secondary">{m.sender?.name ?? "You"}:</span> {m.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!isTerminal && (
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border-subtle">
                {!inquiry && (
                  <button onClick={handleInterest} disabled={busy} className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-[11px] font-bold transition-colors disabled:opacity-60">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Express Interest
                  </button>
                )}
                <button onClick={() => setShowInterviewForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Schedule HR Interview
                </button>
                <button onClick={() => setShowHireForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 text-[11px] font-bold text-status-success transition-colors">
                  <Briefcase className="w-3.5 h-3.5" />
                  Hire
                </button>
                <button onClick={() => setShowMessageForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors">
                  <Send className="w-3.5 h-3.5" />
                  Send Message
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showInterviewForm && (
        <ScheduleInterviewForm candidateId={candidateId} onClose={() => setShowInterviewForm(false)} onDone={(msg) => { onToast(msg); setShowInterviewForm(false); load(); }} />
      )}
      {showHireForm && (
        <HireForm candidateId={candidateId} onClose={() => setShowHireForm(false)} onDone={(msg) => { onToast(msg); setShowHireForm(false); load(); }} />
      )}
      {showMessageForm && (
        <MessageForm candidateId={candidateId} onClose={() => setShowMessageForm(false)} onDone={(msg) => { onToast(msg); setShowMessageForm(false); load(); }} />
      )}
    </div>
  );
}

function ScheduleInterviewForm({ candidateId, onClose, onDone }: { candidateId: number; onClose: () => void; onDone: (msg: string) => void }) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/company/talent-pool/${candidateId}/interview`, {
        scheduled_at: localDatetimeInputToUtcIso(scheduledAt),
        mode,
        location,
        notes: notes || undefined,
      });
      onDone("HR interview scheduled — the candidate has been notified.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule the interview.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-sm font-bold text-primary">Schedule HR Interview</h3>
          <button onClick={onClose} disabled={saving} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">When *</label>
            <input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Mode *</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode("online")} className={cn("flex items-center justify-center gap-1.5 px-3 py-2 rounded-control border text-[11px] font-bold transition-colors", mode === "online" ? "bg-teal-500 text-white border-teal-500" : "bg-elevated border-border-subtle text-text-secondary")}>
                <Video className="w-3.5 h-3.5" /> Online
              </button>
              <button type="button" onClick={() => setMode("offline")} className={cn("flex items-center justify-center gap-1.5 px-3 py-2 rounded-control border text-[11px] font-bold transition-colors", mode === "offline" ? "bg-teal-500 text-white border-teal-500" : "bg-elevated border-border-subtle text-text-secondary")}>
                <MapPin className="w-3.5 h-3.5" /> In Person
              </button>
            </div>
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">{mode === "online" ? "Meeting Link *" : "Location *"}</label>
            <input required value={location} onChange={(e) => setLocation(e.target.value)} placeholder={mode === "online" ? "https://meet.example.com/..." : "Office address"} className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Note</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500" />
          </div>
          {error && <p className="text-[11px] text-status-danger">{error}</p>}
          <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white font-bold transition-colors disabled:opacity-60">{saving ? "Scheduling..." : "Schedule"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HireForm({ candidateId, onClose, onDone }: { candidateId: number; onClose: () => void; onDone: (msg: string) => void }) {
  const [ctc, setCtc] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/company/talent-pool/${candidateId}/hire`, { ctc_offered: ctc ? Number(ctc) : undefined, notes: notes || undefined });
      onDone("Candidate hired — they've been notified and removed from other partners' search.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to hire this candidate.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-sm font-bold text-primary">Hire This Candidate</h3>
          <button onClick={onClose} disabled={saving} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-[11px] text-text-muted">This is final — the candidate is notified immediately and removed from every other partner&apos;s Talent Pool search.</p>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">CTC Offered (₹/year)</label>
            <input type="number" min={0} value={ctc} onChange={(e) => setCtc(e.target.value)} placeholder="e.g. 1200000" className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500" />
          </div>
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Note</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500" />
          </div>
          {error && <p className="text-[11px] text-status-danger">{error}</p>}
          <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-control bg-status-success hover:bg-status-success/90 text-white font-bold transition-colors disabled:opacity-60">{saving ? "Hiring..." : "Confirm Hire"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageForm({ candidateId, onClose, onDone }: { candidateId: number; onClose: () => void; onDone: (msg: string) => void }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/company/talent-pool/${candidateId}/notify`, { message });
      onDone("Message sent via email.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-sm font-bold text-primary">Send a Message</h3>
          <button onClick={onClose} disabled={saving} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <textarea required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write your message to the candidate..." className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500" />
          {error && <p className="text-[11px] text-status-danger">{error}</p>}
          <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white font-bold transition-colors disabled:opacity-60">{saving ? "Sending..." : "Send"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
