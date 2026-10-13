"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  Code2,
  FileSpreadsheet,
  Filter,
  Gauge,
  GraduationCap,
  Layers,
  Mail,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  UserCheck,
  Users2,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { usePublicStats } from "@/lib/usePublicPlatformData";
import { cn } from "@/lib/utils";

// ─── design tokens ────────────────────────────────────────────────────────────
const T = {
  wash: "from-indigo-500/[0.14]",
  pill: "bg-indigo-500/10 border-indigo-500/25 text-indigo-700 dark:text-indigo-300",
  icon: "bg-gradient-to-br from-indigo-500/25 to-indigo-500/5 border-indigo-500/30 text-indigo-600 dark:text-indigo-400",
  iconHover: "group-hover:from-indigo-500 group-hover:to-indigo-600 group-hover:text-white group-hover:border-indigo-500",
  text: "text-indigo-600 dark:text-indigo-400",
  shadow: "hover:shadow-[0_24px_48px_-20px_rgba(99,102,241,0.45)]",
  bar: "from-indigo-500 to-indigo-400",
  node: "from-indigo-500 to-indigo-600 shadow-[0_8px_24px_-6px_rgba(99,102,241,0.7)]",
};

// ─── Pain points ──────────────────────────────────────────────────────────────
const PAINS = [
  { before: "5 spreadsheets for eligibility, applications, and offers", after: "One dashboard — every drive, every student, every outcome" },
  { before: "Bulk emails sent manually from Gmail", after: "Email & WhatsApp notifications dispatched in one click" },
  { before: "Student onboarding takes a whole week", after: "Upload one CSV; accounts and logins go out the same day" },
  { before: "Readiness reports built from guesswork", after: "Branch-wise analytics built from what students actually do" },
];

// ─── Capabilities ─────────────────────────────────────────────────────────────
const CAPS = [
  {
    icon: Briefcase,
    title: "Campus Drive Management",
    body: "Map recruiters, set CGPA / backlog / branch eligibility, publish drives, and track every application to a final offer — from one screen.",
    href: "/features/campus-drives",
    badge: "Placement cell",
  },
  {
    icon: Upload,
    title: "Student Onboarding",
    body: "Upload one CSV. Accounts are created in the background and every student gets a welcome email with their login.",
    href: "/features/student-onboarding",
    badge: "Batch import",
  },
  {
    icon: BarChart3,
    title: "Readiness Analytics",
    body: "Branch-wise readiness, placement funnels and package distributions, all built from real student activity — exportable as PDF, Excel or CSV.",
    href: "/features/placement-analytics",
    badge: "Reports",
  },
  {
    icon: ShieldCheck,
    title: "Proctored Assessments",
    body: "Fullscreen enforcement, tab-switch detection and strike-based lockouts keep every mock contest score fair and defensible.",
    href: "/features/proctored-assessments",
    badge: "Proctoring",
  },
];

// ─── How it works steps ────────────────────────────────────────────────────────
const STEPS = [
  {
    n: "01",
    title: "We set up your campus",
    body: "Our team onboards your college, creates your placement cell account and configures your section coordinators.",
    icon: Building2,
  },
  {
    n: "02",
    title: "Import your batch",
    body: "Upload one CSV. Accounts, logins and welcome emails are sent automatically — nothing for your team to do by hand.",
    icon: Upload,
  },
  {
    n: "03",
    title: "Map recruiters & run drives",
    body: "Add companies, set eligibility rules, publish drives and notify eligible students in minutes rather than days.",
    icon: Briefcase,
  },
  {
    n: "04",
    title: "Report to management",
    body: "Export board-ready PDF summaries, branch-wise Excel sheets and drive eligibility reports at any time.",
    icon: BarChart3,
  },
];

// ─── Feature detail rows (alternating layout) ─────────────────────────────────
const DETAILS = [
  {
    icon: SlidersHorizontal,
    badge: "Eligibility rules",
    title: "Stop chasing eligibility by hand",
    body: "Set a minimum CGPA, backlog limit and eligible branches once per drive. Every student is checked instantly — and those who fall short see the exact reason, so your inbox stays quiet.",
    points: [
      "CGPA, backlog and branch filters in one panel",
      "Per-student ineligibility reason, per drive",
      "Eligibility reports exportable for every drive",
    ],
  },
  {
    icon: Mail,
    badge: "Notifications",
    title: "Reach every student without leaving the dashboard",
    body: "Send bulk email or WhatsApp messages to eligible students, or to their parents, directly from AptRun. Drives come with a live countdown so students always know how long they have to prepare.",
    points: [
      "Bulk email and WhatsApp from one click",
      "Targeted to eligible students or all students",
      "Live drive countdown visible on every student's dashboard",
    ],
  },
  {
    icon: Layers,
    badge: "Section coordinators",
    title: "Give each section its own coordinator",
    body: "Section coordinators get a focused dashboard: their roster, their proctoring view and their own reports — with no access to other sections. Role-based access keeps everything clean.",
    points: [
      "Dedicated coordinator dashboard per section",
      "Proctoring and report access scoped to their students",
      "Add coordinators from the TPO panel in seconds",
    ],
  },
];

// ─── Objections / FAQ ─────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "How long does it take to get started?",
    a: "Our team sets up your college account. From there, importing a batch of 500 students takes about 10 minutes — you upload the CSV, we handle the rest.",
  },
  {
    q: "Do students need to create their own accounts?",
    a: "No. When you bulk-import a batch, each student gets an account and a welcome email with their login details automatically.",
  },
  {
    q: "Can different branches have different eligibility for the same drive?",
    a: "Yes. You set branch, CGPA and backlog rules per drive. Students not meeting the criteria are flagged with the exact reason.",
  },
  {
    q: "What reports can I give to management?",
    a: "Board-ready PDF summaries, branch-wise readiness tables, placement funnels, package distributions and full student rosters — all exportable in PDF, Excel or CSV.",
  },
  {
    q: "Is proctoring only for actual drives, or can we use it for mock tests?",
    a: "You can run proctored mock contests for your cohort at any time — before a real drive, mid-semester, or as practice. Results and violations are visible to you and section coordinators.",
  },
];

// ─── Page component ────────────────────────────────────────────────────────────
export function CollegesPageContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const stats = usePublicStats();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden pt-10 sm:pt-16 pb-20 sm:pb-28">
        {/* Background layers */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
          <div className={cn("absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b to-transparent", T.wash)} />
          <div className="lp-blob-a absolute -top-20 left-[4%] w-[500px] h-[400px] rounded-full bg-indigo-500/10 blur-[110px]" />
          <div className="lp-blob-b absolute top-10 right-[2%] w-[440px] h-[360px] rounded-full bg-accent-secondary/10 blur-[110px]" />
          <div className="absolute inset-0 bg-grid-pattern opacity-35 dark:opacity-20 [mask-image:radial-gradient(ellipse_65%_50%_at_50%_0%,black,transparent)]" />
        </div>

        <Container size="xl">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-10">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-primary">For Colleges</span>
          </nav>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: copy */}
            <div>
              <span className={cn("inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-6", T.pill)}>
                <Building2 className="w-3.5 h-3.5" /> For Colleges &amp; Placement Cells
              </span>

              <h1 className="text-[2.5rem] sm:text-5xl lg:text-[3.25rem] font-bold tracking-[-0.035em] text-primary leading-[1.05] mb-5 text-balance">
                Run your entire{" "}
                <span className="lp-gradient-text">placement season</span>{" "}
                from one dashboard
              </h1>

              <p className="text-base sm:text-lg font-medium text-text-secondary leading-relaxed max-w-xl mb-8">
                Map every recruiter, onboard a whole batch from one CSV, set eligibility rules that apply themselves — and hand management the reports they ask for, all without five spreadsheets.
              </p>

              {/* Hero CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Button
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="hp-btn-sheen justify-center"
                  onClick={() => setModalOpen(true)}
                >
                  Book a Demo
                </Button>
                <ButtonLink href="/pricing" variant="secondary" size="lg" className="justify-center">
                  See Pricing
                </ButtonLink>
              </div>

              <p className="text-sm text-text-secondary">
                <span className="font-semibold text-primary">No IT setup required.</span> Our team onboards your college — you're up and running within one business day.
              </p>
            </div>

            {/* Right: live product preview panel */}
            <div className="relative">
              <SpotlightCard className="rounded-panel bg-surface border border-border-strong shadow-[0_32px_80px_-30px_rgba(79,70,229,0.35)] overflow-hidden">
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent", T.wash)} />

                {/* Mini dashboard header */}
                <div className="relative flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-elevated/40">
                  <span className="text-2xs font-mono font-bold uppercase tracking-wider text-text-secondary">Placement Cell Dashboard</span>
                  <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/25">Live</span>
                </div>

                {/* KPI row — real stats where available */}
                <div className="relative grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle">
                  {[
                    { label: "Students onboarded", value: "480", real: false },
                    { label: "Live drives", value: "12", real: false },
                    { label: "Offers recorded", value: "58", real: false },
                  ].map((k) => (
                    <div key={k.label} className="px-4 py-4">
                      <div className="text-2xl font-black font-mono text-primary">{k.value}</div>
                      <div className="text-2xs font-semibold text-text-secondary mt-0.5">{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Drive list */}
                <div className="relative divide-y divide-border-subtle">
                  {[
                    { company: "Nova Systems", role: "Systems Engineer · CGPA 7.0+", status: "Mapped", style: "success" },
                    { company: "Quantica Labs", role: "Software Eng · CSE, IT", status: "Eligibility set", style: "tone" },
                    { company: "Orbit Technologies", role: "Project Eng · All branches", status: "Drive active", style: "active" },
                    { company: "Helix Software", role: "Analyst · CSE, IT, ECE", status: "Mapped", style: "success" },
                  ].map((r) => (
                    <div key={r.company} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("w-8 h-8 rounded-control border flex items-center justify-center shrink-0", T.icon)}>
                          <Briefcase className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-primary truncate">{r.company}</div>
                          <div className="text-2xs text-text-secondary truncate">{r.role}</div>
                        </div>
                      </div>
                      <span className={cn(
                        "shrink-0 text-2xs font-bold px-2.5 py-1 rounded-full border",
                        r.style === "success" && "bg-status-success/15 text-status-success border-status-success/30",
                        r.style === "tone" && T.pill,
                        r.style === "active" && "bg-accent-primary text-white border-accent-primary",
                      )}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Funnel footer */}
                <div className="relative px-5 py-4 border-t border-border-subtle bg-elevated/40">
                  <span className="text-2xs font-mono font-bold uppercase tracking-wider text-text-secondary block mb-3">Drive funnel</span>
                  {[
                    { label: "Applied", pct: 100, n: 240 },
                    { label: "Shortlisted", pct: 55, n: 132 },
                    { label: "Selected", pct: 24, n: 58 },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-3 mb-2 last:mb-0">
                      <span className="w-18 shrink-0 text-2xs font-semibold text-text-secondary">{f.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
                        <div className={cn("h-full rounded-full bg-gradient-to-r", T.bar)} style={{ width: `${f.pct}%` }} />
                      </div>
                      <span className="w-7 text-right text-2xs font-bold font-mono text-primary">{f.n}</span>
                    </div>
                  ))}
                  <p className="mt-3 text-2xs text-text-muted">Sample data — illustrative</p>
                </div>
              </SpotlightCard>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Before / After pain-point bar ─────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-surface/40 border-y border-border-subtle">
        <Container size="xl">
          <div className="text-center mb-10 sm:mb-14">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              The difference
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl font-bold tracking-[-0.03em] text-primary text-balance">
              What your placement season looks like{" "}
              <span className="lp-gradient-text">with AptRun</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PAINS.map((p) => (
              <SpotlightCard key={p.before} className={cn("relative rounded-card bg-surface border border-border-subtle p-5 sm:p-6 overflow-hidden", T.shadow)}>
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent pointer-events-none", T.wash)} />
                <div className="relative flex gap-4">
                  {/* Before */}
                  <div className="flex-1">
                    <span className="text-2xs font-mono font-bold uppercase tracking-wider text-status-danger block mb-2">Before</span>
                    <p className="text-sm font-medium text-text-secondary leading-relaxed">{p.before}</p>
                  </div>
                  <div className="w-px bg-border-subtle shrink-0 my-1" />
                  {/* After */}
                  <div className="flex-1">
                    <span className="text-2xs font-mono font-bold uppercase tracking-wider text-status-success block mb-2">With AptRun</span>
                    <p className="text-sm font-medium text-primary leading-relaxed">{p.after}</p>
                  </div>
                </div>
              </SpotlightCard>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Arena stats (real backend data) ───────────────────────────────── */}
      {stats && (
        <section className="py-14 sm:py-20 border-b border-border-subtle">
          <Container size="xl">
            <p className="text-center text-xs font-mono font-bold uppercase tracking-wider text-text-secondary mb-8">
              The practice arena your students get access to — real numbers
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Practice Problems", value: stats.problems_total, suffix: "", sub: `${stats.problems_easy} Easy · ${stats.problems_medium} Medium · ${stats.problems_hard} Hard` },
                { label: "DSA Topics", value: stats.topics_total, suffix: "", sub: "Arrays, graphs, DP, tries and more" },
                { label: "Real Test Cases", value: stats.test_cases_total, suffix: "+", sub: "Every submission judged on hidden cases" },
                { label: "Languages", value: stats.languages_total, suffix: "", sub: "C++, Java, Python, Go, Rust and more" },
              ].map((s) => (
                <SpotlightCard key={s.label} className={cn("relative rounded-2xl bg-surface border border-border-subtle p-5 flex flex-col group hover:-translate-y-1 transition-all duration-300 shadow-sm overflow-hidden", T.shadow)}>
                  <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r to-transparent", T.bar)} />
                  <div className="text-3xl font-black font-mono text-primary mt-2 mb-1">
                    <AnimatedCounter target={s.value} suffix={s.suffix} />
                  </div>
                  <div className="text-sm font-bold text-primary mb-1">{s.label}</div>
                  <div className="text-2xs text-text-secondary leading-relaxed mt-auto pt-2.5 border-t border-border-subtle">{s.sub}</div>
                </SpotlightCard>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ── Core capabilities grid ─────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-b border-border-subtle">
        <Container size="xl">
          <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              Platform
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
              Everything your placement cell{" "}
              <span className="lp-gradient-text">actually needs</span>
            </h2>
            <p className="mt-4 text-base sm:text-[1.0625rem] font-medium text-text-secondary leading-relaxed">
              One platform instead of five tools and a spreadsheet.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {CAPS.map((c) => {
              const Icon = c.icon;
              return (
                <Link key={c.title} href={c.href} className="group block">
                  <SpotlightCard className={cn("relative h-full rounded-card bg-surface border border-border-subtle p-6 sm:p-7 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300", T.shadow)}>
                    <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent pointer-events-none", T.wash)} />
                    <div className="relative flex items-start justify-between mb-5">
                      <span className={cn("w-12 h-12 rounded-control border flex items-center justify-center transition-all duration-300 group-hover:scale-105", T.icon, T.iconHover)}>
                        <Icon className="w-6 h-6" />
                      </span>
                      <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border", T.pill)}>{c.badge}</span>
                    </div>
                    <h3 className="relative text-xl font-bold text-primary mb-2">{c.title}</h3>
                    <p className="relative text-sm sm:text-base text-text-secondary leading-relaxed">{c.body}</p>
                    <div className={cn("relative mt-4 inline-flex items-center gap-1 text-sm font-bold", T.text)}>
                      Learn more <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </SpotlightCard>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ── Feature detail: alternating rows ──────────────────────────────── */}
      <section className="py-20 sm:py-28 border-b border-border-subtle">
        <Container size="xl">
          <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-20">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              Capabilities
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
              Built around how TPOs actually work
            </h2>
          </div>

          <div className="space-y-16 sm:space-y-24">
            {DETAILS.map((d, i) => {
              const Icon = d.icon;
              return (
                <div key={d.title} className={cn("grid lg:grid-cols-2 gap-10 lg:gap-16 items-center", i % 2 === 1 && "lg:[&>*:first-child]:order-2")}>
                  <div>
                    <span className={cn("inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-5", T.pill)}>
                      <Icon className="w-3 h-3" /> {d.badge}
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-[-0.025em] text-primary mb-4 text-balance">{d.title}</h3>
                    <p className="text-base font-medium text-text-secondary leading-relaxed mb-6">{d.body}</p>
                    <ul className="space-y-3">
                      {d.points.map((pt) => (
                        <li key={pt} className="flex items-start gap-3 text-sm font-medium text-text-secondary">
                          <span className={cn("mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0", T.icon)}>
                            <Check className="w-3 h-3" strokeWidth={3} />
                          </span>
                          {pt}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Visual card */}
                  <SpotlightCard className="relative rounded-panel bg-surface border border-border-strong shadow-[0_24px_60px_-24px_rgba(99,102,241,0.3)] overflow-hidden">
                    <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", T.wash)} />
                    <Icon aria-hidden="true" className={cn("absolute -right-6 -top-6 w-36 h-36 opacity-[0.06]", "text-indigo-500")} strokeWidth={1.25} />
                    <div className="relative p-6 sm:p-8">
                      <div className={cn("w-12 h-12 rounded-control border flex items-center justify-center mb-5", T.icon)}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <p className="text-lg font-bold text-primary mb-3">{d.title}</p>
                      <ul className="space-y-2.5">
                        {d.points.map((pt) => (
                          <li key={pt} className={cn("rounded-control bg-elevated/60 border border-border-subtle border-l-[3px] border-l-indigo-500 px-4 py-3 text-sm font-medium text-text-secondary leading-snug")}>
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </SpotlightCard>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ── How it works: 4-step timeline ─────────────────────────────────── */}
      <section className="relative py-20 sm:py-28 bg-surface/20 border-b border-border-subtle overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-dot-pattern opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_30%,black,transparent)] pointer-events-none" />
        <Container size="xl" className="relative">
          <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              Getting started
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
              Up and running in{" "}
              <span className="lp-gradient-text">four steps</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={cn("w-12 h-12 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-mono text-base font-black ring-4 ring-background", T.node)}>
                      {s.n}
                    </span>
                  </div>
                  <SpotlightCard className="flex-1 rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden">
                    <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent pointer-events-none", T.wash)} />
                    <div className={cn("relative w-10 h-10 rounded-control border flex items-center justify-center mb-4", T.icon)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="relative text-base font-bold text-primary mb-2">{s.title}</h3>
                    <p className="relative text-sm text-text-secondary leading-relaxed">{s.body}</p>
                  </SpotlightCard>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ── What students get (cross-sell) ────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-b border-border-subtle">
        <Container size="xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-6 bg-cyan-500/10 border-cyan-500/25 text-cyan-800 dark:text-cyan-300">
                <GraduationCap className="w-3.5 h-3.5" /> For your students
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.025em] text-primary mb-4 text-balance">
                Every student gets a personal learning centre
              </h2>
              <p className="text-base font-medium text-text-secondary leading-relaxed mb-6">
                When you import your batch, each student lands in their own learning centre from day one — ready to prepare for the exact companies you map to your campus, at no extra cost to them.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Company-specific prep packs with past interview questions",
                  `A real coding arena with ${stats ? stats.problems_total + " problems" : "hundreds of problems"} across ${stats ? stats.topics_total + " DSA topics" : "all major topics"}`,
                  "AI mock interviews with instant, written feedback",
                  "Speaking, listening and vocabulary practice modules",
                  "A live readiness score visible to both student and TPO",
                ].map((pt) => (
                  <li key={pt} className="flex items-start gap-3 text-sm font-medium text-text-secondary">
                    <span className="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 bg-gradient-to-br from-cyan-500/25 to-cyan-500/5 border-cyan-500/30 text-cyan-700 dark:text-cyan-400">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>
              <Link href="/students" className="inline-flex items-center gap-1.5 text-sm font-bold text-cyan-700 dark:text-cyan-400 hover:underline underline-offset-4">
                See what students experience <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Code2, title: "Practice Arena", body: "Real judge, hidden test cases, 19 languages", badge: "bg-cyan-500/10 border-cyan-500/25 text-cyan-800 dark:text-cyan-300" },
                { icon: Mic, title: "AI Interviews", body: "Role-based tracks, instant scored feedback", badge: "bg-violet-500/10 border-violet-500/25 text-violet-700 dark:text-violet-300" },
                { icon: ClipboardList, title: "Company Prep", body: "Past questions and hiring process per company", badge: "bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300" },
                { icon: Gauge, title: "Readiness Score", body: "Live score TPO and student both see", badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300" },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <SpotlightCard key={c.title} className="relative rounded-card bg-surface border border-border-subtle p-5 overflow-hidden hover:-translate-y-1 hover:border-border-strong transition-all duration-300 shadow-sm">
                    <div className={cn("w-10 h-10 rounded-control border flex items-center justify-center mb-3", c.badge.replace("text-cyan-800", "text-cyan-700").replace("text-amber-800", "text-amber-700").replace("text-emerald-800", "text-emerald-700"), "bg-gradient-to-br from-current/10 to-current/5 border-current/25")}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-primary mb-1">{c.title}</h4>
                    <p className="text-xs text-text-secondary leading-relaxed">{c.body}</p>
                  </SpotlightCard>
                );
              })}
            </div>
          </div>
        </Container>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-b border-border-subtle bg-surface/30">
        <Container size="md">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              FAQ
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl font-bold tracking-[-0.03em] text-primary">Questions from placement cells</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((f) => (
              <SpotlightCard key={f.q} className={cn("relative rounded-card bg-surface border border-border-subtle p-6 overflow-hidden", T.shadow)}>
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent pointer-events-none", T.wash)} />
                <h3 className="relative text-base font-bold text-primary mb-2">{f.q}</h3>
                <p className="relative text-sm font-medium text-text-secondary leading-relaxed">{f.a}</p>
              </SpotlightCard>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Closing CTA ───────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <Container size="lg">
          <div className="lp-gborder relative rounded-panel bg-surface border border-accent-primary/20 p-8 sm:p-14 text-center overflow-hidden shadow-[0_32px_80px_-30px_rgba(79,70,229,0.5)]">
            <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent", T.wash)} />
            <div aria-hidden="true" className="absolute inset-0 bg-grid-pattern opacity-25 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)] pointer-events-none" />
            <div className="relative max-w-2xl mx-auto">
              <span className={cn("inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-6", T.pill)}>
                <Building2 className="w-3.5 h-3.5" /> For colleges
              </span>
              <h2 className="text-[1.75rem] sm:text-4xl font-bold tracking-[-0.03em] text-primary mb-3 text-balance">
                See it running for your campus
              </h2>
              <p className="text-base sm:text-[1.0625rem] font-medium text-text-secondary mb-8">
                Tell us about your placement season and we will show you how it works — usually within one business day.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />} className="hp-btn-sheen justify-center" onClick={() => setModalOpen(true)}>
                  Book a Demo
                </Button>
                <ButtonLink href="/contact" variant="secondary" size="lg" className="justify-center">
                  Talk to Our Team
                </ButtonLink>
              </div>
              <p className="mt-6 text-sm text-text-secondary">No IT setup · Onboarded by our team · Up in one business day</p>
            </div>
          </div>
        </Container>
      </section>

      {/* Also explore */}
      <section className="pb-16 sm:pb-20 border-t border-border-subtle">
        <Container size="lg">
          <h2 className="text-2xl font-bold tracking-tight text-primary text-center mb-8 pt-14">One platform, three audiences</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { href: "/students", label: "For Students", eyebrow: "students", desc: "Personal learning centre, company prep, and a real coding arena.", icon: GraduationCap, tone: "text-cyan-700 dark:text-cyan-400", pill: "bg-cyan-500/10 border-cyan-500/25 text-cyan-800 dark:text-cyan-300", shadow: "hover:shadow-[0_24px_48px_-20px_rgba(6,182,212,0.45)]" },
              { href: "/recruiters", label: "For Recruiters", eyebrow: "recruiters", desc: "Post openings, reach partner colleges, screen with proctored assessments.", icon: Briefcase, tone: "text-violet-600 dark:text-violet-400", pill: "bg-violet-500/10 border-violet-500/25 text-violet-700 dark:text-violet-300", shadow: "hover:shadow-[0_24px_48px_-20px_rgba(139,92,246,0.45)]" },
            ].map((o) => {
              const OIcon = o.icon;
              return (
                <Link key={o.href} href={o.href} className="group block">
                  <SpotlightCard className={cn("relative h-full rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300", o.shadow)}>
                    <div className="flex items-center gap-4">
                      <span className="w-12 h-12 rounded-control border flex items-center justify-center shrink-0 bg-gradient-to-br from-current/10 to-current/5 border-current/25">
                        <OIcon className={cn("w-6 h-6", o.tone)} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-2xs font-mono font-bold uppercase tracking-wider mb-0.5", o.tone)}>{o.label}</p>
                        <p className="text-base font-bold text-primary">{o.desc}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-accent-primary group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                  </SpotlightCard>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      <TalkToTeamModal open={modalOpen} onClose={() => setModalOpen(false)} defaultAudience="institution" />
    </>
  );
}

