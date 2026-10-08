import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES, Tone } from "@/components/ui/tones";
import { cn } from "@/lib/utils";
import { Terminal, ShieldCheck, Sparkles, UserCheck } from "lucide-react";

const PRINCIPLES: {
  icon: typeof Terminal;
  tone: Tone;
  label: string;
  title: string;
  description: string;
}[] = [
  {
    icon: ShieldCheck,
    tone: "emerald",
    label: "Fairness",
    title: "Proctored, not honour-system",
    description: "Fullscreen enforcement, tab-switch detection and automatic lockouts keep every test fair.",
  },
  {
    icon: Terminal,
    tone: "indigo",
    label: "Accuracy",
    title: "Real code execution",
    description: "Every submission compiles and runs against real test cases. Nothing is simulated.",
  },
  {
    icon: UserCheck,
    tone: "cyan",
    label: "Privacy",
    title: "Students stay in control",
    description: "Nobody joins the talent pool without consent, and students can hide their profile at any time.",
  },
  {
    icon: Sparkles,
    tone: "violet",
    label: "Oversight",
    title: "AI speed, human oversight",
    description: "AI scores instantly with readable feedback, and a human reviewer can override any result.",
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
    <section className="relative py-20 sm:py-28 bg-surface/20 border-t border-border-subtle overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-dot-pattern opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_30%,black,transparent)] pointer-events-none"
      />
      <Container size="xl" className="relative">
        <SectionHeading
          badge="Built to be trusted"
          title="Placement results you can"
          highlight="stand behind"
          description="A score only helps a recruiter if it's fair, and a student if it's theirs to share."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PRINCIPLES.map((p, i) => {
            const Icon = p.icon;
            const tone = TONES[p.tone];
            return (
              <SpotlightCard
                key={p.title}
                className={cn(
                  "group relative p-6 flex flex-col rounded-card bg-surface border border-border-subtle shadow-sm overflow-hidden hover:-translate-y-1.5 hover:border-border-strong transition-all duration-300",
                  tone.shadow
                )}
              >
                {/* Tone wash + oversized index numeral as a quiet watermark */}
                <div aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent pointer-events-none", tone.wash)} />
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -right-1 -top-3 font-mono text-[88px] leading-none font-black opacity-[0.07] select-none transition-transform duration-500 group-hover:scale-110",
                    tone.text
                  )}
                >
                  0{i + 1}
                </span>

                <div className="relative flex items-center gap-3 mb-5">
                  <div
                    className={cn(
                      "w-12 h-12 rounded-control border flex items-center justify-center transition-all duration-300 group-hover:scale-105",
                      tone.icon,
                      tone.iconHover
                    )}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className={cn("text-2xs font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border", tone.pill)}>
                    {p.label}
                  </span>
                </div>

                <h3 className="relative text-base font-bold tracking-[-0.01em] text-primary mb-2">{p.title}</h3>
                <p className="relative text-sm font-medium text-text-secondary leading-relaxed">{p.description}</p>

                {/* Accent bar that fills in on hover */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute bottom-0 left-0 h-[3px] w-0 group-hover:w-full bg-gradient-to-r transition-all duration-500",
                    tone.bar
                  )}
                />
              </SpotlightCard>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
