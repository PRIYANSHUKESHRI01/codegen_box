"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, Award, Briefcase, CalendarDays, CheckCircle2, Clock, Lock, RefreshCw, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { OverviewStats, type OverviewStat } from "@/components/dashboard/home/OverviewStats";
import { HpCard, HpEmptyState, HpPill, HpSearch, HpSkeleton, HpSkeletonCards, HpTabs, hpBtn, type HpTone } from "@/components/portal/kit";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { groupDrives, useStudentDrives, type DriveCard } from "@/lib/studentDrives";
import { cn } from "@/lib/utils";

type Tab = "upcoming" | "applied" | "past";
type Fit = "all" | "eligible" | "not_eligible";

const FITS = [
  { id: "all", label: "All" },
  { id: "eligible", label: "Eligible" },
  { id: "not_eligible", label: "Not eligible" },
] as const;

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });
const WHEN = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Does the free-text search match this drive (company, role, or the drive's own title)? Case-insensitive, every word must match. */
export function matchesQuery(drive: Pick<DriveCard, "company" | "roleTitle" | "title">, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = `${drive.company.name} ${drive.roleTitle} ${drive.title}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

function stageTone(stage: string): HpTone {
  if (stage === "offer_accepted") return "emerald";
  if (stage === "rejected" || stage === "withdrawn") return "slate";
  return "sky";
}

function DriveTile({ drive, past }: { drive: DriveCard; past: boolean }) {
  const date = new Date(drive.driveDate);
  const elig = drive.studentEligibility;
  const reason = elig.status === "not_eligible" ? elig.reasons[0] : null;

  return (
    <li className="h-full">
      <Link
        href={`/dashboard/drives?driveId=${drive.id}`}
        className="group block h-full rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <HpCard interactive className={cn("relative flex h-full flex-col overflow-hidden p-5", past && "opacity-90")}>
          <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400 transition-transform duration-500 ease-out group-hover:scale-x-100 motion-reduce:transition-none" />

          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo name={drive.company.name} slug={drive.company.slug} logo={drive.company.logo} size="md" />
              <div className="min-w-0">
                <h3 className="truncate text-15 font-bold tracking-tight text-primary transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{drive.company.name}</h3>
                <p className="truncate text-xs text-text-muted">{drive.roleTitle}</p>
              </div>
            </div>

            {/* The date as a tile - the thing a student scans a list of drives for. */}
            <span className="flex w-12 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-border-subtle bg-elevated/70 text-center shadow-sm" aria-hidden>
              <span className="w-full bg-gradient-to-b from-indigo-500 to-violet-600 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">{MONTH.format(date)}</span>
              <span className="py-1 text-base font-black leading-none text-primary">{date.getDate()}</span>
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {drive.myApplication ? (
              <HpPill tone={stageTone(drive.myApplication.stage)} icon={CheckCircle2}>
                {drive.myApplication.stage_label}
              </HpPill>
            ) : elig.status === "eligible" ? (
              <HpPill tone="emerald" icon={CheckCircle2}>
                Eligible · Open for Registration
              </HpPill>
            ) : elig.status === "not_eligible" ? (
              <HpPill tone="rose" icon={XCircle}>
                Not eligible
              </HpPill>
            ) : (
              <HpPill tone="amber" icon={AlertCircle}>
                Eligibility unconfirmed
              </HpPill>
            )}
            <HpPill tone="slate" className="font-mono">
              {drive.ctcRange ?? "CTC not disclosed"}
            </HpPill>
          </div>

          {reason && <p className="mt-2.5 line-clamp-2 text-2xs leading-relaxed text-text-muted">{reason}</p>}

          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-muted">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              {WHEN.format(date)}
            </span>
            {drive.durationMinutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {drive.durationMinutes} min
              </span>
            ) : null}
          </p>

          <div className="mt-auto pt-4" />
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
            {past ? (
              <span className="text-2xs font-semibold text-text-muted">Drive concluded</span>
            ) : (
              <span className="flex flex-col">
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">Starts in</span>
                <CountdownTimer minutesFromNow={drive.minutesFromNow} compact className="text-sm font-bold text-indigo-600 dark:text-indigo-300" />
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
              {past
                ? "View details"
                : drive.myApplication
                ? "Prepare for Drive"
                : elig.status === "eligible"
                ? "Register for Drive"
                : "View Prep"}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </span>
          </div>
        </HpCard>
      </Link>
    </li>
  );
}

function DirectCandidateHiringCard() {
  return (
    <HpCard spotlight={false} className="relative overflow-hidden p-6 sm:p-10 border-border-subtle bg-surface shadow-subtle">
      {/* Decorative background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.07] via-violet-500/[0.04] to-transparent" />
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
      </div>
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400" />

      <div className="max-w-3xl mx-auto space-y-6 text-center sm:text-left">
        {/* Top Header Badge */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <Award className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <span className="text-3xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                AptRun Direct Member · Career Gateway
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-primary tracking-tight">
                Campus Drives are College-Partnered — Get Hired via Mellow Vault
              </h2>
            </div>
          </div>
          <HpPill tone="emerald" icon={ShieldCheck} className="whitespace-nowrap">
            Verified Talent Pool
          </HpPill>
        </div>

        {/* Informative Explanation */}
        <div className="space-y-2 text-xs sm:text-sm text-text-secondary leading-relaxed">
          <p>
            Campus placement drives listed here are hosted exclusively for students enrolled in our partner colleges and universities, coordinated directly by their placement cells.
          </p>
          <p>
            As an independent candidate, our hiring partners recruit verified talent directly through <strong className="font-semibold text-primary">Mellow Vault</strong>. Top companies actively source, evaluate, and hire pre-vetted AptRun engineers.
          </p>
        </div>

        {/* Step-by-Step 60% Qualification Criteria */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-4 rounded-xl bg-elevated/80 border border-border-subtle text-left space-y-1.5">
            <span className="text-3xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Step 1</span>
            <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-indigo-500" /> Mellow Vault Account
            </h3>
            <p className="text-2xs text-text-muted leading-relaxed">
              If your account is already on Mellow Vault, your candidate profile is ready to be linked to our top hiring partners.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-elevated/80 border border-border-subtle text-left space-y-1.5">
            <span className="text-3xs font-black uppercase tracking-wider text-violet-600 dark:text-violet-400">Step 2</span>
            <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-violet-500" /> Score 60%+ in Vault AI
            </h3>
            <p className="text-2xs text-text-muted leading-relaxed">
              Take the Vault AI Interview and achieve a score of <strong className="text-primary font-bold">60% or higher</strong> to prove your technical and communication readiness.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-elevated/80 border border-border-subtle text-left space-y-1.5">
            <span className="text-3xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Step 3</span>
            <h3 className="text-xs font-bold text-primary flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Verified for Hiring
            </h3>
            <p className="text-2xs text-text-muted leading-relaxed">
              Once verified, hiring partners get full visibility into your profile, scores, and interview performance for direct outreach.
            </p>
          </div>
        </div>

        {/* Future on AptRun Note */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-500/[0.08] via-violet-500/[0.05] to-transparent border border-indigo-500/20 text-left">
          <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-2xs sm:text-xs">
            <span className="font-bold text-primary">Direct Hiring Coming to AptRun Soon</span>
            <p className="text-text-secondary leading-relaxed">
              In the near future, hiring partners will also be recruiting and hosting drives directly on AptRun! Keep practicing DSA, tackling Company PYQs, and improving your profile score so you stay at the very top when direct drives open.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Link href="/dashboard/vault-interviews" className={hpBtn("primary", "md")}>
            <ShieldCheck className="h-4 w-4" aria-hidden /> Take Vault AI Interview
          </Link>
          <Link href="/dashboard/vault" className={hpBtn("secondary", "md")}>
            <Award className="h-4 w-4" aria-hidden /> Open Mellow Vault
          </Link>
          <Link href="/dashboard/company-prep" className={hpBtn("soft", "md")}>
            Practice Company PYQs <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </HpCard>
  );
}

/**
 * Upcoming Drives: every company the student's placement cell has opened for their college, with where the student stands on
 * each (eligible / applied / not eligible), a countdown, and a way into the prep pack. The drive's own page is
 * `/dashboard/drives?driveId=…` (kept as it always was, so notification and e-mail links still work).
 */
export function UpcomingDrivesPage() {
  const { user, status } = useAuthGuard(["user"]);
  const ready = status === "ready";
  const { drives, access, loading, failed, reload } = useStudentDrives(ready);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [fit, setFit] = useState<Fit>("all");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => groupDrives(drives), [drives]);
  const applied = useMemo(() => drives.filter((d) => !!d.myApplication).sort((a, b) => b.minutesFromNow - a.minutesFromNow), [drives]);

  if (!ready) return <SessionLoader />;

  const hasCollege = Boolean(user?.college || user?.college_id);
  const source: DriveCard[] = tab === "upcoming" ? groups.upcoming : tab === "applied" ? applied : groups.past;
  const visible = source.filter((d) => (fit === "all" || d.studentEligibility.status === fit) && matchesQuery(d, query));
  const counts: Record<Tab, number> = { upcoming: groups.upcoming.length, applied: applied.length, past: groups.past.length };
  const filtering = fit !== "all" || query.trim() !== "";

  const stats: OverviewStat[] = [
    { id: "up", label: "Upcoming", value: groups.upcoming.length, icon: CalendarDays, tone: "indigo", hint: groups.next ? `Next: ${groups.next.company.name}` : "Nothing scheduled", href: "#drive-list", goTo: "Jump to the list" },
    { id: "elig", label: "Eligible for you", value: groups.eligible, suffix: groups.upcoming.length > 0 ? `/ ${groups.upcoming.length}` : undefined, icon: Sparkles, tone: "emerald", hint: "By your academic profile on file", href: "#drive-list", goTo: "Jump to the list" },
    { id: "applied", label: "Applied", value: groups.applied, icon: Briefcase, tone: "sky", hint: groups.applied > 0 ? "Drives you are in" : "Open a drive to apply", href: "#drive-list", goTo: "Jump to the list" },
  ];

  return (
    <DashboardShell
      role="user"
      title="Upcoming Drives"
      subtitle={
        hasCollege
          ? `Companies your placement cell has opened for ${user?.college?.name ?? "your college"}`
          : "Campus drives are college-partnered · Direct off-campus hiring is powered via Mellow Vault"
      }
    >
      {loading ? (
        <div className="space-y-6" role="status" aria-label="Loading drives">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <HpSkeleton key={i} className="h-[122px] rounded-[20px]" />
            ))}
          </div>
          <HpSkeletonCards count={3} />
        </div>
      ) : failed ? (
        <HpEmptyState
          icon={AlertCircle}
          tone="amber"
          title="We couldn’t load your drives"
          description="Check your connection and try again. Nothing is wrong with your account."
          action={
            <button type="button" onClick={reload} className={hpBtn("primary", "md")}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Try again
            </button>
          }
        />
      ) : !access ? (
        hasCollege ? (
          <HpEmptyState
            icon={Lock}
            tone="violet"
            title="Placement drives aren’t part of your plan"
            description="Upgrade to see the drives your college has opened, check your eligibility and open each company’s prep pack."
            action={
              <Link href="/dashboard/billing" className={hpBtn("primary", "md")}>
                See plans <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
        ) : (
          <DirectCandidateHiringCard />
        )
      ) : drives.length === 0 ? (
        <HpEmptyState
          icon={Briefcase}
          tone="indigo"
          title="No drives yet"
          description="Your placement cell hasn’t opened a drive for your college yet. While you wait, previous-year questions and AI mock interviews are the best way to get ready."
          action={
            <>
              <Link href="/dashboard/company-prep" className={hpBtn("primary", "md")}>
                Company PYQs <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/dashboard/interviews" className={hpBtn("secondary", "md")}>
                Mock AI Interview
              </Link>
            </>
          }
        />
      ) : (
        <>
          <OverviewStats stats={stats} />

          <section id="drive-list" aria-label="Drives" className="scroll-mt-24 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <HpTabs<Tab>
                tabs={[
                  { id: "upcoming", label: "Upcoming", count: counts.upcoming },
                  { id: "applied", label: "Applied", count: counts.applied },
                  { id: "past", label: "Past", count: counts.past },
                ]}
                value={tab}
                onChange={setTab}
              />

              <div className="flex flex-wrap items-center gap-3">
                <HpTabs<Fit> tabs={FITS.map((f) => ({ id: f.id, label: f.label }))} value={fit} onChange={setFit} />
                <HpSearch value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company or role" aria-label="Search drives by company or role" wrapperClassName="w-full sm:w-64" />
              </div>
            </div>

            {visible.length === 0 ? (
              <HpEmptyState
                icon={Briefcase}
                tone="slate"
                className="py-12 sm:py-12"
                title={filtering ? "No drives match that" : tab === "upcoming" ? "No upcoming drives" : tab === "applied" ? "You haven’t applied to a drive yet" : "No past drives"}
                description={filtering ? "Try a different search or clear the eligibility filter." : tab === "applied" ? "Open an upcoming drive to see its requirements and prep pack." : "Check back when your placement cell opens another one."}
                action={
                  filtering ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFit("all");
                        setQuery("");
                      }}
                      className={hpBtn("soft", "sm")}
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((d) => (
                  <DriveTile key={d.id} drive={d} past={tab === "past" || d.minutesFromNow <= 0} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
