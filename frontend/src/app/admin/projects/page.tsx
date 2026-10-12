"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ClipboardCheck, FlaskConical, Loader2, Minus, Pencil, Plus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { api } from "@/lib/api";
import { userHasPermission } from "@/lib/auth";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { AUTHORSHIP_LABEL_META, DIFFICULTY_META, SUBMISSION_STATUS_META, errorMessage, formatBytes } from "@/lib/projectLab";
import { cn } from "@/lib/utils";
import type { AdminSubmissionRow, AdminTopicRow, TopicStatus } from "@/types/projectLab";

const STATUS_STYLE: Record<TopicStatus, string> = {
  draft: "bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300",
  published: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300",
  archived: "bg-elevated border-border-subtle text-text-secondary",
};

type Tab = "topics" | "review";
type QueueFilter = "open" | "needs_changes" | "reviewed" | "all";

export default function AdminProjectLabPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <AdminProjectLabContent />
    </Suspense>
  );
}

function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
}

function AdminProjectLabContent() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "project_lab");
  const router = useRouter();
  const tab: Tab = useSearchParams().get("tab") === "review" ? "review" : "topics";

  const [topics, setTopics] = useState<AdminTopicRow[]>([]);
  const [queue, setQueue] = useState<AdminSubmissionRow[]>([]);
  const [counts, setCounts] = useState({ pending_review: 0, in_review: 0 });
  const [filter, setFilter] = useState<QueueFilter>("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "topics") {
        setTopics((await api.get<{ topics: AdminTopicRow[] }>("/admin/project-lab/topics")).topics);
      }
      const q = await api.get<{ submissions: AdminSubmissionRow[]; counts: typeof counts }>(`/admin/project-lab/submissions?status=${filter}`);
      setQueue(q.submissions);
      setCounts(q.counts);
    } catch (err) {
      setError(errorMessage(err, "Couldn't load Project Lab."));
    } finally {
      setLoading(false);
    }
  }, [tab, filter]);

  useEffect(() => {
    if (status === "ready" && hasAccess) load();
  }, [status, hasAccess, load]);

  if (status !== "ready") return <SessionLoader />;

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="Project Lab">
        <AccessDeniedNotice section="Project Lab" />
      </DashboardShell>
    );
  }

  const awaiting = counts.pending_review + counts.in_review;

  return (
    <DashboardShell
      role="admin_internal"
      title="Project Lab"
      subtitle="Write project SOWs and review what students submit."
      actionButton={{ label: "New project", icon: Plus, onClick: () => router.push("/admin/projects/edit") }}
    >
      <div role="tablist" aria-label="Project Lab sections" className="flex gap-1 border-b border-border-subtle">
        {(
          [
            ["topics", "Projects", FlaskConical],
            ["review", "Review queue", ClipboardCheck],
          ] as const
        ).map(([key, label, Icon]) => (
          <Link
            key={key}
            href={key === "topics" ? "/admin/projects" : "/admin/projects?tab=review"}
            role="tab"
            aria-selected={tab === key}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors",
              tab === key ? "border-accent-primary text-accent-primary" : "border-transparent text-text-secondary hover:text-primary"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {key === "review" && awaiting > 0 && (
              <span className="rounded-full bg-accent-primary px-2 py-0.5 text-3xs font-bold tabular-nums text-white">{awaiting}</span>
            )}
          </Link>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-4 text-sm text-status-danger">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-10 text-xs text-text-secondary" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}

      {/* ── Projects ── */}
      {!loading && tab === "topics" && (
        <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
          {topics.length === 0 ? (
            <div className="p-10 text-center">
              <FlaskConical className="mx-auto h-9 w-9 text-text-muted" />
              <p className="mt-3 text-sm font-bold text-primary">No projects yet</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-text-secondary">
                Add the first project, write its SOW (the editor can insert the standard structure) and list its milestones. Students only see it once you publish.
              </p>
              <Link href="/admin/projects/edit" className="mt-4 inline-flex items-center gap-2 rounded-btn bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover">
                <Plus className="h-3.5 w-3.5" />
                New project
              </Link>
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-border-subtle bg-elevated text-2xs font-bold uppercase tracking-[0.08em] text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Project</th>
                  <th className="px-3 py-3">Level</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-center">SOW</th>
                  <th className="px-3 py-3 text-right">Milestones</th>
                  <th className="px-3 py-3 text-right">Students</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {topics.map((t) => (
                  <tr key={t.id} className="hover:bg-elevated/50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-primary">
                        {t.title}
                        {t.is_free_sample && <span className="ml-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-3xs font-bold uppercase text-emerald-700 dark:text-emerald-300">Free sample</span>}
                      </p>
                      <p className="mt-0.5 text-2xs text-text-secondary">{t.category} · ~{t.estimated_hours} h</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", DIFFICULTY_META[t.difficulty].className)}>{DIFFICULTY_META[t.difficulty].label}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", STATUS_STYLE[t.status])}>{t.status}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {t.has_sow ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" aria-label={`SOW v${t.sow_version} written`} /> : <Minus className="mx-auto h-4 w-4 text-text-muted" aria-label="No SOW yet" />}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.milestone_count}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{t.enrollment_count}</td>
                    <td className="px-3 py-3 text-text-secondary">{formatWhen(t.updated_at)}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/admin/projects/edit?id=${t.id}`} className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-2.5 py-1.5 text-2xs font-bold text-primary hover:bg-surface-hover">
                        <Pencil className="h-3 w-3" />
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Review queue ── */}
      {!loading && tab === "review" && (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-control border border-border-subtle bg-elevated p-0.5 sm:w-fit" role="group" aria-label="Filter submissions">
            {(
              [
                ["open", "Needs review"],
                ["needs_changes", "Changes requested"],
                ["reviewed", "Reviewed"],
                ["all", "All"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cn("rounded-control px-3 py-1.5 text-2xs font-bold transition-colors", filter === key ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-panel border border-border-subtle bg-surface shadow-subtle">
            {queue.length === 0 ? (
              <p className="p-10 text-center text-sm text-text-secondary">{filter === "open" ? "Nothing is waiting for review." : "No submissions here."}</p>
            ) : (
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-border-subtle bg-elevated text-2xs font-bold uppercase tracking-[0.08em] text-text-secondary">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-3 py-3">Project</th>
                    <th className="px-3 py-3 text-right">Attempt</th>
                    <th className="px-3 py-3 text-right">Milestones</th>
                    <th className="px-3 py-3">Code</th>
                    <th className="px-3 py-3">Authorship</th>
                    <th className="px-3 py-3">Submitted</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {queue.map((s) => (
                    <tr key={s.id} className="hover:bg-elevated/50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-primary">{s.student.name}</p>
                        <p className="mt-0.5 text-2xs text-text-secondary">{s.student.email}</p>
                      </td>
                      <td className="px-3 py-3 font-semibold text-primary">{s.topic.title}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{s.attempt}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {s.milestones_done}/{s.milestones_total}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{s.has_snapshot ? formatBytes(s.snapshot_size_bytes) : s.repo_url ? "Repo link" : "—"}</td>
                      <td className="px-3 py-3">
                        {s.authorship ? (
                          <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", AUTHORSHIP_LABEL_META[s.authorship].className)}>
                            {AUTHORSHIP_LABEL_META[s.authorship].label}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{formatWhen(s.submitted_at)}</td>
                      <td className="px-3 py-3">
                        <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", SUBMISSION_STATUS_META[s.status].className)}>
                          {SUBMISSION_STATUS_META[s.status].label}
                        </span>
                        {s.score !== null && <span className="ml-2 font-mono font-bold text-primary">{s.score}</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link href={`/admin/projects/review?id=${s.id}`} className="inline-flex items-center gap-1.5 rounded-control bg-accent-primary px-3 py-1.5 text-2xs font-bold text-white hover:bg-accent-primary-hover">
                          {s.status === "pending_review" || s.status === "in_review" ? "Review" : "Open"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
