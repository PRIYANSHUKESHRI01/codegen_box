"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  Code2,
  EyeOff,
  Gauge,
  GraduationCap,
  Headphones,
  ListChecks,
  MessageSquareText,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  UserCheck,
  Users2,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { usePublicStats, usePublicSampleProblems } from "@/lib/usePublicPlatformData";
import { cn } from "@/lib/utils";

// ─── design tokens ────────────────────────────────────────────────────────────
const T = {
  wash: "from-cyan-500/[0.14]",
  pill: "bg-cyan-500/10 border-cyan-500/25 text-cyan-800 dark:text-cyan-300",
  icon: "bg-gradient-to-br from-cyan-500/25 to-cyan-500/5 border-cyan-500/30 text-cyan-700 dark:text-cyan-400",
  iconHover: "group-hover:from-cyan-500 group-hover:to-cyan-600 group-hover:text-white group-hover:border-cyan-500",
  text: "text-cyan-700 dark:text-cyan-400",
  shadow: "hover:shadow-[0_24px_48px_-20px_rgba(6,182,212,0.45)]",
  bar: "from-cyan-500 to-sky-400",
  node: "from-cyan-500 to-sky-600 shadow-[0_8px_24px_-6px_rgba(6,182,212,0.7)]",
};

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  hard: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

// ─── Capabilities ─────────────────────────────────────────────────────────────
const CAPS = [
  {
    icon: Brain,
    title: "Personal Learning Centre",
    body: "Four practice modules — Reading, Speaking, Listening and Vocabulary — plus soft-skills assessments and a live readiness score that rolls up everything you do.",
    href: "/features/learning-centre",
    badge: "Communication",
  },
  {
    icon: BookOpenCheck,
    title: "Company Prep Packs",
    body: "When a company is mapped to your campus, you get their overview, hiring process breakdown and previous-year interview questions — all in one place.",
    href: "/features/company-prep",
    badge: "Prep",
  },
  {
    icon: Code2,
    title: "Practice Arena",
    body: "A real coding judge that compiles and runs your code against hidden test cases in 19 languages. Every verdict reflects working code — nothing is simulated.",
    href: "/features/practice-arena",
    badge: "Coding",
  },
  {
    icon: Mic,
    title: "AI Interviews",
    body: "Practice full role-based interview rounds on your own. Answers are scored the moment you finish, with written feedback — not a black-box number.",
    href: "/features/ai-interviews",
    badge: "Mock interviews",
  },
];

// ─── Feature details ───────────────────────────────────────────────────────────
const DETAILS = [
  {
    icon: Brain,
    badge: "Learning centre",
    title: "Four modules to sharpen every part of the interview",
    body: "Interviews are won on communication as much as code. Your learning centre gives you a place to practise reading, speaking, listening and vocabulary at your own pace — with instant, specific feedback.",
    points: [
      "Speaking: read aloud and get scored on clarity and fluency",
      "Listening: slow passages down, replay a sentence, see where each answer was",
      "Vocabulary: spaced-repetition sprints so words actually stick",
      "Soft-skills assessments set by your placement cell",
    ],
  },
  {
    icon: BookOpenCheck,
    badge: "Company prep",
    title: "Know the company before you walk in",
    body: "Generic advice only goes so far. When a drive is published for your campus, you get a prep pack built around that company: who they are, how they hire and what they have asked before.",
    points: [
      "Company overview and the role your placement cell published",
      "Round-by-round hiring process breakdown",
      "Previous-year interview questions in one place",
      "Recommended practice problems for that company",
      "A live countdown to the drive date",
    ],
  },
  {
    icon: Users2,
    badge: "Talent pool",
    title: "Get noticed — on your terms",
    body: "Top performers can join the recruiter talent pool. Your profile stays hidden until you say yes, and you can withdraw at any time. Recruiters only see you because you chose to be seen.",
    points: [
      "Enter by scoring above the qualifying mark in a contest",
      "Invisible until you give explicit consent",
      "You can withdraw from the pool at any time",
      "Decline interest from any company you don't want to pursue",
    ],
  },
];

// ─── Step-by-step ─────────────────────────────────────────────────────────────
const STEPS = [
  { n: "01", title: "Create your account", body: "Sign up free, or use the login your placement cell sent you — you're in your learning centre the same day.", icon: GraduationCap },
  { n: "02", title: "Study the companies", body: "Open the prep pack for every drive you're eligible for. Know the role, the rounds and the past questions before anyone else.", icon: BookOpenCheck },
  { n: "03", title: "Practise until it clicks", body: "Work through the recommended problems in the arena, run AI mock interviews, and track your readiness score day by day.", icon: Code2 },
  { n: "04", title: "Apply and get noticed", body: "Apply to eligible drives and, if you qualify in a contest, opt in to the talent pool so recruiters can find you.", icon: Trophy },
];

// ─── FAQ ───────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: "Do I need to pay to use AptRun as a student?",
    a: "No. Student accounts are free. If your college is on the platform, you'll get a login automatically — otherwise you can sign up yourself.",
  },
  {
    q: "Can I see which companies are visiting my campus?",
    a: "Yes. Every drive your placement cell publishes shows up in your dashboard with the company, role, CTC range and a live countdown. You can also see at a glance whether you're eligible.",
  },
  {
    q: "What happens if I'm not eligible for a drive?",
    a: "You'll see the exact reason — CGPA, backlog or branch — so you know what's holding you back. Eligible drives are clearly marked too.",
  },
  {
    q: "How does the talent pool work?",
    a: "You enter by scoring above the qualifying mark in a contest. Your profile only becomes visible to recruiters after you give consent, and you can hide it or decline interest at any time.",
  },
  {
    q: "Is my interview practice private?",
    a: "Yes. Mock interviews you take on your own are for your own practice and feedback. Only assessments and interviews your placement cell or a recruiter formally invites you to are shared with them.",
  },
  {
    q: "How many coding problems are in the arena?",
    a: "The catalog is fetched live from our backend. The number you see on the stats section of this page reflects the real, current count across all difficulty levels and topics.",
  },
];

// ─── Page component ────────────────────────────────────────────────────────────
export function StudentsPageContent() {
  const stats = usePublicStats();
  const { problems, loading: problemsLoading } = usePublicSampleProblems();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden pt-10 sm:pt-16 pb-20 sm:pb-28">
        <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
          <div className={cn("absolute inset-x-0 top-0 h-[560px] bg-gradient-to-b to-transparent", T.wash)} />
          <div className="lp-blob-a absolute -top-20 left-[4%] w-[500px] h-[400px] rounded-full bg-cyan-500/10 blur-[110px]" />
          <div className="lp-blob-b absolute top-10 right-[2%] w-[440px] h-[360px] rounded-full bg-sky-400/10 blur-[110px]" />
          <div className="absolute inset-0 bg-grid-pattern opacity-35 dark:opacity-20 [mask-image:radial-gradient(ellipse_65%_50%_at_50%_0%,black,transparent)]" />
        </div>

        <Container size="xl">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-10">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-primary">For Students</span>
          </nav>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <span className={cn("inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-6", T.pill)}>
                <GraduationCap className="w-3.5 h-3.5" /> For Students
              </span>

              <h1 className="text-[2.5rem] sm:text-5xl lg:text-[3.25rem] font-bold tracking-[-0.035em] text-primary leading-[1.05] mb-5 text-balance">
                Prepare for the company{" "}
                <span className="lp-gradient-text">visiting next week</span>
              </h1>

              <p className="text-base sm:text-lg font-medium text-text-secondary leading-relaxed max-w-xl mb-8">
                A personal learning centre, company-specific prep packs, a real coding arena and AI mock interviews — all tied to the actual drives your placement cell runs. Free for every student.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <ButtonLink href="/signup" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />} className="hp-btn-sheen justify-center">
                  Create Free Account
                </ButtonLink>
                <ButtonLink href="/pricing" variant="secondary" size="lg" className="justify-center">
                  See Pricing
                </ButtonLink>
              </div>

              <p className="text-sm text-text-secondary">
                <span className="font-semibold text-primary">No credit card.</span> Free to start — if your college is on the platform, your login is already waiting.
              </p>
            </div>

            {/* Right: student dashboard preview */}
            <div>
              <SpotlightCard className="rounded-panel bg-surface border border-border-strong shadow-[0_32px_80px_-30px_rgba(6,182,212,0.35)] overflow-hidden">
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", T.wash)} />

                {/* Header */}
                <div className="relative flex items-center justify-between px-5 py-3 border-b border-border-subtle bg-elevated/40">
                  <span className="text-2xs font-mono font-bold uppercase tracking-wider text-text-secondary">My Learning Centre</span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs font-bold text-text-secondary">Readiness</span>
                    <span className="text-2xs font-black font-mono text-cyan-700 dark:text-cyan-400">74%</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="relative px-5 pt-4 pb-2">
                  <div className="h-2 rounded-full bg-elevated overflow-hidden">
                    <div className={cn("h-full rounded-full bg-gradient-to-r", T.bar)} style={{ width: "74%" }} />
                  </div>
                </div>

                {/* Drive countdown */}
                <div className="relative mx-5 my-3 rounded-control border border-border-subtle bg-elevated/60 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-primary">Nova Systems</div>
                    <div className="text-2xs text-text-secondary">Software Engineer · Drive in 4 days</div>
                  </div>
                  <span className={cn("text-2xs font-mono font-black px-2.5 py-1 rounded-full border", T.pill)}>4d left</span>
                </div>

                {/* Modules */}
                <div className="relative px-5 pb-2">
                  <p className="text-2xs font-mono font-bold uppercase tracking-wider text-text-secondary mb-2.5">Your modules</p>
                  <div className="space-y-2">
                    {[
                      { label: "Speaking Practice", pct: 72, icon: Mic },
                      { label: "Listening Lab", pct: 64, icon: Headphones },
                      { label: "Vocabulary Sprint", pct: 88, icon: Sparkles },
                    ].map((m) => {
                      const MIcon = m.icon;
                      return (
                        <div key={m.label} className="flex items-center gap-3">
                          <span className={cn("w-7 h-7 rounded-control border flex items-center justify-center shrink-0", T.icon)}>
                            <MIcon className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-2xs font-semibold text-text-secondary w-28 shrink-0">{m.label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
                            <div className={cn("h-full rounded-full bg-gradient-to-r", T.bar)} style={{ width: `${m.pct}%` }} />
                          </div>
                          <span className="text-2xs font-bold font-mono text-primary w-8 text-right">{m.pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Arena stat */}
                <div className="relative px-5 py-4 mt-2 border-t border-border-subtle bg-elevated/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className={cn("w-4 h-4", T.text)} />
                    <span className="text-2xs font-semibold text-text-secondary">Practice problems available</span>
                  </div>
                  <span className="text-2xs font-black font-mono text-primary">
                    {stats ? stats.problems_total.toLocaleString() : "—"}
                  </span>
                </div>
                <p className="text-center text-2xs text-text-muted pb-3">Sample data — illustrative except live stats</p>
              </SpotlightCard>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Real platform stats ────────────────────────────────────────────── */}
      {stats && (
        <section className="py-14 sm:py-20 border-y border-border-subtle bg-surface/30">
          <Container size="xl">
            <p className="text-center text-xs font-mono font-bold uppercase tracking-wider text-text-secondary mb-8">
              The coding arena — real numbers, updated live
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Practice Problems", value: stats.problems_total, suffix: "", sub: `${stats.problems_easy} Easy · ${stats.problems_medium} Medium · ${stats.problems_hard} Hard` },
                { label: "DSA Topics", value: stats.topics_total, suffix: "", sub: "Arrays, graphs, DP, tries and more" },
                { label: "Real Test Cases", value: stats.test_cases_total, suffix: "+", sub: "Hidden cases — no simulated verdicts" },
                { label: "Languages", value: stats.languages_total, suffix: "", sub: "C++, Java, Python, Go, Rust, Kotlin…" },
              ].map((s) => (
                <SpotlightCard key={s.label} className={cn("relative rounded-2xl bg-surface border border-border-subtle p-5 flex flex-col group hover:-translate-y-1 transition-all duration-300 shadow-sm overflow-hidden", T.shadow)}>
                  <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-500 via-sky-400 to-transparent opacity-70" />
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

      {/* ── Capabilities grid ─────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-b border-border-subtle">
        <Container size="xl">
          <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              What's inside
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
              Everything you need to{" "}
              <span className="lp-gradient-text">land the job</span>
            </h2>
            <p className="mt-4 text-base sm:text-[1.0625rem] font-medium text-text-secondary leading-relaxed">
              Built around your campus drives — not generic interview prep.
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
              Deep dive
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
              Built for how students actually prepare
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
                  <SpotlightCard className="relative rounded-panel bg-surface border border-border-strong shadow-[0_24px_60px_-24px_rgba(6,182,212,0.3)] overflow-hidden">
                    <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", T.wash)} />
                    <Icon aria-hidden="true" className="absolute -right-6 -top-6 w-36 h-36 opacity-[0.06] text-cyan-500" strokeWidth={1.25} />
                    <div className="relative p-6 sm:p-8">
                      <div className={cn("w-12 h-12 rounded-control border flex items-center justify-center mb-5", T.icon)}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <p className="text-lg font-bold text-primary mb-3">{d.title}</p>
                      <ul className="space-y-2.5">
                        {d.points.map((pt) => (
                          <li key={pt} className="rounded-control bg-elevated/60 border border-border-subtle border-l-[3px] border-l-cyan-500 px-4 py-3 text-sm font-medium text-text-secondary leading-snug">
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

      {/* ── Live sample problems from backend ─────────────────────────────── */}
      <section className="py-20 sm:py-28 border-b border-border-subtle bg-surface/30">
        <Container size="xl">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              Practice arena
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl font-bold tracking-[-0.03em] text-primary text-balance">
              A sample from the live catalog
            </h2>
            <p className="mt-3 text-base font-medium text-text-secondary">
              These problems are fetched directly from the platform — the same catalog your students practise in.
            </p>
          </div>

          {problemsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-card border border-border-subtle h-28 animate-pulse bg-elevated" />
              ))}
            </div>
          ) : problems.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {problems.slice(0, 6).map((p) => (
                  <SpotlightCard key={p.slug} className={cn("relative rounded-card bg-surface border border-border-subtle p-5 overflow-hidden hover:-translate-y-1 hover:border-border-strong transition-all duration-300 shadow-sm", T.shadow)}>
                    <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent pointer-events-none", T.wash)} />
                    <div className="relative flex items-start justify-between gap-2 mb-3">
                      <span className="text-sm font-bold text-primary leading-snug flex-1">{p.title}</span>
                      <span className={cn("text-2xs font-bold px-2 py-0.5 rounded-full border shrink-0 capitalize", DIFFICULTY_STYLES[p.difficulty])}>
                        {p.difficulty}
                      </span>
                    </div>
                    <div className="relative flex flex-wrap gap-1.5">
                      {p.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className={cn("text-2xs font-semibold px-2 py-0.5 rounded-full border", T.pill)}>{tag}</span>
                      ))}
                    </div>
                  </SpotlightCard>
                ))}
              </div>
              <div className="text-center mt-8">
                <ButtonLink href="/signup" variant="secondary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  {stats ? `Practise all ${stats.problems_total} problems` : "Practise the full catalog"}
                </ButtonLink>
              </div>
            </>
          ) : (
            <p className="text-center text-text-secondary text-sm">Problem catalog loading…</p>
          )}
        </Container>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="relative py-20 sm:py-28 bg-surface/20 border-b border-border-subtle overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 bg-dot-pattern opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_30%,black,transparent)] pointer-events-none" />
        <Container size="xl" className="relative">
          <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
            <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border inline-block mb-4", T.pill)}>
              Getting started
            </span>
            <h2 className="text-[1.75rem] sm:text-3xl md:text-4xl font-bold tracking-[-0.03em] text-primary leading-[1.12] text-balance">
              From signup to{" "}
              <span className="lp-gradient-text">placement-ready</span>
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

      {/* ── Privacy note: talent pool ──────────────────────────────────────── */}
      <section className="py-16 sm:py-20 border-b border-border-subtle">
        <Container size="md">
          <SpotlightCard className={cn("relative rounded-panel bg-surface border border-border-subtle p-8 sm:p-10 overflow-hidden", T.shadow)}>
            <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", T.wash)} />
            <div className="relative flex flex-col sm:flex-row items-start gap-6">
              <div className={cn("w-14 h-14 rounded-control border flex items-center justify-center shrink-0", T.icon)}>
                <EyeOff className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary mb-2">Your visibility, your choice</h3>
                <p className="text-base font-medium text-text-secondary leading-relaxed mb-4">
                  The talent pool is fully opt-in. Your profile only becomes visible to hiring partners after you give explicit consent — and you can withdraw it, or decline interest from any company, at any time.
                </p>
                <ul className="space-y-2">
                  {["Enter by earning a qualifying score in a contest", "Invisible until you say yes — no silent sharing", "Withdraw from the pool whenever you like", "Decline interest from any company"].map((pt) => (
                    <li key={pt} className="flex items-center gap-2.5 text-sm font-medium text-text-secondary">
                      <span className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0", T.icon)}>
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      </span>
                      {pt}
                    </li>
                  ))}
                </ul>
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
            <h2 className="text-[1.75rem] sm:text-3xl font-bold tracking-[-0.03em] text-primary">Questions from students</h2>
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

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <Container size="lg">
          <div className="lp-gborder relative rounded-panel bg-surface border border-accent-primary/20 p-8 sm:p-14 text-center overflow-hidden shadow-[0_32px_80px_-30px_rgba(6,182,212,0.4)]">
            <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent", T.wash)} />
            <div aria-hidden="true" className="absolute inset-0 bg-grid-pattern opacity-25 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)] pointer-events-none" />
            <div className="relative max-w-2xl mx-auto">
              <span className={cn("inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-6", T.pill)}>
                <GraduationCap className="w-3.5 h-3.5" /> Start today
              </span>
              <h2 className="text-[1.75rem] sm:text-4xl font-bold tracking-[-0.03em] text-primary mb-3 text-balance">
                Start preparing today — it&apos;s free
              </h2>
              <p className="text-base sm:text-[1.0625rem] font-medium text-text-secondary mb-8">
                Create your student account and open your learning centre. If your college is already on the platform, your login is waiting.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <ButtonLink href="/signup" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />} className="hp-btn-sheen justify-center">
                  Create Free Account
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" size="lg" className="justify-center">
                  Sign In
                </ButtonLink>
              </div>
              <p className="mt-6 text-sm text-text-secondary">No credit card · Free for students · Login sent by your college</p>
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
              { href: "/colleges", label: "For Colleges", desc: "Placement cell command center — drives, analytics, onboarding.", icon: Building2, tone: "text-indigo-600 dark:text-indigo-400", shadow: "hover:shadow-[0_24px_48px_-20px_rgba(99,102,241,0.45)]" },
              { href: "/recruiters", label: "For Recruiters", desc: "Post openings, screen with assessments, search the talent pool.", icon: Briefcase, tone: "text-violet-600 dark:text-violet-400", shadow: "hover:shadow-[0_24px_48px_-20px_rgba(139,92,246,0.45)]" },
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
    </>
  );
}

