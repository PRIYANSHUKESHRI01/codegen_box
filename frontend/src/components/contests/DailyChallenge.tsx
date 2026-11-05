"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Crown, Loader2, Lock, Radio, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { HpAvatar, HpPill, HpSkeleton } from "@/components/portal/kit";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { DailyBoard, DailyHero, DailyLadderRow, DailyStandingRow } from "@/types/dailyChallenge";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const LOGO_SIZES = {
  sm: { tile: "h-11 w-11 rounded-[14px]", mark: "h-7 w-7" },
  md: { tile: "h-14 w-14 rounded-2xl", mark: "h-9 w-9" },
  lg: { tile: "h-[72px] w-[72px] rounded-[20px]", mark: "h-12 w-12" },
} as const;

/**
 * The contest's cover mark — the AptRun monogram on a white tile, the way a LeetCode contest carries its
 * own emblem. White in both themes on purpose: the blue and yellow of the artwork are drawn for it.
 */
export function DailyChallengeLogo({ size = "md", className }: { size?: keyof typeof LOGO_SIZES; className?: string }) {
  const s = LOGO_SIZES[size];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-white shadow-[0_8px_22px_-8px_rgba(15,30,90,0.45)] ring-1 ring-black/5",
        s.tile,
        className
      )}
    >
      <LogoMark className={s.mark} />
    </span>
  );
}

function istDate(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...opts });
}

/** Re-runs `reload` at the moment the featured edition opens or closes, so the page flips Upcoming → Live → next without a refresh. */
function useBoundaryReload(hero: DailyHero | null, reload: () => void) {
  const boundary = hero?.featured ? (hero.featured.state === "upcoming" ? hero.featured.start_at : hero.featured.end_at) : hero?.next_start_at;

  useEffect(() => {
    if (!boundary) return;
    const wait = new Date(boundary).getTime() - Date.now() + 1500;
    // setTimeout overflows (and fires at once) past ~24.8 days; nothing here is ever that far away.
    if (wait <= 0 || wait > 2_000_000_000) return;
    const id = window.setTimeout(reload, wait);
    return () => window.clearTimeout(id);
  }, [boundary, reload]);
}

/* ── Contests-page hero ─────────────────────────────────────────────────── */

export function DailyChallengeHero() {
  const [hero, setHero] = useState<DailyHero | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "hidden">("loading");
  const [registering, setRegistering] = useState(false);
  const toast = useToast();

  const load = useCallback(() => {
    api
      .get<DailyHero>("/daily-challenge")
      .then((res) => {
        setHero(res);
        setState("ready");
      })
      // A failure here must never cost the student the contest list below it — the banner just stays away.
      .catch(() => setState((s) => (s === "ready" ? s : "hidden")));
  }, []);

  useEffect(load, [load]);
  useBoundaryReload(hero, load);

  if (state === "hidden") return null;
  if (state === "loading" || !hero) return <HpSkeleton className="h-56 w-full rounded-[24px]" />;

  const edition = hero.featured;
  const live = edition?.state === "live";
  const href = edition ? `/dashboard/contests/view?slug=${edition.slug}` : "/dashboard/contests";
  const startIso = edition && !live ? edition.start_at : hero.next_start_at;
  const endIso = edition?.end_at ?? "";
  const minutesTo = (iso: string) => (new Date(iso).getTime() - Date.now()) / 60000;

  const register = async () => {
    if (!edition) return;
    setRegistering(true);
    try {
      await api.post(`/contests/${edition.slug}/register`);
      toast("You're registered — see you at " + hero.schedule.start_label + "!");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Failed to register.", "error");
    } finally {
      setRegistering(false);
    }
  };

  const latest = hero.latest;
  const registration = edition?.registration ?? null;

  return (
    <section
      aria-label={hero.name}
      className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0a1a4f] via-[#10358f] to-[#1d56d6] text-white shadow-[0_24px_50px_-24px_rgba(16,53,143,0.7)]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hp-dots absolute inset-0 opacity-30 [mask-image:radial-gradient(70%_100%_at_90%_0%,#000,transparent)]" />
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
      </div>

      <div className="relative z-10 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <DailyChallengeLogo size="lg" />
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {live ? (
                  <HpPill tone="rose" dot pulse size="sm" className="bg-rose-500/20 text-rose-100 ring-rose-300/30">
                    Live now
                  </HpPill>
                ) : (
                  <HpPill tone="amber" size="sm" icon={CalendarClock} className="bg-amber-300/20 text-amber-100 ring-amber-200/30">
                    Every day · {hero.schedule.start_label}
                  </HpPill>
                )}
                <HpPill tone="sky" size="sm" className="bg-white/10 text-sky-100 ring-white/20">
                  Rated
                </HpPill>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-[28px] sm:leading-9">{hero.name}</h2>
              <p className="mt-1 max-w-md text-13 leading-relaxed text-sky-100/85">
                {edition
                  ? `${edition.problem_count} problems · ${edition.total_points} points · ${hero.schedule.duration_minutes} minutes. Solve fast, climb the board, build your AptRun rating.`
                  : `One Easy, one Medium, one Hard — ${hero.schedule.duration_minutes} minutes, once a day. Solve fast, climb the board, build your AptRun rating.`}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-col items-start gap-1.5 lg:items-end">
              <span className="text-3xs font-bold uppercase tracking-[0.14em] text-sky-100/80">
                {live ? "Ends in" : edition ? "Opens in" : "Next challenge in"}
              </span>
              <CountdownTimer minutesFromNow={minutesTo(live ? endIso : startIso)} variant="raised" />
              {!live && (
                <span className="text-2xs text-sky-100/75">
                  {istDate(startIso, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} IST
                </span>
              )}
            </div>

            {edition && (
              <div className="flex flex-wrap items-center gap-2">
                {edition.registered_count > 0 && (
                  <span className="text-2xs text-sky-100/75">{edition.registered_count.toLocaleString("en-IN")} registered</span>
                )}
                {edition.is_registered ? (
                  <Link
                    href={href}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-300 px-4 text-13 font-bold text-slate-900 shadow-[0_8px_20px_-8px_rgba(252,211,77,0.8)] transition hover:-translate-y-px hover:bg-amber-200 active:scale-[0.97]"
                  >
                    {live ? "Enter contest" : "Registered"}
                    {live ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </Link>
                ) : registration?.state === "open" ? (
                  <button
                    type="button"
                    onClick={register}
                    disabled={registering}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-300 px-4 text-13 font-bold text-slate-900 shadow-[0_8px_20px_-8px_rgba(252,211,77,0.8)] transition hover:-translate-y-px hover:bg-amber-200 active:scale-[0.97] disabled:opacity-60"
                  >
                    {registering ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Register for tonight"}
                  </button>
                ) : (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-4 text-13 font-semibold text-sky-100 ring-1 ring-inset ring-white/20">
                    <Lock className="h-3.5 w-3.5" aria-hidden />
                    {registration?.state === "not_open" ? `Registration opens ${istDate(registration.opens_at, { weekday: "short", hour: "numeric", minute: "2-digit" })} IST` : "Registration closed"}
                  </span>
                )}
                <Link href={href} className="inline-flex h-10 items-center rounded-xl bg-white/10 px-4 text-13 font-semibold text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/20">
                  Details
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 border-t border-white/15 pt-5 md:grid-cols-[1fr_auto] md:items-center">
          {latest && latest.top.length > 0 ? (
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.14em] text-sky-100/80">
                <Trophy className="h-3 w-3" aria-hidden />
                Last challenge · {istDate(latest.start_at, { day: "numeric", month: "short" })} · top students
              </div>
              <ul className="flex flex-wrap gap-2">
                {latest.top.map((row) => (
                  <li key={row.user.id} className="flex items-center gap-2 rounded-xl bg-white/10 py-1.5 pl-2 pr-3 ring-1 ring-inset ring-white/15">
                    <span className="text-base leading-none" aria-hidden>
                      {MEDAL[row.rank] ?? `#${row.rank}`}
                    </span>
                    <span className="max-w-[9rem] truncate text-xs font-bold">{row.user.name}</span>
                    <span className="font-mono text-2xs text-amber-200">{row.score} pts</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-sky-100/80">Be the first name on the board — the top students of every challenge are shown right here.</p>
          )}

          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <div className="rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-inset ring-white/15">
              <div className="text-3xs font-bold uppercase tracking-[0.12em] text-sky-100/75">Your AptRun rating</div>
              <div className="font-mono text-sm font-extrabold text-amber-200">{hero.my_rating.display}</div>
            </div>
            <Link
              href="/dashboard/leaderboard?board=daily"
              className="inline-flex items-center gap-1 text-xs font-bold text-white underline-offset-4 hover:underline"
            >
              Daily leaderboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Leaderboard tab ────────────────────────────────────────────────────── */

export function DailyChallengeBoard({ scope, userId }: { scope: "global" | "college"; userId: number }) {
  const [board, setBoard] = useState<DailyBoard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<DailyBoard>(`/daily-challenge/leaderboard?scope=${scope}`)
      .then(setBoard)
      .catch(() => setBoard(null))
      .finally(() => setLoading(false));
  }, [scope]);

  if (loading) {
    return (
      <div className="space-y-4">
        <HpSkeleton className="h-24 w-full rounded-panel" />
        <HpSkeleton className="h-64 w-full rounded-panel" />
      </div>
    );
  }

  if (!board) {
    return <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center text-xs text-text-muted">The Daily Challenge board could not be loaded. Try again in a moment.</div>;
  }

  const edition = board.edition;
  const live = edition?.state === "live";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <DailyChallengeLogo size="md" className="ring-border-subtle" />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {edition ? (
                live ? (
                  <HpPill tone="rose" size="sm" dot pulse icon={Radio}>
                    Live standings
                  </HpPill>
                ) : edition.is_finalized ? (
                  <HpPill tone="emerald" size="sm" icon={CheckCircle2}>
                    Final results
                  </HpPill>
                ) : (
                  <HpPill tone="amber" size="sm">
                    Ratings updating
                  </HpPill>
                )
              ) : (
                <HpPill tone="slate" size="sm">
                  Starting soon
                </HpPill>
              )}
            </div>
            <h3 className="truncate text-15 font-bold tracking-tight text-primary">{edition?.title ?? "AptRun Daily Challenge"}</h3>
            <p className="text-xs text-text-muted">
              {edition
                ? `${edition.participants} student${edition.participants === 1 ? "" : "s"} on the board${scope === "college" ? " from your college" : ""}`
                : "The first edition's top students will appear here."}
            </p>
          </div>
        </div>
        {edition && (
          <Link href={`/dashboard/contests/view?slug=${edition.slug}`} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-accent-primary hover:underline">
            Open contest <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {board.my_result && (
        <div className="flex items-center justify-between gap-4 rounded-panel border border-accent-primary/25 bg-accent-primary/10 p-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-black text-accent-primary">#{board.my_result.rank}</span>
            <div>
              <div className="text-sm font-bold text-primary">You</div>
              <div className="font-mono text-2xs text-text-muted">@{board.my_result.user.handle}</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Stat label="Score" value={String(board.my_result.score)} />
            {board.my_result.rating_delta !== null && <Stat label="Rating Δ" value={<Delta value={board.my_result.rating_delta} />} />}
          </div>
        </div>
      )}

      <StandingsTable rows={board.top} userId={userId} showDelta={edition?.is_finalized ?? false} />

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-15 font-bold tracking-tight text-primary">
              <Crown className="h-4 w-4 text-amber-500" aria-hidden />
              AptRun rating ladder
            </h3>
            <p className="text-xs text-text-muted">Every rated contest moves your rating — the Daily Challenge comes round every day.</p>
          </div>
          {board.my_ladder && (
            <div className="text-right">
              <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">Your place</div>
              <div className="font-mono text-sm font-extrabold text-primary">
                #{board.my_ladder.rank} · {board.my_ladder.rating}
              </div>
            </div>
          )}
        </div>
        <LadderTable rows={board.ladder} userId={userId} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="text-right">
      <div className="text-3xs uppercase tracking-wider text-text-muted">{label}</div>
      <div className="font-mono font-bold text-primary">{value}</div>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1", value >= 0 ? "text-status-success" : "text-status-danger")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {value >= 0 ? "+" : ""}
      {value}
    </span>
  );
}

function Person({ name, handle }: { name: string; handle: string }) {
  return (
    <div className="flex items-center gap-3">
      <HpAvatar name={name} size="sm" />
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-primary">{name}</div>
        <div className="truncate font-mono text-xs text-text-muted">@{handle}</div>
      </div>
    </div>
  );
}

const TH = "px-4 py-3";
const TABLE = "overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle";
const HEAD = "border-b border-border-subtle bg-elevated/80 text-2xs font-mono uppercase tracking-wider text-text-muted";

function StandingsTable({ rows, userId, showDelta }: { rows: DailyStandingRow[]; userId: number; showDelta: boolean }) {
  return (
    <div className={TABLE}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className={HEAD}>
              <th className={TH}>Rank</th>
              <th className={TH}>Coder</th>
              <th className={TH}>Score</th>
              <th className={TH}>Penalty</th>
              {showDelta && <th className={cn(TH, "text-right")}>Rating Δ</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={showDelta ? 5 : 4} className="py-10 text-center text-xs text-text-muted">
                  No one has scored yet — the top students of the Daily Challenge appear here.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.user.id} className={cn("border-b border-border-subtle transition-colors hover:bg-surface-hover/80", row.user.id === userId && "bg-accent-primary/5")}>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xl font-bold">{MEDAL[row.rank] ?? `#${row.rank}`}</td>
                  <td className="px-4 py-3.5">
                    <Person name={row.user.name} handle={row.user.handle} />
                  </td>
                  <td className="px-4 py-3.5 font-mono text-sm font-bold text-primary">{row.score}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-text-secondary">{row.penalty_minutes}m</td>
                  {showDelta && (
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-bold">{row.rating_delta !== null && <Delta value={row.rating_delta} />}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LadderTable({ rows, userId }: { rows: DailyLadderRow[]; userId: number }) {
  return (
    <div className={TABLE}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className={HEAD}>
              <th className={TH}>Rank</th>
              <th className={TH}>Coder</th>
              <th className={TH}>Rating</th>
              <th className={cn(TH, "text-right")}>Contests</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-xs text-text-muted">
                  No one is rated yet. Finish a rated contest to get your first AptRun rating.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.user.id} className={cn("border-b border-border-subtle transition-colors hover:bg-surface-hover/80", row.user.id === userId && "bg-accent-primary/5")}>
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xl font-bold">{MEDAL[row.rank] ?? `#${row.rank}`}</td>
                  <td className="px-4 py-3.5">
                    <Person name={row.user.name} handle={row.user.handle} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-sm font-bold text-amber-500">{row.rating}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-text-secondary">{row.contests}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
