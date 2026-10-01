import { ExternalLink, BookMarked, Lock } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { DSA_SHEETS, DsaSheet } from "@/data/dsaSheets";
import { cn } from "@/lib/utils";

const ACCENT_STYLES: Record<DsaSheet["accent"], { poster: string; badge: string }> = {
  indigo: {
    poster: "from-indigo-500/20 via-indigo-500/5 to-transparent text-indigo-500",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  cyan: {
    poster: "from-cyan-500/20 via-cyan-500/5 to-transparent text-cyan-500",
    badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  },
  amber: {
    poster: "from-amber-500/20 via-amber-500/5 to-transparent text-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
};

/**
 * Community-trusted DSA roadmaps, credited to their real creators — not
 * authored by CodeGen Box. The "poster" slot is a placeholder gradient +
 * initial for now (swap in a real poster image per sheet later by setting
 * `posterUrl` in data/dsaSheets.ts). "Practice on CodeGen Box" stays a
 * disabled badge until the question bank behind it actually exists — this
 * section is deliberately honest about being early, not overclaiming a
 * feature that isn't built yet.
 */
export function DsaSheets() {
  return (
    <section id="dsa-sheets" className="py-20 sm:py-28 border-t border-border-subtle">
      <Container size="xl">
        <SectionHeading
          badge="Structured Prep"
          title="Follow the Sheets"
          highlight="Top Coders Already Trust"
          description="The same community-built roadmaps thousands of engineers used to crack their offers — credited to their creators, coming to CodeGen Box's own question bank soon."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DSA_SHEETS.map((sheet) => {
            const style = ACCENT_STYLES[sheet.accent];
            return (
              <Card key={sheet.id} className="p-0 overflow-hidden flex flex-col group">
                {/* Poster slot — placeholder gradient + initial until a real poster image is added */}
                <div
                  className={cn(
                    "relative h-36 flex items-center justify-center bg-gradient-to-br border-b border-border-subtle overflow-hidden",
                    style.poster
                  )}
                >
                  {sheet.posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sheet.posterUrl} alt={sheet.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-grid-pattern opacity-30" />
                      <span className="relative text-5xl font-black tracking-tight opacity-80">
                        {sheet.name.charAt(0)}
                      </span>
                    </>
                  )}
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={cn("text-3xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border", style.badge)}>
                      {sheet.problemCount}
                    </span>
                    <span className="text-2xs text-text-muted font-mono">{sheet.creatorPlatform}</span>
                  </div>

                  <h3 className="text-lg font-bold text-primary mb-1">{sheet.name}</h3>
                  <p className="text-xs text-text-muted mb-3">
                    Curated by <span className="font-semibold text-text-secondary">{sheet.creator}</span>
                  </p>
                  <p className="text-sm text-text-secondary leading-relaxed flex-1">{sheet.description}</p>

                  <div className="mt-5 pt-4 border-t border-border-subtle flex flex-col gap-2">
                    <a
                      href={sheet.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-control border border-border-subtle bg-elevated hover:bg-surface-hover text-text-secondary hover:text-primary text-xs font-bold transition-all"
                    >
                      <span>View Original Sheet</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-control border border-dashed border-border-subtle text-text-muted text-xs font-semibold cursor-not-allowed">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Practice on CodeGen Box — Coming Soon</span>
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-text-muted">
          <BookMarked className="w-3.5 h-3.5" />
          <span>A CodeGen Box question bank for each sheet is on the roadmap — this is a preview, not a claim it&apos;s live.</span>
        </div>
      </Container>
    </section>
  );
}
