"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, CheckCircle2, ClipboardCheck, Code2, Lock, Mic, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LaunchpadProgramBanner } from "@/components/dashboard/home/LaunchpadProgramBanner";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StudentCollegeAssessment, StudentLaunchpadCampaign } from "@/types/collegeAssessment";

export default function StudentAssessmentsPage() {
  const { status } = useAuthGuard(["user"]);
  const [assessments, setAssessments] = useState<StudentCollegeAssessment[]>([]);
  const [campaignSlugs, setCampaignSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;
    Promise.all([
      api.get<{ assessments: StudentCollegeAssessment[] }>("/assessments"),
      api.get<{ campaigns: StudentLaunchpadCampaign[] }>("/assessments/campaigns").catch(() => ({ campaigns: [] })),
    ])
      .then(([res, campRes]) => {
        if (!cancelled) {
          const slugs = new Set<string>();
          for (const c of campRes.campaigns ?? []) {
            for (const item of c.assessments ?? []) {
              slugs.add(item.slug);
            }
          }
          setCampaignSlugs(slugs);
          setAssessments(res.assessments ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load your assessments.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status !== "ready" || loading) return <SessionLoader />;

  const standaloneAssessments = assessments.filter((a) => !campaignSlugs.has(a.slug));

  return (
    <DashboardShell
      role="user"
      title="Campus Assessments"
      subtitle="Multi-round placement assessments assigned to your college, branch, or cohort."
    >
      {error && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      <LaunchpadProgramBanner variant="full" className="mb-6" />

      {assessments.length === 0 && campaignSlugs.size === 0 ? (
        <div className="rounded-panel border border-dashed border-border-subtle bg-surface p-12 text-center">
          <ClipboardCheck className="mx-auto h-10 w-10 text-text-muted/60" />
          <h2 className="mt-3 text-base font-extrabold text-primary">No assessments assigned right now</h2>
          <p className="mt-1 text-xs text-text-muted">
            When your placement cell or SuperAdmin schedules a campus assessment for your branch, it will appear here.
          </p>
        </div>
      ) : standaloneAssessments.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {standaloneAssessments.map((a) => {
            const pct = a.modules_total > 0 ? Math.round((a.modules_completed / a.modules_total) * 100) : 0;
            return (
              <div
                key={a.id}
                className="flex flex-col justify-between rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle transition hover:border-primary/40"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase",
                        a.assignment_status === "completed" && "bg-emerald-500/15 text-emerald-700",
                        a.assignment_status === "in_progress" && "bg-amber-500/15 text-amber-700",
                        a.assignment_status === "assigned" && "bg-primary/10 text-primary"
                      )}
                    >
                      {a.assignment_status.replace("_", " ")}
                    </span>
                    {a.overall_score_percent !== null && (
                      <span className="text-sm font-extrabold text-primary">
                        Score: {a.overall_score_percent}%
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-base font-extrabold text-primary">{a.title}</h2>
                    {a.description && <p className="mt-1 text-xs text-text-muted line-clamp-2">{a.description}</p>}
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {a.modules.soft_skills.enabled && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 font-semibold text-blue-700">
                        <Sparkles className="h-3 w-3" /> Soft Skills
                        {a.modules.soft_skills.completed && <CheckCircle2 className="h-3 w-3" />}
                      </span>
                    )}
                    {a.modules.coding.enabled && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-1 font-semibold text-violet-700">
                        <Code2 className="h-3 w-3" /> Coding
                        {a.modules.coding.completed && <CheckCircle2 className="h-3 w-3" />}
                      </span>
                    )}
                    {a.modules.interview.enabled && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-700">
                        <Mic className="h-3 w-3" /> AI Interview
                        {a.modules.interview.completed && <CheckCircle2 className="h-3 w-3" />}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>
                        Progress: {a.modules_completed}/{a.modules_total} rounds
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                    {a.enforce_sequence && (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Sequential
                      </span>
                    )}
                    {a.ends_at && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due {new Date(a.ends_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/dashboard/assessments/view?slug=${encodeURIComponent(a.slug)}`}
                    className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-1.5 text-xs font-bold text-white hover:opacity-90"
                  >
                    {a.assignment_status === "completed" ? "View Scorecard" : "Open Assessment"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </DashboardShell>
  );
}
