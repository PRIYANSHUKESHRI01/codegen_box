"use client";

import Link from "next/link";
import { ArrowRight, Award, BadgeCheck, Check, ExternalLink, Lock, Radar, ShieldCheck, UserCheck } from "lucide-react";
import { HpCard, HpIconTile, HpPill, HpSectionHeader, hpBtn } from "@/components/portal/kit";
import { MELLOW_VAULT_URL, type VaultDoor } from "@/lib/vaultAccess";
import { cn } from "@/lib/utils";
import type { StudentVaultResponse } from "@/types/vault";

const LOCK_HINT: Record<"score" | "plan" | "review", (n: number, line: number) => string> = {
  score: (n, line) => `Locked until your readiness reaches ${line}% — ${n} ${n === 1 ? "point" : "points"} to go`,
  plan: () => "Locked — Mellow Vault is part of the Expert plan",
  review: () => "Locked — your profile is under review",
};

/**
 * The Mellow Vault button. Open: a real link that opens Mellow Vault in a new tab. Locked: the same button, visibly locked, that
 * says why on hover and to a screen reader - `aria-disabled` rather than `disabled`, so it stays focusable and can explain itself
 * (a truly disabled button is skipped by the keyboard and shows no tooltip).
 */
export function MellowVaultButton({ door, line, className }: { door: VaultDoor; line: number; className?: string }) {
  if (door.state === "open") {
    return (
      <a href={MELLOW_VAULT_URL} target="_blank" rel="noopener noreferrer" className={hpBtn("primary", "lg", cn("group", className))}>
        Open Mellow Vault
        <ExternalLink className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }

  const hint = LOCK_HINT[door.reason](door.pointsNeeded, line);
  return (
    <button
      type="button"
      aria-disabled="true"
      title={hint}
      onClick={(e) => e.preventDefault()}
      className={cn(
        "inline-flex h-12 cursor-not-allowed select-none items-center justify-center gap-2 whitespace-nowrap rounded-[14px] border border-dashed border-border-strong bg-elevated/70 px-6 text-sm font-semibold text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))]",
        className
      )}
    >
      <Lock className="h-4 w-4" aria-hidden />
      Open Mellow Vault
      <span className="sr-only">. {hint}</span>
    </button>
  );
}

interface HeroCopy {
  tone: "emerald" | "indigo" | "amber" | "slate";
  pill: string;
  title: string;
  body: string;
  helper: string;
}

function heroCopy(door: VaultDoor, score: number, line: number): HeroCopy {
  if (door.state === "open") {
    return {
      tone: "emerald",
      pill: "Unlocked",
      title: "You’re Mellow Vault ready",
      body: `Your readiness score of ${score} has cleared the Vault line. Hiring partners are continuously looking for candidates like you — open Mellow Vault to get discovered and hired directly.`,
      helper: "Opens Mellow Vault in a new tab.",
    };
  }

  if (door.reason === "plan") {
    return {
      tone: "amber",
      pill: "Score qualified · plan needed",
      title: "Your score qualifies — Mellow Vault comes with Expert",
      body: `You’ve cleared ${line}% readiness, which is exactly what hiring partners look for. Upgrade to Expert to open Mellow Vault and be found by employers directly.`,
      helper: "Your score and progress are safe — nothing is lost while you decide.",
    };
  }

  if (door.reason === "review") {
    return {
      tone: "slate",
      pill: "Under review",
      title: "Your Mellow Vault access is on hold",
      body: "Mellow is reviewing your profile, so Mellow Vault is paused for now. Your score and your choices are untouched. Contact support if you think this is a mistake.",
      helper: "We’ll unlock it again as soon as the review is done.",
    };
  }

  return {
    tone: "indigo",
    pill: `Locked · ${door.pointsNeeded} ${door.pointsNeeded === 1 ? "point" : "points"} to go`,
    title: `Cross ${line}% readiness to unlock Mellow Vault`,
    body: "Hiring partners are always looking for ready, talented candidates like you. Reach the Vault line and employers can find, shortlist and interview you directly — no queues, no waiting for a campus drive.",
    helper: `Unlocks automatically at ${line}% readiness. You’re at ${score}% now.`,
  };
}

/** The page's headline block: what the Vault is for this student right now, and the one button that matters. */
export function VaultHero({ data, door }: { data: StudentVaultResponse; door: VaultDoor }) {
  const { score, threshold } = data.readiness;
  const c = heroCopy(door, score, threshold);
  const open = door.state === "open";

  return (
    <section
      aria-label="Mellow Vault"
      className="hp-gborder group relative overflow-hidden rounded-[24px] border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] shadow-[var(--hp-edge),var(--hp-shadow)]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className={cn(
            "absolute inset-0",
            open
              ? "bg-[radial-gradient(70%_130%_at_0%_0%,rgba(16,185,129,0.14),transparent_60%),radial-gradient(60%_110%_at_100%_0%,rgb(var(--hp-id)/0.16),transparent_60%)]"
              : "bg-[radial-gradient(70%_130%_at_0%_0%,rgba(99,102,241,0.14),transparent_60%),radial-gradient(60%_110%_at_100%_0%,rgb(var(--hp-id)/0.16),transparent_60%)]"
          )}
        />
        <div className="hp-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(55%_90%_at_88%_0%,#000,transparent)]" />
        <div className={cn("hp-drift absolute -right-16 -top-24 h-72 w-72 rounded-full blur-3xl", open ? "bg-gradient-to-br from-emerald-400/30 to-[rgb(var(--hp-id2)/0.12)]" : "bg-gradient-to-br from-[rgb(var(--hp-id)/0.30)] to-[rgb(var(--hp-id2)/0.10)]")} />
        <div className="hp-drift absolute -bottom-28 left-1/4 h-60 w-60 rounded-full bg-gradient-to-tr from-indigo-500/20 to-violet-500/10 blur-3xl [animation-delay:-5s]" />
      </div>

      <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="flex min-w-0 items-start gap-4 sm:gap-5">
          <HpIconTile icon={open ? Award : Lock} tone={open ? "emerald" : c.tone === "amber" ? "amber" : c.tone === "slate" ? "slate" : "indigo"} size="xl" className="transition-transform duration-500 group-hover:-rotate-3 group-hover:scale-105" />
          <div className="min-w-0">
            <HpPill tone={c.tone} dot pulse={open}>
              {c.pill}
            </HpPill>
            <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-primary sm:text-[28px] sm:leading-9">{c.title}</h2>
            <p className="mt-2 max-w-2xl text-13 leading-relaxed text-text-secondary sm:text-sm">{c.body}</p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2.5 lg:items-end">
          <MellowVaultButton door={door} line={threshold} />
          <p className="max-w-[17rem] text-2xs leading-snug text-text-muted lg:text-right">{c.helper}</p>

          {door.state === "locked" && door.reason === "score" && (
            <a href="#score-breakdown" className="group/link inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300">
              See how to raise my score
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5" aria-hidden />
            </a>
          )}
          {door.state === "locked" && door.reason === "plan" && (
            <Link href="/dashboard/billing" className="group/link inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-300">
              See plans
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Build your score", body: "Practise, take AI mock interviews, finish soft-skills sets and join contests." },
  { title: "Cross the Vault line", body: "At 60% readiness, Mellow Vault unlocks automatically." },
  { title: "Get found and hired", body: "Open Mellow Vault. Employers find, shortlist and interview you directly." },
] as const;

/** Where the student is on the way to Mellow Vault, as three steps. Shown while the door is locked. */
export function VaultSteps({ door, score, line }: { door: VaultDoor; score: number; line: number }) {
  // Step 1 until the line is crossed; step 3 once the door is open. (Step 2 is the moment between - never "current" for long.)
  const current = door.state === "open" ? 2 : 0;

  return (
    <HpCard spotlight={false} className="p-5 sm:p-6" aria-label="How Mellow Vault works">
      <HpSectionHeader icon={Radar} tone="violet" title="How it works" subtitle={`Three steps from ${score}% to getting hired directly`} />
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.title} className={cn("relative rounded-2xl border p-4 transition-colors", active ? "border-indigo-500/35 bg-indigo-500/[0.06]" : "border-border-subtle bg-elevated/40")}>
              <div className="flex items-center gap-2.5">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold", done ? "bg-emerald-500 text-white" : active ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_6px_14px_-6px_rgba(99,102,241,0.8)]" : "bg-border-subtle text-text-muted")}>
                  {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                </span>
                <h3 className="text-13 font-bold text-primary">{s.title}</h3>
                {active && <HpPill tone="indigo" size="sm" className="ml-auto">You are here</HpPill>}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">{i === 1 ? `At ${line}% readiness, Mellow Vault unlocks automatically.` : s.body}</p>
            </li>
          );
        })}
      </ol>
    </HpCard>
  );
}

const BENEFITS = [
  { icon: Radar, tone: "indigo", title: "Get found, not just listed", body: "Employers search by verified readiness, so a strong score puts you in front of them without a single application." },
  { icon: UserCheck, tone: "violet", title: "Be shortlisted directly", body: "Hiring partners can shortlist you and schedule an interview straight from your profile." },
  { icon: ShieldCheck, tone: "emerald", title: "You stay in control", body: "Nothing is shared until you say yes, and you can hide your profile whenever you like." },
  { icon: BadgeCheck, tone: "sky", title: "Proof that travels with you", body: "Your readiness score and Vault AI Interview results show employers what you can do." },
] as const;

/** Why it is worth getting to the line. */
export function VaultBenefits() {
  return (
    <section aria-label="Why Mellow Vault" className="space-y-4">
      <HpSectionHeader icon={Award} tone="indigo" title="Why Mellow Vault" subtitle="Hiring partners are always looking for ready candidates — this is how they find you" />
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {BENEFITS.map((b) => (
          <li key={b.title}>
            <HpCard interactive className="group flex h-full items-start gap-4 p-5">
              <HpIconTile icon={b.icon} tone={b.tone} size="lg" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
              <div className="min-w-0">
                <h3 className="text-15 font-bold tracking-tight text-primary">{b.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">{b.body}</p>
              </div>
            </HpCard>
          </li>
        ))}
      </ul>
    </section>
  );
}
