"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";

export function HeroContent() {
  const prefersReducedMotion = useReducedMotion();
  const [contact, setContact] = useState<"institution" | "company" | null>(null);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.09 } },
  };

  const item = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
  };

  return (
    <>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center text-center max-w-5xl mx-auto pt-6 pb-10 sm:pt-12 sm:pb-12 px-4"
      >
        {/* Eyebrow badge with live pulse */}
        <motion.button
          type="button"
          variants={item}
          onClick={() => scrollToSection("how-it-works")}
          className="group inline-flex max-w-full items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border-strong text-xs font-medium text-text-secondary shadow-subtle mb-6 hover:border-accent-primary/50 transition-colors"
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="font-semibold text-primary text-2xs sm:text-xs truncate">
            <span className="sm:hidden">The placement sandbox</span>
            <span className="hidden sm:inline">The placement sandbox for colleges</span>
          </span>
          <span className="text-border-strong shrink-0">&bull;</span>
          <span className="text-accent-primary font-semibold text-2xs sm:text-xs flex items-center gap-1 shrink-0 group-hover:underline underline-offset-4">
            See how <ArrowRight className="w-3 h-3" />
          </span>
        </motion.button>

        {/* Headline — one clause, ~7 words, bold rather than black. Large
            product sites (Stripe, Linear, Vercel, Ramp) all sit at 5–8 words
            and 56–64px on desktop; 72px/900 read as shouting at laptop widths. */}
        <motion.h1
          variants={item}
          className="text-[2.5rem] sm:text-5xl lg:text-[3.5rem] 2xl:text-[4rem] font-bold tracking-[-0.035em] text-primary leading-[1.06] mb-5 text-balance"
        >
          Run every placement drive{" "}
          <br className="hidden lg:block" />
          <span className="inline-block whitespace-nowrap lp-gradient-text">
            from one platform.
          </span>
        </motion.h1>

        {/* Supporting copy — a single sentence. The detail (recruiters,
            talent pool, reports) is carried by the sections below. */}
        <motion.p
          variants={item}
          className="text-base sm:text-lg text-text-secondary max-w-2xl leading-relaxed mb-8 font-medium text-balance"
        >
          Onboard your batch, map recruiters and track every campus drive,{" "}
          <br className="hidden sm:block" />
          while each student prepares in a personal learning centre.
        </motion.p>

        {/* CTAs — the buyer is the college; students and recruiters get their own doors */}
        <motion.div
          variants={item}
          className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm sm:max-w-none mx-auto justify-center mb-5"
        >
          <Button
            variant="primary"
            size="lg"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => setContact("institution")}
            className="w-full sm:w-auto min-h-[46px] justify-center shadow-glow hover:shadow-glow-cyan transition-all font-semibold hp-btn-sheen"
          >
            Book a demo
          </Button>
          <ButtonLink
            href="/signup"
            variant="secondary"
            size="lg"
            leftIcon={<GraduationCap className="w-4 h-4 text-accent-primary" />}
            className="w-full sm:w-auto min-h-[46px] justify-center font-semibold"
          >
            I&apos;m a student
          </ButtonLink>
        </motion.div>
        <motion.p variants={item} className="text-13 font-medium text-text-secondary">
          Recruiting for your company?{" "}
          <button
            type="button"
            onClick={() => setContact("company")}
            className="inline-flex items-center gap-1 font-semibold text-accent-primary hover:underline underline-offset-4"
          >
            Hire from partner campuses
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.p>
      </motion.div>
      <TalkToTeamModal
        key={contact ?? "closed"}
        open={contact !== null}
        onClose={() => setContact(null)}
        defaultAudience={contact ?? "institution"}
      />
    </>
  );
}
