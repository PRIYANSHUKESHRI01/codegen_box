"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  Code2,
  Gauge,
  GraduationCap,
  LockOpen,
  Mic,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { CtaBand, CrossLinks } from "@/components/landing/CtaBand";
import { LearningGrid } from "@/components/landing/AudienceShowcase";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { FeatureCards, type FeatureCard } from "@/components/landing/FeatureCards";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { PageIntro } from "@/components/landing/PageIntro";
import { Reveal } from "@/components/landing/Reveal";
import { SectionIntro } from "@/components/landing/SectionIntro";
import { ReadinessCard, RewardsCard, TonightCard } from "@/components/landing/StageCards";
import { StepsRow } from "@/components/landing/StepsRow";
import type { FaqItem } from "@/data/landing";
import { formatInr } from "@/lib/pricing";
import { landingFacts, useLandingData } from "@/lib/useLandingData";

const FEATURES: FeatureCard[] = [
  { icon: Code2, tone: "indigo", badge: "Practice", title: "The Practice Arena", body: "Solve problems in your own language and get judged on hidden test cases, with a streak and a rating that grow as you do.", href: "/features/practice-arena" },
  { icon: Mic, tone: "violet", badge: "AI interviews", title: "Mock interviews you can speak", body: "Role-based interviews scored as you go, with written feedback on every answer. Practise as often as your plan allows.", href: "/features/ai-interviews" },
  { icon: BookOpenCheck, tone: "amber", badge: "Company prep", title: "Prepare for the company in front of you", body: "An overview, the hiring process and past questions for every recruiter that visits your campus, with a live countdown to the drive.", href: "/features/company-prep" },
  { icon: Brain, tone: "cyan", badge: "Learning centre", title: "Speaking, listening and soft skills", body: "Short daily exercises in speaking, listening and vocabulary, plus soft-skills assessments that feed your readiness score.", href: "/features/learning-centre" },
  { icon: Swords, tone: "rose", badge: "Contests", title: "A rated contest every night", body: "Compete against every student at the same time on the same problems. Your rating moves with how you place.", href: "/rewards", cta: "See the rewards" },
  { icon: LockOpen, tone: "emerald", badge: "Mellow Vault", title: "A way to be found", body: "Reach the readiness bar and employers on Mellow Vault can find you, while you decide who sees what.", href: "/vault", cta: "How the Vault works" },
];

const FAQS: FaqItem[] = [
  { q: "Do I need to pay to use AptRun as a student?", a: "No. Student accounts are free to start. If your college is on the platform you get a login automatically; otherwise you can sign up yourself." },
  { q: "Can I see which companies are visiting my campus?", a: "Yes. Every drive your placement cell publishes shows up in your dashboard with the company, role, CTC range and a live countdown, and whether you are eligible." },
  { q: "What happens if I'm not eligible for a drive?", a: "You see the exact reason (CGPA, backlog or branch) so you know what is holding you back. Eligible drives are clearly marked too." },
  { q: "How does the Vault work?", a: "You become eligible when your readiness score, one score for everything you do on AptRun, reaches the bar. Your profile is visible to recruiters, and to employers on Mellow Vault, only after you give consent, and you can hide it or decline interest at any time. Getting hired directly through Mellow Vault is part of the Expert plan: if you reach the bar on another plan your standing is kept and you can join the day you upgrade." },
  { q: "Is my interview practice private?", a: "Yes. Mock interviews you take on your own are for your own practice and feedback. Only assessments and interviews that your placement cell or a recruiter formally invites you to are shared with them." },
];

/**
 * /students — the student's page. The same promise as the landing page's student side, told at length: what you get (with the real
 * counts), what a day looks like, the six tools, and where it leads (the weekly vouchers and Mellow Vault each have their own page).
 * Everything with a number or a date is the backend's.
 */
export function StudentsPageContent() {
  const { data, status, refresh } = useLandingData();
  const facts = landingFacts(data);
  const rewards = data?.rewards ?? null;
  const top = rewards?.live ? rewards.prizes[0] : null;

  const day = [
    { icon: Code2, when: "Morning", title: "Solve a problem", body: "Open the Practice Arena and solve one. Your streak and your rating start moving." },
    { icon: Mic, when: "Afternoon", title: "Sharpen your interview", body: "Take an AI mock interview or a soft-skills exercise and read the feedback." },
    { icon: Trophy, when: facts.dailyTime, title: "Compete live", body: `The AptRun Daily Challenge: ${facts.dailyProblems} problems, ${facts.dailyMinutes} minutes, the same clock for everyone.` },
    { icon: Gauge, when: "Always", title: "Watch your readiness climb", body: `Everything you do feeds one score. Cross ${facts.vaultBar}% and Mellow Vault opens.` },
  ];

  return (
    <>
      <PageIntro
        crumb="For students"
        eyebrow={{ icon: GraduationCap, label: "For students" }}
        title={
          <>
            Get placement-ready. <span className="lp-gradient-text">Win rewards. Get found.</span>
          </>
        }
        description="A personal learning centre, a rated contest every night and a path to the employers on Mellow Vault. Free to start for every student."
        actions={
          <>
            <ButtonLink href="/signup" variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />} className="hp-btn-sheen min-h-[48px] justify-center font-semibold">
              Create student account
            </ButtonLink>
            <ButtonLink href="/rewards" variant="secondary" size="lg" leftIcon={<Trophy className="h-4 w-4 text-accent-primary" />} className="min-h-[48px] justify-center font-semibold">
              See the rewards
            </ButtonLink>
          </>
        }
        note={<span>No card needed. Students of a partner college are onboarded by their placement cell, so a login may already be waiting for you.</span>}
        visual={
          <div className="space-y-4">
            <TonightCard contest={data?.contest ?? null} status={status} facts={facts} onDone={refresh} />
            <div className="grid gap-4 sm:grid-cols-2">
              <RewardsCard rewards={rewards} status={status} resets={facts.weekResets} onDone={refresh} />
              <ReadinessCard bar={facts.vaultBar} />
            </div>
          </div>
        }
      />

      <section aria-labelledby="learn-heading" className="border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="learn-heading" eyebrow="Your learning centre" title="Your whole preparation," highlight="in one place" description="Coding, interviews, company prep and soft skills, so you always know what to do next." />
          <Reveal>
            <SpotlightCard className="lp-gborder relative mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-border-subtle bg-surface p-4 shadow-[0_30px_70px_-34px_rgba(79,70,229,0.5)] sm:p-6">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-500/[0.14] to-transparent" />
              <div className="relative">
                <LearningGrid depth={data?.stats?.depth} facts={facts} />
              </div>
            </SpotlightCard>
          </Reveal>
        </Container>
      </section>

      <section aria-labelledby="day-heading" className="py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="day-heading" eyebrow="A day on AptRun" title="Small steps, every day," highlight="one big score" />
          <StepsRow steps={day} />
        </Container>
      </section>

      <section aria-labelledby="tools-heading" className="border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="tools-heading" eyebrow="The tools" title="Six ways to get" highlight="placement-ready" />
          <FeatureCards items={FEATURES} />
        </Container>
      </section>

      <section aria-labelledby="next-heading" className="py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="next-heading" eyebrow="Where it leads" title="Something to play for." highlight="Somewhere to go." />
          <div className="grid gap-5 lg:grid-cols-2">
            <Reveal className="h-full">
              <Link
                href="/rewards"
                className="group relative flex h-full flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1b1140] via-[#3b1d8f] to-[#6d28d9] p-7 text-white shadow-[0_34px_80px_-34px_rgba(109,40,217,0.8)] transition-transform duration-500 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary sm:p-8"
              >
                <div aria-hidden="true" className="lp-blob-a absolute -right-12 -top-16 h-60 w-60 rounded-full bg-amber-300/25 blur-3xl" />
                <span className="relative mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider text-amber-200">
                  <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                  Weekly rewards
                </span>
                <h3 className="relative text-2xl font-bold leading-tight tracking-[-0.02em] sm:text-[1.9rem]">Top the leaderboard. Win a voucher.</h3>
                <p className="relative mt-3 max-w-md text-base font-medium leading-relaxed text-violet-100/90">
                  {top ? `This week the top of the board wins a ${top.brand} ${formatInr(top.amount)} voucher.` : "Every week the top of the board earns gift vouchers from brands students already use."}
                </p>
                <span className="relative mt-auto inline-flex items-center gap-1.5 pt-8 text-sm font-bold text-amber-200">
                  See how the rewards work <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
            <Reveal delay={0.1} className="h-full">
              <Link
                href="/vault"
                className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0a1024] p-7 text-white shadow-[0_34px_80px_-34px_rgba(10,16,36,0.95)] transition-transform duration-500 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary sm:p-8"
              >
                <div aria-hidden="true" className="lp-blob-b absolute -right-10 bottom-[-20%] h-60 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
                <span className="relative mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Mellow Vault · Get hired
                </span>
                <h3 className="relative text-2xl font-bold leading-tight tracking-[-0.02em] sm:text-[1.9rem]">Reach {facts.vaultBar}%. Get found.</h3>
                <p className="relative mt-3 max-w-md text-base font-medium leading-relaxed text-slate-300">
                  Cross the readiness bar and employers on Mellow Vault can find and invite you, while you stay in charge of who sees what.
                </p>
                <span className="relative mt-auto inline-flex items-center gap-1.5 pt-8 text-sm font-bold text-emerald-300">
                  See how the Vault works <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          </div>
        </Container>
      </section>

      <LandingPricing />

      <section aria-labelledby="faq-heading" className="border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
        <Container size="md">
          <SectionIntro id="faq-heading" eyebrow="FAQ" title="Questions from" highlight="students" />
          <FaqAccordion items={FAQS} />
        </Container>
      </section>

      <CtaBand
        badge="Join free"
        title="Start your first problem"
        highlight="tonight."
        description="Create a free student account, register for the nightly contest and watch one score climb."
        primary={{ label: "Create student account", href: "/signup" }}
        secondary={{ label: "See the rewards", href: "/rewards" }}
        points={["Free to start", "Rated contest every night", "Opt-in Vault"]}
      />
      <CrossLinks
        items={[
          { href: "/rewards", label: "Weekly rewards", body: "The leaderboard, the vouchers and the rules they run on." },
          { href: "/vault", label: "Mellow Vault", body: "How reaching the bar puts you in front of employers." },
          { href: "/colleges", label: "For colleges", body: "How your placement cell runs the season." },
        ]}
      />
    </>
  );
}
