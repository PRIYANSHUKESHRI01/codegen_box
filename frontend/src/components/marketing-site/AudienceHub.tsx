import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES } from "@/components/ui/tones";
import { FeatureCta } from "@/components/marketing-site/FeatureCta";
import { AUDIENCE_HUBS, type AudienceHubData } from "@/data/audienceHubs";
import { featureHref, getFeaturePage, type FeaturePageData } from "@/data/featurePages";
import { cn } from "@/lib/utils";

const NODE_FILL: Record<string, string> = {
  indigo: "from-indigo-500 to-indigo-600 shadow-[0_8px_24px_-6px_rgba(99,102,241,0.7)]",
  cyan: "from-cyan-500 to-sky-600 shadow-[0_8px_24px_-6px_rgba(6,182,212,0.7)]",
  violet: "from-violet-500 to-violet-600 shadow-[0_8px_24px_-6px_rgba(139,92,246,0.7)]",
};

/**
 * Overview page for one audience. It is what the footer headings, the nav and
 * the feature-page breadcrumbs link to, and it sends people on to the detail
 * pages. Also doubles as an audience-specific landing page.
 */
export function AudienceHub({ hub }: { hub: AudienceHubData }) {
  const tone = TONES[hub.tone];
  const Icon = hub.icon;
  const features = hub.featureSlugs.map((s) => getFeaturePage(s)).filter((p): p is FeaturePageData => Boolean(p));
  const others = AUDIENCE_HUBS.filter((h) => h.id !== hub.id);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden pt-10 sm:pt-16 pb-16 sm:pb-24">
        <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
          <div className={cn("absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b to-transparent", tone.wash)} />
          <div className="lp-blob-a absolute -top-20 left-[6%] w-[480px] h-[360px] rounded-full bg-accent-primary/15 blur-[100px]" />
          <div className="lp-blob-b absolute top-10 right-[4%] w-[420px] h-[340px] rounded-full bg-accent-secondary/15 blur-[100px]" />
          <div className="absolute inset-0 bg-grid-pattern opacity-40 dark:opacity-25 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]" />
        </div>

        <Container size="xl">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-8">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-primary">{hub.label}</span>
          </nav>

          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-7">
              <span className={cn("inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-6", tone.pill)}>
                <Icon className="w-3.5 h-3.5" />
                {hub.eyebrow}
              </span>
              <h1 className="text-[2.5rem] sm:text-5xl lg:text-[3.5rem] font-bold tracking-[-0.035em] text-primary leading-[1.06] mb-5 text-balance">
                {hub.title} <span className="lp-gradient-text">{hub.highlight}</span>
              </h1>
              <p className="text-base sm:text-lg font-medium text-text-secondary leading-relaxed max-w-2xl mb-8">{hub.description}</p>
              <FeatureCta audience={hub.audience} />
            </div>

            {/* What's inside: a quick index of the detail pages */}
            <div className="lg:col-span-5">
              <SpotlightCard className="relative rounded-panel bg-surface border border-border-strong shadow-[0_30px_70px_-30px_rgba(39,47,92,0.45)] p-6 sm:p-7 overflow-hidden">
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", tone.wash)} />
                <Icon aria-hidden="true" className={cn("absolute -right-6 -top-6 w-40 h-40 opacity-[0.07]", tone.text)} strokeWidth={1.25} />
                <p className="relative text-2xs font-mono font-bold uppercase tracking-wider text-text-secondary mb-3">What&apos;s inside</p>
                <ul className="relative divide-y divide-border-subtle">
                  {features.map((f) => {
                    const FIcon = f.icon;
                    return (
                      <li key={f.slug}>
                        <Link href={featureHref(f.slug)} className="group flex items-center gap-3 py-3 text-base font-semibold text-primary hover:text-accent-primary transition-colors">
                          <span className={cn("w-9 h-9 rounded-control border flex items-center justify-center shrink-0 transition-all duration-300", TONES[f.tone].icon, TONES[f.tone].iconHover)}>
                            <FIcon className="w-4.5 h-4.5" />
                          </span>
                          <span className="flex-1">{f.label}</span>
                          <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent-primary group-hover:translate-x-1 transition-all" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </SpotlightCard>
            </div>
          </div>
        </Container>
      </section>

      {/* Outcomes */}
      <section className="py-16 sm:py-24 border-y border-border-subtle bg-surface/40">
        <Container size="xl">
          <SectionHeading badge="What changes" title="Less juggling," highlight="more clarity" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {hub.outcomes.map((o) => {
              const OIcon = o.icon;
              return (
                <SpotlightCard
                  key={o.title}
                  className={cn(
                    "group relative rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                    tone.shadow
                  )}
                >
                  <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent pointer-events-none", tone.wash)} />
                  <div className={cn("relative w-12 h-12 rounded-control border flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-105", tone.icon, tone.iconHover)}>
                    <OIcon className="w-6 h-6" />
                  </div>
                  <h3 className="relative text-lg font-bold text-primary mb-2">{o.title}</h3>
                  <p className="relative text-sm text-text-secondary leading-relaxed">{o.body}</p>
                </SpotlightCard>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Feature pages */}
      <section className="py-20 sm:py-28">
        <Container size="xl">
          <SectionHeading badge="Explore" title={`Everything ${hub.label.toLowerCase()},`} highlight="in detail" description="Each capability has its own page, with what it does and how it works." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {features.map((f) => {
              const FIcon = f.icon;
              const ft = TONES[f.tone];
              return (
                <Link key={f.slug} href={featureHref(f.slug)} className="group block">
                  <SpotlightCard
                    className={cn(
                      "relative h-full rounded-card bg-surface border border-border-subtle shadow-sm p-6 sm:p-7 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                      ft.shadow
                    )}
                  >
                    <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent pointer-events-none", ft.wash)} />
                    <div className="relative flex items-start justify-between mb-5">
                      <span className={cn("w-12 h-12 rounded-control border flex items-center justify-center transition-all duration-300 group-hover:scale-105", ft.icon, ft.iconHover)}>
                        <FIcon className="w-6 h-6" />
                      </span>
                      <ArrowUpRight className="w-5 h-5 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>
                    <h3 className="relative text-xl font-bold text-primary mb-2">{f.label}</h3>
                    <p className="relative text-sm sm:text-base text-text-secondary leading-relaxed mb-5">{f.tagline}</p>
                    <ul className="relative flex flex-wrap gap-2">
                      {f.highlights.map((h) => (
                        <li key={h} className={cn("text-2xs font-semibold px-2.5 py-1 rounded-full border", ft.pill)}>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </SpotlightCard>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Steps */}
      <section className="relative py-20 sm:py-28 border-t border-border-subtle bg-surface/20 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-dot-pattern opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_30%,black,transparent)] pointer-events-none"
        />
        <Container size="lg" className="relative">
          <SectionHeading badge="Getting started" title="Up and running in" highlight="three steps" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {hub.steps.map((s, i) => (
              <div key={s.title} className="flex flex-col">
                <span
                  className={cn(
                    "w-12 h-12 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-mono text-base font-black ring-4 ring-background mb-4",
                    NODE_FILL[hub.tone]
                  )}
                >
                  0{i + 1}
                </span>
                <SpotlightCard className="flex-1 rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden">
                  <h3 className="text-lg font-bold text-primary mb-2">{s.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{s.body}</p>
                </SpotlightCard>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Other audiences */}
      <section className="py-16 sm:py-20 border-t border-border-subtle">
        <Container size="lg">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary text-center mb-8">One platform, three audiences</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {others.map((o) => {
              const OIcon = o.icon;
              const ot = TONES[o.tone];
              return (
                <Link key={o.id} href={o.href} className="group block">
                  <SpotlightCard
                    className={cn(
                      "relative h-full rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                      ot.shadow
                    )}
                  >
                    <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none", ot.wash)} />
                    <div className="relative flex items-center gap-4">
                      <span className={cn("w-12 h-12 rounded-control border flex items-center justify-center shrink-0 transition-all duration-300", ot.icon, ot.iconHover)}>
                        <OIcon className="w-6 h-6" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-2xs font-mono font-bold uppercase tracking-wider mb-0.5", ot.text)}>{o.label}</p>
                        <p className="text-base font-bold text-primary">
                          {o.title} {o.highlight}
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-accent-primary group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                  </SpotlightCard>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Closing CTA */}
      <section className="pb-20 sm:pb-28">
        <Container size="lg">
          <div className="lp-gborder relative rounded-panel bg-surface border border-accent-primary/20 p-8 sm:p-12 text-center overflow-hidden shadow-[0_30px_80px_-30px_rgba(79,70,229,0.5)]">
            <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent", tone.wash)} />
            <div className="relative max-w-2xl mx-auto">
              <h2 className="text-[1.75rem] sm:text-4xl font-bold tracking-[-0.03em] text-primary mb-3 text-balance">
                {hub.audience === "students" ? "Start preparing today" : "See it running for you"}
              </h2>
              <p className="text-base sm:text-[1.0625rem] font-medium text-text-secondary mb-7">
                {hub.audience === "students"
                  ? "Create your free student account and open your learning centre."
                  : "Tell us about your placement season and we will show you how it works, usually within one business day."}
              </p>
              <FeatureCta audience={hub.audience} className="justify-center" />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
