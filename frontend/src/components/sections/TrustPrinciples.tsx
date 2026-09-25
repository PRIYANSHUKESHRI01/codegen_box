import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Card } from "@/components/ui/Card";
import { Terminal, ShieldCheck, Sparkles, UserCheck } from "lucide-react";

const PRINCIPLES = [
  {
    icon: Terminal,
    title: "Real Code Execution",
    description: "Every submission actually compiles and runs against real test cases — nothing here is simulated or estimated.",
  },
  {
    icon: ShieldCheck,
    title: "Proctored Assessments",
    description: "Fullscreen enforcement, tab-switch detection, and an automatic lockout policy keep tests fair for every candidate.",
  },
  {
    icon: Sparkles,
    title: "Transparent AI Scoring",
    description: "Every AI interview score comes with specific, readable feedback — never a black-box number with no explanation.",
  },
  {
    icon: UserCheck,
    title: "Human Oversight, Always",
    description: "AI scores instantly so nobody waits, but a human reviewer can view and override any result at any time.",
  },
];

/**
 * Replaces the old Testimonials section — that one quoted 4 fabricated
 * named people from a "Demo Institute of Engineering" with stock photos.
 * This is the honest substitute: what actually makes the platform's numbers
 * trustworthy, not fake praise from people who don't exist.
 */
export function TrustPrinciples() {
  return (
    <section className="py-20 sm:py-28 bg-surface/20 border-t border-border-subtle">
      <Container size="xl">
        <SectionHeading
          badge="Built To Be Trusted"
          title="Every Number Here Is"
          highlight="Earned, Not Claimed"
          description="This is what actually makes a rating, a score, or a shortlist something a college or company can stand behind."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PRINCIPLES.map((p) => {
            const Icon = p.icon;
            return (
              <Card key={p.title} className="p-6 flex flex-col gap-3">
                <div className="w-11 h-11 rounded-control bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-primary">{p.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{p.description}</p>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
