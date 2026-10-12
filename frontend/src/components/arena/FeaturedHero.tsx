"use client";

import { useRef, type CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, CalendarClock, CalendarDays, Flag, Gavel, Globe, MapPin, Sparkles, Timer, Users } from "lucide-react";
import { CountUp, EASE } from "@/components/arena/motion";
import { ExclusiveChip } from "@/components/arena/ExclusiveChip";
import { CoverArt, HostMark, PhaseBadge } from "@/components/arena/primitives";
import { CapacityRow } from "@/components/arena/lobby/parts";
import { TONE_COLOR, hasPrize, prizeFormat, statusLine, teamSizeLabel } from "@/components/arena/lobby/helpers";
import { TicketCountdown } from "@/components/arena/lobby/TicketCountdown";
import { accentVars, cardAction, compactMoney, formatDateTime, formatRange, hackathonHref, MODE_LABEL, nextMilestone } from "@/lib/hackathon";
import type { HackathonCard } from "@/types/hackathon";

const TICKET_STUB = 176; // px — keep in sync with --tb in lobby.css

/** The one big event at the top of the lobby: the featured hackathon, or whatever is live or next. */
export function FeaturedHero({ card }: { card: HackathonCard }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const milestone = nextMilestone(card);
  const action = cardAction(card);
  const status = statusLine(card);
  const WhereIcon = card.mode === "online" ? Globe : MapPin;

  // The cover drifts a little slower than the page — depth without a heavy parallax library.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const coverY = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["0%", "12%"]);

  return (
    <motion.section
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, ease: EASE }}
      aria-label="Featured hackathon"
      style={accentVars(card.accent)}
      className="ar-hairline ar-grain relative isolate overflow-hidden rounded-[28px] bg-[#0b0d18] shadow-[0_44px_90px_-44px_rgb(var(--ar-a)/0.6)]"
    >
      {/* Cover: parallax on the outside, a slow Ken Burns zoom on the inside, a scrim for legibility on top. */}
      <motion.div aria-hidden style={{ y: coverY }} className="absolute inset-x-0 -bottom-[8%] -top-[8%] -z-20">
        <div className="lb-kenburns absolute inset-0">
          <CoverArt src={card.cover_url} accent={card.accent} title={card.title} eager className="absolute inset-0 h-full w-full" />
        </div>
      </motion.div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,rgba(6,7,13,0.96)_0%,rgba(6,7,13,0.78)_36%,rgba(6,7,13,0.22)_70%,rgba(6,7,13,0.42)_100%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(6,7,13,0.75),transparent_45%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(55%_90%_at_88%_100%,rgb(var(--ar-a)/0.3),transparent_70%)]" />

      <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:gap-14 lg:px-12 lg:py-9">
        {/* ── Copy ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="min-w-0 max-w-[640px]"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="ar-chip ar-chip-accent !font-extrabold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> {card.is_featured ? "Featured" : "Up next"}
            </span>
            <PhaseBadge phase={card.phase} />
            {card.audience === "colleges" && <ExclusiveChip />}
            <span className="flex items-center gap-2 text-[13px] font-medium text-[color:var(--ar-text-2)]">
              <HostMark host={card.host} size={24} />
              <span>
                by <span className="font-semibold text-white">{card.host.name}</span>
              </span>
            </span>
          </div>

          <h2 className="ar-hero-title mt-4 text-white">{card.title}</h2>
          <p className="mt-3 line-clamp-2 max-w-xl text-base leading-relaxed text-[color:var(--ar-text-2)]">{card.tagline}</p>

          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-[color:var(--ar-text-2)]">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[color:var(--ar-text-3)]" aria-hidden />
              <dt className="sr-only">Dates</dt>
              <dd className="font-medium">{formatRange(card.starts_at, card.ends_at)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <WhereIcon className="h-4 w-4 text-[color:var(--ar-text-3)]" aria-hidden />
              <dt className="sr-only">Format</dt>
              <dd className="font-medium">{MODE_LABEL[card.mode]}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[color:var(--ar-text-3)]" aria-hidden />
              <dt className="sr-only">Team size</dt>
              <dd className="font-medium">{teamSizeLabel(card.team_size)}</dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href={hackathonHref(card.slug)} className={action.emphasis === "primary" ? "ar-btn ar-btn-primary group !h-12 px-7 text-[15px]" : "ar-btn ar-btn-ghost group !h-12 px-7 text-[15px]"}>
              {action.label}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </Link>
            {action.emphasis === "primary" && (
              <Link href={hackathonHref(card.slug, "schedule")} className="ar-btn ar-btn-ghost !h-12 px-6 text-[15px]">
                See the schedule
              </Link>
            )}
          </div>
        </motion.div>

        {/* ── Ticket ────────────────────────────────────────────────────── */}
        <motion.div
          initial={reduced ? false : { opacity: 0, x: 28, rotate: 1.2 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          className="lb-ticket-wrap w-full max-w-[400px] justify-self-start lg:max-w-none lg:justify-self-end"
        >
          <div className="ar-ticket lb-ticket lb-ticket-v relative flex flex-col rounded-[22px]" style={{ "--tb": `${TICKET_STUB}px` } as CSSProperties}>
            <div className="flex-1 px-6 pb-5 pt-5">
              {milestone ? (
                <>
                  <p className="ar-eyebrow mb-4 flex items-center gap-2">
                    <Timer className="h-3.5 w-3.5" aria-hidden /> {milestone.label}
                  </p>
                  <TicketCountdown target={milestone.at} />
                  <p className="ar-meta mt-4 flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {formatDateTime(milestone.at)}
                  </p>
                </>
              ) : (
                <>
                  <p className="ar-eyebrow mb-4 flex items-center gap-2">
                    {card.phase === "judging" ? <Gavel className="h-3.5 w-3.5" aria-hidden /> : <Flag className="h-3.5 w-3.5" aria-hidden />}
                    {card.phase === "judging" ? "Judging" : "Finished"}
                  </p>
                  <p className="ar-h2 text-white">{card.phase === "judging" ? "Judges are scoring the projects" : "The results are in"}</p>
                  <p className="ar-meta mt-2">{card.phase === "judging" ? "Submissions closed. The leaderboard goes live when results are published." : `Wrapped up ${formatDateTime(card.ends_at)}.`}</p>
                </>
              )}
            </div>

            <div aria-hidden className="ar-perforation absolute inset-x-6" style={{ bottom: TICKET_STUB }} />

            <div className="flex flex-col px-6 pb-4 pt-4" style={{ height: TICKET_STUB }}>
              <p className="ar-eyebrow">Prize pool</p>
              <p className="mt-2 text-[46px] font-extrabold leading-none tracking-[-0.035em]">
                {hasPrize(card) ? (
                  <span className="lb-gold-text">
                    <CountUp value={card.prize_pool.amount} duration={1.6} format={prizeFormat(card.prize_pool.currency)} />
                  </span>
                ) : (
                  <span className="lb-gold-text text-[28px]">{compactMoney(0, card.prize_pool.currency)}</span>
                )}
              </p>
              <CapacityRow card={card} className="mt-3" />
              <p className="mt-auto flex items-center gap-2 text-[12.5px] font-semibold text-[color:var(--ar-text-2)]">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE_COLOR[status.tone], boxShadow: `0 0 10px ${TONE_COLOR[status.tone]}` }} />
                <span className="truncate">{status.text}</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}
