"use client";

import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DifficultyBadge } from "./DifficultyBadge";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES, Tone } from "@/components/ui/tones";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { usePublicSampleProblems, usePublicStats } from "@/lib/usePublicPlatformData";
import { ArrowRight } from "lucide-react";

const DIFFICULTY_TONE: Record<string, Tone> = { easy: "emerald", medium: "amber", hard: "rose" };

function titleCase(difficulty: string): string {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
}

/**
 * A real sample from the catalog (GET /public/problems/sample) — no search
 * or filter chrome, deliberately. That UI made sense over a "1,400+"
 * catalog; it doesn't over a 9-problem honest preview, where "filtering"
 * would just be theater around the same 9 cards. The full, searchable
 * catalog is what signing up actually unlocks.
 */
export function ProblemExplorer() {
  const router = useRouter();
  const { problems, loading } = usePublicSampleProblems();
  const stats = usePublicStats();

  return (
    <section id="problems" className="py-20 sm:py-28">
      <Container size="xl">
        <SectionHeading
          badge="Practice arena"
          title="Sharpen the skills"
          highlight="employers test for"
          description="A real sample from the catalog, judged against hidden test cases in C++, Java, Python and JavaScript."
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-card bg-surface border border-border-subtle p-5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {problems.map((problem, i) => {
              const tone = TONES[DIFFICULTY_TONE[problem.difficulty] ?? "indigo"];
              return (
                <SpotlightCard
                  key={problem.slug}
                  onClick={() => router.push("/signup")}
                  className={cn(
                    "group relative p-5 sm:p-6 flex flex-col justify-between rounded-card bg-surface border border-border-subtle shadow-sm overflow-hidden cursor-pointer hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                    tone.shadow
                  )}
                >
                  {/* Difficulty-coloured wash and edge */}
                  <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent pointer-events-none", tone.wash)} />
                  <span aria-hidden="true" className={cn("absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full", tone.dot)} />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-4">
                      <DifficultyBadge difficulty={titleCase(problem.difficulty)} size="sm" />
                      <span className="font-mono text-2xs font-bold text-text-muted">#{String(i + 1).padStart(2, "0")}</span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-primary group-hover:text-accent-primary transition-colors line-clamp-1 mb-3">
                      {problem.title}
                    </h3>

                    <div className="flex flex-wrap gap-1.5">
                      {problem.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-2xs font-mono font-medium px-2 py-0.5 rounded-full bg-elevated border border-border-subtle text-text-secondary group-hover:border-border-strong transition-colors"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="relative pt-4 mt-5 border-t border-border-subtle flex items-center justify-between">
                    <span className="text-2xs font-semibold text-text-secondary">Judged on hidden test cases</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary group-hover:text-white group-hover:bg-accent-primary group-hover:border-accent-primary group-hover:shadow-glow px-3 py-1.5 rounded-full border border-border-strong bg-surface transition-all duration-300">
                      Solve
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        )}

        <div className="mt-12 text-center">
          <Button
            variant="secondary"
            size="lg"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => router.push("/signup")}
          >
            {stats ? `Unlock All ${stats.problems_total} Problems — Free` : "Sign Up Free"}
          </Button>
        </div>
      </Container>
    </section>
  );
}
