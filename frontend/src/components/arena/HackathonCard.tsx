"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock, Globe, MapPin, PencilLine, Users } from "lucide-react";
import { useSpotlight } from "@/components/arena/motion";
import { CompactTimeLeft, CoverArt, HostMark, PhaseBadge, RankBadge } from "@/components/arena/primitives";
import { CapacityRow, PrizePill } from "@/components/arena/lobby/parts";
import { ExclusiveChip } from "@/components/arena/ExclusiveChip";
import { UrgencyChip, teamSizeLabel, urgencyOf, whereLabel } from "@/components/arena/lobby/helpers";
import { accentVars, cardAction, formatRange, hackathonHref, nextMilestone, ordinal, useNow } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { HackathonCard as Card } from "@/types/hackathon";

/** What the student's own state adds to a card, shown over the cover. */
function MineBadge({ card }: { card: Card }) {
  const mine = card.mine;
  if (!mine) return null;

  const base = "lb-on-cover ar-chip !font-bold";

  if (mine.is_disqualified) {
    return <span className={base} style={{ color: "#fecdd3", background: "linear-gradient(rgba(244,63,94,0.28),rgba(244,63,94,0.28)), rgba(8,10,20,0.72)", borderColor: "rgba(244,63,94,0.5)" }}>Disqualified</span>;
  }

  if (mine.rank !== null) {
    return (
      <span className="lb-on-cover flex max-w-full items-center gap-2 rounded-full bg-[rgba(8,10,20,0.72)] py-0.5 pl-0.5 pr-3 text-xs font-bold text-white ring-1 ring-white/20">
        <RankBadge rank={mine.rank} className="!h-7 !min-w-[28px]" />
        <span className="truncate">{mine.award_label ?? `${ordinal(mine.rank)} place`}</span>
      </span>
    );
  }

  if (card.phase === "live" && mine.submission_status !== "submitted") {
    return (
      <span className={base} style={{ color: "#fde9a8", background: "linear-gradient(rgba(251,191,36,0.24),rgba(251,191,36,0.24)), rgba(8,10,20,0.72)", borderColor: "rgba(251,191,36,0.5)" }}>
        <PencilLine className="h-3.5 w-3.5" aria-hidden /> {mine.submission_status === "draft" ? "Draft saved" : "No project yet"}
      </span>
    );
  }

  return (
    <span className={base} style={{ color: "#b6f5dc", background: "linear-gradient(rgba(52,211,153,0.22),rgba(52,211,153,0.22)), rgba(8,10,20,0.72)", borderColor: "rgba(52,211,153,0.5)" }}>
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {mine.submission_status === "submitted" ? "Submitted" : "You're in"}
    </span>
  );
}

interface HackathonCardProps {
  card: Card;
  className?: string;
  /** Eager-load the cover (first row of a list). */
  priority?: boolean;
  /** "wide" lays the cover beside the copy from `sm` up — used by the live rail. */
  variant?: "default" | "wide";
}

/**
 * The Arena's card — one component for the lobby, the live rail, "My hackathons" and the winners. It answers,
 * in order: what is it, who runs it, how big is the prize, when, how full is it, is it urgent, and what do I
 * do next. The whole card is one link (a stretched link on the title), so its accessible name is the title.
 */
export function HackathonCard({ card, className, priority = false, variant = "default" }: HackathonCardProps) {
  const spot = useSpotlight<HTMLElement>();
  const now = useNow(30_000) || Date.now();
  const urgency = urgencyOf(card, now);
  // "Closes in 1d 4h" already says what the registration milestone would — don't print it twice.
  const milestone = urgency?.kind === "closing" ? null : nextMilestone(card);
  const action = cardAction(card);
  const wide = variant === "wide";
  const WhereIcon = card.mode === "online" ? Globe : MapPin;
  const extraThemes = card.themes.length - 3;

  return (
    <article
      onMouseMove={spot}
      style={accentVars(card.accent)}
      className={cn("lb-card ar-spot ar-sweep group flex h-full flex-col", wide && "sm:flex-row", className)}
    >
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <div className={cn("relative", wide && "sm:w-[46%] sm:shrink-0")}>
        <div className={cn("lb-cover ar-grain relative overflow-hidden rounded-t-[21px]", wide && "sm:h-full sm:rounded-l-[21px] sm:rounded-tr-none")}>
          <CoverArt src={card.cover_url} accent={card.accent} title={card.title} eager={priority} className={cn("lb-cover-img aspect-[16/9]", wide && "sm:absolute sm:inset-0 sm:aspect-auto")} />
          <div className="ar-cover-scrim" aria-hidden />

          <div className="absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
            <PhaseBadge phase={card.phase} className="lb-on-cover" />
            <MineBadge card={card} />
          </div>

          <div className={cn("absolute bottom-3 left-3 flex max-w-[62%] items-center gap-2 rounded-full bg-[rgba(8,10,20,0.62)] py-1 pl-1 pr-3 ring-1 ring-white/15 backdrop-blur-md", wide && "sm:max-w-[calc(100%-7rem)]")}>
            <HostMark host={card.host} size={22} />
            <span className="min-w-0 truncate text-[12.5px] font-semibold text-white">{card.host.name}</span>
          </div>
        </div>

        {/* Outside the clipping cover so it can straddle the edge. */}
        <PrizePill card={card} className={cn("pointer-events-none absolute -bottom-4 right-4 z-[3]", wide && "sm:bottom-3 sm:right-3")} />
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col p-5 pt-6">
        {(urgency || milestone || card.audience === "colleges") && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {card.audience === "colleges" && <ExclusiveChip />}
            {urgency && <UrgencyChip urgency={urgency} />}
            {milestone && (
              <span className="ar-chip !px-2.5 !py-1 !text-[11.5px]">
                <Clock className="h-3.5 w-3.5 text-[color:var(--ar-text-3)]" aria-hidden />
                {milestone.label}{" "}
                <span className="ar-num font-bold text-white">
                  <CompactTimeLeft target={milestone.at} />
                </span>
              </span>
            )}
          </div>
        )}

        <h3 className="ar-h3 text-white">
          {/* The stretched link: the whole card is clickable, but there is one link, named by the title. */}
          <Link href={hackathonHref(card.slug)} className="lb-card-link after:absolute after:inset-0 after:z-10 after:rounded-[22px] after:content-[''] focus-visible:outline-none">
            {card.title}
          </Link>
        </h3>
        <p className="ar-body mt-1.5 line-clamp-2 !text-[13.5px] !leading-[1.55]">{card.tagline}</p>

        <ul className="mt-4 space-y-2 text-[12.5px] text-[color:var(--ar-text-2)]">
          <li className="flex items-center gap-x-5">
            <span className="flex items-center gap-2.5">
              <CalendarDays className="h-4 w-4 shrink-0 text-[color:var(--ar-text-3)]" aria-hidden />
              <span className="whitespace-nowrap font-medium">{formatRange(card.starts_at, card.ends_at)}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-[color:var(--ar-text-3)]" aria-hidden />
              <span className="truncate font-medium">{teamSizeLabel(card.team_size)}</span>
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <WhereIcon className="h-4 w-4 shrink-0 text-[color:var(--ar-text-3)]" aria-hidden />
            <span className="min-w-0 truncate font-medium" title={card.location ?? undefined}>
              {whereLabel(card)}
            </span>
          </li>
        </ul>

        <CapacityRow card={card} className="mt-4" />

        {card.themes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {card.themes.slice(0, 3).map((t) => (
              <span key={t} className="ar-chip !px-2.5 !py-1 !text-[11px]">
                {t}
              </span>
            ))}
            {extraThemes > 0 && <span className="ar-chip !px-2 !py-1 !text-[11px] !text-[color:var(--ar-text-3)]">+{extraThemes}</span>}
          </div>
        )}

        <div className="mt-auto pt-5">
          <span aria-hidden className={cn("ar-btn pointer-events-none !h-10 w-full !text-[13px]", action.emphasis === "primary" ? "ar-btn-primary" : "ar-btn-ghost")}>
            {action.label}
            <ArrowUpRight className="ar-arrow h-4 w-4" />
          </span>
        </div>
      </div>
    </article>
  );
}
