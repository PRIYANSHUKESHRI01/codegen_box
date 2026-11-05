"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, GraduationCap, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { Reveal } from "@/components/landing/Reveal";

/** The close: one card, the same two doors as the hero, and the three reasons again in a line. */
export function LandingCta() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <section aria-labelledby="cta-heading" className="relative overflow-hidden border-t border-border-subtle py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="lp-blob-a absolute left-[12%] top-1/4 h-[320px] w-[420px] rounded-full bg-accent-primary/20 blur-[90px]" />
        <div className="lp-blob-b absolute bottom-0 right-[10%] h-[320px] w-[420px] rounded-full bg-accent-secondary/20 blur-[90px]" />
      </div>

      <Container size="lg">
        <Reveal>
          <div className="lp-gborder relative overflow-hidden rounded-card border border-accent-primary/20 bg-surface/90 p-6 text-center shadow-[0_30px_80px_-30px_rgba(79,70,229,0.5)] backdrop-blur sm:p-12 lg:rounded-panel lg:p-16">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)]" />

            <div className="relative mx-auto max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-3 py-1 text-xs font-semibold text-accent-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Placement season is open</span>
              </div>

              <h2 id="cta-heading" className="mb-4 text-balance text-[1.875rem] font-bold leading-[1.1] tracking-[-0.03em] text-primary sm:text-4xl lg:text-[2.75rem]">
                Run your next placement season on <span className="lp-gradient-text">one platform.</span>
              </h2>

              <p className="mx-auto mb-8 max-w-lg text-balance text-base font-medium leading-relaxed text-text-secondary sm:text-[1.0625rem]">
                One workspace for your placement cell and your students, with a clear path to the employers on Mellow Vault.
              </p>

              <div className="mx-auto mb-7 flex w-full max-w-sm flex-col items-center justify-center gap-3 sm:max-w-none sm:flex-row">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="h-4 w-4" />}
                  onClick={() => setDemoOpen(true)}
                  className="hp-btn-sheen min-h-[48px] w-full justify-center sm:w-auto"
                >
                  Book a demo
                </Button>
                <ButtonLink
                  href="/signup"
                  variant="secondary"
                  size="lg"
                  leftIcon={<GraduationCap className="h-4 w-4 text-accent-primary" />}
                  className="min-h-[48px] w-full justify-center sm:w-auto"
                >
                  I&apos;m a student
                </ButtonLink>
              </div>

              <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-text-secondary">
                {["Campus drives, end to end", "Bulk batch onboarding", "Employers already hiring on Mellow Vault"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-status-success" aria-hidden="true" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </Container>

      <TalkToTeamModal key={demoOpen ? "open" : "closed"} open={demoOpen} onClose={() => setDemoOpen(false)} defaultAudience="institution" />
    </section>
  );
}
