import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { PageHero } from "@/components/marketing-site/PageHero";

export interface LegalSection {
  id: string;
  title: string;
  /** Paragraphs, or a list when the item is an array of strings. */
  body: (string | string[])[];
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

/** Long-form layout for the privacy policy and terms: sticky contents list beside readable prose. */
export function LegalPage({ eyebrow, title, updated, intro, sections }: LegalPageProps) {
  return (
    <>
      <PageHero eyebrow={eyebrow} title={title} description={intro} />

      <section className="pb-20 sm:pb-28">
        <Container size="lg">
          <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-10 lg:gap-14">
            <aside className="lg:sticky lg:top-24 self-start">
              <p className="text-xs font-mono font-bold uppercase tracking-wider text-text-secondary mb-3">On this page</p>
              <ol className="space-y-1 border-l border-border-subtle">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block -ml-px pl-4 py-1.5 text-sm font-medium text-text-secondary border-l border-transparent hover:text-primary hover:border-accent-primary transition-colors"
                    >
                      {i + 1}. {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </aside>

            <article className="rounded-panel bg-surface border border-border-subtle shadow-sm p-6 sm:p-10">
              <p className="text-xs font-semibold text-text-secondary mb-8">Last updated: {updated}</p>
              <div className="space-y-10">
                {sections.map((s, i) => (
                  <section key={s.id} id={s.id} className="scroll-mt-24">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-primary mb-4">
                      {i + 1}. {s.title}
                    </h2>
                    <div className="space-y-4 text-base text-text-secondary leading-relaxed">
                      {s.body.map((block, j) =>
                        Array.isArray(block) ? (
                          <ul key={j} className="list-disc pl-5 space-y-2 marker:text-accent-primary">
                            {block.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p key={j}>{block}</p>
                        )
                      )}
                    </div>
                  </section>
                ))}
              </div>

              <div className="mt-12 pt-6 border-t border-border-subtle text-sm text-text-secondary">
                Questions about this page? <Link href="/contact" className="font-bold text-accent-primary hover:underline">Contact us</Link> or write to{" "}
                <a href="mailto:support@mellowvault.com" className="font-bold text-accent-primary hover:underline">support@mellowvault.com</a>.
              </div>
            </article>
          </div>
        </Container>
      </section>
    </>
  );
}
