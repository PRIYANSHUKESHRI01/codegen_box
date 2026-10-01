import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { FEATURES_DATA } from "@/data/navigation";
import { Briefcase, BookOpen, Upload, BarChart3, Cpu, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, typeof Cpu> = {
  Briefcase,
  BookOpen,
  Upload,
  BarChart3,
  Cpu,
  Users2,
};

/** Uneven "bento" spans by position — first card anchors the row, last card closes full-width. Nothing else about the 6 real feature entries changes. */
function spanFor(index: number): string {
  if (index === 0) return "md:col-span-2";
  if (index === FEATURES_DATA.length - 1) return "md:col-span-3";
  return "md:col-span-1";
}

export function Features() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-surface/20 border-t border-border-subtle">
      <Container size="xl">
        <SectionHeading
          badge="Platform Architecture"
          title="Everything Your Placement Cell"
          highlight="Actually Needs"
          description="From onboarding a batch to mapping a campus drive to tracking who got placed — one platform, not five spreadsheets."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES_DATA.map((feat, i) => {
            const Icon = iconMap[feat.icon] || Cpu;
            const isAnchor = i === 0;
            return (
              <Card
                key={feat.id}
                variant="interactive"
                className={cn(
                  "p-6 sm:p-7 flex flex-col justify-between group",
                  spanFor(i),
                  isAnchor && "bg-gradient-to-br from-accent-primary/[0.04] to-transparent"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={cn(
                        "rounded-control bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary group-hover:scale-110 group-hover:bg-accent-primary group-hover:text-white transition-all duration-200",
                        isAnchor ? "w-14 h-14" : "w-12 h-12"
                      )}
                    >
                      <Icon className={isAnchor ? "w-7 h-7" : "w-6 h-6"} />
                    </div>
                    <span className="text-2xs font-mono uppercase tracking-wider font-semibold text-text-muted px-2.5 py-0.5 rounded bg-elevated border border-border-subtle">
                      {feat.tag}
                    </span>
                  </div>

                  <h3 className={cn("font-bold text-primary mb-2 group-hover:text-accent-primary transition-colors", isAnchor ? "text-xl" : "text-lg")}>
                    {feat.title}
                  </h3>

                  <p className={cn("text-text-secondary leading-relaxed", isAnchor ? "text-base max-w-xl" : "text-sm")}>
                    {feat.description}
                  </p>
                </div>

                <div className="pt-4 mt-6 border-t border-border-subtle/60 flex items-center text-xs font-mono text-text-muted group-hover:text-primary transition-colors">
                  <span>Learn more about {feat.tag}</span>
                  <span className="ml-1 group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
