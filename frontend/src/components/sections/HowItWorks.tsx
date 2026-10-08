"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Award, BookOpenCheck, Briefcase, Building2, GraduationCap } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES, Tone } from "@/components/ui/tones";
import { HIRING_LOOP_STEPS } from "@/data/navigation";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof Building2> = { Building2, BookOpenCheck, Briefcase, Award };

/** One colour per phase of the season, so the four cards read as a sequence. */
const STEP_TONES: Tone[] = ["indigo", "cyan", "amber", "emerald"];

/** Solid node fill, matching each tone's progress gradient. */
const NODE_FILL: Record<Tone, string> = {
  indigo: "from-indigo-500 to-indigo-600 shadow-[0_8px_24px_-6px_rgba(99,102,241,0.7)]",
  cyan: "from-cyan-500 to-sky-600 shadow-[0_8px_24px_-6px_rgba(6,182,212,0.7)]",
  violet: "from-violet-500 to-violet-600 shadow-[0_8px_24px_-6px_rgba(139,92,246,0.7)]",
  emerald: "from-emerald-500 to-teal-600 shadow-[0_8px_24px_-6px_rgba(16,185,129,0.7)]",
  amber: "from-amber-500 to-orange-500 shadow-[0_8px_24px_-6px_rgba(245,158,11,0.7)]",
  rose: "from-rose-500 to-pink-500 shadow-[0_8px_24px_-6px_rgba(244,63,94,0.7)]",
};

export function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 bg-surface/20 border-t border-border-subtle scroll-mt-16 overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-dot-pattern opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_30%,black,transparent)] pointer-events-none"
      />
      <Container size="xl" className="relative">
        <SectionHeading
          badge="How it works"
          title="From campus onboarding to"
          highlight="placed students"
          description="No lengthy IT rollout. You run the season; AptRun prepares your students and brings the recruiters."
        />

        <div className="relative">
          {/* Desktop connecting track: runs through the centre of the numbered nodes */}
          <motion.div
            aria-hidden="true"
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
            className="hidden lg:block absolute top-7 left-[12.5%] right-[12.5%] h-0.5 origin-left bg-gradient-to-r from-indigo-500 via-cyan-500 via-60% to-emerald-500 opacity-50 pointer-events-none"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-8 relative z-10">
            {HIRING_LOOP_STEPS.map((step, i) => {
              const Icon = iconMap[step.icon] ?? Building2;
              const tone = TONES[STEP_TONES[i] ?? "indigo"];
              const toneKey = STEP_TONES[i] ?? "indigo";
              return (
                <div key={step.step} className="flex flex-col lg:items-stretch">
                  {/* Numbered node on the track */}
                  <div className="flex lg:justify-center mb-4">
                    <span
                      className={cn(
                        "w-14 h-14 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-mono text-lg font-black ring-4 ring-background",
                        NODE_FILL[toneKey]
                      )}
                    >
                      {step.step}
                    </span>
                  </div>

                  <SpotlightCard
                    className={cn(
                      "group relative flex-1 rounded-card bg-surface border border-border-subtle p-6 flex flex-col overflow-hidden shadow-sm hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                      tone.shadow
                    )}
                  >
                    <div
                      aria-hidden="true"
                      className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent pointer-events-none", tone.wash)}
                    />

                    <div className="relative flex items-center gap-3 mb-4">
                      <div
                        className={cn(
                          "w-11 h-11 rounded-control border flex items-center justify-center transition-all duration-300 group-hover:scale-105",
                          tone.icon,
                          tone.iconHover
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold tracking-[-0.01em] text-primary leading-tight">{step.title}</h3>
                    </div>

                    <div className="relative space-y-3 flex-1">
                      <div className={cn("rounded-control bg-elevated/70 border border-border-subtle border-l-[3px] p-3", tone.edge)}>
                        <div className={cn("flex items-center gap-1.5 text-3xs font-mono font-bold uppercase tracking-wider mb-1", tone.text)}>
                          <Building2 className="w-3 h-3" /> Placement cell
                        </div>
                        <p className="text-sm font-medium text-text-secondary leading-snug">{step.college}</p>
                      </div>
                      <div className="rounded-control bg-elevated/70 border border-border-subtle border-l-[3px] border-l-border-strong p-3">
                        <div className="flex items-center gap-1.5 text-3xs font-mono font-bold uppercase tracking-wider text-text-secondary mb-1">
                          <GraduationCap className="w-3 h-3" /> Students &amp; recruiters
                        </div>
                        <p className="text-sm font-medium text-text-secondary leading-snug">{step.network}</p>
                      </div>
                    </div>
                  </SpotlightCard>
                </div>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
