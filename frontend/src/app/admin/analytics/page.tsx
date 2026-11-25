"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Code2,
  FileBarChart,
  Gauge,
  GraduationCap,
  Layers,
  Mail,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserCheck,
  Users2,
  UserX,
  type LucideIcon,
  Flame,
  AlertTriangle,
  CircuitBoard,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BarChart } from "@/components/dashboard/tpo/BarChart";
import { CoreHeatmapCard } from "@/components/dashboard/tpo/CoreHeatmapCard";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useDepartmentScope } from "@/lib/departments";
import { StudyYearBar } from "@/components/dashboard/tpo/StudyYearBar";
import { api, ApiError } from "@/lib/api";
import { branchGroupKey, branchShortLabel, useBranchCatalog } from "@/lib/branches";
import type { TpoReportsData, TpoReportStudent } from "@/lib/generateTpoReports";
import { computeSectionStats, type SectionCoordinatorInfo } from "@/lib/sectionBreakdown";
import { rollupLanguages } from "@/lib/cohortInsights";
import { languageLabel } from "@/lib/judgeLanguages";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import {
  HpAvatar,
  HpButton,
  HpCard,
  HpCompanyLogo,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpProgress,
  HpSectionHeader,
  HpSkeleton,
  HpSkeletonRows,
  HpStagger,
  HpStatCard,
  hpBtn,
  hpEase,
  hpTh,
  type HpTone,
} from "@/components/portal/kit";
import { HpErrorCard } from "@/components/portal/pipeline-kit";

/**
 * Chart hues for dual-series readiness & practice comparison.
 * Indigo: Readiness Index (0-100)
 * Teal: 7-day Practice Consistency (0-100)
 */
const SERIES_READINESS = "#6366F1";
const SERIES_PRACTICE = "#0D9488";

type BranchReadinessRow = { branch: string; avgReadiness: number; avgPractice: number };

function readinessTone(score: number): HpTone {
  return score >= 75 ? "emerald" : score >= 45 ? "sky" : "amber";
}

function scopeLabel(section: string): string {
  return section === "Unassigned" ? "No Section" : `Section ${section}`;
}

export default function ReadinessAnalyticsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const catalog = useBranchCatalog();
  const { scope: deptScope } = useDepartmentScope();
  const [studyYear, setStudyYear] = useState<number | null>(null);
  const [data, setData] = useState<TpoReportsData | null>(null);
  const [coordinators, setCoordinators] = useState<(SectionCoordinatorInfo & { section: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (deptScope !== "ALL") qs.set("department", deptScope);
      if (studyYear !== null) qs.set("year", String(studyYear));
      const queryStr = qs.toString();
      const [reportsRes, coordinatorsRes] = await Promise.all([
        api.get<TpoReportsData>(queryStr ? `/tpo/reports/data?${queryStr}` : "/tpo/reports/data"),
        api.get<{ coordinators: (SectionCoordinatorInfo & { section: string })[] }>("/tpo/coordinators"),
      ]);
      setData(reportsRes);
      setCoordinators(coordinatorsRes.coordinators ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load readiness analytics.");
    } finally {
      setLoading(false);
    }
  }, [deptScope, studyYear]);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") {
    return <SessionLoader />;
  }

  // Branch-wise readiness aggregated client-side from real student readiness/practice scores
  const branchReadiness: BranchReadinessRow[] = (() => {
    if (!data) return [];
    const groups = new Map<string, { label: string; readiness: number[]; practice: number[] }>();
    for (const s of data.students) {
      const key = branchGroupKey(s);
      if (!key) continue;
      const g = groups.get(key) ?? { label: branchShortLabel(s, catalog) ?? key, readiness: [], practice: [] };
      g.readiness.push(s.readiness_score);
      g.practice.push(s.practice_score);
      groups.set(key, g);
    }
    return Array.from(groups.values()).map((g) => ({
      branch: g.label,
      avgReadiness: Math.round(g.readiness.reduce((a, b) => a + b, 0) / g.readiness.length),
      avgPractice: Math.round(g.practice.reduce((a, b) => a + b, 0) / g.practice.length),
    }));
  })();

  const sectionStats = data ? computeSectionStats(data.students, coordinators) : [];

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Readiness Analytics"
      subtitle="Comprehensive diagnostic intelligence on student placement readiness, coding practice consistency, skill tiers, and branch-level benchmarks."
    >
      {error && <HpErrorCard message={error} onRetry={load} />}

      {loading ? (
        <ReadinessSkeleton />
      ) : data ? (
        <ReadinessBody
          data={data}
          branchReadiness={branchReadiness}
          sectionStats={sectionStats}
          studyYear={studyYear}
          onStudyYearChange={setStudyYear}
        />
      ) : (
        !error && (
          <HpEmptyState
            icon={Gauge}
            tone="indigo"
            title="No cohort data available"
            description="Readiness analytics appear here once students are enrolled in your batch."
          />
        )
      )}
    </DashboardShell>
  );
}

/* ── Body ───────────────────────────────────────────────────────────────── */

function ReadinessBody({
  data,
  branchReadiness,
  sectionStats,
  studyYear,
  onStudyYearChange,
}: {
  data: TpoReportsData;
  branchReadiness: BranchReadinessRow[];
  sectionStats: ReturnType<typeof computeSectionStats>;
  studyYear: number | null;
  onStudyYearChange: (y: number | null) => void;
}) {
  const students = data.students;
  const totalStudents = students.length;

  // Readiness Metrics
  const avgReadiness =
    totalStudents > 0 ? Math.round(students.reduce((sum, s) => sum + s.readiness_score, 0) / totalStudents) : 0;
  const avgPractice =
    totalStudents > 0 ? Math.round(students.reduce((sum, s) => sum + s.practice_score, 0) / totalStudents) : 0;

  // Tier distributions
  const readyStudents = students.filter((s) => s.readiness_score >= 75);
  const inProgressStudents = students.filter((s) => s.readiness_score >= 45 && s.readiness_score < 75);
  const needsTrainingStudents = students.filter((s) => s.readiness_score < 45);

  const readyPct = totalStudents > 0 ? Math.round((readyStudents.length / totalStudents) * 100) : 0;
  const inProgressPct = totalStudents > 0 ? Math.round((inProgressStudents.length / totalStudents) * 100) : 0;
  const needsTrainingPct = totalStudents > 0 ? Math.round((needsTrainingStudents.length / totalStudents) * 100) : 0;

  // Practice & engagement
  const activeWeekStudents = students.filter((s) => s.activity?.engagement === "active");
  const activeWeekPct = totalStudents > 0 ? Math.round((activeWeekStudents.length / totalStudents) * 100) : 0;

  const cgpas = students.filter((s) => s.cgpa !== null).map((s) => Number(s.cgpa));
  const avgCgpa = cgpas.length ? cgpas.reduce((a, b) => a + b, 0) / cgpas.length : null;

  const totalSolved = students.reduce((sum, s) => sum + (s.solved?.total ?? 0), 0);
  const avgSolved = totalStudents > 0 ? Math.round(totalSolved / totalStudents) : 0;

  // Coding languages
  const languageRollup = useMemo(() => rollupLanguages(students), [students]);

  // Solved tiers
  const solved50Plus = students.filter((s) => (s.solved?.total ?? 0) >= 50).length;
  const solved20To49 = students.filter((s) => (s.solved?.total ?? 0) >= 20 && (s.solved?.total ?? 0) < 50).length;
  const solved1To19 = students.filter((s) => (s.solved?.total ?? 0) >= 1 && (s.solved?.total ?? 0) < 20).length;
  const solvedZero = students.filter((s) => (s.solved?.total ?? 0) === 0).length;

  // At-risk cohort (low readiness or inactive with backlogs)
  const atRiskStudents = students.filter((s) => s.readiness_score < 45 || (s.backlogs ?? 0) > 0);

  return (
    <HpStagger className="space-y-6">
      {/* College Context Header Card */}
      <HpItem>
        <HpCard spotlight={false} className="relative overflow-hidden p-4 sm:p-5">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_160%_at_0%_0%,rgb(var(--hp-id)/0.10),transparent_60%),radial-gradient(50%_160%_at_100%_0%,rgba(99,102,241,0.10),transparent_60%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <HpCompanyLogo name={data.college.name} size="md" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-15 font-bold tracking-tight text-primary">{data.college.name}</span>
                  {data.college.tier && (
                    <HpPill tone="slate" size="sm">
                      {data.college.tier}
                    </HpPill>
                  )}
                </div>
                <div className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-muted">
                  <HpPill tone="indigo" size="sm" dot>
                    Diagnostic Readiness Intelligence
                  </HpPill>
                  <span>
                    {totalStudents} {totalStudents === 1 ? "student" : "students"} · {branchReadiness.length}{" "}
                    {branchReadiness.length === 1 ? "branch" : "branches"} · {sectionStats.length}{" "}
                    {sectionStats.length === 1 ? "section" : "sections"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <StudyYearBar availableYears={data.placements?.available_years} value={studyYear} onChange={onStudyYearChange} />
              <Link href="/admin/reports" className={hpBtn("secondary", "sm", "h-9 shrink-0 self-start px-4 sm:self-auto")}>
                <FileBarChart className="h-4 w-4" />
                Placement Reports
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </HpCard>
      </HpItem>

      {/* Headline Readiness Metrics */}
      <HpItem>
        <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <HpStatCard
            label="Avg Readiness"
            value={avgReadiness}
            icon={Gauge}
            tone="indigo"
            hint="out of 100 · batch-wide index"
          />
          <HpStatCard
            label="Placement Ready"
            value={readyStudents.length}
            icon={CheckCircle2}
            tone="emerald"
            hint={`${readyPct}% of cohort (Score ≥ 75)`}
          />
          <HpStatCard
            label="In Progress"
            value={inProgressStudents.length}
            icon={Target}
            tone="sky"
            hint={`${inProgressPct}% of cohort (Score 45–74)`}
          />
          <HpStatCard
            label="Needs Training"
            value={needsTrainingStudents.length}
            icon={AlertTriangle}
            tone="amber"
            hint={`${needsTrainingPct}% of cohort (Score < 45)`}
          />
          <HpStatCard
            label="Active Practicing"
            value={activeWeekStudents.length}
            icon={Flame}
            tone="teal"
            hint={`${activeWeekPct}% solved in last 7 days`}
          />
        </div>
      </HpItem>

      {/* Readiness Tier Spectrum & Core Diagnostic Pillars */}
      <HpItem>
        <HpCard className="p-5 sm:p-6">
          <HpSectionHeader
            title="Readiness Tier Spectrum & Competency Pillars"
            subtitle="Batch distribution across readiness thresholds and core preparation indicators"
            icon={Layers}
            tone="indigo"
            action={
              <HpPill tone="indigo" size="sm" className="hidden sm:inline-flex">
                <span className="tabular">{avgReadiness}/100 Batch Index</span>
              </HpPill>
            }
          />

          {/* Tri-color Stacked Progress Bar */}
          <div className="mt-6 space-y-3">
            <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-elevated ring-1 ring-inset ring-border-subtle">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${readyPct}%` }}
                transition={{ duration: 0.8, ease: hpEase }}
                className="bg-emerald-500 transition-all"
                title={`Placement Ready: ${readyStudents.length} (${readyPct}%)`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${inProgressPct}%` }}
                transition={{ duration: 0.8, ease: hpEase, delay: 0.1 }}
                className="bg-sky-500 transition-all"
                title={`In Progress: ${inProgressStudents.length} (${inProgressPct}%)`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${needsTrainingPct}%` }}
                transition={{ duration: 0.8, ease: hpEase, delay: 0.2 }}
                className="bg-amber-500 transition-all"
                title={`Needs Training: ${needsTrainingStudents.length} (${needsTrainingPct}%)`}
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-primary">Placement Ready (75–100):</span>
                <span className="tabular text-text-muted">{readyStudents.length} ({readyPct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                <span className="text-primary">In Progress (45–74):</span>
                <span className="tabular text-text-muted">{inProgressStudents.length} ({inProgressPct}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-primary">Needs Training (&lt;45):</span>
                <span className="tabular text-text-muted">{needsTrainingStudents.length} ({needsTrainingPct}%)</span>
              </div>
            </div>
          </div>

          {/* 4 Pillar Mini Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-border-subtle pt-6">
            <div className="rounded-2xl bg-elevated/40 p-4 ring-1 ring-inset ring-border-subtle">
              <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                <Code2 className="h-3.5 w-3.5 text-indigo-500" />
                Coding Velocity
              </div>
              <div className="mt-2 text-xl font-extrabold text-primary">
                {avgSolved} <span className="text-xs font-medium text-text-muted">problems / student</span>
              </div>
              <p className="mt-1 text-2xs text-text-muted">{totalSolved.toLocaleString()} total solutions accepted</p>
            </div>

            <div className="rounded-2xl bg-elevated/40 p-4 ring-1 ring-inset ring-border-subtle">
              <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                <Flame className="h-3.5 w-3.5 text-teal-500" />
                Practice Consistency
              </div>
              <div className="mt-2 text-xl font-extrabold text-primary">
                {avgPractice} <span className="text-xs font-medium text-text-muted">/ 100</span>
              </div>
              <p className="mt-1 text-2xs text-text-muted">7-day continuous activity tracking</p>
            </div>

            <div className="rounded-2xl bg-elevated/40 p-4 ring-1 ring-inset ring-border-subtle">
              <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                <GraduationCap className="h-3.5 w-3.5 text-sky-500" />
                Academic Baseline
              </div>
              <div className="mt-2 text-xl font-extrabold text-primary">
                {avgCgpa !== null ? avgCgpa.toFixed(2) : "—"} <span className="text-xs font-medium text-text-muted">CGPA</span>
              </div>
              <p className="mt-1 text-2xs text-text-muted">Verified college transcript standing</p>
            </div>

            <div className="rounded-2xl bg-elevated/40 p-4 ring-1 ring-inset ring-border-subtle">
              <div className="flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                <CircuitBoard className="h-3.5 w-3.5 text-violet-500" />
                Core Engineering
              </div>
              <div className="mt-2 text-xl font-extrabold text-primary">
                {students.filter((s) => !!s.core).length} <span className="text-xs font-medium text-text-muted">students</span>
              </div>
              <p className="mt-1 text-2xs text-text-muted">Active in Core Domain prep</p>
            </div>
          </div>
        </HpCard>
      </HpItem>

      {/* Branch-wise Readiness Benchmark (Dual BarChart + Ranked Table) */}
      {branchReadiness.length > 0 && (
        <HpItem>
          <HpCard className="p-5 sm:p-6">
            <HpSectionHeader
              title="Branch-wise Readiness Benchmarks"
              subtitle="Comparison of average readiness score and 7-day practice consistency by academic branch"
              icon={BarChart3}
              tone="indigo"
              action={
                <HpPill tone="slate" size="sm" className="hidden sm:inline-flex">
                  <span className="tabular">
                    {branchReadiness.length} {branchReadiness.length === 1 ? "branch" : "branches"}
                  </span>
                </HpPill>
              }
            />
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <BarChart
                variant="premium"
                ariaLabel="Branch-wise average readiness and practice consistency"
                categories={branchReadiness.map((d) => d.branch)}
                series={[
                  { label: "Avg Readiness", color: SERIES_READINESS, values: branchReadiness.map((d) => d.avgReadiness) },
                  { label: "Avg Practice Consistency", color: SERIES_PRACTICE, values: branchReadiness.map((d) => d.avgPractice) },
                ]}
                suffix=""
                maxValue={100}
              />
              <BranchTable rows={branchReadiness} />
            </div>
          </HpCard>
        </HpItem>
      )}

      {/* Coding Competency & Programming Languages */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Programming Languages */}
          <HpCard className="flex flex-col p-5 sm:p-6">
            <HpSectionHeader
              title="Programming Language Adoption"
              subtitle="Primary language distribution and coding engagement across the cohort"
              icon={Code2}
              tone="indigo"
              action={
                languageRollup.length > 0 ? (
                  <HpPill tone="indigo" size="sm">
                    <span className="tabular">{languageRollup.length} languages</span>
                  </HpPill>
                ) : undefined
              }
            />
            {languageRollup.length === 0 ? (
              <InlineEmpty
                icon={Code2}
                title="No code submitted yet"
                description="Languages appear as students write and submit problem solutions."
              />
            ) : (
              <div className="mt-6 space-y-4">
                {languageRollup.slice(0, 6).map((lang) => {
                  const pct = totalStudents > 0 ? Math.round((lang.students / totalStudents) * 100) : 0;
                  return (
                    <div key={lang.language} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-primary">{languageLabel(lang.language)}</span>
                        <span className="tabular text-text-muted">
                          {lang.students} students ({pct}%)
                        </span>
                      </div>
                      <HpProgress value={pct} tone="indigo" className="h-2" />
                    </div>
                  );
                })}
              </div>
            )}
          </HpCard>

          {/* Problem Solving Depth */}
          <HpCard className="flex flex-col p-5 sm:p-6">
            <HpSectionHeader
              title="Problem Solving Volume Tiers"
              subtitle="Student distribution across solved problem volume milestones"
              icon={Trophy}
              tone="teal"
            />
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">50+ Problems (Advanced Practice)</span>
                  <span className="tabular text-text-muted">
                    {solved50Plus} students ({totalStudents > 0 ? Math.round((solved50Plus / totalStudents) * 100) : 0}%)
                  </span>
                </div>
                <HpProgress
                  value={totalStudents > 0 ? Math.round((solved50Plus / totalStudents) * 100) : 0}
                  tone="emerald"
                  className="h-2"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">20 – 49 Problems (Consistent)</span>
                  <span className="tabular text-text-muted">
                    {solved20To49} students ({totalStudents > 0 ? Math.round((solved20To49 / totalStudents) * 100) : 0}%)
                  </span>
                </div>
                <HpProgress
                  value={totalStudents > 0 ? Math.round((solved20To49 / totalStudents) * 100) : 0}
                  tone="sky"
                  className="h-2"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">1 – 19 Problems (Started)</span>
                  <span className="tabular text-text-muted">
                    {solved1To19} students ({totalStudents > 0 ? Math.round((solved1To19 / totalStudents) * 100) : 0}%)
                  </span>
                </div>
                <HpProgress
                  value={totalStudents > 0 ? Math.round((solved1To19 / totalStudents) * 100) : 0}
                  tone="indigo"
                  className="h-2"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary">0 Problems (Not Started)</span>
                  <span className="tabular text-text-muted">
                    {solvedZero} students ({totalStudents > 0 ? Math.round((solvedZero / totalStudents) * 100) : 0}%)
                  </span>
                </div>
                <HpProgress
                  value={totalStudents > 0 ? Math.round((solvedZero / totalStudents) * 100) : 0}
                  tone="amber"
                  className="h-2"
                />
              </div>
            </div>
          </HpCard>
        </div>
      </HpItem>

      {/* Section Readiness & Coordinator Benchmarks */}
      {sectionStats.length > 0 && (
        <HpItem>
          <HpCard spotlight={false} className="p-5 sm:p-6">
            <HpSectionHeader
              title="Section Performance & Coordinator Matrix"
              subtitle="Ranked by average readiness score · identifies sections requiring mentor intervention"
              icon={Users2}
              tone="sky"
              action={
                <span className="tabular text-2xs font-semibold text-text-muted">
                  {sectionStats.length} {sectionStats.length === 1 ? "section" : "sections"}
                </span>
              }
            />
            <div className="mt-5 hidden grid-cols-[minmax(0,1fr)_15rem] gap-4 px-3 pb-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted lg:grid">
              <div className="grid grid-cols-[2rem_9rem_minmax(0,1fr)_5.5rem] gap-4">
                <span>#</span>
                <span>Section</span>
                <span>Avg readiness</span>
                <span className="text-right">Avg CGPA</span>
              </div>
              <span>Coordinator</span>
            </div>
            <ul className="mt-3 space-y-2 lg:mt-0">
              {sectionStats.map((s, i) => (
                <li
                  key={s.section}
                  className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-elevated/30 p-3 transition-all duration-200 hover:border-indigo-500/25 hover:bg-elevated/60 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-center lg:gap-4"
                >
                  <div className="flex w-full min-w-0 items-center gap-x-4 gap-y-2.5 lg:grid lg:grid-cols-[2rem_9rem_minmax(0,1fr)_5.5rem]">
                    <span
                      className={cn(
                        "tabular inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-3xs font-extrabold ring-1 ring-inset transition-colors",
                        i === 0
                          ? "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300"
                          : "bg-elevated text-text-muted ring-border-subtle"
                      )}
                    >
                      #{i + 1}
                    </span>
                    <div className="min-w-0 flex-1 lg:flex-none">
                      <span className="block truncate text-13 font-bold text-primary">{scopeLabel(s.section)}</span>
                      <span className="tabular block text-2xs text-text-muted">
                        {s.studentCount} {s.studentCount === 1 ? "student" : "students"}
                      </span>
                    </div>
                    <div className="order-last flex w-full min-w-0 items-center gap-2.5 lg:order-none lg:w-auto">
                      <HpProgress value={s.avgReadiness} tone={readinessTone(s.avgReadiness)} className="h-2 flex-1" />
                      <span className="tabular w-14 shrink-0 text-right text-xs font-bold text-primary">
                        {s.avgReadiness}
                        <span className="text-3xs font-semibold text-text-muted">/100</span>
                      </span>
                    </div>
                    <span className="tabular shrink-0 text-right text-xs font-semibold text-text-secondary">
                      {s.avgCgpa !== null ? s.avgCgpa.toFixed(2) : "—"}
                    </span>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-2 border-t border-border-subtle pt-3 lg:justify-start lg:border-0 lg:pt-0">
                    {s.coordinator ? (
                      <>
                        <span className="flex min-w-0 items-center gap-2">
                          <HpAvatar name={s.coordinator.name} size="xs" />
                          <span className="truncate text-xs font-semibold text-text-secondary">{s.coordinator.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-0.5 lg:ml-auto">
                          <a
                            href={`mailto:${s.coordinator.email}`}
                            title={`Email ${s.coordinator.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-text-muted transition-colors hover:bg-indigo-500/10 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                          {s.coordinator.phone && (
                            <a
                              href={`tel:${s.coordinator.phone}`}
                              title={`Call ${s.coordinator.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] text-text-muted transition-colors hover:bg-indigo-500/10 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </span>
                      </>
                    ) : (
                      <HpPill tone="amber" size="sm" icon={UserX}>
                        No coordinator
                      </HpPill>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </HpCard>
        </HpItem>
      )}

      {/* Core Prep Subject Heatmap */}
      <CoreHeatmapCard />

      {/* Targeted Readiness Interventions */}
      <HpItem>
        <HpCard className="p-5 sm:p-6">
          <HpSectionHeader
            title="Targeted Readiness Remediation & Action Plan"
            subtitle="Actionable steps for students lagging behind placement thresholds"
            icon={ShieldAlert}
            tone="amber"
            action={
              atRiskStudents.length > 0 ? (
                <HpPill tone="amber" size="sm">
                  <span className="tabular">{atRiskStudents.length} students need support</span>
                </HpPill>
              ) : undefined
            }
          />
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                <Sparkles className="h-4 w-4" />
                Mock AI Interview Practice
              </div>
              <p className="mt-2 text-2xs leading-relaxed text-text-muted">
                {needsTrainingStudents.length} students have a readiness score under 45. Assigning Series 1–3 of Mock AI Interviews accelerates question fluency and technical articulation.
              </p>
              <div className="mt-3">
                <Link href="/admin/mock-interviews" className={hpBtn("secondary", "sm", "w-full")}>
                  Manage Mock AI Interviews
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400">
                <Code2 className="h-4 w-4" />
                Problem Solving Remedial
              </div>
              <p className="mt-2 text-2xs leading-relaxed text-text-muted">
                {solvedZero} students haven't solved any problems yet. Schedule weekly mandatory coding sessions in laboratory slots to build basic DSA muscle memory.
              </p>
              <div className="mt-3">
                <Link href="/admin/mock-contests" className={hpBtn("secondary", "sm", "w-full")}>
                  Set Up Practice Contest
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.04] p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <UserCheck className="h-4 w-4" />
                Coordinator Outreach
              </div>
              <p className="mt-2 text-2xs leading-relaxed text-text-muted">
                Section coordinators can view section-specific rosters, monitor daily student logins, and directly conduct 1-on-1 counseling before drive dates.
              </p>
              <div className="mt-3">
                <Link href="/admin/coordinators" className={hpBtn("secondary", "sm", "w-full")}>
                  View Coordinators
                </Link>
              </div>
            </div>
          </div>
        </HpCard>
      </HpItem>
    </HpStagger>
  );
}

/* ── Small pieces ───────────────────────────────────────────────────────── */

function BranchTable({ rows }: { rows: BranchReadinessRow[] }) {
  const ranked = [...rows].sort((a, b) => b.avgReadiness - a.avgReadiness);
  return (
    <div className="border-t border-border-subtle pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <table className="w-full">
        <caption className="sr-only">Branch-wise average readiness and practice consistency, ranked by readiness</caption>
        <thead>
          <tr className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
            <th scope="col" className="pb-2 pr-2 text-left font-bold">
              <span className="sr-only">Rank</span>#
            </th>
            <th scope="col" className="pb-2 pr-3 text-left font-bold">
              Branch
            </th>
            <th scope="col" className="pb-2 text-right font-bold">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: SERIES_READINESS }} aria-hidden />
                Ready
              </span>
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-bold">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[3px]" style={{ backgroundColor: SERIES_PRACTICE }} aria-hidden />
                Practice
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {ranked.map((r, i) => (
            <tr key={r.branch} className="group">
              <td className="w-8 py-2.5 pr-2 align-middle">
                <span className="tabular inline-flex h-6 w-6 items-center justify-center rounded-lg bg-elevated text-3xs font-extrabold text-text-muted ring-1 ring-inset ring-border-subtle transition-colors group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                  {i + 1}
                </span>
              </td>
              <th scope="row" className="min-w-0 py-2.5 pr-3 text-left align-middle">
                <span className="line-clamp-2 text-xs font-semibold leading-snug text-primary" title={r.branch}>
                  {r.branch}
                </span>
              </th>
              <td className="tabular w-12 py-2.5 text-right align-middle text-sm font-extrabold text-primary">
                {r.avgReadiness}
              </td>
              <td className="tabular w-16 py-2.5 pl-3 text-right align-middle text-xs font-semibold text-text-secondary">
                {r.avgPractice}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineEmpty({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center">
      <HpIconTile icon={icon} tone="slate" size="md" />
      <p className="mt-3 text-13 font-bold text-primary">{title}</p>
      <p className="mt-1 max-w-xs text-2xs leading-relaxed text-text-muted">{description}</p>
    </div>
  );
}

function ReadinessSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading readiness analytics">
      <HpCard spotlight={false} className="flex items-center gap-3.5 p-4 sm:p-5">
        <HpSkeleton className="h-11 w-11 rounded-[14px]" />
        <div className="flex-1 space-y-2">
          <HpSkeleton className="h-3.5 w-48 max-w-full" />
          <HpSkeleton className="h-3 w-64 max-w-full" />
        </div>
        <HpSkeleton className="hidden h-9 w-40 rounded-[10px] sm:block" />
      </HpCard>
      <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <HpStatCard label="Avg Readiness" value={0} icon={Gauge} tone="indigo" loading />
        <HpStatCard label="Placement Ready" value={0} icon={CheckCircle2} tone="emerald" loading />
        <HpStatCard label="In Progress" value={0} icon={Target} tone="sky" loading />
        <HpStatCard label="Needs Training" value={0} icon={AlertTriangle} tone="amber" loading />
        <HpStatCard label="Active Practicing" value={0} icon={Flame} tone="teal" loading />
      </div>
      <HpCard spotlight={false} className="p-5 sm:p-6">
        <HpSkeleton className="h-4 w-44" />
        <HpSkeleton className="mt-4 h-4 rounded-full" />
        <div className="mt-6 grid grid-cols-4 gap-4">
          <HpSkeleton className="h-20 rounded-2xl" />
          <HpSkeleton className="h-20 rounded-2xl" />
          <HpSkeleton className="h-20 rounded-2xl" />
          <HpSkeleton className="h-20 rounded-2xl" />
        </div>
      </HpCard>
      <HpSkeletonRows rows={3} />
    </div>
  );
}
