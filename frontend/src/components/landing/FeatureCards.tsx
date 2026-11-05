import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES, type Tone } from "@/components/ui/tones";
import { cn } from "@/lib/utils";

export interface FeatureCard {
  icon: LucideIcon;
  tone: Tone;
  /** A small label top-right ("Placement cell", "Expert"). */
  badge?: string;
  title: string;
  body: string;
  href?: string;
  cta?: string;
}

/**
 * A grid of capability cards: a tinted wash and icon tile in the card's own colour, a lift and a coloured shadow on hover, a spotlight
 * that follows the pointer, and an optional "Learn more" that goes to the feature's page.
 */
export function FeatureCards({ items, columns = 3 }: { items: readonly FeatureCard[]; columns?: 2 | 3 }) {
  return (
    <ul className={cn("grid gap-5", columns === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2")}>
      {items.map((f, i) => {
        const t = TONES[f.tone];
        const FeatureIcon = f.icon;
        return (
          <li key={f.title}>
            <Reveal delay={(i % 3) * 0.07} className="h-full">
              <SpotlightCard className={cn("group relative flex h-full flex-col overflow-hidden rounded-card border border-border-subtle bg-surface p-6 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-border-strong sm:p-7", t.shadow)}>
                <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent", t.wash)} />
                <div className="relative mb-5 flex items-center justify-between gap-3">
                  <span className={cn("flex h-12 w-12 items-center justify-center rounded-control border transition-all duration-300 group-hover:scale-105", t.icon, t.iconHover)}>
                    <FeatureIcon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  {f.badge && <span className={cn("rounded-full border px-2.5 py-1 text-2xs font-mono font-bold uppercase tracking-wider", t.pill)}>{f.badge}</span>}
                </div>
                <h3 className="relative text-lg font-bold tracking-[-0.01em] text-primary">{f.title}</h3>
                <p className="relative mt-2 flex-1 text-sm font-medium leading-relaxed text-text-secondary">{f.body}</p>
                {f.href && (
                  <Link href={f.href} className={cn("relative mt-5 inline-flex items-center gap-1 text-sm font-bold underline-offset-4 hover:underline", t.text)}>
                    {f.cta ?? "Learn more"} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                )}
              </SpotlightCard>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}
