"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  ListChecks,
  Loader2,
  Lock,
  Play,
  Target,
  TriangleAlert,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MarkdownRenderer } from "@/components/dashboard/articles/MarkdownRenderer";
import { PurchasePanel } from "@/components/dashboard/projectLab/PurchasePanel";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { api, ApiError } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { DIFFICULTY_META, errorMessage, isProjectLabRequired, saveBlob } from "@/lib/projectLab";
import { cn } from "@/lib/utils";
import type { EnrollmentResponse, ProjectLabSummary, ProjectTopicDetail, TopicResponse } from "@/types/projectLab";

export default function ProjectViewPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <ProjectViewContent />
    </Suspense>
  );
}

function ProjectViewContent() {
  const { status } = useAuthGuard(["user"]);
  const router = useRouter();
  const slug = useSearchParams().get("slug") ?? "";

  const [topic, setTopic] = useState<ProjectTopicDetail | null>(null);
  const [summary, setSummary] = useState<ProjectLabSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!slug) {
      setLoadError("No project selected.");
      return;
    }
    try {
      const res = await api.get<TopicResponse>(`/project-lab/topics/${encodeURIComponent(slug)}`);
      setTopic(res.topic);
      setSummary(res.project_lab);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status === 404 ? "This project isn't available." : errorMessage(err, "We couldn't load this project."));
    }
  }, [slug]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  const start = async () => {
    setStarting(true);
    setActionError(null);
    try {
      const res = await api.post<EnrollmentResponse>(`/project-lab/topics/${encodeURIComponent(slug)}/start`);
      router.push(`/dashboard/projects/workspace?id=${res.enrollment.id}`);
    } catch (err) {
      if (isProjectLabRequired(err)) {
        await load(); // the plan lapsed since the page loaded — show the unlock panel
      }
      setActionError(errorMessage(err, "We couldn't start this project. Please try again."));
      setStarting(false);
    }
  };

  const download = async () => {
    if (!topic) return;
    setDownloading(true);
    setActionError(null);
    try {
      const blob = await api.getFile(`/project-lab/topics/${encodeURIComponent(slug)}/sow.pdf`);
      saveBlob(blob, `SOW-${topic.slug}-v${topic.sow_version}.pdf`);
    } catch (err) {
      setActionError(errorMessage(err, "We couldn't prepare the PDF. Please try again."));
    } finally {
      setDownloading(false);
    }
  };

  if (status !== "ready") return <SessionLoader />;

  const unlocked = summary?.enabled ?? false;
  const enrollment = topic?.enrollment ?? null;
  const difficulty = topic ? DIFFICULTY_META[topic.difficulty] : null;

  return (
    <DashboardShell role="user" title={topic?.title ?? "Project"} subtitle={topic?.category}>
      <Link
        href="/dashboard/projects"
        className="-mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All projects
      </Link>

      {loadError && (
        <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-5 text-sm text-status-danger">
          {loadError}
        </div>
      )}

      {!topic && !loadError && (
        <div className="space-y-4" aria-busy="true">
          <div className="h-44 animate-pulse rounded-panel border border-border-subtle bg-surface" />
          <div className="h-96 animate-pulse rounded-panel border border-border-subtle bg-surface" />
        </div>
      )}

      {topic && summary && difficulty && (
        <>
          {/* ── Overview ───────────────────────────────────────────────── */}
          <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2.5 py-1 text-3xs font-bold uppercase tracking-wide", difficulty.className)}>
                {difficulty.label}
              </span>
              {topic.is_free_sample && (
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-3xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Free sample
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Clock3 className="h-3.5 w-3.5" />~{topic.estimated_hours} hours
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <ListChecks className="h-3.5 w-3.5" />
                {topic.milestone_count} milestone{topic.milestone_count === 1 ? "" : "s"}
              </span>
              {topic.has_sow && <span className="text-xs font-semibold text-text-secondary">SOW v{topic.sow_version}</span>}
            </div>

            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-text-secondary sm:text-[15px]">{topic.summary}</p>

            {topic.tech_stack.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {topic.tech_stack.map((t) => (
                  <span key={t} className="rounded-md border border-border-subtle bg-elevated px-2.5 py-1 text-xs font-semibold text-text-secondary">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {topic.outcomes.length > 0 && (
              <div className="mt-5">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-text-secondary">
                  <Target className="h-3.5 w-3.5" />
                  What you&apos;ll build and learn
                </h2>
                <ul className="mt-2.5 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {topic.outcomes.map((o) => (
                    <li key={o} className="flex items-start gap-2 text-sm text-text-secondary">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Actions ── */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border-subtle pt-5">
              {unlocked ? (
                enrollment && enrollment.status !== "abandoned" ? (
                  <Link
                    href={`/dashboard/projects/workspace?id=${enrollment.id}`}
                    className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-5 py-2.5 text-sm font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover hover:shadow-glow"
                  >
                    {enrollment.status === "reviewed" ? "See your result" : enrollment.status === "submitted" ? "View your submission" : "Open workspace"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={start}
                    disabled={starting || !topic.has_sow}
                    className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-5 py-2.5 text-sm font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    {enrollment?.status === "abandoned" ? "Resume project" : "Start this project"}
                  </button>
                )
              ) : (
                <a
                  href="#unlock"
                  className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-5 py-2.5 text-sm font-bold text-white shadow-subtle transition-all hover:bg-accent-primary-hover hover:shadow-glow"
                >
                  <Lock className="h-4 w-4" />
                  Unlock to start building
                </a>
              )}

              {topic.can_download_sow && (
                <button
                  type="button"
                  onClick={download}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-btn border border-border-strong bg-elevated px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-surface-hover disabled:opacity-60"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download SOW (PDF)
                </button>
              )}
            </div>

            {actionError && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {actionError}
              </p>
            )}

            {enrollment && !topic.has_sow && <p className="mt-3 text-xs text-text-secondary">This project&apos;s SOW is being finalised.</p>}
          </section>

          {/* ── Unlock (instead of the SOW) ────────────────────────────── */}
          {!unlocked && (
            <div id="unlock" className="scroll-mt-24">
              <PurchasePanel
                summary={summary}
                onPurchased={(s) => {
                  setSummary(s);
                  load();
                }}
              />
            </div>
          )}

          {/* ── SOW + milestones ───────────────────────────────────────── */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section aria-labelledby="sow-heading" className="min-w-0 rounded-panel border border-border-subtle bg-surface shadow-subtle">
              <div className="flex items-center gap-2.5 border-b border-border-subtle px-5 py-3.5 sm:px-7">
                <FileText className="h-4 w-4 text-accent-primary" />
                <h2 id="sow-heading" className="text-sm font-extrabold text-primary">
                  Statement of Work
                </h2>
              </div>
              <div className="px-5 py-6 sm:px-8">
                {topic.sow_locked ? (
                  <div className="py-10 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-text-secondary">
                      <Lock className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-sm font-bold text-primary">The Statement of Work is part of Project Lab</p>
                    <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-text-secondary">
                      The full scope, requirements, data model and acceptance criteria unlock with Project Lab.
                    </p>
                  </div>
                ) : topic.sow_markdown ? (
                  <MarkdownRenderer content={topic.sow_markdown} />
                ) : (
                  <p className="py-6 text-sm text-text-secondary">This project&apos;s SOW is being finalised.</p>
                )}
              </div>
            </section>

            <aside aria-labelledby="milestones-heading" className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-panel border border-border-subtle bg-surface shadow-subtle">
                <div className="flex items-center gap-2.5 border-b border-border-subtle px-5 py-3.5">
                  <ListChecks className="h-4 w-4 text-accent-primary" />
                  <h2 id="milestones-heading" className="text-sm font-extrabold text-primary">
                    Milestones
                  </h2>
                </div>
                <ol className="divide-y divide-border-subtle">
                  {topic.milestones.map((m, i) => (
                    <li key={m.id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-primary/10 text-2xs font-black text-accent-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-snug text-primary">{m.title}</p>
                          <p className="mt-0.5 text-2xs font-semibold text-text-secondary">~{m.estimated_hours} h</p>
                          {m.description && <p className="mt-2 text-xs leading-relaxed text-text-secondary">{m.description}</p>}
                          {m.acceptance_criteria.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {m.acceptance_criteria.map((c) => (
                                <li key={c} className="flex items-start gap-1.5 text-xs text-text-secondary">
                                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                {!unlocked && topic.milestones.length > 0 && (
                  <p className="border-t border-border-subtle px-5 py-3 text-2xs font-medium text-text-secondary">
                    Descriptions and acceptance criteria unlock with Project Lab.
                  </p>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
