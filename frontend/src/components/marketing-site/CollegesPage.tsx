"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  BookOpenCheck,
  Briefcase,
  Building2,
  Check,
  Layers,
  Mail,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { TONES, type Tone } from "@/components/ui/tones";
import { CtaBand, CrossLinks } from "@/components/landing/CtaBand";
import { DEPARTMENT_ICONS, FALLBACK_DEPARTMENTS, toneOf } from "@/components/landing/AudienceShowcase";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { FeatureCards, type FeatureCard } from "@/components/landing/FeatureCards";
import { PageIntro } from "@/components/landing/PageIntro";
import { ProofBand } from "@/components/landing/ProofBand";
import { Reveal } from "@/components/landing/Reveal";
import { SectionIntro } from "@/components/landing/SectionIntro";
import { StepsRow } from "@/components/landing/StepsRow";
import { CampusCard } from "@/components/landing/StageCards";
import { TrustStrip } from "@/components/landing/TrustStrip";
import type { FaqItem } from "@/data/landing";
import { cn } from "@/lib/utils";
import { useLandingData } from "@/lib/useLandingData";

/** The work a placement cell does by hand today, and what it becomes. */
const SHIFTS = [
  { before: "Five spreadsheets for eligibility, applications and offers", after: "One dashboard: every drive, every student, every outcome" },
  { before: "Bulk emails sent by hand from Gmail", after: "Email and WhatsApp notifications dispatched in one click" },
  { before: "Student onboarding takes a whole week", after: "Upload one CSV; accounts and logins go out the same day" },
  { before: "Readiness reports built from guesswork", after: "Branch-wise analytics built from what students actually do" },
] as const;

const CAPABILITIES: FeatureCard[] = [
  { icon: Briefcase, tone: "indigo", badge: "Placement cell", title: "Campus drive management", body: "Map recruiters, set CGPA, backlog and branch eligibility, publish drives and track every application to a final offer, from one screen.", href: "/features/campus-drives" },
  { icon: Upload, tone: "cyan", badge: "Batch import", title: "Student onboarding", body: "Upload one CSV. Accounts are created in the background and every student gets a welcome email with their login.", href: "/features/student-onboarding" },
  { icon: BarChart3, tone: "violet", badge: "Reports", title: "Readiness analytics", body: "Branch-wise readiness, placement funnels and package distributions, built from real student activity and exportable as PDF, Excel or CSV.", href: "/features/placement-analytics" },
  { icon: ShieldCheck, tone: "emerald", badge: "Proctoring", title: "Proctored assessments", body: "Fullscreen enforcement, tab-switch detection and strike-based lockouts keep every mock contest score fair and defensible.", href: "/features/proctored-assessments" },
  { icon: Bot, tone: "amber", badge: "AI interviews", title: "Mock and screening interviews", body: "Role-based tracks scored instantly with written feedback. Schedule them for a whole cohort and open any score to human review.", href: "/features/ai-interviews" },
  { icon: BookOpenCheck, tone: "rose", badge: "Company prep", title: "Company prep packs", body: "An overview, the hiring process and past questions for every recruiter visiting campus, so students prepare for the drive in front of them.", href: "/features/company-prep" },
];

/** Three things a TPO asks for, shown as the shortest list that proves each one. */
const DETAILS: { icon: typeof SlidersHorizontal; tone: Tone; badge: string; title: string; body: string; points: string[] }[] = [
  {
    icon: SlidersHorizontal,
    tone: "indigo",
    badge: "Eligibility rules",
    title: "Stop chasing eligibility by hand",
    body: "Set a minimum CGPA, backlog limit and eligible branches once per drive. Every student is checked instantly, and those who fall short see the exact reason.",
    points: ["CGPA, backlog and branch filters in one panel", "Per-student ineligibility reason, per drive", "Eligibility reports exportable for every drive"],
  },
  {
    icon: Mail,
    tone: "cyan",
    badge: "Notifications",
    title: "Reach every student from the dashboard",
    body: "Send bulk email or WhatsApp messages to eligible students, or to their parents. Drives carry a live countdown, so students always know how long they have to prepare.",
    points: ["Bulk email and WhatsApp in one click", "Targeted to eligible students or everyone", "A live drive countdown on every student's dashboard"],
  },
  {
    icon: Layers,
    tone: "violet",
    badge: "Section coordinators",
    title: "Give each section its own coordinator",
    body: "Coordinators get a focused dashboard: their roster, their proctoring view and their own reports, with no access to other sections.",
    points: ["A dedicated dashboard per section", "Proctoring and reports scoped to their students", "Add coordinators from the TPO panel in seconds"],
  },
];

const STEPS = [
  { icon: Building2, title: "We set up your campus", body: "Our team onboards your college, creates your placement cell account and configures your section coordinators." },
  { icon: Upload, title: "Import your batch", body: "Upload one CSV. Accounts, logins and welcome emails are sent automatically, with nothing for your team to do by hand." },
  { icon: Briefcase, title: "Map recruiters and run drives", body: "Add companies, set eligibility rules, publish drives and notify eligible students in minutes rather than days." },
  { icon: BarChart3, title: "Report to management", body: "Export board-ready PDF summaries, branch-wise Excel sheets and drive eligibility reports at any time." },
];

const FAQS: FaqItem[] = [
  { q: "How long does it take to get started?", a: "Our team sets up your college account. From there, importing a batch of 500 students takes about 10 minutes: you upload the CSV, we handle the rest." },
  { q: "Do students need to create their own accounts?", a: "No. When you bulk-import a batch, each student gets an account and a welcome email with their login details automatically." },
  { q: "Can different branches have different eligibility for the same drive?", a: "Yes. You set branch, CGPA and backlog rules per drive. Students who do not meet them are flagged with the exact reason." },
  { q: "What reports can I give to management?", a: "Board-ready PDF summaries, branch-wise readiness tables, placement funnels, package distributions and full student rosters, all exportable as PDF, Excel or CSV." },
  { q: "Is proctoring only for actual drives, or can we use it for mock tests?", a: "You can run proctored mock contests for your cohort at any time: before a real drive, mid-semester, or as practice. Results and violations are visible to you and to section coordinators." },
  { q: "Does it work for departments other than engineering?", a: "Yes. Management, Commerce and Arts and Humanities each get their own preparation paths, and you can report by department, branch or year." },
];

/**
 * /colleges — the buyer's page. The promise, proof that there is substance (numbers from the backend), the before and after, the six
 * things a placement cell uses every day, how the season runs, and the questions a TPO asks before booking a demo. The departments
 * and the platform's numbers come from GET /public/landing; the console beside the headline is a sketch with no figures in it.
 */
export function CollegesPageContent() {
  const [demoOpen, setDemoOpen] = useState(false);
  const { data, status } = useLandingData();
  const departments = data?.departments.length ? data.departments : status === "error" ? FALLBACK_DEPARTMENTS : [];

  return (
    <>
      <PageIntro
        crumb="For colleges"
        eyebrow={{ icon: Building2, label: "For colleges & placement cells" }}
        title={
          <>
            Run your entire placement season <span className="lp-gradient-text">from one dashboard</span>
          </>
        }
        description="Map every recruiter, onboard a whole batch from one CSV, set eligibility rules that apply themselves, and hand management the reports they ask for, all without five spreadsheets."
        actions={
          <>
            <Button variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => setDemoOpen(true)} className="hp-btn-sheen min-h-[48px] justify-center font-semibold">
              Book a demo
            </Button>
            <ButtonLink href="/pricing" variant="secondary" size="lg" className="min-h-[48px] justify-center font-semibold">
              See pricing
            </ButtonLink>
          </>
        }
        note={
          <span>
            <strong className="font-bold text-primary">No IT setup required.</strong> Our team onboards your college, and you are up and running within one business day.
          </span>
        }
        visual={<CampusCard departments={data?.departments ?? []} loaded={status !== "loading"} />}
      />

      <ProofBand />

      <section aria-labelledby="shift-heading" className="py-16 sm:py-24">
        <Container size="lg">
          <SectionIntro id="shift-heading" eyebrow="The difference" title="What your placement season looks like" highlight="with AptRun" />
          <div className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-[0_24px_60px_-34px_rgba(79,70,229,0.4)]">
            <div className="hidden grid-cols-2 gap-8 border-b border-border-subtle bg-elevated/60 px-6 py-3 text-2xs font-mono font-bold uppercase tracking-wider sm:grid">
              <span className="pl-8 text-status-danger">Today</span>
              <span className="pl-8 text-status-success">With AptRun</span>
            </div>
            <ul className="divide-y divide-border-subtle">
              {SHIFTS.map((s, i) => (
                <li key={s.before}>
                  <Reveal delay={i * 0.06}>
                    <div className="grid gap-3 px-5 py-5 transition-colors duration-200 hover:bg-elevated/40 sm:grid-cols-2 sm:gap-8 sm:px-6">
                      <p className="flex items-start gap-3 text-sm font-medium leading-relaxed text-text-secondary">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-danger/10 text-status-danger">
                          <X className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                        </span>
                        <span className="sm:line-through sm:decoration-text-muted/50">{s.before}</span>
                      </p>
                      <p className="flex items-start gap-3 text-sm font-semibold leading-relaxed text-primary">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-success/15 text-status-success">
                          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                        </span>
                        {s.after}
                      </p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section aria-labelledby="caps-heading" className="border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="caps-heading" eyebrow="The platform" title="Everything your placement cell" highlight="actually needs" description="One platform instead of five tools and a spreadsheet." />
          <FeatureCards items={CAPABILITIES} />
        </Container>
      </section>

      <section aria-labelledby="details-heading" className="py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="details-heading" eyebrow="Built for the TPO" title="Built around how TPOs" highlight="actually work" />
          <ul className="grid gap-5 lg:grid-cols-3">
            {DETAILS.map((d, i) => {
              const t = TONES[d.tone];
              const DetailIcon = d.icon;
              return (
                <li key={d.title}>
                  <Reveal delay={i * 0.08} className="h-full">
                    <div className={cn("group relative h-full overflow-hidden rounded-card border border-border-subtle bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-border-strong sm:p-7", t.shadow)}>
                      <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", t.wash)} />
                      <span className={cn("relative mb-4 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-2xs font-mono font-bold uppercase tracking-wider", t.pill)}>
                        <DetailIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {d.badge}
                      </span>
                      <h3 className="relative text-lg font-bold leading-snug tracking-[-0.01em] text-primary">{d.title}</h3>
                      <p className="relative mt-2 text-sm font-medium leading-relaxed text-text-secondary">{d.body}</p>
                      <ul className="relative mt-5 space-y-2.5 border-t border-border-subtle pt-5">
                        {d.points.map((p) => (
                          <li key={p} className="flex items-start gap-2.5 text-sm font-medium leading-snug text-text-secondary">
                            <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", t.icon)}>
                              <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                            </span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="steps-heading" className="border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="steps-heading" eyebrow="How it works" title="From first call to" highlight="first drive" description="Four steps, and the first one is ours." />
          <StepsRow steps={STEPS} />
        </Container>
      </section>

      <section aria-labelledby="depts-heading" className="py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="depts-heading" eyebrow="Every department" title="Not just engineering." highlight="Every programme." description="Engineering, Management, Commerce and Arts each get their own preparation paths, and you report by department, branch or year." />
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {departments.length === 0
              ? Array.from({ length: 4 }, (_, i) => <li key={i} aria-hidden="true" className="h-44 animate-pulse rounded-card border border-border-subtle bg-surface/70" />)
              : departments.map((d, i) => {
                  const t = TONES[toneOf(d.accent)];
                  const DeptIcon = DEPARTMENT_ICONS[d.icon] ?? Building2;
                  return (
                    <li key={d.code}>
                      <Reveal delay={i * 0.07} className="h-full">
                        <div className={cn("group relative h-full overflow-hidden rounded-card border border-border-subtle bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-border-strong", t.shadow)}>
                          <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", t.wash)} />
                          <span className={cn("relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300", t.icon, t.iconHover)}>
                            <DeptIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                          <h3 className="relative text-base font-bold text-primary">{d.short}</h3>
                          <p className="relative mt-1.5 text-sm font-medium leading-relaxed text-text-secondary">{d.description}</p>
                          {d.disciplines > 0 && <p className={cn("relative mt-3 text-2xs font-bold", t.text)}>{d.disciplines} programme families</p>}
                        </div>
                      </Reveal>
                    </li>
                  );
                })}
          </ul>
        </Container>
      </section>

      <div className="border-t border-border-subtle">
        <TrustStrip />
      </div>

      <section aria-labelledby="faq-heading" className="border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
        <Container size="md">
          <SectionIntro id="faq-heading" eyebrow="FAQ" title="Questions from" highlight="placement cells" />
          <FaqAccordion items={FAQS} />
        </Container>
      </section>

      <CtaBand
        title="Bring your next placement season"
        highlight="onto one platform."
        description="Tell us about your campus and our team replies within one business day with a demo and a plan scoped to you."
        primary={{ label: "Book a demo", demo: true }}
        secondary={{ label: "See pricing", href: "/pricing" }}
        points={["Set up by our team", "Logins sent for you", "Employers already hiring on Mellow Vault"]}
      />
      <CrossLinks
        items={[
          { href: "/students", label: "For students", body: "What your students get from the first login." },
          { href: "/rewards", label: "Weekly rewards", body: "The nightly contest and the vouchers that keep practice going." },
          { href: "/vault", label: "Mellow Vault", body: "How a student's readiness reaches the employers on Mellow Vault." },
        ]}
      />

      <TalkToTeamModal key={demoOpen ? "open" : "closed"} open={demoOpen} onClose={() => setDemoOpen(false)} defaultAudience="institution" />
    </>
  );
}
