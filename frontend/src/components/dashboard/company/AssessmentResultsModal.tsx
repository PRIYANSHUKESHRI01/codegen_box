"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, UserPlus, Lock, Users, Target, GitBranch, CheckSquare } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DRIVE_APPLICATION_STAGE_LABELS, type DriveApplicationStage } from "@/types/placement";
import { Modal } from "@/components/ui/Modal";
import { HpButton, HpPill, HpProgress, hpInput, type HpTone } from "@/components/portal/kit";
import { ScCheckRow, ScInlineEmpty, ScMetric, ScNotice, ScSkeletonList } from "@/components/portal/screeningKit";

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

/** Bar tone for a score — emerald only for a genuinely strong result. */
function scoreTone(pct: number): HpTone {
  if (pct >= 70) return "emerald";
  if (pct >= 40) return "indigo";
  return "amber";
}

const RANK_STYLES: Record<number, string> = {
  1: "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-[0_4px_10px_-4px_rgba(245,158,11,0.8)]",
  2: "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-[0_4px_10px_-4px_rgba(100,116,139,0.8)]",
  3: "bg-gradient-to-br from-orange-300 to-orange-600 text-white shadow-[0_4px_10px_-4px_rgba(234,88,12,0.7)]",
};

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
  const topScore = results.length > 0 ? Math.max(...results.map((r) => r.score_percent)) : 0;
  const pipedCount = results.length - importable.length;

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      title="Results"
      subtitle={contestTitle}
      icon={Trophy}
      size="2xl"
      footer={
        showFooter ? (
          <>
            <HpButton type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Close
            </HpButton>
            <HpButton
              onClick={handleImport}
              disabled={selected.size === 0}
              isLoading={submitting}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              <span>Add {selected.size > 0 ? `(${selected.size})` : ""} to Pipeline</span>
            </HpButton>
          </>
        ) : undefined
      }
    >
      {loading ? (
        <ScSkeletonList rows={5} />
      ) : loadError ? (
        <ScNotice tone="rose" title="Couldn't load results">
          {loadError}
        </ScNotice>
      ) : results.length === 0 ? (
        <ScInlineEmpty
          icon={Trophy}
          tone="slate"
          title="No submissions yet"
          description="No one has submitted anything yet. Results appear here as soon as candidates start solving."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <ScMetric icon={Users} label="Submitted" value={results.length} tone="indigo" />
            <ScMetric icon={Target} label="Top score" value={`${topScore}%`} tone="emerald" />
            <ScMetric icon={GitBranch} label="In pipeline" value={pipedCount} tone="teal" />
            <ScMetric icon={CheckSquare} label="Selected" value={selected.size} tone="violet" />
          </div>

          <div className="flex flex-col gap-2.5 rounded-2xl border border-border-subtle bg-elevated/40 p-3.5 sm:flex-row sm:items-center sm:gap-3">
            <label htmlFor="ar-min-score" className="shrink-0 text-xs font-semibold text-text-secondary">
              Min score %
            </label>
            <div className="relative w-28 shrink-0">
              <input
                id="ar-min-score"
                type="number"
                min={0}
                max={100}
                value={minScorePercent}
                onChange={(e) => setMinScorePercent(e.target.value)}
                placeholder="e.g. 90"
                className={cn(hpInput, "tabular h-9 py-0 pr-8")}
              />
              <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-2xs font-bold text-text-muted">
                %
              </span>
            </div>
            <span className="text-2xs leading-relaxed text-text-muted">pre-selects matching, not-yet-piped candidates below</span>
          </div>

          <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
            {results.map((r, i) => {
              const alreadyPiped = r.pipeline_stage !== null;
              const rank = i + 1;
              const stageLabel = alreadyPiped ? DRIVE_APPLICATION_STAGE_LABELS[r.pipeline_stage!] : null;
              return (
                <ScCheckRow
                  key={r.user_id}
                  name={r.user.name}
                  checked={selected.has(r.user_id)}
                  onChange={() => toggle(r.user_id)}
                  disabled={alreadyPiped}
                  detail={
                    <>
                      {r.user.email}
                      {r.penalty_minutes > 0 && <span className="tabular"> · +{r.penalty_minutes}m penalty</span>}
                      {stageLabel && <span className="sm:hidden"> · {stageLabel}</span>}
                    </>
                  }
                  leading={
                    <span
                      className={cn(
                        "tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-3xs font-extrabold",
                        RANK_STYLES[rank] ?? "bg-elevated text-text-muted"
                      )}
                    >
                      <span className="sr-only">Rank </span>
                      {rank}
                    </span>
                  }
                  trailing={
                    <div className="flex shrink-0 items-center gap-2.5">
                      <div className="hidden w-20 sm:block">
                        <HpProgress value={r.score_percent} tone={scoreTone(r.score_percent)} />
                      </div>
                      <span className="tabular w-11 text-right text-13 font-extrabold text-primary">{r.score_percent}%</span>
                      {stageLabel && (
                        <HpPill tone="slate" icon={Lock} size="sm" className="hidden sm:inline-flex">
                          {stageLabel}
                        </HpPill>
                      )}
                    </div>
                  }
                />
              );
            })}
          </div>

          {submitError && <ScNotice tone="rose">{submitError}</ScNotice>}
        </div>
      )}
    </Modal>
  );
}
