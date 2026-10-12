"use client";

import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarClock, Check, FileText, Globe, Info, Layers, Link2, Megaphone, Scale, ScrollText, ShieldCheck, Trophy, Users, type LucideIcon } from "lucide-react";
import { Accordion } from "@/components/arena/detail/Accordion";
import { SectionTitle, hostOf } from "@/components/arena/detail/shared";
import { Timeline } from "@/components/arena/detail/Timeline";
import { CountUp, EASE, Reveal, useSpotlight } from "@/components/arena/motion";
import { ArenaMarkdown, EmptyState, HostMark } from "@/components/arena/primitives";
import { MODE_LABEL, formatDateTime, formatMoney, ordinal, relativeTime } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { HackathonDetail } from "@/types/hackathon";

/* ── Overview ─────────────────────────────────────────────────────────────── */

export function OverviewTab({ h }: { h: HackathonDetail }) {
  const spot = useSpotlight<HTMLElement>();

  return (
    <div className="space-y-10">
      <Reveal y={14}>
        <section aria-label="About this hackathon" className="ar-raised dt-prose p-5 sm:p-8">
          {h.themes.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/[0.07] pb-5">
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ar-text-3)]">Themes</span>
              {h.themes.map((t) => (
                <span key={t} className="ar-chip ar-chip-accent">
                  {t}
                </span>
              ))}
            </div>
          )}
          <ArenaMarkdown>{h.description}</ArenaMarkdown>
        </section>
      </Reveal>

      {h.tracks.length > 0 && (
        <section aria-labelledby="tracks-heading">
          <SectionTitle icon={Layers} id="tracks-heading" title="Tracks" description="Pick one when you submit — judges compare projects within a track." />
          <ul className="grid gap-4 sm:grid-cols-2">
            {h.tracks.map((t, i) => (
              <Reveal as="li" key={t.name} delay={Math.min(i, 3) * 0.06} y={16}>
                <article onMouseMove={spot} className="ar-raised ar-spot dt-lift relative h-full overflow-hidden p-5">
                  <span aria-hidden className="ar-num pointer-events-none absolute -right-1 -top-3 select-none text-[84px] font-extrabold leading-none text-white/[0.045]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[rgb(var(--ar-a))] to-[rgb(var(--ar-b))] text-[14px] font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_10px_22px_-10px_rgb(var(--ar-a)/0.9)]">
                    {i + 1}
                  </span>
                  <h3 className="ar-h3 relative mt-4 text-white">{t.name}</h3>
                  {t.description && <p className="relative mt-1.5 text-[14px] leading-relaxed text-[color:var(--ar-text-2)]">{t.description}</p>}
                </article>
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      {h.resources.length > 0 && (
        <section aria-labelledby="resources-heading">
          <SectionTitle icon={FileText} id="resources-heading" title="Resources" description="Starter kits, credits and references from the organisers." />
          <ul className="grid gap-3 sm:grid-cols-2">
            {h.resources.map((r, i) => (
              <Reveal as="li" key={r.url} delay={Math.min(i, 3) * 0.05} y={12}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="ar-raised dt-lift group flex items-center gap-3.5 p-3.5 pr-4"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-[rgb(var(--ar-b))] ring-1 ring-white/10 transition-colors group-hover:bg-[rgb(var(--ar-a)/0.25)] group-hover:text-white">
                    <Link2 className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-white">{r.label}</span>
                    <span className="block truncate text-[12.5px] text-[color:var(--ar-text-3)]">{hostOf(r.url)}</span>
                  </span>
                  <ArrowUpRight className="ar-arrow h-4 w-4 shrink-0 text-[color:var(--ar-text-3)] group-hover:text-white" aria-hidden />
                </a>
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      <Reveal y={14}>
        <section aria-labelledby="host-heading" className="ar-raised flex flex-wrap items-center gap-4 p-5">
          <HostMark host={h.host} size={52} />
          <div className="min-w-0 flex-1">
            <p className="ar-eyebrow mb-1.5" id="host-heading">
              Hosted by
            </p>
            <p className="text-[18px] font-semibold leading-tight tracking-[-0.01em] text-white">{h.host.name}</p>
            <p className="mt-0.5 text-[13.5px] text-[color:var(--ar-text-2)]">{h.host.type === "platform" ? "The AptRun events team" : (h.host.industry ?? "Hiring partner on AptRun")}</p>
          </div>
          {h.host.website_url && (
            <a href={h.host.website_url} target="_blank" rel="noopener noreferrer" className="ar-btn ar-btn-ghost ar-btn-sm">
              <Globe className="h-4 w-4" aria-hidden /> Website
            </a>
          )}
        </section>
      </Reveal>
    </div>
  );
}

/* ── Prizes & judging ─────────────────────────────────────────────────────── */

/** A step along the page's own accent gradient (a → b), so criteria read as one family, not a rainbow. */
function toneAt(i: number, n: number): string {
  const t = n <= 1 ? 0 : i / (n - 1);
  return `color-mix(in srgb, rgb(var(--ar-a)) ${Math.round((1 - t) * 100)}%, rgb(var(--ar-b)))`;
}

export function PrizesTab({ h }: { h: HackathonDetail }) {
  const spot = useSpotlight<HTMLDivElement>();
  const totalWeight = h.criteria.reduce((sum, c) => sum + c.weight, 0) || 100;
  const hasPool = h.prize_pool.amount > 0;
  // Three placings read best as a podium — 1st in the middle and a little taller — everything else as a plain row.
  const podium = h.prizes.length === 3 && h.prizes.every((p, i) => p.place === i + 1);

  return (
    <div className="space-y-12">
      <section aria-labelledby="prizes-heading">
        <Reveal y={14}>
          <div className="dt-prize-hero ar-raised relative overflow-hidden p-6 sm:p-8">
            <Trophy aria-hidden className="dt-floaty pointer-events-none absolute -right-4 -top-5 h-44 w-44 text-amber-300/[0.13] sm:h-56 sm:w-56" strokeWidth={1.2} />
            <p className="ar-eyebrow relative mb-3">Total prize pool</p>
            <p id="prizes-heading" className="ar-num dt-metal-text-1 relative text-[44px] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-[60px]">
              {hasPool ? <CountUp value={h.prize_pool.amount} format={(n) => formatMoney(n, h.prize_pool.currency)} duration={1.6} /> : "Perks & recognition"}
            </p>
            <p className="ar-body relative mt-3 max-w-xl">
              {h.prizes.length > 0 ? `Across ${h.prizes.length} placing${h.prizes.length === 1 ? "" : "s"}, plus a place in the public gallery.` : "Every submitted project joins the public gallery — a portfolio piece recruiters can open."}
            </p>
          </div>
        </Reveal>

        {h.prizes.length > 0 && (
          <ul className={cn("mt-5 grid gap-4", podium ? "md:grid-cols-3 md:items-end" : "sm:grid-cols-2 xl:grid-cols-3")}>
            {h.prizes.map((p, i) => {
              const metal = p.place >= 1 && p.place <= 3 ? p.place : null;
              const first = podium && p.place === 1;

              return (
                <Reveal as="li" key={p.place} delay={0.08 + i * 0.08} y={22} className={cn(podium && p.place === 1 && "md:order-2", podium && p.place === 2 && "md:order-1", podium && p.place === 3 && "md:order-3")}>
                  <div onMouseMove={spot} data-place={metal ?? undefined} className={cn("dt-tile dt-lift ar-spot h-full p-5", first ? "md:pb-7 md:pt-9" : "")}>
                    <div className="relative flex items-center gap-3.5">
                      <span className={cn("dt-medallion ar-shine shrink-0", metal ? `ar-metal-${metal}` : "!bg-white/10 !text-white")}>{p.place}</span>
                      <div className="min-w-0">
                        <p className="ar-eyebrow mb-1.5">{ordinal(p.place)} place</p>
                        <h3 className="ar-h3 truncate text-white">{p.title}</h3>
                      </div>
                    </div>

                    <p className={cn("ar-num relative mt-5 font-extrabold leading-none tracking-[-0.03em]", first ? "text-[34px]" : "text-[28px]", metal ? `dt-metal-text-${metal}` : "text-white")}>{p.reward ?? "—"}</p>

                    {p.perks.length > 0 && (
                      <ul className="relative mt-5 space-y-2.5 border-t border-white/[0.08] pt-4">
                        {p.perks.map((perk) => (
                          <li key={perk} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-[color:var(--ar-text-2)]">
                            <span className="dt-tick">
                              <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                            </span>
                            {perk}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="criteria-heading">
        <SectionTitle
          icon={Scale}
          id="criteria-heading"
          title="How projects are judged"
          description="Judges mark every project from 0 to 10 on each criterion. The weight decides how much that criterion counts towards the final score out of 100."
        />
        {h.criteria.length > 1 && (
          <div
            role="img"
            aria-label={`Weighting: ${h.criteria.map((c) => `${c.name} ${Math.round((c.weight / totalWeight) * 100)}%`).join(", ")}`}
            className="mb-4 flex h-3.5 gap-[3px] overflow-hidden rounded-full"
          >
            {h.criteria.map((c, i) => (
              <motion.span
                key={c.name}
                title={`${c.name} · ${Math.round((c.weight / totalWeight) * 100)}%`}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, margin: "-6% 0px" }}
                transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease: EASE }}
                style={{ flexGrow: c.weight, flexBasis: 0, background: toneAt(i, h.criteria.length), transformOrigin: "left center" }}
                className="block first:rounded-l-full last:rounded-r-full"
              />
            ))}
          </div>
        )}

        <ul className="grid gap-3.5 sm:grid-cols-2">
          {h.criteria.map((c, i) => {
            const share = (c.weight / totalWeight) * 100;
            const tone = toneAt(i, h.criteria.length);

            return (
              <Reveal as="li" key={c.name} delay={Math.min(i, 5) * 0.06} y={14}>
                <div className="ar-raised h-full p-4 sm:p-5" style={{ "--tone": tone } as CSSProperties}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="flex min-w-0 items-center gap-2.5 text-[15px] font-semibold leading-snug text-white">
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone, boxShadow: `0 0 10px ${tone}` }} />
                      {c.name}
                    </h3>
                    <span className="ar-num shrink-0 text-[22px] font-bold leading-none text-white">
                      <CountUp value={Math.round(share)} />
                      <span className="ml-0.5 text-[13px] font-semibold text-[color:var(--ar-text-3)]">%</span>
                    </span>
                  </div>
                  {c.description && <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--ar-text-2)]">{c.description}</p>}
                  <div className="dt-bar mt-4" role="presentation">
                    <motion.span initial={{ scaleX: 0 }} whileInView={{ scaleX: share / 100 }} viewport={{ once: true, margin: "-6% 0px" }} transition={{ duration: 1.1, delay: 0.15 + i * 0.07, ease: EASE }} />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/* ── Schedule ─────────────────────────────────────────────────────────────── */

export function ScheduleTab({ h }: { h: HackathonDetail }) {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  return (
    <section aria-labelledby="schedule-heading" className="ar-raised p-5 sm:p-8">
      <SectionTitle
        icon={CalendarClock}
        id="schedule-heading"
        title="Schedule"
        action={tz ? <span className="ar-chip">Your local time · {tz.replace("_", " ")}</span> : undefined}
      />
      <div className="mt-7">
        <Timeline events={h.timeline} />
      </div>
    </section>
  );
}

/* ── Rules & FAQ ──────────────────────────────────────────────────────────── */

export function RulesTab({ h }: { h: HackathonDetail }) {
  return (
    <div className="space-y-10">
      <section aria-labelledby="eligibility-heading" className="grid gap-3.5 sm:grid-cols-3">
        <h2 id="eligibility-heading" className="sr-only">
          At a glance
        </h2>
        <Fact icon={ShieldCheck} label="Who can take part" value={h.eligibility ?? "Every student on AptRun."} />
        <Fact icon={Users} label="Team size" value={h.team_size.max === 1 ? "Solo only" : h.team_size.min === h.team_size.max ? `Exactly ${h.team_size.max}` : h.team_size.min === 1 ? `Solo, or up to ${h.team_size.max}` : `${h.team_size.min}–${h.team_size.max} members`} />
        <Fact icon={Globe} label="Format" value={h.mode === "online" ? "Online" : `${MODE_LABEL[h.mode]}${h.location ? ` · ${h.location}` : ""}`} />
      </section>

      <Reveal y={14}>
        <section aria-labelledby="rules-heading" className="ar-raised dt-prose p-5 sm:p-8">
          <SectionTitle icon={Info} id="rules-heading" title="Rules" />
          {h.rules ? <ArenaMarkdown>{h.rules}</ArenaMarkdown> : <p className="ar-body">The host hasn&apos;t added specific rules. Build something you&apos;re proud of, be honest about what&apos;s yours, and credit what isn&apos;t.</p>}
        </section>
      </Reveal>

      {h.faqs.length > 0 && (
        <section aria-labelledby="faq-heading">
          <SectionTitle icon={ScrollText} id="faq-heading" title="Frequently asked questions" />
          <Accordion items={h.faqs} />
        </section>
      )}
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="ar-raised dt-lift p-5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[rgb(var(--ar-a)/0.3)] to-[rgb(var(--ar-b)/0.18)] ring-1 ring-white/15">
        <Icon className="h-[18px] w-[18px] text-white" aria-hidden />
      </span>
      <p className="mb-1.5 mt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ar-text-3)]">{label}</p>
      <p className="text-[15px] font-semibold leading-snug text-white">{value}</p>
    </div>
  );
}

/* ── Updates ──────────────────────────────────────────────────────────────── */

export function UpdatesTab({ h }: { h: HackathonDetail }) {
  if (h.announcements.length === 0) {
    return (
      <EmptyState icon={Megaphone} title="No updates yet">
        The organisers will post announcements here — schedule changes, mentor office hours, reminders. Check back during the event.
      </EmptyState>
    );
  }

  return (
    <ol className="space-y-3.5" aria-label="Updates from the organisers">
      {h.announcements.map((a, i) => {
        const fresh = Date.now() - new Date(a.created_at).getTime() < 72 * 3_600_000;

        return (
          <Reveal as="li" key={a.id} delay={Math.min(i, 4) * 0.06} y={14}>
            <article className="ar-raised dt-lift relative overflow-hidden p-5 sm:p-6">
              {fresh && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-[rgb(var(--ar-a))] to-[rgb(var(--ar-b))]" />}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <HostMark host={h.host} size={28} />
                <h3 className="ar-h3 text-white">{a.title}</h3>
                {fresh && <span className="ar-chip ar-chip-accent !px-2.5 !py-1 !text-[10.5px] font-bold uppercase tracking-wider">New</span>}
                <time dateTime={a.created_at} className="ml-auto text-[12.5px] font-medium text-[color:var(--ar-text-3)]" title={formatDateTime(a.created_at)}>
                  {relativeTime(a.created_at)}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-line text-[14.5px] leading-[1.7] text-[color:var(--ar-text-2)]">{a.body}</p>
              {a.author && <p className="mt-3.5 text-[12.5px] font-medium text-[color:var(--ar-text-3)]">Posted by {a.author}</p>}
            </article>
          </Reveal>
        );
      })}
    </ol>
  );
}
