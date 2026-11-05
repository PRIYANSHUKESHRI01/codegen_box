"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, CheckCircle2, Copy, Gift, Loader2, Radio, Trophy } from "lucide-react";
import { PrizeCard } from "@/components/leaderboard/WeeklyRewardsBanner";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ToastTrigger } from "@/lib/toast";
import type { AdminRewardCard, AdminRewards, AdminStanding, Prize, ScheduleWeek, WeekInfo } from "@/types/weeklyRewards";
import { DailyStatusCard } from "./rewards/DailyStatusCard";
import { WinnersLedger } from "./rewards/WinnersLedger";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
}

/** "Mon 2 Nov – Sun 8 Nov": the week as the leaderboard counts it (Monday 00:00 to Sunday 23:59 IST). */
function weekRange(week: WeekInfo) {
  return `${day(week.starts_at)} – ${day(new Date(new Date(week.resets_at).getTime() - 60_000).toISOString())}`;
}

/**
 * Superadmin -> Contest Rewards. Two things live here: the AptRun Daily Challenge's status (is tonight's edition scheduled, with its three
 * problems?) and the weekly leaderboard's prizes.
 *
 * Prizes are chosen per WEEK. Pick any week from this one to four ahead, put voucher cards on it, and that is all: when its Monday arrives
 * the prize shows on every student's dashboard, Contests page and leaderboard by itself. The live cards go to the top ranks in order of
 * value (the biggest voucher to rank 1). When a week closes, its winners land in the ledger below to be sent their vouchers.
 *
 * Each change is explicit (live / not live), never a blind flip, so two admins or two tabs cannot undo each other.
 */
export function WeeklyRewardsPanel({ triggerToast }: { triggerToast: ToastTrigger }) {
  const [data, setData] = useState<AdminRewards | null>(null);
  const [week, setWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(
    (weekKey: string | null = week) => {
      setFailed(false);
      api
        .get<AdminRewards>(`/superadmin/weekly-rewards${weekKey ? `?week=${weekKey}` : ""}`)
        .then(setData)
        .catch((err) => {
          setFailed(true);
          triggerToast(err instanceof ApiError ? err.message : "Couldn't load the weekly rewards.", "error");
        })
        .finally(() => setLoading(false));
    },
    [week, triggerToast]
  );

  useEffect(() => {
    load(week);
    // `load` changes with the week; reloading is exactly what choosing a week should do
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week]);

  const pick = (key: string) => setWeek(key);

  const change = async (card: AdminRewardCard, live: boolean) => {
    if (saving || !data) return;
    setSaving(card.key);
    try {
      const res = await api.put<AdminRewards & { changed: boolean }>(`/superadmin/weekly-rewards/${card.key}`, { live, week: data.week.key });
      setData(res);
      const when = res.week.is_current ? "this week" : `the week of ${day(res.week.starts_at)}`;
      triggerToast(
        !res.changed
          ? `${card.brand} was already ${live ? "live" : "off"}.`
          : live
            ? res.week.is_current
              ? `${card.brand} ₹${card.amount} is live — every student sees it now, until Monday.`
              : `${card.brand} ₹${card.amount} is set for ${when}. It shows to every student by itself when that week starts.`
            : `${card.brand} is off ${when}'s leaderboard.`
      );
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't change it. Check your connection and try again.", "error");
    } finally {
      setSaving(null);
    }
  };

  const copyFrom = async (from: ScheduleWeek) => {
    if (saving || !data) return;
    setSaving("copy");
    try {
      const res = await api.post<AdminRewards & { copied: number }>("/superadmin/weekly-rewards/copy", { from: from.key, to: data.week.key });
      setData(res);
      triggerToast(res.copied === 0 ? "That week had no vouchers, so this week has none either." : `Copied ${res.copied} voucher${res.copied === 1 ? "" : "s"} from the week of ${day(from.starts_at)}.`);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't copy that week.", "error");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading weekly rewards">
        <div className="h-24 animate-pulse rounded-panel border border-border-subtle bg-surface" />
        <div className="h-72 animate-pulse rounded-panel border border-border-subtle bg-surface" />
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center">
        <p className="text-sm font-bold text-primary">Couldn&apos;t load the weekly rewards</p>
        <p className="mt-1 text-xs text-text-muted">Check your connection, then try again.</p>
        <button type="button" onClick={() => load()} className="mt-4 rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs font-bold text-text-secondary hover:text-primary">
          Retry
        </button>
      </div>
    );
  }

  const live = data.cards.filter((c) => c.live).sort((a, b) => (a.prize_rank ?? 99) - (b.prize_rank ?? 99));
  const schedule = data.schedule ?? [];
  const selectedIndex = schedule.findIndex((w) => w.key === data.week.key);
  const previous = selectedIndex > 0 ? schedule[selectedIndex - 1] : null;
  const current = data.week.is_current;
  const closeOutNeeded = data.last_week.winners.some((w) => w.status === "not_recorded");
  const resets = data.current_week?.resets_at ?? data.week.resets_at;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <Gift className="h-5 w-5 shrink-0 text-accent-primary" />
            <span>Contest Rewards</span>
          </h2>
          <p className="mt-1 text-xs text-text-muted">The daily contest, and the vouchers the top of each week&apos;s leaderboard wins. Choose a week, put voucher cards on it, and it starts showing to students when that week begins.</p>
        </div>
        <div className="shrink-0 rounded-panel border border-border-subtle bg-surface px-4 py-2.5 text-xs shadow-subtle">
          <div className="text-3xs font-bold uppercase tracking-wider text-text-muted">This week · {data.current_week ? weekRange(data.current_week) : weekRange(data.week)}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-text-secondary">
            Resets in <CountdownTimer minutesFromNow={(new Date(resets).getTime() - Date.now()) / 60000} compact className="font-bold text-primary" />
          </div>
        </div>
      </div>

      {data.daily && <DailyStatusCard daily={data.daily} />}

      {/* Which week */}
      {schedule.length > 0 && (
        <section aria-label="Choose a week" className="min-w-0">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
            <CalendarPlus className="h-4 w-4 text-accent-primary" aria-hidden /> Prizes by week
          </h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {schedule.map((w, i) => {
              const selected = w.key === data.week.key;
              return (
                <li key={w.key}>
                  <button
                    type="button"
                    onClick={() => pick(w.key)}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-full w-full flex-col gap-2 rounded-panel border p-3 text-left transition-colors",
                      selected ? "border-accent-primary bg-accent-primary/5 ring-1 ring-accent-primary/30" : "border-border-subtle bg-surface hover:border-border-strong"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-3xs font-bold uppercase tracking-wider text-text-muted">{i === 0 ? "This week" : i === 1 ? "Next week" : `In ${i} weeks`}</span>
                      {w.is_current && <Radio className="h-3 w-3 text-emerald-500" aria-label="Live now" />}
                    </span>
                    <span className="text-xs font-bold text-primary">{weekRange(w)}</span>
                    {w.prizes.length === 0 ? (
                      <span className="text-2xs text-text-muted">No prize chosen</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {w.prizes.map((p: Prize) => (
                          // eslint-disable-next-line @next/next/no-img-element -- static export: next/image's optimiser is unavailable
                          <img key={p.key} src={p.logo} alt={`${p.brand} (rank ${p.rank})`} title={`#${p.rank} ${p.brand} ₹${p.amount}`} width={24} height={24} className="h-6 w-6 rounded-md border border-border-subtle bg-white object-contain p-0.5" />
                        ))}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* The shelf */}
      <section aria-label="Voucher cards" className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-primary">
            {current ? "This week's vouchers" : `Vouchers for the week of ${day(data.week.starts_at)}`}
            <span className="ml-2 text-2xs font-normal text-text-muted">{weekRange(data.week)}</span>
          </h3>
          {previous && (
            <button type="button" onClick={() => copyFrom(previous)} disabled={saving !== null} className="inline-flex h-8 items-center gap-1.5 rounded-btn border border-border-strong bg-surface px-3 text-2xs font-bold text-primary hover:bg-elevated disabled:opacity-60">
              {saving === "copy" ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Copy className="h-3 w-3" aria-hidden />} Same as the week before
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.cards.map((card) => (
            <article
              key={card.key}
              className={cn(
                "flex flex-col gap-3 rounded-panel border bg-surface p-4 shadow-subtle transition-colors",
                card.live ? "border-status-success/40 ring-1 ring-status-success/20" : "border-border-subtle"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image's optimiser is unavailable */}
                <img src={card.logo} alt={`${card.brand} logo`} width={48} height={48} draggable={false} className="h-12 w-12 rounded-xl border border-border-subtle bg-white object-contain p-2" />
                {card.live ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-status-success/30 bg-status-success/10 px-2 py-0.5 text-3xs font-bold text-status-success">
                    <Radio className="h-3 w-3" aria-hidden /> {current ? "Live" : "Set"} · Rank #{card.prize_rank}
                  </span>
                ) : (
                  <span className="rounded-full border border-border-strong bg-elevated px-2 py-0.5 text-3xs font-bold text-text-muted">Not live</span>
                )}
              </div>
              <div className="h-1 rounded-full" style={{ background: card.color }} aria-hidden />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-extrabold text-primary">{card.brand}</h3>
                <div className="font-mono text-base font-black text-primary">₹{card.amount.toLocaleString("en-IN")}</div>
                <p className="mt-0.5 text-2xs text-text-muted">{card.tagline}</p>
              </div>
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => change(card, !card.live)}
                className={cn(
                  "mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-btn px-3 text-xs font-bold transition-all disabled:opacity-60",
                  card.live ? "border border-border-strong bg-elevated text-primary hover:bg-surface-hover" : "bg-accent-primary text-white shadow-subtle hover:bg-accent-primary-hover"
                )}
              >
                {saving === card.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : card.live ? "Take off" : current ? "Go live" : "Schedule"}
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* What students see */}
      <section className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
        <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
          <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden /> {current ? "What students see this week" : `What students will see from ${day(data.week.starts_at)}`}
        </h3>
        {live.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            {current ? "Nothing is live, so students see no rewards banner. Press Go live on a card above." : "No vouchers chosen for this week yet. Press Schedule on a card above."}
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-2xs text-text-muted">The biggest voucher goes to rank 1, the next to rank 2, and so on.{!current && " Students also see a preview of it in the week before."}</p>
            <ul className="mt-4 flex flex-wrap gap-3 rounded-2xl bg-gradient-to-br from-[#1b1140] via-[#3b1d8f] to-[#6d28d9] p-4">
              {live.map((c) => (
                <PrizeCard key={c.key} prize={{ ...c, rank: c.prize_rank ?? 0 }} />
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="space-y-6">
        <section className="min-w-0 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle">
          <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
            <Trophy className="h-4 w-4 text-amber-500" aria-hidden /> {data.week.is_future ? "Leaderboard" : current ? "This week's board" : "That week's board"}
          </h3>
          <p className="mt-0.5 text-2xs text-text-muted">{data.week.is_future ? "The board starts from zero on Monday." : "Contest points since Monday — the prize each rank would win right now."}</p>
          <StandingsTable rows={data.standings} empty={data.week.is_future ? "This week has not started." : "Nobody has scored in a contest this week yet."} />
        </section>

        <WinnersLedger triggerToast={triggerToast} closeOutNeeded={closeOutNeeded} onClosedOut={() => load()} />
      </div>
    </div>
  );
}

const TH = "py-2 pr-3 text-left text-3xs font-bold uppercase tracking-wider text-text-muted";

function PrizeChip({ prize }: { prize: AdminStanding["prize"] }) {
  if (!prize) return <span className="text-text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-0.5 pr-2 text-3xs font-bold text-white" style={{ background: prize.color }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image's optimiser is unavailable */}
      <img src={prize.logo} alt="" width={16} height={16} draggable={false} className="h-4 w-4 rounded-full bg-white object-contain p-0.5" />
      {prize.brand} ₹{prize.amount}
    </span>
  );
}

function StandingsTable({ rows, empty }: { rows: AdminStanding[]; empty: string }) {
  if (rows.length === 0) return <p className="mt-4 text-xs text-text-muted">{empty}</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border-subtle">
            <th className={TH}>Rank</th>
            <th className={TH}>Student</th>
            <th className={TH}>Prize</th>
            <th className={cn(TH, "pr-0 text-right")}>Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.user.id} className="border-b border-border-subtle last:border-0">
              <td className="py-2.5 pr-3 font-mono font-bold">{MEDAL[r.rank] ?? `#${r.rank}`}</td>
              <td className="py-2.5 pr-3">
                <div className="font-bold text-primary">{r.user.name}</div>
                <div className="font-mono text-2xs text-text-muted">@{r.user.handle}</div>
              </td>
              <td className="py-2.5 pr-3">
                <PrizeChip prize={r.prize} />
              </td>
              <td className="py-2.5 text-right font-mono font-bold text-primary">{r.contest_score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
