"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Brain, Loader2, ListChecks, Plus, Trash2, Rocket, PenLine, Ban, Timer, Target, Users, SearchX, type LucideIcon } from "lucide-react";
import {
  HpButton,
  HpCard,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpSearch,
  HpSkeletonCards,
  HpStagger,
  HpStatCard,
  HpTabs,
  HpToast,
  type HpTone,
} from "@/components/portal/kit";
import { ScIconButton, ScMetric, ScNotice, ScReveal } from "@/components/portal/screeningKit";
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
  /** "premium" is the hiring-portal look (kit cards, stats, filters, premium modals). Default leaves Ops/TPO markup exactly as before. */
  variant?: "default" | "premium";
}

const PREMIUM_STATUS: Record<AdminSoftSkillAssessment["status"], { label: string; tone: HpTone; icon?: LucideIcon; dot?: boolean; pulse?: boolean }> = {
  published: { label: "Published", tone: "teal", dot: true, pulse: true },
  draft: { label: "Draft", tone: "slate", icon: PenLine },
  cancelled: { label: "Cancelled", tone: "rose", icon: Ban },
};

type PremiumFilter = "all" | "published" | "draft";

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
  variant = "default",
}: SoftSkillAdminConsoleProps) {
  const { status } = useAuthGuard(allowedRoles);
  const [assessments, setAssessments] = useState<AdminSoftSkillAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managing, setManaging] = useState<AdminSoftSkillAssessment | null>(null);
  // View-only list controls for the premium presentation (client-side filtering of the loaded list).
  const [filter, setFilter] = useState<PremiumFilter>("all");
  const [query, setQuery] = useState("");

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

  if (variant === "premium") {
    const publishedCount = assessments.filter((a) => a.status === "published").length;
    const draftCount = assessments.filter((a) => a.status === "draft").length;
    const questionsTotal = assessments.reduce((sum, a) => sum + a.assessment_questions_count, 0);
    const attemptsTotal = assessments.reduce((sum, a) => sum + a.sessions_count, 0);
    const q = query.trim().toLowerCase();
    const visible = assessments.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q);
    });
    const hasAny = assessments.length > 0;

    return (
      <DashboardShell
        role={shellRole}
        currentTpoView={currentTpoView}
        title={title}
        subtitle={subtitle}
        actionButton={{ label: "New Soft Skills Test", icon: Plus, onClick: () => setShowCreate(true) }}
      >
        <HpToast message={toastMessage} />

        <HpStagger className="space-y-6">
          {(loading || hasAny) && (
            <HpItem>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <HpStatCard
                  label="Tests"
                  value={assessments.length}
                  icon={Brain}
                  tone="violet"
                  loading={loading}
                  hint={draftCount > 0 ? `${draftCount} in draft` : "All published"}
                />
                <HpStatCard label="Published" value={publishedCount} icon={Rocket} tone="teal" loading={loading} hint="Live for test-takers" />
                <HpStatCard label="Questions" value={questionsTotal} icon={ListChecks} tone="indigo" loading={loading} hint="Attached across tests" />
                <HpStatCard label="Attempts" value={attemptsTotal} icon={Users} tone="sky" loading={loading} hint="Sessions taken" />
              </div>
            </HpItem>
          )}

          {hasAny && (
            <HpItem>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <HpTabs<PremiumFilter>
                  value={filter}
                  onChange={setFilter}
                  tabs={[
                    { id: "all", label: "All", count: assessments.length },
                    { id: "published", label: "Published", count: publishedCount },
                    { id: "draft", label: "Drafts", count: draftCount },
                  ]}
                />
                <HpSearch
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tests"
                  aria-label="Search Soft Skills tests"
                  wrapperClassName="w-full sm:w-72"
                />
              </div>
            </HpItem>
          )}

          <HpItem>
            {loading ? (
              <HpSkeletonCards count={4} className="md:grid-cols-1 xl:grid-cols-2" />
            ) : !hasAny ? (
              <HpEmptyState
                icon={Brain}
                tone="violet"
                title="Create your first Soft Skills test"
                description={emptyMessage}
                action={
                  <HpButton leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
                    New Soft Skills Test
                  </HpButton>
                }
              />
            ) : visible.length === 0 ? (
              <HpEmptyState
                icon={SearchX}
                tone="slate"
                title="Nothing matches"
                description="No tests fit this filter or search. Try another view, or clear the search."
                action={
                  <HpButton
                    variant="secondary"
                    onClick={() => {
                      setFilter("all");
                      setQuery("");
                    }}
                  >
                    Clear filters
                  </HpButton>
                }
              />
            ) : (
              <div className="relative grid grid-cols-1 gap-4 xl:grid-cols-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {visible.map((assessment, index) => {
                    const meta = PREMIUM_STATUS[assessment.status] ?? PREMIUM_STATUS.draft;
                    const needsQuestions = assessment.assessment_questions_count === 0;
                    return (
                      <ScReveal key={assessment.id} index={index} className="h-full">
                        <HpCard className="hp-card-hover group flex h-full flex-col p-5 sm:p-6">
                          <div className="flex-1">
                            <div className="flex items-start gap-3.5">
                              <HpIconTile
                                icon={Brain}
                                tone="violet"
                                size="lg"
                                className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                                  <h3 className="min-w-0 line-clamp-2 text-15 font-bold leading-snug tracking-tight text-primary">{assessment.title}</h3>
                                  <HpPill tone={meta.tone} dot={meta.dot} pulse={meta.pulse} icon={meta.icon} className="shrink-0">
                                    {meta.label}
                                  </HpPill>
                                </div>
                                <div className="mt-1.5">
                                  <HpPill tone="indigo" size="sm">
                                    {ASSESSMENT_TYPE_LABELS[assessment.assessment_type]}
                                  </HpPill>
                                </div>
                              </div>
                            </div>

                            {assessment.description && (
                              <p className="mt-3.5 line-clamp-2 text-13 leading-relaxed text-text-secondary">{assessment.description}</p>
                            )}

                            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                              <ScMetric icon={ListChecks} label="Questions" value={assessment.assessment_questions_count} tone="indigo" />
                              <ScMetric icon={Timer} label="Duration" value={`${assessment.duration_minutes} min`} tone="sky" />
                              <ScMetric icon={Target} label="Pass at" value={`${assessment.pass_percentage}%`} tone="teal" />
                              <ScMetric icon={Users} label="Taken" value={assessment.sessions_count} tone="violet" />
                            </div>

                            {assessment.status === "draft" && needsQuestions && (
                              <ScNotice tone="amber" className="mt-3">
                                Attach at least one question first — then you can publish.
                              </ScNotice>
                            )}
                          </div>

                          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
                            <HpButton
                              variant={assessment.status === "draft" && needsQuestions ? "primary" : "secondary"}
                              size="sm"
                              leftIcon={<ListChecks className="h-3.5 w-3.5" />}
                              onClick={() => setManaging(assessment)}
                            >
                              Manage Questions
                            </HpButton>
                            <div className="ml-auto flex items-center gap-1.5">
                              {assessment.status === "draft" && (
                                <HpButton
                                  size="sm"
                                  onClick={() => handlePublish(assessment)}
                                  disabled={needsQuestions}
                                  title={needsQuestions ? "Attach at least one question first" : undefined}
                                  leftIcon={<Rocket className="h-3.5 w-3.5" />}
                                >
                                  Publish
                                </HpButton>
                              )}
                              <ScIconButton icon={Trash2} label="Delete" tone="danger" onClick={() => handleDelete(assessment)} />
                            </div>
                          </div>
                        </HpCard>
                      </ScReveal>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </HpItem>
        </HpStagger>

        {showCreate && (
          <CreateSoftSkillAssessmentModal
            variant="premium"
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
            variant="premium"
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
