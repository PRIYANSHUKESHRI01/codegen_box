"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Loader2, User, PlayCircle, FileText, ShieldAlert, ShieldCheck, RotateCcw, Award, CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  VIOLATION_TYPE_LABEL,
  type InterviewResponseRow,
  type InterviewSessionRow,
} from "@/types/interview";

interface ReviewSessionsModalProps {
  /** e.g. "/tpo/interviews" or "/company/interviews" — the role-scoped controller base. */
  basePath: string;
  /** "sessions" for TpoInterviewController, "invited" for CompanyInterviewController — both return the same { sessions: [...] } shape. */
  listEndpoint: "sessions" | "invited";
  interviewSlug: string;
  interviewTitle: string;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, string> = { invited: "Invited", in_progress: "In Progress", completed: "Completed" };
const STATUS_COLOR: Record<string, string> = {
  invited: "bg-elevated text-text-muted",
  in_progress: "bg-status-warning/15 text-status-warning",
  completed: "bg-status-success/15 text-status-success",
};

/**
 * A recruiter/TPO's review queue for one interview — pick a candidate, read
 * their transcripts and play back their recorded answers. For a plain
 * interview, nothing here scores anything; the actual "hire/reject"
 * decision happens on the existing Candidates/DriveApplication stage
 * screen, unchanged by this feature (see CompanyInterviewController's
 * docblock on the backend) — but every completed session now also gets a
 * 0-100 score + feedback per response (ScoreInterviewSessionJob, Gemini, or
 * a human overriding it here) and a Finalize action, for every interview
 * type, not just a Final Interview track round — see
 * InterviewTrackAdvancementService's finalizeAndAdvance()/
 * finalizeStandaloneScoring().
 */
export function ReviewSessionsModal({ basePath, listEndpoint, interviewSlug, interviewTitle, onClose }: ReviewSessionsModalProps) {
  const [sessions, setSessions] = useState<InterviewSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<InterviewSessionRow | null>(null);

  useEffect(() => {
    api
      .get<{ sessions: InterviewSessionRow[] }>(`${basePath}/${interviewSlug}/${listEndpoint}`)
      .then((res) => setSessions(res.sessions))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [basePath, interviewSlug, listEndpoint]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-panel bg-surface border border-border-strong shadow-card p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <h3 className="text-base font-bold text-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent-primary" />
            <span>Candidate Responses — {interviewTitle}</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">No candidates yet.</p>
        ) : selected ? (
          <SessionResponses
            basePath={basePath}
            interviewSlug={interviewSlug}
            session={selected}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="space-y-1.5">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s)}
                className="w-full flex items-center justify-between gap-3 p-3 rounded-control bg-elevated/60 hover:bg-elevated border border-border-subtle text-xs text-left transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-primary truncate">{s.user.name}</div>
                    <div className="text-[10px] text-text-muted truncate">{s.user.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.proctoring_session && s.proctoring_session.violation_count > 0 && (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded flex items-center gap-1",
                        s.proctoring_session.status === "locked"
                          ? "bg-status-danger/15 text-status-danger"
                          : "bg-status-warning/15 text-status-warning"
                      )}
                    >
                      <ShieldAlert className="w-2.5 h-2.5" />
                      {s.proctoring_session.status === "locked" ? "Locked" : `${s.proctoring_session.violation_count} flag`}
                    </span>
                  )}
                  <span className={cn("px-2 py-0.5 text-[9px] font-bold uppercase rounded", STATUS_COLOR[s.status])}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionResponses({
  basePath,
  interviewSlug,
  session: initialSession,
  onBack,
}: {
  basePath: string;
  interviewSlug: string;
  session: InterviewSessionRow;
  onBack: () => void;
}) {
  const [session, setSession] = useState(initialSession);
  const [responses, setResponses] = useState<InterviewResponseRow[]>([]);
  const [proctoring, setProctoring] = useState(initialSession.proctoring_session ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reinstating, setReinstating] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [scoreDrafts, setScoreDrafts] = useState<Record<number, { score: string; notes: string }>>({});
  const [savingScoreId, setSavingScoreId] = useState<number | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [finalizeResult, setFinalizeResult] = useState<{
    composite_score_percent: number;
    threshold: number;
    passed: boolean;
    advanced: boolean;
    partial_composite: boolean;
  } | null>(null);

  const loadResponses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ session: InterviewSessionRow; responses: InterviewResponseRow[] }>(
        `${basePath}/${interviewSlug}/sessions/${session.id}/responses`
      );
      setResponses(res.responses);
      setProctoring(res.session.proctoring_session ?? null);
      setSession(res.session);
      setScoreDrafts((prev) => {
        const next = { ...prev };
        for (const r of res.responses) {
          if (!(r.id in next)) {
            next[r.id] = { score: r.score != null ? String(r.score) : "", notes: r.review_notes ?? "" };
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load responses.");
    } finally {
      setLoading(false);
    }
  }, [basePath, interviewSlug, session.id]);

  const handleReinstate = async () => {
    setReinstating(true);
    try {
      await api.post(`${basePath}/${interviewSlug}/sessions/${session.id}/reinstate`);
      loadResponses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reinstate this session.");
    } finally {
      setReinstating(false);
    }
  };

  const handleSaveScore = async (response: InterviewResponseRow) => {
    const draft = scoreDrafts[response.id];
    const score = Number(draft?.score);
    if (!draft || draft.score.trim() === "" || Number.isNaN(score) || score < 0 || score > 100) {
      setActionError("Enter a score between 0 and 100 before saving.");
      return;
    }
    setSavingScoreId(response.id);
    setActionError(null);
    try {
      await api.post(`${basePath}/${interviewSlug}/responses/${response.id}/score`, {
        score,
        review_notes: draft.notes.trim() || undefined,
      });
      await loadResponses();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save this score.");
    } finally {
      setSavingScoreId(null);
    }
  };

  const allScored = responses.length > 0 && responses.every((r) => r.score != null);

  const handleFinalize = async () => {
    setFinalizing(true);
    setActionError(null);
    try {
      const result = await api.post<{
        finalized: boolean;
        already_finalized?: boolean;
        composite_score_percent?: number;
        threshold?: number;
        passed?: boolean;
        advanced?: boolean;
        partial_composite?: boolean;
      }>(`${basePath}/${interviewSlug}/sessions/${session.id}/finalize`, {});
      if (result.composite_score_percent != null) {
        setFinalizeResult({
          composite_score_percent: result.composite_score_percent,
          threshold: result.threshold ?? 0,
          passed: !!result.passed,
          advanced: !!result.advanced,
          partial_composite: !!result.partial_composite,
        });
      }
      await loadResponses();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to finalize this session.");
    } finally {
      setFinalizing(false);
    }
  };

  useEffect(() => {
    loadResponses();
  }, [loadResponses]);

  useEffect(() => {
    return () => {
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlay = async (responseId: number) => {
    if (audioUrls[responseId]) {
      setPlayingId(responseId);
      return;
    }
    try {
      const blob = await api.getFile(`${basePath}/${interviewSlug}/responses/${responseId}/audio`);
      const url = URL.createObjectURL(blob);
      setAudioUrls((prev) => ({ ...prev, [responseId]: url }));
      setPlayingId(responseId);
    } catch {
      setError("Failed to load the recording for this answer.");
    }
  };

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[11px] font-semibold text-accent-primary hover:underline">
        ← Back to candidates
      </button>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-primary">{session.user.name}</span>
        <span className="text-[10px] text-text-muted">{session.user.email}</span>
      </div>

      {proctoring && (proctoring.violation_count > 0 || proctoring.status === "locked") && (
        <div
          className={cn(
            "p-3 rounded-control border space-y-2",
            proctoring.status === "locked"
              ? "bg-status-danger/10 border-status-danger/25"
              : "bg-status-warning/10 border-status-warning/25"
          )}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span
              className={cn(
                "text-xs font-bold flex items-center gap-1.5",
                proctoring.status === "locked" ? "text-status-danger" : "text-status-warning"
              )}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {proctoring.status === "locked"
                ? `Locked out — ${proctoring.violation_count} proctoring strikes`
                : `${proctoring.violation_count} proctoring flag${proctoring.violation_count === 1 ? "" : "s"}`}
            </span>
            {proctoring.status === "locked" && (
              <button
                onClick={handleReinstate}
                disabled={reinstating}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-surface hover:bg-elevated border border-border-subtle text-[10.5px] font-bold text-primary transition-colors disabled:opacity-50"
              >
                {reinstating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                <ShieldCheck className="w-3 h-3 text-status-success" />
                Reinstate
              </button>
            )}
          </div>
          {proctoring.violations && proctoring.violations.length > 0 && (
            <ul className="space-y-1">
              {proctoring.violations.map((v) => (
                <li key={v.id} className="text-[10.5px] text-text-secondary flex items-center gap-1.5">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", v.counted_toward_lock ? "bg-status-danger" : "bg-text-muted")} />
                  {VIOLATION_TYPE_LABEL[v.type] ?? v.type} · {new Date(v.occurred_at).toLocaleString("en-IN", { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(session.reviewed_at || session.ai_scored_at || finalizeResult) && (() => {
        const compositePercent = finalizeResult?.composite_score_percent ?? session.composite_score_percent ?? null;
        const threshold = finalizeResult?.threshold ?? session.interview?.qualifying_score_percent ?? null;
        // threshold is null for a standalone interview (no qualifying_score_percent) — passed stays null, rendered as neutral, not pass/fail.
        const passed = finalizeResult ? finalizeResult.passed : threshold != null && compositePercent != null ? compositePercent >= threshold : null;
        const advanced = finalizeResult?.advanced ?? session.advanced ?? false;
        const humanReviewed = !!session.reviewed_at;

        return (
          <div
            className={cn(
              "p-3 rounded-control border flex items-center gap-2.5",
              passed === false ? "bg-status-danger/10 border-status-danger/25" : passed === true ? "bg-status-success/10 border-status-success/25" : "bg-elevated/60 border-border-subtle"
            )}
          >
            {passed === null ? (
              <Award className="w-4 h-4 text-primary shrink-0" />
            ) : passed ? (
              <CheckCircle2 className="w-4 h-4 text-status-success shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-status-danger shrink-0" />
            )}
            <div className="text-[11px] text-text-secondary flex-1">
              <span className="font-bold text-primary">{compositePercent?.toFixed(1)}%</span> composite score
              {threshold != null && (passed === null ? "" : passed ? " — passed" : " — did not meet")}
              {threshold != null ? " the round's qualifying threshold" : ""}
              {advanced ? ", next round unlocked." : "."}
              {finalizeResult?.partial_composite && " (one or more weighted categories had no scored questions — composite renormalized.)"}
            </div>
            {!humanReviewed && session.ai_scored_at && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-accent-primary/10 text-accent-primary shrink-0">
                <Sparkles className="w-2.5 h-2.5" />
                AI-scored
              </span>
            )}
          </div>
        );
      })()}

      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading transcript...
        </div>
      ) : error ? (
        <p className="text-xs text-status-danger py-4">{error}</p>
      ) : responses.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-6">No answers submitted yet.</p>
      ) : (
        <div className="space-y-3">
          {responses
            .slice()
            .sort((a, b) => a.interview_question.display_order - b.interview_question.display_order)
            .map((r, idx) => (
              <div key={r.id} className="p-3.5 rounded-control bg-elevated/60 border border-border-subtle space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-text-muted">Q{idx + 1}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border",
                      CATEGORY_COLORS[r.interview_question.question_bank.category]
                    )}
                  >
                    {CATEGORY_LABELS[r.interview_question.question_bank.category]}
                  </span>
                </div>
                <p className="text-xs font-semibold text-primary">{r.interview_question.question_bank.question_text}</p>
                <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {r.transcript_text || <span className="text-text-muted italic">No transcript captured.</span>}
                </p>
                {r.audio_path && (
                  <div>
                    {playingId === r.id && audioUrls[r.id] ? (
                      <audio controls autoPlay src={audioUrls[r.id]} className="w-full h-8" />
                    ) : (
                      <button
                        onClick={() => handlePlay(r.id)}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-primary hover:underline"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        Play recording
                      </button>
                    )}
                  </div>
                )}

                {session.status === "completed" && (
                  <div className="pt-1.5 border-t border-border-subtle flex items-start gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-semibold text-text-secondary">Score</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scoreDrafts[r.id]?.score ?? ""}
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({ ...prev, [r.id]: { score: e.target.value, notes: prev[r.id]?.notes ?? "" } }))
                        }
                        className="w-16 px-2 py-1 rounded-control bg-surface border border-border-subtle text-[11px] text-primary outline-none focus:border-accent-primary"
                      />
                      <span className="text-[10px] text-text-muted">/ 100</span>
                    </div>
                    <input
                      value={scoreDrafts[r.id]?.notes ?? ""}
                      onChange={(e) =>
                        setScoreDrafts((prev) => ({ ...prev, [r.id]: { score: prev[r.id]?.score ?? "", notes: e.target.value } }))
                      }
                      placeholder="Review notes (optional)"
                      className="flex-1 min-w-[160px] px-2.5 py-1 rounded-control bg-surface border border-border-subtle text-[11px] text-primary outline-none focus:border-accent-primary"
                    />
                    <button
                      onClick={() => handleSaveScore(r)}
                      disabled={savingScoreId === r.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-control bg-accent-primary/10 text-accent-primary hover:bg-accent-primary hover:text-white transition-colors disabled:opacity-50 text-[10.5px] font-bold"
                    >
                      {savingScoreId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : r.score != null ? "Update" : "Save"}
                    </button>
                    {r.score != null && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-status-success">
                        <CheckCircle2 className="w-3 h-3" />
                        Scored {r.score}/100
                      </span>
                    )}
                    {r.ai_scored && (
                      <span
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-accent-primary/10 text-accent-primary"
                        title="Scored by Gemini — edit and save to override with your own score."
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        AI-scored
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {session.status === "completed" && responses.length > 0 && (
        <div className="pt-2 border-t border-border-subtle space-y-2">
          {actionError && <p className="text-[11px] text-status-danger">{actionError}</p>}
          <button
            onClick={handleFinalize}
            disabled={!allScored || finalizing || !!session.reviewed_at}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors disabled:opacity-50"
          >
            {finalizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Finalizing...
              </>
            ) : session.reviewed_at ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Already Finalized
              </>
            ) : (
              <>
                <Award className="w-3.5 h-3.5" />
                {allScored
                  ? session.interview?.qualifying_score_percent != null
                    ? "Finalize & Advance"
                    : "Finalize Score"
                  : `Score all ${responses.length} responses to finalize`}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
