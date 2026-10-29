"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RotateCcw, ShieldCheck, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import type { ReadinessDetailResponse } from "@/types/superadminReadiness";

const field = "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary";

const DURATIONS: { value: string; label: string }[] = [
  { value: "", label: "Until I remove it" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

function barTone(score: number) {
  if (score >= 75) return "bg-status-success";
  if (score >= 45) return "bg-accent-primary";
  if (score > 0) return "bg-status-warning";
  return "bg-status-danger";
}

interface ReadinessEditModalProps {
  studentId: number;
  onClose: () => void;
  /** Called after a change so the list behind can refresh; the message is what to toast. */
  onChanged: (message: string) => void;
}

/**
 * Set one student's readiness score by hand, or hand them back to the calculated one.
 *
 * The number replaces the calculated score everywhere at once - the student's dashboard and Vault page, their TPO's roster and
 * reports, the Vault itself - and a student pushed over the Vault line is moved into the Vault straight away. It can have an
 * end date; when that passes (or the superadmin removes it) the student's own activity decides the score again. A reason is
 * required and kept in the audit log; the student is told their score changed, not why.
 */
export function ReadinessEditModal({ studentId, onClose, onChanged }: ReadinessEditModalProps) {
  const [detail, setDetail] = useState<ReadinessDetailResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState<"save" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ReadinessDetailResponse>(`/superadmin/readiness/${studentId}`);
      setDetail(res);
      setScore((current) => (current === "" ? String(res.override?.in_force ? res.override.score : res.score) : current));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load this student's score.");
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const scoreNumber = /^\d{1,3}$/.test(score.trim()) ? Number(score.trim()) : null;
  const validScore = scoreNumber !== null && scoreNumber <= 100;
  const reasonOk = reason.trim().length >= 3;
  const held = detail?.override ?? null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validScore || !reasonOk || working) return;
    setWorking("save");
    setError(null);

    try {
      await api.put<ReadinessDetailResponse>(`/superadmin/readiness/${studentId}`, {
        score: scoreNumber,
        reason: reason.trim(),
        ...(days ? { days: Number(days) } : {}),
      });
      onChanged(`${detail?.student.name}'s readiness score is now ${scoreNumber}${days ? ` for ${DURATIONS.find((d) => d.value === days)?.label}` : ""}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.score?.[0] ?? err.errors?.reason?.[0] ?? err.errors?.days?.[0] ?? err.message : "Something went wrong. Check your connection and try again.");
      setWorking(null);
    }
  };

  const clear = async () => {
    if (!reasonOk || working) return;
    setWorking("clear");
    setError(null);

    try {
      const res = await api.delete<ReadinessDetailResponse>(`/superadmin/readiness/${studentId}`, { reason: reason.trim() });
      onChanged(`${detail?.student.name} is back on their calculated score: ${res.score}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.reason?.[0] ?? err.message : "Something went wrong. Check your connection and try again.");
      setWorking(null);
    }
  };

  const line = detail?.vault.threshold ?? 60;

  return (
    <Modal
      onClose={() => !working && onClose()}
      title="Readiness score"
      subtitle={detail ? `${detail.student.name} · ${detail.student.college ?? "Independent student"}` : undefined}
      icon={Target}
      size="2xl"
      closeOnBackdrop={false}
      showCloseButton={!working}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={!!working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Close
          </button>
          {held && (
            <button
              type="button"
              onClick={() => void clear()}
              disabled={!reasonOk || !!working}
              title={reasonOk ? undefined : "Give a reason first"}
              className="inline-flex items-center gap-2 rounded-control border border-border-strong bg-elevated px-4 py-2 font-semibold text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {working === "clear" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Use the calculated score
            </button>
          )}
          <button
            type="submit"
            form="readiness-form"
            disabled={!validScore || !reasonOk || !!working}
            className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working === "save" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Set score
          </button>
        </>
      }
    >
      {loadError && (
        <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
          {loadError}
        </div>
      )}

      {!detail && !loadError && <div className="h-48 animate-pulse rounded-panel bg-elevated" aria-busy="true" />}

      {detail && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-panel border border-border-subtle bg-elevated/50 p-3.5">
              <div className="text-3xs font-bold uppercase tracking-wide text-text-muted">Shown everywhere now</div>
              <div className="mt-1 font-mono text-2xl font-extrabold text-primary">{detail.score}</div>
              <div className="text-3xs text-text-muted">{detail.tier}</div>
            </div>
            <div className="rounded-panel border border-border-subtle bg-elevated/50 p-3.5">
              <div className="text-3xs font-bold uppercase tracking-wide text-text-muted">From their activity</div>
              <div className="mt-1 font-mono text-2xl font-extrabold text-primary">{detail.calculated_score}</div>
              <div className="text-3xs text-text-muted">
                {detail.calculated_tier}
                {detail.missed_day_penalty > 0 && ` · −${detail.missed_day_penalty} for missed days`}
              </div>
            </div>
            <div className="rounded-panel border border-border-subtle bg-elevated/50 p-3.5">
              <div className="text-3xs font-bold uppercase tracking-wide text-text-muted">Vault line</div>
              <div className={cn("mt-1 font-mono text-2xl font-extrabold", detail.vault.qualifies ? "text-status-success" : "text-primary")}>{line}</div>
              <div className="text-3xs text-text-muted">{detail.vault.qualifies ? "Met" : `${detail.vault.points_needed} short`}</div>
            </div>
          </div>

          {held && (
            <div
              className={cn(
                "flex items-start gap-2.5 rounded-control border p-3 text-xs leading-relaxed",
                held.in_force ? "border-accent-primary/30 bg-accent-primary/5 text-text-secondary" : "border-border-subtle bg-elevated/50 text-text-muted"
              )}
            >
              <ShieldCheck className={cn("mt-0.5 h-4 w-4 shrink-0", held.in_force ? "text-accent-primary" : "text-text-muted")} aria-hidden />
              <div>
                {held.in_force ? (
                  <>
                    Set to <strong className="text-primary">{held.score}</strong> by {held.set_by ?? "a superadmin"} on {fmt(held.set_at)}
                    {held.expires_at ? `, until ${fmt(held.expires_at)}` : ", until it is removed"}.
                  </>
                ) : (
                  <>
                    A score of {held.score} set by {held.set_by ?? "a superadmin"} ran out on {fmt(held.expires_at)}; the student is back on their calculated score.
                  </>
                )}{" "}
                <span className="text-text-muted">Reason: “{held.reason}”</span>
              </div>
            </div>
          )}

          <form id="readiness-form" onSubmit={save} className="space-y-4 rounded-panel border border-border-subtle p-4">
            <div>
              <label htmlFor="readiness-score" className="mb-1 block text-xs font-semibold text-text-secondary">
                Set the score to
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="readiness-score"
                  inputMode="numeric"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  aria-invalid={!validScore}
                  className={cn(field, "w-24 text-center font-mono text-sm font-bold", !validScore && "border-status-danger")}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={validScore ? scoreNumber : 0}
                  onChange={(e) => setScore(e.target.value)}
                  aria-label="Score slider"
                  className="h-1.5 min-w-[160px] flex-1 cursor-pointer accent-accent-primary"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { label: `Calculated (${detail.calculated_score})`, value: detail.calculated_score },
                  { label: `Vault line (${line})`, value: line },
                  { label: "80", value: 80 },
                  { label: "100", value: 100 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setScore(String(preset.value))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-3xs font-bold transition-colors",
                      scoreNumber === preset.value ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-elevated text-text-secondary hover:text-primary"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {!validScore ? (
                <p className="mt-1.5 text-2xs text-status-danger">Enter a whole number from 0 to 100.</p>
              ) : (
                <p className="mt-1.5 text-2xs text-text-muted">
                  {scoreNumber >= line
                    ? `At ${scoreNumber} the student meets the Vault line (${line}): they become Vault-eligible straight away and are told.`
                    : `At ${scoreNumber} the student is below the Vault line (${line}). A student already in the Vault stays until their score falls under the exit line.`}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="readiness-days" className="mb-1 block text-xs font-semibold text-text-secondary">
                  Keep it for
                </label>
                <select id="readiness-days" value={days} onChange={(e) => setDays(e.target.value)} className={field}>
                  {DURATIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-2xs text-text-muted">After this the student&apos;s own activity decides the score again.</p>
              </div>
              <div>
                <label htmlFor="readiness-reason" className="mb-1 block text-xs font-semibold text-text-secondary">
                  Reason <span className="font-normal text-text-muted">(audit log only — the student isn&apos;t shown it)</span>
                </label>
                <textarea id="readiness-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cleared the offline aptitude round" className={cn(field, "resize-none")} />
              </div>
            </div>

            {error && (
              <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
                {error}
              </div>
            )}
          </form>

          <div>
            <h3 className="mb-2 text-3xs font-bold uppercase tracking-wide text-text-muted">What the activity score is made of</h3>
            <div className="space-y-2">
              {detail.components.map((c) => (
                <div key={c.key} className="flex items-center gap-3 text-xs">
                  <span className="w-40 shrink-0 truncate font-semibold text-primary">{c.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
                    <div className={cn("h-full rounded-full", barTone(c.score ?? 0))} style={{ width: `${c.score ?? 0}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono text-text-muted">
                    {c.score ?? 0}% · {c.contribution ?? 0}/{c.weight ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {detail.history.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wide text-text-muted">
                <History className="h-3 w-3" aria-hidden /> Changes by hand
              </h3>
              <ul className="divide-y divide-border-subtle rounded-control border border-border-subtle text-xs">
                {detail.history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
                    <span className="text-primary">
                      {h.score !== null ? `Set to ${h.score}` : `Removed — back to ${h.score_after ?? "calculated"}`}
                      <span className="text-text-muted"> · {h.by}</span>
                    </span>
                    <span className="text-text-muted">{fmt(h.at)}</span>
                    {h.reason && <span className="basis-full text-text-muted">“{h.reason}”</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
