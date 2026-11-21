"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Gift, Loader2, Undo2, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ToastTrigger } from "@/lib/toast";
import type { LedgerWinner, WinnerStatus } from "@/types/weeklyRewards";
import { VOUCHER_COMPANIES } from "./AwardCouponModal";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const TH = "py-2 pr-3 text-left text-3xs font-bold uppercase tracking-wider text-text-muted";

const STATUS_TONE: Record<WinnerStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  sent: "border-status-success/30 bg-status-success/10 text-status-success",
  cancelled: "border-border-strong bg-elevated text-text-muted",
  not_recorded: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};
const STATUS_LABEL: Record<WinnerStatus, string> = { pending: "To send", sent: "Sent", cancelled: "Cancelled", not_recorded: "Not closed out" };

function weekLabel(key: string | undefined) {
  if (!key) return "";
  return new Date(key).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * The winners ledger: everyone who won a voucher in a week that has closed, with where it stands. The superadmin buys and sends the
 * voucher by hand, types the code (kept encrypted) and marks it sent — the student is then told in their bell and sees the code on the
 * Contests page. A week closes by itself on Monday just after midnight IST; "Close out last week" does it now.
 */
export function WinnersLedger({ triggerToast, closeOutNeeded, onClosedOut }: { triggerToast: ToastTrigger; closeOutNeeded: boolean; onClosedOut: () => void }) {
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "cancelled">("all");
  const [rows, setRows] = useState<LedgerWinner[] | null>(null);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<number | "close" | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    api
      .get<{ rows: LedgerWinner[]; pending: number }>(`/superadmin/weekly-rewards/winners${filter === "all" ? "" : `?status=${filter}`}`)
      .then((res) => {
        setRows(res.rows ?? []);
        setPending(res.pending ?? 0);
      })
      .catch(() => setFailed(true));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const closeOut = async () => {
    setBusy("close");
    try {
      const res = await api.post<{ created: number; week: string }>("/superadmin/weekly-rewards/winners/finalize", {});
      triggerToast(res.created > 0 ? `Recorded ${res.created} winner${res.created === 1 ? "" : "s"} for the week of ${weekLabel(res.week)} and told them.` : "Nothing new to record: that week was already closed out.");
      load();
      onClosedOut();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't close out the week.", "error");
    } finally {
      setBusy(null);
    }
  };

  const save = async (row: LedgerWinner, patch: { card?: string; status?: WinnerStatus; voucher_code?: string; note?: string }) => {
    if (row.id === null) return;
    setBusy(row.id);
    try {
      await api.patch(`/superadmin/weekly-rewards/winners/${row.id}`, patch);
      triggerToast(patch.status === "sent" ? `🎉 ${row.user.name} has been told: voucher coupon code sent via email & dashboard.` : "Saved.");
      load();
      onClosedOut();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Couldn't save that.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="min-w-0 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle" aria-label="Winners ledger">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-primary">
            <Gift className="h-4 w-4 text-accent-primary" aria-hidden /> Winners &amp; vouchers
            {pending > 0 && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-3xs font-bold text-amber-700 dark:text-amber-300">{pending} to send</span>}
          </h3>
          <p className="mt-0.5 text-2xs text-text-muted">Buy and send each voucher, paste its code, then mark it sent — the student is told in their bell and sees the code on their Contests page.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {closeOutNeeded && (
            <button type="button" onClick={closeOut} disabled={busy !== null} className="inline-flex h-8 items-center gap-1.5 rounded-btn bg-accent-primary px-3 text-2xs font-bold text-white hover:bg-accent-primary-hover disabled:opacity-60">
              {busy === "close" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />} Close out last week
            </button>
          )}
          <div role="group" aria-label="Filter winners" className="flex gap-1 rounded-control border border-border-subtle bg-elevated p-1">
            {(["all", "pending", "sent", "cancelled"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn("rounded-control px-2.5 py-1 text-3xs font-bold capitalize", filter === f ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}>
                {f === "pending" ? "To send" : f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {failed ? (
        <p className="mt-4 text-xs text-status-danger">
          Couldn&apos;t load the ledger.{" "}
          <button type="button" className="font-bold underline" onClick={load}>
            Retry
          </button>
        </p>
      ) : rows === null ? (
        <p className="mt-4 text-xs text-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-control border border-dashed border-border-strong px-4 py-8 text-center text-2xs text-text-muted">
          {closeOutNeeded ? "Last week has not been closed out yet. It closes by itself on Monday just after midnight IST." : "No winners here yet. They are recorded when a week with live vouchers ends."}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className={TH}>Week</th>
                <th className={TH}>Winner</th>
                <th className={TH}>Voucher</th>
                <th className={TH}>Status</th>
                <th className={TH}>Code &amp; note</th>
                <th className={cn(TH, "pr-0 text-right")}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <LedgerRow key={r.id ?? `${r.user.id}-${r.rank}`} row={r} busy={busy === r.id} onSave={(patch) => save(r, patch)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LedgerRow({ row, busy, onSave }: { row: LedgerWinner; busy: boolean; onSave: (patch: { card?: string; status?: WinnerStatus; voucher_code?: string; note?: string }) => void }) {
  const [card, setCard] = useState(row.prize?.key ?? "dominos");
  const [code, setCode] = useState(row.voucher_code ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const dirty = card !== (row.prize?.key ?? "") || code !== (row.voucher_code ?? "") || note !== (row.note ?? "");

  const activeCompany = VOUCHER_COMPANIES.find((c) => c.key === card) || VOUCHER_COMPANIES[0];

  return (
    <tr className="border-b border-border-subtle align-top last:border-0 hover:bg-elevated/30">
      <td className="py-3 pr-3 text-text-muted">{weekLabel(row.week_key)}</td>
      <td className="py-3 pr-3">
        <div className="font-bold text-primary">
          <span aria-hidden>{MEDAL[row.rank] ?? `#${row.rank}`}</span> {row.user.name}
        </div>
        <div className="text-2xs font-medium text-accent-primary">{row.email ?? "no email on file"}</div>
        {row.college && <div className="text-3xs text-text-muted">{row.college}</div>}
      </td>
      <td className="py-3 pr-3">
        {row.id !== null ? (
          <div className="space-y-1">
            <select
              value={card}
              onChange={(e) => setCard(e.target.value)}
              className="h-8 w-full rounded-control border border-border-subtle bg-elevated px-2 text-2xs font-bold text-primary outline-none focus:border-accent-primary"
            >
              {VOUCHER_COMPANIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.brand} (₹{c.amount})
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 text-3xs text-text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeCompany.logo} alt="" width={16} height={16} className="h-4 w-4 rounded-full bg-white object-contain p-0.5" />
              <span>₹{activeCompany.amount} value</span>
            </div>
          </div>
        ) : row.prize ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full py-0.5 pl-0.5 pr-2 text-3xs font-bold text-white" style={{ background: row.prize.color }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static export: next/image's optimiser is unavailable */}
            <img src={row.prize.logo} alt="" width={16} height={16} className="h-4 w-4 rounded-full bg-white object-contain p-0.5" />
            {row.prize.brand} ₹{row.prize.amount}
          </span>
        ) : null}
      </td>
      <td className="py-3 pr-3">
        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-3xs font-bold", STATUS_TONE[row.status])}>{STATUS_LABEL[row.status]}</span>
        {row.sent_at && <div className="mt-1 text-3xs text-text-muted">{new Date(row.sent_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>}
      </td>
      <td className="py-3 pr-3">
        {row.id === null ? (
          <span className="text-2xs text-text-muted">—</span>
        ) : (
          <div className="flex min-w-[13rem] flex-col gap-1.5">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Type voucher code (e.g. DOMINOS-50)" aria-label={`Voucher code for ${row.user.name}`} className="h-8 rounded-control border border-border-subtle bg-elevated px-2 font-mono text-2xs font-bold text-primary placeholder:font-sans placeholder:font-normal placeholder:text-text-muted focus:border-accent-primary focus:outline-none" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (e.g. sent by e-mail)" aria-label={`Note for ${row.user.name}`} className="h-8 rounded-control border border-border-subtle bg-elevated px-2 text-2xs text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none" />
            {dirty && (
              <button type="button" disabled={busy} onClick={() => onSave({ card, voucher_code: code, note })} className="self-start rounded-control border border-border-strong px-2.5 py-1 text-3xs font-bold text-primary hover:bg-elevated disabled:opacity-60">
                Save details
              </button>
            )}
          </div>
        )}
      </td>
      <td className="py-3 text-right">
        {row.id !== null && (
          <div className="flex flex-col items-end gap-1.5">
            {row.status !== "sent" && row.status !== "cancelled" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onSave({ status: "sent", ...(card !== (row.prize?.key ?? "") ? { card } : {}), voucher_code: code, note })}
                className="inline-flex items-center gap-1 rounded-btn bg-status-success px-3 py-1.5 text-2xs font-bold text-white shadow-subtle hover:opacity-95 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Gift className="h-3 w-3" aria-hidden />} Give Coupon &amp; Mark sent
              </button>
            )}
            {row.status === "pending" && (
              <button type="button" disabled={busy} onClick={() => onSave({ status: "cancelled" })} className="inline-flex items-center gap-1 text-3xs font-bold text-text-muted hover:text-status-danger">
                <X className="h-3 w-3" aria-hidden /> Cancel prize
              </button>
            )}
            {(row.status === "sent" || row.status === "cancelled") && (
              <button type="button" disabled={busy} onClick={() => onSave({ status: "pending" })} className="inline-flex items-center gap-1 text-3xs font-bold text-text-muted hover:text-primary">
                <Undo2 className="h-3 w-3" aria-hidden /> Back to “to send”
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
