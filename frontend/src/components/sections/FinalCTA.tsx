"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, GraduationCap, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";

export function FinalCTA() {
  const [contact, setContact] = useState<"institution" | "company" | null>(null);

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden border-t border-border-subtle">
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="lp-blob-a absolute top-1/4 left-[12%] w-[420px] h-[320px] rounded-full bg-accent-primary/20 blur-[90px]" />
        <div className="lp-blob-b absolute bottom-0 right-[10%] w-[420px] h-[320px] rounded-full bg-accent-secondary/20 blur-[90px]" />
      </div>

      <Container size="lg">
        <div className="lp-gborder relative rounded-card lg:rounded-panel bg-surface/90 backdrop-blur border border-accent-primary/20 p-6 sm:p-12 lg:p-16 text-center shadow-[0_30px_80px_-30px_rgba(79,70,229,0.5)] overflow-hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)] pointer-events-none" />

          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/25 text-xs font-semibold text-accent-primary mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Placement season is open</span>
            </div>

            <h2 className="text-[1.875rem] sm:text-4xl lg:text-[2.75rem] font-bold text-primary tracking-[-0.03em] leading-[1.1] mb-4 text-balance">
              Run your next placement season on{" "}
              <span className="lp-gradient-text">
                one platform.
              </span>
            </h2>

            <p className="text-base sm:text-[1.0625rem] font-medium text-secondary max-w-lg mx-auto mb-8 leading-relaxed text-balance">
              One workspace for your placement cell, your students and the recruiters who hire them.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-7 w-full max-w-sm sm:max-w-none mx-auto">
              <Button
                variant="primary"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => setContact("institution")}
                className="w-full sm:w-auto min-h-[46px] justify-center hp-btn-sheen"
              >
                Book a demo
              </Button>
              <ButtonLink
                href="/signup"
                variant="secondary"
                size="lg"
                leftIcon={<GraduationCap className="w-4 h-4 text-accent-primary" />}
                className="w-full sm:w-auto min-h-[46px] justify-center"
              >
                I&apos;m a student
              </ButtonLink>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-text-secondary">
              {["Campus drives, end to end", "Bulk batch onboarding", "Recruiters already on the platform"].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
      <TalkToTeamModal
        key={contact ?? "closed"}
        open={contact !== null}
        onClose={() => setContact(null)}
        defaultAudience={contact ?? "institution"}
      />
    </section>
  );
}
