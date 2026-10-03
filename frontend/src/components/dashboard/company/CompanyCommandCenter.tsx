"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Filter,
  GraduationCap,
  Mic,
  Plus,
  Sparkles,
  Swords,
  Timer,
  Users2,
  BarChart3,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";
import {
  HpAvatar,
  HpCard,
  HpCompanyLogo,
  HpEmptyState,
  HpFunnel,
  HpHero,
  HpIconTile,
  HpItem,
  HpPill,
  HpProgress,
  HpRing,
  HpSectionHeader,
  HpSkeleton,
  HpSkeletonCards,
  HpStagger,
  HpStatCard,
  hpBtn,
  type HpTone,
} from "@/components/portal/kit";
import type { AuthUser } from "@/lib/auth";
import type { CompanyReportsData } from "@/types/hiring";
import { cn } from "@/lib/utils";

export interface CompanyCommandCenterDrive {
  id: number;
  title: string;
  role_title: string;
  ctc_range: string | null;
  drive_date: string;
  status: "draft" | "published" | "completed" | "cancelled";
  applications_count: number;
}

interface Props {
  user: AuthUser | null;
  drives: CompanyCommandCenterDrive[];
  reports: CompanyReportsData | null;
  loading: boolean;
}

const STATUS: Record<CompanyCommandCenterDrive["status"], { label: string; tone: HpTone; live?: boolean }> = {
  published: { label: "Live", tone: "emerald", live: true },
  draft: { label: "Draft", tone: "slate" },
  completed: { label: "Completed", tone: "sky" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

const QUICK_ACTIONS: { label: string; hint: string; href: string; icon: LucideIcon; tone: HpTone }[] = [
  { label: "Run an assessment", hint: "Proctored coding contests", href: "/admin/company/assessments", icon: Swords, tone: "indigo" },
  { label: "AI interviews", hint: "Screen at scale", href: "/admin/company/interviews", icon: Mic, tone: "violet" },
  { label: "Search talent pool", hint: "Discover top candidates", href: "/admin/company/talent-pool", icon: Award, tone: "teal" },
  { label: "Partner colleges", hint: "Campuses you hire from", href: "/admin/company/colleges", icon: GraduationCap, tone: "sky" },
];

const GETTING_STARTED: { step: string; title: string; body: string; href: string; icon: LucideIcon; tone: HpTone }[] = [
  { step: "01", title: "Post a job opening", body: "Describe the role, CTC and timeline in under a minute.", href: "/admin/company/drives", icon: Briefcase, tone: "indigo" },
  { step: "02", title: "Propose to colleges", body: "Pick partner campuses — or open the role to every candidate.", href: "/admin/company/colleges", icon: GraduationCap, tone: "teal" },
  { step: "03", title: "Screen and hire", body: "Invite to proctored assessments and AI interviews.", href: "/admin/company/assessments", icon: Sparkles, tone: "violet" },
];

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-300"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function CompanyCommandCenter({ user, drives, reports, loading }: Props) {
  const company = user?.company;
  const hiring = reports?.hiring;
  const funnel = hiring?.funnel;

  const live = drives.filter((d) => d.status === "published").length;
  // Live openings first (the ones actively taking candidates), then the rest in API order.
  const rankedDrives = [...drives].sort((a, b) => Number(b.status === "published") - Number(a.status === "published"));
  const registered = funnel?.registered ?? 0;
  const accepted = funnel?.accepted ?? 0;
  const conversion = registered > 0 ? Math.round((accepted / registered) * 100) : 0;
  const topApplicants = Math.max(1, ...drives.map((d) => d.applications_count));
  const actionItems = hiring?.action_items ?? [];
  const recentHires = hiring?.recent_hires ?? [];
  const sources = hiring?.source_breakdown;
  const sourceTotal = sources ? sources.company_invited + sources.existing_platform_student + sources.other : 0;

  const hero = (
    <HpHero
      leading={<HpCompanyLogo name={company?.name ?? "Your Company"} logo={company?.logo} size="xl" />}
      eyebrow={
        <>
          <span>Your company</span>
          {company?.industry && (
            <HpPill tone="teal" size="sm" dot>
              {company.industry}
            </HpPill>
          )}
        </>
      }
      title={company?.name ?? "Your Company"}
      description={
        <>
          Hiring team lead <span className="font-semibold text-primary">{user?.name}</span> — your openings, pipeline and hires at a glance.
        </>
      }
      actions={
        <>
          <Link href="/admin/company/reports" className={hpBtn("secondary", "md")}>
            <BarChart3 className="h-4 w-4" />
            Reports
          </Link>
          <Link href="/admin/company/drives" className={hpBtn("primary", "md")}>
            <Plus className="h-4 w-4" />
            Post a Job Opening
          </Link>
        </>
      }
    />
  );

  if (loading) {
    return (
      <div className="space-y-8">
        {hero}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <HpCard key={i} spotlight={false} className="space-y-5 p-5">
              <div className="flex items-center justify-between">
                <HpSkeleton className="h-3 w-24" />
                <HpSkeleton className="h-10 w-10 rounded-xl" />
              </div>
              <HpSkeleton className="h-8 w-16" />
              <HpSkeleton className="h-3 w-32" />
            </HpCard>
          ))}
        </div>
        <HpSkeletonCards count={3} />
      </div>
    );
  }

  if (drives.length === 0) {
    return (
      <HpStagger className="space-y-8">
        <HpItem>{hero}</HpItem>
        <HpItem>
          <HpEmptyState
            icon={Briefcase}
            tone="indigo"
            title="Your hiring command center is ready"
            description="Job openings, your candidate pipeline and proctored assessments will light up here the moment you start hiring. Post your first opening to get going."
            action={
              <Link href="/admin/company/drives" className={hpBtn("primary", "lg")}>
                <Plus className="h-4 w-4" />
                Post your first job opening
              </Link>
            }
          />
        </HpItem>
        <HpItem>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {GETTING_STARTED.map((s) => (
              <Link key={s.step} href={s.href} className="group block focus-visible:outline-none">
                <HpCard interactive className="h-full p-5">
                  <div className="flex items-start justify-between">
                    <HpIconTile icon={s.icon} tone={s.tone} size="md" className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                    <span className="tabular text-2xl font-black text-border-strong">{s.step}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-primary">{s.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">{s.body}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                    Get started
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </span>
                </HpCard>
              </Link>
            ))}
          </div>
        </HpItem>
      </HpStagger>
    );
  }

  return (
    <HpStagger className="space-y-8">
      <HpItem>{hero}</HpItem>

      {/* KPI strip — every figure is the real value from HiringReportService / the drives list. */}
      <HpItem>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HpStatCard label="Open job openings" value={live} icon={Briefcase} tone="indigo" hint={`${drives.length} total posted`} />
          <HpStatCard label="Active pipeline" value={funnel?.total_candidates ?? 0} icon={Users2} tone="teal" hint="Candidates across all openings" />
          <HpStatCard
            label="Hired"
            value={accepted}
            icon={CheckCircle2}
            tone="emerald"
            hint={hiring?.offer_accept_rate != null ? `${hiring.offer_accept_rate}% offer acceptance` : "Offers accepted"}
          />
          <HpStatCard
            label="Avg. time to hire"
            value={hiring?.time_to_hire_days != null ? `${hiring.time_to_hire_days}d` : "—"}
            icon={Timer}
            tone="violet"
            hint="Pipeline entry to offer"
          />
        </div>
      </HpItem>

      {/* Funnel + attention */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <HpCard className="p-6 lg:col-span-2">
            <HpSectionHeader
              icon={Filter}
              tone="indigo"
              title="Hiring funnel"
              subtitle="Where candidates are in your process"
              action={<SectionLink href="/admin/company/reports">Full reports</SectionLink>}
            />
            <div className="mt-6 grid grid-cols-1 items-center gap-8 md:grid-cols-[1fr_auto]">
              <HpFunnel
                stages={[
                  { label: "Registered", value: funnel?.registered ?? 0, tone: "indigo" },
                  { label: "Shortlisted", value: funnel?.shortlisted ?? 0, tone: "violet" },
                  { label: "Interviewed", value: funnel?.interviewed ?? 0, tone: "sky" },
                  { label: "Offered", value: funnel?.offered ?? 0, tone: "amber" },
                  { label: "Accepted", value: funnel?.accepted ?? 0, tone: "emerald" },
                ]}
              />
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-border-subtle bg-elevated/50 px-8 py-6">
                <HpRing value={conversion} size={104} stroke={9} tone="emerald">
                  <span className="tabular text-xl font-extrabold text-primary">{conversion}%</span>
                </HpRing>
                <span className="text-2xs font-semibold text-text-muted">Registered → Hired</span>
              </div>
            </div>
          </HpCard>

          <HpCard className="flex flex-col p-6">
            <HpSectionHeader
              icon={AlertTriangle}
              tone="amber"
              title="Needs your attention"
              subtitle="Open items across your hiring"
              action={
                actionItems.length > 0 ? (
                  <HpPill tone="rose" size="sm" dot pulse>
                    {actionItems.length}
                  </HpPill>
                ) : undefined
              }
            />
            <div className="mt-5 flex-1 space-y-2.5 overflow-y-auto pr-1 [max-height:280px]">
              {actionItems.length === 0 ? (
                <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-3 text-center">
                  <HpIconTile icon={PartyPopper} tone="emerald" size="lg" />
                  <div>
                    <p className="text-sm font-bold text-primary">You&apos;re all caught up</p>
                    <p className="mt-0.5 text-2xs text-text-muted">Nothing needs your attention right now.</p>
                  </div>
                </div>
              ) : (
                actionItems.map((item, i) => (
                  <div
                    key={i}
                    className="group flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.18)]" />
                    <p className="text-xs leading-relaxed text-text-secondary">{item.message}</p>
                  </div>
                ))
              )}
            </div>
          </HpCard>
        </div>
      </HpItem>

      {/* Openings + recent hires */}
      <HpItem>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="space-y-4">
            <HpSectionHeader
              icon={Briefcase}
              tone="indigo"
              title="Job openings"
              subtitle={`${live} live · ${drives.length} total`}
              action={<SectionLink href="/admin/company/drives">Manage all</SectionLink>}
            />
            <div className="space-y-3">
              {rankedDrives.slice(0, 4).map((d) => {
                const st = STATUS[d.status];
                return (
                  <Link key={d.id} href="/admin/company/drives" className="group block focus-visible:outline-none">
                    <HpCard interactive className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <HpIconTile icon={Briefcase} tone={st.tone === "slate" ? "slate" : "indigo"} size="md" />
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-primary">{d.title}</h3>
                            <p className="truncate text-2xs text-text-muted">{d.role_title}</p>
                          </div>
                        </div>
                        <HpPill tone={st.tone} dot pulse={st.live} size="sm">
                          {st.label}
                        </HpPill>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <HpProgress value={(d.applications_count / topApplicants) * 100} tone="teal" className="flex-1" />
                        <span className="tabular flex items-center gap-1 text-2xs font-bold text-text-secondary">
                          <Users2 className="h-3 w-3 text-text-muted" />
                          {d.applications_count}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-2xs text-text-muted">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(d.drive_date)}
                        </span>
                        {d.ctc_range && <span className="font-semibold text-text-secondary">{d.ctc_range}</span>}
                      </div>
                    </HpCard>
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <HpSectionHeader
              icon={Sparkles}
              tone="emerald"
              title="Recent hires"
              subtitle="Latest accepted offers"
              action={<SectionLink href="/admin/company/reports">View reports</SectionLink>}
            />
            {recentHires.length === 0 ? (
              <HpCard spotlight={false} className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <HpIconTile icon={Award} tone="slate" size="lg" />
                <div>
                  <p className="text-sm font-bold text-primary">No offers accepted yet</p>
                  <p className="mt-0.5 text-2xs text-text-muted">Your first hire will be celebrated here.</p>
                </div>
              </HpCard>
            ) : (
              <HpCard spotlight={false} className="divide-y divide-border-subtle overflow-hidden">
                {recentHires.slice(0, 5).map((h, i) => (
                  <div key={i} className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-elevated/60">
                    <HpAvatar name={h.candidate_name} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-13 font-bold text-primary">{h.candidate_name}</div>
                      <div className="truncate text-2xs text-text-muted">
                        {h.opening} · {h.role_title}
                      </div>
                    </div>
                    <HpPill tone="emerald" size="md" icon={CheckCircle2}>
                      <span className="tabular">{h.ctc_offered} LPA</span>
                    </HpPill>
                  </div>
                ))}
              </HpCard>
            )}
          </section>
        </div>
      </HpItem>

      {/* Candidate sources — only when the pipeline has any */}
      {sources && sourceTotal > 0 && (
        <HpItem>
          <HpCard spotlight={false} className="p-6">
            <HpSectionHeader icon={Users2} tone="teal" title="Where candidates come from" subtitle="Pipeline sources across all openings" />
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {(
                [
                  ["Invited by you", sources.company_invited, "indigo"],
                  ["Existing platform students", sources.existing_platform_student, "teal"],
                  ["Other", sources.other, "slate"],
                ] as [string, number, HpTone][]
              ).map(([label, value, tone]) => (
                <div key={label}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-text-secondary">{label}</span>
                    <span className="tabular text-sm font-extrabold text-primary">
                      {value} <span className="text-2xs font-semibold text-text-muted">· {Math.round((value / sourceTotal) * 100)}%</span>
                    </span>
                  </div>
                  <HpProgress value={(value / sourceTotal) * 100} tone={tone} />
                </div>
              ))}
            </div>
          </HpCard>
        </HpItem>
      )}

      {/* Jump back in */}
      <HpItem>
        <div className="space-y-4">
          <HpSectionHeader icon={Sparkles} tone="violet" title="Jump back in" subtitle="Everything else in your hiring hub" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {QUICK_ACTIONS.map((a) => (
              <Link key={a.href} href={a.href} className="group block focus-visible:outline-none">
                <HpCard interactive className="flex items-center gap-4 p-4">
                  <HpIconTile icon={a.icon} tone={a.tone} size="md" className="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-13 font-bold text-primary">{a.label}</div>
                    <div className="truncate text-2xs text-text-muted">{a.hint}</div>
                  </div>
                  <ArrowUpRight
                    className={cn(
                      "h-4 w-4 shrink-0 text-text-muted transition-all duration-200",
                      "group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-indigo-500"
                    )}
                  />
                </HpCard>
              </Link>
            ))}
          </div>
        </div>
      </HpItem>
    </HpStagger>
  );
}
