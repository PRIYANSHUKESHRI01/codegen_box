"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Swords, Plus, X, Trophy, Loader2, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, Search } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { DriveVisibilityPanel } from "@/components/admin/contests/DriveVisibilityPanel";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { userHasPermission } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import type { ProblemSummary } from "@/types/problem";

type ContestType = "general" | "daily" | "company" | "tpo_mock";

interface AdminContest {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  start_at: string;
  end_at: string;
  is_rated: boolean;
  status: "draft" | "published" | "cancelled";
  finalized_at: string | null;
  participants_count: number;
  contest_type: ContestType;
  is_auto_generated: boolean;
  company: { id: number; name: string; logo: string | null } | null;
  placement_drive: { id: number; title: string } | null;
  owning_college: { id: number; name: string; short_code: string } | null;
  visibility_summary: { selected: number; live: number; pending: number } | null;
  college_ids: number[] | null;
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

const CONTEST_TYPE_LABEL: Record<ContestType, string> = {
  general: "General",
  daily: "Daily Challenge",
  company: "Company",
  tpo_mock: "TPO Mock",
};

const CONTEST_TYPE_BADGE_COLOR: Record<ContestType, string> = {
  general: "bg-elevated text-text-muted",
  daily: "bg-sky-500/15 text-sky-400",
  company: "bg-accent-secondary/15 text-accent-secondary",
  tpo_mock: "bg-cyan-500/15 text-cyan-400",
};

interface AdminContestProblem {
  id: number;
  points: number;
  display_order: number;
  problem: { id: number; slug: string; title: string; difficulty: string };
}

export default function AdminContestsPage() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "contests");
  const [contests, setContests] = useState<AdminContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managingContest, setManagingContest] = useState<AdminContest | null>(null);
  const [visibilityContest, setVisibilityContest] = useState<AdminContest | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadContests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ contests: AdminContest[] }>("/admin/contests");
      setContests(res.contests);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load contests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready" && hasAccess) loadContests();
  }, [status, hasAccess, loadContests]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="Contests">
        <AccessDeniedNotice section="Contests" />
      </DashboardShell>
    );
  }

  const handleFinalize = async (contest: AdminContest) => {
    try {
      const res = await api.post<{ finalized?: boolean; already_finalized?: boolean; participants_ranked?: number }>(
        `/admin/contests/${contest.slug}/finalize`
      );
      triggerToast(res.already_finalized ? "Already finalized." : `Finalized — ${res.participants_ranked} participant(s) ranked.`);
      loadContests();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to finalize.");
    }
  };

  const handlePublish = async (contest: AdminContest) => {
    try {
      await api.post(`/admin/contests/${contest.slug}`, { status: "published" });
      triggerToast(`"${contest.title}" is now published.`);
      loadContests();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish.");
    }
  };

  return (
    <DashboardShell
      role="admin_internal"
      title="Contests"
      subtitle="Create and curate platform-run rated contests — students only ever see published ones."
      actionButton={{ label: "New Contest", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading contests...
        </div>
      ) : contests.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No contests yet — click &quot;New Contest&quot; to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {contests.map((contest) => {
            const hasEnded = new Date(contest.end_at) < new Date();
            return (
              <div key={contest.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                    <Swords className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-primary">{contest.title}</span>
                      <span className={cn("px-1.5 py-0.5 text-[9px] font-bold uppercase rounded", CONTEST_TYPE_BADGE_COLOR[contest.contest_type])}>
                        {CONTEST_TYPE_LABEL[contest.contest_type]}
                      </span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded",
                          contest.status === "published"
                            ? "bg-status-success/15 text-status-success"
                            : contest.status === "draft"
                            ? "bg-elevated text-text-muted"
                            : "bg-status-danger/15 text-status-danger"
                        )}
                      >
                        {contest.status}
                      </span>
                      {contest.is_rated && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-amber-500/10 text-amber-500">Rated</span>
                      )}
                      {contest.finalized_at && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-status-success/15 text-status-success flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Finalized
                        </span>
                      )}
                      {contest.visibility_summary && (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded flex items-center gap-1",
                            contest.visibility_summary.live > 0
                              ? "bg-status-success/15 text-status-success"
                              : "bg-status-warning/15 text-status-warning"
                          )}
                        >
                          {contest.visibility_summary.live > 0 ? <ShieldCheck className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                          {contest.visibility_summary.live}/{contest.visibility_summary.selected} targeted college{contest.visibility_summary.selected === 1 ? "" : "s"} live
                          {contest.visibility_summary.pending > 0 && ` · ${contest.visibility_summary.pending} more pending`}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {new Date(contest.start_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      {" – "}
                      {new Date(contest.end_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit" })} ·{" "}
                      {contest.participants_count} registered
                      {contest.company && <> · {contest.company.name}</>}
                      {contest.owning_college && <> · {contest.owning_college.short_code} (TPO-owned)</>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {contest.contest_type === "tpo_mock" ? (
                    <span className="text-[10px] text-text-muted italic px-1">Managed by {contest.owning_college?.name ?? "the owning college"}'s TPO</span>
                  ) : (
                    <>
                      {contest.contest_type === "company" && contest.placement_drive && (
                        <button
                          onClick={() => setVisibilityContest(contest)}
                          className="px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors"
                        >
                          Manage Visibility
                        </button>
                      )}
                      <button
                        onClick={() => setManagingContest(contest)}
                        className="px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-primary transition-colors"
                      >
                        Manage Problems
                      </button>
                      {contest.status === "draft" && (
                        <button
                          onClick={() => handlePublish(contest)}
                          className="px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-[11px] font-bold transition-colors"
                        >
                          Publish
                        </button>
                      )}
                      {contest.status === "published" && hasEnded && !contest.finalized_at && (
                        <button
                          onClick={() => handleFinalize(contest)}
                          className="px-3 py-1.5 rounded-control bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 text-[11px] font-bold text-status-success transition-colors"
                        >
                          Finalize
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateContestModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadContests();
          }}
          onToast={triggerToast}
        />
      )}

      {managingContest && (
        <ManageProblemsModal
          contest={managingContest}
          onClose={() => setManagingContest(null)}
          onToast={triggerToast}
        />
      )}

      {visibilityContest?.placement_drive && (
        <ManageVisibilityModal
          contest={visibilityContest}
          onClose={() => {
            setVisibilityContest(null);
            loadContests();
          }}
          onToast={triggerToast}
        />
      )}
    </DashboardShell>
  );
}

function ManageVisibilityModal({
  contest,
  onClose,
  onToast,
}: {
  contest: AdminContest;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<number[]>(contest.college_ids ?? []);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/admin/contests/${contest.slug}/colleges`, { college_ids: selectedCollegeIds });
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
            <p className="text-[11px] text-text-muted mt-0.5">{contest.title}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10.5px] text-text-muted -mt-2">
          The drive may be live at more colleges than this contest targets — check only the ones this contest
          should actually go to.
        </p>
        <DriveVisibilityPanel
          driveId={contest.placement_drive!.id}
          onToast={onToast}
          targeting={{ selectedIds: selectedCollegeIds, onChange: setSelectedCollegeIds }}
        />
        <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors"
          >
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

function CreateContestModal({
  onClose,
  onCreated,
  onToast,
}: {
  onClose: () => void;
  onCreated: () => void;
  onToast: (msg: string) => void;
}) {
  const [contestType, setContestType] = useState<"general" | "company">("general");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isRated, setIsRated] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [drives, setDrives] = useState<DriveOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedDriveId, setSelectedDriveId] = useState("");
  const [drivesLoading, setDrivesLoading] = useState(false);
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<number[]>([]);

  useEffect(() => {
    if (contestType !== "company" || companies.length > 0) return;
    api
      .get<{ companies: CompanyOption[] }>("/admin/companies")
      .then((res) => setCompanies(res.companies))
      .catch(() => setCompanies([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestType]);

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
      await api.post("/admin/contests", {
        title,
        description: description || undefined,
        start_at: localDatetimeInputToUtcIso(startAt),
        end_at: localDatetimeInputToUtcIso(endAt),
        is_rated: isRated,
        contest_type: contestType,
        placement_drive_id: contestType === "company" ? Number(selectedDriveId) : undefined,
        college_ids: contestType === "company" ? selectedCollegeIds : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create contest.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-primary flex items-center gap-2">
            <Swords className="w-4 h-4 text-accent-primary" />
            <span>New Contest</span>
          </h3>
          <button onClick={onClose} disabled={saving} className="p-1 rounded text-text-muted hover:text-primary disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[11px] text-text-muted">
          Starts as a draft — invisible to students until you add problems and click Publish. The daily
          Challenge contest is auto-generated and never created here.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-text-secondary mb-1">Type *</label>
            <div className="flex gap-1.5 p-1 rounded-control bg-elevated border border-border-subtle w-fit">
              {(["general", "company"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContestType(t)}
                  className={cn(
                    "px-3 py-1.5 rounded-control text-[11px] font-bold transition-all",
                    contestType === t ? "bg-accent-primary text-white shadow-subtle" : "text-text-secondary hover:text-primary"
                  )}
                >
                  {t === "general" ? "General" : "Company / Drive"}
                </button>
              ))}
            </div>
            {contestType === "company" && (
              <p className="text-[10px] text-text-muted mt-1">
                Only visible to students at colleges where this drive is mapped &amp; approved. Problems must
                already be tagged to the company (Placement Drives → Recommended Problems).
              </p>
            )}
          </div>

          {contestType === "company" && (
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

          {contestType === "company" && selectedDriveId && (
            <DriveVisibilityPanel
              key={selectedDriveId}
              driveId={Number(selectedDriveId)}
              onToast={onToast}
              targeting={{ selectedIds: selectedCollegeIds, onChange: setSelectedCollegeIds }}
              onLiveCollegeIdsLoaded={setSelectedCollegeIds}
            />
          )}

          <div>
            <label className="block font-semibold text-text-secondary mb-1">Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Contest 12"
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-text-secondary mb-1">Start *</label>
              <input
                required
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block font-semibold text-text-secondary mb-1">End *</label>
              <input
                required
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isRated} onChange={(e) => setIsRated(e.target.checked)} className="rounded border-border-subtle" />
            <span className="text-text-secondary">Rated — affects participants&apos; ratings when finalized</span>
          </label>

          {error && <p className="text-[11px] text-status-danger">{error}</p>}

          <div className="pt-2 flex justify-end gap-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-60">
              {saving ? "Creating..." : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ManageProblemsModal({
  contest,
  onClose,
  onToast,
}: {
  contest: AdminContest;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [problems, setProblems] = useState<AdminContestProblem[]>([]);
  const [catalog, setCatalog] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pointsInput, setPointsInput] = useState("100");
  const [addingId, setAddingId] = useState<number | null>(null);

  const isCompanyContest = contest.contest_type === "company" && contest.company !== null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [problemsRes, catalogRes] = await Promise.all([
        api.get<{ problems: AdminContestProblem[] }>(`/admin/contests/${contest.slug}/problems`),
        api.get<{ problems: ProblemSummary[] }>("/problems"),
      ]);
      setProblems(problemsRes.problems);

      if (isCompanyContest) {
        // A company contest may only pick from problems already tagged to
        // that company — filter the full catalog down by slug rather than
        // letting the picker suggest anything, matching what the backend
        // will actually accept (see AdminContestController::storeProblem).
        const tagged = await api.get<{ recommended_problems: { problem_slug: string }[] }>(
          `/admin/companies/${contest.company!.id}/recommended-problems`
        );
        const taggedSlugs = new Set(tagged.recommended_problems.map((p) => p.problem_slug));
        setCatalog(catalogRes.problems.filter((p) => taggedSlugs.has(p.slug)));
      } else {
        setCatalog(catalogRes.problems);
      }
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
      await api.post(`/admin/contests/${contest.slug}/problems`, {
        problem_id: problemId,
        points: Number(pointsInput) || 100,
      });
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
    return notAdded.filter((p) => p.title.toLowerCase().includes(query) || p.difficulty.toLowerCase().includes(query));
  }, [catalog, problems, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-primary">Problems — {contest.title}</h3>
          <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isCompanyContest && !loading && (
          <p className="text-[11px] text-text-muted -mt-2">
            Showing only problems tagged to {contest.company!.name}. Add more under Placement Drives → Recommended
            Problems if the list below is empty.
          </p>
        )}

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
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-[10px] font-bold rounded capitalize",
                          cp.problem.difficulty === "easy" ? "bg-status-success/15 text-status-success" : cp.problem.difficulty === "medium" ? "bg-status-warning/15 text-status-warning" : "bg-status-danger/15 text-status-danger"
                        )}
                      >
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
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search problems by name or difficulty..."
                    className="w-full pl-8 pr-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary"
                  />
                </div>
                <input
                  type="number"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  className="w-20 px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary text-xs outline-none focus:border-accent-primary"
                  placeholder="Points"
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {availableProblems.length === 0 ? (
                  <p className="text-[10.5px] text-text-muted text-center py-4">
                    {search ? "No problems match your search." : "No more problems available to add."}
                  </p>
                ) : (
                  availableProblems.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 p-2.5 rounded-control bg-elevated/60 border border-border-subtle text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[10px] font-bold rounded capitalize shrink-0",
                            p.difficulty === "easy" ? "bg-status-success/15 text-status-success" : p.difficulty === "medium" ? "bg-status-warning/15 text-status-warning" : "bg-status-danger/15 text-status-danger"
                          )}
                        >
                          {p.difficulty}
                        </span>
                        <span className="text-primary truncate">{p.title}</span>
                      </div>
                      <button
                        onClick={() => handleAdd(p.id)}
                        disabled={addingId === p.id}
                        className="px-2.5 py-1 rounded-control bg-accent-primary/10 text-accent-primary hover:bg-accent-primary hover:text-white text-[10.5px] font-bold transition-colors disabled:opacity-50 shrink-0"
                      >
                        {addingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Add"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
