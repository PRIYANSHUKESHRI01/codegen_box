import { Container } from "@/components/layout/Container";

interface PageHeroProps {
  eyebrow: string;
  title: string;
  highlight?: string;
  description?: string;
  children?: React.ReactNode;
}

/** Compact hero for About / Contact / legal pages: aurora, grid and a centred headline. */
export function PageHero({ eyebrow, title, highlight, description, children }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden pt-14 sm:pt-20 pb-12 sm:pb-16 text-center">
      <div aria-hidden="true" className="absolute inset-0 -z-10 pointer-events-none">
        <div className="lp-blob-a absolute -top-24 left-[12%] w-[460px] h-[340px] rounded-full bg-accent-primary/15 blur-[100px]" />
        <div className="lp-blob-b absolute -top-10 right-[10%] w-[420px] h-[320px] rounded-full bg-accent-secondary/15 blur-[100px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40 dark:opacity-25 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_0%,black,transparent)]" />
      </div>
      <Container size="md">
        <span className="inline-flex items-center text-2xs font-mono font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border bg-accent-primary/10 border-accent-primary/25 text-accent-primary mb-6">
          {eyebrow}
        </span>
        <h1 className="text-[2.5rem] sm:text-5xl lg:text-[3.5rem] font-bold tracking-[-0.035em] text-primary leading-[1.06] mb-5 text-balance">
          {title}{" "}
          {highlight && <span className="lp-gradient-text">{highlight}</span>}
        </h1>
        {description && <p className="text-base sm:text-lg font-medium text-text-secondary leading-relaxed max-w-2xl mx-auto text-balance">{description}</p>}
        {children}
      </Container>
    </section>
  );
}
