"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Building2, CalendarClock, Check, FileSpreadsheet, Gauge, Gift, GraduationCap, LockOpen, Swords, TriangleAlert, Users2 } from "lucide-react";
import { LiveCountdown } from "@/components/landing/LiveCountdown";
import { READINESS_INGREDIENTS } from "@/data/landing";
import { formatInr } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { landingFacts } from "@/lib/useLandingData";
import type { LandingContest, LandingDepartment, LandingRewards } from "@/types/landing";

/**
 * The cards the product is shown with, on the landing hero and on the pages that follow it (Colleges, Students, Rewards): a placement
 * cell's console, tonight's AptRun Daily Challenge counting down to the real start, this week's vouchers as the superadmin has them,
 * and the Vault door. The contest and the vouchers are read from the backend by whoever draws them; the console is a sketch with no
 * figures in it, and says so.
 */
/** How the three products look when they are doing their job: a placement cell's console, tonight's contest and this week's vouchers. */
const PIPELINE = ["Import batch", "Map recruiter", "Set eligibility", "Publish drive", "Track offers"] as const;
/** The step the illustrated drive is on (0-based): the first three are done, "Publish drive" is where the cell is now. */
const PIPELINE_AT = 3;

const RULES = [
  { icon: GraduationCap, label: "Branch" },
  { icon: Gauge, label: "CGPA" },
  { icon: TriangleAlert, label: "Backlogs" },
  { icon: CalendarClock, label: "Batch year" },
] as const;

/** Bar lengths of the sketched "readiness by branch" chart. Decoration: the card says the figures are omitted. */
const SKETCH_WIDTHS = [86, 71, 58, 44];

/** The brand's own colour as a card, as in the in-app rewards banner. */
export function brandBackground(color: string) {
  return { background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 62%, #000))` };
}

export function CardShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-3xl border border-border-subtle bg-surface p-4 shadow-[0_18px_40px_-24px_rgba(39,47,92,0.4)] sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CampusCard({ departments, loaded }: { departments: LandingDepartment[]; loaded: boolean }) {
  return (
    <CardShell>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/25 to-indigo-500/5 text-indigo-600 dark:text-indigo-400">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-primary">Placement cell</p>
            <p className="text-2xs font-medium text-text-secondary">One console for every drive</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-3xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 lp-pulse" aria-hidden="true" />
          Live drive
        </span>
      </div>

      {/* The pipeline of one drive */}
      <ol aria-label="A campus drive, step by step" className="relative mb-5 grid grid-cols-5 gap-1.5">
        <span aria-hidden="true" className="absolute left-[10%] right-[10%] top-[15px] h-0.5 rounded-full bg-border-subtle" />
        <span
          aria-hidden="true"
          className="absolute left-[10%] top-[15px] h-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-accent-primary"
          style={{ width: `${(PIPELINE_AT / (PIPELINE.length - 1)) * 80}%` }}
        />
        {PIPELINE.map((step, i) => {
          const done = i < PIPELINE_AT;
          const active = i === PIPELINE_AT;
          return (
            <li key={step} className="relative flex flex-col items-center gap-1.5 text-center">
              <span
                className={cn(
                  "relative z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 bg-surface text-3xs font-bold",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  active && "border-accent-primary text-accent-primary shadow-[0_0_0_5px_rgb(var(--accent-primary-rgb)/0.15)]",
                  !done && !active && "border-border-strong text-text-muted"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn("text-[0.6875rem] font-semibold leading-tight sm:text-2xs", active ? "text-primary" : "text-text-secondary")}>{step}</span>
            </li>
          );
        })}
      </ol>

      <div className="hidden flex-1 flex-col gap-4 sm:flex">
        {/* Eligibility, per drive */}
        <div>
          <p className="mb-2 text-3xs font-bold uppercase tracking-wider text-text-muted">Eligibility, set per drive</p>
          <ul className="flex flex-wrap gap-2">
            {RULES.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-elevated px-3 py-1.5 text-xs font-semibold text-text-secondary">
                <Icon className="h-3.5 w-3.5 text-accent-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 py-1.5 text-xs font-semibold text-text-muted">
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
              Batch from one CSV
            </li>
          </ul>
        </div>

        {/* Readiness by department: real department names, a sketched chart */}
        <div className="mt-auto rounded-2xl border border-border-subtle bg-elevated/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="inline-flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-text-muted">
              <BadgeCheck className="h-3.5 w-3.5 text-accent-primary" aria-hidden="true" />
              Readiness by department
            </p>
            <span className="text-3xs font-medium text-text-muted">Preview</span>
          </div>
          <ul className="space-y-2.5">
            {(loaded ? departments.slice(0, 4) : Array.from({ length: 4 }, () => null)).map((d, i) => (
              <li key={d?.code ?? i} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 sm:grid-cols-[7.5rem_1fr]">
                {d ? <span className="truncate text-2xs font-semibold text-text-secondary">{d.short}</span> : <span className="h-3 w-16 animate-pulse rounded bg-border-subtle" aria-hidden="true" />}
                <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-border-subtle/70">
                  <motion.span
                    initial={{ width: 0 }}
                    whileInView={{ width: `${SKETCH_WIDTHS[i]}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.3 + i * 0.12, ease: "easeOut" }}
                    className="block h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-2xs font-medium text-text-secondary sm:mt-3">
        <Users2 className="h-3.5 w-3.5 text-accent-primary" aria-hidden="true" />
        Section coordinators see only their own students
      </p>
    </CardShell>
  );
}

export function TonightCard({
  contest,
  status,
  facts,
  onDone,
}: {
  contest: LandingContest | null;
  status: "loading" | "ready" | "error";
  facts: ReturnType<typeof landingFacts>;
  onDone: () => void;
}) {
  const live = !!contest?.is_live;

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#1b1140] via-[#3b1d8f] to-[#6d28d9] p-4 text-white shadow-[0_24px_60px_-24px_rgba(109,40,217,0.75)] sm:p-5">
      <div aria-hidden="true" className="lp-blob-a absolute -right-10 -top-12 h-40 w-40 rounded-full bg-amber-300/25 blur-3xl" />
      <div aria-hidden="true" className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(255,255,255,0.3)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(80%_100%_at_100%_0%,#000,transparent)]" />

      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/20">
            <Swords className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">AptRun Daily Challenge</p>
            <p className="text-2xs font-medium text-violet-200">
              {facts.dailyProblems} problems &middot; {facts.dailyMinutes} min{facts.dailyPoints ? ` · ${facts.dailyPoints} points` : ""}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-amber-300/40 bg-amber-300/15 px-2.5 py-1 text-3xs font-bold uppercase tracking-wider text-amber-200">Rated</span>
      </div>

      <div className="relative flex flex-1 flex-col justify-center gap-2 py-1">
        {contest ? (
          <>
            <p className="inline-flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-violet-200">
              {live && <span className="h-2 w-2 rounded-full bg-emerald-400 lp-pulse" aria-hidden="true" />}
              {live ? "Live now · ends in" : "Starts in"}
            </p>
            <LiveCountdown to={live ? contest.ends_at : contest.start_at} onDone={onDone} tone="dark" />
          </>
        ) : status === "loading" ? (
          <div className="space-y-2" aria-hidden="true">
            <div className="h-3 w-24 animate-pulse rounded bg-white/15" />
            <div className="h-14 w-56 animate-pulse rounded-xl bg-white/10" />
          </div>
        ) : (
          <p className="text-lg font-bold">Every night at {facts.dailyTime}</p>
        )}
      </div>

      <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/signup"
          className="hp-btn-sheen inline-flex min-h-[40px] items-center gap-2 rounded-btn bg-amber-300 px-4 text-sm font-bold text-slate-900 shadow-[0_12px_28px_-12px_rgba(252,211,77,0.7)] transition-all hover:-translate-y-0.5 hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Play tonight, free
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        {contest?.registered != null && <span className="text-2xs font-semibold text-violet-200">{contest.registered.toLocaleString("en-IN")} registered</span>}
      </div>
    </div>
  );
}

export function RewardsCard({ rewards, status, resets, onDone }: { rewards: LandingRewards | null; status: "loading" | "ready" | "error"; resets: string; onDone: () => void }) {
  const prizes = rewards?.prizes.slice(0, 3) ?? [];

  return (
    <CardShell>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/25 to-amber-500/5 text-amber-700 dark:text-amber-400">
            <Gift className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-primary">This week&apos;s vouchers</p>
            <p className="text-2xs font-medium text-text-secondary">For the weekly top ranks</p>
          </div>
        </div>
        {rewards?.live && (
          <span className="whitespace-nowrap rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-3xs font-bold uppercase tracking-wider text-text-secondary">
            Resets <LiveCountdown to={rewards.week.resets_at} onDone={onDone} variant="text" />
          </span>
        )}
      </div>

      {rewards?.live ? (
        <ul className="flex flex-col gap-2">
          {prizes.map((p) => (
            <li key={p.rank} className="flex items-center gap-3 rounded-2xl p-2.5 text-white ring-1 ring-black/5 shadow-[0_12px_26px_-16px_rgba(0,0,0,0.6)]" style={brandBackground(p.color)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image's optimiser is unavailable */}
              <img src={p.logo} alt="" width={36} height={36} loading="lazy" decoding="async" draggable={false} className="h-9 w-9 shrink-0 rounded-lg bg-white object-contain p-1.5" />
              <div className="min-w-0 flex-1">
                <p className="text-3xs font-bold uppercase tracking-[0.12em] text-white/90">Rank #{p.rank}</p>
                <p className="truncate text-sm font-extrabold leading-tight">{p.brand}</p>
              </div>
              <p className="shrink-0 font-mono text-sm font-extrabold tabular-nums">{formatInr(p.amount)}</p>
            </li>
          ))}
        </ul>
      ) : status === "loading" ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-[3.25rem] animate-pulse rounded-2xl bg-elevated" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-wrap gap-2" aria-label="Voucher brands">
            {(rewards?.shelf ?? []).slice(0, 8).map((b) => (
              // eslint-disable-next-line @next/next/no-img-element -- static export
              <li key={b.key}>
                <img src={b.logo} alt={b.brand} title={b.brand} width={36} height={36} loading="lazy" decoding="async" draggable={false} className="h-9 w-9 rounded-xl bg-white object-contain p-1.5 shadow-sm ring-1 ring-black/10" />
              </li>
            ))}
          </ul>
          <p className="text-2xs font-medium text-text-secondary">This week&apos;s lineup is announced on {resets}.</p>
        </div>
      )}

      <Link href="/rewards" className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-bold text-accent-primary underline-offset-4 hover:underline">
        How the rewards work <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </CardShell>
  );
}

export function VaultChip({ bar }: { bar: number }) {
  const r = 17;
  const c = 2 * Math.PI * r;

  return (
    <Link
      href="#vault"
      className="group inline-flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-surface py-2 pl-2.5 pr-4 shadow-[0_18px_40px_-18px_rgba(16,185,129,0.55)] transition-all hover:-translate-y-0.5 hover:border-emerald-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
    >
      <span className="relative h-11 w-11 shrink-0">
        <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="22" cy="22" r={r} fill="none" strokeWidth="5" className="stroke-elevated" />
          <motion.circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            className="stroke-emerald-500"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - bar / 100) }}
            transition={{ duration: 1.4, delay: 0.9, ease: "easeOut" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <LockOpen className="h-4 w-4" aria-hidden="true" />
        </span>
      </span>
      <span className="text-left">
        <span className="block text-sm font-bold leading-tight text-primary">Mellow Vault opens at {bar}%</span>
        <span className="block text-2xs font-medium text-text-secondary">Reach it and employers can find you</span>
      </span>
      <ArrowRight className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}

/** The readiness score and the door it opens: a ring that fills to the Vault bar, and what moves the score. For the student-facing pages. */
export function ReadinessCard({ bar }: { bar: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;

  return (
    <CardShell>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/25 to-emerald-500/5 text-emerald-700 dark:text-emerald-400">
          <Gauge className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-bold leading-tight text-primary">Your readiness</p>
          <p className="text-2xs font-medium text-text-secondary">One score for everything you do</p>
        </div>
      </div>

      <div className="flex flex-1 items-center gap-4">
        <span className="relative h-[88px] w-[88px] shrink-0">
          <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="44" cy="44" r={r} fill="none" strokeWidth="9" className="stroke-elevated" />
            <motion.circle
              cx="44"
              cy="44"
              r={r}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              className="stroke-emerald-500"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              whileInView={{ strokeDashoffset: c * (1 - bar / 100) }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, delay: 0.3, ease: "easeOut" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <LockOpen className="h-6 w-6" aria-hidden="true" />
          </span>
        </span>
        <div>
          <p className="font-mono text-2xl font-black tabular-nums tracking-tight text-primary">{bar}%</p>
          <p className="text-2xs font-semibold leading-snug text-text-secondary">opens Mellow Vault to employers</p>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="What moves your score">
        {READINESS_INGREDIENTS.map((item) => (
          <li key={item} className="rounded-full border border-border-subtle bg-elevated px-2.5 py-1 text-2xs font-semibold text-text-secondary">
            {item}
          </li>
        ))}
      </ul>
    </CardShell>
  );
}
