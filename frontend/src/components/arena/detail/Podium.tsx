"use client";

import { motion } from "framer-motion";
import { Crown, Medal } from "lucide-react";
import { CountUp, EASE, useSpotlight } from "@/components/arena/motion";
import { AvatarStack } from "@/components/arena/primitives";
import { ordinal } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { PublicProject } from "@/types/hackathon";

/** Scores can be fractional (87.5); CountUp counts integers, so it counts tenths and we format them back. */
export const formatScore = (tenths: number) => (tenths / 10).toFixed(1).replace(/\.0$/, "");

const STEP_HEIGHT: Record<number, string> = { 1: "md:h-[150px]", 2: "md:h-[112px]", 3: "md:h-[80px]" };
const REVEAL_AT: Record<number, number> = { 3: 0.1, 2: 0.32, 1: 0.58 };
/** The pedestals rise when the stage scrolls into view, not while it is still below the fold. */
const VIEW = { once: true, margin: "-12% 0px" } as const;
const TEXT: Record<number, string> = { 1: "dt-metal-text-1", 2: "dt-metal-text-2", 3: "dt-metal-text-3" };

/**
 * The winners' stage: 2nd – 1st – 3rd, each team's card standing on a pedestal of its own height, with
 * metallic medals, a spotlight falling on the winner and a floor line. Pedestals rise from the bottom in
 * the order they are announced (3rd, 2nd, then 1st). On a phone the pedestals drop away and the three
 * cards stack, winner first.
 */
export function Podium({ podium, mineTeamId }: { podium: PublicProject[]; mineTeamId: number | null }) {
  const spot = useSpotlight<HTMLLIElement>();
  const byRank = (rank: number) => podium.find((p) => p.rank === rank);
  const columns = [byRank(2), byRank(1), byRank(3)];

  return (
    <div className="dt-stage ar-grain px-3 pt-14 sm:px-8 sm:pt-16">
      <ol className="relative z-10 grid items-end gap-12 md:grid-cols-3 md:gap-5">
        {columns.map((p, i) => {
          if (!p || p.rank === null) return <li key={`empty-${i}`} aria-hidden className="hidden md:block" />;

          const rank = p.rank;
          const mine = mineTeamId !== null && p.team.id === mineTeamId;
          const first = rank === 1;

          return (
            <li key={p.id} onMouseMove={spot} className={cn("flex flex-col", first && "order-first md:order-none")}>
              <motion.div initial={{ opacity: 0, y: 36 }} whileInView={{ opacity: 1, y: 0 }} viewport={VIEW} transition={{ delay: REVEAL_AT[rank] ?? 0.2, duration: 0.7, ease: EASE }}>
                <div
                  data-place={rank}
                  className={cn("dt-tile dt-lift ar-spot relative !overflow-visible px-5 pb-6 pt-12 text-center", mine && "ring-1 ring-[rgb(var(--ar-b)/0.7)]", first && "md:pb-8")}
                >
                  <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
                    <motion.span
                      initial={{ scale: 0.4, opacity: 0, rotate: -18 }}
                      whileInView={{ scale: 1, opacity: 1, rotate: 0 }}
                      viewport={VIEW}
                      transition={{ delay: (REVEAL_AT[rank] ?? 0.2) + 0.25, type: "spring", stiffness: 320, damping: 15 }}
                      className="relative block"
                    >
                      {first && <Crown aria-hidden className="absolute -top-7 left-1/2 h-7 w-7 -translate-x-1/2 text-amber-300 drop-shadow-[0_4px_14px_rgba(251,191,36,0.7)]" fill="currentColor" />}
                      <span className={cn("dt-medallion ar-shine !h-14 !w-14", `ar-metal-${rank}`)}>
                        <Medal className="h-6 w-6" aria-hidden strokeWidth={2.2} />
                        <span className="sr-only">{ordinal(rank)} place</span>
                      </span>
                    </motion.span>
                  </span>

                  <p className={cn("text-[11px] font-bold uppercase tracking-[0.14em]", TEXT[rank])}>{p.award_label ?? `${ordinal(rank)} place`}</p>
                  <h3 className={cn("mt-2.5 font-bold leading-snug tracking-[-0.02em] text-white", first ? "text-[22px]" : "text-[19px]")}>{p.title}</h3>
                  {p.tagline && <p className="mx-auto mt-1.5 line-clamp-2 max-w-[28ch] text-[13px] leading-relaxed text-[color:var(--ar-text-2)]">{p.tagline}</p>}

                  <div className="mt-5 flex flex-col items-center gap-2">
                    <AvatarStack people={p.team.members} size={30} />
                    <p className="text-[13px] font-medium text-[color:var(--ar-text-2)]">{p.team.name}</p>
                    {mine && <span className="ar-chip ar-chip-accent !px-2.5 !py-1 !text-[10.5px] uppercase tracking-wider">Your team</span>}
                  </div>

                  {p.score !== null && (
                    <p className={cn("ar-num mt-4 font-extrabold leading-none tracking-[-0.03em]", first ? "text-[40px]" : "text-[32px]", TEXT[rank])}>
                      <CountUp value={Math.round(p.score * 10)} format={formatScore} duration={1.4} />
                      <span className="ml-1 text-[13px] font-semibold tracking-normal text-[color:var(--ar-text-3)]">/100</span>
                    </p>
                  )}
                </div>
              </motion.div>

              <motion.div
                aria-hidden
                initial={{ clipPath: "inset(100% 0 0 0)" }}
                whileInView={{ clipPath: "inset(0% 0 0 0)" }}
                viewport={VIEW}
                transition={{ delay: (REVEAL_AT[rank] ?? 0.2) - 0.05, duration: 0.8, ease: EASE }}
                className="mt-3 hidden md:block"
              >
                <div data-place={rank} className={cn("dt-step", STEP_HEIGHT[rank])}>
                  <span className={cn("dt-step-num", TEXT[rank])}>{rank}</span>
                </div>
              </motion.div>
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="dt-floor relative z-10 -mx-3 mt-0 hidden sm:-mx-8 md:block" />
      <div className="h-6 md:hidden" aria-hidden />
    </div>
  );
}
