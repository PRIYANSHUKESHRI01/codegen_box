"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, History, LockOpen, PencilLine, Plus, RotateCcw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { type ToastTrigger } from "@/lib/toast";
import type { VaultAiQualificationRow, VaultAiStudentResponse } from "@/types/superadminVaultAi";
import { VaultAiActionModal, type VaultAiAction } from "../VaultAiActionModal";
import { VaultAiStatusBadge } from "../vaultAiUi";

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const SELECT = "rounded-control border border-border-subtle bg-elevated px-2.5 py-2 text-xs text-primary outline-none focus:border-accent-primary";

const ACTION_WORDS: Record<string, string> = { reset: "Reset", scores: "Marks changed", qualified: "Marked qualified" };

function Marks({ scores }: { scores: Record<string, number> }) {
  return (
    <span className="inline-flex items-center gap-1">
      {["1", "2", "3"].map((set) => (
        <span key={set} className="rounded-lg bg-elevated px-2 py-1 font-mono text-2xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
          S{set} <span className="text-primary">{scores[set] !== undefined ? `${scores[set]}%` : "—"}</span>
        </span>
      ))}
    </span>
  );
}

const btn = "inline-flex items-center gap-1.5 rounded-control border border-border-strong bg-elevated px-3 py-1.5 text-2xs font-bold text-primary transition-colors hover:bg-surface-hover";

function StackCard({
  stackKey,
  stackName,
  row,
  onAction,
}: {
  stackKey: string;
  stackName: string;
  row: VaultAiQualificationRow | null;
  onAction: (action: VaultAiAction) => void;
}) {
  const history = row?.attempt_history ?? [];
  // The server refuses only a stack the student has not touched at all (Series 1, no marks, no history).
  const canReset = row !== null && (row.status !== "in_progress" || row.current_attempt > 1 || Object.keys(row.series_scores).length > 0 || history.length > 0);
  const cycle = history.filter((a) => a.this_cycle);
  const older = history.filter((a) => !a.this_cycle);

  return (
    <section aria-label={stackName} className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-primary">{stackName}</h3>
          <p className="text-3xs text-text-muted">{row?.role_name ?? "Not started"}</p>
        </div>
        {row ? <VaultAiStatusBadge row={row} /> : <span className="rounded-full border border-border-subtle bg-elevated px-2 py-0.5 text-3xs font-bold text-text-muted">Not started</span>}
      </div>

      {row && (
        <div className="mt-3 space-y-2 text-xs text-text-secondary">
          {row.is_blocked && (
            <p>
              Failed all {row.max_attempts} series. Blocked until <strong className="text-primary">{fmt(row.cooldown_until)}</strong> — {row.cooldown_days_remaining} day{row.cooldown_days_remaining === 1 ? "" : "s"} to go.
            </p>
          )}
          {row.cooldown_over && <p>The 45-day block ended on {fmt(row.cooldown_until)}. The student can sit again without anyone doing anything.</p>}
          {row.status === "in_progress" && (
            <p>
              On <strong className="text-primary">Series {row.current_attempt}</strong> of {row.max_attempts} · {row.failed_attempts} failed so far.
            </p>
          )}
          {row.status === "qualified" && (
            <p className="flex flex-wrap items-center gap-1.5">
              Qualified on {fmt(row.qualified_at)} with <strong className="text-primary">{row.series_average}%</strong>
              {row.qualified_by_admin && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent-primary/30 bg-accent-primary/10 px-1.5 py-px text-3xs font-bold text-accent-primary">
                  <ShieldCheck className="h-2.5 w-2.5" aria-hidden /> set by a superadmin
                </span>
              )}
            </p>
          )}
          {(row.status === "in_progress" || row.status === "qualified") && Object.keys(row.series_scores).length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">{row.status === "qualified" ? "Qualifying series" : "This series"}</span>
              <Marks scores={row.series_scores} />
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1.5 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wide text-text-muted">
            <History className="h-3 w-3" aria-hidden /> Failed attempts
          </h4>
          <ul className="divide-y divide-border-subtle rounded-control border border-border-subtle text-xs">
            {[...cycle, ...older].map((a) => (
              <li key={a.index} className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2", !a.this_cycle && "opacity-60")}>
                <div>
                  <span className="font-semibold text-primary">Attempt {a.attempt}</span>
                  <span className="text-text-muted"> · {fmt(a.evaluated_at)}</span>
                  {!a.this_cycle && <span className="ml-1.5 text-3xs text-text-muted">(earlier cycle)</span>}
                  {a.edited_by_admin && <span className="ml-1.5 text-3xs font-bold text-accent-primary">corrected</span>}
                </div>
                <Marks scores={a.scores} />
                <span className={cn("font-mono font-bold", a.passed ? "text-status-success" : "text-status-danger")}>{Math.round(a.average)}%</span>
                <button type="button" onClick={() => onAction({ kind: "scores", stackKey, stackName, row: row!, attempt: a })} className={btn} aria-label={`Correct attempt ${a.attempt} of ${stackName}`}>
                  <PencilLine className="h-3 w-3" /> Correct
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {row && canReset && (
          <button
            type="button"
            onClick={() => onAction({ kind: "reset", stackKey, stackName, row })}
            className={cn(btn, row.is_blocked && "border-accent-primary bg-accent-primary text-white hover:bg-accent-primary-hover hover:text-white", row.status === "qualified" && "border-status-danger/30 bg-status-danger/10 text-status-danger hover:bg-status-danger/20")}
          >
            <RotateCcw className="h-3 w-3" /> {row.status === "qualified" ? "Take qualification back" : row.is_blocked ? "Give access again" : "Give 3 fresh attempts"}
          </button>
        )}
        {row && row.status !== "cooling_down" && (
          <button type="button" onClick={() => onAction({ kind: "scores", stackKey, stackName, row, attempt: null })} className={btn}>
            <PencilLine className="h-3 w-3" /> {row.status === "qualified" ? "Edit marks" : "Enter marks"}
          </button>
        )}
        {row?.status !== "qualified" && (
          <button type="button" onClick={() => onAction({ kind: "qualify", stackKey, stackName, row })} className={btn}>
            <BadgeCheck className="h-3 w-3" /> Mark qualified
          </button>
        )}
      </div>

      {row && (row.admin_log?.length ?? 0) > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-3xs font-bold uppercase tracking-wide text-text-muted hover:text-primary">Done by hand ({row.admin_log!.length})</summary>
          <ul className="mt-2 space-y-1.5">
            {row.admin_log!.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="rounded-control bg-elevated/60 px-3 py-2">
                <span className="font-semibold text-primary">{ACTION_WORDS[entry.action] ?? entry.action}</span>
                <span className="text-text-muted">
                  {" "}
                  · {entry.by} · {fmt(entry.at)}
                </span>
                <div className="text-text-muted">“{entry.reason}”</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

const GATE_REASON: Record<string, (g: VaultAiStudentResponse["gate"]) => string> = {
  waiting_period: (g) => `Waiting period: ${g.days_remaining ?? "?"} of ${g.required_days ?? "?"} days still to go`,
  readiness: (g) => `Readiness ${g.readiness?.score ?? 0} — needs ${g.readiness?.required ?? 60}`,
  year_not_set: () => "Their college has not said which year they are in",
  year_not_offered: (g) => `${g.year_label ?? "This year"} is not offered the interview`,
};

/**
 * A student's whole Vault AI picture inside the Manage drawer, with the hand tools: the gate in front of the interview, every
 * stack they have touched (status, marks, failed attempts, what was done by hand) and, per stack, the actions that fit where they
 * stand. Each action opens its own short form over the drawer and answers with the student's picture as it now is, so what is on
 * screen is what the student will see.
 */
export function VaultAiSection({ userId, reload, triggerToast }: { userId: number; reload: () => Promise<void>; triggerToast: ToastTrigger }) {
  const [data, setData] = useState<VaultAiStudentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [action, setAction] = useState<VaultAiAction | null>(null);
  const [extraStack, setExtraStack] = useState<string>("");

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setData(await api.get<VaultAiStudentResponse>(`/superadmin/vault-ai/students/${userId}`));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Couldn't load this student's Vault AI Interview.");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const done = (result: VaultAiStudentResponse, message: string) => {
    setData(result);
    setAction(null);
    triggerToast(message);
    // The drawer's own header (readiness, Vault status) may have moved too.
    void reload();
  };

  const rows = data?.qualifications ?? [];
  const taken = new Set(rows.map((r) => r.stack_key));
  const addable = data?.stacks.filter((s) => !taken.has(s.key)) ?? [];
  const extra = data?.stacks.find((s) => s.key === extraStack) ?? null;

  const gate = data?.gate;
  const unlockable = !!gate && gate.state === "locked" && gate.reasons.every((r) => r === "waiting_period" || r === "readiness");

  return (
    <div className="space-y-4">
      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger">
          <span>{loadError}</span>
          <button type="button" onClick={() => void load()} className="font-bold hover:underline">
            Retry
          </button>
        </div>
      )}
      {!data && !loadError && <div className="h-40 animate-pulse rounded-panel bg-elevated" aria-busy="true" />}

      {data && gate && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-panel border border-border-subtle bg-elevated/50 p-3.5 sm:col-span-2">
              <div className="text-3xs font-bold uppercase tracking-wide text-text-muted">Access to the interview</div>
              <div className={cn("mt-1 text-sm font-extrabold", gate.state === "open" ? "text-status-success" : gate.state === "locked" ? "text-status-warning" : "text-text-muted")}>
                {gate.state === "open" ? "Open" : gate.state === "locked" ? "Locked" : "Not offered"}
                {gate.audience === "direct" && gate.state === "open" && <span className="ml-2 text-3xs font-semibold text-text-muted">independent student — always open</span>}
              </div>
              {gate.reasons.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-text-secondary">
                  {gate.reasons.map((r) => (
                    <li key={r}>• {GATE_REASON[r]?.(gate) ?? r}</li>
                  ))}
                </ul>
              )}
              {unlockable && (
                <button type="button" onClick={() => setAction({ kind: "unlock" })} className={cn(btn, "mt-2.5")}>
                  <LockOpen className="h-3 w-3" /> Open it now
                </button>
              )}
            </div>
            <div className="rounded-panel border border-border-subtle bg-elevated/50 p-3.5">
              <div className="text-3xs font-bold uppercase tracking-wide text-text-muted">Readiness</div>
              <div className="mt-1 font-mono text-xl font-extrabold text-primary">{data.readiness.score}</div>
              <div className="text-3xs text-text-muted">
                {data.readiness.overridden ? "set by hand" : data.readiness.tier}
                {data.vault && ` · Vault: ${data.vault.is_eligible ? "eligible" : "not eligible"}`}
              </div>
            </div>
          </div>

          {rows.length === 0 && !extra && <p className="rounded-control border border-dashed border-border-subtle p-4 text-center text-xs text-text-muted">This student has not started any Vault AI Interview yet.</p>}

          {rows.map((row) => (
            <StackCard key={row.id} stackKey={row.stack_key} stackName={row.stack_name} row={row} onAction={setAction} />
          ))}
          {extra && <StackCard stackKey={extra.key} stackName={extra.name} row={null} onAction={setAction} />}

          {addable.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
              <Plus className="h-3.5 w-3.5 text-text-muted" aria-hidden />
              <label htmlFor="vault-ai-extra-stack" className="text-xs font-semibold text-text-secondary">
                Work on another stack
              </label>
              <select id="vault-ai-extra-stack" value={extraStack} onChange={(e) => setExtraStack(e.target.value)} className={cn(SELECT, "max-w-full")}>
                <option value="">Choose a stack…</option>
                {addable.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.role} — {s.name}
                    {s.live ? "" : " (not open yet)"}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {action && data && <VaultAiActionModal studentId={userId} studentName={data.student.name} action={action} onClose={() => setAction(null)} onDone={done} />}
    </div>
  );
}
