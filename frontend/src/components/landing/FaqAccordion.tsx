import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";
import type { FaqItem } from "@/data/landing";

/**
 * Questions as native <details>: no scripting needed, keyboard- and screen-reader-friendly for free, and every answer is in the page for
 * a search engine to read. Each one rises in as it scrolls into view.
 */
export function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((f, i) => (
        <Reveal key={f.q} delay={Math.min(i, 3) * 0.05}>
          <details className="group rounded-card border border-border-subtle bg-surface shadow-subtle transition-all duration-200 hover:border-border-strong open:border-accent-primary/30 open:shadow-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-4 text-base font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
              {f.q}
              <ChevronDown className="h-5 w-5 shrink-0 text-text-secondary transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-5 pb-5 text-sm leading-relaxed text-text-secondary sm:px-6 sm:text-base">
              {f.a}
              {f.link && (
                <>
                  {" "}
                  <Link href={f.link.href} className="font-bold text-accent-primary hover:underline">
                    {f.link.label}
                  </Link>
                  .
                </>
              )}
            </div>
          </details>
        </Reveal>
      ))}
    </div>
  );
}
