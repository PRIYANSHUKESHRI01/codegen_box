"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  type LucideIcon,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  Code2,
  Cpu,
  FileSpreadsheet,
  Gauge,
  GraduationCap,
  Landmark,
  LockOpen,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  Swords,
  Trophy,
} from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { TONES, type Tone } from "@/components/ui/tones";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";
import { landingFacts, useLandingData } from "@/lib/useLandingData";
import type { LandingDepartment, LandingDepth } from "@/types/landing";

type Audience = "colleges" | "students";
type Icon = LucideIcon;

interface Point {
  icon: Icon;
  title: string;
  body: string;
}

const TABS: { id: Audience; label: string; short: string; icon: Icon }[] = [
  { id: "colleges", label: "For placement cells", short: "Placement cells", icon: Building2 },
  { id: "students", label: "For students", short: "Students", icon: GraduationCap },
];

const COLLEGE_POINTS: Point[] = [
  { icon: FileSpreadsheet, title: "Onboard a batch in minutes", body: "Upload one CSV and every student gets a login by email, automatically." },
  { icon: SlidersHorizontal, title: "Drives with real eligibility", body: "Map recruiters and set CGPA, backlog and branch rules for each drive." },
  { icon: ShieldCheck, title: "Proctored, defensible scores", body: "Fullscreen, tab-switch detection and automatic lockouts on every mock." },
  { icon: BarChart3, title: "Readiness, by branch and year", body: "One score per student, rolled up for your cell and exportable as a report." },
];

export const DEPARTMENT_ICONS: Record<string, Icon> = { cpu: Cpu, briefcase: Briefcase, calculator: Calculator, landmark: Landmark };

/** Only shown when the backend cannot be reached at all: the four departments the platform ships with, in plain words. */
export const FALLBACK_DEPARTMENTS: LandingDepartment[] = [
  { code: "engineering", name: "Engineering & Technology", short: "Engineering", description: "CSE, IT, ECE, EEE, Mechanical, Civil and more.", accent: "indigo", icon: "cpu", disciplines: 0 },
  { code: "management", name: "Management", short: "Management", description: "BBA, MBA and allied programmes.", accent: "violet", icon: "briefcase", disciplines: 0 },
  { code: "commerce", name: "Commerce", short: "Commerce", description: "B.Com, M.Com and accounting programmes.", accent: "emerald", icon: "calculator", disciplines: 0 },
  { code: "arts", name: "Arts & Humanities", short: "Arts & Humanities", description: "Humanities and social-science programmes.", accent: "rose", icon: "landmark", disciplines: 0 },
];

export const toneOf = (accent: string): Tone => (accent in TONES ? (accent as Tone) : "indigo");

/**
 * "Two doors" in one block, instead of four sections: the placement cell's story and the student's, switched by a tab. Each side is the
 * same shape (a promise, four short points, one call to action) with a visual built from real backend numbers: the departments a campus
 * can run on one side, and what a student gets to practise on the other.
 *
 * The tabs are real anchors for #colleges and #students, so a link from another page (or the footer) opens the right side.
 */
export function AudienceShowcase() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Audience>("colleges");
  const [demoOpen, setDemoOpen] = useState(false);

  // Open the side a link asks for: /#students lands on the students' tab, and so does a hash change on the page.
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace("#", "");
      if (h === "students" || h === "colleges") setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next: Audience = e.key === "ArrowLeft" || e.key === "Home" ? "colleges" : "students";
    setTab(next);
    document.getElementById(next)?.focus();
  };

  return (
    <section id="platform" aria-labelledby="platform-heading" className="scroll-mt-16 py-16 sm:py-24">
      <Container size="xl">
        <Reveal className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider text-accent-primary">
            The platform
          </span>
          <h2 id="platform-heading" className="text-balance text-[1.75rem] font-bold leading-[1.12] tracking-[-0.03em] text-primary sm:text-4xl lg:text-[2.6rem]">
            One platform for your campus{" "}
            <span className="bg-gradient-to-r from-accent-primary via-indigo-400 to-accent-secondary bg-clip-text text-transparent">and every student in it</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-base font-medium leading-relaxed text-text-secondary sm:text-[1.0625rem]">
            Your placement cell runs the season. Each student gets a personal learning centre, weekly rewards and a way to be found by employers.
          </p>
        </Reveal>

        <div className="mb-8 flex justify-center sm:mb-10">
          <div role="tablist" aria-label="Choose your side" className="relative grid w-full max-w-md grid-cols-2 rounded-2xl border border-border-strong bg-surface p-1 shadow-subtle">
            {TABS.map(({ id, label, short, icon: TabIcon }) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  id={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="audience-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(id)}
                  onKeyDown={onKeyDown}
                  className={cn(
                    "relative z-10 flex scroll-mt-28 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                    selected ? "text-white" : "text-text-secondary hover:text-primary"
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId="audience-pill"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-accent-primary to-indigo-500 shadow-[0_10px_24px_-10px_rgb(var(--accent-primary-rgb)/0.8)]"
                    />
                  )}
                  <TabIcon className="h-4 w-4" aria-hidden="true" />
                  <span className="truncate sm:hidden">{short}</span>
                  <span className="hidden truncate sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div id="audience-panel" role="tabpanel" aria-labelledby={tab}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              {tab === "colleges" ? <CollegePanel onDemo={() => setDemoOpen(true)} /> : <StudentPanel />}
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>

      <TalkToTeamModal key={demoOpen ? "open" : "closed"} open={demoOpen} onClose={() => setDemoOpen(false)} defaultAudience="institution" />
    </section>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function PointList({ points, tone }: { points: Point[]; tone: Tone }) {
  const t = TONES[tone];

  return (
    <ul className="space-y-1">
      {points.map(({ icon: PointIcon, title, body }, i) => (
        <motion.li
          key={title}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.08 + i * 0.07, ease: "easeOut" }}
          className="group flex items-start gap-4 rounded-2xl p-3 transition-colors duration-200 hover:bg-surface"
        >
          <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-105", t.icon, t.iconHover)}>
            <PointIcon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-15 font-bold leading-snug text-primary">{title}</span>
            <span className="mt-0.5 block text-sm font-medium leading-relaxed text-text-secondary">{body}</span>
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

function PanelShell({ tone, eyebrow, title, lead, points, actions, visual }: { tone: Tone; eyebrow: string; title: string; lead: string; points: Point[]; actions: React.ReactNode; visual: React.ReactNode }) {
  const t = TONES[tone];

  return (
    <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-5">
        <span className={cn("mb-4 inline-flex rounded-full border px-2.5 py-1 text-2xs font-mono font-bold uppercase tracking-wider", t.pill)}>{eyebrow}</span>
        <h3 className="text-balance text-2xl font-bold leading-tight tracking-[-0.02em] text-primary sm:text-[1.9rem]">{title}</h3>
        <p className="mt-3 text-base font-medium leading-relaxed text-text-secondary">{lead}</p>
        <div className="mt-6">
          <PointList points={points} tone={tone} />
        </div>
        <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">{actions}</div>
      </div>

      <div className="lg:col-span-7">
        <SpotlightCard
          className={cn(
            "lp-gborder relative overflow-hidden rounded-[28px] border border-border-subtle bg-surface p-4 shadow-[0_30px_70px_-34px_rgba(79,70,229,0.5)] sm:p-6",
            t.shadow
          )}
        >
          <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent", t.wash)} />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_70%_60%_at_100%_0%,black,transparent)]" />
          <div className="relative">{visual}</div>
        </SpotlightCard>
      </div>
    </div>
  );
}

/* --------------------------------------- colleges --------------------------------------------- */

function CollegePanel({ onDemo }: { onDemo: () => void }) {
  const { data, status } = useLandingData();
  const departments = data?.departments.length ? data.departments : status === "error" ? FALLBACK_DEPARTMENTS : [];
  const depth = data?.stats?.depth;

  return (
    <PanelShell
      tone="indigo"
      eyebrow="Built for the TPO"
      title="Run the whole placement season from one dashboard"
      lead="Everything a TPO manages, from the first recruiter to the last offer letter, without five spreadsheets."
      points={COLLEGE_POINTS}
      actions={
        <>
          <Button variant="primary" size="lg" className="hp-btn-sheen" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={onDemo}>
            Book a demo
          </Button>
          <Link href="/colleges" className="inline-flex items-center justify-center gap-1 text-sm font-bold text-accent-primary underline-offset-4 hover:underline">
            Explore for colleges <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </>
      }
      visual={
        <div>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">Every department, one setup</p>
              <p className="mt-0.5 text-lg font-bold tracking-tight text-primary">Not just engineering</p>
            </div>
            {depth && (
              <p className="text-right text-2xs font-semibold text-text-secondary">
                {depth.departments} departments
                <br />
                {depth.branches} branches
              </p>
            )}
          </div>

          <ul className="grid grid-cols-2 gap-3">
            {departments.length === 0
              ? Array.from({ length: 4 }, (_, i) => <li key={i} aria-hidden="true" className="h-32 animate-pulse rounded-2xl border border-border-subtle bg-elevated/60" />)
              : departments.map((d, i) => {
                  const tone = TONES[toneOf(d.accent)];
                  const DeptIcon = DEPARTMENT_ICONS[d.icon] ?? Building2;
                  return (
                    <motion.li
                      key={d.code}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: 0.1 + i * 0.08, ease: "easeOut" }}
                      className={cn("group rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-subtle transition-all duration-300 hover:-translate-y-1 hover:border-border-strong sm:p-4", tone.shadow)}
                    >
                      <span className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300", tone.icon, tone.iconHover)}>
                        <DeptIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <p className="text-sm font-bold text-primary">{d.short}</p>
                      <p className="mt-1 line-clamp-3 text-2xs font-medium leading-snug text-text-secondary sm:line-clamp-2">{d.description}</p>
                    </motion.li>
                  );
                })}
          </ul>
        </div>
      }
    />
  );
}

/* --------------------------------------- students --------------------------------------------- */

function StudentPanel() {
  const { data } = useLandingData();
  const facts = landingFacts(data);
  const depth = data?.stats?.depth;

  const points: Point[] = [
    { icon: BookOpenCheck, title: "A personal learning centre", body: "Coding, aptitude, soft skills, company prep and AI mock interviews in one place." },
    { icon: Gauge, title: "One readiness score", body: "Everything you do rolls up into a single score, so you always know what to do next." },
    { icon: Trophy, title: "Something to play for", body: "A rated contest every night, and weekly vouchers for the top of the board." },
    { icon: LockOpen, title: "A path to employers", body: `Cross ${facts.vaultBar}% and Mellow Vault opens, where employers are already hiring.` },
  ];

  return (
    <PanelShell
      tone="cyan"
      eyebrow="For students"
      title="Practise daily. Compete weekly. Get found."
      lead="A place to prepare for the exact companies visiting campus, with something to play for every week."
      points={points}
      actions={
        <>
          <ButtonLink href="/signup" variant="primary" size="lg" className="hp-btn-sheen" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Create student account
          </ButtonLink>
          <Link href="/students" className="inline-flex items-center justify-center gap-1 text-sm font-bold text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-400">
            Explore for students <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </>
      }
      visual={<LearningGrid depth={depth} facts={facts} />}
    />
  );
}

interface LearnTile {
  icon: Icon;
  label: string;
  /** A count (counted up) or a short phrase. */
  value: number | string | null;
  note: string;
  tone: Tone;
}

export function LearningGrid({ depth, facts }: { depth: LandingDepth | undefined; facts: ReturnType<typeof landingFacts> }) {
  const tiles: LearnTile[] = [
    { icon: Code2, label: "Practice Arena", value: depth?.problems ?? null, note: depth ? `coding problems · ${depth.languages} languages` : "coding problems", tone: "indigo" },
    { icon: Mic, label: "AI mock interviews", value: depth?.interview_questions ?? null, note: depth ? `questions · ${depth.interview_stacks} tech stacks` : "questions", tone: "violet" },
    { icon: BookOpenCheck, label: "Company prep", value: depth?.company_packs ?? null, note: "company packs with real past questions", tone: "amber" },
    { icon: Brain, label: "Soft skills and core", value: depth?.assessment_questions ?? null, note: "assessment questions", tone: "cyan" },
    { icon: Swords, label: "Daily Challenge", value: facts.dailyTime, note: `rated, ${facts.dailyProblems} problems, every night`, tone: "rose" },
    { icon: LockOpen, label: "Mellow Vault", value: `${facts.vaultBar}%`, note: "readiness opens the door to employers", tone: "emerald" },
  ];

  return (
    <div>
      <div className="mb-4">
        <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">Your learning centre</p>
        <p className="mt-0.5 text-lg font-bold tracking-tight text-primary">Everything you need to prepare</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((t, i) => {
          const tone = TONES[t.tone];
          return (
            <motion.li
              key={t.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 + i * 0.06, ease: "easeOut" }}
              className={cn("group rounded-2xl border border-border-subtle bg-surface p-4 shadow-subtle transition-all duration-300 hover:-translate-y-1 hover:border-border-strong", tone.shadow)}
            >
              <span className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-300", tone.icon, tone.iconHover)}>
                <t.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">{t.label}</p>
              <p className="mt-1 font-mono text-xl font-black tabular-nums tracking-tight text-primary sm:text-2xl">
                {typeof t.value === "number" ? <AnimatedCounter target={t.value} group /> : t.value ?? <span className="inline-block h-6 w-16 animate-pulse rounded bg-elevated align-middle" aria-hidden="true" />}
              </p>
              <p className="mt-0.5 text-2xs font-medium leading-snug text-text-secondary">{t.note}</p>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
