"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Gift, Gavel, Layers, Scale, Timer, Trophy, UserCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CtaBand, CrossLinks } from "@/components/landing/CtaBand";
import { FaqAccordion } from "@/components/landing/FaqAccordion";
import { LiveCountdown } from "@/components/landing/LiveCountdown";
import { PageIntro } from "@/components/landing/PageIntro";
import { Reveal } from "@/components/landing/Reveal";
import { SectionIntro } from "@/components/landing/SectionIntro";
import { StepsRow } from "@/components/landing/StepsRow";
import { TonightCard, brandBackground } from "@/components/landing/StageCards";
import type { FaqItem } from "@/data/landing";
import { formatInr } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { landingFacts, useLandingData } from "@/lib/useLandingData";
import type { LandingPrize, LandingRewards } from "@/types/landing";

/**
 * /rewards — the weekly voucher programme, said once and in full. Everything with a date or a number in it is the backend's: the prizes
 * the superadmin has live this week (and next week's, once chosen), when the board resets, tonight's contest and the shelf of brands.
 * The rules below it are the rules the leaderboard actually runs on (ContestLeaderboardService, WeeklyRewardService), not marketing.
 */
export function RewardsPageContent() {
  const { data, status, refresh } = useLandingData();
  const facts = landingFacts(data);
  const rewards = data?.rewards ?? null;

  const steps = [
    { icon: CalendarClock, when: facts.dailyTime, title: "Play the nightly contest", body: `The AptRun Daily Challenge: rated, ${facts.dailyProblems} problems, ${facts.dailyMinutes} minutes, open to every student. Register before it starts.` },
    { icon: Trophy, when: `${facts.weekResets} to Sunday`, title: "Climb the weekly board", body: `Contest points from ${facts.weekResets} to Sunday (IST) rank every student. The board starts again from zero every ${facts.weekResets}, so everyone begins level.` },
    { icon: Gift, when: "When the week closes", title: "Win a voucher", body: "The vouchers announced for the week go to the students at the top. You are told in the app, and the AptRun team sends the voucher to your account's email." },
  ];

  const rules = [
    { icon: Layers, title: "What counts", body: "Points from the AptRun Daily Challenge and other contests open to every student. A college's own contests do not count, so nobody gains from having more of them." },
    { icon: Timer, title: "The week", body: `${facts.weekResets} 00:00 to Sunday 23:59, India time. Then the board resets to zero and a new week of vouchers begins.` },
    { icon: Scale, title: "Ties", body: "Level on points? The lower total penalty ranks higher. Still level, and you share the rank, and the prize of the position you hold." },
    { icon: Gift, title: "Who gets what", body: "The live vouchers are handed out in order of value: the biggest goes to rank 1, the next to rank 2, and so on. A week with three vouchers has a top-3 prize list." },
    { icon: UserCheck, title: "Getting your voucher", body: "Winners are told in the app when the week closes. The AptRun team then sends the voucher and marks it sent, and the code shows on your Contests page." },
    { icon: Gavel, title: "Fair play", body: "Everyone gets the same problems under the same clock, judged on hidden test cases. Contest pages restrict pasting from outside the editor." },
  ];

  const faqs: FaqItem[] = [
    { q: "Do I have to pay to compete?", a: "No. The nightly challenge and the weekly board are free for every student." },
    { q: "How do I get into tonight's challenge?", a: "Register from the Contests page before it starts. It is a scheduled event, so you cannot join once it is under way." },
    { q: "What if there is no voucher this week?", a: "The AptRun team announces each week's lineup, and a week can have none on offer. The board, your rating and your all-time record still count." },
    { q: "Which brands are the vouchers from?", a: "From the shelf shown on this page. Brand names and logos belong to their owners and appear only to show the kind of voucher on offer; AptRun is not affiliated with, or endorsed by, any of them." },
  ];

  return (
    <>
      <PageIntro
        crumb="Rewards"
        eyebrow={{ icon: Trophy, label: "Weekly rewards" }}
        title={
          <>
            Top the weekly leaderboard. <span className="lp-gradient-text">Win vouchers.</span>
          </>
        }
        description="Practice is better with something to play for. Every student competes on the same board, and the week's best earn gift vouchers from brands they already use."
        actions={
          <>
            <ButtonLink href="/signup" variant="primary" size="lg" rightIcon={<ArrowRight className="h-4 w-4" />} className="hp-btn-sheen min-h-[48px] justify-center font-semibold">
              Join free and play tonight
            </ButtonLink>
            <ButtonLink href="#rules" variant="secondary" size="lg" className="min-h-[48px] justify-center font-semibold">
              Read the rules
            </ButtonLink>
          </>
        }
        note={
          rewards?.live ? (
            <span>
              This week&apos;s board resets in <LiveCountdown to={rewards.week.resets_at} onDone={refresh} variant="text" className="font-mono font-bold text-primary" />
            </span>
          ) : (
            <span>Free for every student. The week&apos;s lineup is announced on {facts.weekResets}.</span>
          )
        }
        visual={
          <div className="space-y-4">
            <PrizeBoard rewards={rewards} status={status} resetsOn={facts.weekResets} onDone={refresh} />
            <TonightCard contest={data?.contest ?? null} status={status} facts={facts} onDone={refresh} />
          </div>
        }
      />

      <section aria-labelledby="how-heading" className="border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="how-heading" eyebrow="How it works" title="Three steps from a problem to" highlight="a voucher" description="No tricks and no draw: your place on the board is your contest score." />
          <StepsRow steps={steps} />
        </Container>
      </section>

      <section aria-labelledby="lineup-heading" className="py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro
            id="lineup-heading"
            eyebrow={rewards?.live ? "On offer this week" : "The shelf"}
            title={rewards?.live ? "This week's vouchers" : "Vouchers from brands"}
            highlight={rewards?.live ? undefined : "students already use"}
            description={rewards?.live ? "The most valuable voucher goes to rank 1, and the rest follow in order of value." : `This week's lineup is announced on ${facts.weekResets}. They come from the shelf below.`}
          />

          {rewards?.live && (
            <ol className={cn("grid gap-4 sm:grid-cols-2", rewards.prizes.length >= 3 && "lg:grid-cols-3")}>
              {rewards.prizes.map((p, i) => (
                <li key={p.rank}>
                  <Reveal delay={i * 0.07} className="h-full">
                    <PrizeCard prize={p} />
                  </Reveal>
                </li>
              ))}
            </ol>
          )}

          {rewards?.next && (
            <Reveal className="mt-8">
              <div className="rounded-card border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6">
                <p className="mb-3 text-2xs font-mono font-bold uppercase tracking-wider text-accent-primary">Coming next week</p>
                <ul className="flex flex-wrap gap-3">
                  {rewards.next.prizes.map((p) => (
                    <li key={p.rank} className="inline-flex items-center gap-3 rounded-2xl border border-border-subtle bg-elevated/60 py-2 pl-2 pr-4">
                      {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                      <img src={p.logo} alt="" width={36} height={36} loading="lazy" decoding="async" draggable={false} className="h-9 w-9 rounded-lg bg-white object-contain p-1.5 shadow-sm ring-1 ring-black/10" />
                      <span className="text-sm font-bold text-primary">
                        {p.brand} <span className="font-mono text-text-secondary">{formatInr(p.amount)}</span>
                        <span className="block text-2xs font-medium text-text-secondary">Rank #{p.rank}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )}

          {rewards && rewards.shelf.length > 0 && (
            <Reveal className="mt-10">
              <p className="mb-4 text-center text-2xs font-mono font-bold uppercase tracking-[0.16em] text-text-secondary">The shelf the vouchers come from</p>
              <ul className="flex flex-wrap items-center justify-center gap-3">
                {rewards.shelf.map((b) => (
                  <li key={b.key} className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface py-1 pl-1 pr-4 text-sm font-bold text-primary shadow-subtle transition-transform duration-300 hover:-translate-y-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
                    <img src={b.logo} alt="" width={32} height={32} loading="lazy" decoding="async" draggable={false} className="h-8 w-8 rounded-full bg-white object-contain p-1 shadow-sm ring-1 ring-black/10" />
                    {b.brand}
                  </li>
                ))}
              </ul>
              <p className="mx-auto mt-5 max-w-3xl text-center text-3xs font-medium leading-relaxed text-text-muted">
                Brand names and logos belong to their owners and appear only to show the kind of voucher on offer. AptRun is not affiliated with, or endorsed by, any of them.
              </p>
            </Reveal>
          )}
        </Container>
      </section>

      <section id="rules" aria-labelledby="rules-heading" className="scroll-mt-20 border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
        <Container size="xl">
          <SectionIntro id="rules-heading" eyebrow="The rules" title="How the board" highlight="is run" description="The leaderboard runs on contest scores and nothing else. These are the rules it follows." />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rules.map(({ icon: RuleIcon, title, body }, i) => (
              <li key={title}>
                <Reveal delay={(i % 3) * 0.06} className="h-full">
                  <div className="group h-full rounded-card border border-border-subtle bg-surface p-5 shadow-subtle transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_20px_40px_-22px_rgba(79,70,229,0.4)]">
                    <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/25 to-indigo-500/5 text-indigo-600 transition-all duration-300 group-hover:scale-105 dark:text-indigo-400">
                      <RuleIcon className="h-5 w-5" aria-hidden="true" />
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

      <section aria-labelledby="faq-heading" className="py-16 sm:py-24">
        <Container size="md">
          <SectionIntro id="faq-heading" eyebrow="FAQ" title="Questions about" highlight="the rewards" />
          <FaqAccordion items={faqs} />
        </Container>
      </section>

      <CtaBand
        badge="Tonight's board is open"
        title="Pick a problem."
        highlight="Climb the board."
        description="Create a free student account, register for tonight's challenge and see where you land."
        primary={{ label: "Join free and play tonight", href: "/signup" }}
        secondary={{ label: "See Mellow Vault", href: "/vault" }}
        points={["Free for every student", "Rated contest every night", "Weekly vouchers"]}
      />
      <CrossLinks
        items={[
          { href: "/students", label: "For students", body: "Practice, interviews, company prep and one readiness score." },
          { href: "/vault", label: "Mellow Vault", body: "Cross the readiness bar and employers can find you." },
          { href: "/colleges", label: "For colleges", body: "Run your placement season from one dashboard." },
        ]}
      />
    </>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function PrizeBoard({ rewards, status, resetsOn, onDone }: { rewards: LandingRewards | null; status: "loading" | "ready" | "error"; resetsOn: string; onDone: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1b1140] via-[#3b1d8f] to-[#6d28d9] p-5 text-white shadow-[0_34px_80px_-34px_rgba(109,40,217,0.8)] sm:p-6">
      <div aria-hidden="true" className="lp-blob-a absolute -right-12 -top-16 h-52 w-52 rounded-full bg-amber-300/25 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.3)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(80%_100%_at_100%_0%,#000,transparent)]" />

      <div className="relative mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="inline-flex items-center gap-2 text-2xs font-mono font-bold uppercase tracking-wider text-amber-200">
          <Gift className="h-4 w-4" aria-hidden="true" />
          On offer this week
        </h2>
        {rewards?.live && (
          <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-3xs font-mono font-bold uppercase tracking-wider text-violet-100 sm:whitespace-nowrap">
            Resets in <LiveCountdown to={rewards.week.resets_at} onDone={onDone} variant="text" />
          </span>
        )}
      </div>

      {rewards?.live ? (
        <ol className="relative space-y-2.5">
          {rewards.prizes.map((p) => (
            <li key={p.rank} className="flex items-center gap-3 rounded-2xl p-3 shadow-[0_14px_30px_-16px_rgba(0,0,0,0.6)] ring-1 ring-white/20 transition-transform duration-300 hover:scale-[1.015]" style={brandBackground(p.color)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
              <img src={p.logo} alt="" width={44} height={44} loading="lazy" decoding="async" draggable={false} className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1.5 shadow-sm" />
              <div className="min-w-0 flex-1">
                <div className="text-3xs font-bold uppercase tracking-[0.12em] text-white/90">Rank #{p.rank}</div>
                <div className="truncate text-sm font-extrabold leading-tight">{p.brand}</div>
                <div className="truncate text-2xs font-medium text-white/85">{p.tagline}</div>
              </div>
              <div className="shrink-0 font-mono text-base font-extrabold tabular-nums">{formatInr(p.amount)}</div>
            </li>
          ))}
        </ol>
      ) : status === "loading" ? (
        <div className="relative space-y-2.5" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-[4.25rem] animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      ) : (
        <p className="relative text-sm font-medium leading-relaxed text-violet-100/90">This week&apos;s vouchers are announced on {resetsOn}. Come back then, or join now and be ready.</p>
      )}

      <Link href="/signup" className="relative mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-200 underline-offset-4 hover:underline">
        Create a free account <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function PrizeCard({ prize }: { prize: LandingPrize }) {
  return (
    <div className="group relative h-full overflow-hidden rounded-card p-5 text-white shadow-[0_24px_50px_-26px_rgba(0,0,0,0.6)] ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1.5" style={brandBackground(prize.color)}>
      <div aria-hidden="true" className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
        <img src={prize.logo} alt="" width={56} height={56} loading="lazy" decoding="async" draggable={false} className="h-14 w-14 rounded-2xl bg-white object-contain p-2 shadow-md" />
        <span className="rounded-full bg-black/20 px-3 py-1 text-3xs font-bold uppercase tracking-[0.14em]">Rank #{prize.rank}</span>
      </div>
      <p className="relative mt-5 font-mono text-3xl font-black tabular-nums">{formatInr(prize.amount)}</p>
      <p className="relative text-base font-extrabold">{prize.brand} voucher</p>
      <p className="relative mt-1 text-sm font-medium text-white/85">{prize.tagline}</p>
    </div>
  );
}
