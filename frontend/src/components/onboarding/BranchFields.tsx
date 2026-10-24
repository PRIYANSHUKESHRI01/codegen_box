"use client";

import { useState } from "react";
import { Check, Info, Lock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { accentStyle, branchName, DEFAULT_DEPARTMENT, departmentsFor, disciplineStyle, isCoreDiscipline, useBranchCatalog, type DisciplineCode } from "@/lib/branches";
import { DepartmentIcon } from "@/components/branches/DepartmentIcon";
import { CORE_INTERESTS, TRACK_FOCUS, type TrackFocus } from "@/lib/studentPreferences";
import type { AuthUser } from "@/lib/auth";
import { RadioCards } from "./PreferenceFields";

/** What the branch questions collect — held by whichever form hosts these fields (wizard, confirm dialog, Settings). */
export interface BranchAnswers {
  /** A branch the student picked (only set when the college hasn't told us). */
  branchCode: string | null;
  trackFocus: TrackFocus | null;
  interests: string[];
}

export function initialBranchAnswers(user: AuthUser | null): BranchAnswers {
  return { branchCode: null, trackFocus: user?.track_focus ?? null, interests: user?.core_interests ?? [] };
}

/** True when the college has told us the branch and we recognised it — the student confirms it, doesn't choose it. */
export function branchIsFromCollege(user: AuthUser | null): boolean {
  return user?.branch_source === "college" && !!user.branch_code;
}

/**
 * Whether these answers are enough to continue: a branch (given or picked), and — only once Core Prep is
 * live for that family — what they want to lead with.
 */
export function branchAnswersComplete(user: AuthUser | null, answers: BranchAnswers, trackAsked: boolean): boolean {
  const hasBranch = !!(answers.branchCode ?? user?.branch_code);
  return hasBranch && (!trackAsked || !!answers.trackFocus);
}

interface Props {
  user: AuthUser | null;
  value: BranchAnswers;
  onChange: (next: BranchAnswers) => void;
  /** Called after the student flags the college's branch as wrong (the parent refreshes the user). */
  onDisputed?: (user: AuthUser) => void;
}

/**
 * "Which branch are you in, and what do you want to lead with?" — shared by the first-login wizard, the
 * one-question confirm dialog for existing students, and Settings → Branch & Track.
 *
 * A student picks their DEPARTMENT first when more than one is possible (an independent student: all of them; a college's student:
 * the ones their college runs, or just the one their roster was imported under), and then only sees that department's programmes.
 *
 * A branch the COLLEGE gave us and we recognise is shown read-only (a student cannot change what their
 * TPO imported — "Not right?" tells the TPO instead). Otherwise the student picks their family, then the
 * branch. The weighting (Core first / Core + IT / IT roles first) and interests appear only for non-CS
 * families whose Core Prep is live — before that there is nothing for them to choose between.
 */
export function BranchFields({ user, value, onChange, onDisputed }: Props) {
  const catalog = useBranchCatalog();
  const [family, setFamily] = useState<DisciplineCode | null>(null);
  const [pickedDepartment, setPickedDepartment] = useState<string | null>(null);
  const [disputing, setDisputing] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);

  if (!catalog) return <div className="h-32 animate-pulse rounded-xl bg-elevated" aria-busy="true" aria-label="Loading branches" />;

  const fromCollege = branchIsFromCollege(user);

  // Which departments this student can choose between: their college's (or all of them without a college); and when their roster
  // was imported under a department the question is already answered.
  const collegeDepartments = user?.college ? (user.college.departments ?? [DEFAULT_DEPARTMENT]) : null;
  const fixedDepartment = user?.college && user.department ? user.department : null;
  const departmentChoices = fixedDepartment ? departmentsFor(catalog, [fixedDepartment]) : departmentsFor(catalog, collegeDepartments);
  const currentCode = value.branchCode ?? user?.branch_code ?? null;
  const currentDiscipline = (catalog.branches.find((b) => b.code === currentCode)?.discipline ?? user?.discipline ?? null) as DisciplineCode | null;
  const shownFamily = family ?? (value.branchCode ? currentDiscipline : null);
  const departmentOfCurrent = catalog.disciplines.find((d) => d.code === currentDiscipline)?.department ?? null;
  // A catalogue from before departments existed (or one that failed to carry them) is engineering only: its families are shown, not hidden behind a choice that cannot be made.
  const onlyEngineering = (catalog.departments?.length ?? 0) === 0;
  const selectedDepartment = pickedDepartment ?? fixedDepartment ?? departmentOfCurrent ?? (departmentChoices.length === 1 ? departmentChoices[0].code : onlyEngineering ? DEFAULT_DEPARTMENT : null);
  const familiesToShow = catalog.disciplines.filter((d) => selectedDepartment === null ? false : (d.department ?? DEFAULT_DEPARTMENT) === selectedDepartment);
  const familyMeta = catalog.disciplines.find((d) => d.code === currentDiscipline);
  const asksTrack = isCoreDiscipline(currentDiscipline) && (!!familyMeta?.is_live || (!!user?.core_enabled && currentDiscipline === user.discipline));
  const interests = currentDiscipline ? CORE_INTERESTS[currentDiscipline] ?? [] : [];

  const dispute = async () => {
    setDisputing(true);
    setDisputeError(null);
    try {
      const res = await api.post<{ user: AuthUser }>("/me/branch/dispute");
      onDisputed?.(res.user);
    } catch (err) {
      setDisputeError(err instanceof ApiError ? err.message : "Couldn't tell your TPO. Please try again.");
    } finally {
      setDisputing(false);
    }
  };

  return (
    <div className="space-y-5">
      {fromCollege ? (
        <div className="rounded-xl border border-border-subtle bg-elevated/50 p-3.5">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-2xs font-semibold uppercase tracking-wide text-text-muted">Your branch · from your college</p>
              <p className="mt-0.5 text-sm font-bold text-primary">{branchName(catalog, user?.branch_code)}</p>
              {user?.branch && user.branch !== branchName(catalog, user.branch_code) && <p className="text-2xs text-text-muted">Listed as “{user.branch}”</p>}
            </div>
            {currentDiscipline && <span className={cn("rounded-full border px-2 py-0.5 text-3xs font-bold uppercase tracking-wide", disciplineStyle(catalog, currentDiscipline).chip)}>{familyMeta?.short}</span>}
          </div>
          <p className="mt-2 text-2xs text-text-muted">
            {user?.branch_disputed_at ? (
              "Thanks — we've asked your TPO to check this."
            ) : (
              <>
                Not right?{" "}
                <button type="button" onClick={dispute} disabled={disputing} className="font-semibold text-accent-primary hover:underline disabled:opacity-50">
                  {disputing ? "Telling your TPO…" : "Tell your TPO"}
                </button>
              </>
            )}
          </p>
          {disputeError && <p className="mt-1 text-2xs font-semibold text-status-danger">{disputeError}</p>}
        </div>
      ) : (
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-primary">
            Which branch are you in?
            {user?.branch && !user.branch_code && <span className="ml-1 font-medium text-text-muted">(your college lists “{user.branch}”)</span>}
          </h3>
          {departmentChoices.length > 1 && (
            <div role="radiogroup" aria-label="Department" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {departmentChoices.map((dept) => {
                const selected = selectedDepartment === dept.code;
                const style = accentStyle(dept.accent);
                return (
                  <button
                    key={dept.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setPickedDepartment(dept.code);
                      setFamily(null);
                      if (value.branchCode) onChange({ ...value, branchCode: null });
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                      selected ? cn("border-transparent ring-2", style.soft, style.ring) : "border-border-subtle bg-surface hover:border-border-strong hover:bg-elevated"
                    )}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", style.soft, style.text)}>
                      <DepartmentIcon name={dept.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 text-xs font-bold text-primary">{dept.name}</span>
                    {selected && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />}
                  </button>
                );
              })}
            </div>
          )}
          {selectedDepartment !== null && <div role="radiogroup" aria-label="Branch family" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {familiesToShow.map((d) => {
              const selected = shownFamily === d.code;
              return (
                <button
                  key={d.code}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setFamily(d.code);
                    // Moving to another family clears a branch that belonged to the previous one.
                    if (value.branchCode && catalog.branches.find((b) => b.code === value.branchCode)?.discipline !== d.code) onChange({ ...value, branchCode: null });
                  }}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold text-primary transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                    selected ? "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary/40" : "border-border-subtle bg-surface hover:border-border-strong hover:bg-elevated"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", disciplineStyle(catalog, d.code).dot)} aria-hidden />
                    <span className="truncate">{d.name}</span>
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-accent-primary" aria-hidden />}
                </button>
              );
            })}
          </div>}

          {shownFamily && (
            <div role="radiogroup" aria-label="Branch" className="flex flex-wrap gap-2">
              {catalog.branches
                .filter((b) => b.discipline === shownFamily)
                .map((b) => {
                  const selected = value.branchCode === b.code;
                  return (
                    <button
                      key={b.code}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange({ ...value, branchCode: b.code })}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-2xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                        selected ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong hover:bg-elevated"
                      )}
                    >
                      {selected && <Check className="h-3 w-3" aria-hidden />}
                      {b.name}
                    </button>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {asksTrack && (
        <>
          <section className="space-y-2">
            <h3 className="text-xs font-bold text-primary">What do you want to lead with?</h3>
            <RadioCards label="What to lead with" value={value.trackFocus} onChange={(id) => onChange({ ...value, trackFocus: id })} choices={TRACK_FOCUS} />
            <p className="flex items-start gap-1.5 text-2xs text-text-muted">
              <Info className="mt-px h-3 w-3 shrink-0" aria-hidden /> You can change this any time in Settings. Nothing is hidden — it only decides what your dashboard puts first.
            </p>
          </section>

          {interests.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">
                What are you drawn to? <span className="font-medium text-text-muted">(optional)</span>
              </h3>
              <div role="group" aria-label="Areas you are drawn to" className="flex flex-wrap gap-2">
                {interests.map((i) => {
                  const selected = value.interests.includes(i.id);
                  return (
                    <button
                      key={i.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChange({ ...value, interests: selected ? value.interests.filter((x) => x !== i.id) : [...value.interests, i.id] })}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-2xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                        selected ? "border-accent-primary bg-accent-primary/10 text-accent-primary" : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong hover:bg-elevated"
                      )}
                    >
                      {selected && <Check className="h-3 w-3" aria-hidden />}
                      {i.label}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Whether the track question applies to this student once `answers` are applied — the wizard and dialog use it to decide what is required. */
export function branchAsksTrack(user: AuthUser | null, answers: BranchAnswers, disciplines: { code: string; is_live?: boolean }[] | undefined, branches: { code: string; discipline: string }[] | undefined): boolean {
  const code = answers.branchCode ?? user?.branch_code ?? null;
  const discipline = branches?.find((b) => b.code === code)?.discipline ?? user?.discipline ?? null;
  // Live for everyone, or this student's own college is a pilot for their (unchanged) branch family.
  return isCoreDiscipline(discipline) && (!!disciplines?.find((d) => d.code === discipline)?.is_live || (!!user?.core_enabled && discipline === user.discipline));
}
