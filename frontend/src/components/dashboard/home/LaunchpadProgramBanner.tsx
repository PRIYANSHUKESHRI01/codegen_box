"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Clock,
  Code2,
  Gauge,
  Lock,
  Mic,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StudentLaunchpadCampaign } from "@/types/collegeAssessment";

interface CountdownParts {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeCountdown(endsAtIso: string | null, nowMs: number): CountdownParts {
  if (!endsAtIso) {
    return { expired: false, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const endMs = new Date(endsAtIso).getTime();
  const diffSec = Math.max(0, Math.floor((endMs - nowMs) / 1000));
  if (diffSec <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const minutes = Math.floor((diffSec % 3600) / 60);
  const seconds = diffSec % 60;
  return { expired: false, days, hours, minutes, seconds };
}

function CountdownWidget({
  endsAt,
  isOpen,
  nowMs,
  compact = false,
}: {
  endsAt: string | null;
  isOpen: boolean;
  nowMs: number;
  compact?: boolean;
}) {
  const countdown = computeCountdown(endsAt, nowMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  const finalDay = countdown.days === 0 && !countdown.expired && isOpen;

  const units = [
    ...(countdown.days > 0 ? [{ value: String(countdown.days), label: "Days" }] : []),
    { value: pad(countdown.hours), label: "Hrs" },
    { value: pad(countdown.minutes), label: "Mins" },
    { value: pad(countdown.seconds), label: "Secs", accent: true },
  ];

  return (
    <div
      className={cn(
        "shrink-0 rounded-xl border bg-background/85 backdrop-blur-sm transition-colors",
        compact ? "px-3.5 py-2" : "px-4 py-3",
        finalDay
          ? "border-amber-500/40 bg-amber-500/[0.04]"
          : "border-border-subtle"
      )}
    >
      <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
        <Clock className={cn("h-3 w-3", finalDay ? "text-amber-500" : "text-indigo-500")} />
        {countdown.expired || !isOpen
          ? "Window Closed"
          : finalDay
          ? "Final Hours"
          : "Time Remaining"}
      </div>
      {countdown.expired || !isOpen ? (
        <div className="mt-1 text-center text-xs font-extrabold text-rose-600">Deadline Ended</div>
      ) : (
        <div className="mt-1.5 flex items-baseline justify-center gap-2 tabular-nums">
          {units.map((u, idx) => (
            <div key={u.label} className="flex items-baseline gap-2">
              {idx > 0 && <span className="text-sm font-bold text-text-muted/50 select-none">:</span>}
              <div className="text-center min-w-[26px]">
                <div
                  className={cn(
                    "font-extrabold leading-none tracking-tight",
                    compact ? "text-base" : "text-lg",
                    u.accent
                      ? finalDay
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-indigo-600 dark:text-indigo-400"
                      : "text-primary"
                  )}
                >
                  {u.value}
                </div>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-text-muted">
                  {u.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Displays active "Mellow Vault Multi-Disciplinary Internship & Launchpad Program 2026" campaigns:
 *  - `variant="compact"`: Sleek single-card hero banner on Student Overview (`/dashboard`) that clicks through to `/dashboard/assessments`.
 *  - `variant="full"`: Complete breakdown inside `/dashboard/assessments` showing Readiness Score Gate, sequential Assessments 1->2->3 lock states, and round status.
 * Returns `null` when the student is not assigned any campaign.
 */
export function LaunchpadProgramBanner({
  variant = "compact",
  className,
}: {
  variant?: "compact" | "full";
  className?: string;
}) {
  const [campaigns, setCampaigns] = useState<StudentLaunchpadCampaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ campaigns: StudentLaunchpadCampaign[] }>("/assessments/campaigns")
      .then((res) => {
        if (!cancelled) {
          setCampaigns(res.campaigns ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (campaigns.length === 0) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [campaigns.length]);

  if (!loaded || campaigns.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {campaigns.map((c) => {
        const isTech = c.track === "tech";

        // ── COMPACT OVERVIEW BANNER (/dashboard) ───────────────────────────────────
        if (variant === "compact") {
          return (
            <Link
              key={c.id}
              href="/dashboard/assessments"
              className="group relative isolate block overflow-hidden rounded-2xl border border-indigo-500/25 bg-surface p-4 sm:p-5 shadow-[0_10px_30px_-18px_rgba(79,70,229,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/50 hover:shadow-[0_20px_44px_-20px_rgba(79,70,229,0.55)]"
            >
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.09] via-violet-500/[0.04] to-emerald-500/[0.05]" />
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
              </div>
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400"
              />

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 text-white shadow-md shadow-indigo-500/30 transition-transform duration-300 group-hover:scale-105">
                    <Rocket className="h-6 w-6" />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-pill bg-indigo-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        {isTech ? <Code2 className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                        {isTech ? "Tech Track · 21 Days" : "Non-Tech Track · 5 Days"}
                      </span>
                      {c.enforce_proctoring && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="h-3 w-3" /> Proctored
                        </span>
                      )}
                      {c.qualified && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                          <CheckCircle2 className="h-3 w-3" /> Qualified
                        </span>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-black tracking-tight text-primary truncate">
                      {c.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                      <span>
                        Reach <strong className="text-primary">{c.min_readiness_percent}%+ Readiness</strong> &amp; clear 3 proctored assessments to qualify.
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-elevated px-2 py-0.5 text-[11px] font-bold text-primary border border-border-subtle">
                        {c.assessments_completed}/{c.assessments_total} Done
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border",
                          c.readiness_met
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/25"
                            : "bg-amber-500/10 text-amber-700 border-amber-500/25"
                        )}
                      >
                        Readiness {c.readiness_score_percent}% / {c.min_readiness_percent}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 shrink-0">
                  <CountdownWidget endsAt={c.ends_at} isOpen={c.is_open} nowMs={nowMs} compact />
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-xs font-extrabold text-white shadow-sm group-hover:opacity-90">
                    Open Program
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        }

        // ── FULL DETAILS VIEW (/dashboard/assessments) ─────────────────────────────
        const readinessDelta = Math.max(0, c.min_readiness_percent - c.readiness_score_percent);

        return (
          <section
            key={c.id}
            className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-[0_8px_30px_-14px_rgba(15,23,42,0.12)]"
          >
            {/* Header Band */}
            <div className="border-b border-border-subtle bg-gradient-to-b from-indigo-500/[0.04] via-transparent to-transparent px-5 py-5 sm:px-7 sm:py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4 max-w-3xl">
                  <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-600/25">
                    <Rocket className="h-5 w-5" />
                  </div>

                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-pill border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-indigo-700 dark:text-indigo-300">
                        {isTech ? <Code2 className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
                        {isTech ? "Tech Track · 21-Day Sprint" : "Non-Tech Track · 5-Day Sprint"}
                      </span>

                      {c.enforce_proctoring && (
                        <span className="inline-flex items-center gap-1.5 rounded-pill border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Proctored
                        </span>
                      )}

                      <span className="inline-flex items-center rounded-pill border border-border-subtle bg-elevated px-2.5 py-0.5 text-[11px] font-semibold text-text-secondary">
                        Target: {c.min_readiness_percent}%+ Readiness &amp; {c.passing_score_percent}%+ Avg
                      </span>

                      {c.qualified && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-emerald-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                          <CheckCircle2 className="h-3 w-3" /> Qualified for PPO
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg sm:text-[22px] font-extrabold tracking-tight text-primary leading-snug">
                      {c.title}
                    </h2>

                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      {isTech
                        ? "Software Development Engineer (SDE) & Web Engineering Intern (Internship-to-PPO)"
                        : "Onboarding & Business Development, Digital Marketing & Growth, Product Operations"}
                    </p>
                  </div>
                </div>

                <CountdownWidget endsAt={c.ends_at} isOpen={c.is_open} nowMs={nowMs} />
              </div>
            </div>

            {/* Progress & Gate Strip */}
            <div className="grid divide-y sm:divide-y-0 sm:divide-x divide-border-subtle border-b border-border-subtle bg-surface-muted/25 sm:grid-cols-2">
              <div className="px-5 py-4 sm:px-7 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
                    <Gauge className="h-3.5 w-3.5 text-indigo-500" />
                    Readiness Score Gate
                  </span>
                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className={cn("text-base font-extrabold", c.readiness_met ? "text-emerald-600" : "text-amber-600")}>
                      {c.readiness_score_percent}%
                    </span>
                    <span className="text-xs font-semibold text-text-muted">/ {c.min_readiness_percent}% required</span>
                  </div>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      c.readiness_met ? "bg-emerald-500" : "bg-amber-500"
                    )}
                    style={{ width: `${Math.min(100, c.readiness_score_percent)}%` }}
                  />
                </div>

                <p className="text-xs text-text-muted">
                  {c.readiness_met
                    ? "Readiness gate met — focus on scoring cleanly in each assessment."
                    : `${readinessDelta}% away from eligibility. Practice in AI Interviews, Soft Skills & Learning Centre${isTech ? ", plus Daily Contests" : ""}.`}
                </p>
              </div>

              <div className="px-5 py-4 sm:px-7 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    Sequential Assessment Roadmap
                  </span>
                  <div className="flex items-baseline gap-1.5 tabular-nums">
                    <span className="text-base font-extrabold text-primary">
                      {c.assessments_completed} of {c.assessments_total}
                    </span>
                    <span className="text-xs font-semibold text-text-muted">
                      {c.program_avg_score !== null ? `· ${c.program_avg_score}% avg` : "completed"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {c.assessments.map((step) => {
                    const done = step.status === "completed";
                    const current = !done && !step.locked;
                    return (
                      <div
                        key={`step-${step.number}`}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          done
                            ? "bg-emerald-500"
                            : current
                            ? "bg-indigo-500"
                            : "bg-surface-muted"
                        )}
                      />
                    );
                  })}
                </div>

                <p className="text-xs text-text-muted">
                  Stages unlock in order (1 → 2 → 3). Each attempt is webcam &amp; tab-proctored with a rotated question set.
                </p>
              </div>
            </div>

            {/* Assessment Stage Cards */}
            <div className="grid gap-4 p-5 sm:p-7 md:grid-cols-3">
              {c.assessments.map((a) => {
                const isLocked = !!a.locked;
                const isBlocked = !!a.blocked_by_proctoring;
                const isDone = a.status === "completed";
                const isInProgress = a.status === "in_progress";
                const isNextActive = !isLocked && !isDone;
                const shortTitle = a.title.startsWith(`${c.title} - `)
                  ? a.title.slice(`${c.title} - `.length)
                  : a.title;

                const moduleCount =
                  Number(a.include_soft_skills) + Number(a.include_coding) + Number(a.include_interview);

                return (
                  <div
                    key={a.slug}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border p-5 transition-all",
                      isLocked
                        ? "border-border-subtle/70 bg-surface-muted/30 text-text-muted"
                        : isBlocked
                        ? "border-rose-500/40 bg-rose-500/[0.04]"
                        : isNextActive
                        ? "border-indigo-500/40 bg-surface shadow-[0_6px_22px_-12px_rgba(79,70,229,0.35)] ring-1 ring-indigo-500/10"
                        : "border-emerald-500/30 bg-surface"
                    )}
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-extrabold tabular-nums",
                              isBlocked
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                                : isDone
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : isNextActive
                                ? "bg-indigo-600 text-white"
                                : "bg-surface-muted text-text-muted"
                            )}
                          >
                            {isBlocked ? "✕" : isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : `0${a.number}`}
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                            Set {a.set_number}
                          </span>
                        </div>

                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 rounded-pill bg-surface-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                            <Lock className="h-2.5 w-2.5" /> Locked
                          </span>
                        ) : isBlocked ? (
                          <span className="inline-flex items-center gap-1 rounded-pill bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                            Blocked · 0%
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "rounded-pill px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                              isDone && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                              isInProgress && "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                              a.status === "assigned" && "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                            )}
                          >
                            {a.status === "assigned" ? "Ready" : a.status.replace("_", " ")}
                          </span>
                        )}
                      </div>

                      <div>
                        <h3
                          className={cn(
                            "text-base font-extrabold tracking-tight",
                            isLocked ? "text-text-secondary" : "text-primary"
                          )}
                        >
                          {shortTitle}
                        </h3>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {moduleCount} {moduleCount === 1 ? "round" : "proctored rounds"} · Assigned Set {a.set_number}
                        </p>
                      </div>

                      {isLocked ? (
                        <div className="rounded-lg border border-dashed border-border-subtle bg-surface/60 px-3 py-3 text-xs text-text-muted leading-relaxed">
                          {a.lock_reason || `Complete Assessment ${a.number - 1} first to unlock this stage.`}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          {a.include_soft_skills && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/15 bg-blue-500/[0.07] px-2.5 py-1 font-semibold text-blue-700 dark:text-blue-300">
                              <Sparkles className="h-3 w-3" /> Soft Skills
                              {a.soft_skill_score_percent !== null && (
                                <strong className="ml-0.5">{a.soft_skill_score_percent}%</strong>
                              )}
                            </span>
                          )}
                          {a.include_coding && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/15 bg-violet-500/[0.07] px-2.5 py-1 font-semibold text-violet-700 dark:text-violet-300">
                              <Code2 className="h-3 w-3" /> Coding
                              {a.coding_score_percent !== null && (
                                <strong className="ml-0.5">{a.coding_score_percent}%</strong>
                              )}
                            </span>
                          )}
                          {a.include_interview && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.07] px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">
                              <Mic className="h-3 w-3" /> AI Interview
                              {a.interview_score_percent !== null && (
                                <strong className="ml-0.5">{a.interview_score_percent}%</strong>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-5 border-t border-border-subtle/80 pt-3.5">
                      {isLocked ? (
                        <div className="flex items-center justify-between text-[11px] font-medium text-text-muted">
                          <span>Sequential Gate</span>
                          <span>Stage 0{a.number - 1} required</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-text-secondary">
                            {isBlocked ? (
                              <span className="text-rose-600">Blocked: 0%</span>
                            ) : a.overall_score_percent !== null ? (
                              <span className="text-primary">Overall: {a.overall_score_percent}%</span>
                            ) : (
                              "Proctored session"
                            )}
                          </span>

                          <Link
                            href={`/dashboard/assessments/view?slug=${encodeURIComponent(a.slug)}`}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-xs font-bold transition-all",
                              isBlocked
                                ? "border border-rose-500/30 bg-rose-500/10 text-rose-700 hover:border-rose-500/50"
                                : isDone
                                ? "border border-border-subtle bg-elevated text-primary hover:border-primary/40"
                                : "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500"
                            )}
                          >
                            {isBlocked ? "View Lock Details" : isDone ? "View Scorecard" : isInProgress ? "Resume" : "Start Assessment"}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
