"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, ListChecks, Plus, Trash2 } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CreateSoftSkillAssessmentModal } from "./CreateSoftSkillAssessmentModal";
import { ManageSoftSkillQuestionsModal } from "./ManageSoftSkillQuestionsModal";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ASSESSMENT_TYPE_LABELS, type AdminSoftSkillAssessment } from "@/types/softSkill";
import type { DashboardRole } from "@/components/dashboard/DashboardSidebar";

interface SoftSkillAdminConsoleProps {
  allowedRoles: DashboardRole[];
  shellRole: DashboardRole;
  currentTpoView?: "mellow" | "tpo";
  basePath: string;
  bankBasePath: string;
  title: string;
  subtitle: string;
  emptyMessage: string;
}

/**
 * The shared list+create+manage surface, used identically by Mellow Ops
 * (/admin/soft-skills), TPO (/admin/mock-soft-skills) and Company
 * (/admin/company/soft-skills) — only `basePath`/`bankBasePath` (which role-
 * scoped API this talks to) and copy differ, mirroring how the backend's
 * three controllers are near-identical modulo ownership scoping. Direct
 * structural mirror of app/admin/mock-interviews/page.tsx.
 */
export function SoftSkillAdminConsole({
  allowedRoles,
  shellRole,
  currentTpoView,
  basePath,
  bankBasePath,
  title,
  subtitle,
  emptyMessage,
}: SoftSkillAdminConsoleProps) {
  const { status } = useAuthGuard(allowedRoles);
  const [assessments, setAssessments] = useState<AdminSoftSkillAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<AdminSoftSkillAssessment | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ assessments: AdminSoftSkillAssessment[] }>(basePath);
      setAssessments(res.assessments);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load Soft Skills tests.");
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const handlePublish = async (assessment: AdminSoftSkillAssessment) => {
    try {
      await api.post(`${basePath}/${assessment.slug}`, { status: "published" });
      triggerToast(`"${assessment.title}" is now published.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish.");
    }
  };

  const handleDelete = async (assessment: AdminSoftSkillAssessment) => {
    if (!window.confirm(`Delete "${assessment.title}"? This can't be undone.`)) return;
    try {
      await api.delete(`${basePath}/${assessment.slug}`);
      triggerToast(`"${assessment.title}" deleted.`);
      load();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to delete.");
    }
  };

  return (
    <DashboardShell
      role={shellRole}
      currentTpoView={currentTpoView}
      title={title}
      subtitle={subtitle}
      actionButton={{ label: "New Soft Skills Test", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card text-xs font-semibold text-primary max-w-sm">
          {toastMessage}
        </div>
      )}

      {loading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : assessments.length === 0 ? (
        <div className="p-10 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">{emptyMessage}</div>
      ) : (
        <div className="space-y-3">
          {assessments.map((assessment) => (
            <div key={assessment.id} className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
                  <Brain className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-primary">{assessment.title}</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-3xs font-bold uppercase rounded",
                        assessment.status === "published"
                          ? "bg-status-success/15 text-status-success"
                          : assessment.status === "draft"
                          ? "bg-elevated text-text-muted"
                          : "bg-status-danger/15 text-status-danger"
                      )}
                    >
                      {assessment.status}
                    </span>
                    <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-accent-secondary/10 text-accent-secondary">
                      {ASSESSMENT_TYPE_LABELS[assessment.assessment_type]}
                    </span>
                  </div>
                  <div className="text-2xs text-text-muted mt-0.5">
                    {assessment.assessment_questions_count} questions · {assessment.duration_minutes} min · pass at {assessment.pass_percentage}% · {assessment.sessions_count} taken
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setManaging(assessment)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-elevated hover:bg-surface-hover border border-border-subtle text-2xs font-bold text-text-secondary hover:text-primary transition-colors"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>Manage Questions</span>
                </button>
                {assessment.status === "draft" && (
                  <button
                    onClick={() => handlePublish(assessment)}
                    disabled={assessment.assessment_questions_count === 0}
                    title={assessment.assessment_questions_count === 0 ? "Attach at least one question first" : undefined}
                    className="px-3 py-1.5 rounded-control bg-accent-primary hover:bg-accent-primary-hover text-white text-2xs font-bold transition-colors disabled:opacity-50"
                  >
                    Publish
                  </button>
                )}
                <button
                  onClick={() => handleDelete(assessment)}
                  title="Delete"
                  className="p-1.5 rounded-control bg-elevated hover:bg-status-danger/10 border border-border-subtle hover:border-status-danger/30 text-text-muted hover:text-status-danger transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSoftSkillAssessmentModal
          basePath={basePath}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
            triggerToast("Draft created — now attach some questions.");
          }}
        />
      )}

      {managing && (
        <ManageSoftSkillQuestionsModal
          basePath={basePath}
          bankBasePath={bankBasePath}
          assessmentSlug={managing.slug}
          assessmentTitle={managing.title}
          onClose={() => {
            setManaging(null);
            load();
          }}
          onToast={triggerToast}
        />
      )}
    </DashboardShell>
  );
}
