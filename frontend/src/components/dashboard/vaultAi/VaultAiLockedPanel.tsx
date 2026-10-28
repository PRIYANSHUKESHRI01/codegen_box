"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CalendarClock, CheckCircle2, Gauge, GraduationCap, Hourglass, Lock, Mic, ShieldQuestion, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { daysPhrase } from "@/lib/vaultAi";
import type { VaultAiAccess } from "@/types/vaultAi";
import { Reveal, ScoreRing, VAULT_EASE } from "./vaultKit";

/** A labelled progress bar (0-100) that fills in when it appears. */
function Meter({ value, label, done }: { value: number; label: string; done: boolean }) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-elevated ring-1 ring-inset ring-border-subtle"
    >
      <motion.div
        className={cn("h-full rounded-full", done ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-indigo-500 to-violet-500")}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: reduce ? 0 : 1, ease: VAULT_EASE, delay: 0.2 }}
      />
    </div>
  );
}

function Requirement({
  done,
  icon: Icon,
  title,
  detail,
  children,
}: {
  done: boolean;
  icon: typeof Gauge;
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-surface p-4 shadow-subtle transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card",
        done ? "border-emerald-500/30" : "border-border-subtle hover:border-indigo-500/30"
      )}
    >
      {done && <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_0%,rgba(16,185,129,0.10),transparent_60%)]" />}
      <div className="relative flex items-start gap-3.5">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-105",
            done ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300" : "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-300"
          )}
        >
          {done ? <CheckCircle2 className="va-pop h-5 w-5" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-13 font-bold text-primary">{title}</p>
            <p className={cn("text-2xs font-extrabold", done ? "text-status-success" : "text-text-secondary")}>{detail}</p>
          </div>
          {children}
        </div>
      </div>
    </li>
  );
}

/**
 * What a college student sees in place of the interview while it is locked (or not offered to their year): exactly what is missing,
 * how far along they are, and what to do next. The numbers are the server's - this only lays them out.
 */
export function VaultAiLockedPanel({ access }: { access: VaultAiAccess }) {
  const unavailable = access.state === "unavailable";
  const yearNotSet = access.reasons.includes("year_not_set");
  const waiting = access.reasons.includes("waiting_period");
  const needsReadiness = access.reasons.includes("readiness");
  const required = access.required_days ?? 0;
  const left = access.days_remaining ?? required;
  const served = required > 0 ? Math.max(0, required - left) : 0;
  const readiness = access.readiness;

  return (
    <section className="space-y-5" aria-labelledby="vault-ai-lock-title">
      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-subtle">
          <div className="bg-gradient-to-br from-slate-500/[0.07] to-transparent p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-elevated text-text-secondary ring-1 ring-inset ring-border-subtle">
                  {unavailable ? <ShieldQuestion className="h-5 w-5" aria-hidden /> : <Lock className="h-5 w-5" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <h2 id="vault-ai-lock-title" className="text-lg font-extrabold tracking-tight text-primary">
                    {unavailable
                      ? "The Vault AI Interview isn't open to your year yet"
                      : yearNotSet
                        ? "Your college hasn't set your year yet"
                        : "Your Vault AI Interview is locked"}
                  </h2>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-text-secondary">
                    {unavailable ? (
                      <>
                        It opens for <strong className="font-semibold text-primary">3rd and 4th year</strong> students
                        {access.year_label ? <> — you&apos;re in {access.year_label}</> : null}. Keep building your readiness score until then.
                      </>
                    ) : yearNotSet ? (
                      <>How long you wait depends on your year. Ask your placement cell (TPO) to set it on your profile and your countdown will appear here.</>
                    ) : (
                      <>
                        As a {access.year_label ?? "college"} student it unlocks after <strong className="font-semibold text-primary">{daysPhrase(required)}</strong> on AptRun and a readiness score of{" "}
                        <strong className="font-semibold text-primary">{readiness?.required ?? 60}%</strong>. Once unlocked, it stays unlocked.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {waiting && (
                <div className="shrink-0 self-start sm:self-center" aria-live="polite">
                  <ScoreRing value={required > 0 ? (served / required) * 100 : 0} size={96} stroke={8} tone="indigo" label="Days served toward unlocking">
                    <span className="tabular text-2xl font-extrabold leading-none tracking-tight text-primary">{Math.max(1, left)}</span>
                    <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">{left === 1 ? "day to go" : "days to go"}</span>
                  </ScoreRing>
                </div>
              )}
            </div>
          </div>
        </div>
      </Reveal>

      {!unavailable && !yearNotSet && (
        <ul className="grid gap-4 md:grid-cols-2" aria-label="What unlocks the Vault AI Interview">
          <Reveal delay={0.05}>
            <Requirement
              done={access.waiting_period_met === true}
              icon={Hourglass}
              title={`Be on AptRun for ${daysPhrase(required)}`}
              detail={access.waiting_period_met ? "Done" : `${daysPhrase(Math.max(1, left))} to go`}
            >
              <Meter value={required > 0 ? (served / required) * 100 : 0} label="Days on AptRun" done={access.waiting_period_met === true} />
              <p className="flex items-center gap-1.5 text-2xs text-text-muted">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                {access.unlocks_at
                  ? `Counted from your first sign-in · ${new Date(access.unlocks_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
                  : "Your countdown starts at your first sign-in"}
              </p>
            </Requirement>
          </Reveal>

          <Reveal delay={0.12}>
            <Requirement
              done={readiness?.met === true}
              icon={Gauge}
              title={`Reach a readiness score of ${readiness?.required ?? 60}%`}
              detail={readiness?.met ? "Done" : readiness && readiness.score !== null ? `${readiness.points_needed} point${readiness.points_needed === 1 ? "" : "s"} to go` : "Not scored yet"}
            >
              <Meter value={readiness?.score ?? 0} label="Readiness score" done={readiness?.met === true} />
              <p className="flex items-center justify-between gap-2 text-2xs text-text-muted">
                <span className="tabular">You&apos;re at {readiness?.score ?? 0}%</span>
                {needsReadiness && (
                  <Link href="/dashboard/vault" className="inline-flex items-center gap-1 font-semibold text-accent-primary hover:underline">
                    See how to raise it <ArrowRight className="h-3 w-3" aria-hidden />
                  </Link>
                )}
              </p>
            </Requirement>
          </Reveal>
        </ul>
      )}

      <Reveal delay={0.18}>
        <div className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border-subtle bg-surface p-4 shadow-subtle transition-all duration-300 hover:shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_140%_at_100%_50%,rgba(99,102,241,0.08),transparent_60%)]" />
          <div className="relative flex min-w-0 items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary ring-1 ring-inset ring-accent-primary/20 transition-transform duration-300 group-hover:scale-105">
              <Target className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-13 font-bold text-primary">Practise while you wait</p>
              <p className="text-2xs leading-relaxed text-text-muted">
                Mock AI Interviews use the same voice format, and the score you earn there raises your readiness — the other half of the unlock.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/interviews"
            className="relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-xs font-bold text-primary shadow-subtle transition-all hover:-translate-y-0.5 hover:border-accent-primary hover:shadow-card"
          >
            <Mic className="h-3.5 w-3.5 text-accent-primary" aria-hidden /> Open Mock AI Interview
          </Link>
        </div>
      </Reveal>

      {access.study_year !== null && !unavailable && (
        <p className="flex items-center gap-1.5 text-2xs text-text-muted">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          Your college has you in {access.year_label}. If that&apos;s wrong, ask your TPO to correct it.
        </p>
      )}
    </section>
  );
}
