"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Trophy,
  Percent,
  Activity,
  Target,
  Building2,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Code2,
  Flame,
  Gauge,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { StatTile } from "@/components/dashboard/student/StatTile";
import { RatingChart } from "@/components/dashboard/student/RatingChart";
import { VerdictDonut } from "@/components/dashboard/student/VerdictDonut";
import { TopicMasteryList } from "@/components/dashboard/student/TopicMasteryList";
import { RatingBadge } from "@/components/dashboard/student/RatingBadge";
import { ReadinessBreakdown } from "@/components/dashboard/student/ReadinessBreakdown";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useMyStats } from "@/lib/useMyStats";
import { api } from "@/lib/api";
import { RatingHistoryPoint } from "@/types/studentStats";

interface ApiDriveSummary {
  company: { name: string };
  role_title: string;
  ctc_range: string | null;
  student_eligibility: { status: "eligible" | "not_eligible" | "unknown" };
}

export default function PerformanceReportPage() {
  const { user, status } = useAuthGuard(["user"]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryPoint[]>([]);
  const [drives, setDrives] = useState<ApiDriveSummary[]>([]);

  const { stats, loading: statsLoading } = useMyStats(status === "ready");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<{ history: RatingHistoryPoint[] }>("/me/rating-history")
      .then((res) => setRatingHistory(res.history))
      .catch(() => setRatingHistory([]));
    api
      .get<{ drives: ApiDriveSummary[] }>("/drives")
      .then((res) => setDrives(res.drives))
      .catch(() => setDrives([]));
  }, [status]);

  if (status !== "ready" || statsLoading || !stats) {
    return <SessionLoader label={status !== "ready" ? undefined : "Loading your report..."} />;
  }

  const isRated = stats.rating.rated_contests_count > 0;
  const chartData = ratingHistory.map((h) => ({
    contest: h.contest_title,
    date: new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    rating: h.rating,
    change: h.change,
    rank: h.rank,
  }));
  const netRating = chartData.reduce((s, p) => s + p.change, 0);

  const totalSubs = stats.verdict_stats.reduce((s, v) => s + v.count, 0);
  const accepted = stats.verdict_stats.find((v) => v.status === "accepted")?.count ?? 0;
  const acceptanceRate = totalSubs > 0 ? Math.round((accepted / totalSubs) * 100) : 0;

  const eligibleCount = drives.filter((d) => d.student_eligibility.status === "eligible").length;

  // Simple, real insights generated from the already-fetched topic mastery —
  // no backend round trip needed, and no fabricated strength/focus copy.
  const attempted = stats.topic_mastery.filter((t) => t.solved > 0 || t.total > 0);
  const strongest = [...attempted].filter((t) => t.solved > 0).sort((a, b) => b.accuracy - a.accuracy)[0];
  const weakest = [...attempted].filter((t) => t.solved < t.total).sort((a, b) => a.accuracy - b.accuracy)[0];

  const handleDownload = async () => {
    // jsPDF + autoTable (~300kB) only ever loaded when the student actually
    // clicks Download, not bundled into every visit to this report page.
    const { generateReportPdf } = await import("@/lib/generateReportPdf");
    generateReportPdf({
      studentName: user?.name ?? "Student",
      college: user?.college?.name,
      ratingLabel: stats.rating.display_rating,
      solvedTotal: stats.solved.total_solved,
      streakCurrent: stats.streak.current,
      streakMax: stats.streak.max,
      readinessScore: stats.readiness.score,
      readinessTier: stats.readiness.tier,
      acceptanceRate,
      accepted,
      totalSubmissions: totalSubs,
      verdictStats: stats.verdict_stats,
      languageUsage: stats.language_usage,
      topicMastery: stats.topic_mastery,
      recentSubmissions: stats.recent_submissions,
      driveEligibility: drives.map((d) => ({
        company: d.company.name,
        role: d.role_title,
        ctcRange: d.ctc_range,
        status: d.student_eligibility.status,
      })),
    });
    triggerToast("Your performance report PDF has downloaded.");
  };

  return (
    <DashboardShell
      role="user"
      title="Performance Report"
      subtitle="A full breakdown of your real solved history, accuracy, topic mastery and placement eligibility."
      actionButton={{ label: "Download PDF", icon: Download, onClick: handleDownload }}
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

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Acceptance Rate"
          value={`${acceptanceRate}%`}
          icon={Percent}
          tone="success"
          hint={`${accepted} of ${totalSubs} submissions`}
        />
        <StatTile
          label="Problems Solved"
          value={stats.solved.total_solved}
          icon={Trophy}
          tone="primary"
          hint={`${stats.solved.hard.solved} hard problems`}
        />
        <StatTile
          label="Current Streak"
          value={stats.streak.current}
          suffix="days"
          icon={Flame}
          tone="warning"
          hint={`Best: ${stats.streak.max} days`}
        />
        <StatTile
          label="Drives Eligible"
          value={eligibleCount}
          suffix={`/ ${drives.length}`}
          icon={Building2}
          tone="secondary"
          hint="By your academic profile on file"
        />
      </div>

      {/* Readiness breakdown */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
              <Gauge className="w-4 h-4 text-accent-primary" />
              <span>Placement Readiness</span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              What&apos;s driving your score — and the fastest way to move it.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-black text-primary font-mono leading-none">{stats.readiness.score}%</div>
            <div className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mt-1">{stats.readiness.tier}</div>
          </div>
        </div>

        <ReadinessBreakdown components={stats.readiness.components} nextSteps={stats.readiness.next_steps} />
      </section>

      {/* Rating trend */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2 flex-wrap">
              <Activity className="w-4 h-4 text-accent-primary" />
              <span>Rating Trend</span>
              {isRated && <RatingBadge rating={stats.rating.current_rating} showRating showDivision />}
            </h2>
            {isRated && (
              <p className="text-xs text-text-muted mt-0.5">
                Net change: <strong className={cn(netRating >= 0 ? "text-status-success" : "text-status-danger")}>
                  {netRating >= 0 ? "+" : ""}
                  {netRating}
                </strong>
              </p>
            )}
          </div>
        </div>

        {isRated ? (
          <RatingChart data={chartData} height={280} />
        ) : (
          <p className="text-xs text-text-muted text-center py-10">
            You haven&apos;t entered a rated contest yet — your rating trend will appear here once you do.
          </p>
        )}
      </section>

      {/* Accuracy + languages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-accent-primary" />
            <span>Verdict Distribution</span>
          </h2>
          {stats.verdict_stats.length > 0 ? (
            <>
              <VerdictDonut data={stats.verdict_stats} />
              <p className="mt-5 pt-4 border-t border-border-subtle text-[11px] text-text-muted">
                Based on all {totalSubs} of your submissions.
              </p>
            </>
          ) : (
            <p className="text-xs text-text-muted text-center py-8">No submissions yet.</p>
          )}
        </section>

        <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-5">
            <Code2 className="w-4 h-4 text-accent-secondary" />
            <span>Language Usage</span>
          </h2>

          {stats.language_usage.length > 0 ? (
            <div className="space-y-4">
              {stats.language_usage.map((lang) => {
                const share = totalSubs > 0 ? Math.round((lang.count / totalSubs) * 100) : 0;
                return (
                  <div key={lang.language} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary font-mono">{lang.language}</span>
                      <span className="text-text-muted font-mono">
                        {lang.count} submissions · {share}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-8">No submissions yet.</p>
          )}
        </section>
      </div>

      {/* Topic mastery full */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
              <Target className="w-4 h-4 text-accent-primary" />
              <span>Topic Mastery</span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Accuracy and coverage across every algorithmic category in the catalog.</p>
          </div>
        </div>

        {stats.topic_mastery.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
            <TopicMasteryList topics={stats.topic_mastery.slice(0, Math.ceil(stats.topic_mastery.length / 2))} />
            <TopicMasteryList topics={stats.topic_mastery.slice(Math.ceil(stats.topic_mastery.length / 2))} />
          </div>
        ) : (
          <p className="text-xs text-text-muted text-center py-8">No problems in the catalog yet.</p>
        )}
      </section>

      {/* Insights — generated from the real topic mastery above, not fabricated copy */}
      {(strongest || weakest) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {strongest && (
            <div className="p-5 sm:p-6 rounded-panel bg-surface border border-status-success/25 shadow-subtle">
              <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-status-success" />
                <span>What&apos;s Working</span>
              </h2>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-primary">{strongest.topic}</div>
                  <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">
                    {strongest.accuracy}% accuracy, {strongest.solved}/{strongest.total} solved — your strongest topic so far.
                  </p>
                </div>
              </div>
            </div>
          )}

          {weakest && (
            <div className="p-5 sm:p-6 rounded-panel bg-surface border border-status-warning/25 shadow-subtle">
              <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-status-warning" />
                <span>Where To Focus</span>
              </h2>
              <div className="flex items-start gap-2.5">
                <Target className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-primary">{weakest.topic}</div>
                  <p className="text-[11px] text-text-secondary leading-relaxed mt-0.5">
                    {weakest.accuracy}% accuracy, {weakest.solved}/{weakest.total} solved — worth extra practice here.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Placement drive eligibility — reuses the real per-drive eligibility already computed by EligibilityService */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent-secondary" />
            <span>Placement Drive Eligibility</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">Drives your TPO has mapped, checked against your academic profile.</p>
        </div>

        {drives.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
            No placement drives are mapped to your college yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {drives.map((drive, i) => (
              <div
                key={i}
                className="p-4 rounded-panel bg-surface border border-border-subtle shadow-subtle hover:border-border-strong transition-colors space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-primary truncate">{drive.company.name}</div>
                    <div className="text-[11px] text-text-muted truncate">{drive.role_title}</div>
                  </div>
                  <span
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap shrink-0",
                      drive.student_eligibility.status === "eligible"
                        ? "bg-status-success/15 text-status-success border-status-success/30"
                        : drive.student_eligibility.status === "not_eligible"
                        ? "bg-status-danger/15 text-status-danger border-status-danger/30"
                        : "bg-status-warning/15 text-status-warning border-status-warning/30"
                    )}
                  >
                    {drive.student_eligibility.status === "eligible"
                      ? "Eligible"
                      : drive.student_eligibility.status === "not_eligible"
                      ? "Not Eligible"
                      : "Unknown"}
                  </span>
                </div>
                <div className="pt-2 border-t border-border-subtle text-[11px] text-text-muted font-mono">
                  {drive.ctc_range ?? "CTC not disclosed"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
