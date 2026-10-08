"use client";

import { useState } from "react";
import { ArrowRight, Briefcase, Building2, GraduationCap, Mail } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES, type Tone } from "@/components/ui/tones";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { cn } from "@/lib/utils";

type Audience = "institution" | "company";

interface Option {
  id: string;
  tone: Tone;
  icon: typeof Building2;
  title: string;
  body: string;
  cta: string;
  audience?: Audience;
  href?: string;
}

const OPTIONS: Option[] = [
  {
    id: "college",
    tone: "indigo",
    icon: Building2,
    title: "I run placements at a college",
    body: "Tell us about your cohort and your placement season and we will show you how the platform fits.",
    cta: "Book a Demo",
    audience: "institution",
  },
  {
    id: "recruiter",
    tone: "violet",
    icon: Briefcase,
    title: "I'm hiring for a company",
    body: "Post openings, reach partner campuses and screen with proctored assessments and AI interviews.",
    cta: "Talk to Our Team",
    audience: "company",
  },
  {
    id: "student",
    tone: "cyan",
    icon: GraduationCap,
    title: "I'm a student",
    body: "Create your free account and open your personal learning centre. Accounts for students are self-serve.",
    cta: "Create Student Account",
    href: "/signup",
  },
];

export function ContactOptions() {
  const [audience, setAudience] = useState<Audience | null>(null);

  return (
    <section className="pb-20 sm:pb-28">
      <Container size="lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {OPTIONS.map((o) => {
            const tone = TONES[o.tone];
            const Icon = o.icon;
            return (
              <SpotlightCard
                key={o.id}
                className={cn(
                  "group relative flex flex-col rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                  tone.shadow
                )}
              >
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent pointer-events-none", tone.wash)} />
                <div
                  className={cn(
                    "relative w-12 h-12 rounded-control border flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-105",
                    tone.icon,
                    tone.iconHover
                  )}
                >
                  <Icon className="w-6 h-6" />
                </div>
                <h2 className="relative text-lg font-bold text-primary mb-2">{o.title}</h2>
                <p className="relative text-sm text-text-secondary leading-relaxed mb-6 flex-1">{o.body}</p>
                {o.href ? (
                  <ButtonLink href={o.href} variant="secondary" size="lg" fullWidth rightIcon={<ArrowRight className="w-4 h-4" />}>
                    {o.cta}
                  </ButtonLink>
                ) : (
                  <Button
                    variant={o.id === "college" ? "primary" : "secondary"}
                    size="lg"
                    fullWidth
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={() => setAudience(o.audience ?? "institution")}
                  >
                    {o.cta}
                  </Button>
                )}
              </SpotlightCard>
            );
          })}
        </div>

        <div className="mt-8 rounded-card bg-surface border border-border-subtle shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
              <Mail className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-base font-bold text-primary">Prefer email?</h2>
              <p className="text-sm text-text-secondary">A real person on the team replies, usually within one business day.</p>
            </div>
          </div>
          <a
            href="mailto:support@mellowvault.com"
            className="shrink-0 text-base font-bold text-accent-primary hover:underline underline-offset-4"
          >
            support@mellowvault.com
          </a>
        </div>
      </Container>

      <TalkToTeamModal
        key={audience ?? "closed"}
        open={audience !== null}
        onClose={() => setAudience(null)}
        defaultAudience={audience ?? "institution"}
      />
    </section>
  );
}
