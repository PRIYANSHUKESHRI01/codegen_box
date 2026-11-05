"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { Reveal } from "@/components/landing/Reveal";

type Action = { label: string; href: string } | { label: string; demo: true };

interface CtaBandProps {
  badge?: string;
  title: string;
  highlight?: string;
  description: string;
  primary: Action;
  secondary?: { label: string; href: string; icon?: ReactNode };
  /** Small print under the buttons. */
  points?: readonly string[];
}

/** The close of a content page: one card, one main action (a link or the demo form) and one quieter one. */
export function CtaBand({ badge = "Placement season is open", title, highlight, description, primary, secondary, points }: CtaBandProps) {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <section aria-labelledby="cta-band-heading" className="relative overflow-hidden border-t border-border-subtle py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="lp-blob-a absolute left-[12%] top-1/4 h-[320px] w-[420px] rounded-full bg-accent-primary/20 blur-[90px]" />
        <div className="lp-blob-b absolute bottom-0 right-[10%] h-[320px] w-[420px] rounded-full bg-accent-secondary/20 blur-[90px]" />
      </div>

      <Container size="lg">
        <Reveal>
          <div className="lp-gborder relative overflow-hidden rounded-card border border-accent-primary/20 bg-surface/90 p-6 text-center shadow-[0_30px_80px_-30px_rgba(79,70,229,0.5)] backdrop-blur sm:p-12 lg:rounded-panel lg:p-14">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)]" />
            <div className="relative mx-auto max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-3 py-1 text-xs font-semibold text-accent-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{badge}</span>
              </div>
              <h2 id="cta-band-heading" className="mb-4 text-balance text-[1.875rem] font-bold leading-[1.1] tracking-[-0.03em] text-primary sm:text-4xl lg:text-[2.6rem]">
                {title}
                {highlight && (
                  <>
                    {" "}
                    <span className="lp-gradient-text">{highlight}</span>
                  </>
                )}
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-balance text-base font-medium leading-relaxed text-text-secondary sm:text-[1.0625rem]">{description}</p>

              <div className="mx-auto flex w-full max-w-sm flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row">
                {"demo" in primary ? (
                  <Button variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => setDemoOpen(true)} className="hp-btn-sheen min-h-[48px] w-full justify-center sm:w-auto">
                    {primary.label}
                  </Button>
                ) : (
                  <ButtonLink href={primary.href} variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />} className="hp-btn-sheen min-h-[48px] w-full justify-center sm:w-auto">
                    {primary.label}
                  </ButtonLink>
                )}
                {secondary && (
                  <ButtonLink href={secondary.href} variant="secondary" size="lg" leftIcon={secondary.icon} className="min-h-[48px] w-full justify-center sm:w-auto">
                    {secondary.label}
                  </ButtonLink>
                )}
              </div>

              {points && points.length > 0 && (
                <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-text-secondary">
                  {points.map((t) => (
                    <li key={t} className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-status-success" />
                      {t}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Reveal>
      </Container>

      <TalkToTeamModal key={demoOpen ? "open" : "closed"} open={demoOpen} onClose={() => setDemoOpen(false)} defaultAudience="institution" />
    </section>
  );
}

/** A quiet row of links to the other public pages, for a visitor who is not sure this is theirs. */
export function CrossLinks({ items }: { items: readonly { href: string; label: string; body: string }[] }) {
  return (
    <section aria-label="Elsewhere on AptRun" className="border-t border-border-subtle py-12 sm:py-14">
      <Container size="lg">
        <ul className="grid gap-3 sm:grid-cols-3">
          {items.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="group flex h-full items-start justify-between gap-3 rounded-card border border-border-subtle bg-surface p-5 shadow-subtle transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_20px_40px_-22px_rgba(79,70,229,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
              >
                <span>
                  <span className="block text-sm font-bold text-primary">{l.label}</span>
                  <span className="mt-0.5 block text-xs font-medium leading-snug text-text-secondary">{l.body}</span>
                </span>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
