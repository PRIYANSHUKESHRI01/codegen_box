"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Check, GraduationCap } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { PriceTag } from "@/components/pricing/PriceTag";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { Reveal } from "@/components/landing/Reveal";
import { TONES } from "@/components/ui/tones";
import { INDIVIDUAL_PLANS } from "@/data/pricing";
import { usePublicPlans } from "@/lib/usePublicPlans";
import { cn } from "@/lib/utils";
import type { PublicPlan } from "@/types/pricing";

const COLLEGE_POINTS = [
  "Your whole batch onboarded, with logins sent for you",
  "Drives, proctoring, analytics and placement reports",
  "Mellow Academy programmes for students who need to upskill",
];

/** What a plan adds beyond practice, read from the plan's own entitlements so it can never disagree with what the server grants. */
function unlocks(plan: PublicPlan): string[] {
  const e = plan.entitlements;
  return [e.vault_access && "Mellow Vault", e.hackathon_access && "Hack Arena", e.project_lab_access && "Project Lab", e.drive_access && "Campus drives"].filter(
    (x): x is string => typeof x === "string"
  );
}

/**
 * The cost question, answered with the real numbers: the student plans exactly as the superadmin has them set (price, discount, what
 * each includes) read live from the same endpoint as the pricing page, and a college plan that is scoped with our team, so it has no
 * price to quote. A price change reaches this card within a poll, with no redeploy.
 */
export function LandingPricing() {
  const [demoOpen, setDemoOpen] = useState(false);
  const { plans, status } = usePublicPlans();
  const student = TONES.cyan;
  const college = TONES.indigo;

  return (
    <section id="pricing-glance" aria-labelledby="pricing-heading" className="scroll-mt-16 border-t border-border-subtle py-16 sm:py-24">
      <Container size="lg">
        <Reveal className="mx-auto mb-10 max-w-3xl text-center sm:mb-12">
          <span className="mb-4 inline-flex items-center rounded-full border border-accent-primary/25 bg-accent-primary/10 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider text-accent-primary">
            Pricing
          </span>
          <h2 id="pricing-heading" className="text-balance text-[1.75rem] font-bold leading-[1.12] tracking-[-0.03em] text-primary sm:text-4xl lg:text-[2.6rem]">
            Free for students.{" "}
            <span className="bg-gradient-to-r from-accent-primary via-indigo-400 to-accent-secondary bg-clip-text text-transparent">Shaped to your campus.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-base font-medium leading-relaxed text-text-secondary sm:text-[1.0625rem]">
            Students can start without paying anything. Colleges get a plan scoped with our team, because no two campuses look alike.
          </p>
        </Reveal>

        <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-5">
          <Reveal className="lg:col-span-3">
            <SpotlightCard className={cn("group relative flex h-full flex-col overflow-hidden rounded-card border border-border-subtle bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-border-strong sm:p-7", student.shadow)}>
              <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", student.wash)} />
              <div className="relative mb-5 flex items-center gap-3">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-control border", student.icon)}>
                  <GraduationCap className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-2xs font-mono font-bold uppercase tracking-wider", student.pill)}>Students</span>
                </div>
              </div>

              {status === "ready" && plans && plans.length > 0 ? (
                <ul className="relative flex-1 space-y-3">
                  {plans.map((plan) => {
                    const featured = plan.code === "expert";
                    const adds = unlocks(plan);
                    return (
                      <li
                        key={plan.code}
                        className={cn(
                          "flex flex-col gap-3 rounded-2xl border p-4 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between",
                          featured ? "border-accent-primary/35 bg-accent-primary/[0.05]" : "border-border-subtle bg-elevated/40 hover:border-border-strong"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-primary">{plan.name}</h3>
                            {featured && <span className="rounded-full bg-accent-primary px-2 py-0.5 text-3xs font-bold uppercase tracking-wider text-white">Most complete</span>}
                          </div>
                          <p className="mt-0.5 text-xs font-medium leading-snug text-text-secondary">{INDIVIDUAL_PLANS.find((p) => p.id === plan.code)?.tagline ?? ""}</p>
                          {adds.length > 0 && (
                            <p className="mt-2 flex flex-wrap gap-1.5">
                              {adds.map((a) => (
                                <span key={a} className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface px-2 py-0.5 text-3xs font-semibold text-text-secondary">
                                  <Check className="h-2.5 w-2.5 text-status-success" strokeWidth={3} aria-hidden="true" />
                                  {a}
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                        <PriceTag plan={plan} size="compact" className="shrink-0 sm:text-right" />
                      </li>
                    );
                  })}
                </ul>
              ) : status === "loading" ? (
                <div className="relative flex-1 space-y-3" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-2xl bg-elevated/70" />
                  ))}
                </div>
              ) : (
                <p className="relative flex-1 text-sm font-medium leading-relaxed text-text-secondary">Students can start free. See every plan and what it includes on the pricing page.</p>
              )}

              <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/signup" variant="secondary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />}>
                  Create student account
                </ButtonLink>
                <Link href="/pricing" className={cn("inline-flex items-center justify-center gap-1 text-sm font-bold underline-offset-4 hover:underline", student.text)}>
                  Compare student plans <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-2">
            <SpotlightCard className="lp-gborder group relative flex h-full flex-col overflow-hidden rounded-card border border-accent-primary/30 bg-surface p-6 shadow-[0_24px_60px_-28px_rgba(79,70,229,0.45)] transition-all duration-300 hover:-translate-y-1.5 sm:p-7">
              <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", college.wash)} />
              <div className="relative mb-4 flex items-center gap-3">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-control border", college.icon)}>
                  <Building2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className={cn("rounded-full border px-2.5 py-1 text-2xs font-mono font-bold uppercase tracking-wider", college.pill)}>Colleges</span>
              </div>
              <h3 className="relative text-2xl font-bold tracking-[-0.02em] text-primary">Scoped with our team</h3>
              <p className="relative mt-1 text-sm font-medium text-text-secondary">There is no price list, so you only pay for what your campus needs.</p>
              <ul className="relative my-6 flex-1 space-y-3">
                {COLLEGE_POINTS.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-sm font-medium text-text-secondary">
                    <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", college.icon)}>
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
              <p className="relative mb-5 text-xs font-medium leading-relaxed text-text-secondary">Tell us about your campus and our team replies within one business day.</p>
              <Button variant="primary" size="lg" fullWidth className="hp-btn-sheen relative" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={() => setDemoOpen(true)}>
                Book a demo
              </Button>
              <Link href="/pricing" className={cn("relative mt-3 inline-flex items-center justify-center gap-1 text-sm font-bold underline-offset-4 hover:underline", college.text)}>
                See what colleges get <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </SpotlightCard>
          </Reveal>
        </div>
      </Container>

      <TalkToTeamModal key={demoOpen ? "open" : "closed"} open={demoOpen} onClose={() => setDemoOpen(false)} defaultAudience="institution" />
    </section>
  );
}
