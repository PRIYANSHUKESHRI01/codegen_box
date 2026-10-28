"use client";

import { useState } from "react";
import { AlertTriangle, CalendarRange, GraduationCap, Info, Lock, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { HP_TONES, HpButton, HpCard, HpSectionHeader } from "@/components/portal/kit";
import { HpCallout, HpFormError } from "@/components/portal/pipeline-kit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";
import { MeterBar, scoreTone } from "@/components/dashboard/tpo/cohortCells";
import { cn } from "@/lib/utils";
import { cohortVaultAiLabel } from "@/lib/vaultAi";
import { SELECTABLE_YEARS, YEAR_NOT_SET, yearName, type DepartmentBreakdown, type YearTab } from "@/lib/studyYear";
import type { CohortStudent } from "@/types/cohort";

/** "3rd year" on a roster row; an amber "Year not set" while the college has not filed one. */
export function YearChip({ student }: { student: Pick<CohortStudent, "study_year" | "year_label"> }) {
  if (student.study_year === null || student.study_year === undefined) {
    return (
      <span
        className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-px text-3xs font-bold text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300"
        title="This student has no year of study on file"
      >
        Year not set
      </span>
    );
  }

  return (
    <span className="tabular inline-flex items-center rounded-md bg-violet-500/10 px-1.5 py-px text-3xs font-bold text-violet-700 ring-1 ring-inset ring-violet-500/20 dark:text-violet-300" title="Year of study">
      {student.year_label ?? yearName(student.study_year)}
    </span>
  );
}

/** Where one student stands on the Vault AI Interview: "Unlocked", "Unlocks in 12 days", "Needs 60% readiness" … */
export function VaultAiChip({ student }: { student: Pick<CohortStudent, "vault_ai"> }) {
  const v = student.vault_ai;
  if (!v) return null;
  const open = v.state === "open";

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-md px-1.5 py-px text-3xs font-bold ring-1 ring-inset",
        open
          ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300"
          : "bg-elevated text-text-secondary ring-border-subtle"
      )}
      title="Vault AI Interview"
    >
      {open ? <ShieldCheck className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
      <span className="sr-only">Vault AI Interview: </span>
      {cohortVaultAiLabel(v)}
    </span>
  );
}

/**
 * The year switcher: a TPO picks a year and the whole page becomes that year's students. 2nd–4th year are always offered; 1st year,
 * "Year not set" and "Passed out" appear only when someone is in them.
 */
export function YearSwitcher({
  tabs,
  value,
  onChange,
  notSetCount,
}: {
  tabs: YearTab[];
  value: string;
  onChange: (value: string) => void;
  notSetCount: number;
}) {
  return (
    <HpCard spotlight={false} className="p-4 sm:p-5">
      <HpSectionHeader
        title="Year of study"
        subtitle="Pick a year to see only those students — laid out by department and branch below."
        icon={CalendarRange}
        tone="violet"
      />

      <div role="tablist" aria-label="Year of study" className="mt-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-13 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                active
                  ? "border-indigo-500/40 bg-indigo-500/[0.09] text-primary shadow-[0_8px_20px_-14px_rgba(79,70,229,0.7)]"
                  : tab.attention
                    ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-800 hover:bg-amber-500/10 dark:text-amber-200"
                    : "border-border-subtle bg-[rgb(var(--bg-surface-rgb))] text-text-secondary hover:border-border-strong hover:text-primary"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "tabular min-w-6 rounded-full px-1.5 py-px text-center text-2xs font-extrabold",
                  active ? "bg-indigo-500 text-white" : "bg-elevated text-text-muted"
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {notSetCount > 0 && value !== YEAR_NOT_SET && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5" role="status">
          <p className="flex items-start gap-2 text-2xs leading-relaxed text-text-secondary">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
            <span>
              <strong className="text-primary">
                {notSetCount} student{notSetCount === 1 ? " has" : "s have"} no year on file.
              </strong>{" "}
              Until you set one they stay locked out of the Vault AI Interview.
            </span>
          </p>
          <button type="button" onClick={() => onChange(YEAR_NOT_SET)} className="text-2xs font-bold text-accent-primary hover:underline">
            Show them →
          </button>
        </div>
      )}
    </HpCard>
  );
}

/**
 * The selected year's students, department by department and branch by branch. A branch row focuses the roster on that branch;
 * click it again to let go.
 */
export function YearBreakdown({
  groups,
  yearLabel,
  total,
  activeBranch,
  onPickBranch,
}: {
  groups: DepartmentBreakdown[];
  yearLabel: string;
  total: number;
  activeBranch: string;
  onPickBranch: (filter: string | null) => void;
}) {
  if (groups.length === 0) {
    return (
      <HpCard spotlight={false} className="p-5 text-center">
        <GraduationCap className="mx-auto h-6 w-6 text-text-muted" aria-hidden />
        <p className="mt-2 text-sm font-bold text-primary">No students in {yearLabel} yet</p>
        <p className="mx-auto mt-1 max-w-md text-2xs leading-relaxed text-text-muted">
          Add a student and choose their year, or import a roster for this year — it appears here, grouped by department and branch.
        </p>
      </HpCard>
    );
  }

  return (
    <HpCard spotlight={false} className="p-4 sm:p-5">
      <HpSectionHeader
        title={`${yearLabel} · by department and branch`}
        subtitle={`${total} ${total === 1 ? "student" : "students"} — select a branch to focus the roster on it`}
        icon={GraduationCap}
        tone="sky"
      />

      <div className="mt-4 space-y-5">
        {groups.map((group) => (
          <section key={group.department} aria-label={group.name}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle pb-2">
              <h3 className="text-13 font-extrabold tracking-tight text-primary">{group.name}</h3>
              <p className="tabular text-2xs font-semibold text-text-muted">
                {group.count} {group.count === 1 ? "student" : "students"} · avg readiness {group.avgReadiness}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-2.5">
              {group.branches.map((branch) => {
                const active = branch.filter !== null && activeBranch === branch.filter;
                const body = (
                  <>
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-13 font-bold text-primary" title={branch.label}>
                        {branch.label}
                      </span>
                      <span className="tabular shrink-0 text-sm font-extrabold text-primary">{branch.count}</span>
                    </span>
                    <span className="block">
                      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
                        <span>Avg readiness</span>
                        <span className={cn("tabular text-xs normal-case tracking-normal", HP_TONES[scoreTone(branch.avgReadiness)].text)}>~{branch.avgReadiness}</span>
                      </span>
                      <MeterBar value={branch.avgReadiness} tone={scoreTone(branch.avgReadiness)} />
                    </span>
                    <span className="tabular flex items-center gap-1 text-2xs text-text-muted">
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      {branch.vaultAiOpen} of {branch.count} Vault AI unlocked
                    </span>
                  </>
                );

                const base = "flex min-w-0 flex-col gap-3 rounded-2xl border p-3.5 text-left";

                return branch.filter === null ? (
                  <div key={branch.key} className={cn(base, "border-dashed border-border-strong bg-elevated/30")}>
                    {body}
                  </div>
                ) : (
                  <button
                    key={branch.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onPickBranch(active ? null : branch.filter)}
                    className={cn(
                      base,
                      "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      active
                        ? "border-indigo-500/40 bg-indigo-500/[0.07] shadow-[0_8px_20px_-12px_rgba(79,70,229,0.7)]"
                        : "border-border-subtle bg-[rgb(var(--bg-surface-rgb))] hover:-translate-y-0.5 hover:border-border-strong hover:bg-elevated/50"
                    )}
                  >
                    {body}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </HpCard>
  );
}

/** Files the selected students under a year - fixes a roster imported before years existed, or corrects a wrong one. */
export function SetYearModal({
  count,
  onClose,
  onConfirm,
}: {
  count: number;
  onClose: () => void;
  onConfirm: (year: number) => Promise<void>;
}) {
  const [year, setYear] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (year === null) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(year);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set the year. Please try again.");
      setSaving(false);
    }
  };

  return (
    <HpOverlayPortal>
      <Modal
        onClose={() => !saving && onClose()}
        title="Set year of study"
        subtitle={`${count} ${count === 1 ? "student" : "students"} selected`}
        icon={CalendarRange}
        size="md"
        variant="premium"
        footer={
          <>
            <HpButton type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </HpButton>
            <HpButton type="button" onClick={submit} disabled={year === null || saving} isLoading={saving}>
              {year === null ? "Choose a year" : `Move to ${yearName(year)}`}
            </HpButton>
          </>
        }
      >
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-text-secondary">Which year are they in now?</legend>
            <div className="grid grid-cols-2 gap-2">
              {SELECTABLE_YEARS.map((y) => (
                <label
                  key={y}
                  className={cn(
                    "flex cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-13 font-semibold transition-colors focus-within:ring-2 focus-within:ring-indigo-500",
                    year === y ? "border-indigo-500/50 bg-indigo-500/[0.09] text-primary" : "border-border-subtle text-text-secondary hover:border-border-strong"
                  )}
                >
                  <input type="radio" name="study-year" className="sr-only" checked={year === y} onChange={() => setYear(y)} />
                  {yearName(y)}
                </label>
              ))}
            </div>
          </fieldset>

          {error && <HpFormError>{error}</HpFormError>}

          <HpCallout icon={Info} tone="indigo">
            A student&apos;s year moves up by itself each July — set it once. The Vault AI Interview&apos;s waiting period (45 days for 4th year,
            90 for 3rd) and who it is offered to follow from it.
          </HpCallout>
        </div>
      </Modal>
    </HpOverlayPortal>
  );
}
