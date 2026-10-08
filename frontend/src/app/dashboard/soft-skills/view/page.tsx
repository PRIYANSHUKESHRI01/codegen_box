"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, XCircle, Trophy, RotateCcw, ShieldAlert } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_ORDER, type SoftSkillResult } from "@/types/softSkill";

export default function SoftSkillResultPage() {
  const { status } = useAuthGuard(["user"]);
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";

  const [result, setResult] = useState<SoftSkillResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!sessionId) {
      setError("This result couldn't be found.");
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<{ session: SoftSkillResult }>(`/soft-skills/sessions/${sessionId}`);
      setResult(res.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "This result couldn't be found.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready" || loading) return <SessionLoader />;

  if (error || !result) {
    return (
      <DashboardShell role="user" title="Soft Skills">
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle space-y-3">
          <p>{error}</p>
          <Link href="/dashboard/soft-skills" className="text-accent-primary font-semibold hover:underline">
            Back to Soft Skills
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const endedByProctoring = result.proctoring?.terminated === true;

  return (
    <DashboardShell role="user" title="Soft Skills" subtitle={result.assessment_title}>
      <div className="max-w-3xl mx-auto space-y-4">
        <Link href="/dashboard/soft-skills" className="inline-flex items-center gap-1 text-2xs font-semibold text-text-muted hover:text-primary transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          All Soft Skills tests
        </Link>

        <div className="rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <ReadinessRing value={Math.round(result.score_percent)} label={endedByProctoring ? "Ended" : result.passed ? "Passed" : "Below Target"} />
            {endedByProctoring ? (
              <p className="flex items-start justify-center gap-1.5 text-sm font-bold text-status-danger max-w-md">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This attempt was ended by proctoring after {result.proctoring?.violation_count} strikes. Your saved answers were graded, but it can&apos;t count as a pass.
                </span>
              </p>
            ) : result.passed ? (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="flex items-center gap-1.5 text-status-success font-bold text-sm"
              >
                <Trophy className="w-4 h-4" />
                Nice work — you passed!
              </motion.div>
            ) : (
              <p className="text-sm font-bold text-status-warning">
                Just short of {result.pass_percentage}% — review what tripped you up below, and try again.
              </p>
            )}
            <p className="text-2xs text-text-muted">Attempt #{result.attempt_number} · {new Date(result.completed_at).toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORY_ORDER.filter((cat) => result.category_breakdown[cat]).map((cat) => {
              const b = result.category_breakdown[cat]!;
              const pct = b.total > 0 ? Math.round((b.correct / b.total) * 100) : 0;
              return (
                <div key={cat} className="p-3 rounded-control bg-elevated text-center">
                  <p className="text-lg font-black text-primary">{b.correct}/{b.total}</p>
                  <p className="text-3xs text-text-muted mt-0.5">{CATEGORY_LABELS[cat]}</p>
                  <div className="h-1 rounded-full bg-surface overflow-hidden mt-1.5">
                    <div className={cn("h-full rounded-full", pct >= 60 ? "bg-status-success" : "bg-status-warning")} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {!result.passed && (
            <Link
              href={`/dashboard/soft-skills/session?slug=${result.assessment_slug}`}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try Again
            </Link>
          )}
        </div>

        <div className="space-y-2.5">
          <h3 className="text-sm font-bold text-primary px-1">Question Review</h3>
          {result.results.map((r, i) => (
            <div
              key={i}
              className={cn(
                "rounded-panel p-4 border text-xs",
                r.is_correct ? "bg-status-success/5 border-status-success/20" : "bg-status-danger/5 border-status-danger/20"
              )}
            >
              <div className="flex items-start gap-2.5">
                {r.is_correct ? (
                  <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-status-danger shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 min-w-0">
                  <p className="text-3xs font-bold uppercase tracking-wide text-text-muted">{CATEGORY_LABELS[r.category]}</p>
                  <p className="font-bold text-primary">{r.question_text}</p>
                  {r.selected_index === null ? (
                    <p className="text-text-muted">You left this unanswered — correct answer: <span className="font-semibold text-status-success">{r.options[r.correct_index]}</span></p>
                  ) : !r.is_correct ? (
                    <p className="text-text-muted">
                      You chose <span className="font-semibold">{r.options[r.selected_index]}</span> — correct answer:{" "}
                      <span className="font-semibold text-status-success">{r.options[r.correct_index]}</span>
                    </p>
                  ) : (
                    <p className="text-status-success font-semibold">{r.options[r.selected_index]}</p>
                  )}
                  {r.explanation && <p className="text-text-muted">{r.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
