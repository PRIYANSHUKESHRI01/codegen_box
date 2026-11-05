"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarClock, EyeOff, Gift, Lock, LockOpen, ShieldCheck, Trophy, UserCheck } from "lucide-react";
import { Container } from "@/components/layout/Container";
import { LiveCountdown } from "@/components/landing/LiveCountdown";
import { Reveal } from "@/components/landing/Reveal";
import { MELLOW_VAULT_SITE, READINESS_INGREDIENTS } from "@/data/landing";
import { formatInr } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { landingFacts, useLandingData } from "@/lib/useLandingData";

/** The brand's own colour as a card, as in the in-app rewards banner. */
function brandBackground(color: string) {
  return { background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 62%, #000))` };
}

export const PROMISES = [
  { icon: UserCheck, label: "Opt-in only" },
  { icon: EyeOff, label: "Hide any time" },
  { icon: ShieldCheck, label: "Decline any company" },
] as const;

/**
 * What a student plays for and where it leads: the weekly vouchers and Mellow Vault, side by side instead of as two full-width bands.
 * Both are permanently dark surfaces (so they read as the premium step on the page in either theme), and both are live: the vouchers
 * and the clock are the ones the superadmin and the scheduler have set; the Vault door opens at the bar the server enforces.
 */
export function StudentPayoff() {
  return (
    <section aria-labelledby="payoff-heading" className="relative scroll-mt-16 border-t border-border-subtle bg-surface/30 py-16 sm:py-24">
      <Container size="xl">
        <Reveal className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            For students
          </span>
          <h2 id="payoff-heading" className="text-balance text-[1.75rem] font-bold leading-[1.12] tracking-[-0.03em] text-primary sm:text-4xl lg:text-[2.6rem]">
            Something to play for.{" "}
            <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 bg-clip-text text-transparent">Somewhere to go.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-base font-medium leading-relaxed text-text-secondary sm:text-[1.0625rem]">
            Rewards keep practice worth showing up for. The Vault turns the practice into a career.
          </p>
        </Reveal>

        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <Reveal className="h-full min-w-0">
            <RewardsCard />
          </Reveal>
          <Reveal delay={0.1} className="h-full min-w-0">
            <VaultCard />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------ rewards ------------------------------------------- */

function RewardsCard() {
  const { data, status, refresh } = useLandingData();
  const facts = landingFacts(data);
  const rewards = data?.rewards ?? null;
  const contest = data?.contest ?? null;

  const steps = [
    { icon: CalendarClock, title: "Play the nightly contest", body: `The AptRun Daily Challenge starts at ${facts.dailyTime}: rated, ${facts.dailyMinutes} minutes, ${facts.dailyProblems} problems.` },
    { icon: Trophy, title: "Climb the weekly board", body: `Points from ${facts.weekResets} to Sunday rank every student. It starts again from zero each ${facts.weekResets}.` },
    { icon: Gift, title: "Win vouchers", body: "The vouchers announced for the week go to the students at the top." },
  ];

  return (
    <article
      id="rewards"
      aria-labelledby="rewards-heading"
      className="relative isolate flex h-full scroll-mt-24 flex-col overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1b1140] via-[#3b1d8f] to-[#6d28d9] p-6 text-white shadow-[0_34px_80px_-34px_rgba(109,40,217,0.8)] transition-transform duration-500 hover:-translate-y-1.5 sm:p-8"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(70%_100%_at_95%_0%,#000,transparent)]" />
        <div className="lp-blob-a absolute -right-16 -top-24 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="lp-blob-b absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider text-amber-200">
        <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
        Weekly rewards
      </span>

      <h3 id="rewards-heading" className="text-balance text-[1.75rem] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[2.1rem]">
        Top the weekly leaderboard. <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">Win vouchers.</span>
      </h3>
      <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-violet-100/90">
        Every student competes on the same board, and the week&apos;s best earn gift vouchers from brands they already use.
      </p>

      {/* This week, live */}
      <div className="mt-6 rounded-2xl border border-white/15 bg-[#150c33]/55 p-4 backdrop-blur-md sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h4 className="inline-flex items-center gap-2 whitespace-nowrap text-2xs font-mono font-bold uppercase tracking-wider text-amber-200">
            <Gift className="h-4 w-4" aria-hidden="true" />
            On offer this week
          </h4>
          {rewards?.live && (
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-3xs font-mono font-bold uppercase tracking-wider text-violet-100 sm:whitespace-nowrap">
              Resets in <LiveCountdown to={rewards.week.resets_at} onDone={refresh} variant="text" />
            </span>
          )}
        </div>

        {rewards?.live ? (
          <ol className="space-y-2">
            {rewards.prizes.map((p) => (
              <li
                key={p.rank}
                className="flex items-center gap-3 rounded-2xl p-3 text-white shadow-[0_14px_30px_-16px_rgba(0,0,0,0.6)] ring-1 ring-white/20 transition-transform duration-300 hover:scale-[1.015]"
                style={brandBackground(p.color)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image's optimiser is unavailable */}
                <img src={p.logo} alt="" width={44} height={44} loading="lazy" decoding="async" draggable={false} className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1.5 shadow-sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-3xs font-bold uppercase tracking-[0.12em] text-white/90">Rank #{p.rank}</div>
                  <div className="truncate text-sm font-extrabold leading-tight">{p.brand}</div>
                  <div className="truncate text-2xs font-medium text-white/85">{p.tagline}</div>
                </div>
                <div className="shrink-0 text-right font-mono text-base font-extrabold tabular-nums">{formatInr(p.amount)}</div>
              </li>
            ))}
          </ol>
        ) : status === "loading" ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-[4.25rem] animate-pulse rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : (
          <p className="text-sm font-medium leading-relaxed text-violet-100/85">
            This week&apos;s vouchers are announced on {facts.weekResets}. They come from brands like the ones below.
          </p>
        )}

        {rewards && rewards.shelf.length > 0 && (
          <div className={cn("flex flex-wrap items-center gap-2", rewards.live ? "mt-4 border-t border-white/15 pt-4" : "mt-4")}>
            <span className="mr-1 text-3xs font-mono font-bold uppercase tracking-wider text-violet-200/80">The shelf</span>
            {rewards.shelf.map((b) => (
              // eslint-disable-next-line @next/next/no-img-element -- static export
              <img key={b.key} src={b.logo} alt={b.brand} title={b.brand} width={32} height={32} loading="lazy" decoding="async" draggable={false} className="h-8 w-8 rounded-lg bg-white object-contain p-1.5 shadow-sm ring-1 ring-black/10 transition-transform duration-300 hover:-translate-y-0.5 hover:scale-110" />
            ))}
          </div>
        )}
        {rewards?.participants != null && (
          <p className="mt-3 text-2xs font-semibold text-violet-200/90">{rewards.participants.toLocaleString("en-IN")} students on this week&apos;s board</p>
        )}
      </div>

      <ol className="mt-6 space-y-4">
        {steps.map(({ icon: StepIcon, title, body }, i) => (
          <li key={title} className="flex items-start gap-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-300 text-slate-900 shadow-[0_8px_20px_-8px_rgba(252,211,77,0.85)]">
              <StepIcon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div>
              <h4 className="text-sm font-bold text-white">
                <span className="mr-1.5 font-mono text-amber-200">{i + 1}.</span>
                {title}
              </h4>
              <p className="mt-0.5 text-sm font-medium leading-relaxed text-violet-100/85">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-auto pt-8">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Link
            href="/signup"
            className="hp-btn-sheen inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-btn bg-amber-300 px-6 text-sm font-bold text-slate-900 shadow-[0_14px_34px_-12px_rgba(252,211,77,0.6)] transition-all hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#3b1d8f]"
          >
            Join free and play tonight
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {contest && (
            <p className="text-xs font-semibold text-violet-100/90">
              {contest.is_live ? (
                "The Daily Challenge is live now"
              ) : (
                <>
                  Next challenge in <LiveCountdown to={contest.start_at} onDone={refresh} variant="text" className="font-mono font-bold text-white" />
                </>
              )}
            </p>
          )}
        </div>
        <Link href="/rewards" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-200 underline-offset-4 hover:underline">
          How the rewards work, and the rules <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-3xs font-medium leading-relaxed text-violet-100/65">
          Brand names and logos belong to their owners and appear only to show the kind of voucher on offer. AptRun is not affiliated with, or endorsed by, any of them.
        </p>
      </div>
    </article>
  );
}

/* ------------------------------------------- vault -------------------------------------------- */

function VaultCard() {
  const facts = landingFacts(useLandingData().data);

  return (
    <article
      id="vault"
      aria-labelledby="vault-heading"
      className="relative isolate flex h-full scroll-mt-24 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0a1024] p-6 text-white shadow-[0_34px_80px_-34px_rgba(10,16,36,0.95)] transition-transform duration-500 hover:-translate-y-1.5 sm:p-8"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1738] via-[#0a1024] to-[#070b1a]" />
        <div className="lp-blob-a absolute -top-24 left-[6%] h-[320px] w-[420px] rounded-full bg-indigo-500/25 blur-[100px]" />
        <div className="lp-blob-b absolute bottom-[-8%] right-[4%] h-[300px] w-[400px] rounded-full bg-emerald-400/15 blur-[100px]" />
        <div className="absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_30%,black,transparent)]" />
      </div>

      <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-2xs font-mono font-bold uppercase tracking-wider text-emerald-300">
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        Mellow Vault · Get hired
      </span>

      <h3 id="vault-heading" className="text-balance text-[1.75rem] font-bold leading-[1.1] tracking-[-0.03em] sm:text-[2.1rem]">
        Reach {facts.vaultBar}% readiness.{" "}
        <span className="bg-gradient-to-r from-sky-300 via-indigo-200 to-amber-200 bg-clip-text text-transparent">Unlock Mellow Vault.</span>
      </h3>
      <p className="mt-3 max-w-xl text-base font-medium leading-relaxed text-slate-300">
        Mellow Vault is where employers already hire. Your readiness score is the key: cross {facts.vaultBar}% and employers can find you and invite you, while you stay in
        charge of who sees what.
      </p>

      <div className="mt-6">
        <VaultSimulator bar={facts.vaultBar} />
      </div>

      <ul className="mt-5 flex flex-wrap gap-2" aria-label="You stay in control">
        {PROMISES.map(({ icon: PromiseIcon, label }) => (
          <li key={label} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
            <PromiseIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="hp-btn-sheen inline-flex min-h-[48px] items-center justify-center gap-2 rounded-btn bg-white px-6 text-sm font-bold text-slate-900 shadow-[0_14px_34px_-12px_rgba(255,255,255,0.45)] transition-all hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1024]"
          >
            Create student account
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href={MELLOW_VAULT_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-btn border border-white/25 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1024]"
          >
            Visit Mellow Vault
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
        <Link href="/vault" className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-sky-300 underline-offset-4 hover:underline">
          How Mellow Vault works <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-xs font-medium leading-relaxed text-slate-400">
          Vault access comes with the Expert plan, and a college plan can include it for the whole campus.{" "}
          <Link href="/pricing" className="font-semibold text-sky-300 underline-offset-4 hover:underline">
            See plans
          </Link>
          .
        </p>
      </div>
    </article>
  );
}

/** Width of the slider's thumb in px (see `.lp-range` in globals.css). Needed to line the fill and the Vault line up with it. */
const THUMB_PX = 26;

/** Drag the score; the door locks and unlocks at the bar. Illustrative: nothing here is anyone's real score. */
export function VaultSimulator({ bar }: { bar: number }) {
  const sliderId = useId();
  const [score, setScore] = useState(() => Math.max(0, bar - 8));
  const open = score >= bar;
  const needed = Math.max(0, bar - score);

  return (
    <div className="relative rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-md sm:p-6">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor={sliderId} className="text-2xs font-mono font-bold uppercase tracking-wider text-slate-300">
            Your readiness score
          </label>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-5xl font-black tabular-nums text-white">{score}</span>
            <span className="font-mono text-2xl font-bold text-slate-400">%</span>
          </div>
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors duration-300",
            open ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" : "border-amber-400/40 bg-amber-400/15 text-amber-300"
          )}
        >
          {open ? <LockOpen className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
          {open ? "Unlocked" : "Locked"}
        </span>
      </div>

      {/* One control: the filled track is the slider. The Vault line sits on it at the bar. */}
      <div className="relative mt-6 pb-8">
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          aria-valuetext={`${score} percent readiness. Mellow Vault is ${open ? "unlocked" : "locked"}.`}
          className="lp-range"
          style={
            {
              // the fill ends at the thumb's centre, which a native range keeps THUMB_PX/2 in from either end
              "--lp-fill": `calc(${score}% + ${(0.5 - score / 100) * THUMB_PX}px)`,
              "--lp-a": open ? "#34d399" : "#fbbf24",
              "--lp-b": open ? "#5eead4" : "#fb923c",
            } as React.CSSProperties
          }
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-4px] flex flex-col items-center"
          style={{ left: `calc(${bar}% + ${(0.5 - bar / 100) * THUMB_PX}px)`, transform: "translateX(-50%)" }}
        >
          <span className="h-9 w-0.5 rounded-full bg-white/80" />
          <span className="mt-1 whitespace-nowrap font-mono text-3xs font-bold uppercase tracking-wider text-white">Vault opens at {bar}%</span>
        </div>
      </div>
      <p className="-mt-2 mb-4 text-center text-2xs font-medium text-slate-400">Drag to see how the Vault opens. Illustrative.</p>

      <div
        role="status"
        aria-live="polite"
        className={cn("flex items-start gap-4 rounded-xl border p-4 transition-colors duration-300", open ? "border-emerald-400/35 bg-emerald-400/10" : "border-white/10 bg-black/20")}
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors duration-300",
            open ? "border-emerald-300/50 bg-emerald-400 text-slate-900" : "border-white/15 bg-white/10 text-slate-300"
          )}
        >
          {open ? <LockOpen className="h-5 w-5" aria-hidden="true" /> : <Lock className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold text-white">{open ? "Mellow Vault is unlocked" : "Mellow Vault is locked"}</p>
          <p className="mt-0.5 text-sm font-medium leading-relaxed text-slate-300">
            {open
              ? "Employers hiring on Mellow Vault can now find you, as soon as you give your consent."
              : `${needed} more ${needed === 1 ? "point" : "points"} to open it. Keep practising and it opens on its own.`}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-2xs font-mono font-bold uppercase tracking-wider text-slate-400">What moves your score</p>
        <ul className="flex flex-wrap gap-1.5">
          {READINESS_INGREDIENTS.map((item) => (
            <li key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-2xs font-semibold text-slate-200">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
