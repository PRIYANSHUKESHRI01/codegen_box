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
  EyeOff,
  GraduationCap,
  Handshake,
  Mic,
  Search,
  ShieldCheck,
  Trophy,
  Upload,
  UserCheck,
  Users2,
  CalendarClock,
  Award,
  Filter,
  SlidersHorizontal,
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
  wash: "from-violet-500/[0.14]",
  pill: "bg-violet-500/10 border-violet-500/25 text-violet-700 dark:text-violet-300",
  icon: "bg-gradient-to-br from-violet-500/25 to-violet-500/5 border-violet-500/30 text-violet-600 dark:text-violet-400",
  iconHover: "group-hover:from-violet-500 group-hover:to-violet-600 group-hover:text-white group-hover:border-violet-500",
  text: "text-violet-600 dark:text-violet-400",
  shadow: "hover:shadow-[0_24px_48px_-20px_rgba(139,92,246,0.45)]",
  bar: "from-violet-500 to-fuchsia-400",
  node: "from-violet-500 to-violet-600 shadow-[0_8px_24px_-6px_rgba(139,92,246,0.7)]",
};

// ─── Pain points ──────────────────────────────────────────────────────────────
const PAINS = [
  { before: "Coordinate with each college separately for every hire", after: "Post once — propose to any partner campus or open to all" },
  { before: "Candidates with polished CVs but no verified skills", after: "Proctored scores and AI interview feedback per candidate" },
  { before: "No way to reach top students before they apply elsewhere", after: "Consent-based talent pool of verified performers, ready to contact" },
  { before: "Assessment process differs campus to campus", after: "Same proctored test and AI interview for every candidate" },
];

// ─── Capabilities ─────────────────────────────────────────────────────────────
const CAPS = [
  {
    icon: Handshake,
    title: "Hire From Campuses",
    body: "Post a job opening once. Propose it to the partner colleges you want, or open it to every candidate on the platform — one pipeline from shortlist to hire.",
    href: "/features/campus-hiring",
    badge: "Campus hiring",
  },
  {
    icon: Users2,
    title: "Talent Pool",
    body: "Search verified candidates who scored well in contests and chose to be visible. Every entry shows the score and the contest it came from — no unverified CVs.",
    href: "/features/talent-pool",
    badge: "Discovery",
  },
  {
    icon: ShieldCheck,
    title: "Proctored Assessments",
    body: "Fullscreen enforcement, tab-switch detection and strike-based lockouts keep every score defensible. The same rules for every candidate.",
    href: "/features/proctored-assessments",
    badge: "Proctoring",
  },
  {
    icon: Mic,
    title: "AI Interviews",
    body: "Role-based interview tracks scored instantly with written feedback. A human reviewer can override any AI result — speed without giving AI the last word.",
    href: "/features/ai-interviews",
    badge: "Screening",
  },
];

// ─── Feature details (alternating) ────────────────────────────────────────────
const DETAILS = [
  {
    icon: Handshake,
    badge: "Campus hiring",
    title: "One opening, every campus you want",
    body: "Post the role once, then decide exactly where it goes: propose it to selected partner colleges, or open it to every student on the platform. You control the reach without duplicating work.",
    points: [
      "Post a role with CTC, terms and eligibility in minutes",
      "Propose to named partner colleges or open to all",
      "Import your own candidates by file or add them one at a time",
      "Track every candidate from invited to shortlisted to hired",
    ],
  },
  {
    icon: ShieldCheck,
    badge: "Consistent screening",
    title: "The same bar for every candidate",
    body: "Proctored assessments and AI-scored interviews run identically for everyone. Violations are logged, feedback is readable, and you can review any session and override any result.",
    points: [
      "Fullscreen enforcement and tab-switch detection",
      "Three-strike lockout policy, reported to you instantly",
      "AI interview feedback in plain language per answer",
      "Human review and override for any session",
    ],
  },
  {
    icon: Users2,
    badge: "Talent pool",
    title: "Find the candidates you didn't know to look for",
    body: "The talent pool surfaces students who earned a qualifying contest score and chose to be visible. You see verified numbers, not curated CVs — and every candidate has already consented.",
    points: [
      "Scores come from real contests with proctored enforcement",
      "Students are visible only after giving explicit consent",
      "Filter by score, topic or campus",
      "Express interest, schedule HR interviews and record the hire",
    ],
  },
];

// ─── How it works ─────────────────────────────────────────────────────────────
const STEPS = [
  { n: "01", title: "Talk to our team", body: "Hiring-partner accounts are set up by our team after a short conversation about your hiring needs.", icon: Handshake },
  { n: "02", title: "Post the opening", body: "Describe the role, the CTC and the timeline. Propose it to partner colleges or open it to all candidates on the platform.", icon: Briefcase },
  { n: "03", title: "Screen consistently", body: "Invite candidates to proctored coding assessments and AI-scored interviews. Review results and violations from one panel.", icon: ShieldCheck },
  { n: "04", title: "Hire and record", body: "Mark the hire when it happens. Candidates and your reports stay accurate automatically.", icon: Award },
];

// ─── FAQ ───────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "How do I get a hiring-partner account?",
    a: "Hiring-partner accounts are set up by our team. Use the 'Talk to Our Team' button and we'll be in touch — usually within one business day.",
  },
  {
    q: "Can I post a role to only specific colleges?",
    a: "Yes. When you publish an opening, you choose whether to propose it to selected partner colleges, or open it to every candidate on the platform.",
  },
  {
    q: "What does proctoring actually log?",
    a: "Fullscreen exits, tab switches and developer-tools opens are logged as violations. Students are warned twice; a third strike submits their current work and ends the session. Camera and microphone are used for the student's local monitoring only — no video is uploaded or stored.",
  },
  {
    q: "How is the talent pool different from a normal job board?",
    a: "Every talent-pool profile comes with a real contest score from a proctored assessment. Students only appear after giving explicit consent — they can withdraw or decline your interest at any time.",
  },
  {
    q: "Can a human review and override AI interview scores?",
    a: "Yes. Any session can be reviewed by a designated reviewer, and they can override the AI score. AI speed never means AI having the last word.",
  },
  {
    q: "Can I bring my own candidates into the system?",
    a: "Yes. Import candidates in bulk from a CSV or add them individually, then invite them to your proctored assessments and AI interviews.",
  },
];

// ─── Page component ────────────────────────────────────────────────────────────
export function RecruitersPageContent() {
  const [modalOpen, setModalOpen] = useState(false);
  const stats = usePublicStats();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden pt-10 sm:pt-16 pb-20 sm:pb-28">
        <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
          <div className={cn("absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b to-transparent", T.wash)} />
          <div className="lp-blob-a absolute -top-20 left-[4%] w-[500px] h-[400px] rounded-full bg-violet-500/10 blur-[110px]" />
          <div className="lp-blob-b absolute top-10 right-[2%] w-[440px] h-[360px] rounded-full bg-fuchsia-400/10 blur-[110px]" />
          <div className="absolute inset-0 bg-grid-pattern opacity-35 dark:opacity-20 [mask-image:radial-gradient(ellipse_65%_50%_at_50%_0%,black,transparent)]" />
        </div>

        <Container size="xl">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-10">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-primary">For Recruiters</span>
          </nav>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <span className={cn("inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-6", T.pill)}>
                <Briefcase className="w-3.5 h-3.5" /> For Recruiters &amp; Hiring Partners
              </span>

              <h1 className="text-[2.5rem] sm:text-5xl lg:text-[3.25rem] font-bold tracking-[-0.035em] text-primary leading-[1.05] mb-5 text-balance">
                Hire from campuses that are{" "}
                <span className="lp-gradient-text">already prepared</span>
              </h1>

              <p className="text-base sm:text-lg font-medium text-text-secondary leading-relaxed max-w-xl mb-8">
                Post one opening, reach partner colleges, and screen every candidate with the same proctored assessment and AI interview — from a single pipeline. No per-campus coordination.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Button
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  className="hp-btn-sheen justify-center"
                  onClick={() => setModalOpen(true)}
                >
                  Talk to Our Team
                </Button>
                <ButtonLink href="/pricing" variant="secondary" size="lg" className="justify-center">
                  See Pricing
                </ButtonLink>
              </div>

              <p className="text-sm text-text-secondary">
                <span className="font-semibold text-primary">Set up by our team.</span> Hiring-partner accounts are onboarded after a short conversation — no self-serve form.
              </p>
            </div>

            {/* Right: recruiter pipeline preview */}
            <div>
              <SpotlightCard className="rounded-panel bg-surface border border-border-strong shadow-[0_32px_80px_-30px_rgba(139,92,246,0.35)] overflow-hidden">
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", T.wash)} />

                {/* Header */}
                <div className="relative flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-elevated/40">
                  <span className="text-2xs font-mono font-bold uppercase tracking-wider text-text-secondary">Hiring Pipeline</span>
                  <span className="text-2xs font-bold px-2.5 py-0.5 rounded-full bg-status-success/15 text-status-success border border-status-success/25">Software Eng · Drive Active</span>
                </div>

                {/* Pipeline stages */}
                <div className="relative grid grid-cols-3 divide-x divide-border-subtle border-b border-border-subtle">
                  {[
                    { label: "Invited", n: 84 },
                    { label: "Assessed", n: 61 },
                    { label: "Shortlisted", n: 18 },
                  ].map((s) => (
                    <div key={s.label} className="px-4 py-4 text-center">
                      <div className="text-2xl font-black font-mono text-primary">{s.n}</div>
                      <div className="text-2xs font-semibold text-text-secondary mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Candidate list */}
                <div className="relative divide-y divide-border-subtle">
                  {[
                    { name: "Aryan S.", score: 91, interview: 88, status: "Shortlisted", style: "success" },
                    { name: "Meera K.", score: 87, interview: 82, status: "Under review", style: "tone" },
                    { name: "Rohan D.", score: 76, interview: 79, status: "Invited", style: "muted" },
                    { name: "Sneha P.", score: 94, interview: 91, status: "Offer sent", style: "active" },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("w-8 h-8 rounded-full border flex items-center justify-center shrink-0 text-2xs font-bold", T.icon)}>
                          {c.name.split(" ").map(n => n[0]).join("")}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-primary">{c.name}</div>
                          <div className="text-2xs text-text-secondary">Assessment: {c.score} · Interview: {c.interview}</div>
                        </div>
                      </div>
                      <span className={cn(
                        "shrink-0 text-2xs font-bold px-2.5 py-1 rounded-full border",
                        c.style === "success" && "bg-status-success/15 text-status-success border-status-success/30",
                        c.style === "tone" && T.pill,
                        c.style === "active" && "bg-accent-primary text-white border-accent-primary",
                        c.style === "muted" && "bg-elevated text-text-secondary border-border-subtle",
                      )}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Arena stats footer */}
                <div className="relative px-5 py-3 border-t border-border-subtle bg-elevated/40 flex items-center justify-between">
                  <span className="text-2xs font-semibold text-text-secondary">Candidates practised on</span>
                  <span className="text-2xs font-black font-mono text-primary">
                    {stats ? `${stats.problems_total.toLocaleString()} problems · ${stats.languages_total} languages` : "real proctored assessments"}
                  </span>
                </div>
                <p className="text-center text-2xs text-text-muted pb-3">Sample data — illustrative except live stats</p>
              </SpotlightCard>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Pain point comparison ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 bg-surface/40 border-y border-border-subtle">
        <Container size="xl">
          <div className="text-center mb-10 sm:mb-14">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              The difference
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl font-bold tracking-[-0.03em] text-primary text-balance">
              Campus hiring without the{" "}
              <span className="lp-gradient-text">coordination overhead</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PAINS.map((p) => (
              <SpotlightCard key={p.before} className={cn("relative rounded-card bg-surface border border-border-subtle p-5 sm:p-6 overflow-hidden", T.shadow)}>
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent pointer-events-none", T.wash)} />
                <div className="relative flex gap-4">
                  <div className="flex-1">
                    <span className="text-2xs font-mono font-bold uppercase tracking-wider text-status-danger block mb-2">Before</span>
                    <p className="text-sm font-medium text-text-secondary leading-relaxed">{p.before}</p>
                  </div>
                  <div className="w-px bg-border-subtle shrink-0 my-1" />
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

      {/* ── Arena stats (real data — shows what candidates have been practising) */}
      {stats && (
        <section className="py-14 sm:py-20 border-b border-border-subtle">
          <Container size="xl">
            <p className="text-center text-xs font-mono font-bold uppercase tracking-wider text-text-secondary mb-8">
              What candidates on AptRun practise on — real numbers
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Practice Problems", value: stats.problems_total, suffix: "", sub: `${stats.problems_easy} Easy · ${stats.problems_medium} Medium · ${stats.problems_hard} Hard` },
                { label: "DSA Topics", value: stats.topics_total, suffix: "", sub: "Arrays, graphs, DP, trees, tries and more" },
                { label: "Real Test Cases", value: stats.test_cases_total, suffix: "+", sub: "Hidden cases — every verdict is real" },
                { label: "Languages", value: stats.languages_total, suffix: "", sub: "C++, Java, Python, Go, Rust, Kotlin and more" },
              ].map((s) => (
                <SpotlightCard key={s.label} className={cn("relative rounded-2xl bg-surface border border-border-subtle p-5 flex flex-col group hover:-translate-y-1 transition-all duration-300 shadow-sm overflow-hidden", T.shadow)}>
                  <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-400 to-transparent opacity-70" />
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

      {/* ── Core capabilities ─────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-b border-border-subtle">
        <Container size="xl">
          <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              Platform
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
              Every tool you need to{" "}
              <span className="lp-gradient-text">hire from campus</span>
            </h2>
            <p className="mt-4 text-base sm:text-[1.0625rem] font-medium text-text-secondary leading-relaxed">
              One pipeline from opening to offer letter — no per-college coordination.
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

      {/* ── Feature detail rows ────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-b border-border-subtle">
        <Container size="xl">
          <div className="max-w-3xl mx-auto text-center mb-14 sm:mb-20">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              How it works
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
              Designed for how campus hiring actually runs
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
                  <SpotlightCard className="relative rounded-panel bg-surface border border-border-strong shadow-[0_24px_60px_-24px_rgba(139,92,246,0.3)] overflow-hidden">
                    <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", T.wash)} />
                    <Icon aria-hidden="true" className="absolute -right-6 -top-6 w-36 h-36 opacity-[0.06] text-violet-500" strokeWidth={1.25} />
                    <div className="relative p-6 sm:p-8">
                      <div className={cn("w-12 h-12 rounded-control border flex items-center justify-center mb-5", T.icon)}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <p className="text-lg font-bold text-primary mb-3">{d.title}</p>
                      <ul className="space-y-2.5">
                        {d.points.map((pt) => (
                          <li key={pt} className="rounded-control bg-elevated/60 border border-border-subtle border-l-[3px] border-l-violet-500 px-4 py-3 text-sm font-medium text-text-secondary leading-snug">
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

      {/* ── How it works: 4-step ──────────────────────────────────────────── */}
      <section className="relative py-20 sm:py-28 bg-surface/20 border-b border-border-subtle overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-dot-pattern opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_30%,black,transparent)] pointer-events-none" />
        <Container size="xl" className="relative">
          <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              Getting started
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
              From conversation to{" "}
              <span className="lp-gradient-text">first hire</span>
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
                  <SpotlightCard className="flex-1 relative rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden">
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

      {/* ── Consent note ──────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 border-b border-border-subtle">
        <Container size="md">
          <SpotlightCard className={cn("relative rounded-panel bg-surface border border-border-subtle p-8 sm:p-10 overflow-hidden", T.shadow)}>
            <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", T.wash)} />
            <div className="relative flex flex-col sm:flex-row items-start gap-6">
              <div className={cn("w-14 h-14 rounded-control border flex items-center justify-center shrink-0", T.icon)}>
                <EyeOff className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary mb-2">The talent pool is built on consent</h3>
                <p className="text-base font-medium text-text-secondary leading-relaxed mb-4">
                  Every candidate in the talent pool is there by choice. They earned a qualifying score in a proctored contest, then gave explicit consent to be visible. They can withdraw at any time, and they can decline interest from any company — including yours.
                </p>
                <p className="text-sm text-text-secondary">
                  This means the candidates you reach are not just verified — they are actively open to hearing from you.
                </p>
              </div>
            </div>
          </SpotlightCard>
        </Container>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-b border-border-subtle bg-surface/30">
        <Container size="md">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              FAQ
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl font-bold tracking-[-0.03em] text-primary">Questions from recruiters</h2>
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
          <div className="lp-gborder relative rounded-panel bg-surface border border-accent-primary/20 p-8 sm:p-14 text-center overflow-hidden shadow-[0_32px_80px_-30px_rgba(139,92,246,0.5)]">
            <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent", T.wash)} />
            <div aria-hidden="true" className="absolute inset-0 bg-grid-pattern opacity-25 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)] pointer-events-none" />
            <div className="relative max-w-2xl mx-auto">
              <span className={cn("inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-6", T.pill)}>
                <Briefcase className="w-3.5 h-3.5" /> For recruiters
              </span>
              <h2 className="text-[1.75rem] sm:text-4xl font-bold tracking-[-0.03em] text-primary mb-3 text-balance">
                Ready to hire from campuses that are already prepared?
              </h2>
              <p className="text-base sm:text-[1.0625rem] font-medium text-text-secondary mb-8">
                Tell us about your hiring needs and we'll show you how it works — usually within one business day.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />} className="hp-btn-sheen justify-center" onClick={() => setModalOpen(true)}>
                  Talk to Our Team
                </Button>
                <ButtonLink href="/contact" variant="secondary" size="lg" className="justify-center">
                  Contact Us
                </ButtonLink>
              </div>
              <p className="mt-6 text-sm text-text-secondary">Account set up by our team · No self-serve form · Response within one business day</p>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Cross-audience ─────────────────────────────────────────────────── */}
      <section className="pb-16 sm:pb-20 border-t border-border-subtle">
        <Container size="lg">
          <h2 className="text-2xl font-bold tracking-tight text-primary text-center mb-8 pt-14">One platform, three audiences</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { href: "/colleges", label: "For Colleges", desc: "Placement cell command center — drives, onboarding, analytics, proctoring.", icon: Building2, tone: "text-indigo-600 dark:text-indigo-400", shadow: "hover:shadow-[0_24px_48px_-20px_rgba(99,102,241,0.45)]" },
              { href: "/students", label: "For Students", desc: "Personal learning centre, company prep packs, real coding arena, AI interviews.", icon: GraduationCap, tone: "text-cyan-700 dark:text-cyan-400", shadow: "hover:shadow-[0_24px_48px_-20px_rgba(6,182,212,0.45)]" },
            ].map((o) => {
              const OIcon = o.icon;
              return (
                <Link key={o.href} href={o.href} className="group block">
                  <SpotlightCard className={cn("relative h-full rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300", o.shadow)}>
                    <div className="flex items-center gap-4">
                      <OIcon className={cn("w-8 h-8 shrink-0", o.tone)} strokeWidth={1.5} />
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

      <TalkToTeamModal open={modalOpen} onClose={() => setModalOpen(false)} defaultAudience="company" />
    </>
  );
}

