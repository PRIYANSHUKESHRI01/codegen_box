"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  FileBarChart,
  Filter,
  Gauge,
  Hourglass,
  IndianRupee,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserPlus,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { BarChart } from "@/components/dashboard/tpo/BarChart";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { TpoReportsData } from "@/lib/generateTpoReports";
import {
  HpCard,
  HpCompanyLogo,
  HpEmptyState,
  HpFunnel,
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
} from "@/components/portal/kit";
import { HpErrorCard } from "@/components/portal/pipeline-kit";

/**
 * Chart hues. Two-series pairs are indigo-500 / teal-600 (the same pair the
 * Hiring Reports page ships), validated for colour-vision separation and ≥3:1
 * contrast on the card surface in both themes. Single-series magnitude uses
 * sky-600, the TPO portal's identity hue. Amber/rose stay reserved for risk.
 */
const SERIES_READINESS = "#6366F1";
const SERIES_PRACTICE = "#0D9488";
const SERIES_PACKAGES = "#0284C7";

/** Action-item type → glyph (types come from PlacementReportService::actionItems on the backend). */
const ACTION_ICON: Record<string, LucideIcon> = {
  stale_applications: Clock,
  pending_offers: Hourglass,
  unregistered_eligible: UserPlus,
};

const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** "60.00" → "60", "62.50" → "62.5" — the target arrives as a decimal string. */
const fmtNum = (v: number) => String(Math.round(v * 10) / 10);

type BranchReadinessRow = { branch: string; avgReadiness: number; avgPractice: number };

export default function ReadinessAnalyticsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [data, setData] = useState<TpoReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<TpoReportsData>("/tpo/reports/data");
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") load();
  }, [status, load]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  // Real branch-wise readiness, computed client-side from the already-real
  // per-student readiness_score/practice_score (User::readinessScore()) —
  // replaces the previously-fictional avgDsaScore/avgSpeedScore mock.
  const branchReadiness = (() => {
    if (!data) return [];
    const groups = new Map<string, { readiness: number[]; practice: number[] }>();
    for (const s of data.students) {
      if (!s.branch) continue;
      const g = groups.get(s.branch) ?? { readiness: [], practice: [] };
      g.readiness.push(s.readiness_score);
      g.practice.push(s.practice_score);
      groups.set(s.branch, g);
    }
    return Array.from(groups.entries()).map(([branch, g]) => ({
      branch,
      avgReadiness: Math.round(g.readiness.reduce((a, b) => a + b, 0) / g.readiness.length),
      avgPractice: Math.round(g.practice.reduce((a, b) => a + b, 0) / g.practice.length),
    }));
  })();

  const placements = data?.placements;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Readiness Analytics"
      subtitle="Real branch-wise readiness, package distribution, and placement trends — derived from your actual cohort and recorded outcomes."
    >
      {error && <HpErrorCard message={error} onRetry={load} />}

      {loading ? (
        <AnalyticsSkeleton />
      ) : data && placements ? (
        <AnalyticsBody data={data} branchReadiness={branchReadiness} />
      ) : (
        !error && (
          <HpEmptyState
            icon={BarChart3}
            tone="sky"
            title="No data available"
            description="Analytics appear here once your cohort and placement pipeline have records."
          />
        )
      )}
    </DashboardShell>
  );
}

/* ── Body ───────────────────────────────────────────────────────────────── */

function AnalyticsBody({ data, branchReadiness }: { data: TpoReportsData; branchReadiness: BranchReadinessRow[] }) {
  const placements = data.placements;
  const f = placements.funnel;
  const target = placements.target;

  const avgReadiness =
    branchReadiness.length > 0 ? Math.round(branchReadiness.reduce((s, b) => s + b.avgReadiness, 0) / branchReadiness.length) : 0;
  const targetPct = target.target_percent ? Number(target.target_percent) : null;
  const currentPct = target.current_percent;
  const gapToTarget = targetPct !== null ? Math.max(0, targetPct - currentPct) : null;

  const funnelSteps: [string, number][] = [
    ["Enrolled", f.batch_enrolled],
    ["Registered", f.registered],
    ["Shortlisted", f.shortlisted],
    ["Interviewed", f.interviewed],
    ["Offered", f.offered],
    ["Accepted", f.accepted],
  ];

  // Derived (not fabricated) — the weakest stage-to-stage carry-through of the real funnel counts.
  const dropOff = funnelSteps.slice(1).reduce<{ from: string; to: string; rate: number } | null>((worst, [label, value], i) => {
    const [prevLabel, prev] = funnelSteps[i];
    if (prev <= 0) return worst;
    const rate = pctOf(value, prev);
    return worst === null || rate < worst.rate ? { from: prevLabel, to: label, rate } : worst;
  }, null);

  // Straight sums of the real per-branch rows, for the card's overall line.
  const trendApplications = placements.branch_trend.reduce((s, r) => s + r.applications, 0);
  const trendAccepted = placements.branch_trend.reduce((s, r) => s + r.offers_accepted, 0);

  const totalOffers = placements.package_distribution.reduce((s, b) => s + b.count, 0);
  const peakBracket = placements.package_distribution.reduce<{ bracket: string; count: number } | null>(
    (best, b) => (b.count > 0 && (best === null || b.count > best.count) ? b : best),
    null
  );

  return (
    <HpStagger className="space-y-6">
      {/* Context */}
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
                  <HpPill tone="sky" size="sm" dot>
                    Live cohort data
                  </HpPill>
                  <span>
                    {data.students.length} {data.students.length === 1 ? "student" : "students"} · {branchReadiness.length}{" "}
                    {branchReadiness.length === 1 ? "branch" : "branches"} · {data.drives.length} mapped {data.drives.length === 1 ? "drive" : "drives"}
                  </span>
                </div>
              </div>
            </div>
            <Link href="/admin/reports" className={hpBtn("secondary", "sm", "h-9 shrink-0 self-start px-4 sm:self-auto")}>
              <FileBarChart className="h-4 w-4" />
              Placement Reports
            </Link>
          </div>
        </HpCard>
      </HpItem>

      {/* Headline numbers */}
      <HpItem>
        <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 xl:grid-cols-4">
          <HpStatCard
            label="Avg Readiness"
            value={avgReadiness}
            icon={Gauge}
            tone="indigo"
            hint={`out of 100 · ${branchReadiness.length} ${branchReadiness.length === 1 ? "branch" : "branches"}`}
          />
          <HpStatCard
            label="Companies Hired"
            value={placements.company_summary.length}
            icon={Building2}
            tone="sky"
            hint="with an accepted offer"
          />
          <HpStatCard
            label="Offers Accepted"
            value={f.accepted}
            icon={Trophy}
            tone="emerald"
            hint={`of ${f.offered} ${f.offered === 1 ? "offer" : "offers"} extended`}
          />
          <HpStatCard
            label="Placement Rate"
            value={currentPct}
            suffix="%"
            decimals={Number.isInteger(currentPct) ? 0 : 1}
            icon={Target}
            tone="violet"
            hint={
              targetPct !== null
                ? gapToTarget && gapToTarget > 0
                  ? `Target ${fmtNum(targetPct)}% · ${fmtNum(gapToTarget)} pts to go`
                  : `Target ${fmtNum(targetPct)}% · reached`
                : "No target set"
            }
          />
        </div>
      </HpItem>

      {/* Funnel + attention */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <HpCard className="p-5 sm:p-6 xl:col-span-2">
            <HpSectionHeader
              title="Placement Funnel"
              subtitle="Every stage counts each student who reached it"
              icon={Filter}
              tone="indigo"
              action={
                f.batch_enrolled > 0 ? (
                  <HpPill tone="indigo" size="sm" className="hidden sm:inline-flex">
                    <span className="tabular">{fmtNum((f.accepted / f.batch_enrolled) * 100)}% enrolled → placed</span>
                  </HpPill>
                ) : undefined
              }
            />
            {f.batch_enrolled === 0 ? (
              <InlineEmpty icon={Filter} title="No students enrolled yet" description="The funnel fills in as your batch is imported and registered for drives." />
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_14rem]">
                <HpFunnel stages={funnelSteps.map(([label, value]) => ({ label, value, tone: "indigo" as const }))} />
                <div className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-5 sm:grid-cols-2 sm:items-center xl:flex xl:flex-col xl:items-stretch xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                  <div className="flex items-center gap-4 xl:flex-col xl:items-start">
                    <TargetRing value={currentPct} target={targetPct} />
                    <div>
                      <div className="text-xs font-bold text-primary">Placement vs target</div>
                      <p className="tabular mt-0.5 text-2xs leading-relaxed text-text-muted">
                        {targetPct !== null ? (
                          <>
                            Target {fmtNum(targetPct)}%
                            {target.target_deadline &&
                              ` by ${new Date(target.target_deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                            .
                          </>
                        ) : (
                          "No placement target set for this season."
                        )}
                      </p>
                    </div>
                  </div>
                  {dropOff && dropOff.rate < 100 && (
                    <div className="rounded-2xl bg-elevated/60 p-3 ring-1 ring-inset ring-border-subtle">
                      <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                        <TrendingDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" aria-hidden />
                        Biggest drop-off
                      </div>
                      <div className="mt-1 text-xs font-bold text-primary">
                        {dropOff.from} → {dropOff.to}
                      </div>
                      <div className="tabular text-2xs text-text-muted">{dropOff.rate}% carried through</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </HpCard>

          <AttentionCard items={placements.action_items} />
        </div>
      </HpItem>

      {/* Branch readiness */}
      {branchReadiness.length > 0 && (
        <HpItem>
          <HpCard className="p-5 sm:p-6">
            <HpSectionHeader
              title="Branch-wise Readiness"
              subtitle="Average readiness and 7-day practice consistency per branch, out of 100"
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
            <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
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

      {/* Placement rate + packages */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <HpCard className="flex flex-col p-5 sm:p-6">
            <HpSectionHeader title="Branch Placement Rate" subtitle="Accepted offers per application, by branch and year" icon={TrendingUp} tone="emerald" />
            {placements.branch_trend.length === 0 ? (
              <InlineEmpty
                icon={TrendingUp}
                tone="emerald"
                title="No placement outcomes yet"
                description="No placement outcomes recorded yet this season — this fills in as offers are accepted."
              />
            ) : (
              <ul className="mt-6 space-y-4">
                {placements.branch_trend.map((row) => (
                  <li key={`${row.year}-${row.branch}`}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-xs font-semibold text-primary">{row.branch}</span>
                        <HpPill tone="slate" size="sm">
                          <span className="tabular">{row.year}</span>
                        </HpPill>
                      </span>
                      <span className="flex shrink-0 items-baseline gap-2">
                        <span className="tabular text-3xs font-semibold text-text-muted">
                          {row.offers_accepted} of {row.applications}
                        </span>
                        <span className="tabular text-sm font-extrabold text-primary">{row.placement_rate}%</span>
                      </span>
                    </div>
                    <HpProgress value={row.placement_rate} tone="emerald" className="h-2" />
                  </li>
                ))}
              </ul>
            )}
            {trendApplications > 0 && (
              <div className="mt-auto pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4 text-2xs text-text-muted">
                  <span className="tabular">
                    <span className="font-bold text-primary">{trendAccepted}</span> of {trendApplications}{" "}
                    {trendApplications === 1 ? "application" : "applications"} placed
                  </span>
                  <span className="tabular">
                    Overall <span className="font-semibold text-text-secondary">{pctOf(trendAccepted, trendApplications)}%</span>
                  </span>
                </div>
              </div>
            )}
          </HpCard>

          <HpCard className="flex flex-col p-5 sm:p-6">
            <HpSectionHeader
              title="Package Distribution"
              subtitle="Accepted offers by CTC bracket"
              icon={IndianRupee}
              tone="sky"
              action={
                totalOffers > 0 ? (
                  <span className="tabular text-2xs font-semibold text-text-muted">
                    {totalOffers} {totalOffers === 1 ? "offer" : "offers"}
                  </span>
                ) : undefined
              }
            />
            {placements.package_distribution.every((b) => b.count === 0) ? (
              <InlineEmpty icon={IndianRupee} title="No accepted offers yet" description="No accepted offers recorded yet." />
            ) : (
              <>
                <div className="mt-8">
                  <BarChart
                    variant="premium"
                    ariaLabel="Accepted offers by CTC bracket"
                    categories={placements.package_distribution.map((b) => b.bracket)}
                    series={[{ label: "Students", color: SERIES_PACKAGES, values: placements.package_distribution.map((b) => b.count) }]}
                    suffix=""
                    height={180}
                    maxValue={Math.max(4, Math.ceil(Math.max(...placements.package_distribution.map((b) => b.count)) / 2) * 2)}
                  />
                </div>
                <div className="mt-auto pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-4 text-2xs text-text-muted">
                    <span className="tabular">
                      <span className="font-bold text-primary">{totalOffers}</span> total accepted {totalOffers === 1 ? "offer" : "offers"}
                    </span>
                    {peakBracket && (
                      <span className="tabular">
                        Most common: <span className="font-semibold text-text-secondary">{peakBracket.bracket}</span>
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </HpCard>
        </div>
      </HpItem>

      {/* Company-wise hiring */}
      <HpItem>
        <CompanyTable rows={placements.company_summary} />
      </HpItem>
    </HpStagger>
  );
}

/* ── Sections ───────────────────────────────────────────────────────────── */

function AttentionCard({ items }: { items: TpoReportsData["placements"]["action_items"] }) {
  return (
    <HpCard className="flex flex-col p-5 sm:p-6">
      <HpSectionHeader
        title="Needs Your Attention"
        subtitle="Follow-ups your placement pipeline is waiting on"
        icon={AlertTriangle}
        tone="amber"
        action={
          <HpPill tone={items.length > 0 ? "amber" : "slate"} size="sm" dot={items.length > 0} pulse={items.length > 0}>
            <span className="tabular">{items.length}</span>
          </HpPill>
        }
      />
      {items.length === 0 ? (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center">
          <HpIconTile icon={CheckCircle2} tone="emerald" size="lg" />
          <p className="mt-3 text-13 font-bold text-primary">All caught up</p>
          <p className="mt-1 text-2xs text-text-muted">Nothing needs your attention right now.</p>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2.5">
            {items.map((item, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: hpEase, delay: 0.2 + i * 0.06 }}
                className="flex items-start gap-3 rounded-2xl bg-amber-500/[0.06] p-3.5 ring-1 ring-inset ring-amber-500/20 transition-colors duration-200 hover:bg-amber-500/10"
              >
                <HpIconTile icon={ACTION_ICON[item.type] ?? AlertTriangle} tone="amber" size="sm" />
                <p className="pt-1 text-xs leading-relaxed text-text-secondary">{item.message}</p>
              </motion.li>
            ))}
          </ul>
          <div className="mt-auto pt-4">
            <Link href="/admin/drives" className={hpBtn("soft", "sm", "w-full")}>
              Open Campus Drives
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </HpCard>
  );
}

/** The chart's table-view twin: every branch value in text, ranked by readiness. */
function BranchTable({ rows }: { rows: BranchReadinessRow[] }) {
  const ranked = [...rows].sort((a, b) => b.avgReadiness - a.avgReadiness);
  return (
    <div className="border-t border-border-subtle pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <table className="w-full">
        <caption className="sr-only">Branch-wise average readiness and practice consistency, out of 100, ranked by readiness</caption>
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
              <td className="tabular w-12 py-2.5 text-right align-middle text-sm font-extrabold text-primary">{r.avgReadiness}</td>
              <td className="tabular w-16 py-2.5 pl-3 text-right align-middle text-xs font-semibold text-text-secondary">{r.avgPractice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompanyTable({ rows }: { rows: TpoReportsData["placements"]["company_summary"] }) {
  const totalAccepted = rows.reduce((s, c) => s + c.offers_accepted, 0);
  return (
    <HpCard spotlight={false} className="overflow-hidden">
      <div className="px-5 py-4 sm:px-6">
        <HpSectionHeader
          title="Company-wise Hiring Summary"
          subtitle="Accepted offers and packages by recruiter"
          icon={Building2}
          tone="sky"
          action={
            rows.length > 0 ? (
              <HpPill tone="sky" size="sm" className="hidden sm:inline-flex">
                <span className="tabular">
                  {rows.length} {rows.length === 1 ? "company" : "companies"}
                </span>
              </HpPill>
            ) : undefined
          }
        />
      </div>
      {rows.length === 0 ? (
        <div className="border-t border-border-subtle px-5 pb-5 sm:px-6">
          <InlineEmpty
            icon={Building2}
            title="No accepted offers yet"
            description="No accepted offers recorded yet — this fills in as your placement pipeline records outcomes."
          />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-border-subtle">
          <table className="w-full min-w-[600px]">
            <thead className="bg-elevated/50">
              <tr>
                <th scope="col" className={hpTh}>Company</th>
                <th scope="col" className={cn(hpTh, "w-56")}>Offers accepted</th>
                <th scope="col" className={cn(hpTh, "text-right")}>Avg CTC</th>
                <th scope="col" className={cn(hpTh, "text-right")}>Max CTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((c) => (
                <tr key={c.company} className="group transition-colors duration-200 hover:bg-indigo-500/[0.035]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <HpCompanyLogo name={c.company} size="sm" />
                      <span className="max-w-[18rem] truncate text-13 font-bold text-primary">{c.company}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="tabular w-6 shrink-0 text-13 font-extrabold text-primary">{c.offers_accepted}</span>
                      <HpProgress value={pctOf(c.offers_accepted, totalAccepted)} tone="sky" className="flex-1" />
                      <span className="tabular w-9 shrink-0 text-right text-3xs font-semibold text-text-muted">{pctOf(c.offers_accepted, totalAccepted)}%</span>
                    </div>
                  </td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-xs font-bold text-primary">
                    <Ctc value={c.avg_ctc} />
                  </td>
                  <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-xs font-bold text-primary">
                    <Ctc value={c.max_ctc} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HpCard>
  );
}

/* ── Small pieces ───────────────────────────────────────────────────────── */

function Ctc({ value }: { value: number | null }) {
  if (value === null) return <span className="font-medium text-text-muted">—</span>;
  return (
    <>
      {value} <span className="text-3xs font-semibold text-text-muted">LPA</span>
    </>
  );
}

/** Placement-% donut with the season target marked as a tick on the track. */
function TargetRing({ value, target, size = 100, stroke = 9 }: { value: number; target: number | null; size?: number; stroke?: number }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const t = target !== null ? Math.max(0, Math.min(100, target)) : null;
  const angle = t !== null ? (t / 100) * 2 * Math.PI : 0;
  const cx = size / 2;
  const inner = r - stroke / 2 - 2;
  const outer = r + stroke / 2 + 2;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`${fmtNum(value)}% placed${t !== null ? `, against a ${fmtNum(t)}% target` : ""}`}
      >
        <circle cx={cx} cy={cx} r={r} fill="none" strokeWidth={stroke} className="stroke-border-subtle" />
        <motion.circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="#10B981"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c - (c * pct) / 100 : c }}
          animate={{ strokeDashoffset: c - (c * pct) / 100 }}
          transition={{ duration: 1.1, ease: hpEase, delay: 0.2 }}
        />
        {t !== null && (
          <line
            x1={cx + inner * Math.cos(angle)}
            y1={cx + inner * Math.sin(angle)}
            x2={cx + outer * Math.cos(angle)}
            y2={cx + outer * Math.sin(angle)}
            stroke="#6366F1"
            strokeWidth={3}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-extrabold tracking-tight text-primary">{fmtNum(value)}%</span>
        <span className="mt-1 text-3xs font-semibold uppercase tracking-[0.08em] text-text-muted">placed</span>
      </div>
    </div>
  );
}

function InlineEmpty({
  icon,
  title,
  description,
  action,
  tone = "slate",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "slate" | "emerald" | "sky";
}) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center">
      <HpIconTile icon={icon} tone={tone} size="md" />
      <p className="mt-3 text-13 font-bold text-primary">{title}</p>
      <p className="mt-1 max-w-xs text-2xs leading-relaxed text-text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading analytics">
      <HpCard spotlight={false} className="flex items-center gap-3.5 p-4 sm:p-5">
        <HpSkeleton className="h-11 w-11 rounded-[14px]" />
        <div className="flex-1 space-y-2">
          <HpSkeleton className="h-3.5 w-48 max-w-full" />
          <HpSkeleton className="h-3 w-64 max-w-full" />
        </div>
        <HpSkeleton className="hidden h-9 w-40 rounded-[10px] sm:block" />
      </HpCard>
      <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 xl:grid-cols-4">
        <HpStatCard label="Avg Readiness" value={0} icon={Gauge} tone="indigo" loading />
        <HpStatCard label="Companies Hired" value={0} icon={Building2} tone="sky" loading />
        <HpStatCard label="Offers Accepted" value={0} icon={Trophy} tone="emerald" loading />
        <HpStatCard label="Placement Rate" value={0} icon={Target} tone="violet" loading />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <HpCard spotlight={false} className="space-y-5 p-5 sm:p-6 xl:col-span-2">
          <HpSkeleton className="h-4 w-36" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <HpSkeleton className="h-3 w-24" />
              <HpSkeleton className="h-2.5 rounded-full" />
            </div>
          ))}
        </HpCard>
        <HpCard spotlight={false} className="space-y-3 p-5 sm:p-6">
          <HpSkeleton className="h-4 w-40" />
          <HpSkeleton className="h-16 rounded-2xl" />
          <HpSkeleton className="h-16 rounded-2xl" />
        </HpCard>
      </div>
      <HpCard spotlight={false} className="p-5 sm:p-6">
        <HpSkeleton className="h-4 w-44" />
        <div className="mt-8 flex h-52 items-end gap-6 px-6">
          {[62, 40, 78, 30, 55, 46].map((h, i) => (
            <div key={i} aria-hidden className="hp-skeleton flex-1 rounded-b-none rounded-t-md" style={{ height: `${h}%` }} />
          ))}
        </div>
      </HpCard>
      <HpSkeletonRows rows={3} />
    </div>
  );
}
