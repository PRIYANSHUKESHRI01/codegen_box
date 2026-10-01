"use client";

import { Container } from "@/components/layout/Container";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { usePublicStats } from "@/lib/usePublicPlatformData";
import { Code2, Layers, FlaskConical, Terminal } from "lucide-react";

interface StatCard {
  id: string;
  value: number;
  suffix: string;
  label: string;
  sublabel: string;
  icon: typeof Code2;
  colorScheme: "indigo" | "cyan" | "amber" | "emerald";
}

const SCHEME_STYLES: Record<
  StatCard["colorScheme"],
  { iconBox: string; glow: string; topBorder: string }
> = {
  indigo: {
    iconBox: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    glow: "from-indigo-500/10 to-transparent",
    topBorder: "from-indigo-500 via-indigo-400 to-transparent",
  },
  cyan: {
    iconBox: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    glow: "from-cyan-500/10 to-transparent",
    topBorder: "from-cyan-500 via-cyan-400 to-transparent",
  },
  amber: {
    iconBox: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    glow: "from-amber-500/10 to-transparent",
    topBorder: "from-amber-500 via-amber-400 to-transparent",
  },
  emerald: {
    iconBox: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    glow: "from-emerald-500/10 to-transparent",
    topBorder: "from-emerald-500 via-emerald-400 to-transparent",
  },
};

/**
 * Every number here is real, fetched from GET /public/stats — the platform
 * used to headline fabricated numbers here ("42,000+ Students Placed",
 * "180+ Partner Campuses"). We lead with problem-catalog depth instead,
 * since that's real, large, and verifiable today; college/student counts
 * are still small at this stage and would undercut credibility more than
 * help it, so they're not featured here yet.
 */
export function Stats() {
  const stats = usePublicStats();

  const cards: StatCard[] = stats
    ? [
        {
          id: "problems",
          value: stats.problems_total,
          suffix: "",
          label: "Practice Problems",
          sublabel: `${stats.problems_easy} Easy · ${stats.problems_medium} Medium · ${stats.problems_hard} Hard`,
          icon: Code2,
          colorScheme: "indigo",
        },
        {
          id: "topics",
          value: stats.topics_total,
          suffix: "",
          label: "DSA Topics Covered",
          sublabel: "From arrays to graphs, dynamic programming to tries",
          icon: Layers,
          colorScheme: "cyan",
        },
        {
          id: "test-cases",
          value: stats.test_cases_total,
          suffix: "+",
          label: "Real Test Cases",
          sublabel: "Every submission judged against real, hidden cases",
          icon: FlaskConical,
          colorScheme: "amber",
        },
        {
          id: "languages",
          value: stats.languages_total,
          suffix: "",
          label: "Languages Supported",
          sublabel: "C++, Java, Python and JavaScript, all real judge execution",
          icon: Terminal,
          colorScheme: "emerald",
        },
      ]
    : [];

  return (
    <section className="py-8 sm:py-14 border-y border-border-subtle bg-surface/30 relative">
      <Container size="xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-5">
          {(stats ? cards : Array.from({ length: 4 })).map((stat, i) => {
            if (!stats) {
              return (
                <div
                  key={i}
                  className="rounded-2xl bg-white dark:bg-[#0E121B] border border-border-subtle p-3.5 sm:p-5 lg:p-6 h-[120px] sm:h-[150px] animate-pulse"
                />
              );
            }

            const card = stat as StatCard;
            const style = SCHEME_STYLES[card.colorScheme];
            const Icon = card.icon;

            return (
              <div
                key={card.id}
                className="relative rounded-2xl bg-white dark:bg-[#0E121B] border border-border-subtle hover:border-border-strong p-3.5 sm:p-5 lg:p-6 flex flex-col justify-between group hover:-translate-y-1 transition-all duration-300 shadow-sm dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] overflow-hidden"
              >
                <div
                  className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${style.topBorder} opacity-70 group-hover:opacity-100 transition-opacity`}
                />
                <div
                  className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${style.glow} blur-xl pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity`}
                />

                <div>
                  <div className="mb-2.5 sm:mb-4">
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 ${style.iconBox}`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </div>

                  <div className="text-2xl xs:text-3xl sm:text-4xl font-black tracking-tight text-primary font-mono mt-1 mb-0.5 sm:mb-1">
                    <AnimatedCounter target={card.value} suffix={card.suffix} />
                  </div>

                  <div className="text-xs sm:text-sm font-semibold text-primary tracking-tight line-clamp-1">
                    {card.label}
                  </div>
                </div>

                <div className="text-2xs sm:text-xs text-secondary mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-border-subtle/80 line-clamp-1 sm:line-clamp-2 leading-relaxed">
                  {card.sublabel}
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
