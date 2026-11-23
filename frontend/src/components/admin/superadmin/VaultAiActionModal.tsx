"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, Loader2, LockOpen, PencilLine, RotateCcw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import type { VaultAiAttempt, VaultAiQualificationRow, VaultAiStudentResponse } from "@/types/superadminVaultAi";

const field = "w-full rounded-control border border-border-subtle bg-elevated px-3 py-2 text-xs text-primary outline-none focus:border-accent-primary";
const PASS_MARK = 60;

export type VaultAiAction =
  | { kind: "reset"; stackKey: string; stackName: string; row: VaultAiQualificationRow }
  | { kind: "scores"; stackKey: string; stackName: string; row: VaultAiQualificationRow; attempt: VaultAiAttempt | null }
  | { kind: "qualify"; stackKey: string; stackName: string; row: VaultAiQualificationRow | null }
  | { kind: "unlock" }
  | { kind: "reinstate_proctoring" };

interface Props {
  studentId: number;
  studentName: string;
  action: VaultAiAction;
  onClose: () => void;
  onDone: (result: VaultAiStudentResponse, message: string) => void;
}

const average = (marks: (number | null)[]) => (marks.every((m) => m !== null) ? Math.round(((marks as number[]).reduce((a, b) => a + b, 0) / 3) * 100) / 100 : null);

/**
 * The four hand tools on a student's Vault AI Interview, each one a short form that ends in a reason (kept in the audit log):
 *
 *  - reset    give the three attempts back (ends a 45-day block); on a qualified student, takes the qualification back
 *  - scores   enter or correct the marks of the series being sat, or of one past attempt - and says what the new marks will DO
 *  - qualify  qualify the student outright, at a chosen average
 *  - unlock   open the interview for a student still waiting at the gate
 */
export function VaultAiActionModal({ studentId, studentName, action, onClose, onDone }: Props) {
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState<"full_reset" | "retry_attempt">("full_reset");
  const [targetAttempt, setTargetAttempt] = useState<number>(() => (action.kind === "reset" ? Math.max(1, Math.min(3, action.row.current_attempt || 3)) : 3));

  // Marks start from what is on record: the attempt being corrected, or the series being sat.
  const initialMarks = useMemo(() => {
    if (action.kind !== "scores") return ["", "", ""];
    const source = action.attempt ? action.attempt.scores : action.row.series_scores;
    return ["1", "2", "3"].map((set) => (source[set] !== undefined ? String(source[set]) : ""));
  }, [action]);
  const [marks, setMarks] = useState<string[]>(initialMarks);
  const [qualifyAt, setQualifyAt] = useState(() => (action.kind === "qualify" ? String(Math.max(PASS_MARK, Math.round(action.row?.series_average ?? PASS_MARK))) : String(PASS_MARK)));

  const parsed = marks.map((m) => (m.trim() === "" ? null : /^\d{1,3}$/.test(m.trim()) ? Number(m.trim()) : NaN));
  const marksValid = action.kind === "scores" && parsed.every((m) => m === null || (!Number.isNaN(m) && m >= 0 && m <= 100)) && parsed.some((m) => m !== null) && (action.attempt === null || parsed.every((m) => m !== null));
  const live = parsed.map((m, i) => (m !== null && !Number.isNaN(m) ? m : action.kind === "scores" && action.attempt === null ? Number(action.row.series_scores[String(i + 1)] ?? NaN) : NaN));
  const resultingAverage = action.kind === "scores" ? average(live.map((m) => (Number.isNaN(m) ? null : m))) : null;

  const qualifyNumber = /^\d{1,3}(\.\d{1,2})?$/.test(qualifyAt.trim()) ? Number(qualifyAt.trim()) : null;
  const qualifyValid = qualifyNumber !== null && qualifyNumber >= PASS_MARK && qualifyNumber <= 100;

  const reasonOk = reason.trim().length >= 3;
  const valid = reasonOk && (action.kind === "scores" ? marksValid : action.kind === "qualify" ? qualifyValid : true) && !(action.kind === "scores" && action.row.status === "qualified" && resultingAverage !== null && resultingAverage < PASS_MARK);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || working) return;
    setWorking(true);
    setError(null);

    const base = `/superadmin/vault-ai/students/${studentId}`;

    try {
      if (action.kind === "reset") {
        const body: { reason: string; mode?: string; attempt?: number } = { reason: reason.trim() };
        if (resetMode === "retry_attempt") {
          body.mode = "retry_attempt";
          body.attempt = targetAttempt;
        }
        const res = await api.post<VaultAiStudentResponse>(`${base}/stacks/${action.stackKey}/reset`, body);
        const msg =
          action.row.status === "qualified"
            ? `${studentName}'s ${action.stackName} qualification has been taken back.`
            : resetMode === "retry_attempt"
            ? `${studentName} has been granted access to re-attempt Series ${targetAttempt} in ${action.stackName}.`
            : `${studentName} has all 3 ${action.stackName} attempts again.`;
        onDone(res, msg);
      } else if (action.kind === "scores") {
        const scores: Record<string, number> = {};
        parsed.forEach((m, i) => {
          if (m !== null && !Number.isNaN(m)) scores[String(i + 1)] = m;
        });
        const res = await api.put<VaultAiStudentResponse>(`${base}/stacks/${action.stackKey}/scores`, {
          scores,
          reason: reason.trim(),
          ...(action.attempt ? { attempt_index: action.attempt.index } : {}),
        });
        onDone(res, `${studentName}'s ${action.stackName} marks are updated.`);
      } else if (action.kind === "qualify") {
        const res = await api.post<VaultAiStudentResponse>(`${base}/stacks/${action.stackKey}/qualify`, { average: qualifyNumber, reason: reason.trim() });
        onDone(res, `${studentName} is now qualified in ${action.stackName} at ${qualifyNumber}%.`);
      } else if (action.kind === "reinstate_proctoring") {
        const res = await api.post<VaultAiStudentResponse>(`${base}/reinstate-proctoring`, { reason: reason.trim() });
        onDone(res, `Proctoring session reinstated and full access re-granted for ${studentName}.`);
      } else {
        const res = await api.post<VaultAiStudentResponse>(`${base}/unlock-access`, { reason: reason.trim() });
        onDone(res, `The Vault AI Interview is open for ${studentName}.`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.reason?.[0] ?? err.errors?.average?.[0] ?? err.errors?.scores?.[0] ?? err.message : "Something went wrong. Check your connection and try again.");
      setWorking(false);
    }
  };

  // What these marks will do, in the words of the live rules (60% average; 3 series; then 45 days).
  const consequence = (() => {
    if (action.kind !== "scores" || resultingAverage === null) return null;
    const pass = resultingAverage >= PASS_MARK;
    const avg = `${resultingAverage}%`;
    if (action.row.status === "qualified") {
      return pass ? { tone: "ok" as const, text: `Average ${avg}. They stay qualified, with this as their score.` } : { tone: "bad" as const, text: `Average ${avg} is under ${PASS_MARK}%. To take the qualification back use “Take qualification back” instead.` };
    }
    if (action.attempt) {
      return pass
        ? { tone: "ok" as const, text: `Average ${avg}. This attempt now passes: the student is qualified, any block ends, and they are added to the Vault.` }
        : { tone: "info" as const, text: `Average ${avg} is still under ${PASS_MARK}%. The record is corrected; nothing else changes.` };
    }
    if (pass) return { tone: "ok" as const, text: `Average ${avg}. The student qualifies and is added to the Vault.` };
    return action.row.current_attempt < action.row.max_attempts
      ? { tone: "info" as const, text: `Average ${avg} is under ${PASS_MARK}%. This series counts as failed and the student moves on to Series ${action.row.current_attempt + 1}.` }
      : { tone: "bad" as const, text: `Average ${avg} is under ${PASS_MARK}% on the last series: the student is blocked for 45 days.` };
  })();

  const meta = {
    reset: {
      title: action.kind === "reset" && action.row.status === "qualified" ? "Take qualification back" : "Give 3 fresh attempts",
      icon: RotateCcw,
      cta: action.kind === "reset" && action.row.status === "qualified" ? "Take it back" : "Give attempts",
    },
    scores: { title: action.kind === "scores" && action.attempt ? `Correct attempt ${action.attempt.attempt}` : "Enter marks", icon: PencilLine, cta: "Save marks" },
    qualify: { title: "Mark qualified", icon: BadgeCheck, cta: "Mark qualified" },
    unlock: { title: "Open the interview now", icon: LockOpen, cta: "Open it" },
    reinstate_proctoring: { title: "Reinstate Proctoring & Re-grant Access", icon: ShieldCheck, cta: "Reinstate Access" },
  }[action.kind];

  const subtitle = action.kind === "unlock" || action.kind === "reinstate_proctoring" ? studentName : `${studentName} · ${action.stackName}`;
  const destructive = action.kind === "reset" && action.row.status === "qualified";

  return (
    <Modal
      onClose={() => !working && onClose()}
      title={meta.title}
      subtitle={subtitle}
      icon={meta.icon}
      iconClassName={destructive ? "bg-status-danger/10 text-status-danger" : undefined}
      size="lg"
      closeOnBackdrop={false}
      showCloseButton={!working}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            form="vault-ai-action-form"
            disabled={!valid || working}
            className={cn(
              "inline-flex items-center gap-2 rounded-control px-4 py-2 font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              destructive ? "bg-status-danger hover:opacity-90" : "bg-accent-primary hover:bg-accent-primary-hover"
            )}
          >
            {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {meta.cta}
          </button>
        </>
      }
    >
      <form id="vault-ai-action-form" onSubmit={submit} className="space-y-4">
        {action.kind === "reset" && (
          <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
            {action.row.status === "qualified" ? (
              <p>
                <strong className="text-primary">{studentName}</strong> stops being qualified in {action.stackName}. They go back to Series 1 with all 3 attempts, and the Vault follows: unless they are qualified in another stack or their
                readiness score earns the place, they leave it and Mellow Vault is told to withdraw them.
              </p>
            ) : (
              <>
                <p className="text-text-muted">
                  Choose how to restore access for <strong className="text-primary">{studentName}</strong> in {action.stackName}: unblock or re-open a specific series (such as Attempt {targetAttempt}) or perform a full reset back to Series 1.
                </p>
                <div className="space-y-2">
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors",
                      resetMode === "full_reset" ? "border-accent-primary bg-accent-primary/5" : "border-border-subtle bg-elevated/40 hover:bg-elevated/70"
                    )}
                  >
                    <input
                      type="radio"
                      name="reset-mode"
                      value="full_reset"
                      checked={resetMode === "full_reset"}
                      onChange={() => setResetMode("full_reset")}
                      className="mt-0.5 accent-accent-primary"
                    />
                    <div>
                      <div className="font-semibold text-primary">Full Reset — 3 fresh attempts from Series 1</div>
                      <div className="text-2xs text-text-muted">
                        Resets the student back to Series 1 with all 3 fresh attempts. Marks in the active series are cleared.
                      </div>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors",
                      resetMode === "retry_attempt" ? "border-accent-primary bg-accent-primary/5" : "border-border-subtle bg-elevated/40 hover:bg-elevated/70"
                    )}
                  >
                    <input
                      type="radio"
                      name="reset-mode"
                      value="retry_attempt"
                      checked={resetMode === "retry_attempt"}
                      onChange={() => setResetMode("retry_attempt")}
                      className="mt-0.5 accent-accent-primary"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-primary">Re-open Series (Keep earlier attempt history)</span>
                        {resetMode === "retry_attempt" && (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">Series:</span>
                            <select
                              value={targetAttempt}
                              onChange={(e) => setTargetAttempt(Number(e.target.value))}
                              className="rounded border border-border-subtle bg-surface px-2 py-0.5 text-xs font-bold text-primary"
                            >
                              <option value={3}>Series 3 (Attempt 3)</option>
                              <option value={2}>Series 2 (Attempt 2)</option>
                              <option value={1}>Series 1 (Attempt 1)</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="text-2xs text-text-muted">
                        Immediately clears any block/cooldown and re-opens Series {targetAttempt}. Prior attempts remain intact in history.
                      </div>
                    </div>
                  </label>
                </div>
              </>
            )}
            <p className="text-text-muted">The student is notified automatically of the restored access.</p>
          </div>
        )}

        {action.kind === "scores" && (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-text-secondary">
              {action.attempt
                ? `Correct the marks of attempt ${action.attempt.attempt} (Series ${action.attempt.series_number}, ${new Date(action.attempt.evaluated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}). All three sets are needed.`
                : `Marks of Series ${action.row.current_attempt}, as percentages. Fill only the sets you want to set — the series is decided once all three have a mark.`}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <label htmlFor={`vault-mark-${i}`} className="mb-1 block text-xs font-semibold text-text-secondary">
                    Set {i + 1} %
                  </label>
                  <input
                    id={`vault-mark-${i}`}
                    inputMode="numeric"
                    value={marks[i]}
                    onChange={(e) => setMarks((m) => m.map((v, j) => (j === i ? e.target.value : v)))}
                    aria-invalid={Number.isNaN(parsed[i])}
                    className={cn(field, "text-center font-mono text-sm font-bold", Number.isNaN(parsed[i]) && "border-status-danger")}
                  />
                </div>
              ))}
            </div>
            {consequence && (
              <p
                data-testid="marks-consequence"
                className={cn(
                  "rounded-control border p-2.5 text-xs leading-relaxed",
                  consequence.tone === "ok" && "border-status-success/30 bg-status-success/10 text-text-secondary",
                  consequence.tone === "bad" && "border-status-danger/30 bg-status-danger/10 text-status-danger",
                  consequence.tone === "info" && "border-border-subtle bg-elevated/60 text-text-secondary"
                )}
              >
                {consequence.text}
              </p>
            )}
          </div>
        )}

        {action.kind === "qualify" && (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-text-secondary">
              <strong className="text-primary">{studentName}</strong> is qualified in {action.stackName} without sitting the series: any block ends and they are added to the Vault (their consent and plan still decide whether hiring partners see them). It is recorded as set by
              you, and the student is told.
            </p>
            <label htmlFor="vault-qualify-average" className="mb-1 block text-xs font-semibold text-text-secondary">
              Series average to record (%)
            </label>
            <input
              id="vault-qualify-average"
              inputMode="decimal"
              value={qualifyAt}
              onChange={(e) => setQualifyAt(e.target.value)}
              aria-invalid={!qualifyValid}
              className={cn(field, "w-28 text-center font-mono text-sm font-bold", !qualifyValid && "border-status-danger")}
            />
            <p className={cn("text-2xs", qualifyValid ? "text-text-muted" : "text-status-danger")}>{PASS_MARK} to 100 — the pass mark is {PASS_MARK}%.</p>
          </div>
        )}

        {action.kind === "unlock" && (
          <p className="text-xs leading-relaxed text-text-secondary">
            <strong className="text-primary">{studentName}</strong> is still inside the waiting period or below the readiness line. This opens the Vault AI Interview for them now, and it stays open — it is recorded exactly as if they had earned the unlock. They are
            told by notification.
          </p>
        )}

        {action.kind === "reinstate_proctoring" && (
          <div className="rounded-2xl border border-accent-primary/20 bg-accent-primary/5 p-4 text-xs space-y-2">
            <p className="font-bold text-primary">Unblock Candidate & Reset Proctoring</p>
            <p className="text-text-secondary leading-relaxed">
              This will immediately unlock any terminated proctoring sessions, reset strike counts to zero, unblock the candidate account, and clear any cooling down restriction.
            </p>
            <p className="text-3xs text-text-muted">
              An audit record will be logged with your reason, and the candidate will receive an immediate in-app notification confirming their access has been restored.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="vault-ai-reason" className="mb-1 block text-xs font-semibold text-text-secondary">
            Reason <span className="font-normal text-text-muted">(kept in the audit log)</span>
          </label>
          <textarea id="vault-ai-reason" rows={2} maxLength={300} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. AI scoring was down during their attempt" className={cn(field, "resize-none")} />
        </div>

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
