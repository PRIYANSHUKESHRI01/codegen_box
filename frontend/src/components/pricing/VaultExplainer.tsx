import { Award, BadgeCheck, Building2, Gauge, Handshake, Swords, type LucideIcon } from "lucide-react";
import { Container } from "@/components/layout/Container";

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}

/** The Vault story, as the product works: do the work → one readiness score → say yes once → employers on Mellow Vault → a final interview and an offer. */
const STEPS: Step[] = [
  {
    icon: Swords,
    title: "Show up and do the work",
    body: "Mock interviews, practice, the Learning Centre, soft skills, contests and hackathons — everything you do on AptRun that Mellow or your college set up for you counts, on every plan.",
  },
  {
    icon: Gauge,
    title: "Reach a readiness score of 60",
    body: "One score for every student, with or without a college. It is built only from what you have actually done, so the number means something — and anything a hiring partner posted never counts toward it.",
  },
  {
    icon: Building2,
    title: "Say yes once",
    body: "With Expert, your profile goes to hiring partners on AptRun and to Mellow Vault, our main hiring platform where companies are actively hiring. It is always your choice — nothing is shared until you say yes, you can take it back at any time, and your phone number is never shared.",
  },
  {
    icon: Handshake,
    title: "Interview and get hired",
    body: "Companies browse the Vault, reach out, and run a final interview with you. If it is a match, they hire you directly — no applications, no cold emails.",
  },
];

/**
 * "What is the Vault?" for the pricing page. Static copy by design: it explains
 * a process. Who can join is stated as plain words and enforced by the server:
 * the Vault comes with Expert (or Grandmaster, or a college plan that covers the student),
 * and a student who is ready on another plan keeps their standing and can join
 * the day they upgrade (see PlanGate::requireVaultAccess).
 */
export function VaultExplainer() {
  return (
    <section id="vault" aria-labelledby="vault-heading" className="scroll-mt-24 pb-10 sm:pb-14">
      <Container size="xl">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-panel border border-accent-primary/25 bg-surface shadow-card">
          <div className="relative p-6 sm:p-8">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-accent-primary/10 blur-3xl" />

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-primary/25 bg-accent-primary/10 px-2.5 py-1 text-3xs font-bold uppercase tracking-wide text-accent-primary">
                <Award className="h-3 w-3" aria-hidden />
                Included with Expert
              </span>
              <h2 id="vault-heading" className="mt-3 text-2xl font-extrabold tracking-tight text-primary">
                The Vault: get hired directly through Mellow Vault
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary">
                Most platforms stop at a score. The Vault connects what you build and prove on AptRun directly to the employers who are hiring on Mellow Vault — you are found, interviewed and hired, with no applications.
              </p>

              <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {STEPS.map(({ icon: Icon, title, body }, index) => (
                  <li key={title} className="relative rounded-control border border-border-subtle bg-elevated/50 p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">Step {index + 1}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-extrabold text-primary">{title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{body}</p>
                  </li>
                ))}
              </ol>

              <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-text-secondary">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-success" aria-hidden />
                <span>
                  Joining the Vault is an <strong className="text-primary">Expert</strong> feature. Your readiness score is yours on every plan — if you reach 60 on another plan your standing is kept, and you can join the day you upgrade, no retake.
                </span>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
