"use client";

import Link from "next/link";
import { ArrowUpRight, Flame, Trophy } from "lucide-react";
import { CountUp, Reveal, useSpotlight } from "@/components/arena/motion";
import { AvatarStack } from "@/components/arena/primitives";
import { SectionHead } from "@/components/arena/lobby/parts";
import { accentVars, hackathonHref } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { ArenaHome } from "@/types/hackathon";

type Result = ArenaHome["recent_results"][number];

/** Recent winners: a metallic medallion, the winning project and its team, and the score as the one number. */
export function HallOfFame({ items }: { items: Result[] }) {
  if (items.length === 0) return null;
  const solo = items.length === 1;

  return (
    <section className="mt-16" aria-labelledby="fame-heading">
      <SectionHead id="fame-heading" eyebrow="Hall of Fame" title="Recent winners" description="Projects that took first place. Open one to see how it was built." />

      <ul className={cn("grid gap-5", solo ? "grid-cols-1" : items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3")}>
        {items.map((item, i) => (
          <li key={item.hackathon.id}>
            <Reveal delay={i * 0.07} className="h-full">
              <Winner item={item} wide={solo} />
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Winner({ item: { hackathon, winner }, wide }: { item: Result; wide: boolean }) {
  const spot = useSpotlight<HTMLAnchorElement>();

  return (
    <Link
      href={hackathonHref(hackathon.slug, "results")}
      onMouseMove={spot}
      style={accentVars(hackathon.accent)}
      className={cn("lb-card ar-spot ar-sweep group relative block h-full p-6 focus-visible:outline-none", wide && "lg:flex lg:items-center lg:gap-8 lg:p-7")}
    >
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[21px]", wide && "lg:hidden")}>
        <Trophy className="absolute -bottom-6 -right-4 h-36 w-36 -rotate-12 text-amber-300/[0.07] transition-transform duration-700 group-hover:-rotate-6 group-hover:scale-110" />
      </div>

      <div className={cn("flex items-center gap-4", wide && "lg:w-[300px] lg:shrink-0")}>
        <span className="ar-metal-1 ar-shine relative inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-amber-950 shadow-[0_12px_30px_-8px_rgba(251,191,36,0.75),0_2px_0_rgba(255,255,255,0.55)_inset,0_-4px_8px_rgba(120,53,15,0.45)_inset] ring-2 ring-amber-200/40">
          <Trophy className="relative z-[1] h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300">{winner?.award_label ?? "Winner"}</p>
          <p className="mt-1.5 truncate text-[13px] font-medium text-[color:var(--ar-text-2)]">{hackathon.title}</p>
        </div>
      </div>

      {winner ? (
        <>
          <div className={cn("mt-5 min-w-0", wide && "lg:mt-0 lg:flex-1")}>
            <h3 className="ar-h2 text-white">{winner.title}</h3>
            <p className="ar-body mt-1.5 line-clamp-2 !text-[13.5px]">{winner.tagline}</p>
          </div>

          <div className={cn("mt-5 flex items-center justify-between gap-4", wide && "lg:mt-0 lg:w-[300px] lg:shrink-0")}>
            <div className="flex min-w-0 items-center gap-3">
              <AvatarStack people={winner.team.members} />
              <span className="truncate text-[13px] font-semibold text-[color:var(--ar-text-2)]">{winner.team.name}</span>
            </div>
            {winner.score !== null && (
              <span className="flex shrink-0 items-center gap-1.5 text-[20px] font-bold text-amber-300" title="Final score">
                <Flame className="h-[18px] w-[18px]" aria-hidden />
                <CountUp value={Math.round(winner.score * 10)} format={(n) => (n / 10).toFixed(1)} />
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="ar-body mt-5">Results are in — open the hackathon to see the leaderboard.</p>
      )}

      <ArrowUpRight aria-hidden className={cn("ar-arrow absolute right-5 top-5 h-5 w-5 text-white/30 transition-colors group-hover:text-white", wide && "lg:static lg:ml-2 lg:shrink-0")} />
    </Link>
  );
}
