"use client";

import { useMemo, useState } from "react";
import { Loader2, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import type { AdminPlan, PlanLimits } from "@/types/pricing";

type NumericKey = "max_practice_problems_per_day" | "max_mock_interviews_per_day" | "max_learning_centre_ai_attempts_per_day" | "feature_trial_uses" | "max_workspace_hours_per_month" | "max_active_projects" | "max_core_practice_per_day";
type SwitchKey = "drive_access" | "hackathon_access" | "vault_access" | "project_lab_access" | "core_tests_access";

/** Ranges mirror SuperAdminPlanController::updateEntitlements() — the server checks them again. */
const NUMERIC: { key: NumericKey; label: string; hint: string; min: number; max: number; unlimitedLabel: string }[] = [
  { key: "max_practice_problems_per_day", label: "Coding problems per day", hint: "Distinct practice problems a student may submit in a day.", min: 1, max: 1000, unlimitedLabel: "Unlimited" },
  { key: "max_mock_interviews_per_day", label: "AI mock interviews per day", hint: "Practice interviews started in a day.", min: 0, max: 100, unlimitedLabel: "Unlimited" },
  { key: "max_learning_centre_ai_attempts_per_day", label: "Learning Centre AI uses per day", hint: "Speaking, listening and vocabulary AI features, per day.", min: 0, max: 500, unlimitedLabel: "Unlimited" },
  { key: "max_core_practice_per_day", label: "Core Prep questions per day", hint: "Branch technical practice (ECE, EEE, Mechanical, Civil) — distinct questions a student may answer in a day.", min: 1, max: 1000, unlimitedLabel: "Unlimited" },
  {
    key: "feature_trial_uses",
    label: "Free tries of each AI feature (ever)",
    hint: "The free plan's one-time taste of each AI feature. Paid plans leave this off and use the daily limits above.",
    min: 0,
    max: 20,
    unlimitedLabel: "No cap (daily limits apply)",
  },
];

const LAB_NUMERIC: { key: NumericKey; label: string; hint: string; min: number; max: number; unlimitedLabel: string }[] = [
  { key: "max_workspace_hours_per_month", label: "Project Lab hours per month", hint: "Hours of running workspace in a calendar month.", min: 0, max: 744, unlimitedLabel: "Unlimited" },
  { key: "max_active_projects", label: "Active Project Lab projects", hint: "Projects a student may have in progress at once.", min: 0, max: 50, unlimitedLabel: "Unlimited" },
];

const SWITCHES: { key: SwitchKey; label: string; hint: string }[] = [
  { key: "drive_access", label: "Placement drives", hint: "Apply to campus and company drives." },
  { key: "hackathon_access", label: "Hack Arena", hint: "Register for and submit to hackathons. Browsing stays open to everyone." },
  { key: "vault_access", label: "The Vault", hint: "Be listed to employers on Mellow Vault and hired directly. Earning the readiness score stays open to everyone." },
  { key: "project_lab_access", label: "Project Lab", hint: "Build guided projects in a cloud workspace." },
  { key: "core_tests_access", label: "Core Prep tests", hint: "Timed, proctored technical tests for non-CS branches. When off, the free plan gets its one-time trial instead." },
];

interface Draft {
  numbers: Record<NumericKey, { unlimited: boolean; value: string }>;
  switches: Record<SwitchKey, boolean>;
}

function toDraft(limits: PlanLimits): Draft {
  const numbers = {} as Draft["numbers"];
  for (const { key } of [...NUMERIC, ...LAB_NUMERIC]) {
    const value = limits[key] ?? null;
    numbers[key] = { unlimited: value === null, value: value === null ? "" : String(value) };
  }

  return {
    numbers,
    switches: {
      drive_access: limits.drive_access,
      hackathon_access: limits.hackathon_access,
      vault_access: limits.vault_access,
      project_lab_access: limits.project_lab_access,
      core_tests_access: limits.core_tests_access ?? false,
    },
  };
}

/** The limits a draft would save, or why it can't be saved yet. */
function evaluate(draft: Draft): { limits: PlanLimits | null; errors: Partial<Record<NumericKey, string>> } {
  const errors: Partial<Record<NumericKey, string>> = {};
  const out: Record<string, number | boolean | null> = { ...draft.switches };

  const labKeys = LAB_NUMERIC.map((spec) => spec.key);

  for (const spec of [...NUMERIC, ...LAB_NUMERIC]) {
    const entry = draft.numbers[spec.key];
    const hidden = labKeys.includes(spec.key) && !draft.switches.project_lab_access;

    if (entry.unlimited) {
      out[spec.key] = null;
      continue;
    }

    const text = entry.value.trim();
    if (!/^\d{1,4}$/.test(text)) {
      // Its fields are not even on screen while Project Lab is off: an unusable value there must not block a save.
      if (hidden) out[spec.key] = null;
      else errors[spec.key] = "Enter a whole number.";
      continue;
    }

    const n = Number(text);
    if (n < spec.min || n > spec.max) errors[spec.key] = `Between ${spec.min} and ${spec.max}.`;
    else out[spec.key] = n;
  }

  return { limits: Object.keys(errors).length === 0 ? (out as unknown as PlanLimits) : null, errors };
}

interface PlanLimitsModalProps {
  plan: AdminPlan;
  onClose: () => void;
  onSaved: (plan: AdminPlan) => void;
}

/**
 * Edit what a plan INCLUDES: the daily limits, the free plan's one-time tries and
 * the switches for the Hack Arena, the Vault, placement drives and Project Lab.
 * These are the very columns the server enforces, so a change reaches everyone
 * already on the plan on their next request, and the public pricing page's numbers
 * and comparison table (generated from them) follow within one poll.
 *
 * The whole set is always sent (an omitted field would otherwise read as
 * "unlimited"), together with the version the editor started from, so a change
 * another superadmin saved meanwhile is refused instead of overwritten.
 */
export function PlanLimitsModal({ plan, onClose, onSaved }: PlanLimitsModalProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(plan.limits));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { limits, errors } = useMemo(() => evaluate(draft), [draft]);
  const changed = useMemo(() => limits !== null && (Object.keys(limits) as (keyof PlanLimits)[]).some((key) => limits[key] !== (plan.limits[key] ?? (typeof limits[key] === "boolean" ? false : null))), [limits, plan.limits]);

  // Things worth a second look before saving — not blocked, just named.
  const cautions = useMemo(() => {
    if (!limits) return [];
    const list: string[] = [];
    if (plan.is_free) {
      if (limits.max_practice_problems_per_day === null) list.push("The free plan would have unlimited practice problems — nobody would need to upgrade for them.");
      if (limits.feature_trial_uses === null) list.push("The free plan would have no cap on AI features — they would be free for everyone, forever.");
      if (limits.hackathon_access || limits.vault_access || limits.project_lab_access) list.push("Paid-only features would be open to every free student.");
    }
    if (limits.project_lab_access && limits.max_workspace_hours_per_month === null) list.push("Project Lab with unlimited hours runs real servers — that is a real cost per student.");
    return list;
  }, [limits, plan.is_free]);

  const setNumber = (key: NumericKey, patch: Partial<{ unlimited: boolean; value: string }>) =>
    setDraft((d) => ({ ...d, numbers: { ...d.numbers, [key]: { ...d.numbers[key], ...patch } } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limits || !changed || working) return;

    setWorking(true);
    setError(null);
    try {
      const res = await api.put<{ plan: AdminPlan }>(`/superadmin/plans/${plan.code}/entitlements`, { ...limits, version: plan.limits_version });
      onSaved(res.plan);
    } catch (err) {
      setError(err instanceof ApiError ? err.errors?.version?.[0] ?? Object.values(err.errors ?? {})[0]?.[0] ?? err.message : "Couldn't save. Check your connection and try again.");
      setWorking(false);
    }
  };

  const renderNumber = (spec: (typeof NUMERIC)[number]) => {
    const entry = draft.numbers[spec.key];
    const id = `limit-${spec.key}`;
    return (
      <div key={spec.key} className="rounded-control border border-border-subtle bg-elevated/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={id} className="text-xs font-bold text-primary">
            {spec.label}
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-2xs font-semibold text-text-secondary">
            <input
              type="checkbox"
              checked={entry.unlimited}
              onChange={(e) => setNumber(spec.key, { unlimited: e.target.checked })}
              aria-label={`${spec.label}: ${spec.unlimitedLabel.toLowerCase()}`}
              className="h-3.5 w-3.5 rounded border-border-subtle"
            />
            {spec.unlimitedLabel}
          </label>
        </div>
        <p className="mt-0.5 text-3xs text-text-muted">{spec.hint}</p>
        <input
          id={id}
          inputMode="numeric"
          value={entry.value}
          disabled={entry.unlimited}
          onChange={(e) => setNumber(spec.key, { value: e.target.value })}
          aria-invalid={!!errors[spec.key]}
          className={cn(
            "mt-2 w-28 rounded-control border bg-surface px-3 py-1.5 font-mono text-sm text-primary outline-none focus:border-accent-primary disabled:opacity-40",
            errors[spec.key] ? "border-status-danger" : "border-border-subtle"
          )}
        />
        {errors[spec.key] && (
          <p role="alert" className="mt-1 text-3xs font-semibold text-status-danger">
            {errors[spec.key]}
          </p>
        )}
      </div>
    );
  };

  return (
    <Modal
      onClose={() => !working && onClose()}
      title={`What ${plan.name} includes`}
      subtitle={`${plan.active_subscribers} student${plan.active_subscribers === 1 ? " is" : "s are"} on this plan now`}
      icon={SlidersHorizontal}
      size="xl"
      closeOnBackdrop={false}
      showCloseButton={!working}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={working} className="rounded-control border border-border-subtle px-4 py-2 text-text-muted transition-colors hover:text-primary disabled:opacity-50">
            Cancel
          </button>
          <button
            type="submit"
            form="plan-limits-form"
            disabled={!limits || !changed || working}
            className="inline-flex items-center gap-2 rounded-control bg-accent-primary px-4 py-2 font-semibold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save &amp; apply now
          </button>
        </>
      }
    >
      <form id="plan-limits-form" onSubmit={submit} className="space-y-5">
        <p className="text-xs leading-relaxed text-text-secondary">
          These are the limits the server enforces. A change applies to <strong className="text-primary">everyone already on {plan.name}</strong> on their next request, and the pricing page&apos;s numbers and comparison
          table follow within seconds. The hand-written feature bullets on the plan cards are not generated from these.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">{NUMERIC.map(renderNumber)}</div>

        <fieldset>
          <legend className="mb-2 text-2xs font-bold uppercase tracking-wide text-text-muted">Access</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {SWITCHES.map((sw) => (
              <label
                key={sw.key}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-control border p-3 text-xs transition-colors",
                  draft.switches[sw.key] ? "border-accent-primary/30 bg-accent-primary/5" : "border-border-subtle bg-elevated/50 hover:border-border-strong"
                )}
              >
                <input
                  type="checkbox"
                  checked={draft.switches[sw.key]}
                  onChange={(e) => setDraft((d) => ({ ...d, switches: { ...d.switches, [sw.key]: e.target.checked } }))}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-border-subtle"
                />
                <span>
                  <span className="block font-bold text-primary">{sw.label}</span>
                  <span className="block text-2xs text-text-muted">{sw.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {draft.switches.project_lab_access && (
          <div className="grid gap-3 sm:grid-cols-2">{LAB_NUMERIC.map(renderNumber)}</div>
        )}

        {cautions.length > 0 && (
          <div role="status" className="space-y-1.5 rounded-control border border-status-warning/30 bg-status-warning/10 p-3 text-xs text-text-secondary">
            {cautions.map((c) => (
              <p key={c} className="flex items-start gap-2">
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden />
                {c}
              </p>
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-control border border-status-danger/30 bg-status-danger/10 p-3 text-xs font-semibold text-status-danger">
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
