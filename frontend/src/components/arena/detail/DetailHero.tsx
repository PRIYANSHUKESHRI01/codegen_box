"use client";

import { forwardRef, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays, CheckCircle2, Globe, MapPin, Timer, Trophy, Users } from "lucide-react";
import { CountUp, EASE } from "@/components/arena/motion";
import { ExclusiveChip } from "@/components/arena/ExclusiveChip";
import { CoverArt, HostMark, PhaseBadge } from "@/components/arena/primitives";
import { MODE_LABEL, formatMoney, formatRange, nextMilestone, useNow, timeLeft } from "@/lib/hackathon";
import { stamp } from "@/components/arena/detail/shared";
import { cn } from "@/lib/utils";
import type { HackathonDetail } from "@/types/hackathon";

/**
 * The poster. Deliberately short (about 340px on a desktop): cover art under a scrim and grain, the
 * title as the one loud thing, and — instead of a run of icons — four glass cells with the numbers
 * that decide whether you take part: prize, how many are in, how long is left, and team size.
 */
export const DetailHero = forwardRef<HTMLElement, { h: HackathonDetail }>(function DetailHero({ h }, ref) {
  const WhereIcon = h.mode === "online" ? Globe : MapPin;
  const backHref = h.mine ? "/arena/my" : "/arena";
  const place = h.location && h.mode !== "online" ? ` · ${h.location.split("·")[0].trim()}` : "";

  return (
    <motion.header
      ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="dt-hero ar-hairline ar-grain relative isolate overflow-hidden rounded-[26px] bg-[#0b0d18]"
    >
      <div className="dt-cover absolute inset-0 -z-10">
        <CoverArt src={h.cover_url} accent={h.accent} title={h.title} eager className="absolute inset-0" />
      </div>
      <div aria-hidden className="dt-scrim absolute inset-0 -z-10" />

      <div className="relative z-10 flex min-h-[300px] flex-col justify-end gap-4 p-4 sm:min-h-[320px] sm:p-7 lg:p-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={backHref} className="dt-glass-pill mr-1">
              <ArrowLeft className="h-4 w-4" aria-hidden /> {h.mine ? "My hackathons" : "All hackathons"}
            </Link>
            <PhaseBadge phase={h.phase} />
            <span className="ar-chip">
              <WhereIcon className="h-3.5 w-3.5" aria-hidden /> {MODE_LABEL[h.mode]}
              {place}
            </span>
            {h.audience === "colleges" && <ExclusiveChip forHost={!h.viewer.is_student} />}
            {h.is_featured && <span className="ar-chip ar-chip-accent uppercase tracking-wider">Featured</span>}
            {h.mine && (
              <span className="ar-chip" style={{ color: "#b6f5dc", background: "rgba(52,211,153,0.16)", borderColor: "rgba(52,211,153,0.45)" }}>
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> You&apos;re in
              </span>
            )}
          </div>

          <h1 className="ar-hero-title mt-4 max-w-4xl text-white [text-shadow:0_2px_30px_rgba(0,0,0,0.45)]">{h.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-[color:var(--ar-text-2)]">
            <span className="flex items-center gap-2">
              <HostMark host={h.host} size={22} />
              <span>
                Hosted by <span className="font-semibold text-white">{h.host.name}</span>
              </span>
            </span>
            <span aria-hidden className="hidden h-1 w-1 rounded-full bg-white/30 sm:block" />
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-[color:var(--ar-text-3)]" aria-hidden /> {formatRange(h.starts_at, h.ends_at)}
            </span>
          </div>

          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-[color:var(--ar-text-2)] sm:text-base">{h.tagline}</p>
        </div>

        <KeyFacts h={h} />
      </div>
    </motion.header>
  );
});

/** The same milestones, short enough for a half-width phone cell. */
const SHORT_LABEL: Record<string, string> = {
  "Registration opens in": "Opens in",
  "Registration closes in": "Reg. closes in",
  "Kickoff in": "Kickoff in",
  "Submissions close in": "Closes in",
};

/* ── Key facts ────────────────────────────────────────────────────────────── */

function KeyFacts({ h }: { h: HackathonDetail }) {
  const milestone = nextMilestone(h);
  const { min, max } = h.team_size;
  const hasPrize = h.prize_pool.amount > 0;
  const capacity = h.max_participants ? Math.min(100, (h.participants_count / h.max_participants) * 100) : null;

  return (
    <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4" aria-label="Key facts">
      <Fact index={0} icon={Trophy} label="Prize pool" sub={hasPrize ? (h.prizes.length > 0 ? `across ${h.prizes.length} placing${h.prizes.length === 1 ? "" : "s"}` : "in total") : "& recognition"}>
        {hasPrize ? <CountUp value={h.prize_pool.amount} format={(n) => formatMoney(n, h.prize_pool.currency)} className="dt-gold-text" /> : <span>Perks</span>}
      </Fact>

      <Fact
        index={1}
        icon={Users}
        label="Taking part"
        sub={h.spots_left !== null ? `${h.spots_left.toLocaleString("en-IN")} spot${h.spots_left === 1 ? "" : "s"} left` : "students so far"}
        bar={capacity}
      >
        <CountUp value={h.participants_count} />
      </Fact>

      <TimeFact index={2} h={h} milestone={milestone} />

      <Fact index={3} icon={Users} label="Team size" sub={max === 1 ? "individual entries" : min === 1 ? "solo allowed" : "members per team"}>
        {max === 1 ? (
          <span>Solo</span>
        ) : min === max ? (
          <CountUp value={max} />
        ) : (
          <span>
            <CountUp value={min} />–<CountUp value={max} />
          </span>
        )}
      </Fact>
    </ul>
  );
}

function Fact({ index, icon: Icon, label, shortLabel, sub, bar, tone, children }: { index: number; icon: typeof Users; label: string; shortLabel?: string; sub?: string; bar?: number | null; tone?: "urgent"; children: ReactNode }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.25 + index * 0.07, ease: EASE }}
      className="dt-fact overflow-hidden"
    >
      <p className="dt-fact-label">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", tone === "urgent" ? "text-amber-300" : "text-[rgb(var(--ar-b))]")} aria-hidden />
        {shortLabel ? (
          <>
            <span className="truncate lg:hidden">{shortLabel}</span>
            <span className="hidden truncate lg:inline">{label}</span>
          </>
        ) : (
          <span className="truncate">{label}</span>
        )}
      </p>
      <p className={cn("dt-fact-value", tone === "urgent" && "!text-amber-200")}>{children}</p>
      {sub && <p className="dt-fact-sub hidden sm:block">{sub}</p>}

      {bar != null && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: bar / 100 }}
            transition={{ duration: 1.1, delay: 0.7 + index * 0.07, ease: EASE }}
            className="block h-full origin-left bg-gradient-to-r from-[rgb(var(--ar-a))] to-[rgb(var(--ar-b))]"
          />
        </span>
      )}
    </motion.li>
  );
}

/** The one number that changes while you watch: time left to the next milestone, or the dates once there isn't one. */
function TimeFact({ index, h, milestone }: { index: number; h: HackathonDetail; milestone: ReturnType<typeof nextMilestone> }) {
  const now = useNow(30_000);

  if (milestone) {
    const t = timeLeft(milestone.at, now || Date.now());
    const urgent = t.total > 0 && t.total < 72 * 3_600_000;
    const text = t.total <= 0 ? "Now" : t.days > 0 ? `${t.days}d ${t.hours}h ${t.minutes}m` : t.hours > 0 ? `${t.hours}h ${t.minutes}m` : `${Math.max(1, t.minutes)}m`;

    return (
      <Fact index={index} icon={Timer} label={milestone.label} shortLabel={SHORT_LABEL[milestone.label]} sub={stamp(milestone.at)} tone={urgent ? "urgent" : undefined}>
        <span suppressHydrationWarning>{text}</span>
      </Fact>
    );
  }

  const phaseText = h.phase === "judging" ? { label: "Status", value: "Judging", sub: "results coming soon" } : h.phase === "completed" ? { label: "Ran", value: formatRange(h.starts_at, h.ends_at), sub: new Date(h.ends_at).getFullYear().toString() } : { label: "Dates", value: formatRange(h.starts_at, h.ends_at), sub: stamp(h.starts_at) };

  return (
    <Fact index={index} icon={Timer} label={phaseText.label} sub={phaseText.sub}>
      <span>{phaseText.value}</span>
    </Fact>
  );
}
