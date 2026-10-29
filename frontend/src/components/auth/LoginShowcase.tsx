"use client";

import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from "framer-motion";
import {
  BarChart3,
  Briefcase,
  Code2,
  Gauge,
  GraduationCap,
  Building2,
  Mic,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** The three kinds of account the sign-in page can show. Mirrors `LoginRole` on the page. */
export type ShowcaseRole = "user" | "admin_tpo" | "admin_company";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

interface Stat {
  value: string;
  label: string;
}

interface Showcase {
  badgeIcon: LucideIcon;
  badge: string;
  /** Headline, split so the middle part can carry the gradient. */
  headline: [string, string, string];
  lede: string;
  features: Feature[];
  stats: Stat[];
  /** Everything colour that changes with the role, as whole class strings (Tailwind needs them written out). */
  theme: {
    badge: string;
    gradient: string;
    tile: string;
    glowA: string;
    glowB: string;
    rule: string;
  };
}

/** What the platform publicly counts (`/public/stats`); null until it has answered, which shows a dash rather than a made-up number. */
export interface ShowcaseStats {
  problems_total: number;
  languages_total: number;
}

/**
 * What each tab says on the left of the sign-in page. Every claim is something the product really does (bulk CSV import, the
 * readiness score both sides see, drives, proctored sittings, the AI interviews); the only numbers shown are the platform's own
 * live counts, or plain facts (four departments), never a made-up customer figure.
 *
 * The Hiring Partner copy stays here, ready, for the day that tab is switched back on.
 */
function showcaseFor(role: ShowcaseRole, stats: ShowcaseStats | null): Showcase {
  const n = (v: number | undefined) => (v === undefined ? "—" : v.toLocaleString("en-IN"));

  switch (role) {
    case "admin_tpo":
      return {
        badgeIcon: Building2,
        badge: "Placement Console",
        headline: ["Run placements with ", "total clarity", "."],
        lede: "Onboard a batch from one file, watch every student’s readiness move, and take each drive from mapping to offer.",
        features: [
          { icon: Upload, title: "Bulk roster onboarding", body: "A whole batch from one CSV; accounts and welcome emails run themselves." },
          { icon: BarChart3, title: "Cohort readiness, live", body: "One score per student, by branch, year and section — and who needs a nudge." },
          { icon: Briefcase, title: "Drives, end to end", body: "Map companies, set eligibility and follow every applicant through each round." },
          { icon: ShieldCheck, title: "Proctored assessments", body: "Camera, fullscreen and a tamper-evident record for every sitting." },
        ],
        stats: [
          { value: "4", label: "Departments supported" },
          { value: "1 CSV", label: "To onboard a batch" },
        ],
        theme: {
          badge: "bg-indigo-500/10 text-indigo-700 border-indigo-500/25 dark:text-indigo-300",
          gradient: "from-indigo-500 via-violet-500 to-sky-500",
          tile: "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_8px_18px_-6px_rgba(99,102,241,0.65)]",
          glowA: "bg-indigo-500/20",
          glowB: "bg-sky-400/15",
          rule: "from-indigo-500/60 via-violet-500/40 to-transparent",
        },
      };

    case "admin_company":
      return {
        badgeIcon: Briefcase,
        badge: "Hiring Console",
        headline: ["Hire with ", "proof, not guesswork", "."],
        lede: "Run candidates, interviews and drives from one console, with assessed, ranked talent from partner colleges.",
        features: [
          { icon: Users, title: "Assessed talent", body: "Candidates with a readiness score behind them, not just a résumé." },
          { icon: Mic, title: "AI-assisted interviews", body: "Structured, scored rounds your team can compare side by side." },
          { icon: Briefcase, title: "Drives across colleges", body: "One drive across partner campuses, every candidate tracked." },
          { icon: ShieldCheck, title: "Proctored screening", body: "Assessments with a tamper-evident record." },
        ],
        stats: [
          { value: "Ranked", label: "Candidates, by readiness" },
          { value: "1 console", label: "For every drive" },
        ],
        theme: {
          badge: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300",
          gradient: "from-amber-500 via-orange-500 to-rose-500",
          tile: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-[0_8px_18px_-6px_rgba(245,158,11,0.65)]",
          glowA: "bg-amber-500/20",
          glowB: "bg-rose-400/15",
          rule: "from-amber-500/60 via-orange-500/40 to-transparent",
        },
      };

    case "user":
    default:
      return {
        badgeIcon: GraduationCap,
        badge: "Candidate Arena",
        headline: ["Practice. Compete. Get ", "placement-ready", "."],
        lede: "Solve real problems, rehearse with AI mock interviews and see every drive your college opens.",
        features: [
          { icon: Mic, title: "AI mock interviews", body: "Answer out loud and get scored on every round, as often as you like." },
          { icon: Code2, title: "A real judge", body: `Solve problems with instant verdicts in ${stats ? n(stats.languages_total) : "many"} languages.` },
          { icon: Gauge, title: "One readiness score", body: "The same number your placement cell sees — and what moves it." },
          { icon: Briefcase, title: "Every drive, one place", body: "See which companies your college opens, check eligibility, get a prep pack." },
        ],
        stats: [
          { value: stats ? n(stats.problems_total) : "—", label: "Practice problems" },
          { value: stats ? n(stats.languages_total) : "—", label: "Judge languages" },
        ],
        theme: {
          badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
          gradient: "from-emerald-500 via-teal-500 to-sky-500",
          tile: "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_8px_18px_-6px_rgba(16,185,129,0.65)]",
          glowA: "bg-emerald-500/20",
          glowB: "bg-sky-400/15",
          rule: "from-emerald-500/60 via-teal-500/40 to-transparent",
        },
      };
  }
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The left half of the sign-in page. Switching tab swaps its whole message in place: the old copy fades up and out, the new
 * copy rises in on a short stagger (badge → headline → lede → feature rows → numbers), and the colour glow behind it crossfades to
 * the new role's colour. Nothing reloads and nothing around it moves - the sign-in card on the right never shifts.
 *
 * Motion is flattened for anyone who asked their system for reduced motion (framer's `reducedMotion="user"` plus no offsets).
 */
export function LoginShowcase({ role, stats }: { role: ShowcaseRole; stats: ShowcaseStats | null }) {
  const s = showcaseFor(role, stats);
  const reduce = useReducedMotion();
  const BadgeIcon = s.badgeIcon;
  const rise = reduce ? 0 : 14;

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
    exit: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: rise },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
    exit: { opacity: 0, y: reduce ? 0 : -8, transition: { duration: 0.16, ease: "easeIn" } },
  };

  // The card is itself an item of the column and the parent of its feature rows, so it carries its own stagger.
  const card: Variants = {
    hidden: { opacity: 0, y: rise },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE, staggerChildren: 0.06, delayChildren: 0.12 } },
    exit: item.exit,
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative lg:min-h-[712px]">
        {/* The role's colour, crossfading behind the copy. */}
        <AnimatePresence>
          <motion.div
            key={`glow-${role}`}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10 overflow-hidden"
          >
            <div className={cn("absolute -left-16 -top-10 h-72 w-72 rounded-full blur-3xl", s.theme.glowA)} />
            <div className={cn("absolute -bottom-10 right-0 h-64 w-64 rounded-full blur-3xl", s.theme.glowB)} />
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={role} variants={container} initial="hidden" animate="show" exit="exit" className="space-y-6">
            <div className="space-y-4">
              <motion.span variants={item} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", s.theme.badge)}>
                <BadgeIcon className="h-3.5 w-3.5" aria-hidden />
                <span>{s.badge}</span>
                <Sparkles className="h-3 w-3 animate-pulse-subtle opacity-70" aria-hidden />
              </motion.span>

              <motion.h1 variants={item} className="text-balance text-3xl font-extrabold leading-tight tracking-tight text-primary xl:text-4xl">
                {s.headline[0]}
                <span className={cn("bg-gradient-to-r bg-clip-text text-transparent", s.theme.gradient)}>{s.headline[1]}</span>
                {s.headline[2]}
              </motion.h1>

              <motion.p variants={item} className="text-pretty text-base font-medium leading-relaxed text-text-secondary">
                {s.lede}
              </motion.p>
            </div>

            <motion.div variants={card} className="relative overflow-hidden rounded-panel border border-border-subtle bg-surface/70 shadow-subtle backdrop-blur-md transition-all duration-300 hover:border-border-strong hover:shadow-card">
              <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r", s.theme.rule)} />
              <ul className="divide-y divide-border-subtle p-2">
                {s.features.map((f) => {
                  const Icon = f.icon;
                  return (
                    <motion.li key={f.title} variants={item} className="group flex items-start gap-3 rounded-xl px-2.5 py-3 transition-colors hover:bg-elevated/60">
                      <span className={cn("relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-white ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105", s.theme.tile)}>
                        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit] bg-gradient-to-b from-white/30 to-transparent" />
                        <Icon className="relative h-4 w-4" strokeWidth={2.2} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-primary">{f.title}</span>
                        <span className="mt-0.5 block text-xs font-medium leading-relaxed text-text-secondary">{f.body}</span>
                      </span>
                    </motion.li>
                  );
                })}
              </ul>
            </motion.div>

            <motion.div variants={item} className="grid grid-cols-2 gap-2 border-t border-border-subtle pt-4">
              {s.stats.map((st) => (
                <div key={st.label}>
                  <strong className="block font-mono text-xl text-primary">{st.value}</strong>
                  <span className="text-xs font-medium text-text-muted">{st.label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
