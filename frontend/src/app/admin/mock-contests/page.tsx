"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Swords, Plus, Loader2, Trash2, CheckCircle2, Search, Trophy } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ContestParticipantsModal } from "@/components/dashboard/ContestParticipantsModal";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import type { ProblemSummary } from "@/types/problem";
import { Modal } from "@/components/ui/Modal";

interface TpoContest {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  start_at: string;
  end_at: string;
  status: "draft" | "published" | "cancelled";
  finalized_at: string | null;
  participants_count: number;
}

interface TpoContestProblem {
  id: number;
  points: number;
  display_order: number;
  problem: { id: number; slug: string; title: string; difficulty: string };
}

/**
 * A college TPO's own private "mock" contests — practice rounds visible only
 * to their own students, entirely separate from Mellow's platform-run
 * contests (General/Company/Daily, managed at /admin/contests). Never rated
 * — see TpoContestController's docblock on the backend for why.
 */
export default function MockContestsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [contests, setContests] = useState<TpoContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managingContest, setManagingContest] = useState<TpoContest | null>(null);
  const [viewingParticipantsOf, setViewingParticipantsOf] = useState<TpoContest | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadContests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ contests: TpoContest[] }>("/tpo/contests");
      setContests(res.contests);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load mock contests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadContests();
  }, [status, loadContests]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const handleFinalize = async (contest: TpoContest) => {
    try {
      const res = await api.post<{ finalized?: boolean; already_finalized?: boolean; participants_ranked?: number }>(
        `/tpo/contests/${contest.slug}/finalize`
      );
      triggerToast(res.already_finalized ? "Already finalized." : `Finalized — ${res.participants_ranked} participant(s) ranked.`);
      loadContests();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to finalize.");
    }
  };

  const handlePublish = async (contest: TpoContest) => {
    try {
      await api.post(`/tpo/contests/${contest.slug}`, { status: "published" });
      triggerToast(`"${contest.title}" is now published.`);
      loadContests();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish.");
    }
  };

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Mock Contests"
      subtitle="Private practice rounds for your own students only — never rated, never visible to any other college."
      actionButton={{ label: "New Mock Contest", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading mock contests...
        </div>
      ) : contests.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          No mock contests yet — click &quot;New Mock Contest&quot; to create one for your students.
        </div>
      ) : (
        <div className="space-y-3">
          {contests.map((contest) => {
            const hasEnded = new Date(contest.end_at) < new Date();
            return (
              <div key={contest.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-control bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shrink-0">
                    <Swords className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-primary">{contest.title}</span>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-3xs font-bold uppercase rounded",
                          contest.status === "published"
                            ? "bg-status-success/15 text-status-success"
                            : contest.status === "draft"
                            ? "bg-elevated text-text-muted"
                            : "bg-status-danger/15 text-status-danger"
                        )}
                      >
                        {contest.status}
                      </span>
                      {contest.finalized_at && (
                        <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-status-success/15 text-status-success flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Finalized
                        </span>
                      )}
                    </div>
                    <div className="text-2xs text-text-muted mt-0.5">
                      {new Date(contest.start_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                      {" – "}
                      {new Date(contest.end_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit" })} ·{" "}
                      {contest.participants_count} registered
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Who registered, how they ranked, and — drilling in —
                      their actual per-problem code. Previously the only
                      signal here was the bare "N registered" count above. */}
                  <button
                    onClick={() => setViewingParticipantsOf(contest)}
                    disabled={contest.participants_count === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors disabled:opacity-50 disabled:hover:bg-elevated disabled:hover:text-text-secondary"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    Participants
                  </button>
                  <button
                    onClick={() => setManagingContest(contest)}
                    className="px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors"
                  >
                    Manage Problems
                  </button>
                  {contest.status === "draft" && (
                    <button
                      onClick={() => handlePublish(contest)}
                      className="px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors"
                    >
                      Publish
                    </button>
                  )}
                  {contest.status === "published" && hasEnded && !contest.finalized_at && (
                    <button
                      onClick={() => handleFinalize(contest)}
                      className="px-3 py-1.5 rounded-control bg-status-success/15 hover:bg-status-success/25 border border-status-success/30 text-2xs font-bold text-status-success transition-colors"
                    >
                      Finalize
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateMockContestModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadContests();
          }}
        />
      )}

      {managingContest && (
        <ManageMockProblemsModal
          contest={managingContest}
          onClose={() => setManagingContest(null)}
          onToast={triggerToast}
        />
      )}

      {viewingParticipantsOf && (
        <ContestParticipantsModal
          basePath="/tpo/contests"
          contestSlug={viewingParticipantsOf.slug}
          contestTitle={viewingParticipantsOf.title}
          onClose={() => setViewingParticipantsOf(null)}
        />
      )}
    </DashboardShell>
  );
}

function CreateMockContestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/tpo/contests", {
        title,
        description: description || undefined,
        start_at: localDatetimeInputToUtcIso(startAt),
        end_at: localDatetimeInputToUtcIso(endAt),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create mock contest.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="New Mock Contest"
      icon={Swords}
      iconClassName="bg-cyan-500/10 text-cyan-400"
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="create-mock-contest-form" disabled={saving} className="px-4 py-2 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition-colors disabled:opacity-60">
            {saving ? "Creating..." : "Create Draft"}
          </button>
        </>
      }
    >
      <p className="text-2xs text-text-muted mb-3">
        Only your own students can ever see this. Starts as a draft, and never affects platform ratings.
      </p>

      <form id="create-mock-contest-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block font-semibold text-text-secondary mb-1">Title *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Pre-Placement Mock Round 1"
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

        {error && <p className="text-2xs text-status-danger">{error}</p>}
      </form>
    </Modal>
  );
}

function ManageMockProblemsModal({
  contest,
  onClose,
  onToast,
}: {
  contest: TpoContest;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [problems, setProblems] = useState<TpoContestProblem[]>([]);
  const [catalog, setCatalog] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pointsInput, setPointsInput] = useState("100");
  const [addingId, setAddingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [problemsRes, catalogRes] = await Promise.all([
        api.get<{ problems: TpoContestProblem[] }>(`/tpo/contests/${contest.slug}/problems`),
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
      await api.post(`/tpo/contests/${contest.slug}/problems`, {
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
      await api.delete(`/tpo/contests/${contest.slug}/problems/${contestProblemId}`);
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
    <Modal onClose={onClose} title={`Problems — ${contest.title}`} size="2xl">
      <div className="space-y-4">
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
                          "px-1.5 py-0.5 text-3xs font-bold rounded capitalize",
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
                            "px-1.5 py-0.5 text-3xs font-bold rounded capitalize shrink-0",
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
    </Modal>
  );
}
