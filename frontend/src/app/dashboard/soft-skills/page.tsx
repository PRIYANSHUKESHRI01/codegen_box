"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Brain, ArrowRight, Trophy, Clock } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ASSESSMENT_TYPE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type SoftSkillAssessmentSummary,
} from "@/types/softSkill";

export default function SoftSkillsListPage() {
  const { status } = useAuthGuard(["user"]);
  const [assessments, setAssessments] = useState<SoftSkillAssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ assessments: SoftSkillAssessmentSummary[] }>("/soft-skills");
      setAssessments(res.assessments);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load Soft Skills tests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="user"
      title="Soft Skills"
      subtitle="Aptitude, reasoning, English and workplace judgment — the readiness check most placement drives screen on before the technical rounds."
    >
      {loading ? (
        <div className="p-16 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading tests...
        </div>
      ) : error ? (
        <div className="p-10 text-center text-xs text-status-danger rounded-panel bg-surface border border-border-subtle">{error}</div>
      ) : assessments.length === 0 ? (
        <div className="p-16 text-center rounded-panel bg-surface border border-border-subtle space-y-2">
          <Brain className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-xs text-text-muted">No Soft Skills tests are available for you yet — check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assessments.map((assessment) => (
            <motion.div key={assessment.id} whileHover={{ y: -3 }} transition={{ duration: 0.18, ease: "easeOut" }}>
              <Link
                href={`/dashboard/soft-skills/session?slug=${assessment.slug}`}
                className="group block h-full rounded-panel bg-surface border border-border-subtle hover:border-border-strong shadow-subtle hover:shadow-card transition-all p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-control flex items-center justify-center border bg-gradient-to-br from-accent-primary/25 to-accent-primary/5 bg-accent-primary/10 text-accent-primary border-accent-primary/25">
                    <Brain className="w-5 h-5" />
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-3xs font-bold uppercase tracking-wide bg-accent-secondary/10 text-accent-secondary">
                    {ASSESSMENT_TYPE_LABELS[assessment.assessment_type]}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-primary group-hover:text-accent-primary transition-colors">{assessment.title}</h3>
                  {assessment.description && <p className="text-xs text-text-muted mt-1 line-clamp-2">{assessment.description}</p>}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {CATEGORY_ORDER.filter((cat) => assessment.category_composition[cat]).map((cat) => (
                    <span key={cat} className="text-3xs font-semibold text-text-muted bg-elevated rounded-full px-2 py-0.5">
                      {assessment.category_composition[cat]} {CATEGORY_LABELS[cat].split(" ")[0]}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-2xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {assessment.duration_minutes} min
                  </span>
                  <span>{assessment.question_count} questions</span>
                </div>

                <div className="flex items-center justify-between text-2xs text-text-muted pt-1 border-t border-border-subtle">
                  {assessment.best_score_percent !== null ? (
                    <span className={cn("flex items-center gap-1 font-bold", assessment.best_score_percent >= assessment.pass_percentage ? "text-status-success" : "text-status-warning")}>
                      <Trophy className="w-3.5 h-3.5" />
                      Best {Math.round(assessment.best_score_percent)}%
                    </span>
                  ) : (
                    <span>Not attempted</span>
                  )}
                  {!assessment.can_attempt ? (
                    <span className="text-3xs font-bold text-text-muted">Attempts used up</span>
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-primary group-hover:translate-x-0.5 transition-all" />
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
