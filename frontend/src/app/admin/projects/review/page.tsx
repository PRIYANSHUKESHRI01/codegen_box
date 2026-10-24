"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, Download, ExternalLink, FileArchive, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AccessDeniedNotice } from "@/components/admin/AccessDeniedNotice";
import { AuthorshipCard } from "@/components/admin/projectLab/AuthorshipCard";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { api, ApiError } from "@/lib/api";
import { userHasPermission } from "@/lib/auth";
import { SUBMISSION_STATUS_META, errorMessage, formatBytes, saveBlob } from "@/lib/projectLab";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { cn } from "@/lib/utils";
import type { AdminSubmissionDetail } from "@/types/projectLab";

interface RubricRow {
  criterion: string;
  score: string;
  max: string;
}

// No width in the base: Tailwind emits w-full after w-14/w-24, so combining them lets w-full win and squashes its neighbours.
const inputBase =
  "rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-medium text-primary outline-none placeholder:text-text-muted focus:border-accent-primary";
const inputClass = `w-full ${inputBase}`;
const DEFAULT_RUBRIC: RubricRow[] = [
  { criterion: "Meets the acceptance criteria", score: "", max: "40" },
  { criterion: "Code quality and structure", score: "", max: "25" },
  { criterion: "Security and validation", score: "", max: "20" },
  { criterion: "Documentation and setup", score: "", max: "15" },
];

export default function ReviewSubmissionPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const { status, user } = useAuthGuard(["admin_internal", "superadmin"]);
  const hasAccess = userHasPermission(user, "project_lab");
  const id = useSearchParams().get("id");

  const [s, setS] = useState<AdminSubmissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rubric, setRubric] = useState<RubricRow[]>(DEFAULT_RUBRIC);
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const adopt = useCallback((d: AdminSubmissionDetail) => {
    setS(d);
    setFeedback(d.feedback ?? "");
    setScore(d.score === null ? "" : String(d.score));
    setRubric(d.rubric.length > 0 ? d.rubric.map((r) => ({ criterion: r.criterion, score: String(r.score), max: String(r.max) })) : DEFAULT_RUBRIC);
  }, []);

  useEffect(() => {
    if (status !== "ready" || !hasAccess || !id) return;
    api
      .get<{ submission: AdminSubmissionDetail }>(`/admin/project-lab/submissions/${encodeURIComponent(id)}`)
      .then((res) => adopt(res.submission))
      .catch((err) => setError(errorMessage(err, "We couldn't load this submission.")));
  }, [status, hasAccess, id, adopt]);

  // The rubric is a convenience: its total proposes a score, which the reviewer can overrule.
  const rubricTotal = rubric.reduce((sum, r) => sum + (Number(r.score) || 0), 0);
  const rubricMax = rubric.reduce((sum, r) => sum + (Number(r.max) || 0), 0);

  const submit = async (outcome: "in_review" | "reviewed" | "needs_changes") => {
    setBusy(outcome);
    setFormError(null);
    setSaved(null);
    try {
      const filled = rubric.filter((r) => r.criterion.trim() && r.score !== "");
      const res = await api.post<{ submission: AdminSubmissionDetail }>(`/admin/project-lab/submissions/${id}/review`, {
        status: outcome,
        score: score === "" ? null : Number(score),
        rubric: filled.map((r) => ({ criterion: r.criterion.trim(), score: Number(r.score), max: Number(r.max) || 1 })),
        feedback: feedback.trim() || null,
      });
      adopt(res.submission);
      setSaved(outcome === "reviewed" ? "Reviewed — the student can see their score." : outcome === "needs_changes" ? "Sent back to the student for changes." : "Marked as in review.");
    } catch (err) {
      setFormError(err instanceof ApiError && err.errors ? Object.values(err.errors).flat()[0] : errorMessage(err, "We couldn't save that review."));
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!s) return;
    setBusy("download");
    try {
      saveBlob(await api.getFile(`/admin/project-lab/submissions/${s.id}/snapshot`), `${s.student.name.replace(/\W+/g, "-")}-${s.topic.slug}-attempt-${s.attempt}.tgz`);
    } catch (err) {
      setFormError(errorMessage(err, "We couldn't download the snapshot."));
    } finally {
      setBusy(null);
    }
  };

  if (status !== "ready") return <SessionLoader />;

  if (!hasAccess) {
    return (
      <DashboardShell role="admin_internal" title="Review">
        <AccessDeniedNotice section="Project Lab" />
      </DashboardShell>
    );
  }

  const final = s?.status === "reviewed";

  return (
    <DashboardShell role="admin_internal" title={s ? `${s.student.name} — ${s.topic.title}` : "Review submission"} subtitle={s ? `Attempt ${s.attempt}` : undefined}>
      {error && (
        <div role="alert" className="rounded-panel border border-status-danger/30 bg-status-danger/10 p-5 text-sm text-status-danger">
          {error}
        </div>
      )}
      {!s && !error && (
        <div className="flex items-center gap-2 py-10 text-xs text-text-secondary" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      )}

      {s && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── The work ── */}
          <div className="space-y-6">
            <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-primary">{s.student.name}</p>
                  <p className="text-xs text-text-secondary">{s.student.email}</p>
                </div>
                <span className={cn("rounded-full border px-2.5 py-1 text-3xs font-bold uppercase tracking-wide", SUBMISSION_STATUS_META[s.status].className)}>
                  {SUBMISSION_STATUS_META[s.status].label}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {s.has_snapshot ? (
                  <button
                    type="button"
                    onClick={download}
                    disabled={busy === "download"}
                    className="inline-flex items-center gap-2 rounded-btn bg-accent-primary px-4 py-2 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:opacity-60"
                  >
                    {busy === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    Download code ({formatBytes(s.snapshot_size_bytes)})
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary">
                    <FileArchive className="h-4 w-4" />
                    No code snapshot
                  </span>
                )}
                {s.repo_url && (
                  <a href={s.repo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline">
                    Repository <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {s.live_url && (
                  <a href={s.live_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline">
                    Live demo <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {s.warnings.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {s.warnings.map((w) => (
                    <li key={w} className="flex items-start gap-2 rounded-control border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}

              {s.notes && (
                <div className="mt-4 rounded-control border-l-2 border-accent-primary bg-elevated p-3.5">
                  <p className="text-3xs font-bold uppercase tracking-[0.1em] text-text-secondary">Student&apos;s notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-primary">{s.notes}</p>
                </div>
              )}
            </section>

            <AuthorshipCard evidence={s.integrity} timeline={s.integrity_events} />

            <section className="rounded-panel border border-border-subtle bg-surface shadow-subtle">
              <div className="flex items-baseline justify-between border-b border-border-subtle px-5 py-3.5">
                <h2 className="text-sm font-extrabold text-primary">Milestones to check</h2>
                <span className="text-xs font-bold tabular-nums text-text-secondary">
                  {s.milestones_done} of {s.milestones_total} ticked by the student
                </span>
              </div>
              <ol className="divide-y divide-border-subtle">
                {s.milestones.map((m, i) => (
                  <li key={m.id} className="px-5 py-4">
                    <p className="flex items-start gap-2.5 text-sm font-bold text-primary">
                      {m.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="Ticked" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-label="Not ticked" />}
                      {i + 1}. {m.title}
                    </p>
                    {m.acceptance_criteria.length > 0 && (
                      <ul className="mt-2 space-y-1 pl-[1.625rem]">
                        {m.acceptance_criteria.map((c) => (
                          <li key={c} className="text-xs leading-snug text-text-secondary before:mr-2 before:content-['☐']">
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            {s.previous_attempts.length > 0 && (
              <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
                <h2 className="text-sm font-extrabold text-primary">Earlier attempts</h2>
                <ul className="mt-3 space-y-2">
                  {s.previous_attempts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-xs">
                      <Link href={`/admin/projects/review?id=${p.id}`} className="font-bold text-accent-primary hover:underline">
                        Attempt {p.attempt}
                      </Link>
                      <span className="text-text-secondary">
                        {SUBMISSION_STATUS_META[p.status].label}
                        {p.score !== null ? ` · ${p.score}/100` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* ── The verdict ── */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
              <h2 className="text-sm font-extrabold text-primary">Your review</h2>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-[0.08em] text-text-secondary">Rubric (optional)</span>
                  <button type="button" onClick={() => setRubric((r) => [...r, { criterion: "", score: "", max: "10" }])} className="inline-flex items-center gap-1 text-2xs font-bold text-accent-primary hover:underline">
                    <Plus className="h-3 w-3" />
                    Add row
                  </button>
                </div>
                {rubric.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input value={r.criterion} onChange={(e) => setRubric((p) => p.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)))} aria-label={`Criterion ${i + 1}`} className={`${inputBase} min-w-0 flex-1`} placeholder="Criterion" />
                    <input value={r.score} onChange={(e) => setRubric((p) => p.map((x, j) => (j === i ? { ...x, score: e.target.value.replace(/[^\d.]/g, "") } : x)))} aria-label={`Score ${i + 1}`} inputMode="decimal" className={`${inputBase} w-14 shrink-0 text-right`} placeholder="0" />
                    <span className="text-xs text-text-secondary">/</span>
                    <input value={r.max} onChange={(e) => setRubric((p) => p.map((x, j) => (j === i ? { ...x, max: e.target.value.replace(/[^\d.]/g, "") } : x)))} aria-label={`Maximum ${i + 1}`} inputMode="decimal" className={`${inputBase} w-14 shrink-0`} />
                    <button type="button" onClick={() => setRubric((p) => p.filter((_, j) => j !== i))} aria-label="Remove row" className="rounded-control p-1.5 text-text-secondary hover:bg-status-danger/10 hover:text-status-danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <p className="text-right text-2xs font-semibold text-text-secondary">
                  Rubric total {rubricTotal} / {rubricMax}
                  {rubricMax > 0 && (
                    <button type="button" onClick={() => setScore(String(Math.round((100 * rubricTotal) / rubricMax)))} className="ml-2 font-bold text-accent-primary hover:underline">
                      Use as score
                    </button>
                  )}
                </p>
              </div>

              <label className="mt-4 block">
                <span className="mb-1 block text-2xs font-bold uppercase tracking-[0.08em] text-text-secondary">Score (0–100)</span>
                <input value={score} onChange={(e) => setScore(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" className={`${inputBase} w-24`} />
              </label>

              <label className="mt-4 block">
                <span className="mb-1 block text-2xs font-bold uppercase tracking-[0.08em] text-text-secondary">Feedback for the student</span>
                <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={7} maxLength={8000} placeholder="What works, what must change, and why — be specific." className={`${inputClass} resize-y`} />
              </label>

              {formError && (
                <p role="alert" className="mt-3 flex items-start gap-2 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {formError}
                </p>
              )}
              {saved && <p role="status" className="mt-3 rounded-control border border-status-success/30 bg-status-success/10 p-3 text-xs font-semibold text-status-success">{saved}</p>}

              <div className="mt-5 grid gap-2">
                <button type="button" onClick={() => submit("reviewed")} disabled={busy !== null || score === ""} className="flex items-center justify-center gap-2 rounded-btn bg-accent-primary py-2.5 text-xs font-bold text-white hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
                  {busy === "reviewed" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {final ? "Update review" : "Approve and score"}
                </button>
                <button type="button" onClick={() => submit("needs_changes")} disabled={busy !== null || feedback.trim() === ""} className="flex items-center justify-center gap-2 rounded-btn border border-rose-500/40 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300">
                  {busy === "needs_changes" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Request changes
                </button>
                {s.status === "pending_review" && (
                  <button type="button" onClick={() => submit("in_review")} disabled={busy !== null} className="rounded-btn border border-border-strong bg-elevated py-2.5 text-xs font-bold text-primary hover:bg-surface-hover disabled:opacity-50">
                    Mark as in review
                  </button>
                )}
              </div>
              <p className="mt-3 text-2xs leading-snug text-text-secondary">
                Approving finishes the project. Requesting changes hands it back so the student can fix it and submit again; feedback is required.
              </p>
            </section>
          </aside>
        </div>
      )}
    </DashboardShell>
  );
}
