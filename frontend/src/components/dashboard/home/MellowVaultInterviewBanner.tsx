"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Gift, Lock, Mic, ShieldCheck, Star } from "lucide-react";
import { WaveBars } from "@/components/dashboard/vaultAi/vaultKit";
import { useVaultAiAccess } from "@/lib/useVaultAiAccess";
import { daysPhrase, unlockButtonLabel } from "@/lib/vaultAi";
import { cn } from "@/lib/utils";

/** A small fact under the description. */
function Fact({ icon: Icon, children, muted }: { icon: typeof Mic; children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-3xs font-semibold ring-1 ring-inset transition-colors duration-300",
        muted ? "bg-elevated text-text-muted ring-border-subtle" : "bg-indigo-500/[0.07] text-indigo-700 ring-indigo-500/15 group-hover:bg-indigo-500/[0.12] dark:text-indigo-300"
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {children}
    </span>
  );
}

/**
 * The Vault AI Interview on the student's Overview: one card, one message, one action - with enough colour and motion to read as the
 * flagship of the page.
 *
 * Open: what it is, what happens when you pass, three small facts, the student's best score if they have one, and a button. A college
 * student who has not earned it yet sees the same card locked - what it needs, how far along the wait is, and the days left on the
 * button; it still opens the page, which explains what is missing. A student whose year is not offered it does not see the card.
 */
export function MellowVaultInterviewBanner({ className }: { className?: string }) {
  const { access, loading } = useVaultAiAccess();
  const locked = access?.state === "locked";

  if (access?.state === "unavailable") return null;

  // Until the server has said whether it is open, show neither state: a card that turns into another a moment later is worse than a
  // placeholder of the same size.
  if (loading && !access) {
    return <div aria-hidden className={cn("h-[132px] animate-pulse rounded-2xl border border-border-subtle bg-surface-raised", className)} />;
  }

  const buttonLabel = access && locked ? unlockButtonLabel(access) : null;
  const required = access?.required_days ?? 0;
  const left = access?.days_remaining ?? required;
  const served = Math.max(0, required - left);
  const servedPct = required > 0 ? Math.round((served / required) * 100) : 0;
  const best = access?.vault_ai_score ?? null;

  return (
    <Link
      href="/dashboard/vault-interviews"
      aria-label={buttonLabel ? `Vault AI Interview — locked. ${buttonLabel}.` : "Open Vault AI Interview"}
      className={cn(
        "group relative isolate block overflow-hidden rounded-2xl border bg-surface transition-all duration-300 ease-out",
        "hover:-translate-y-1 active:translate-y-0 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        locked
          ? "border-border-subtle shadow-subtle hover:border-border-strong hover:shadow-card"
          : "border-indigo-500/25 shadow-[0_10px_30px_-18px_rgba(79,70,229,0.45)] hover:border-indigo-500/50 hover:shadow-[0_22px_50px_-20px_rgba(79,70,229,0.6)]",
        className
      )}
    >
      {/* colour: a soft wash, two blooms and a fine dot grid - all behind the content */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className={cn("absolute inset-0 bg-gradient-to-r", locked ? "from-slate-500/[0.06] via-transparent to-transparent" : "from-indigo-500/[0.10] via-violet-500/[0.05] to-transparent")} />
        {!locked && (
          <>
            <div className="va-drift absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="va-drift absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-sky-400/15 blur-3xl [animation-delay:-7s]" />
          </>
        )}
        <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(99,102,241,0.13)_1px,transparent_1.2px)] [background-size:20px_20px] [mask-image:linear-gradient(100deg,transparent_25%,#000_100%)]" />
      </div>

      {/* a thin accent line along the top that catches the light */}
      <span
        aria-hidden
        className={cn("va-sheen absolute inset-x-0 top-0 h-[3px] overflow-hidden", locked ? "bg-gradient-to-r from-slate-300/0 via-slate-400/70 to-slate-300/0" : "bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400")}
      />

      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <span className="relative shrink-0 self-start sm:self-center">
          {!locked && <span aria-hidden className="va-ping absolute inset-0 rounded-2xl bg-indigo-500/30" />}
          <span
            className={cn(
              "relative flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-3",
              locked ? "bg-elevated text-text-secondary ring-border-subtle" : "bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/35 ring-white/30"
            )}
          >
            {locked ? <Lock className="h-6 w-6" aria-hidden /> : <ShieldCheck className="h-7 w-7" aria-hidden />}
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[17px] font-extrabold tracking-tight text-primary">Vault AI Interview</h2>
            {locked ? (
              <span className="rounded-full bg-elevated px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-text-muted ring-1 ring-inset ring-border-subtle">Locked</span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400/20 to-orange-400/15 px-2.5 py-0.5 text-3xs font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
                  <Star className="h-2.5 w-2.5 fill-current" aria-hidden />
                  Priority
                </span>
                <WaveBars barClassName="bg-indigo-400" className="h-3.5" />
              </>
            )}
          </div>

          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-text-secondary">
            {locked ? (
              access?.required_days != null ? (
                <>
                  <span className="font-semibold text-primary">Unlocks after {daysPhrase(access.required_days)} on AptRun and a {access.readiness?.required ?? 60}% readiness score.</span>{" "}
                  <span>Every mock interview and contest you finish moves your readiness up.</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-primary">Opens once your college has set your year.</span> <span>Ask your placement cell to add it to your profile.</span>
                </>
              )
            ) : (
              <>
                <span className="font-semibold text-primary">Pass 3 voice sets with a 60%+ average to get listed on Mellow Vault.</span>{" "}
                <span>Hiring partners can then find, shortlist and interview you directly.</span>
              </>
            )}
          </p>

          {locked && required > 0 ? (
            <div className="mt-3 flex items-center gap-3" aria-hidden>
              <span className="relative h-2 w-full max-w-[17rem] overflow-hidden rounded-full bg-elevated ring-1 ring-inset ring-border-subtle">
                <span className="block h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-sky-400 transition-[width] duration-1000 ease-out" style={{ width: `${Math.max(servedPct, 3)}%` }} />
              </span>
              <span className="tabular text-3xs font-semibold text-text-muted">
                {served} of {required} days
              </span>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Fact icon={Mic} muted={locked}>
                Voice interview
              </Fact>
              <Fact icon={Clock3} muted={locked}>
                3 sets · ~15 min each
              </Fact>
              <Fact icon={Gift} muted={locked}>
                Free for every student
              </Fact>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
          {!locked && best !== null && (
            <span className="tabular rounded-xl bg-surface/80 px-3 py-1.5 text-2xs font-semibold text-text-muted shadow-subtle ring-1 ring-inset ring-border-subtle">
              Best score{" "}
              <span className={cn("text-sm font-extrabold", best >= 60 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>{Math.round(best)}%</span>
            </span>
          )}

          {buttonLabel ? (
            <span className="tabular inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-border-subtle bg-surface px-4 text-xs font-bold text-text-secondary shadow-subtle transition-all duration-300 group-hover:border-border-strong group-hover:text-primary group-hover:shadow-card">
              <Lock className="h-3.5 w-3.5" aria-hidden /> {buttonLabel}
            </span>
          ) : (
            <span className="relative inline-flex h-11 items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 text-[13px] font-bold text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 group-hover:gap-3 group-hover:shadow-xl group-hover:shadow-indigo-500/45 group-hover:brightness-110">
              Start interview <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
