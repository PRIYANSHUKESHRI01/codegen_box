"use client";

import Link from "next/link";
import { ArrowRight, Briefcase, CalendarClock, Swords } from "lucide-react";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { HpCard, HpEmptyState, HpIconTile, HpPill, HpSectionHeader, HpSkeleton, hpBtn, type HpTone } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import type { DriveCard } from "@/lib/studentDrives";
import type { ContestSummary } from "@/types/liveContest";
import { SectionLink } from "./homeKit";

interface Row {
  key: string;
  at: number;
  href: string;
  kind: "drive" | "contest";
  title: string;
  sub: string;
  minutes: number;
  live: boolean;
  chip?: { text: string; tone: HpTone };
  drive?: DriveCard;
}

function rowsFrom(drives: DriveCard[], contests: ContestSummary[]): Row[] {
  const now = Date.now();

  const driveRows = drives
    .filter((d) => d.minutesFromNow > 0)
    .map<Row>((d) => ({
      key: `drive-${d.id}`,
      at: new Date(d.driveDate).getTime(),
      href: `/dashboard/drives?driveId=${d.id}`,
      kind: "drive",
      title: d.company.name,
      sub: `${d.roleTitle} · ${d.ctcRange ?? "CTC not disclosed"}`,
      minutes: d.minutesFromNow,
      live: false,
      chip: d.myApplication
        ? { text: d.myApplication.stage_label, tone: "sky" }
        : d.studentEligibility.status === "eligible"
          ? { text: "Eligible", tone: "emerald" }
          : undefined,
      drive: d,
    }));

  const contestRows = contests
    .filter((c) => !c.has_ended)
    .map<Row>((c) => {
      const live = c.has_started;
      const target = new Date(live ? c.end_at : c.start_at).getTime();
      return {
        key: `contest-${c.id}`,
        at: live ? now : target,
        href: `/dashboard/contests/view?slug=${c.slug}`,
        kind: "contest",
        title: c.title,
        sub: `${c.problem_count} problems · ${c.total_points} pts${c.is_rated ? " · Rated" : ""}`,
        minutes: Math.round((target - now) / 60000),
        live,
        chip: live ? { text: "Live now", tone: "rose" } : c.is_registered ? { text: "Registered", tone: "emerald" } : undefined,
      };
    });

  return [...driveRows, ...contestRows].sort((a, b) => a.at - b.at);
}

/**
 * "Coming up": the next few things on the student's calendar - their college's drives and, where their programme has them,
 * contests - in the order they happen. A taste of the two full pages (Upcoming Drives, Contests), each one click away.
 */
export function ComingUp({
  drives,
  contests,
  loading,
  driveAccess,
  showContests,
  limit = 4,
}: {
  drives: DriveCard[];
  contests: ContestSummary[];
  loading: boolean;
  /** False when the plan (or a missing college) means the server sent no drives on purpose. */
  driveAccess: boolean;
  showContests: boolean;
  limit?: number;
}) {
  const rows = rowsFrom(drives, showContests ? contests : []);
  const shown = rows.slice(0, limit);
  const more = rows.length - shown.length;

  return (
    <HpCard spotlight={false} className="overflow-hidden" aria-label="Coming up">
      <div className="px-5 pt-5 sm:px-6 sm:pt-6">
        <HpSectionHeader
          icon={CalendarClock}
          tone="sky"
          title="Coming up"
          subtitle="Drives and contests, soonest first"
          action={<SectionLink href="/dashboard/drives">All drives</SectionLink>}
        />
      </div>

      {loading ? (
        <ul className="space-y-2 px-5 pb-5 pt-4 sm:px-6" role="status" aria-label="Loading what is coming up">
          {[0, 1, 2].map((i) => (
            <li key={i}><HpSkeleton className="h-[62px] w-full rounded-2xl" /></li>
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <div className="px-5 pb-6 pt-2 sm:px-6">
          <HpEmptyState
            className="!border-0 !shadow-none"
            icon={CalendarClock}
            tone="sky"
            title="Nothing scheduled yet"
            description={!driveAccess ? "Placement drives aren’t part of your current plan." : "When your placement cell opens a drive for your college, it shows up here with a countdown."}
            action={!driveAccess ? <Link href="/dashboard/billing" className={hpBtn("soft", "sm")}>See plans <ArrowRight className="h-3.5 w-3.5" aria-hidden /></Link> : undefined}
          />
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border-subtle px-2 pb-2 sm:px-3">
          {shown.map((r) => (
            <li key={r.key}>
              <Link
                href={r.href}
                className="group flex items-center gap-3.5 rounded-2xl px-3 py-3 transition-all duration-200 hover:bg-indigo-500/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:px-3.5"
              >
                {r.drive ? (
                  <CompanyLogo name={r.drive.company.name} slug={r.drive.company.slug} logo={r.drive.company.logo} size="sm" />
                ) : (
                  <HpIconTile icon={Swords} tone={r.live ? "rose" : "indigo"} size="md" />
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-primary transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{r.title}</span>
                    {r.chip && <HpPill tone={r.chip.tone} size="sm" className="hidden sm:inline-flex">{r.chip.text}</HpPill>}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 truncate text-2xs text-text-muted">
                    {r.kind === "drive" ? <Briefcase className="h-3 w-3 shrink-0" aria-hidden /> : <Swords className="h-3 w-3 shrink-0" aria-hidden />}
                    <span className="truncate">{r.sub}</span>
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-text-muted">{r.live ? "Ends in" : "Starts in"}</span>
                  <CountdownTimer minutesFromNow={r.minutes} compact className={cn("text-xs font-bold", r.live ? "text-rose-600 dark:text-rose-300" : "text-indigo-600 dark:text-indigo-300")} />
                </span>
                <ArrowRight className="hidden h-4 w-4 shrink-0 -translate-x-1 text-text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 sm:block" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && shown.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle bg-elevated/40 px-5 py-3 text-2xs text-text-muted sm:px-6">
          <span>{more > 0 ? `+${more} more scheduled` : "That’s everything scheduled right now"}</span>
          <span className="flex items-center gap-4 font-bold">
            <Link href="/dashboard/drives" className="text-indigo-600 hover:underline dark:text-indigo-300">Upcoming drives</Link>
            {showContests && <Link href="/dashboard/contests" className="text-indigo-600 hover:underline dark:text-indigo-300">Contests</Link>}
          </span>
        </div>
      )}
    </HpCard>
  );
}
