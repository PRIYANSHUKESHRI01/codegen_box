"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Flame,
  Activity,
  CheckCircle2,
  Code2,
  ArrowUpRight,
  Sparkles,
  Zap,
  Target,
  ShieldCheck,
  AlertCircle,
  CalendarClock,
  ArrowRight,
  Gauge,
  ListChecks,
  Briefcase,
  Loader2,
  Swords,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatTile } from "@/components/dashboard/student/StatTile";
import { RatingChart } from "@/components/dashboard/student/RatingChart";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { ReadinessBreakdown } from "@/components/dashboard/student/ReadinessBreakdown";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { ActivityHeatmap } from "@/components/dashboard/student/ActivityHeatmap";
import { TopicMasteryList } from "@/components/dashboard/student/TopicMasteryList";
import { RatingBadge } from "@/components/dashboard/student/RatingBadge";
import { cn, greeting } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { getRatingTier, nextTierGap } from "@/lib/rating";
import { useMyStats } from "@/lib/useMyStats";
import { buildActivityWeeks } from "@/lib/activityGrid";
import { RatingHistoryPoint } from "@/types/studentStats";
import type { UpcomingPlacementDrive, MyDriveApplication } from "@/types/placement";
import type { ContestSummary } from "@/types/liveContest";

interface ApiDriveSummary {
  id: number;
  title: string;
  company: { id: number; name: string; slug: string; logo: string | null };
  role_title: string;
  ctc_range: string | null;
  drive_date: string;
  duration_minutes: number | null;
  eligibility: { min_cgpa: string | null; max_backlogs: number | null; eligible_branches: string[] | null };
  student_eligibility: { status: "eligible" | "not_eligible" | "unknown"; reasons: string[] };
  my_application: MyDriveApplication | null;
}

interface DashboardDriveCard extends UpcomingPlacementDrive {
  minutesFromNow: number;
}

function mapDriveFromApi(d: ApiDriveSummary): DashboardDriveCard {
  return {
    id: d.id,
    title: d.title,
    company: d.company,
    roleTitle: d.role_title,
    ctcRange: d.ctc_range,
    driveDate: d.drive_date,
    durationMinutes: d.duration_minutes,
    eligibility: {
      minCgpa: d.eligibility.min_cgpa !== null ? Number(d.eligibility.min_cgpa) : null,
      maxBacklogs: d.eligibility.max_backlogs,
      eligibleBranches: d.eligibility.eligible_branches,
    },
    studentEligibility: d.student_eligibility,
    myApplication: d.my_application,
    minutesFromNow: Math.round((new Date(d.drive_date).getTime() - Date.now()) / 60000),
  };
}

export default function UserDashboardPage() {
  const router = useRouter();
  const { user, status } = useAuthGuard(["user"]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [placementDrives, setPlacementDrives] = useState<DashboardDriveCard[]>([]);
  const [driveAccess, setDriveAccess] = useState(true);
  const [drivesLoading, setDrivesLoading] = useState(true);
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [contestsLoading, setContestsLoading] = useState(true);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryPoint[]>([]);
  const [globalRank, setGlobalRank] = useState<number | null>(null);

  const { stats, loading: statsLoading } = useMyStats(status === "ready");
  const activityWeeks = useMemo(() => buildActivityWeeks(stats?.activity ?? []), [stats]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;

    api
      .get<{ drives: ApiDriveSummary[]; drive_access?: boolean }>("/drives")
      .then((res) => {
        if (cancelled) return;
        setPlacementDrives(res.drives.map(mapDriveFromApi));
        setDriveAccess(res.drive_access ?? true);
      })
      .catch(() => {
        if (!cancelled) setPlacementDrives([]);
      })
      .finally(() => {
        if (!cancelled) setDrivesLoading(false);
      });

    api
      .get<{ contests: ContestSummary[] }>("/contests")
      .then((res) => {
        if (!cancelled) setContests(res.contests);
      })
      .catch(() => {
        if (!cancelled) setContests([]);
      })
      .finally(() => {
        if (!cancelled) setContestsLoading(false);
      });

    api
      .get<{ history: RatingHistoryPoint[] }>("/me/rating-history")
      .then((res) => {
        if (!cancelled) setRatingHistory(res.history);
      })
      .catch(() => {
        if (!cancelled) setRatingHistory([]);
      });

    // College-scoped rank is intentionally not fetched here too — it's the
    // same cost as the global query, and this page only needs one number
    // for the KPI tile; the full global/college breakdown lives on the
    // dedicated Leaderboard page.
    api
      .get<{ my_rank: number | null }>("/leaderboard?scope=global")
      .then((res) => {
        if (!cancelled) setGlobalRank(res.my_rank);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const firstName = (user?.name ?? "there").split(" ")[0];
  const isRated = (stats?.rating.rated_contests_count ?? 0) > 0;
  const tier = isRated ? getRatingTier(stats!.rating.current_rating) : null;
  const nextTier = isRated ? nextTierGap(stats!.rating.current_rating) : null;

  // The soonest thing that actually matters — a live/upcoming contest (open
  // to everyone) or the student's own college's next drive, whichever is
  // sooner. Only ever real data; hidden entirely if neither exists, rather
  // than falling back to fabricated content.
  const upcomingContests = contests.filter((c) => !c.has_ended).sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const nextContest = upcomingContests[0];
  const nextDrive = placementDrives.filter((d) => d.minutesFromNow > 0).sort((a, b) => a.minutesFromNow - b.minutesFromNow)[0];
  // A contest that has already started (but not ended) sorts first above —
  // it's the most-in-the-past start_at among non-ended contests — so it's
  // already correctly prioritized. What's "counting down" differs though:
  // a live contest counts down to its END, not a start that already passed.
  const contestIsLive = !!nextContest?.has_started;
  const nextContestMinutes = nextContest
    ? Math.round((new Date(contestIsLive ? nextContest.end_at : nextContest.start_at).getTime() - Date.now()) / 60000)
    : Infinity;
  // A live contest is happening right now, so it always outranks a merely
  // upcoming drive — otherwise fall back to comparing start times.
  const priorityIsContest =
    !!nextContest && (contestIsLive || Math.round((new Date(nextContest.start_at).getTime() - Date.now()) / 60000) < (nextDrive?.minutesFromNow ?? Infinity));

  const solvedBuckets = stats
    ? [
        { label: "Easy", solved: stats.solved.easy.solved, total: stats.solved.easy.total, bar: "bg-status-success", text: "text-status-success" },
        { label: "Medium", solved: stats.solved.medium.solved, total: stats.solved.medium.total, bar: "bg-status-warning", text: "text-status-warning" },
        { label: "Hard", solved: stats.solved.hard.solved, total: stats.solved.hard.total, bar: "bg-status-danger", text: "text-status-danger" },
      ]
    : [];

  const focusTopics = stats ? [...stats.topic_mastery].filter((t) => t.total > 0).sort((a, b) => a.accuracy - b.accuracy).slice(0, 5) : [];
  const weakestTopic = focusTopics[0];

  const chartData = ratingHistory.map((h) => ({
    contest: h.contest_title,
    date: new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    rating: h.rating,
    change: h.change,
    rank: h.rank,
  }));
  const peakRating = chartData.length > 0 ? Math.max(...chartData.map((d) => d.rating)) : null;
  const latestChange = chartData[chartData.length - 1]?.change ?? 0;

  // Readiness tiers are the three the backend actually emits (see
  // ReadinessStats["tier"]). Each gets its own chip colour and a sentence
  // saying what the number means — a bare "13%" with no verdict next to it
  // is a score without a diagnosis.
  const readinessTone = ((): { chip: string; blurb: string } => {
    switch (stats?.readiness.tier) {
      case "Placement Ready":
        return {
          chip: "bg-status-success/10 text-status-success",
          blurb: "You're clearing the bar your placement cell screens on. Keep the streak going.",
        };
      case "In Progress":
        return {
          chip: "bg-status-warning/10 text-status-warning",
          blurb: "Close. More consistent problem solving will move you into the ready band.",
        };
      case "Needs Training":
        return {
          chip: "bg-status-danger/10 text-status-danger",
          blurb: "Keep practicing to improve your problem solving, DSA and system design skills.",
        };
      default:
        return {
          chip: "bg-elevated text-text-muted",
          blurb: "Solve a few problems to generate your readiness score.",
        };
    }
  })();

  return (
    <DashboardShell
      role="user"
      title={`${greeting()}, ${firstName}`}
      subtitle={[tier ? `${tier.name} · Division ${tier.division}` : null, user?.college?.name].filter(Boolean).join(" · ")}
      actionButton={{
        label: "Practice Arena",
        icon: Zap,
        onClick: () => router.push("/dashboard/practice"),
      }}
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------ */}
      {/* 1. Priority: the soonest real contest or drive — never mock   */}
      {/* ------------------------------------------------------------ */}
      {!contestsLoading && !drivesLoading && (priorityIsContest ? nextContest : nextDrive) && (
        <section
          id="priority"
          className={cn(
            // The one genuinely urgent thing on the page, so it gets the only
            // saturated surface: a wash of the accent across a white card.
            // Everything else on the dashboard stays white-on-tint, which is
            // what lets this read as "look here first" without needing to
            // shout in a heavier colour.
            "relative overflow-hidden rounded-panel border bg-surface bg-gradient-to-r shadow-card",
            priorityIsContest && contestIsLive
              ? "border-status-danger/25 from-status-danger/[0.13] via-status-danger/[0.05] to-accent-primary/[0.07]"
              : "border-accent-primary/20 from-accent-primary/[0.15] via-accent-primary/[0.07] to-accent-secondary/[0.10]"
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-accent-primary/10 blur-3xl"
          />

          <div className="relative flex flex-col gap-6 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <div className="flex min-w-0 items-start gap-4">
              <div
                className={cn(
                  "flex h-14 w-14 shrink-0 items-center justify-center rounded-panel border shadow-subtle",
                  priorityIsContest && contestIsLive
                    ? "border-status-danger/25 bg-surface text-status-danger"
                    : "border-accent-primary/20 bg-surface text-accent-primary"
                )}
              >
                {priorityIsContest ? <Swords className="h-7 w-7" /> : <Briefcase className="h-7 w-7" />}
              </div>

              <div className="min-w-0">
                {/* Solid ink chip rather than another tinted pastel. Against
                    a tinted panel a tinted badge disappears; `bg-primary
                    text-surface` inverts cleanly in both themes (navy-on-
                    white in light, white-on-dark in dark). */}
                <span
                  className={cn(
                    "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-3xs font-extrabold uppercase tracking-[0.1em]",
                    priorityIsContest && contestIsLive
                      ? "bg-status-danger text-white"
                      : "bg-primary text-surface"
                  )}
                >
                  {priorityIsContest && contestIsLive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white motion-safe:animate-pulse" />
                  )}
                  {priorityIsContest
                    ? contestIsLive
                      ? "Live Now"
                      : nextContest!.is_rated
                        ? "Rated Contest"
                        : "Contest"
                    : "Placement Drive"}
                </span>

                <h2 className="mt-2.5 truncate text-xl font-extrabold leading-tight tracking-tight text-primary sm:text-2xl">
                  {priorityIsContest ? nextContest!.title : nextDrive!.company.name}
                </h2>
                <p className="mt-1.5 text-13 font-medium text-text-secondary">
                  {priorityIsContest
                    ? `${nextContest!.problem_count} problems · ${nextContest!.total_points} points${nextContest!.is_rated ? " · Rated" : ""}`
                    : `${nextDrive!.roleTitle} · ${nextDrive!.ctcRange ?? "CTC not disclosed"}`}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-end lg:flex-col lg:items-end xl:flex-row xl:items-end">
              <div>
                <span className="mb-2 block text-3xs font-bold uppercase tracking-[0.12em] text-text-muted">
                  {priorityIsContest && contestIsLive ? "Ends in" : "Starts in"}
                </span>
                <CountdownTimer
                  variant="raised"
                  minutesFromNow={priorityIsContest ? nextContestMinutes : nextDrive!.minutesFromNow}
                />
              </div>

              <Link
                href={
                  priorityIsContest
                    ? `/dashboard/contests/view?slug=${nextContest!.slug}`
                    : `/dashboard/drives?driveId=${nextDrive!.id}`
                }
                className={cn(
                  "flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[12px] px-5 text-13 font-bold shadow-subtle transition-all hover:shadow-card active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  priorityIsContest && contestIsLive
                    ? "bg-status-danger text-white hover:brightness-110"
                    : "bg-primary text-surface hover:opacity-90"
                )}
              >
                <span>
                  {priorityIsContest
                    ? nextContest!.is_registered
                      ? contestIsLive
                        ? "Start Contest"
                        : "View Contest"
                      : "Register"
                    : "Prepare"}
                </span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ */}
      {/* 2. KPI strip — every value real                              */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Each tile ends in the one action that actually moves its number,
            so the strip reads as four next steps rather than four dead
            readouts. The label changes with state where the useful action
            does — an unrated student needs a contest, a rated one needs
            their history. */}
        <StatTile
          label="Rating"
          value={stats?.rating.display_rating ?? "—"}
          icon={Trophy}
          tone="primary"
          hint={
            isRated
              ? `${latestChange >= 0 ? "+" : ""}${latestChange} from last contest`
              : "Enter a contest to get rated"
          }
          action={
            isRated
              ? { label: "View rating history", href: "/dashboard/reports" }
              : { label: "Enter a contest", href: "/dashboard/contests" }
          }
        />
        <StatTile
          label="Global Rank"
          value={globalRank ? `#${globalRank}` : "—"}
          icon={Gauge}
          tone="secondary"
          hint={user?.college?.name ? "See college rank on the leaderboard" : undefined}
          action={{ label: "View leaderboard", href: "/dashboard/leaderboard" }}
        />
        <StatTile
          label="Problems Solved"
          value={stats?.solved.total_solved ?? 0}
          icon={CheckCircle2}
          tone="success"
          hint={`${stats?.solved.hard.solved ?? 0} hard problems cracked`}
          action={{ label: "Solve problems", href: "/dashboard/practice" }}
        />
        <StatTile
          label="Current Streak"
          value={stats?.streak.current ?? 0}
          suffix="days"
          icon={Flame}
          tone="warning"
          hint={`Personal best: ${stats?.streak.max ?? 0} days`}
          action={{ label: "Start practicing", href: "/dashboard/practice" }}
        />
      </div>

      {/* ------------------------------------------------------------ */}
      {/* 3. Rating trend + placement readiness                         */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2 flex-wrap">
                <Activity className="w-4 h-4 text-accent-primary" />
                <span>Rating Progression</span>
                {isRated && <RatingBadge rating={stats!.rating.current_rating} showRating showDivision />}
              </h3>
              {isRated && (
                <p className="text-xs text-text-muted mt-0.5">
                  {chartData.length} rated round{chartData.length === 1 ? "" : "s"} · peak {peakRating}
                  {nextTier && ` · ${nextTier.gap} to ${nextTier.next.label}`}
                </p>
              )}
            </div>
            <Link
              href="/dashboard/reports"
              className="text-2xs font-semibold text-accent-primary hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Full report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isRated ? (
            <>
              <RatingChart data={chartData} height={250} />
              <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border-subtle text-center">
                <div>
                  <div className="text-3xs uppercase tracking-wider text-text-muted font-semibold">Peak</div>
                  <div className="text-sm font-bold text-primary font-mono mt-1">{peakRating}</div>
                </div>
                <div>
                  <div className="text-3xs uppercase tracking-wider text-text-muted font-semibold">Last Delta</div>
                  <div className={cn("text-sm font-bold font-mono mt-1", latestChange >= 0 ? "text-status-success" : "text-status-danger")}>
                    {latestChange >= 0 ? "+" : ""}
                    {latestChange}
                  </div>
                </div>
                <div>
                  <div className="text-3xs uppercase tracking-wider text-text-muted font-semibold">
                    {nextTier ? `To ${nextTier.next.label}` : "Max Tier"}
                  </div>
                  <div className="text-sm font-bold text-accent-primary font-mono mt-1">{nextTier ? `+${nextTier.gap}` : "—"}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
              <Swords className="w-8 h-8 text-text-muted" />
              <p className="text-sm text-text-secondary max-w-xs">
                You haven&apos;t entered a rated contest yet — your rating progression will show up here once you do.
              </p>
              <Link
                href="/dashboard/contests"
                className="mt-1 px-4 py-2 rounded-btn bg-accent-primary hover:bg-accent-primary-hover text-white text-xs font-bold transition-all shadow-subtle hover:shadow-glow flex items-center gap-1.5"
              >
                <span>Browse Contests</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
            <Target className="h-4 w-4 text-accent-secondary" />
            <span>Placement Readiness</span>
          </h3>

          {/* Ring and verdict side by side rather than the ring centred on
              its own row: the number needs the words next to it to mean
              anything, and stacking them pushed the actual guidance below
              the fold of this column. */}
          <div className="mt-4 flex items-center gap-4">
            <ReadinessRing
              value={stats?.readiness.score ?? 0}
              label={stats?.readiness.tier ?? "Ready"}
              size={112}
              stroke={9}
              showLabel={false}
            />
            <div className="min-w-0">
              <span
                className={cn(
                  "inline-flex w-fit rounded-full px-2.5 py-1 text-3xs font-extrabold uppercase tracking-[0.08em]",
                  readinessTone.chip
                )}
              >
                {stats?.readiness.tier ?? "—"}
              </span>
              <p className="mt-2 text-xs font-medium leading-relaxed text-text-secondary">
                {readinessTone.blurb}
              </p>
            </div>
          </div>

          {stats && stats.readiness.components.length > 0 && (
            <div className="mt-5 flex-1">
              <ReadinessBreakdown components={stats.readiness.components} nextSteps={stats.readiness.next_steps} compact />
            </div>
          )}

          <Link
            href="/dashboard/reports"
            className="group mt-5 flex items-center gap-1.5 border-t border-border-subtle pt-4 text-2xs font-bold text-accent-primary transition-colors"
          >
            <span>View roadmap</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>

          <p className="mt-3 flex items-start gap-2 text-2xs text-text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success" />
            <span>The same score your placement cell sees on your profile.</span>
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* 4. This week's goals + solved mix                             */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-primary flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-status-success" />
              <span>This Week&apos;s Goals</span>
            </h3>
          </div>

          <div className="space-y-3.5 flex-1">
            {[
              { label: "Problems solved", ...(stats?.weekly_goals.solved_this_week ?? { current: 0, target: 20 }) },
              { label: "Hard problems solved", ...(stats?.weekly_goals.hard_solved_this_week ?? { current: 0, target: 5 }) },
            ].map((goal) => {
              const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
              const done = goal.current >= goal.target;
              return (
                <div key={goal.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary flex items-center gap-1.5">
                      {done && <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />}
                      {goal.label}
                    </span>
                    <span className={cn("font-mono font-bold", done ? "text-status-success" : "text-primary")}>
                      {goal.current}/{goal.target}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", done ? "bg-status-success" : "bg-accent-primary")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <Link
            href="/dashboard/practice"
            className="mt-4 w-full py-2.5 rounded-btn bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-primary transition-colors flex items-center justify-center gap-1.5"
          >
            <span>Open Practice Arena</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-primary flex items-center gap-2">
              <Code2 className="w-4 h-4 text-accent-primary" />
              <span>Solved Breakdown</span>
            </h3>
            <span className="text-xs font-mono font-bold text-accent-primary">{stats?.solved.total_solved ?? 0}</span>
          </div>

          <div className="space-y-4 flex-1">
            {solvedBuckets.map((bucket) => (
              <div key={bucket.label} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className={cn("font-semibold", bucket.text)}>{bucket.label}</span>
                  <span className="font-mono text-text-muted">
                    {bucket.solved} / {bucket.total}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-elevated overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", bucket.bar)}
                    style={{ width: `${bucket.total > 0 ? (bucket.solved / bucket.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* 5. Upcoming placement drives mapped to the student's college  */}
      {/* ------------------------------------------------------------ */}
      <section id="placement-drives" className="scroll-mt-24">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-primary flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-accent-secondary" />
              <span>Upcoming Placement Drives</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Companies your TPO has opened up for {user?.college?.name ?? "your college"}
            </p>
          </div>
        </div>

        {drivesLoading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading placement drives...</span>
          </div>
        ) : !driveAccess ? (
          <div className="p-6 text-center rounded-panel bg-surface border border-border-subtle space-y-2">
            <p className="text-xs text-text-secondary">Placement drives aren&apos;t included on your current plan.</p>
            <Link href="/dashboard/billing" className="inline-block text-xs font-bold text-accent-primary hover:underline">
              Upgrade to unlock placement drives →
            </Link>
          </div>
        ) : placementDrives.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
            No placement drives are mapped to your college yet — check back after your TPO schedules one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {placementDrives.map((drive) => (
              <div
                key={drive.id}
                className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle hover:border-border-strong transition-all flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl shrink-0">{drive.company.logo ?? "🏢"}</span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-primary truncate">{drive.company.name}</h4>
                      <p className="text-2xs text-text-muted truncate">{drive.roleTitle}</p>
                    </div>
                  </div>
                  {drive.myApplication ? (
                    <span
                      className={cn(
                        "shrink-0 px-1.5 py-0.5 rounded-full border text-3xs font-bold whitespace-nowrap",
                        drive.myApplication.stage === "offer_accepted"
                          ? "bg-status-success/15 text-status-success border-status-success/30"
                          : drive.myApplication.stage === "rejected" || drive.myApplication.stage === "withdrawn"
                          ? "bg-elevated text-text-muted border-border-subtle"
                          : "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30"
                      )}
                    >
                      {drive.myApplication.stage_label}
                    </span>
                  ) : (
                    <>
                      {drive.studentEligibility.status === "eligible" && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/30 text-3xs font-bold whitespace-nowrap">
                          Eligible
                        </span>
                      )}
                      {drive.studentEligibility.status === "not_eligible" && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-status-danger/15 text-status-danger border border-status-danger/30 text-3xs font-bold whitespace-nowrap">
                          Not Eligible
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between text-2xs">
                  <span className="font-mono font-bold text-primary">{drive.ctcRange ?? "Not disclosed"}</span>
                  {drive.minutesFromNow > 0 ? (
                    <CountdownTimer minutesFromNow={drive.minutesFromNow} compact className="text-accent-primary font-bold" />
                  ) : (
                    <span className="text-text-muted font-semibold">Drive day has arrived</span>
                  )}
                </div>

                <Link
                  href={`/dashboard/drives?driveId=${drive.id}`}
                  className="mt-1 w-full py-2 rounded-btn bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/25 text-accent-primary text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Prepare</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ */}
      {/* 6. Focus areas + upcoming contests                            */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
                <Target className="w-4 h-4 text-accent-primary" />
                <span>Focus Areas</span>
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Your weakest topics by accuracy</p>
            </div>
            <Link
              href="/dashboard/reports"
              className="text-2xs font-semibold text-accent-primary hover:underline flex items-center gap-1 shrink-0"
            >
              <span>All topics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {focusTopics.length > 0 ? (
            <>
              <TopicMasteryList topics={focusTopics} />
              {weakestTopic && (
                <div className="mt-5 pt-5 border-t border-border-subtle">
                  <div className="p-3 rounded-control bg-status-warning/5 border border-status-warning/25 space-y-1">
                    <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-status-warning shrink-0" />
                      <span>Focus on {weakestTopic.topic}</span>
                    </div>
                    <p className="text-2xs text-text-secondary leading-relaxed">
                      {weakestTopic.accuracy}% accuracy so far · {weakestTopic.solved}/{weakestTopic.total} solved in the catalog.
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-text-muted py-6 text-center">
              Solve a few problems to see your topic breakdown here.
            </p>
          )}
        </div>

        <div id="upcoming" className="p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle scroll-mt-24">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-primary flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-accent-secondary" />
              <span>Upcoming Contests</span>
            </h3>
            <span className="text-3xs text-text-muted font-mono">{upcomingContests.length} scheduled</span>
          </div>

          {contestsLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : upcomingContests.length === 0 ? (
            <p className="text-xs text-text-muted py-6 text-center">No contests scheduled right now — check back soon.</p>
          ) : (
            <div className="space-y-3">
              {upcomingContests.slice(0, 5).map((contest) => {
                const isLive = contest.has_started;
                const minutesFromNow = Math.round(
                  (new Date(isLive ? contest.end_at : contest.start_at).getTime() - Date.now()) / 60000
                );
                return (
                  <Link
                    key={contest.id}
                    href={`/dashboard/contests/view?slug=${contest.slug}`}
                    className="block p-3.5 rounded-control bg-elevated/60 border border-border-subtle hover:border-border-strong transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "px-1.5 py-0.5 text-3xs font-bold uppercase rounded border flex items-center gap-1",
                          isLive
                            ? "bg-status-danger/10 text-status-danger border-status-danger/25"
                            : "bg-accent-primary/10 text-accent-primary border-accent-primary/25"
                        )}
                      >
                        {isLive && <span className="w-1.5 h-1.5 rounded-full bg-status-danger animate-pulse" />}
                        {isLive ? "Live Now" : contest.is_rated ? "Rated Contest" : "Contest"}
                      </span>
                      {contest.is_registered && (
                        <span className="text-3xs font-bold text-status-success flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          Registered
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-bold text-primary leading-snug">{contest.title}</h4>

                    <div className="flex items-center justify-between text-3xs text-text-muted">
                      <span>
                        {contest.problem_count} problems · {contest.total_points} pts
                      </span>
                      <CountdownTimer
                        minutesFromNow={minutesFromNow}
                        compact
                        className={cn("font-bold", isLive ? "text-status-danger" : "text-accent-primary")}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <Link
            href="/dashboard/contests"
            className="mt-4 w-full py-2 rounded-btn bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-primary transition-colors flex items-center justify-center gap-1.5"
          >
            <span>View All Contests</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* 7. Activity heatmap                                           */}
      {/* ------------------------------------------------------------ */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-status-success" />
              <span>Submission Activity</span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">Last 12 months</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Flame className="w-4 h-4 text-amber-500" />
            <span className="font-mono font-bold text-primary">{stats?.streak.current ?? 0} day streak</span>
          </div>
        </div>

        <ActivityHeatmap weeks={activityWeeks} />
      </section>

      {/* ------------------------------------------------------------ */}
      {/* 8. Recent submissions                                         */}
      {/* ------------------------------------------------------------ */}
      <section id="submissions" className="space-y-4 scroll-mt-24">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-primary flex items-center gap-2">
            <Code2 className="w-4 h-4 text-accent-primary" />
            <span>Recent Submissions</span>
          </h3>
        </div>

        <div className="rounded-panel bg-surface border border-border-subtle overflow-hidden shadow-subtle">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-elevated/70 border-b border-border-subtle text-text-muted font-bold uppercase tracking-wider text-3xs">
                <tr>
                  <th className="px-4 py-3">Problem</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3">Verdict</th>
                  <th className="px-4 py-3">Runtime</th>
                  <th className="px-4 py-3">Memory</th>
                  <th className="px-4 py-3 text-right">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {statsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                      Loading...
                    </td>
                  </tr>
                ) : !stats || stats.recent_submissions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-text-muted">
                      No submissions yet — solve a problem in the Practice Arena to see it here.
                    </td>
                  </tr>
                ) : (
                  stats.recent_submissions.map((sub, i) => (
                    <tr key={i} className="hover:bg-surface-hover/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-primary">{sub.problem_title}</div>
                        <div
                          className={cn(
                            "text-3xs font-bold mt-0.5 capitalize",
                            sub.difficulty === "easy" ? "text-status-success" : sub.difficulty === "medium" ? "text-status-warning" : "text-status-danger"
                          )}
                        >
                          {sub.difficulty}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-muted">{sub.language}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 text-3xs font-bold rounded-full border whitespace-nowrap capitalize",
                            sub.status === "accepted"
                              ? "bg-status-success/15 text-status-success border-status-success/30"
                              : sub.status === "wrong_answer"
                              ? "bg-status-danger/15 text-status-danger border-status-danger/30"
                              : "bg-status-warning/15 text-status-warning border-status-warning/30"
                          )}
                        >
                          {sub.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{sub.runtime_ms !== null ? `${sub.runtime_ms}ms` : "—"}</td>
                      <td className="px-4 py-3 font-mono text-text-secondary">{sub.memory_kb !== null ? `${sub.memory_kb}KB` : "—"}</td>
                      <td className="px-4 py-3 text-right text-text-muted whitespace-nowrap">
                        {new Date(sub.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-center">
          <Link
            href="/dashboard/reports"
            className="px-4 py-2 rounded-btn bg-surface hover:bg-surface-hover border border-border-subtle text-xs font-semibold text-text-secondary hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
            <span>View full performance report</span>
          </Link>
        </div>
      </section>
    </DashboardShell>
  );
}
