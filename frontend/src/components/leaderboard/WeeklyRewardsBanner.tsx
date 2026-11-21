"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, Gift, Sparkles, Trophy } from "lucide-react";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { VoucherRevealModal } from "./VoucherRevealModal";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { MyWin, Prize, RewardBanner } from "@/types/weeklyRewards";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

/** The brand's colour, as a card: a gentle diagonal from the brand colour to a darker shade of it. */
function cardBackground(color: string) {
  return { background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 62%, #000))` };
}

/** One voucher: the brand's logo on a white chip, over the brand's own colour. */
export function PrizeCard({ prize, className }: { prize: Prize; className?: string }) {
  return (
    <li
      className={cn("relative flex min-w-[10.5rem] flex-1 items-center gap-3 overflow-hidden rounded-2xl p-3 text-white shadow-[0_14px_30px_-16px_rgba(0,0,0,0.6)] ring-1 ring-white/20", className)}
      style={cardBackground(prize.color)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image's optimiser is unavailable, and these are small SVGs */}
      <img src={prize.logo} alt="" width={44} height={44} draggable={false} className="h-11 w-11 shrink-0 select-none rounded-xl bg-white object-contain p-1.5 shadow-sm" />
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-3xs font-bold uppercase tracking-[0.12em] text-white/85">
          <span aria-hidden>{MEDAL[prize.rank] ?? ""}</span>
          Rank #{prize.rank}
        </div>
        <div className="truncate text-sm font-extrabold leading-tight">{prize.brand}</div>
        <div className="font-mono text-xs font-bold text-white/95">₹{prize.amount.toLocaleString("en-IN")} voucher</div>
      </div>
    </li>
  );
}

/**
 * "Top the weekly leaderboard, win a voucher": the vouchers the superadmin has put live for this week, who they are for, how long is
 * left and where the student stands. It draws nothing at all while no voucher is live (or if the request fails), so it can sit on any
 * page without ever showing an empty promise. `compact` is the slimmer strip for the dashboard home and the Contests page.
 */
export function WeeklyRewardsBanner({ variant = "full", className }: { variant?: "full" | "compact"; className?: string }) {
  const [banner, setBanner] = useState<RewardBanner | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<RewardBanner>("/weekly-rewards")
      .then((res) => alive && setBanner(res))
      .catch(() => alive && setBanner(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!banner) return null;

  if (!banner.live || banner.prizes.length === 0) {
    return banner.next && banner.next.prizes.length > 0 ? <NextWeekTeaser next={banner.next} className={className} /> : null;
  }

  const compact = variant === "compact";
  const minutesLeft = (new Date(banner.week.resets_at).getTime() - Date.now()) / 60000;
  const my = banner.my;

  return (
    <section
      aria-label="Weekly leaderboard rewards"
      className={cn(
        "relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1b1140] via-[#3b1d8f] to-[#6d28d9] text-white shadow-[0_24px_50px_-24px_rgba(76,29,149,0.75)]",
        className
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="hp-dots absolute inset-0 opacity-25 [mask-image:radial-gradient(70%_100%_at_95%_0%,#000,transparent)]" />
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="absolute -bottom-28 left-10 h-60 w-60 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      <div className={cn("relative z-10", compact ? "p-5" : "p-6 sm:p-7")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-900 shadow-[0_8px_20px_-8px_rgba(252,211,77,0.85)]">
              <Gift className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.14em] text-amber-200">
                <Trophy className="h-3 w-3" aria-hidden />
                Weekly leaderboard rewards
              </div>
              <h2 className={cn("font-extrabold tracking-tight", compact ? "text-lg" : "text-xl sm:text-2xl")}>Top the weekly leaderboard, win a voucher</h2>
              {!compact && (
                <p className="mt-1 max-w-xl text-13 leading-relaxed text-violet-100/85">
                  Score in contests, including the daily AptRun Daily Challenge. The board starts again from zero every Monday, and this week&apos;s top students win the vouchers below.
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
            <span className="text-3xs font-bold uppercase tracking-[0.14em] text-violet-100/80">Week resets in</span>
            <CountdownTimer minutesFromNow={minutesLeft} compact className="text-lg font-extrabold text-amber-200" />
          </div>
        </div>

        <ul className={cn("mt-5 flex flex-wrap gap-3", compact && "mt-4")}>
          {banner.prizes.map((prize) => (
            <PrizeCard key={prize.key} prize={prize} />
          ))}
        </ul>

        {banner.next && banner.next.prizes.length > 0 && (
          <p className="mt-3 text-2xs font-semibold text-violet-100/85">
            Next week: {banner.next.prizes.map((p) => `${p.brand} ₹${p.amount.toLocaleString("en-IN")}`).join(" · ")}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4 text-xs">
          <p className="text-violet-100/90">
            {my?.rank == null ? (
              <>You&apos;re not on this week&apos;s board yet — score in a contest to get on it.</>
            ) : my.prize ? (
              <>
                You&apos;re <strong className="text-amber-200">#{my.rank}</strong> with {my.contest_score} pts — right now that wins the <strong className="text-amber-200">{my.prize.brand}</strong> voucher.
              </>
            ) : (
              <>
                You&apos;re <strong className="text-amber-200">#{my.rank}</strong> with {my.contest_score} pts this week. Climb into the top {banner.prizes.length} to win.
              </>
            )}
          </p>
          {variant !== "full" && (
            <Link href="/dashboard/leaderboard" className="inline-flex items-center gap-1 font-bold text-white underline-offset-4 hover:underline">
              Weekly leaderboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

/** Nothing is live yet, but the next week's prize is already chosen: a slimmer card that says so, so students come back on Monday. */
function NextWeekTeaser({ next, className }: { next: NonNullable<RewardBanner["next"]>; className?: string }) {
  const minutes = (new Date(next.week.starts_at).getTime() - Date.now()) / 60000;

  return (
    <section
      aria-label="Next week's leaderboard rewards"
      className={cn("relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1b1140] via-[#3b1d8f] to-[#6d28d9] p-5 text-white shadow-[0_24px_50px_-24px_rgba(76,29,149,0.75)]", className)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-900">
            <Gift className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="mb-0.5 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.14em] text-amber-200">
              <Trophy className="h-3 w-3" aria-hidden /> Starts Monday
            </div>
            <h2 className="text-lg font-extrabold tracking-tight">Next week the top of the leaderboard wins a voucher</h2>
            <p className="mt-0.5 text-xs text-violet-100/85">Score in this week&apos;s contests to get a head start on the daily challenge.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
          <span className="text-3xs font-bold uppercase tracking-[0.14em] text-violet-100/80">Starts in</span>
          <CountdownTimer minutesFromNow={minutes} compact className="text-lg font-extrabold text-amber-200" />
        </div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-3">
        {next.prizes.map((prize) => (
          <PrizeCard key={prize.key} prize={prize} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The student's own wins: which voucher, from which week, and — once the superadmin has sent it — the code to copy. Draws nothing
 * until they have won something.
 */
export function MyRewards({ className }: { className?: string }) {
  const [wins, setWins] = useState<MyWin[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const [activeWin, setActiveWin] = useState<MyWin | null>(null);
  const [autoReveal, setAutoReveal] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<{ wins: MyWin[] }>("/weekly-rewards/mine")
      .then((res) => {
        if (!alive) return;
        setWins(res.wins);
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const rewardParam = params.get("reward");
          const copiedParam = params.get("copied") === "1";
          if (rewardParam) {
            const matched = res.wins.find((w) => w.id === Number(rewardParam));
            if (matched) {
              setActiveWin(matched);
              if (copiedParam) {
                setAutoReveal(true);
                if (matched.voucher_code) {
                  try {
                    navigator.clipboard.writeText(matched.voucher_code);
                  } catch {
                    /* clipboard write failed */
                  }
                }
              }
            }
          }
        }
      })
      .catch(() => alive && setWins([]));
    return () => {
      alive = false;
    };
  }, []);

  if (wins.length === 0) return null;

  const copy = async (win: MyWin) => {
    if (!win.voucher_code) return;
    try {
      await navigator.clipboard.writeText(win.voucher_code);
      setCopied(win.id);
      setTimeout(() => setCopied((c) => (c === win.id ? null : c)), 2000);
    } catch {
      /* the code is on screen; selecting it by hand still works */
    }
  };

  return (
    <>
      <section aria-label="Your rewards" className={cn("rounded-panel border border-amber-400/40 bg-amber-400/[0.07] p-5", className)}>
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-primary">
          <Gift className="h-4 w-4 text-amber-500" aria-hidden /> Your rewards
        </h2>
        <ul className="mt-3 space-y-2.5">
          {wins.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center gap-3 rounded-control border border-border-subtle bg-surface p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image's optimiser is unavailable */}
              <img src={w.logo} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg border border-border-subtle bg-white object-contain p-1" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-primary">
                  {w.brand} ₹{w.amount.toLocaleString("en-IN")} voucher
                </p>
                <p className="text-2xs text-text-muted">
                  Week of {new Date(w.week_key).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · finished #{w.rank}
                </p>
              </div>
              {w.status === "sent" && w.voucher_code ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveWin(w)}
                    className="inline-flex items-center gap-1.5 rounded-control bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:from-amber-600 hover:to-amber-700 transition-all active:scale-95"
                    aria-label={`Open voucher details for ${w.brand}`}
                  >
                    <Gift className="h-3.5 w-3.5" aria-hidden />
                    Open Voucher
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(w)}
                    className="inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 font-mono text-xs font-bold text-primary hover:bg-surface-hover"
                    aria-label={`Copy voucher code for ${w.brand}`}
                  >
                    {w.voucher_code}
                    {copied === w.id ? <Check className="h-3.5 w-3.5 text-status-success" aria-hidden /> : <Copy className="h-3.5 w-3.5 text-text-muted" aria-hidden />}
                  </button>
                </div>
              ) : w.status === "sent" ? (
                <span className="rounded-full border border-status-success/30 bg-status-success/10 px-2.5 py-1 text-3xs font-bold text-status-success">Sent to your e-mail</span>
              ) : (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-3xs font-bold text-amber-700 dark:text-amber-300">We&apos;re sending it</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {activeWin && (
        <VoucherRevealModal
          win={activeWin}
          autoReveal={autoReveal}
          onClose={() => {
            setActiveWin(null);
            setAutoReveal(false);
          }}
        />
      )}
    </>
  );
}
