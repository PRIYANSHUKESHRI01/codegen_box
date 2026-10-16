"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Code2,
  Crown,
  GraduationCap,
  Layers,
  Mail,
  ShieldCheck,
  Smartphone,
  Server,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { MELLOW_ACADEMY } from "@/data/pricing";

interface AcademyCardProps {
  /** Opens the enquiry form ("Talk to Our Team", Mellow Academy mode). */
  onContact: () => void;
  /** The signed-in student holds this plan (an enrolled Mellow Academy student): say so instead of selling it to them. */
  isCurrent?: boolean;
  /** Days left on the plan they hold; null = unknown or not theirs. */
  daysLeft?: number | null;
}

const PROGRAMME_ICON: Record<string, LucideIcon> = {
  mern: Layers,
  laravel: Server,
  fullstack: Code2,
  mobile: Smartphone,
};

const HIGHLIGHT_ICON: Record<string, LucideIcon> = {
  placement: ShieldCheck,
  years: CalendarClock,
  everything: Sparkles,
};

/**
 * The Grandmaster card: Mellow Academy. It is the one card with no price and no
 * Buy button — the programme is arranged with our team — so its body is the
 * programmes and what you get, and its call to action is "Contact our team".
 * Everything else about it is deliberately the same as the other two cards
 * (same surface, border, icon tile, badge and button), so the three read as one
 * set of plans.
 *
 * Words come from MELLOW_ACADEMY (data/pricing.ts). What the server actually
 * enforces for these students — every feature unlocked for three years — is the
 * Grandmaster plan row, which the superadmin grants once the team has enrolled
 * someone.
 */
export function AcademyCard({ onContact, isCurrent = false, daysLeft = null }: AcademyCardProps) {
  const academy = MELLOW_ACADEMY;

  return (
    <section
      aria-labelledby="academy-heading"
      data-testid="academy-card"
      className="relative flex h-full flex-col rounded-panel border border-border-subtle bg-surface shadow-subtle transition-all duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-card"
    >
      <div className="flex h-full flex-col p-6 sm:p-7">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-control border border-border-subtle bg-elevated text-text-secondary">
            <Crown className="h-6 w-6" aria-hidden />
          </div>
          {isCurrent ? (
            <span className="rounded-full border border-status-success/30 bg-status-success/15 px-2.5 py-1 text-3xs font-bold uppercase tracking-wide text-status-success">
              Current Plan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-3xs font-bold uppercase tracking-wide text-text-muted">
              <GraduationCap className="h-3 w-3" aria-hidden />
              {academy.eyebrow}
            </span>
          )}
        </div>

        <h3 id="academy-heading" className="mb-1.5 text-xl font-extrabold tracking-tight text-primary">
          Grandmaster
        </h3>
        <p className="mb-6 text-sm leading-relaxed text-text-secondary">
          {academy.headline} Learn to build real products, get placed, and keep your edge for three years.
        </p>

        {/* Programmes */}
        <div className="mb-6 border-t border-border-subtle pt-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{academy.programmesHeading}</h4>
          <ul className="grid gap-2.5 xs:grid-cols-2">
            {academy.programmes.map((programme) => {
              const Icon = PROGRAMME_ICON[programme.id] ?? Code2;
              return (
                <li key={programme.id} className="rounded-control border border-border-subtle bg-elevated/60 p-3">
                  <Icon className="mb-2 h-4 w-4 text-text-secondary" aria-hidden />
                  <p className="text-sm font-bold leading-snug text-primary">{programme.name}</p>
                  <p className="mt-0.5 text-2xs leading-snug text-text-muted">{programme.detail}</p>
                </li>
              );
            })}
          </ul>
        </div>

        {/* What you get */}
        <div className="mb-7 flex-1 border-t border-border-subtle pt-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{academy.includesHeading}</h4>
          <ul className="space-y-3.5">
            {academy.highlights.map((highlight) => {
              const Icon = HIGHLIGHT_ICON[highlight.id] ?? BadgeCheck;
              return (
                <li key={highlight.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-snug text-primary">{highlight.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">{highlight.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Contact — in place of a price */}
        <div className="border-t border-border-subtle pt-5">
          {isCurrent && (
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-status-success">
              <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden />
              {daysLeft !== null && daysLeft > 0
                ? `You're enrolled — ${daysLeft} day${daysLeft === 1 ? "" : "s"} of access left`
                : "You're enrolled in Mellow Academy"}
            </p>
          )}
          {!isCurrent && <p className="mb-3 text-center text-xs font-medium text-text-secondary">{academy.priceNote}</p>}

          <button
            type="button"
            onClick={onContact}
            className="flex w-full items-center justify-center gap-2 rounded-btn border border-border-strong bg-elevated py-3 text-sm font-bold text-primary transition-all hover:bg-surface-hover"
          >
            <span>{isCurrent ? "Ask our team" : academy.contactLabel}</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-2xs text-text-muted">
            <Mail className="h-3 w-3 shrink-0" aria-hidden />
            <span>
              Prefer email?{" "}
              <a href={`mailto:${academy.email}?subject=Mellow%20Academy%20enquiry`} className="font-semibold text-accent-primary underline-offset-2 hover:underline">
                {academy.email}
              </a>
            </span>
          </p>
          <p className="mt-2 text-center text-3xs leading-snug text-text-muted">{academy.terms}</p>
        </div>
      </div>
    </section>
  );
}
