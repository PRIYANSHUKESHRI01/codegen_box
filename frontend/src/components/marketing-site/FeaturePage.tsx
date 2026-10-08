import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight, Info } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES } from "@/components/ui/tones";
import { FeatureCta } from "@/components/marketing-site/FeatureCta";
import { AUDIENCE_META } from "@/data/featureAudience";
import { featureHref, getFeaturePage, type FeaturePageData } from "@/data/featurePages";
import { cn } from "@/lib/utils";

const NODE_FILL: Record<string, string> = {
  indigo: "from-indigo-500 to-indigo-600 shadow-[0_8px_24px_-6px_rgba(99,102,241,0.7)]",
  cyan: "from-cyan-500 to-sky-600 shadow-[0_8px_24px_-6px_rgba(6,182,212,0.7)]",
  violet: "from-violet-500 to-violet-600 shadow-[0_8px_24px_-6px_rgba(139,92,246,0.7)]",
  emerald: "from-emerald-500 to-teal-600 shadow-[0_8px_24px_-6px_rgba(16,185,129,0.7)]",
  amber: "from-amber-500 to-orange-500 shadow-[0_8px_24px_-6px_rgba(245,158,11,0.7)]",
  rose: "from-rose-500 to-pink-500 shadow-[0_8px_24px_-6px_rgba(244,63,94,0.7)]",
};

export function FeaturePage({ page }: { page: FeaturePageData }) {
  const tone = TONES[page.tone];
  const Icon = page.icon;
  const audience = AUDIENCE_META[page.audience];
  const related = page.related.map((slug) => getFeaturePage(slug)).filter((p): p is FeaturePageData => Boolean(p));

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
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-text-secondary mb-8">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            <Link href={audience.href} className="hover:text-primary transition-colors">{audience.label}</Link>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-primary">{page.label}</span>
          </nav>

          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-7">
              <span className={cn("inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border mb-6", tone.pill)}>
                <Icon className="w-3.5 h-3.5" />
                {audience.label}
              </span>
              <h1 className="text-[2.5rem] sm:text-5xl lg:text-[3.5rem] font-bold tracking-[-0.035em] text-primary leading-[1.06] mb-5 text-balance">
                {page.title}
              </h1>
              <p className="text-base sm:text-lg font-medium text-text-secondary leading-relaxed max-w-2xl mb-8">{page.tagline}</p>
              <FeatureCta audience={page.audience} />
            </div>

            {/* At a glance */}
            <div className="lg:col-span-5">
              <SpotlightCard className="relative rounded-panel bg-surface border border-border-strong shadow-[0_30px_70px_-30px_rgba(39,47,92,0.45)] p-7 sm:p-8 overflow-hidden">
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent", tone.wash)} />
                <Icon aria-hidden="true" className={cn("absolute -right-6 -top-6 w-40 h-40 opacity-[0.07]", tone.text)} strokeWidth={1.25} />
                <div className="relative">
                  <div className={cn("w-14 h-14 rounded-control border flex items-center justify-center mb-5", tone.icon)}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <p className="text-2xs font-mono font-bold uppercase tracking-wider text-text-secondary mb-4">At a glance</p>
                  <ul className="space-y-3.5">
                    {page.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-3 text-base font-semibold text-primary leading-snug">
                        <span className={cn("mt-0.5 w-6 h-6 rounded-md border flex items-center justify-center shrink-0", tone.icon)}>
                          <Check className="w-3.5 h-3.5" strokeWidth={3} />
                        </span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </SpotlightCard>
            </div>
          </div>
        </Container>
      </section>

      {/* Overview */}
      <section className="py-12 sm:py-16 border-y border-border-subtle bg-surface/40">
        <Container size="md">
          <div className={cn("border-l-4 pl-6 sm:pl-8", tone.edge)}>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary mb-3">Why it matters</p>
            <p className="text-xl sm:text-2xl font-semibold text-primary leading-relaxed text-balance">{page.overview}</p>
          </div>
        </Container>
      </section>

      {/* Capabilities */}
      <section className="py-20 sm:py-28">
        <Container size="xl">
          <SectionHeading badge="What you get" title={`Inside ${page.label}`} description="Everything below is part of the product today." />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {page.capabilities.map((c) => {
              const CIcon = c.icon;
              return (
                <SpotlightCard
                  key={c.title}
                  className={cn(
                    "group relative rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                    tone.shadow
                  )}
                >
                  <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent pointer-events-none", tone.wash)} />
                  <div
                    className={cn(
                      "relative w-12 h-12 rounded-control border flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-105",
                      tone.icon,
                      tone.iconHover
                    )}
                  >
                    <CIcon className="w-6 h-6" />
                  </div>
                  <h3 className="relative text-lg font-bold text-primary mb-2">{c.title}</h3>
                  <p className="relative text-sm text-text-secondary leading-relaxed">{c.body}</p>
                </SpotlightCard>
              );
            })}
          </div>

          {page.note && (
            <div className={cn("mt-8 flex items-start gap-4 rounded-card border border-border-subtle border-l-4 bg-surface p-5 sm:p-6", tone.edge)}>
              <span className={cn("w-10 h-10 rounded-control border flex items-center justify-center shrink-0", tone.icon)}>
                <Info className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-primary mb-1">{page.note.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{page.note.body}</p>
              </div>
            </div>
          )}
        </Container>
      </section>

      {/* Steps */}
      <section className="relative py-20 sm:py-28 border-t border-border-subtle bg-surface/20 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-dot-pattern opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_30%,black,transparent)] pointer-events-none"
        />
        <Container size="lg" className="relative">
          <SectionHeading badge="How it works" title="Three steps," highlight="no heavy rollout" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {page.steps.map((s, i) => (
              <div key={s.title} className="flex flex-col">
                <span
                  className={cn(
                    "w-12 h-12 rounded-full bg-gradient-to-br text-white flex items-center justify-center font-mono text-base font-black ring-4 ring-background mb-4",
                    NODE_FILL[page.tone]
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

      {/* Related */}
      <section className="py-20 sm:py-24 border-t border-border-subtle">
        <Container size="xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary text-center mb-10">Keep exploring</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {related.map((r) => {
              const RIcon = r.icon;
              const rt = TONES[r.tone];
              return (
                <Link key={r.slug} href={featureHref(r.slug)} className="group block">
                  <SpotlightCard
                    className={cn(
                      "h-full rounded-card bg-surface border border-border-subtle shadow-sm p-6 overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                      rt.shadow
                    )}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className={cn("w-11 h-11 rounded-control border flex items-center justify-center transition-all duration-300", rt.icon, rt.iconHover)}>
                        <RIcon className="w-5 h-5" />
                      </span>
                      <ArrowUpRight className="w-5 h-5 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                    </div>
                    <h3 className="text-base font-bold text-primary mb-1.5">{r.label}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">{r.tagline}</p>
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
                {page.audience === "students" ? "Start preparing today" : "See it running on your campus"}
              </h2>
              <p className="text-base sm:text-[1.0625rem] font-medium text-text-secondary mb-7">
                {page.audience === "students"
                  ? "Create your free student account and open your learning centre."
                  : "Tell us about your placement season and we will show you how it works, usually within one business day."}
              </p>
              <FeatureCta audience={page.audience} className="justify-center" />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
