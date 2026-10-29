"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Award, BookOpen, Briefcase, Building2, CircuitBoard, Compass, FlaskConical, LineChart, Mic, Brain, Sparkles, Swords, Trophy } from "lucide-react";
import { HpCard, HpIconTile, HpPill, HpSectionHeader, type HpTone } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import type { CapabilityMap } from "@/lib/departments";

type Group = "arena" | "placements" | "competition";

interface Tile {
  id: string;
  group: Group;
  title: string;
  blurb: string;
  cta: string;
  href: string;
  icon: LucideIcon;
}

/** The sidebar group each tile lives in, and the tone that group wears everywhere on this grid. */
const GROUPS: Record<Group, { label: string; tone: HpTone; text: string; bar: string }> = {
  arena: { label: "Your Arena", tone: "indigo", text: "text-indigo-600 dark:text-indigo-300", bar: "from-indigo-500 to-violet-500" },
  placements: { label: "Placements", tone: "sky", text: "text-sky-700 dark:text-sky-300", bar: "from-sky-400 to-blue-500" },
  competition: { label: "Competition", tone: "amber", text: "text-amber-700 dark:text-amber-300", bar: "from-amber-400 to-orange-500" },
};

/**
 * Builds the tiles from what the student's programme actually has - the same capability switches the sidebar reads - so the
 * grid never offers a door the rail does not have. Order follows the rail: Your Arena, then Placements, then Competition.
 * (The Vault AI Interview and the Hack Arena have their own banners on the page, so they are not repeated here.)
 */
export function exploreTiles({ caps, domainPrep }: { caps: CapabilityMap; domainPrep: { label: string } | null }): Tile[] {
  const tiles: Tile[] = [];

  if (caps.coding_practice) {
    tiles.push({ id: "practice", group: "arena", title: "Practice Arena", blurb: "Solve real coding problems and see the verdict in seconds — your rating, streak and topic mastery grow with every one.", cta: "Open Practice Arena", href: "/dashboard/practice", icon: BookOpen });
  }
  if (domainPrep) {
    tiles.push({ id: "domain", group: "arena", title: domainPrep.label, blurb: "Questions from your own subject with the reasoning after each answer, then timed, proctored tests.", cta: `Open ${domainPrep.label}`, href: "/dashboard/core", icon: CircuitBoard });
  }
  if (caps.learning_centre) {
    tiles.push({ id: "learning", group: "arena", title: "Learning Centre", blurb: "Speaking, listening and vocabulary with AI feedback — the communication skill no syllabus covers.", cta: "Start learning", href: "/dashboard/learning-centre", icon: Sparkles });
  }
  if (caps.soft_skills) {
    tiles.push({ id: "soft", group: "arena", title: "Soft Skills", blurb: "Aptitude, reasoning, English and situational-judgement sets, scored with a full review of every answer.", cta: "Pick a set", href: "/dashboard/soft-skills", icon: Brain });
  }
  if (caps.project_lab) {
    tiles.push({ id: "projects", group: "arena", title: "Project Lab", blurb: "Build guided, real-world projects in a ready-made workspace and submit them for review.", cta: "Browse projects", href: "/dashboard/projects", icon: FlaskConical });
  }
  tiles.push({ id: "report", group: "arena", title: "Performance Report", blurb: "Your whole record in one place: readiness roadmap, rating trend, topic mastery, activity and every submission.", cta: "View my report", href: "/dashboard/reports", icon: LineChart });

  tiles.push({ id: "drives", group: "placements", title: "Upcoming Drives", blurb: "Every company your placement cell has opened for your college, with eligibility, CTC and a prep pack for each.", cta: "See upcoming drives", href: "/dashboard/drives", icon: Briefcase });
  if (caps.company_prep) {
    tiles.push({ id: "pyq", group: "placements", title: "Company PYQs", blurb: "Verified previous-year questions from top recruiters, round by round — TCS, Infosys, Accenture and more.", cta: "Explore companies", href: "/dashboard/company-prep", icon: Building2 });
  }
  if (caps.ai_interviews) {
    tiles.push({ id: "mock", group: "placements", title: "Mock AI Interview", blurb: "Build a round, answer out loud and get scored by AI — as many times as you like, no pressure.", cta: "Build a round", href: "/dashboard/interviews", icon: Mic });
  }
  tiles.push({ id: "vault", group: "placements", title: "Mellow Vault", blurb: "Hiring partners are always looking for ready candidates. Reach 60% readiness to unlock Mellow Vault and get hired directly.", cta: "Open Mellow Vault", href: "/dashboard/vault", icon: Award });

  if (caps.contests) {
    tiles.push({ id: "contests", group: "competition", title: "Contests", blurb: "Timed, rated rounds against other students — your rating moves on how you actually place.", cta: "See contests", href: "/dashboard/contests", icon: Swords });
  }
  if (caps.coding_practice) {
    tiles.push({ id: "leaderboard", group: "competition", title: "Global Leaderboard", blurb: "See where you stand across AptRun and within your own college.", cta: "View leaderboard", href: "/dashboard/leaderboard", icon: Trophy });
  }

  return tiles;
}

/**
 * "Explore AptRun": one card per section of the sidebar - what it is, and a button that goes there. This is where the
 * Overview points at everything it no longer repeats. `hints` carries a live fact for the sections that have one
 * ("2 upcoming"), shown as a small pill.
 */
export function ExploreGrid({ tiles, hints }: { tiles: Tile[]; hints?: Partial<Record<string, string>> }) {
  return (
    <section aria-label="Explore AptRun" className="space-y-4">
      <HpSectionHeader icon={Compass} tone="violet" title="Explore AptRun" subtitle="Every section in the sidebar, in a line — jump straight in" />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {tiles.map((t) => {
          const g = GROUPS[t.group];
          const hint = hints?.[t.id];
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                className="group block h-full rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <HpCard interactive className="relative flex h-full flex-col overflow-hidden p-5">
                  <span aria-hidden className={cn("absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r transition-transform duration-500 ease-out group-hover:scale-x-100 motion-reduce:transition-none", g.bar)} />

                  <div className="flex items-start justify-between gap-3">
                    <HpIconTile icon={t.icon} tone={g.tone} size="lg" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
                    <span className="flex flex-col items-end gap-1.5">
                      <span className={cn("text-3xs font-bold uppercase tracking-[0.1em]", g.text)}>{g.label}</span>
                      {hint && (
                        <HpPill tone={g.tone} size="sm">
                          {hint}
                        </HpPill>
                      )}
                    </span>
                  </div>

                  <h3 className="mt-4 text-15 font-bold tracking-tight text-primary">{t.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{t.blurb}</p>

                  <span className={cn("mt-auto inline-flex items-center gap-1.5 pt-5 text-xs font-bold", g.text)}>
                    {t.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                  </span>
                </HpCard>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export type ExploreTile = Tile;
