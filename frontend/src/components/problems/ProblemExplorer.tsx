"use client";

import { useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { DifficultyBadge } from "./DifficultyBadge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { usePublicSampleProblems, usePublicStats } from "@/lib/usePublicPlatformData";
import { ArrowRight } from "lucide-react";

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
          badge="Problem Explorer"
          title="Battle-Tested"
          highlight="Algorithmic Problems"
          description="A real sample from the catalog — dynamic programming, graphs, trees, and everything in between, judged against real, hidden test cases."
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-card bg-surface border border-border-subtle p-5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {problems.map((problem) => (
              <Card
                key={problem.slug}
                variant="interactive"
                onClick={() => router.push("/signup")}
                className="card-shine p-5 sm:p-6 flex flex-col justify-between group transition-all duration-300 border-border-subtle hover:border-accent-primary/40 hover:shadow-card"
              >
                <div>
                  <div className="mb-3">
                    <DifficultyBadge difficulty={titleCase(problem.difficulty)} size="sm" />
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-primary group-hover:text-accent-primary transition-colors line-clamp-1 mb-2.5">
                    {problem.title}
                  </h3>

                  <div className="flex flex-wrap gap-1.5">
                    {problem.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-mono px-2 py-0.5 rounded-[5px] bg-elevated/80 border border-border-subtle text-text-muted group-hover:border-border-strong transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-end text-xs text-text-secondary group-hover:text-accent-primary group-hover:translate-x-1 transition-all font-sans font-semibold">
                  <span>Solve</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </div>
              </Card>
            ))}
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
