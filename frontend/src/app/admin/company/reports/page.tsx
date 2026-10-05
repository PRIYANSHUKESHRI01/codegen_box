"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Download,
  AlertTriangle,
  TrendingUp,
  Clock,
  Target,
  Users2,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  Hourglass,
  IndianRupee,
  PieChart,
  TrendingDown,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CompanyReportsData } from "@/types/hiring";
import {
  HpAvatar,
  HpButton,
  HpCard,
  HpCompanyLogo,
  HpFunnel,
  HpIconTile,
  HpItem,
  HpPill,
  HpProgress,
  HpRing,
  HpSectionHeader,
  HpSkeleton,
  HpSkeletonRows,
  HpStagger,
  HpStatCard,
  HpToast,
  hpBtn,
  hpEase,
  hpTh,
} from "@/components/portal/kit";

/** Action-item type → glyph (types come from HiringReportService::actionItems on the backend). */
const ACTION_ICON: Record<string, LucideIcon> = {
  stale_applications: Clock,
  pending_offers: Hourglass,
};

/**
 * Candidate-source segments. Nominal categories, so each gets its own hue —
 * teal-600 / indigo-500 / pink-600 is a palette validated for adjacent-pair
 * colour-vision separation and ≥3:1 contrast against the surface in both
 * light and dark themes (amber/rose stay reserved for attention/risk).
 */
const SOURCE_FILL = ["bg-teal-600", "bg-indigo-500", "bg-pink-600"] as const;

const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * A company hiring tenant's Hiring Reports — mirrors the shape of the TPO's
 * Placement Reports page (funnel, distributions, action items) but with
 * every section-shaped piece (Section Performance, coordinator contacts)
 * omitted entirely, since there's no section concept for a company, plus
 * the hiring-only metrics (time to hire, offer accept rate, candidate
 * source) HiringReportService adds.
 */
export default function HiringReportsPage() {
  const { status } = useAuthGuard(["admin_company"]);
  const [data, setData] = useState<CompanyReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (status !== "ready") return;
    setLoading(true);
    api
      .get<CompanyReportsData>("/company/reports/data")
      .then(setData)
      .catch(() => triggerToast("Failed to load hiring reports."))
      .finally(() => setLoading(false));
  }, [status]);

  if (status !== "ready") {
    return <SessionLoader />;
  }

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const { generateHiringReportExcel } = await import("@/lib/generateHiringReports");
      await generateHiringReportExcel(data.hiring, data.company.name);
    } catch {
      triggerToast("Failed to generate the export.");
    } finally {
      setExporting(false);
    }
  };

  const funnelSteps: [string, number][] = data
    ? [
        ["Registered", data.hiring.funnel.registered],
        ["Shortlisted", data.hiring.funnel.shortlisted],
        ["Interviewed", data.hiring.funnel.interviewed],
        ["Offered", data.hiring.funnel.offered],
        ["Accepted", data.hiring.funnel.accepted],
      ]
    : [];

  return (
    <DashboardShell
      role="admin_company"
      title="Hiring Reports"
      subtitle="Real funnel, time-to-hire and offer metrics — derived entirely from your own candidate pipeline."
      actionButton={{ label: exporting ? "Exporting..." : "Export Excel", icon: Download, onClick: handleExport }}
    >
      <HpToast message={toastMessage} tone="rose" />

      {loading ? (
        <ReportsSkeleton />
      ) : !data ? (
        <div role="alert" className="flex items-start gap-4 rounded-[20px] bg-rose-500/[0.06] p-5 ring-1 ring-inset ring-rose-500/20 sm:p-6">
          <HpIconTile icon={AlertTriangle} tone="rose" size="md" />
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-bold text-primary">Hiring data unavailable</p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">Couldn&apos;t load your hiring data. Please refresh.</p>
          </div>
        </div>
      ) : (
        <ReportsBody data={data} funnelSteps={funnelSteps} exporting={exporting} onExport={handleExport} />
      )}
    </DashboardShell>
  );
}

/* ── Body ───────────────────────────────────────────────────────────────── */

function ReportsBody({
  data,
  funnelSteps,
  exporting,
  onExport,
}: {
  data: CompanyReportsData;
  funnelSteps: [string, number][];
  exporting: boolean;
  onExport: () => void;
}) {
  const h = data.hiring;
  const f = h.funnel;
  const tth = h.time_to_hire_days;
  const oar = h.offer_accept_rate;

  // Derived (not fabricated) ratios — straight divisions of the funnel counts above.
  const endToEnd = f.registered > 0 ? pctOf(f.accepted, f.registered) : null;
  const dropOff = funnelSteps.slice(1).reduce<{ from: string; to: string; rate: number } | null>((worst, [label, value], i) => {
    const [prevLabel, prev] = funnelSteps[i];
    if (prev <= 0) return worst;
    const rate = pctOf(value, prev);
    return worst === null || rate < worst.rate ? { from: prevLabel, to: label, rate } : worst;
  }, null);

  return (
    <HpStagger className="space-y-6">
      {/* Report context */}
      <HpItem>
        <HpCard spotlight={false} className="relative overflow-hidden p-4 sm:p-5">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_160%_at_0%_0%,rgba(20,184,166,0.10),transparent_60%),radial-gradient(50%_160%_at_100%_0%,rgba(99,102,241,0.10),transparent_60%)]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <HpCompanyLogo name={data.company.name} logo={data.company.logo} size="md" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-bold tracking-tight text-primary">{data.company.name}</span>
                  {data.company.industry && (
                    <HpPill tone="slate" size="sm">
                      {data.company.industry}
                    </HpPill>
                  )}
                </div>
                <div className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-muted">
                  <HpPill tone="teal" size="sm" dot>
                    From your pipeline
                  </HpPill>
                  <span>
                    {h.drive_summary.length} {h.drive_summary.length === 1 ? "opening" : "openings"} with applicants · {f.registered}{" "}
                    {f.registered === 1 ? "application" : "applications"}
                  </span>
                </div>
              </div>
            </div>
            <HpButton
              variant="secondary"
              size="sm"
              className="h-9 shrink-0 px-4"
              onClick={onExport}
              disabled={exporting}
              isLoading={exporting}
              leftIcon={<FileSpreadsheet className="h-4 w-4" />}
            >
              {exporting ? "Exporting..." : "Download Excel"}
            </HpButton>
          </div>
        </HpCard>
      </HpItem>

      {/* Headline numbers */}
      <HpItem>
        <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 xl:grid-cols-4">
          <HpStatCard
            label="Total Candidates"
            value={f.total_candidates}
            icon={Users2}
            tone="teal"
            hint={`${f.registered} ${f.registered === 1 ? "application" : "applications"}`}
          />
          <HpStatCard
            label="Hired"
            value={f.accepted}
            icon={Trophy}
            tone="emerald"
            hint={endToEnd !== null ? `${endToEnd}% of applications` : "No applications yet"}
          />
          <HpStatCard
            label="Avg. Time to Hire"
            value={tth !== null ? tth : "—"}
            suffix="d"
            decimals={tth !== null && !Number.isInteger(tth) ? 1 : 0}
            icon={Clock}
            tone="indigo"
            hint={tth !== null ? "pipeline entry → offer accepted" : "No hires yet"}
          />
          <HpStatCard
            label="Offer Accept Rate"
            value={oar !== null ? oar : "—"}
            suffix="%"
            decimals={oar !== null && !Number.isInteger(oar) ? 1 : 0}
            icon={Target}
            tone="violet"
            hint={oar !== null ? "of offers that got a decision" : "No offers decided yet"}
          />
        </div>
      </HpItem>

      {/* Funnel + attention */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <HpCard className="p-5 sm:p-6 xl:col-span-2">
            <HpSectionHeader
              title="Hiring Funnel"
              subtitle="Each stage counts every application that reached it"
              icon={Filter}
              tone="indigo"
              action={
                endToEnd !== null ? (
                  <HpPill tone="indigo" size="sm">
                    <span className="tabular">{endToEnd}% end-to-end</span>
                  </HpPill>
                ) : undefined
              }
            />
            {f.registered === 0 ? (
              <InlineEmpty
                icon={Filter}
                title="No applications yet"
                description="The funnel fills in as candidates enter your job openings."
                action={
                  <Link href="/admin/company/drives" className={hpBtn("soft", "sm")}>
                    Go to Job Openings
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_13rem]">
                <HpFunnel stages={funnelSteps.map(([label, value]) => ({ label, value, tone: "indigo" as const }))} />
                <div className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-5 sm:grid-cols-2 sm:items-center xl:flex xl:flex-col xl:items-stretch xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                  <div className="flex items-center gap-4 xl:flex-col xl:items-start">
                    <HpRing value={endToEnd ?? 0} size={92} stroke={8} tone="indigo">
                      <div className="text-center leading-none">
                        <div className="tabular text-lg font-extrabold text-primary">{endToEnd}%</div>
                      </div>
                    </HpRing>
                    <div>
                      <div className="text-xs font-bold text-primary">Application → hire</div>
                      <p className="tabular mt-0.5 text-2xs leading-relaxed text-text-muted">
                        {f.accepted} of {f.registered} applications ended in an accepted offer.
                      </p>
                    </div>
                  </div>
                  {dropOff && dropOff.rate < 100 && (
                    <div className="rounded-2xl bg-elevated/60 p-3 ring-1 ring-inset ring-border-subtle">
                      <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                        <TrendingDown className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
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

          <AttentionCard items={h.action_items} />
        </div>
      </HpItem>

      {/* Source + packages */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SourceCard data={data} />
          <PackageCard brackets={h.package_distribution} />
        </div>
      </HpItem>

      {/* By opening */}
      <HpItem>
        <HpCard spotlight={false} className="overflow-hidden">
          <div className="px-5 py-4 sm:px-6">
            <HpSectionHeader
              title="By Job Opening"
              subtitle="Sorted by candidate volume"
              icon={Briefcase}
              tone="teal"
              action={
                <Link href="/admin/company/drives" className={hpBtn("ghost", "sm")}>
                  <span className="hidden sm:inline">All openings</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="sr-only sm:hidden">All openings</span>
                </Link>
              }
            />
          </div>
          {h.drive_summary.length === 0 ? (
            <div className="border-t border-border-subtle px-5 pb-5 sm:px-6">
              <InlineEmpty icon={Briefcase} title="No candidates yet" description="Openings appear here once their first candidate applies." />
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-border-subtle">
              <table className="w-full min-w-[640px]">
                <thead className="bg-elevated/50">
                  <tr>
                    <th scope="col" className={hpTh}>Opening</th>
                    <th scope="col" className={cn(hpTh, "text-right")}>Candidates</th>
                    <th scope="col" className={cn(hpTh, "text-right")}>Hired</th>
                    <th scope="col" className={cn(hpTh, "w-44")}>Hire rate</th>
                    <th scope="col" className={cn(hpTh, "text-right")}>Avg CTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {h.drive_summary.map((d, i) => {
                    const rate = pctOf(d.offers_accepted, d.candidates);
                    return (
                      <tr key={i} className="group transition-colors duration-200 hover:bg-indigo-500/[0.035]">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="tabular inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-elevated text-3xs font-extrabold text-text-muted ring-1 ring-inset ring-border-subtle transition-colors group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <div className="min-w-0">
                              <div className="max-w-[18rem] truncate text-xs font-bold text-primary">{d.opening}</div>
                              <div className="max-w-[18rem] truncate text-3xs text-text-muted">{d.role_title}</div>
                            </div>
                          </div>
                        </td>
                        <td className="tabular px-5 py-3.5 text-right text-xs font-semibold text-text-secondary">{d.candidates}</td>
                        <td className="tabular px-5 py-3.5 text-right text-xs font-bold text-primary">{d.offers_accepted}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <HpProgress value={rate} tone="emerald" className="flex-1" />
                            <span className="tabular w-9 shrink-0 text-right text-2xs font-semibold text-text-secondary">{rate}%</span>
                          </div>
                        </td>
                        <td className="tabular whitespace-nowrap px-5 py-3.5 text-right text-xs font-bold text-primary">
                          {d.avg_ctc !== null ? (
                            <>
                              {d.avg_ctc} <span className="text-3xs font-semibold text-text-muted">LPA avg</span>
                            </>
                          ) : (
                            <span className="font-medium text-text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </HpCard>
      </HpItem>

      {/* Recent hires */}
      <HpItem>
        <HpCard spotlight={false} className="overflow-hidden">
          <div className="px-5 py-4 sm:px-6">
            <HpSectionHeader
              title="Recent Hires"
              subtitle="Latest accepted offers"
              icon={Trophy}
              tone="emerald"
              action={
                h.recent_hires.length > 0 ? (
                  <HpPill tone="emerald" size="sm">
                    <span className="tabular">{h.recent_hires.length}</span>
                  </HpPill>
                ) : undefined
              }
            />
          </div>
          {h.recent_hires.length === 0 ? (
            <div className="border-t border-border-subtle px-5 pb-5 sm:px-6">
              <InlineEmpty
                icon={Trophy}
                tone="emerald"
                title="No offers accepted yet"
                description="Accepted offers land here with the role and package."
                action={
                  <Link href="/admin/company/candidates" className={hpBtn("soft", "sm")}>
                    Review candidates
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {h.recent_hires.map((hire, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, ease: hpEase, delay: Math.min(i, 8) * 0.03 }}
                  className="flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-200 hover:bg-indigo-500/[0.035] sm:px-6"
                >
                  <HpAvatar name={hire.candidate_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-primary">{hire.candidate_name}</div>
                    <div className="truncate text-2xs text-text-muted">
                      {hire.opening} · {hire.role_title}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <HpPill tone="emerald" size="sm" icon={IndianRupee}>
                      <span className="tabular">{hire.ctc_offered} LPA</span>
                    </HpPill>
                    <div className="tabular mt-1 text-3xs text-text-muted">
                      {new Date(hire.hired_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </HpCard>
      </HpItem>
    </HpStagger>
  );
}

/* ── Sections ───────────────────────────────────────────────────────────── */

function AttentionCard({ items }: { items: CompanyReportsData["hiring"]["action_items"] }) {
  return (
    <HpCard className="flex flex-col p-5 sm:p-6">
      <HpSectionHeader
        title="Needs Your Attention"
        subtitle="Follow-ups your pipeline is waiting on"
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
          <p className="mt-3 text-[13px] font-bold text-primary">All caught up</p>
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
            <Link href="/admin/company/candidates" className={hpBtn("soft", "sm", "w-full")}>
              Review in Candidates
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </HpCard>
  );
}

function SourceCard({ data }: { data: CompanyReportsData }) {
  const reduce = useReducedMotion();
  const total = data.hiring.funnel.total_candidates || 1;
  const sources = (
    [
      ["Company Invited", data.hiring.source_breakdown.company_invited],
      ["Existing Platform Student", data.hiring.source_breakdown.existing_platform_student],
      ["Other", data.hiring.source_breakdown.other],
    ] as [string, number][]
  ).map(([label, count], i) => ({ label, count, pct: Math.round((count / total) * 100), fill: SOURCE_FILL[i] }));
  const anyCandidates = sources.some((s) => s.count > 0);

  return (
    <HpCard className="p-5 sm:p-6">
      <HpSectionHeader title="Candidate Source" subtitle="Where each distinct candidate first came from" icon={PieChart} tone="teal" />
      {!anyCandidates ? (
        <InlineEmpty icon={Users2} title="No candidates yet" description="Source mix appears once candidates enter your pipeline." />
      ) : (
        <>
          {/* Stacked share bar — 2px surface gaps between segments; values are labelled in the legend below. */}
          <div className="mt-6 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-elevated" aria-hidden>
            {sources
              .filter((s) => s.count > 0)
              .map((s, i) => (
                <motion.div
                  key={s.label}
                  title={`${s.label}: ${s.count} (${s.pct}%)`}
                  className={cn("h-full first:rounded-l-full last:rounded-r-full", s.fill)}
                  initial={{ width: reduce ? `${s.pct}%` : 0 }}
                  whileInView={{ width: `${s.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease: hpEase, delay: i * 0.08 }}
                />
              ))}
          </div>
          <ul className="mt-5 space-y-1">
            {sources.map((s) => (
              <li key={s.label} className="flex items-center gap-3 rounded-xl px-2 py-2 text-xs transition-colors duration-200 hover:bg-elevated/60">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", s.fill)} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-text-secondary">{s.label}</span>
                <span className="tabular w-10 shrink-0 text-right text-2xs text-text-muted">{s.pct}%</span>
                <span className="tabular w-10 shrink-0 text-right font-bold text-primary">{s.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </HpCard>
  );
}

function PackageCard({ brackets }: { brackets: CompanyReportsData["hiring"]["package_distribution"] }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...brackets.map((b) => b.count));
  const totalHires = brackets.reduce((s, b) => s + b.count, 0);

  return (
    <HpCard className="p-5 sm:p-6">
      <HpSectionHeader
        title="Offer Packages"
        subtitle="Accepted offers by CTC bracket"
        icon={TrendingUp}
        tone="teal"
        action={
          totalHires > 0 ? (
            <span className="tabular text-2xs font-semibold text-text-muted">
              {totalHires} {totalHires === 1 ? "hire" : "hires"}
            </span>
          ) : undefined
        }
      />
      {totalHires === 0 ? (
        <InlineEmpty icon={IndianRupee} title="No accepted offers yet" description="The package spread appears once offers are accepted." />
      ) : (
        <>
          <div className="mt-6 flex h-44 items-end gap-2 border-b border-border-subtle sm:gap-3" role="img" aria-label={`Accepted offers by CTC bracket: ${brackets.map((b) => `${b.bracket} ${b.count}`).join(", ")}`}>
            {brackets.map((b, i) => {
              const height = b.count > 0 ? Math.max(6, (b.count / max) * 100) : 0;
              const isPeak = b.count === max && b.count > 0;
              return (
                <div key={b.bracket} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                  {/* Hover readout */}
                  <span className="tabular pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-2 py-1 text-3xs font-semibold text-primary opacity-0 shadow-[0_8px_20px_-8px_rgba(39,47,92,0.35)] transition-opacity duration-200 group-hover:opacity-100">
                    {b.bracket}: {b.count}
                  </span>
                  {isPeak && <span className="tabular mb-1 text-2xs font-bold text-primary">{b.count}</span>}
                  <motion.div
                    className="w-full max-w-[44px] rounded-t-[4px] bg-teal-600 transition-[filter] duration-200 group-hover:brightness-110"
                    initial={{ height: reduce ? `${height}%` : 0 }}
                    whileInView={{ height: `${height}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: hpEase, delay: i * 0.06 }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2 sm:gap-3">
            {brackets.map((b) => (
              <span key={b.bracket} className="flex-1 text-center text-3xs font-semibold leading-tight text-text-muted">
                {b.bracket}
              </span>
            ))}
          </div>
        </>
      )}
    </HpCard>
  );
}

/* ── Small pieces ───────────────────────────────────────────────────────── */

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
  action?: React.ReactNode;
  tone?: "slate" | "emerald";
}) {
  return (
    <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border-subtle px-4 py-8 text-center">
      <HpIconTile icon={icon} tone={tone} size="md" />
      <p className="mt-3 text-[13px] font-bold text-primary">{title}</p>
      <p className="mt-1 max-w-xs text-2xs leading-relaxed text-text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading hiring reports">
      <HpCard spotlight={false} className="flex items-center gap-3.5 p-4 sm:p-5">
        <HpSkeleton className="h-11 w-11 rounded-[14px]" />
        <div className="flex-1 space-y-2">
          <HpSkeleton className="h-3.5 w-40" />
          <HpSkeleton className="h-3 w-56 max-w-full" />
        </div>
        <HpSkeleton className="hidden h-9 w-36 rounded-[10px] sm:block" />
      </HpCard>
      <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 xl:grid-cols-4">
        <HpStatCard label="Total Candidates" value={0} icon={Users2} tone="teal" loading />
        <HpStatCard label="Hired" value={0} icon={Trophy} tone="emerald" loading />
        <HpStatCard label="Avg. Time to Hire" value={0} icon={Clock} tone="indigo" loading />
        <HpStatCard label="Offer Accept Rate" value={0} icon={Target} tone="violet" loading />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <HpCard spotlight={false} className="space-y-5 p-5 sm:p-6 xl:col-span-2">
          <HpSkeleton className="h-4 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
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
      <HpSkeletonRows rows={4} />
    </div>
  );
}
