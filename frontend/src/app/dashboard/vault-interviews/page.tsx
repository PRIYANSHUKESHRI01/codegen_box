"use client";

import Link from "next/link";
import { ArrowRight, Check, Info, Layers, Mic, ShieldCheck, Target, Trophy } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CuratedSetsExplorer } from "@/components/dashboard/interviews/CuratedSetsExplorer";
import { VaultAiLockedPanel } from "@/components/dashboard/vaultAi/VaultAiLockedPanel";
import { Reveal, ScoreRing } from "@/components/dashboard/vaultAi/vaultKit";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { cn } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useVaultAiAccess } from "@/lib/useVaultAiAccess";
import type { VaultAiAccess } from "@/types/vaultAi";

const SUBTITLE = "Pass 3 voice sets with a 60%+ average to get listed on Mellow Vault.";

const STEPS = [
  { title: "Pick a stack", body: "Choose the role and framework you want to be hired for.", icon: Layers, tile: "from-indigo-500 to-violet-600", glow: "hover:shadow-indigo-500/20 hover:border-indigo-500/35" },
  { title: "Sit 3 voice sets", body: "Answer aloud. AI scores every answer as you go.", icon: Mic, tile: "from-violet-500 to-fuchsia-600", glow: "hover:shadow-violet-500/20 hover:border-violet-500/35" },
  { title: "Score 60%+", body: "Your average across the three sets is what counts.", icon: Target, tile: "from-sky-500 to-cyan-600", glow: "hover:shadow-sky-500/20 hover:border-sky-500/35" },
  { title: "Get listed", body: "Hiring partners can find and shortlist your profile.", icon: Trophy, tile: "from-emerald-500 to-teal-600", glow: "hover:shadow-emerald-500/20 hover:border-emerald-500/35" },
] as const;

/** The page's opening, in one card: what this is, where the student stands, the four steps, and the one thing to know before starting. */
function Intro({ access }: { access: VaultAiAccess | null }) {
  const best = access?.vault_ai_score ?? null;

  return (
    <Reveal>
      <div className="relative isolate overflow-hidden rounded-2xl border border-indigo-500/20 bg-surface shadow-[0_14px_40px_-24px_rgba(79,70,229,0.5)]">
        {/* colour, behind the content */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.09] via-violet-500/[0.04] to-transparent" />
          <div className="va-drift absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="va-drift absolute -bottom-28 left-1/4 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl [animation-delay:-7s]" />
          <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(99,102,241,0.13)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(100deg,transparent_30%,#000_100%)]" />
        </div>
        <span aria-hidden className="va-sheen absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400" />

        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="relative mt-0.5 shrink-0">
                <span aria-hidden className="va-ping absolute inset-0 rounded-2xl bg-indigo-500/25" />
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/35 ring-1 ring-inset ring-white/30">
                  <ShieldCheck className="h-6 w-6" aria-hidden />
                </span>
              </span>
              <div className="min-w-0">
                <h2 className="text-xl font-extrabold tracking-tight text-primary">Get listed on Mellow Vault</h2>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-text-secondary">
                  Hiring partners can find you once you pass. Choose a stack you&apos;re strong in, then sit three short voice interviews.{" "}
                  <span className="font-semibold text-primary">It&apos;s free for every student.</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-3xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">
                    <Check className="h-3 w-3" aria-hidden /> Unlocked
                  </span>
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-3xs font-semibold text-text-secondary ring-1 ring-inset ring-border-subtle">No plan needed</span>
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-3xs font-semibold text-text-secondary ring-1 ring-inset ring-border-subtle">~15 min per set</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 self-start rounded-2xl border border-border-subtle bg-surface/80 py-2.5 pl-3 pr-5 shadow-subtle backdrop-blur-sm sm:self-center">
              <ScoreRing value={best ?? 60} size={64} stroke={6} tone={best !== null && best >= 60 ? "emerald" : "indigo"} label={best === null ? "Pass mark" : "Your best score"}>
                <span className="tabular text-sm font-extrabold text-primary">{best === null ? "60%" : `${Math.round(best)}%`}</span>
              </ScoreRing>
              <div>
                <p className="text-3xs font-bold uppercase tracking-wider text-text-muted">{best === null ? "Pass mark" : "Your best"}</p>
                <p className="mt-0.5 text-2xs leading-snug text-text-secondary">{best === null ? "Average across 3 sets" : best >= 60 ? "Above the line, nice" : "Keep going"}</p>
              </div>
            </div>
          </div>

          <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="How it works">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className={cn("group/step flex items-start gap-3 rounded-xl border border-border-subtle bg-surface/90 p-3.5 shadow-subtle backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg", step.glow)}
              >
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover/step:scale-110 group-hover/step:-rotate-3", step.tile)}>
                  <step.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-3xs font-bold uppercase tracking-wider text-text-muted">Step {i + 1}</span>
                  <span className="mt-0.5 block text-13 font-bold text-primary">{step.title}</span>
                  <span className="mt-0.5 block text-2xs leading-snug text-text-secondary">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-2 border-t border-amber-500/20 bg-amber-500/[0.06] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-start gap-2 text-2xs leading-relaxed text-text-secondary">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
            <span>
              Sit it when you&apos;re ready: you get <strong className="font-semibold text-primary">3 attempts</strong>, then a 45-day wait before you can try again.
            </span>
          </p>
          <Link href="/dashboard/interviews" className="inline-flex shrink-0 items-center gap-1 text-2xs font-bold text-accent-primary transition-all hover:gap-1.5 hover:underline">
            Practice first <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

export default function VaultInterviewsPage() {
  const { status } = useAuthGuard(["user"]);
  const { access, loading } = useVaultAiAccess(status === "ready");

  if (status !== "ready" || (loading && !access)) return <SessionLoader />;

  // A college student who has not earned it yet (or whose year is not offered it) sees what is missing, not the circuit. The server
  // refuses their requests too; this is only the explanation. While the answer is unknown (the request failed) the circuit is shown
  // and the server decides.
  if (access && access.state !== "open") {
    return (
      <DashboardShell role="user" title="Vault AI Interview" subtitle={SUBTITLE}>
        <VaultAiLockedPanel access={access} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="user" title="Vault AI Interview" subtitle={SUBTITLE}>
      <div className="space-y-6">
        <Intro access={access} />
        <CuratedSetsExplorer />
      </div>
    </DashboardShell>
  );
}
