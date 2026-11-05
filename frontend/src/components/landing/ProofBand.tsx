"use client";

import { BookOpenCheck, Brain, Code2, Mic, type LucideIcon } from "lucide-react";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { Reveal } from "@/components/landing/Reveal";
import { Container } from "@/components/layout/Container";
import { useLandingData } from "@/lib/useLandingData";
import type { LandingAdoption, LandingCompany, LandingDepth } from "@/types/landing";

interface Tile {
  icon: LucideIcon;
  value: number;
  label: string;
  note: string;
  tint: string;
}

/** The four numbers that say how much there is to practise on. All depth: always returned, always true. */
function depthTiles(d: LandingDepth): Tile[] {
  const tiles: Tile[] = [
    {
      icon: Code2,
      value: d.problems,
      label: "Coding problems",
      note: `${d.languages} languages, judged on ${d.test_cases.toLocaleString("en-IN")} test cases`,
      tint: "from-indigo-500 to-violet-500",
    },
    {
      icon: Mic,
      value: d.interview_questions,
      label: "AI interview questions",
      note: `${d.interview_domains} domains · ${d.interview_stacks} tech stacks`,
      tint: "from-violet-500 to-fuchsia-500",
    },
    {
      icon: Brain,
      value: d.assessment_questions,
      label: "Soft-skill and core questions",
      note: `Across ${d.departments} departments, ${d.branches} branches`,
      tint: "from-sky-500 to-cyan-500",
    },
    {
      icon: BookOpenCheck,
      value: d.company_questions,
      label: "Company prep questions",
      note: `${d.company_packs} company packs, asked in real rounds`,
      tint: "from-emerald-500 to-teal-500",
    },
  ];

  // A tile whose number is zero is a feature that is not stocked yet: leave it out, never print "0 questions".
  return tiles.filter((t) => t.value > 0);
}

/** How many use it: only the figures the server judged worth printing. */
function adoptionFacts(a: LandingAdoption): { label: string; value: number }[] {
  return [
    { label: "students", value: a.students },
    { label: "colleges", value: a.colleges },
    { label: "contests held", value: a.contests_held },
    { label: "solutions judged", value: a.solutions_judged },
    { label: "vouchers sent", value: a.vouchers_sent },
  ].filter((f): f is { label: string; value: number } => f.value !== null && f.value > 0);
}

function CompanyStrip({ companies }: { companies: LandingCompany[] }) {
  if (companies.length === 0) return null;

  return (
    <div className="lp-marquee overflow-hidden" aria-label="Companies with prep packs on AptRun">
      <div className="lp-marquee-track gap-4 pr-4">
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1} className={copy === 1 ? "lp-marquee-dup flex shrink-0 gap-4" : "flex shrink-0 gap-4"}>
            {companies.map((c) => (
              <li key={c.slug} className="transition-transform duration-300 hover:-translate-y-1">
                <CompanyLogo name={c.name} slug={c.slug} size="md" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/**
 * Right under the hero: proof that there is substance. The strip of companies is the ones that have a prep pack on AptRun (a fact about
 * our content, not a claim that they are customers), and the tiles are the size of what a student gets. All of it from the backend;
 * while it loads the band keeps its shape, and if it never loads the band is not drawn at all.
 */
export function ProofBand() {
  const { data, status } = useLandingData();

  if (status === "error" || (status === "ready" && !data?.stats && (data?.companies.length ?? 0) === 0)) return null;

  const depth = data?.stats?.depth;
  const tiles = depth ? depthTiles(depth) : [];
  const adoption = data?.stats ? adoptionFacts(data.stats.adoption) : [];

  return (
    <section aria-label="The platform in numbers" className="relative border-y border-border-subtle bg-surface/40 py-12 sm:py-16">
      <Container size="xl">
        {(data?.companies.length ?? 0) > 0 && (
          <Reveal>
            <p className="mb-6 px-4 text-center text-2xs font-mono font-bold uppercase tracking-[0.18em] text-text-secondary">
              Prep packs for the companies that visit campus
            </p>
            <CompanyStrip companies={data!.companies} />
          </Reveal>
        )}

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {data
            ? tiles.map((t, i) => (
                <li key={t.label}>
                  <Reveal delay={i * 0.07} className="h-full">
                    <div className="group relative h-full overflow-hidden rounded-2xl border border-border-subtle bg-surface p-4 shadow-subtle transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_22px_44px_-22px_rgba(79,70,229,0.4)] sm:p-5">
                      <span
                        aria-hidden="true"
                        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${t.tint} text-white shadow-md ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110`}
                      >
                        <t.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                      </span>
                      <p className="font-mono text-2xl font-black tabular-nums tracking-tight text-primary sm:text-3xl">
                        <AnimatedCounter target={t.value} group />
                      </p>
                      <p className="mt-0.5 text-13 font-bold leading-snug text-primary">{t.label}</p>
                      <p className="mt-1 text-2xs font-medium leading-snug text-text-secondary">{t.note}</p>
                    </div>
                  </Reveal>
                </li>
              ))
            : Array.from({ length: 4 }, (_, i) => (
                <li key={i} aria-hidden="true" className="h-[9.5rem] animate-pulse rounded-2xl border border-border-subtle bg-surface/70" />
              ))}
        </ul>

        {adoption.length > 0 && (
          <Reveal>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2" aria-label="Usage">
              {adoption.map((f) => (
                <li key={f.label} className="text-sm font-medium text-text-secondary">
                  <span className="font-mono text-base font-black tabular-nums text-primary">
                    <AnimatedCounter target={f.value} group />
                  </span>{" "}
                  {f.label}
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </Container>
    </section>
  );
}
