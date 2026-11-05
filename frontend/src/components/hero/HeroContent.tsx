"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";

const TRUST_POINTS = ["Free for students", "Set up by our team", "Proctored and fair"];

/**
 * The first thing a visitor reads: who this is for, in one line, and the two ways in. The buyer is the placement cell (Book a demo);
 * students get their own door beside it. Four moves, in order — eyebrow, headline, one sentence, buttons — and nothing else, so the
 * product shown underneath does the persuading.
 */
export function HeroContent() {
  const reduce = useReducedMotion();
  const [demoOpen, setDemoOpen] = useState(false);

  const container = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.09 } } };
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="mx-auto flex max-w-4xl flex-col items-center px-4 pb-10 pt-8 text-center sm:pb-14 sm:pt-14">
        <motion.a
          variants={item}
          href="#platform"
          className="group mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium text-text-secondary shadow-subtle transition-colors hover:border-accent-primary/50"
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="truncate text-2xs font-semibold text-primary sm:text-xs">
            <span className="sm:hidden">Placements, end to end</span>
            <span className="hidden sm:inline">The placement platform for colleges and students</span>
          </span>
          <span className="shrink-0 text-border-strong" aria-hidden="true">
            &bull;
          </span>
          <span className="flex shrink-0 items-center gap-1 text-2xs font-semibold text-accent-primary underline-offset-4 group-hover:underline sm:text-xs">
            See how <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </motion.a>

        {/* Two short parallel lines, bold rather than black: Stripe, Linear and Vercel all sit at 56–64px on desktop. */}
        <motion.h1
          variants={item}
          className="mb-5 text-balance text-[clamp(2rem,9.4vw,2.6rem)] font-bold leading-[1.05] tracking-[-0.035em] text-primary sm:text-5xl lg:text-[3.6rem] 2xl:text-[4.1rem]"
        >
          Every student placement-ready.
          <br className="hidden sm:block" />{" "}
          <span className="lp-gradient-text sm:inline-block sm:whitespace-nowrap">Every drive, one platform.</span>
        </motion.h1>

        <motion.p variants={item} className="mb-8 max-w-2xl text-balance text-base font-medium leading-relaxed text-text-secondary sm:text-lg">
          One platform for your placement cell and every student: proctored drives, AI interviews, readiness analytics, weekly rewards and a
          direct path to employers.
        </motion.p>

        <motion.div variants={item} className="mx-auto mb-6 flex w-full max-w-sm flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            rightIcon={<ArrowRight className="h-4 w-4" />}
            onClick={() => setDemoOpen(true)}
            className="hp-btn-sheen min-h-[48px] w-full justify-center font-semibold shadow-glow transition-all hover:shadow-glow-cyan sm:w-auto"
          >
            Book a demo
          </Button>
          <ButtonLink
            href="/signup"
            variant="secondary"
            size="lg"
            leftIcon={<GraduationCap className="h-4 w-4 text-accent-primary" />}
            className="min-h-[48px] w-full justify-center font-semibold sm:w-auto"
          >
            I&apos;m a student
          </ButtonLink>
        </motion.div>

        <motion.ul variants={item} aria-label="Why teams choose AptRun" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-13 font-medium text-text-secondary">
          {TRUST_POINTS.map((point) => (
            <li key={point} className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-status-success" strokeWidth={3} aria-hidden="true" />
              {point}
            </li>
          ))}
        </motion.ul>
      </motion.div>

      <TalkToTeamModal key={demoOpen ? "open" : "closed"} open={demoOpen} onClose={() => setDemoOpen(false)} defaultAudience="institution" />
    </>
  );
}
