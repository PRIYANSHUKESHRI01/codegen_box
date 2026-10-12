"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Gift, Trophy, Users } from "lucide-react";
import { EASE } from "@/components/arena/motion";
import { compactMoney } from "@/lib/hackathon";
import { fillPercent, hasPrize, isFinished } from "@/components/arena/lobby/helpers";
import { cn } from "@/lib/utils";
import type { HackathonCard } from "@/types/hackathon";

/** Section title block: quiet eyebrow, one `.ar-h2`, optional blurb and a right-hand action. */
export function SectionHead({ eyebrow, title, description, action, id, className }: { eyebrow?: string; title: string; description?: string; action?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="ar-eyebrow mb-2.5">{eyebrow}</p>}
        <h2 id={id} className="ar-h2 text-white">
          {title}
        </h2>
        {description && <p className="ar-body mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Glass prize chip with a metallic trophy token. Falls back to a gift for perks-only hackathons. */
export function PrizePill({ card, className }: { card: Pick<HackathonCard, "prize_pool">; className?: string }) {
  const paid = hasPrize(card);

  return (
    <span className={cn("lb-prize", className)} title={paid ? "Prize pool" : "Recognition and perks instead of cash"}>
      <span className="lb-prize-icon ar-metal-1">{paid ? <Trophy className="h-3.5 w-3.5" aria-hidden /> : <Gift className="h-3.5 w-3.5" aria-hidden />}</span>
      {compactMoney(card.prize_pool.amount, card.prize_pool.currency)}
      <span className="sr-only"> prize pool</span>
    </span>
  );
}

/** The fill bar. Grows from empty to its value the first time it is seen. */
export function FillBar({ percent, delay = 0, className }: { percent: number; delay?: number; className?: string }) {
  const reduced = useReducedMotion();

  return (
    <div className={cn("ar-progress", className)} role="presentation">
      <motion.span
        initial={reduced ? false : { width: 0 }}
        whileInView={{ width: `${percent}%` }}
        viewport={{ once: true, margin: "0px 0px -8% 0px" }}
        transition={{ duration: 1, delay, ease: EASE }}
        style={{ width: reduced ? `${percent}%` : undefined, minWidth: percent > 0 ? 6 : 0, transition: "none" }}
      />
    </div>
  );
}

/** "13/500 joined · 487 spots left" over a bar, or "13 taking part" when there is no cap. */
export function CapacityRow({ card, className }: { card: HackathonCard; className?: string }) {
  const percent = fillPercent(card);
  const done = isFinished(card);
  const count = card.participants_count;

  if (percent === null) {
    return (
      <div className={cn("flex min-h-[34px] items-center gap-2 text-[12.5px] text-[color:var(--ar-text-2)]", className)}>
        <Users className="h-4 w-4 text-[color:var(--ar-text-3)]" aria-hidden />
        <span>
          <b className="ar-num font-bold text-white">{count.toLocaleString("en-IN")}</b> {done ? "took part" : "taking part"}
          {card.teams_count > 0 && <span className="text-[color:var(--ar-text-3)]"> · {card.teams_count} {card.teams_count === 1 ? "team" : "teams"}</span>}
        </span>
      </div>
    );
  }

  const spotsText = done ? null : card.spots_left === 0 ? "Full" : card.spots_left !== null ? `${card.spots_left.toLocaleString("en-IN")} spots left` : null;

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="text-[color:var(--ar-text-2)]">
          <b className="ar-num font-bold text-white">{count.toLocaleString("en-IN")}</b>
          <span className="text-[color:var(--ar-text-3)]">/{card.max_participants?.toLocaleString("en-IN")}</span> {done ? "took part" : "joined"}
        </span>
        {spotsText && <span className={cn("font-semibold", card.spots_left === 0 ? "text-[color:var(--ar-text-3)]" : "text-[color:var(--ar-text-2)]")}>{spotsText}</span>}
      </div>
      <FillBar percent={percent} />
    </div>
  );
}
