"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BellRing, CheckCircle2, Clock, Download, FileText, Gauge, History, Mic, ShieldAlert, Target, UserX, Users } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ReviewSessionsModal } from "@/components/dashboard/interviews/ReviewSessionsModal";
import { HpButton, HpCard, HpEmptyState, HpItem, HpPill, HpSectionHeader, HpStagger, HpStatCard, hpTh, type HpTone } from "@/components/portal/kit";
import { HpErrorCard } from "@/components/portal/pipeline-kit";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { downloadStoredReport, formatBytes, reportWhen, type ReportRecord } from "@/lib/reportDocuments";
import { whenLabel } from "@/lib/interviewSchedule";
import { confirmDialog } from "@/lib/dialogs";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { InterviewResultRow, InterviewResults } from "@/types/interviewReport";

const BASE = "/tpo/interviews";

const TIER_TONE: Record<InterviewResultRow["tier"], HpTone> = { Strong: "emerald", Developing: "sky", "Needs practice": "amber", "Not scored": "slate" };

function scoreTone(score: number | null): string {
  if (score === null) return "text-text-muted";
  return score >= 70 ? "text-emerald-600 dark:text-emerald-300" : score >= 40 ? "text-amber-600 dark:text-amber-300" : "text-rose-600 dark:text-rose-300";
}

function Bar({ value, tone }: { value: number; tone: "good" | "warn" | "bad" | "info" }) {
  const fill = { good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-rose-500", info: "bg-indigo-500" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-elevated" role="img" aria-label={`${value}%`}>
      <div className={cn("h-full rounded-full", fill)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export default function InterviewResultsPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <InterviewResultsContent />
    </Suspense>
  );
}

function InterviewResultsContent() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const slug = useSearchParams().get("slug") ?? "";

  const [data, setData] = useState<InterviewResults | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [history, setHistory] = useState<ReportRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!slug) {
      setState("missing");
      return;
    }
    try {
      const [res, reports] = await Promise.all([
        api.get<InterviewResults>(`${BASE}/${encodeURIComponent(slug)}/results`),
        api.get<{ reports: ReportRecord[] }>(`${BASE}/${encodeURIComponent(slug)}/reports`),
      ]);
      setData(res);
      setHistory(reports.reports);
      setState("ready");
    } catch (err) {
      setState(err instanceof ApiError && err.status === 404 ? "missing" : "error");
    }
  }, [slug]);

  useEffect(() => {
    if (status === "ready") void load();
  }, [status, load]);

  if (status !== "ready") return <SessionLoader />;

  const makeReport = async (path: string, key: string, label: string) => {
    if (busy) return;
    setBusy(key);
    try {
      const res = await api.post<{ report: ReportRecord }>(path);
      await downloadStoredReport(`/tpo/reports/${res.report.id}/download`, res.report.filename);
      toast.success(`${label} is ready and saved to the report archive.`);
      const reports = await api.get<{ reports: ReportRecord[] }>(`${BASE}/${encodeURIComponent(slug)}/reports`);
      setHistory(reports.reports);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't make the report. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const remind = async () => {
    if (!data) return;
    const n = data.participation.not_started;
    if (!(await confirmDialog({ title: "Notify the audience again?", message: `Everyone in the audience (${data.participation.audience} students) gets the in-app notification and an e-mail with the timing. ${n} of them have not started.`, confirmLabel: "Notify" }))) return;
    try {
      const res = await api.post<{ message: string }>(`${BASE}/${encodeURIComponent(slug)}/announce`);
      toast.success(res.message);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send the notification.");
    }
  };

  const reopen = async (r: ReportRecord) => {
    try {
      await downloadStoredReport(`/tpo/reports/${r.id}/download`, r.filename);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't open that report.");
    }
  };

  const i = data?.interview;
  const p = data?.participation;
  const sc = data?.scores;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      back={{ href: "/admin/mock-interviews", label: "Mock interviews" }}
      title={i?.title ?? "Interview results"}
      subtitle={
        i
          ? [i.audience, i.opens_at ? `opens ${whenLabel(i.opens_at)}` : null, i.closes_at ? `closes ${whenLabel(i.closes_at)}` : null].filter(Boolean).join(" · ")
          : "How the students did, who has not started, and a PDF report to keep."
      }
      actionButton={
        data
          ? { label: busy === "cohort" ? "Preparing…" : "Download report (PDF)", icon: Download, onClick: () => void makeReport(`${BASE}/${encodeURIComponent(slug)}/report`, "cohort", "The interview report") }
          : undefined
      }
    >
      {state === "error" && <HpErrorCard message="Couldn't load these results." onRetry={() => void load()} />}
      {state === "missing" && (
        <HpEmptyState icon={Mic} tone="slate" title="Interview not found" description="It may have been deleted, or it isn't one of your college's mock interviews." />
      )}

      {state === "ready" && data && i && p && sc && (
        <HpStagger className="space-y-6">
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
              <HpStatCard label="In audience" value={p.audience} icon={Users} tone="indigo" hint={`${i.question_count} questions`} />
              <HpStatCard label="Completed" value={p.completed} icon={CheckCircle2} tone="emerald" hint={`${p.completion_rate}% of the audience`} />
              <HpStatCard label="Not started" value={p.not_started} icon={UserX} tone={p.not_started > 0 ? "amber" : "slate"} hint={p.in_progress > 0 ? `${p.in_progress} part-way` : "Everyone has begun"} />
              <HpStatCard label="Average score" value={sc.average !== null ? `${Math.round(sc.average)}%` : "—"} icon={Gauge} tone="sky" hint={sc.median !== null ? `median ${Math.round(sc.median)}%` : "No scored sitting yet"} />
              <HpStatCard label={`Reached ${sc.target}%`} value={sc.pass_rate !== null ? `${sc.pass_rate}%` : "—"} icon={Target} tone="violet" hint={`${sc.pass_count} of ${p.scored} scored`} />
            </div>
          </HpItem>

          {data.insights.length > 0 && (
            <HpItem>
              <HpCard spotlight={false} className="p-5">
                <HpSectionHeader title="What this tells you" icon={Gauge} tone="indigo" />
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-13 leading-relaxed text-text-secondary">
                  {data.insights.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {p.audience > 0 && i.status === "published" && (
                  <div className="mt-4">
                    <HpButton variant="secondary" size="sm" leftIcon={<BellRing className="h-3.5 w-3.5" />} onClick={() => void remind()}>
                      Notify the audience again
                    </HpButton>
                  </div>
                )}
              </HpCard>
            </HpItem>
          )}

          <HpItem>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <HpCard spotlight={false} className="p-5">
                <HpSectionHeader title="Score distribution" subtitle="Scored sittings only" icon={Gauge} tone="sky" />
                <div className="mt-4 space-y-2.5">
                  {sc.distribution.map((b, idx) => {
                    const max = Math.max(1, ...sc.distribution.map((x) => x.count));
                    return (
                      <div key={b.label} className="grid grid-cols-[56px_1fr_70px] items-center gap-3 text-2xs">
                        <span className="font-bold text-text-secondary">{b.label}</span>
                        <Bar value={b.count === 0 ? 0 : Math.round((b.count / max) * 100)} tone={idx >= 2 ? "good" : idx === 1 ? "warn" : "bad"} />
                        <span className="tabular text-right text-text-muted"><b className="text-primary">{b.count}</b> student{b.count === 1 ? "" : "s"}</span>
                      </div>
                    );
                  })}
                </div>
              </HpCard>

              <HpCard spotlight={false} className="p-5">
                <HpSectionHeader title="By question type" subtitle="Average score across every answer" icon={Mic} tone="violet" />
                <div className="mt-4 space-y-2.5">
                  {data.categories.length === 0 && <p className="text-2xs text-text-muted">No scored answers yet.</p>}
                  {data.categories.map((c) => (
                    <div key={c.category} className="grid grid-cols-[110px_1fr_96px] items-center gap-3 text-2xs">
                      <span className="truncate font-bold capitalize text-text-secondary">{c.category.replace(/_/g, " ")}</span>
                      <Bar value={c.average} tone={c.average >= 70 ? "good" : c.average >= 40 ? "warn" : "bad"} />
                      <span className="tabular text-right text-text-muted"><b className="text-primary">{c.average}%</b> · {c.answers}</span>
                    </div>
                  ))}
                </div>
              </HpCard>
            </div>
          </HpItem>

          <HpItem>
            <HpCard spotlight={false} className="overflow-hidden">
              <div className="p-5 pb-3">
                <HpSectionHeader title="Question by question" subtitle="Where the group struggled" icon={Mic} tone="indigo" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead className="border-y border-border-subtle bg-elevated/50">
                    <tr>
                      <th className={cn(hpTh, "w-12 px-5")}>#</th>
                      <th className={cn(hpTh, "px-4")}>Question</th>
                      <th className={cn(hpTh, "px-4 text-right")}>Answered</th>
                      <th className={cn(hpTh, "px-4 text-right")}>Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {data.questions.map((q) => (
                      <tr key={q.order}>
                        <td className="px-5 py-3 text-2xs text-text-muted">{q.order}</td>
                        <td className="px-4 py-3 text-13 text-primary">
                          {q.question}
                          {q.category && <span className="ml-2 text-3xs font-bold uppercase text-text-muted">{q.category}</span>}
                        </td>
                        <td className="tabular px-4 py-3 text-right text-2xs text-text-secondary">{q.answered}</td>
                        <td className={cn("tabular px-4 py-3 text-right text-13 font-bold", scoreTone(q.average))}>{q.average !== null ? `${q.average}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </HpCard>
          </HpItem>

          <HpItem>
            <HpCard spotlight={false} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
                <HpSectionHeader title="Every student" subtitle={`${data.students.length} sitting${data.students.length === 1 ? "" : "s"}, best first`} icon={Users} tone="sky" />
                {data.integrity.students_flagged > 0 && (
                  <HpPill tone="rose" icon={ShieldAlert}>
                    {data.integrity.students_flagged} with proctoring strikes
                  </HpPill>
                )}
              </div>
              {data.students.length === 0 ? (
                <p className="px-5 pb-6 text-2xs text-text-muted">Nobody has started yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left">
                    <thead className="border-y border-border-subtle bg-elevated/50">
                      <tr>
                        <th className={cn(hpTh, "w-12 px-5")}>#</th>
                        <th className={cn(hpTh, "px-4")}>Student</th>
                        <th className={cn(hpTh, "px-4")}>Status</th>
                        <th className={cn(hpTh, "px-4 text-right")}>Score</th>
                        <th className={cn(hpTh, "px-4")}>Level</th>
                        <th className={cn(hpTh, "px-4 text-right")}>Strikes</th>
                        <th className={cn(hpTh, "px-4 text-right")}><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {data.students.map((r) => (
                        <tr key={r.session_id} className="hover:bg-elevated/40">
                          <td className="px-5 py-3 text-2xs text-text-muted">{r.rank ?? "—"}</td>
                          <td className="px-4 py-3">
                            <p className="text-13 font-bold text-primary">{r.name}</p>
                            <p className="text-2xs text-text-muted">{r.roll_number ?? "—"}{r.section ? ` · Sec ${r.section}` : ""}</p>
                          </td>
                          <td className="px-4 py-3 text-2xs capitalize text-text-secondary">
                            {r.status.replace("_", " ")}
                            <span className="block text-text-muted">{r.answered}/{r.questions} answered</span>
                          </td>
                          <td className={cn("tabular px-4 py-3 text-right text-sm font-extrabold", scoreTone(r.score))}>
                            {r.score !== null ? `${Math.round(r.score)}%` : r.scoring_failed ? "Review" : "—"}
                          </td>
                          <td className="px-4 py-3"><HpPill tone={TIER_TONE[r.tier]} size="sm">{r.tier}</HpPill></td>
                          <td className={cn("tabular px-4 py-3 text-right text-2xs", r.strikes > 0 ? "font-bold text-rose-600 dark:text-rose-300" : "text-text-muted")}>
                            {r.strikes}{r.locked ? " · locked" : ""}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex gap-1.5">
                              <HpButton variant="ghost" size="sm" onClick={() => setReviewing(r.session_id)} leftIcon={<FileText className="h-3.5 w-3.5" />}>Review</HpButton>
                              <HpButton
                                variant="secondary"
                                size="sm"
                                isLoading={busy === `s${r.session_id}`}
                                onClick={() => void makeReport(`${BASE}/${encodeURIComponent(slug)}/sessions/${r.session_id}/report`, `s${r.session_id}`, `${r.name}'s report`)}
                                leftIcon={<Download className="h-3.5 w-3.5" />}
                              >
                                PDF
                              </HpButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </HpCard>
          </HpItem>

          {data.not_attempted.length > 0 && (
            <HpItem>
              <HpCard spotlight={false} className="p-5">
                <HpSectionHeader title={`Not started (${data.not_attempted.length})`} subtitle="In the audience, but have not opened it" icon={Clock} tone="amber" />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.not_attempted.map((s) => (
                    <span key={s.student_id} className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-2xs text-text-secondary" title={s.roll_number ?? undefined}>
                      <b className="text-primary">{s.name}</b>{s.section ? ` · ${s.section}` : ""}{s.blocked ? " · blocked" : ""}
                    </span>
                  ))}
                </div>
              </HpCard>
            </HpItem>
          )}

          {history.length > 0 && (
            <HpItem>
              <HpCard spotlight={false} className="p-5">
                <HpSectionHeader title="Reports kept" subtitle="Every report made about this interview, exactly as it was" icon={History} tone="slate" />
                <ul className="mt-3 divide-y divide-border-subtle">
                  {history.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-13 font-bold text-primary">{r.student?.name ?? "Whole interview"}</p>
                        <p className="text-2xs text-text-muted">{reportWhen(r.created_at)} · {r.pages ?? "?"} pp · {formatBytes(r.size_bytes)}{r.generated_by?.name ? ` · by ${r.generated_by.name}` : ""}</p>
                      </div>
                      <HpButton variant="secondary" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} onClick={() => void reopen(r)}>PDF</HpButton>
                    </li>
                  ))}
                </ul>
              </HpCard>
            </HpItem>
          )}
        </HpStagger>
      )}

      {reviewing !== null && i && (
        <ReviewSessionsModal basePath={BASE} listEndpoint="sessions" interviewSlug={i.slug} interviewTitle={i.title} initialSessionId={reviewing} onClose={() => { setReviewing(null); void load(); }} />
      )}
    </DashboardShell>
  );
}
