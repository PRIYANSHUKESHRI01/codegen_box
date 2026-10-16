"use client";

import { useState } from "react";
import { ArrowRight, BadgeCheck, CheckCircle2, Code2, GraduationCap, Landmark, Layers, Mail, Server, Smartphone, type LucideIcon } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { INSTITUTION_CONTACT, INSTITUTION_OFFERS, type InstitutionOffer } from "@/data/pricing";
import type { SubscriptionCoverage } from "@/types/subscription";

interface InstitutionPlansProps {
  /** The signed-in TPO's college plan coverage, or null if signed out / not yet loaded. */
  coverage?: SubscriptionCoverage | null;
}

const OFFER_ICON: Record<string, LucideIcon> = { Landmark, GraduationCap };

const PROGRAMME_ICON: Record<string, LucideIcon> = {
  mern: Layers,
  laravel: Server,
  fullstack: Code2,
  mobile: Smartphone,
};

/**
 * The college / university side of /pricing: two offers and no prices. A campus is
 * scoped with our team, so the only call to action is "Contact our team", which
 * opens the same Talk to Our Team form the rest of the marketing site uses — with
 * the college already chosen, the offer they clicked written into the message, and
 * a signed-in TPO's own details filled in. The team reads those in Marketing →
 * Inquiries.
 *
 * Deliberately simple: who each is for in one line, what is in it, one button.
 * Below, the three steps of what happens after they press it.
 */
export function InstitutionPlans({ coverage }: InstitutionPlansProps) {
  const { user, status } = useAuth();
  const [enquiry, setEnquiry] = useState<InstitutionOffer | null>(null);

  const isSignedInTpo = status === "ready" && user?.role === "admin_tpo";
  const collegeHasPlan = coverage?.source === "institution" && (coverage.days_remaining ?? 0) > 0;

  return (
    <section aria-label="Plans for colleges and universities" className="w-full py-10 sm:py-14">
      <Container size="xl">
        <div className="mx-auto max-w-5xl">
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-relaxed text-text-secondary sm:text-base">{INSTITUTION_CONTACT.intro}</p>

          {/* Where the signed-in TPO's own college stands — read-only status */}
          {isSignedInTpo && coverage != null && (
            <div className="mb-6 flex items-center gap-3 rounded-panel border border-border-strong bg-surface p-4 text-sm">
              <BadgeCheck className={cn("h-5 w-5 shrink-0", collegeHasPlan ? "text-status-success" : "text-text-muted")} aria-hidden />
              {collegeHasPlan ? (
                <span className="text-text-secondary">
                  Your college is on the <strong className="text-primary">{coverage?.plan?.name}</strong> plan ·{" "}
                  <strong className="text-primary">{coverage?.days_remaining} days</strong> remaining.
                </span>
              ) : (
                <span className="text-text-secondary">Your college doesn&apos;t have an active plan yet — contact our team below to get started.</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
            {INSTITUTION_OFFERS.map((offer) => (
              <OfferCard key={offer.id} offer={offer} onContact={() => setEnquiry(offer)} />
            ))}
          </div>

          {/* What happens after the button */}
          <div className="mt-12">
            <h2 className="mb-4 text-center text-xs font-bold uppercase tracking-wide text-text-muted">How it works</h2>
            <ol className="grid gap-3 sm:grid-cols-3">
              {INSTITUTION_CONTACT.steps.map((step, index) => (
                <li key={step.title} className="flex items-start gap-3 rounded-panel border border-border-subtle bg-surface p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-primary/10 text-xs font-extrabold text-accent-primary" aria-hidden>
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-primary">{step.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-text-muted">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Prefer email?{" "}
                <a href={`mailto:${INSTITUTION_CONTACT.email}?subject=AptRun%20for%20our%20college`} className="font-semibold text-accent-primary hover:underline">
                  {INSTITUTION_CONTACT.email}
                </a>
              </span>
            </p>
          </div>
        </div>
      </Container>

      <TalkToTeamModal
        open={enquiry !== null}
        onClose={() => setEnquiry(null)}
        defaultAudience="institution"
        lockAudience
        prefill={{
          name: isSignedInTpo ? user?.name : undefined,
          email: isSignedInTpo ? user?.email : undefined,
          phone: isSignedInTpo ? (user?.phone ?? undefined) : undefined,
          organization: isSignedInTpo ? user?.college?.name : undefined,
          message: enquiry?.enquiryMessage,
        }}
      />
    </section>
  );
}

function OfferCard({ offer, onContact }: { offer: InstitutionOffer; onContact: () => void }) {
  const Icon = OFFER_ICON[offer.icon] ?? Landmark;
  const headingId = `offer-${offer.id}-heading`;

  return (
    <article
      aria-labelledby={headingId}
      data-testid={`offer-${offer.id}`}
      className={cn(
        "relative flex h-full flex-col rounded-panel border transition-all duration-200",
        offer.featured
          ? "border-accent-primary/50 bg-surface shadow-glow"
          : "border-border-subtle bg-surface shadow-subtle hover:-translate-y-1 hover:border-border-strong hover:shadow-card"
      )}
    >
      {offer.featured && <div aria-hidden className="absolute -top-0.5 inset-x-0 h-1 rounded-t-panel bg-gradient-to-r from-accent-primary via-indigo-400 to-accent-secondary" />}

      <div className="flex h-full flex-col p-6 sm:p-8">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-control border",
              offer.featured ? "border-accent-primary/30 bg-accent-primary/15 text-accent-primary" : "border-border-subtle bg-elevated text-text-secondary"
            )}
          >
            <Icon className="h-6 w-6" aria-hidden />
          </div>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-3xs font-bold uppercase tracking-wide",
              offer.featured ? "border-accent-primary/30 bg-accent-primary/15 text-accent-primary" : "border-border-subtle bg-elevated text-text-muted"
            )}
          >
            {offer.badge}
          </span>
        </div>

        <h3 id={headingId} className="mb-1.5 text-xl font-extrabold tracking-tight text-primary">
          {offer.name}
        </h3>
        <p className="mb-4 text-sm leading-relaxed text-text-secondary">{offer.tagline}</p>
        <p className="mb-6 rounded-control border border-border-subtle bg-elevated/60 px-3 py-2 text-xs leading-relaxed text-text-secondary">{offer.bestFor}</p>

        {/* Mellow Academy: the programmes, at a glance */}
        {offer.programmes && (
          <div className="mb-6">
            <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Programmes</h4>
            <ul className="flex flex-wrap gap-2">
              {offer.programmes.map((programme) => {
                const ProgrammeIcon = PROGRAMME_ICON[programme.id] ?? Code2;
                return (
                  <li key={programme.id} className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-elevated px-3 py-1.5 text-xs font-bold text-primary">
                    <ProgrammeIcon className="h-3.5 w-3.5 text-accent-primary" aria-hidden />
                    {programme.name}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* What is included */}
        <div className="mb-7 flex-1 border-t border-border-subtle pt-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{offer.programmes ? "What you get" : "What's included"}</h4>
          <ul className="space-y-3">
            {offer.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", offer.featured ? "text-accent-primary" : "text-emerald-500")} aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Where a price would be */}
        <div className="border-t border-border-subtle pt-5">
          <p className="mb-3 text-center text-xs font-medium text-text-secondary">{offer.priceNote}</p>
          <button
            type="button"
            onClick={onContact}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-btn py-3 text-sm font-bold transition-all",
              offer.featured
                ? "bg-accent-primary text-white shadow-subtle hover:bg-accent-primary-hover hover:shadow-glow"
                : "border border-border-strong bg-elevated text-primary hover:bg-surface-hover"
            )}
          >
            <span>{INSTITUTION_CONTACT.contactLabel}</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          {offer.featured && <p className="mt-3 text-center text-3xs leading-snug text-text-muted">{INSTITUTION_CONTACT.terms}</p>}
        </div>
      </div>
    </article>
  );
}
