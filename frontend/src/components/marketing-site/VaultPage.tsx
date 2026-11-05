"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenCheck, EyeOff, Gauge, LockOpen, ShieldCheck, UserCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CtaBand } from "@/components/landing/CtaBand";
import { PageIntro } from "@/components/landing/PageIntro";
import { Reveal } from "@/components/landing/Reveal";
import { SectionIntro } from "@/components/landing/SectionIntro";
import { StepsRow } from "@/components/landing/StepsRow";
import { VaultSimulator } from "@/components/landing/StudentPayoff";
import { MELLOW_VAULT_SITE } from "@/data/landing";
import { useLandingFacts } from "@/lib/useLandingData";

const PROMISES = [
  { icon: UserCheck, title: "Opt-in only", body: "Your profile stays hidden until you give consent." },
  { icon: EyeOff, title: "Hide any time", body: "Take your profile off the Vault whenever you like." },
  { icon: ShieldCheck, title: "Decline any company", body: "Say no to interest from any employer, no explanation needed." },
] as const;

/**
 * /vault — Mellow Vault in one screen and a half: what it is, how you get in, what you stay in charge of. The bar is the server's.
 * The simulator is the same one as on the landing page; it is a demonstration, and says so.
 */
export function VaultPageContent() {
  const { vaultBar } = useLandingFacts();

  const steps = [
    { icon: BookOpenCheck, title: "Build your readiness", body: "AI interviews, learning-centre practice, soft skills, contests and daily consistency all roll up into one score." },
    { icon: Gauge, title: `Cross ${vaultBar}% and the Vault opens`, body: "The lock lifts as soon as your score clears the bar. There is no form to fill and no one to chase." },
    { icon: LockOpen, title: "Get found by employers", body: "Employers on Mellow Vault can discover you and invite you to interview, but only after you say yes." },
  ];

  return (
    <>
      <PageIntro
        crumb="Mellow Vault"
        eyebrow={{ icon: LockOpen, label: "Mellow Vault · Get hired" }}
        title={
          <>
            Reach {vaultBar}% readiness. <span className="lp-gradient-text">Unlock Mellow Vault.</span>
          </>
        }
        description={`Mellow Vault is where employers already hire. Your AptRun readiness score is the key: cross ${vaultBar}% and employers can find you, while you stay in charge of who sees what.`}
        actions={
          <>
            <ButtonLink href="/signup" variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />} className="hp-btn-sheen min-h-[48px] justify-center font-semibold">
              Create student account
            </ButtonLink>
            <a
              href={MELLOW_VAULT_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-btn border border-border-strong bg-surface px-6 text-sm font-semibold text-primary shadow-subtle transition-all hover:-translate-y-0.5 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary sm:text-base"
            >
              Visit Mellow Vault
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </>
        }
        note={
          <span>
            Vault access comes with the Expert plan, and a college plan can include it for the whole campus.{" "}
            <Link href="/pricing" className="whitespace-nowrap font-bold text-accent-primary underline-offset-4 hover:underline">
              See plans
            </Link>
          </span>
        }
        visual={
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0a1024] p-4 text-white shadow-[0_34px_80px_-34px_rgba(10,16,36,0.95)] sm:p-6">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="lp-blob-a absolute -top-20 left-[6%] h-[260px] w-[360px] rounded-full bg-indigo-500/25 blur-[90px]" />
              <div className="lp-blob-b absolute bottom-[-10%] right-[4%] h-[240px] w-[320px] rounded-full bg-emerald-400/15 blur-[90px]" />
            </div>
            <div className="relative">
              <VaultSimulator bar={vaultBar} />
            </div>
          </div>
        }
      />

      <section aria-labelledby="vault-steps-heading" className="border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="vault-steps-heading" eyebrow="How it works" title="Three steps to" highlight="being found" />
          <StepsRow steps={steps} />
        </Container>
      </section>

      <section aria-labelledby="vault-control-heading" className="py-16 sm:py-24">
        <Container size="lg">
          <SectionIntro id="vault-control-heading" eyebrow="You stay in control" title="Your profile," highlight="your call" description="Reaching the bar makes you eligible. It never makes you visible on its own." />
          <ul className="grid gap-4 sm:grid-cols-3">
            {PROMISES.map(({ icon: PromiseIcon, title, body }, i) => (
              <li key={title}>
                <Reveal delay={i * 0.07} className="h-full">
                  <div className="group h-full rounded-card border border-border-subtle bg-surface p-6 shadow-subtle transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/40 hover:shadow-[0_24px_48px_-22px_rgba(16,185,129,0.45)]">
                    <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 text-emerald-700 transition-all duration-300 group-hover:scale-105 dark:text-emerald-400">
                      <PromiseIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-bold text-primary">{title}</h3>
                    <p className="mt-1.5 text-sm font-medium leading-relaxed text-text-secondary">{body}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <CtaBand
        badge="Employers are already hiring"
        title="Start building your"
        highlight="readiness."
        description="Create a free student account and watch one score climb towards the Vault."
        primary={{ label: "Create student account", href: "/signup" }}
        secondary={{ label: "See this week's rewards", href: "/rewards" }}
        points={["Free to start", "Opt-in only", "Hide any time"]}
      />
    </>
  );
}
