"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, GraduationCap, ShieldCheck, Terminal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";

export function HeroContent() {
  const prefersReducedMotion = useReducedMotion();
  const [contactOpen, setContactOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: prefersReducedMotion ? 0 : 0.09 },
    },
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
      className="flex flex-col items-center text-center max-w-4xl mx-auto pt-8 pb-12 sm:pt-14 sm:pb-16 px-4"
    >
      {/* Eyebrow badge with live pulse */}
      <motion.div
        variants={item}
        className="inline-flex max-w-full items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-surface border border-border-strong text-xs font-medium text-text-secondary shadow-subtle mb-6 hover:border-accent-primary/50 transition-colors"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="font-semibold text-primary font-mono text-3xs sm:text-2xs tracking-wide uppercase truncate">
          <span className="sm:hidden">Real Judge · AI-Scored Interviews</span>
          <span className="hidden sm:inline">Real Code Execution &amp; AI-Scored Interviews, Live Now</span>
        </span>
        <span className="text-border-strong shrink-0">&bull;</span>
        <span
          className="text-accent-primary font-mono text-3xs sm:text-2xs hover:underline cursor-pointer flex items-center gap-1 shrink-0"
          onClick={() => scrollToSection("platform-preview")}
        >
          See How <ArrowRight className="w-3 h-3" />
        </span>
      </motion.div>

      {/* Main Headline with high-end gradient */}
      <motion.h1
        variants={item}
        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-primary leading-[1.06] mb-6"
      >
        Campus Placements,{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-primary via-indigo-400 to-accent-secondary">
          Engineered.
        </span>
      </motion.h1>

      {/* Supporting Copy */}
      <motion.p
        variants={item}
        className="text-base sm:text-lg md:text-xl text-text-secondary max-w-2xl leading-relaxed mb-8 sm:mb-10 font-normal"
      >
        One platform for your placement cell to map recruiters and onboard a batch in minutes, and for
        every student to prepare with company-specific interview prep and a real practice arena.
      </motion.p>

      {/* Action Buttons */}
      <motion.div
        variants={item}
        className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full max-w-sm sm:max-w-none mx-auto justify-center mb-10"
      >
        <Button
          variant="primary"
          size="lg"
          rightIcon={<ArrowRight className="w-4 h-4" />}
          onClick={() => setContactOpen(true)}
          className="w-full sm:w-auto min-h-[48px] justify-center shadow-glow hover:shadow-glow-cyan transition-all font-semibold"
        >
          Talk to Our Team
        </Button>
        <Button
          variant="secondary"
          size="lg"
          leftIcon={<GraduationCap className="w-4 h-4 text-accent-primary" />}
          onClick={() => scrollToSection("problems")}
          className="w-full sm:w-auto min-h-[48px] justify-center font-semibold"
        >
          Explore as a Student
        </Button>
      </motion.div>

      {/* Trust Row — real capabilities, not vanity metrics */}
      <motion.div
        variants={item}
        className="pt-5 border-t border-border-subtle/80 w-full max-w-2xl flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-mono text-text-muted"
      >
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-accent-primary" />
          <span>Real Code Execution</span>
        </div>
        <span className="text-border-strong hidden sm:inline">&bull;</span>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>AI-Scored Interviews</span>
        </div>
        <span className="text-border-strong hidden sm:inline">&bull;</span>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Role-Based Access</span>
        </div>
      </motion.div>
    </motion.div>
    <TalkToTeamModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
