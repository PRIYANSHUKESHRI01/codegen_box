"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarClock, PencilLine, Timer, Trophy, Users } from "lucide-react";
import { EASE } from "@/components/arena/motion";
import { CoverArt, HostMark, PhaseBadge } from "@/components/arena/primitives";
import { TicketCountdown } from "@/components/arena/lobby/TicketCountdown";
import { accentVars, compactMoney, formatDateTime, hackathonHref } from "@/lib/hackathon";
import type { HackathonCard } from "@/types/hackathon";

/**
 * "Continue where you left off": the live hackathon whose deadline is nearest, as a ticket. The countdown is the
 * stub you tear off — on desktop it sits to the right of a vertical perforation, on phones below a horizontal one.
 */
export function ResumeTicket({ card }: { card: HackathonCard }) {
  const reduced = useReducedMotion();
  const status = card.mine?.submission_status;

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      aria-label="Continue where you left off"
      style={accentVars(card.accent)}
      className="lb-ticket-wrap mb-12"
    >
      <div className="lb-ticket lb-ticket-resp relative overflow-hidden rounded-[24px]">
        {/* A faint wash of the hackathon's own cover, so the ticket is visibly *this* event's. */}
        <div aria-hidden className="absolute inset-0">
          <CoverArt src={card.cover_url} accent={card.accent} title={card.title} className="absolute inset-0 h-full w-full opacity-[0.38]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,11,24,0.96)_0%,rgba(9,11,24,0.8)_55%,rgba(9,11,24,0.55)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(50%_120%_at_0%_0%,rgb(var(--ar-a)/0.22),transparent_70%)]" />
        </div>

        <div aria-hidden className="absolute inset-x-7 bottom-[156px] border-t-2 border-dashed border-white/[0.16] lg:inset-x-auto lg:bottom-7 lg:right-[340px] lg:top-7 lg:border-l-2 lg:border-t-0" />

        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 p-6 pb-7 sm:p-8">
            <p className="ar-eyebrow mb-4 flex items-center gap-2">
              <PencilLine className="h-3.5 w-3.5" aria-hidden /> Continue where you left off
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <PhaseBadge phase={card.phase} />
              <span className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--ar-text-2)]">
                <HostMark host={card.host} size={22} />
                {card.host.name}
              </span>
            </div>

            <h2 className="ar-h1 mt-3 text-white">{card.title}</h2>
            <p className="ar-body mt-2 max-w-xl">
              {status === "submitted"
                ? "Your project is submitted — you can keep polishing it until the deadline."
                : status === "draft"
                  ? "You have a draft saved. Finish it and submit before the clock runs out."
                  : "You haven't started your project yet. The editor is open — begin whenever you're ready."}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {card.mine?.team_name && (
                <span className="ar-chip">
                  <Users className="h-3.5 w-3.5 text-[color:var(--ar-text-3)]" aria-hidden /> {card.mine.team_name}
                  <span className="text-[color:var(--ar-text-3)]">· {card.mine.role === "leader" ? "team lead" : "member"}</span>
                </span>
              )}
              <span className="ar-chip">
                <Trophy className="h-3.5 w-3.5 text-amber-300" aria-hidden /> {compactMoney(card.prize_pool.amount, card.prize_pool.currency)}
              </span>
            </div>

            <Link href={hackathonHref(card.slug, "project")} className="ar-btn ar-btn-primary group mt-6">
              Open project editor <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </Link>
          </div>

          <div className="flex h-[156px] flex-col justify-center px-7 lg:h-auto lg:px-8">
            <p className="ar-eyebrow mb-4 flex items-center gap-2">
              <Timer className="h-3.5 w-3.5" aria-hidden /> Submissions close in
            </p>
            <TicketCountdown target={card.ends_at} size="md" className="max-w-[300px]" />
            <p className="ar-meta mt-3 flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {formatDateTime(card.ends_at)}
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
