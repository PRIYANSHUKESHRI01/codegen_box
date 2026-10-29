"use client";

import Link from "next/link";
import { ArrowUpRight, Briefcase, CheckCircle2, Swords } from "lucide-react";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { HpIconTile, HpPill, hpBtn } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import type { DriveCard } from "@/lib/studentDrives";
import type { ContestSummary } from "@/types/liveContest";

/**
 * The one urgent thing on the Overview: the soonest real contest, or the student's own college's next drive, whichever is
 * sooner (a contest that is live right now always wins). Only ever real data - the page does not render this at all when
 * neither exists, rather than falling back to made-up content.
 *
 * It is the page's one hero, so it is the one surface with the portal's gradient hairline, drifting orbs and dotted texture
 * (the same recipe as the TPO and Hiring Partner heroes); it turns rose while a contest is live.
 */
export function UpNextCard({ contest, drive }: { contest?: ContestSummary | null; drive?: DriveCard | null }) {
  if (!contest && !drive) return null;

  const isContest = !!contest;
  const live = isContest && contest.has_started;

  const minutes = contest ? Math.round((new Date(live ? contest.end_at : contest.start_at).getTime() - Date.now()) / 60000) : drive!.minutesFromNow;
  const href = contest ? `/dashboard/contests/view?slug=${contest.slug}` : `/dashboard/drives?driveId=${drive!.id}`;
  const cta = contest ? (contest.is_registered ? (live ? "Start contest" : "View contest") : "Register") : "Prepare";
  const kind = contest ? (live ? "Live now" : contest.is_rated ? "Rated contest" : "Contest") : "Placement drive";
  const title = contest ? contest.title : drive!.company.name;
  const detail = contest
    ? `${contest.problem_count} problems · ${contest.total_points} points${contest.is_rated ? " · Rated" : ""}`
    : `${drive!.roleTitle} · ${drive!.ctcRange ?? "CTC not disclosed"}`;

  return (
    <section
      aria-label="Up next"
      className={cn(
        "hp-gborder group relative overflow-hidden rounded-[24px] border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] shadow-[var(--hp-edge),var(--hp-shadow)] transition-[transform,box-shadow] duration-500 hover:-translate-y-0.5 hover:shadow-[var(--hp-edge),var(--hp-shadow-hover)] motion-reduce:hover:translate-y-0"
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className={cn(
            "absolute inset-0",
            live
              ? "bg-[radial-gradient(70%_130%_at_0%_0%,rgba(244,63,94,0.14),transparent_60%),radial-gradient(60%_110%_at_100%_0%,rgba(99,102,241,0.12),transparent_60%)]"
              : "bg-[radial-gradient(70%_130%_at_0%_0%,rgba(99,102,241,0.15),transparent_60%),radial-gradient(60%_110%_at_100%_0%,rgb(var(--hp-id)/0.16),transparent_60%)]"
          )}
        />
        <div className="hp-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(55%_90%_at_88%_0%,#000,transparent)]" />
        <div className={cn("hp-drift absolute -right-16 -top-24 h-72 w-72 rounded-full blur-3xl", live ? "bg-gradient-to-br from-rose-500/25 to-indigo-500/10" : "bg-gradient-to-br from-[rgb(var(--hp-id)/0.30)] to-[rgb(var(--hp-id2)/0.10)]")} />
        <div className="hp-drift absolute -bottom-28 left-1/4 h-60 w-60 rounded-full bg-gradient-to-tr from-indigo-500/20 to-violet-500/10 blur-3xl [animation-delay:-5s]" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <span className="relative shrink-0">
            {live && <span aria-hidden className="hp-ping absolute inset-0 rounded-2xl bg-rose-500/40" />}
            <HpIconTile icon={isContest ? Swords : Briefcase} tone={live ? "rose" : "indigo"} size="xl" className="transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <HpPill tone={live ? "rose" : "indigo"} dot pulse={live}>{kind}</HpPill>
              {!isContest && drive!.myApplication && <HpPill tone="emerald" icon={CheckCircle2}>{drive!.myApplication.stage_label}</HpPill>}
              {!isContest && !drive!.myApplication && drive!.studentEligibility.status === "eligible" && <HpPill tone="emerald" icon={CheckCircle2}>You’re eligible</HpPill>}
            </div>
            <h2 className="mt-2.5 truncate text-2xl font-extrabold leading-tight tracking-tight text-primary sm:text-[28px]">{title}</h2>
            <p className="mt-1 text-13 text-text-secondary">{detail}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end lg:flex-col lg:items-end xl:flex-row xl:items-end">
          <div>
            <span className="mb-2 block text-3xs font-bold uppercase tracking-[0.12em] text-text-muted">{live ? "Ends in" : "Starts in"}</span>
            <CountdownTimer variant="raised" minutesFromNow={minutes} />
          </div>

          <Link href={href} className={hpBtn(live ? "danger" : "primary", "lg", live ? "!bg-rose-500 !text-white hover:!bg-rose-600" : undefined)}>
            {cta}
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
