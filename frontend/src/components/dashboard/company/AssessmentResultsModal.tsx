"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Loader2, UserPlus, Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DRIVE_APPLICATION_STAGE_LABELS, type DriveApplicationStage } from "@/types/placement";
import { Modal } from "@/components/ui/Modal";

interface AssessmentResultsModalProps {
  /** Contest::getRouteKeyName() is 'slug' — every /company/contests/{contest}/* route binds by slug, never the numeric id. */
  contestSlug: string;
  contestTitle: string;
  onClose: () => void;
  onImported: (message: string) => void;
}

interface ResultRow {
  user_id: number;
  user: { id: number; name: string; email: string };
  score: number;
  score_percent: number;
  penalty_minutes: number;
  pipeline_stage: DriveApplicationStage | null;
}

/**
 * Score-ranked results for an assessment, whoever the candidates are
 * (invited directly, or self-registered because their college approved the
 * underlying job opening). A min-score-% input pre-checks matching rows
 * client-side; the actual submit always sends the explicit set of checked
 * user_ids (never a live-recomputed threshold), so what the recruiter saw
 * checked is exactly what gets imported. Already-piped candidates
 * (pipeline_stage set) are locked, not re-selectable — see
 * CompanyContestController::importResults()'s idempotency.
 */
export function AssessmentResultsModal({ contestSlug, contestTitle, onClose, onImported }: AssessmentResultsModalProps) {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [minScorePercent, setMinScorePercent] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await api.get<{ total_points: number; results: ResultRow[] }>(`/company/contests/${contestSlug}/results`);
        if (!cancelled) setResults(res.results);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : "Failed to load results.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contestSlug]);

  const importable = useMemo(() => results.filter((r) => r.pipeline_stage === null), [results]);

  // Pre-checks (client-side only) every not-yet-imported row meeting the
  // threshold — the recruiter can still hand-adjust before submitting.
  useEffect(() => {
    const threshold = Number(minScorePercent);
    if (!minScorePercent || Number.isNaN(threshold)) return;
    setSelected(new Set(importable.filter((r) => r.score_percent >= threshold).map((r) => r.user_id)));
  }, [minScorePercent, importable]);

  const toggle = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post<{ message: string; imported: number }>(`/company/contests/${contestSlug}/results/import`, {
        user_ids: Array.from(selected),
      });
      onImported(res.message);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to add these candidates to the pipeline.");
    } finally {
      setSubmitting(false);
    }
  };

  const showFooter = !loading && !loadError && results.length > 0;

  return (
    <Modal
      onClose={onClose}
      title={`Results — ${contestTitle}`}
      icon={Trophy}
      iconClassName="bg-teal-500/10 text-teal-500"
      size="xl"
      footer={
        showFooter ? (
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-control border border-border-subtle text-text-muted hover:text-primary transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={handleImport}
              disabled={submitting || selected.size === 0}
              className="px-4 py-2 rounded-control bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>Add {selected.size > 0 ? `(${selected.size})` : ""} to Pipeline</span>
            </button>
          </>
        ) : undefined
      }
    >
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading results...
        </div>
      ) : loadError ? (
        <p className="text-2xs text-status-danger">{loadError}</p>
      ) : results.length === 0 ? (
        <p className="text-xs text-text-muted text-center py-6">No one has submitted anything yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold text-text-secondary shrink-0">Min score %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={minScorePercent}
              onChange={(e) => setMinScorePercent(e.target.value)}
              placeholder="e.g. 90"
              className="w-24 px-2.5 py-1.5 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-teal-500"
            />
            <span className="text-3xs text-text-muted">pre-selects matching, not-yet-piped candidates below</span>
          </div>

          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {results.map((r) => {
              const alreadyPiped = r.pipeline_stage !== null;
              return (
                <label
                  key={r.user_id}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-control border text-xs",
                    alreadyPiped
                      ? "bg-elevated/40 border-border-subtle opacity-60 cursor-not-allowed"
                      : "bg-elevated/60 border-border-subtle cursor-pointer hover:bg-elevated"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(r.user_id)}
                    onChange={() => toggle(r.user_id)}
                    disabled={alreadyPiped}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-primary truncate">{r.user.name}</span>
                    <span className="block text-3xs text-text-muted truncate">{r.user.email}</span>
                  </span>
                  <span className="font-mono font-bold text-primary shrink-0">{r.score_percent}%</span>
                  {alreadyPiped ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-bold uppercase bg-elevated text-text-muted border border-border-subtle shrink-0">
                      <Lock className="w-2.5 h-2.5" />
                      {DRIVE_APPLICATION_STAGE_LABELS[r.pipeline_stage!]}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>

          {submitError && <p className="text-2xs text-status-danger">{submitError}</p>}
        </div>
      )}
    </Modal>
  );
}
