"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, Building2, Check, GraduationCap } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES, Tone } from "@/components/ui/tones";
import { cn } from "@/lib/utils";

type Audience = "candidate" | "employer" | "college";

const AUDIENCES: {
  id: Audience;
  anchor: string;
  icon: typeof Briefcase;
  tone: Tone;
  hub: string;
  hubLabel: string;
  note: string;
  eyebrow: string;
  title: string;
  blurb: string;
  points: string[];
  cta: string;
  featured?: boolean;
}[] = [
  {
    id: "college",
    tone: "indigo",
    hub: "/colleges",
    hubLabel: "colleges",
    note: "Onboarded and set up by our team",
    anchor: "colleges",
    icon: Building2,
    eyebrow: "For placement cells",
    title: "Run your whole placement season in one sandbox",
    blurb: "Everything a TPO manages, from the first recruiter to the last offer letter, without five spreadsheets.",
    points: [
      "Map recruiters and set CGPA, backlog and branch eligibility",
      "Bulk-import an entire batch from a single CSV",
      "Proctored mocks, readiness analytics and exportable reports",
    ],
    cta: "Book a demo",
    featured: true,
  },
  {
    id: "candidate",
    tone: "cyan",
    hub: "/students",
    hubLabel: "students",
    note: "Free to start for every student",
    anchor: "candidates",
    icon: GraduationCap,
    eyebrow: "For students",
    title: "A personal learning centre for every student",
    blurb: "A place to prepare for the exact companies visiting their campus.",
    points: [
      "Company prep packs with past interview questions",
      "A real coding arena, AI mock interviews and soft-skills practice",
      "A live readiness score and a countdown to every drive",
    ],
    cta: "Create student account",
  },
  {
    id: "employer",
    tone: "violet",
    hub: "/recruiters",
    hubLabel: "recruiters",
    note: "Hiring-partner accounts set up by our team",
    anchor: "employers",
    icon: Briefcase,
    eyebrow: "For recruiters",
    title: "Hire from campuses that are already prepared",
    blurb: "Meet students with proctored scores, not just resumes.",
    points: [
      "Post openings and propose them to partner colleges",
      "Proctored coding assessments and AI-scored interviews",
      "Search the consent-based talent pool and invite the best fits",
    ],
    cta: "Partner as a recruiter",
  },
];

export function PlatformRoles() {
  const [contact, setContact] = useState<"company" | "institution" | null>(null);

  return (
    <section id="audiences" className="py-20 sm:py-28 border-t border-border-subtle">
      <Container size="xl">
        <SectionHeading
          badge="Built for the TPO"
          title="One sandbox for your college,"
          highlight="students and recruiters"
          description="Your placement cell, every student and every hiring partner, working from one source of truth."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-stretch">
          {AUDIENCES.map((a) => {
            const Icon = a.icon;
            const tone = TONES[a.tone];
            return (
              <SpotlightCard
                key={a.id}
                id={a.anchor}
                className={cn(
                  "group/card group relative scroll-mt-24 rounded-panel flex flex-col border bg-surface overflow-hidden transition-all duration-300 hover:-translate-y-1.5",
                  a.featured
                    ? "lp-gborder border-accent-primary/30 shadow-[0_24px_60px_-24px_rgba(79,70,229,0.45)]"
                    : cn("border-border-subtle shadow-sm hover:border-border-strong", tone.shadow)
                )}
              >
                {/* Header band: tone wash, grid texture and an oversized watermark icon */}
                <div className="relative px-6 sm:px-8 pt-7 pb-6 overflow-hidden">
                  <div aria-hidden="true" className={cn("absolute inset-0 bg-gradient-to-b to-transparent", tone.wash)} />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_80%_90%_at_100%_0%,black,transparent)]"
                  />
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "absolute -right-6 -top-6 w-36 h-36 opacity-[0.07] transition-transform duration-500 group-hover/card:scale-110 group-hover/card:-rotate-6",
                      tone.text
                    )}
                    strokeWidth={1.25}
                  />

                  {a.featured && (
                    <span className="absolute -top-0 right-6 px-3 py-1 rounded-b-lg bg-accent-primary text-white text-3xs font-mono font-bold uppercase tracking-wider shadow-glow">
                      Built for the TPO
                    </span>
                  )}

                  <div className="relative flex items-center gap-3 mb-5">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-control border flex items-center justify-center transition-all duration-300 group-hover/card:scale-110 group-hover/card:-rotate-3",
                        tone.icon
                      )}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border", tone.pill)}>
                      {a.eyebrow}
                    </span>
                  </div>

                  <h3 className="relative text-xl font-bold tracking-[-0.02em] text-primary leading-snug mb-2">{a.title}</h3>
                  <p className="relative text-15 font-medium text-text-secondary leading-relaxed">{a.blurb}</p>
                </div>

                <div className="flex flex-col flex-1 px-6 sm:px-8 pb-7 sm:pb-8">
                  <ul className="mb-6 flex-1 divide-y divide-border-subtle border-y border-border-subtle">
                    {a.points.map((p) => (
                      <li key={p} className="flex items-start gap-3 py-3 text-sm font-medium text-text-secondary leading-snug">
                        <span className={cn("mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0", tone.icon)}>
                          <Check className="w-3 h-3" strokeWidth={3} />
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>

                  {a.id === "candidate" ? (
                    <ButtonLink href="/signup" variant="secondary" size="lg" fullWidth rightIcon={<ArrowRight className="w-4 h-4" />}>
                      {a.cta}
                    </ButtonLink>
                  ) : (
                    <Button
                      variant={a.featured ? "primary" : "secondary"}
                      className={a.featured ? "hp-btn-sheen" : undefined}
                      size="lg"
                      fullWidth
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                      onClick={() => setContact(a.id === "employer" ? "company" : "institution")}
                    >
                      {a.cta}
                    </Button>
                  )}
                  <p className="mt-3 text-center text-2xs font-semibold text-text-secondary">{a.note}</p>
                  <Link
                    href={a.hub}
                    className={cn("mt-3 inline-flex items-center justify-center gap-1 text-sm font-bold hover:underline underline-offset-4", tone.text)}
                  >
                    Explore {a.hubLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </Container>

      <TalkToTeamModal
        open={contact !== null}
        onClose={() => setContact(null)}
        defaultAudience={contact ?? "institution"}
        key={contact ?? "closed"}
      />
    </section>
  );
}
