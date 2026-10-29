"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CheckCircle2, Flame, Gauge, Mic, Trophy, Zap } from "lucide-react";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { HackArenaBanner } from "@/components/arena/HackArenaBanner";
import { MellowVaultInterviewBanner } from "@/components/dashboard/home/MellowVaultInterviewBanner";
import { PracticeShelf } from "@/components/dashboard/home/PracticeShelf";
import { UpNextCard } from "@/components/dashboard/home/UpNextCard";
import { OverviewStats, type OverviewStat } from "@/components/dashboard/home/OverviewStats";
import { ComingUp } from "@/components/dashboard/home/ComingUp";
import { ReadinessCard } from "@/components/dashboard/home/ReadinessCard";
import { WeeklyGoalsCard } from "@/components/dashboard/home/WeeklyGoalsCard";
import { DomainPrepCard } from "@/components/dashboard/home/DomainPrepCard";
import { ExploreGrid, exploreTiles } from "@/components/dashboard/home/ExploreGrid";
import { useBranchCatalog } from "@/lib/branches";
import { capabilitiesOf, useDomainPrepCopy } from "@/lib/departments";
import { greeting } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useMyStats } from "@/lib/useMyStats";
import { useContestList } from "@/lib/useContestList";
import { groupDrives, useStudentDrives } from "@/lib/studentDrives";
import { getRatingTier } from "@/lib/rating";
import type { CoreHomeAvailable } from "@/types/core";

/** The student's branch, in as few letters as possible, shown after the college name in the greeting. */
const BRANCH_LABEL: Record<string, string> = { cse: "CSE", ece: "ECE", eee: "EEE", mech: "Mech", civil: "Civil" };

/**
 * The student's Overview. It answers three questions and nothing else: *how am I doing* (a few numbers and the readiness score),
 * *what should I do now* (the one urgent thing, today's practice, what is coming up), and *where is everything* (one card per
 * sidebar section, each with a button). Everything that has a page of its own - the rating chart, solved breakdown, topic
 * mastery, heatmap, submissions, the contest list, the drive list, the PYQ hub - lives on that page, not here.
 *
 *  • layout "software" — the default: rating, solved and streak up front, weekly goals beside the readiness score.
 *  • layout "balanced" — the same, with the student's Domain Prep summary above the practice shelf.
 *  • layout "core"     — a student leading with their branch: the Domain Prep summary comes first and the coding numbers
 *    (rating, solved, streak, weekly problem goals) are left out.
 *  • layout "general"  — a programme with no coding at all (Management, Commerce, Arts …): as "core", and no contest request is
 *    made, no Practice Arena is mentioned, and the sections the programme lacks are not offered.
 */
export function SoftwareHome({ layout = "software", coreHome = null }: { layout?: "software" | "balanced" | "core" | "general"; coreHome?: CoreHomeAvailable | null }) {
  const router = useRouter();
  const { user, status } = useAuthGuard(["user"]);
  const catalog = useBranchCatalog();
  const domainCopy = useDomainPrepCopy();
  const ready = status === "ready";

  // "lean": no coding-specific numbers. "codes": the programme practises code at all, so coding data is worth asking for.
  const lean = layout === "core" || layout === "general";
  const codes = layout !== "general";
  const caps = capabilitiesOf(user);
  const showContests = codes && caps.contests;

  const { drives, access: driveAccess, loading: drivesLoading } = useStudentDrives(ready);
  const { contests, loading: contestsLoading } = useContestList(ready && showContests);
  const { stats, loading: statsLoading } = useMyStats(ready, user?.weekly_pace ?? "");

  const groups = useMemo(() => groupDrives(drives), [drives]);

  if (!ready) return <SessionLoader />;

  const firstName = (user?.name ?? "there").split(" ")[0];
  const isRated = (stats?.rating.rated_contests_count ?? 0) > 0;
  const tier = isRated ? getRatingTier(stats!.rating.current_rating) : null;

  // The soonest thing that matters: a contest that is live (or next to start) or the student's own college's next drive,
  // whichever is sooner. A live contest is happening now, so it always outranks a merely upcoming drive.
  const upcomingContests = contests.filter((c) => !c.has_ended).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const nextContest = upcomingContests[0] ?? null;
  const nextDrive = groups.next;
  const contestIsLive = !!nextContest?.has_started;
  const contestStartsIn = nextContest ? Math.round((new Date(nextContest.start_at).getTime() - Date.now()) / 60000) : Infinity;
  const upNextIsContest = !!nextContest && (contestIsLive || contestStartsIn < (nextDrive?.minutesFromNow ?? Infinity));
  const upNextReady = !drivesLoading && !contestsLoading;

  // The numbers. Each one is a door to the page that owns it; while the stats are loading they read "—", then count up.
  const num = (n: number | undefined) => (statsLoading || n === undefined ? "—" : n);
  const statTiles: OverviewStat[] = lean
    ? [
        { id: "readiness", label: "Readiness", value: num(stats?.readiness.score), suffix: "%", icon: Gauge, tone: "indigo", hint: stats?.readiness.tier ?? "Your one score", href: "/dashboard/reports", goTo: "See your readiness roadmap" },
        { id: "eligible", label: "Drives eligible", value: drivesLoading ? "—" : groups.eligible, suffix: groups.upcoming.length > 0 ? `/ ${groups.upcoming.length}` : undefined, icon: Briefcase, tone: "sky", hint: "By your academic profile on file", href: "/dashboard/drives", goTo: "See upcoming drives" },
        { id: "applied", label: "Applications", value: drivesLoading ? "—" : groups.applied, icon: CheckCircle2, tone: "emerald", hint: groups.applied > 0 ? "Drives you are in" : "Open a drive to apply", href: "/dashboard/drives", goTo: "See your drive applications" },
      ]
    : [
        { id: "readiness", label: "Readiness", value: num(stats?.readiness.score), suffix: "%", icon: Gauge, tone: "indigo", hint: stats?.readiness.tier ?? "Your one score", href: "/dashboard/reports", goTo: "See your readiness roadmap" },
        {
          id: "rating",
          label: "Rating",
          value: statsLoading ? "—" : (stats?.rating.display_rating ?? "—"),
          icon: Trophy,
          tone: "violet",
          hint: tier ? `${tier.name} · Division ${tier.division}` : "Enter a contest to get rated",
          href: isRated ? "/dashboard/reports" : "/dashboard/contests",
          goTo: isRated ? "See your rating trend" : "Browse contests",
        },
        { id: "solved", label: "Problems solved", value: num(stats?.solved.total_solved), icon: CheckCircle2, tone: "emerald", hint: `${stats?.solved.hard.solved ?? 0} hard cracked`, href: "/dashboard/practice", goTo: "Open the Practice Arena" },
        { id: "streak", label: "Current streak", value: num(stats?.streak.current), suffix: "days", icon: Flame, tone: "amber", hint: `Personal best ${stats?.streak.max ?? 0} days`, href: "/dashboard/practice", goTo: "Keep your streak alive in the Practice Arena" },
      ];

  const liveContests = upcomingContests.filter((c) => c.has_started).length;
  const hints: Record<string, string> = {};
  if (!drivesLoading && groups.upcoming.length > 0) hints.drives = `${groups.upcoming.length} upcoming`;
  if (showContests && !contestsLoading && upcomingContests.length > 0) hints.contests = liveContests > 0 ? `${liveContests} live now` : `${upcomingContests.length} scheduled`;

  const tiles = exploreTiles({ caps, domainPrep: coreHome ? { label: domainCopy.label } : null });

  return (
    <DashboardShell
      role="user"
      title={`${greeting()}, ${firstName}`}
      subtitle={[
        tier ? `${tier.name} · Division ${tier.division}` : null,
        user?.college?.name,
        BRANCH_LABEL[user?.discipline ?? ""] ?? catalog?.branches.find((b) => b.code === user?.branch_code)?.short ?? catalog?.disciplines.find((d) => d.code === user?.discipline)?.short ?? null,
      ]
        .filter(Boolean)
        .join(" · ")}
      actionButton={
        codes
          ? { label: "Practice Arena", icon: Zap, onClick: () => router.push("/dashboard/practice") }
          : caps.ai_interviews
            ? { label: "AI mock interview", icon: Mic, onClick: () => router.push("/dashboard/interviews") }
            : undefined
      }
    >
      {/* 1. The one urgent thing - hidden entirely when there is nothing real to show. */}
      {upNextReady && (upNextIsContest ? nextContest : nextDrive) && (
        <UpNextCard contest={upNextIsContest ? nextContest : null} drive={upNextIsContest ? null : nextDrive} />
      )}

      {/* 2. How am I doing - a handful of numbers, each leading to the page that owns it. */}
      <OverviewStats stats={statTiles} />

      {/* 3. The Vault AI Interview: the thing to do first on the way to being hired. */}
      {caps.ai_interviews && (
        <MellowVaultInterviewBanner />
      )}

      {/* 4. What to do now, and how ready I am. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {coreHome && (
            <DomainPrepCard home={coreHome} />
          )}
          <PracticeShelf compact />
          <ComingUp drives={drives} contests={contests} loading={drivesLoading || (showContests && contestsLoading)} driveAccess={driveAccess} showContests={showContests} />
        </div>

        <div className="space-y-6">
          <ReadinessCard stats={stats} codes={codes} />
          {!lean && (
            <WeeklyGoalsCard goals={stats?.weekly_goals} pace={user?.weekly_pace} />
          )}
        </div>
      </div>

      {/* 5. The Hack Arena is its own full-screen world, so it is entered from here rather than from the sidebar. */}
      {caps.hackathons && (
        <HackArenaBanner />
      )}

      {/* 6. Where everything else lives: one card per sidebar section, each with a button. */}
      <ExploreGrid tiles={tiles} hints={hints} />
    </DashboardShell>
  );
}
