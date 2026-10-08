import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Eye, ShieldCheck, UserCheck } from "lucide-react";
import { MarketingShell } from "@/components/marketing-site/MarketingShell";
import { PageHero } from "@/components/marketing-site/PageHero";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES, type Tone } from "@/components/ui/tones";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { FOOTER_FEATURE_GROUPS, featureHref, getFeaturePage } from "@/data/featurePages";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About — AptRun",
  description: "AptRun is the placement sandbox for colleges, built by Mellow Vault.",
  alternates: { canonical: "/about" },
};

const PRINCIPLES: { icon: typeof ShieldCheck; tone: Tone; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    tone: "emerald",
    title: "Scores that are earned",
    body: "Assessments are proctored and code runs against real test cases, so a score means something to a college and to a recruiter.",
  },
  {
    icon: UserCheck,
    tone: "cyan",
    title: "Students stay in control",
    body: "Nobody enters the recruiter-facing talent pool without consent, and students can hide their profile whenever they choose.",
  },
  {
    icon: Eye,
    tone: "violet",
    title: "AI with a human behind it",
    body: "AI scores instantly with readable feedback, and a human reviewer can view and override any result.",
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <PageHero
        eyebrow="About"
        title="Built for the people who run"
        highlight="placement season"
        description="AptRun is the placement sandbox for colleges: one place to run campus drives, prepare every student, and meet the companies that hire them."
      />

      <section className="pb-16 sm:pb-24">
        <Container size="md">
          <div className="rounded-panel bg-surface border border-border-subtle shadow-sm p-7 sm:p-10 space-y-5 text-base sm:text-lg text-text-secondary leading-relaxed">
            <p>
              Placement cells coordinate dozens of recruiters, hundreds of students and a calendar that never stops moving, often across spreadsheets and chat groups. Students prepare with generic advice that has nothing to do with the company visiting next week.
            </p>
            <p>
              AptRun puts the whole season in one place. The placement cell maps recruiters, sets eligibility and tracks every drive. Each student gets a personal learning centre and company-specific prep. Hiring companies are on the platform too, so the students who perform are the ones who get noticed.
            </p>
            <p>
              AptRun is a product of{" "}
              <a href="https://mellowvault.com" target="_blank" rel="noopener noreferrer" className="font-bold text-accent-primary hover:underline underline-offset-4">
                Mellow Vault
              </a>
              , a unit of Prayukti Development Private Limited.
            </p>
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-24 border-y border-border-subtle bg-surface/30">
        <Container size="xl">
          <SectionHeading badge="What we hold to" title="Three things we" highlight="won't compromise on" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRINCIPLES.map((p) => {
              const tone = TONES[p.tone];
              const Icon = p.icon;
              return (
                <SpotlightCard
                  key={p.title}
                  className={cn(
                    "group relative rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                    tone.shadow
                  )}
                >
                  <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent pointer-events-none", tone.wash)} />
                  <div className={cn("relative w-12 h-12 rounded-control border flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-105", tone.icon, tone.iconHover)}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="relative text-lg font-bold text-primary mb-2">{p.title}</h3>
                  <p className="relative text-sm text-text-secondary leading-relaxed">{p.body}</p>
                </SpotlightCard>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container size="xl">
          <SectionHeading badge="Explore" title="See what's" highlight="inside" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FOOTER_FEATURE_GROUPS.map((g) => {
              const tone = TONES[g.tone];
              const Icon = g.icon;
              return (
                <div key={g.title} className="rounded-card bg-surface border border-border-subtle shadow-sm p-6">
                  <h3 className="mb-4">
                    <Link href={g.href} className="group inline-flex items-center gap-2.5">
                      <span className={cn("w-8 h-8 rounded-md border flex items-center justify-center", tone.icon)}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <span className="text-sm font-mono font-bold uppercase tracking-wider text-primary group-hover:text-accent-primary transition-colors">{g.title}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-accent-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </h3>
                  <ul className="space-y-2.5">
                    {g.slugs.map((slug) => (
                      <li key={slug}>
                        <Link href={featureHref(slug)} className="group inline-flex items-center gap-1 text-sm font-semibold text-text-secondary hover:text-primary transition-colors">
                          <span>{getFeaturePage(slug)?.label ?? slug}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="mt-10 flex justify-center">
            <ButtonLink href="/contact" size="lg" className="hp-btn-sheen">
              Talk to Our Team
            </ButtonLink>
          </div>
        </Container>
      </section>
    </MarketingShell>
  );
}
