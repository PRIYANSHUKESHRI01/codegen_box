"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyEdition, DailySummary } from "@/types/weeklyRewards";

const DIFFICULTY_TONE: Record<string, string> = {
  easy: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-300",
  medium: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300",
  hard: "bg-rose-500/10 text-rose-600 border-rose-500/25 dark:text-rose-300",
};

function when(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * Proof that the AptRun Daily Challenge is in order: the edition on the calendar — its start time, its three problems, how many have
 * registered — and how the last one went. When no edition is scheduled it says so in red: that is the one thing here to act on.
 */
export function DailyStatusCard({ daily }: { daily: DailySummary }) {
  const next = daily.next;

  return (
    <section className="min-w-0 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle" aria-label="Daily Challenge status">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
            <CalendarClock className="h-4 w-4 text-accent-primary" aria-hidden /> {daily.name}
          </h3>
          <p className="mt-0.5 text-2xs text-text-muted">
            Every day at {daily.start_label}, {daily.duration_minutes} minutes, three problems (Easy, Medium, Hard). The next one is created the moment tonight&apos;s closes.
          </p>
        </div>
        {daily.scheduled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-status-success/30 bg-status-success/10 px-2.5 py-1 text-3xs font-bold text-status-success">
            <CheckCircle2 className="h-3 w-3" aria-hidden /> Scheduled
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-status-danger/30 bg-status-danger/10 px-2.5 py-1 text-3xs font-bold text-status-danger">
            <AlertTriangle className="h-3 w-3" aria-hidden /> Nothing scheduled
          </span>
        )}
      </div>

      {!next ? (
        <p className="mt-3 rounded-control border border-status-danger/25 bg-status-danger/10 p-3 text-2xs text-status-danger">
          No edition is on the calendar. The scheduler creates it at 9 PM IST when tonight&apos;s ends (and hourly as a safety net) — check that the server cron runs <code>php artisan schedule:run</code> every minute, then run <code>php artisan contests:generate-daily</code> once.
        </p>
      ) : (
        <Edition edition={next} tz={daily.timezone} heading={next.state === "live" ? "Live now" : "Next edition"} />
      )}

      {daily.last && <Edition edition={daily.last} tz={daily.timezone} heading="Last edition" compact />}
    </section>
  );
}

function Edition({ edition, tz, heading, compact = false }: { edition: DailyEdition; tz: string; heading: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-control border border-border-subtle bg-elevated/40 p-3.5", compact ? "mt-3" : "mt-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-3xs font-bold uppercase tracking-wider text-text-muted">
          {edition.state === "live" && <Radio className="h-3 w-3 text-emerald-500" aria-hidden />} {heading}
        </span>
        <span className="text-2xs font-semibold text-primary">
          {when(edition.start_at, tz)} → {new Date(edition.end_at).toLocaleTimeString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit" })} IST
        </span>
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {edition.problems.map((p, i) => (
          <li key={i} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold", DIFFICULTY_TONE[p.difficulty ?? ""] ?? "border-border-subtle text-text-secondary")}>
            <span className="capitalize">{p.difficulty}</span>
            <span className="truncate font-normal text-text-secondary">{p.title}</span>
            <span className="font-mono text-3xs">{p.points} pts</span>
          </li>
        ))}
        {edition.problems.length !== 3 && <li className="text-2xs font-bold text-status-danger">Expected 3 problems, found {edition.problems.length}</li>}
      </ul>
      <p className="mt-2 text-2xs text-text-muted">
        {edition.registered} registered{edition.state !== "upcoming" ? ` · ${edition.scored} scored` : ""}
        {edition.registration && edition.state === "upcoming" && (
          <>
            {" · registration "}
            {edition.registration.state === "open" ? `open until ${when(edition.registration.closes_at, tz)}` : edition.registration.state === "not_open" ? `opens ${when(edition.registration.opens_at, tz)}` : "closed"}
          </>
        )}
        {edition.state === "ended" && ` · ${edition.finalized ? "results and ratings finalised" : "waiting to be finalised (every 5 minutes)"}`}
      </p>
    </div>
  );
}
