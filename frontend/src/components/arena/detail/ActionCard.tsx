"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarDays, CalendarPlus, Check, CheckCircle2, Clock, Eye, Globe, Link2, Lock, MapPin, Rocket, Timer, Trophy, Users, type LucideIcon } from "lucide-react";
import { Countdown } from "@/components/arena/primitives";
import { downloadIcs } from "@/components/arena/detail/calendar";
import { primaryCta, shareUrl, stamp, useCopy, type DetailTab } from "@/components/arena/detail/shared";
import { MODE_LABEL, formatMoney, nextMilestone } from "@/lib/hackathon";
import { cn } from "@/lib/utils";
import type { HackathonDetail } from "@/types/hackathon";

interface ActionCardProps {
  h: HackathonDetail;
  userRole: string;
  onRegister: () => void;
  onOpenTab: (tab: DetailTab) => void;
}

/**
 * The decision panel, drawn as a ticket: a status header, one big call to action and the countdown on
 * top; a dashed tear line; then the stub with the facts and two small utilities (copy the link, add the
 * dates to a calendar). The notches sit exactly on the tear line — the cut is measured, not guessed.
 */
export function ActionCard({ h, userRole, onRegister, onOpenTab }: ActionCardProps) {
  const ticket = useRef<HTMLDivElement>(null);
  const tear = useRef<HTMLDivElement>(null);
  const milestone = nextMilestone(h);
  const cta = primaryCta(h, userRole);
  const WhereIcon = h.mode === "online" ? Globe : MapPin;

  // Keep the side notches level with the perforation however tall the ticket grows.
  useLayoutEffect(() => {
    const t = ticket.current;
    const p = tear.current;
    if (!t || !p) return;

    const apply = () => t.style.setProperty("--cut", `${p.offsetTop + p.offsetHeight / 2}px`);
    apply();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(t);
    return () => ro?.disconnect();
  }, []);

  const capacity = h.max_participants ? Math.min(100, (h.participants_count / h.max_participants) * 100) : null;

  return (
    <aside aria-label="Take part" className="dt-ticket-wrap">
      <div ref={ticket} className="ar-ticket dt-ticket">
        <div className="dt-ticket-top ar-grain px-5 pb-6 pt-5 sm:px-6 sm:pt-6">
          <div className="relative z-10 space-y-4">
            <Status h={h} />

            {cta && (
              <CtaButton cta={cta} onRegister={onRegister} onOpenTab={onOpenTab} />
            )}

            {milestone && h.registration.state !== "closed" && (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-3.5 backdrop-blur-sm">
                <p className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--ar-text-3)]">
                  <Timer className="h-3.5 w-3.5" aria-hidden /> {milestone.label}
                </p>
                <Countdown target={milestone.at} size="sm" className="justify-between" />
              </div>
            )}
          </div>
        </div>

        <div ref={tear} className="ar-perforation" aria-hidden />

        <div className="dt-ticket-stub px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
          <dl className="divide-y divide-white/[0.07] text-[13.5px]">
            <Row icon={Trophy} label="Prize pool" gold>
              {h.prize_pool.amount > 0 ? formatMoney(h.prize_pool.amount, h.prize_pool.currency) : "Perks & recognition"}
            </Row>
            <Row icon={CalendarDays} label="Submissions close">
              {stamp(h.ends_at)}
            </Row>
            <Row icon={Users} label="Team size">
              {h.team_size.max === 1 ? "Solo only" : h.team_size.min === h.team_size.max ? `${h.team_size.max} members` : `${h.team_size.min}–${h.team_size.max} members`}
            </Row>
            <Row icon={WhereIcon} label="Format">
              {h.mode === "online" ? "Online" : `${MODE_LABEL[h.mode]}${h.location ? ` · ${h.location.split("·")[0].trim()}` : ""}`}
            </Row>
            <div className="py-3">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2.5 text-[color:var(--ar-text-3)]">
                  <Rocket className="h-4 w-4 shrink-0" aria-hidden /> Taking part
                </dt>
                <dd className="text-right font-semibold text-white">
                  <span className="ar-num">{h.participants_count.toLocaleString("en-IN")}</span>
                  {h.max_participants !== null && <span className="font-medium text-[color:var(--ar-text-3)]"> / {h.max_participants.toLocaleString("en-IN")}</span>}
                  {h.max_participants === null && <span className="font-medium text-[color:var(--ar-text-3)]"> student{h.participants_count === 1 ? "" : "s"}</span>}
                </dd>
              </div>
              {capacity !== null && (
                <div className="mt-2.5">
                  <div className="ar-progress" role="presentation">
                    <span style={{ width: `${capacity}%` }} />
                  </div>
                  {h.spots_left !== null && (
                    <p className={cn("mt-1.5 text-right text-[12px]", h.spots_left / (h.max_participants ?? 1) < 0.15 ? "font-semibold text-amber-200" : "text-[color:var(--ar-text-3)]")}>
                      {h.spots_left.toLocaleString("en-IN")} spot{h.spots_left === 1 ? "" : "s"} left
                    </p>
                  )}
                </div>
              )}
            </div>
          </dl>

          <Utilities h={h} />
        </div>
      </div>
    </aside>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

function Row({ icon: Icon, label, gold, children }: { icon: LucideIcon; label: string; gold?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <dt className="flex shrink-0 items-center gap-2.5 text-[color:var(--ar-text-3)]">
        <Icon className="h-4 w-4 shrink-0" aria-hidden /> {label}
      </dt>
      <dd className={cn("min-w-0 text-right font-semibold", gold ? "dt-gold-text font-bold" : "text-white")}>{children}</dd>
    </div>
  );
}

function CtaButton({ cta, onRegister, onOpenTab }: { cta: NonNullable<ReturnType<typeof primaryCta>>; onRegister: () => void; onOpenTab: (tab: DetailTab) => void }) {
  const cls = cn("ar-btn dt-cta h-12 w-full text-[15px]", cta.emphasis === "primary" ? "ar-btn-primary" : "ar-btn-ghost");

  if (cta.kind === "link") {
    return (
      <Link href={cta.href} className={cls}>
        {cta.label} <ArrowRight className="dt-cta-arrow h-4 w-4" aria-hidden />
      </Link>
    );
  }

  if (cta.kind === "register") {
    return (
      <button type="button" onClick={onRegister} className={cls}>
        <Rocket className="h-[18px] w-[18px]" aria-hidden /> {cta.label}
      </button>
    );
  }

  return (
    <button type="button" onClick={() => onOpenTab(cta.tab)} className={cls}>
      {cta.label} <ArrowRight className="dt-cta-arrow h-4 w-4" aria-hidden />
    </button>
  );
}

/** Who you are to this hackathon right now, in one line: in, can join, not yet, or too late. */
function Status({ h }: { h: HackathonDetail }) {
  const state = h.registration.state;
  const mine = h.mine;

  let icon: LucideIcon = Lock;
  let tone = "text-[color:var(--ar-text-2)] bg-white/[0.07] ring-white/15";
  let title = "Registration isn't available";
  let sub: ReactNode = "This hackathon isn't accepting registrations.";

  if (h.viewer.is_preview) {
    icon = Eye;
    tone = "text-amber-200 bg-amber-300/10 ring-amber-300/30";
    title = "Host preview";
    sub = `${h.status === "draft" ? "This draft is only visible to you. " : ""}Students see this page with a Register button while registration is open.`;
  } else if (state === "registered" && mine) {
    icon = CheckCircle2;
    tone = "text-emerald-200 bg-emerald-400/12 ring-emerald-300/35";
    title = "You're in";
    sub = (
      <>
        {h.team_size.max === 1 ? "Competing solo" : mine.team_name}
        {mine.submission_status === "submitted" && " · project submitted"}
        {mine.submission_status === "draft" && " · draft saved"}
      </>
    );
  } else if (state === "open") {
    icon = Rocket;
    tone = "text-emerald-200 bg-emerald-400/12 ring-emerald-300/35";
    title = "Registration open";
    sub = `Free to enter · closes ${stamp(h.registration_closes_at)}`;
  } else if (state === "not_open") {
    icon = Clock;
    tone = "text-amber-200 bg-amber-300/10 ring-amber-300/30";
    title = "Opening soon";
    sub = `Registration opens ${stamp(h.registration_opens_at)}.`;
  } else if (state === "full") {
    title = "This hackathon is full";
    sub = "Check the gallery or other events.";
  } else if (state === "closed") {
    title = h.phase === "judging" || h.phase === "completed" ? "This hackathon has finished" : "Registration has closed";
    sub = h.results_published ? "The results are in." : h.phase === "judging" ? "Judges are reviewing the projects." : "See you at the next one.";
  }

  const Icon = icon;

  return (
    <div className="flex items-start gap-3.5">
      <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1", tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-white">{title}</p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[color:var(--ar-text-2)]">{sub}</p>
      </div>
    </div>
  );
}

/** Copy the page's link, or save the dates as an .ics — both entirely client-side. */
function Utilities({ h }: { h: HackathonDetail }) {
  const { copied, copy } = useCopy();
  const [saved, setSaved] = useState(false);

  const addToCalendar = () => {
    downloadIcs(h, shareUrl());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };

  return (
    <div className="mt-1 flex gap-2.5 border-t border-white/[0.07] pt-4">
      <button type="button" onClick={() => copy(shareUrl())} className="dt-util" data-done={copied} aria-live="polite">
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <button type="button" onClick={addToCalendar} className="dt-util" data-done={saved} aria-live="polite" title="Download the kickoff-to-deadline dates as an .ics file">
        {saved ? <CalendarCheck className="h-4 w-4" aria-hidden /> : <CalendarPlus className="h-4 w-4" aria-hidden />}
        {saved ? "Saved .ics" : "Add to calendar"}
      </button>
    </div>
  );
}
