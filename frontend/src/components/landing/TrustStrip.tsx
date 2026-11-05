import { Gavel, ShieldCheck, UserCheck, Users2 } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/landing/Reveal";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { TONES, type Tone } from "@/components/ui/tones";
import { cn } from "@/lib/utils";

const PRINCIPLES: { icon: typeof ShieldCheck; tone: Tone; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    tone: "emerald",
    title: "Proctored assessments",
    body: "Fullscreen, tab-switch detection and automatic lockouts keep every score defensible.",
  },
  {
    icon: Users2,
    tone: "indigo",
    title: "Role-based access",
    body: "A placement cell sees its own campus. A section coordinator sees only their section.",
  },
  {
    icon: UserCheck,
    tone: "cyan",
    title: "Consent-first Vault",
    body: "A student's profile stays hidden until they say yes, and they can hide it again any time.",
  },
  {
    icon: Gavel,
    tone: "violet",
    title: "AI you can audit",
    body: "Interview scores come with written feedback that a human reviewer can override.",
  },
];

/** The four promises behind the numbers, as one quiet row: enough to answer "can we trust the scores and the data?" without a section each. */
export function TrustStrip() {
  return (
    <section id="trust" aria-labelledby="trust-heading" className="scroll-mt-16 py-16 sm:py-20">
      <Container size="xl">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center">
          <h2 id="trust-heading" className="text-balance text-[1.6rem] font-bold leading-[1.15] tracking-[-0.03em] text-primary sm:text-3xl lg:text-[2.2rem]">
            Fair by design,{" "}
            <span className="bg-gradient-to-r from-accent-primary via-indigo-400 to-accent-secondary bg-clip-text text-transparent">private by default</span>
          </h2>
          <p className="mt-3 text-base font-medium leading-relaxed text-text-secondary">The things a placement cell has to be able to say yes to.</p>
        </Reveal>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map(({ icon: PrincipleIcon, tone, title, body }, i) => {
            const t = TONES[tone];
            return (
              <li key={title}>
                <Reveal delay={i * 0.07} className="h-full">
                  <SpotlightCard className={cn("group relative h-full overflow-hidden rounded-card border border-border-subtle bg-surface p-5 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-border-strong", t.shadow)}>
                    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", t.wash)} />
                    <span className={cn("relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300", t.icon, t.iconHover)}>
                      <PrincipleIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="relative text-base font-bold text-primary">{title}</h3>
                    <p className="relative mt-1.5 text-sm font-medium leading-relaxed text-text-secondary">{body}</p>
                  </SpotlightCard>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
