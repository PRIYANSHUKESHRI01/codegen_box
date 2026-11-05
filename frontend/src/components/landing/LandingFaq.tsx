"use client";

import Link from "next/link";
import { ChevronDown, Mail } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/landing/Reveal";
import { buildFaqs } from "@/data/landing";
import { useLandingFacts } from "@/lib/useLandingData";

const SUPPORT_EMAIL = "support@mellowvault.com";

/**
 * The questions a college or a student asks before saying yes, six of them. Native <details>, so it works without scripting and is
 * keyboard- and screen-reader-friendly for free. The answers quote the same rules the rest of the page does (the Vault bar, the contest
 * hour, the day the board resets) from the backend, and the page's search-engine data is built from this very list.
 */
export function LandingFaq() {
  const faqs = buildFaqs(useLandingFacts());

  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16 border-t border-border-subtle py-16 sm:py-24">
      <Container size="lg">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <Reveal className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <span className="mb-4 inline-flex items-center rounded-full border border-accent-primary/25 bg-accent-primary/10 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider text-accent-primary">
                FAQ
              </span>
              <h2 id="faq-heading" className="text-balance text-[1.75rem] font-bold leading-[1.12] tracking-[-0.03em] text-primary sm:text-4xl">
                Questions, answered{" "}
                <span className="bg-gradient-to-r from-accent-primary via-indigo-400 to-accent-secondary bg-clip-text text-transparent">plainly</span>
              </h2>
              <p className="mt-4 text-sm font-medium leading-relaxed text-text-secondary">
                Our team answers within one business day.{" "}
                <Link href="/contact" className="font-bold text-accent-primary hover:underline">
                  Contact us
                </Link>{" "}
                or write to{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1 font-bold text-accent-primary hover:underline">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            </div>
          </Reveal>

          <div className="space-y-3 lg:col-span-8">
            {faqs.map((f, i) => (
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
        </div>
      </Container>
    </section>
  );
}
