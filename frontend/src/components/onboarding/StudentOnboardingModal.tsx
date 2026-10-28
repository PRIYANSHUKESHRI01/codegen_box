"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Code2, GitBranch, Rocket, Sparkles, Target } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { getToken, type AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { useBranchCatalog } from "@/lib/branches";
import { capabilitiesOf, departmentCan } from "@/lib/departments";
import {
  careerGoalsFor,
  focusAreasFor,
  paceHint,
  skillLevelsFor,
  WEEKLY_PACES,
  type CareerGoal,
  type FocusArea,
  type SkillLevel,
  type WeeklyPace,
} from "@/lib/studentPreferences";
import { ChipMulti, OtherLanguagesChoice, PrimaryLanguageChoice, RadioCards } from "./PreferenceFields";
import { BranchFields, branchAnswersComplete, branchAsksTrack, branchPayload, initialBranchAnswers, type BranchAnswers } from "./BranchFields";
import { cn } from "@/lib/utils";

const BRANCH_STEP = { id: "branch", title: "Your branch", subtitle: "So your dashboard, drives and practice fit what you study.", icon: GitBranch } as const;
const LANGUAGE_STEP = { id: "language", title: "Your language", subtitle: "We'll open the code editor in it for you.", icon: Code2 } as const;
const ABOUT_STEP = { id: "about", title: "About you", subtitle: "So we can tune practice to where you are.", icon: Target } as const;
const PLAN_STEP = { id: "plan", title: "Your plan", subtitle: "Set a pace you can actually keep.", icon: Rocket } as const;

interface StudentOnboardingModalProps {
  /** Fired once the answers are saved (the account is already refreshed by then). */
  onDone: () => void;
  /** "Skip for now" / closing the dialog. */
  onSkip: () => void;
}

/**
 * The first-login questions: (when we don't know it yet) which branch they study, which language they code
 * in, how far along they are and what they're aiming for, and how much they want to practise. Short steps;
 * only the language, level and goal are required — and a student who leads with core prep for their branch
 * can say they don't code yet. The whole thing can be skipped (it comes back after a cool-off — see
 * User::needsOnboarding()). The answers feed the code editor's default language, the weekly goal, the
 * dashboard they land on and what the student's TPO sees next to what they actually do.
 *
 * The branch step only appears when the server says it needs asking (`branch_pending`): a student whose
 * college already gave a recognised CSE branch sees the same three steps as ever.
 */
export function StudentOnboardingModal({ onDone, onSkip }: StudentOnboardingModalProps) {
  const { user, login } = useAuth();
  const catalog = useBranchCatalog();
  // Fixed as soon as we know who the student is (the gate only mounts this once they are loaded). Saving
  // refreshes the account — branch_pending flips to false — and a list that reacted to that would shrink
  // under the step the student is still on.
  const stepsRef = useRef<(typeof BRANCH_STEP | typeof LANGUAGE_STEP | typeof ABOUT_STEP | typeof PLAN_STEP)[] | null>(null);
  if (stepsRef.current === null && user) {
    stepsRef.current = user.branch_pending ? [BRANCH_STEP, LANGUAGE_STEP, ABOUT_STEP, PLAN_STEP] : [LANGUAGE_STEP, ABOUT_STEP, PLAN_STEP];
  }
  const allSteps = stepsRef.current ?? [LANGUAGE_STEP, ABOUT_STEP, PLAN_STEP];

  const [step, setStep] = useState(0);
  const [branch, setBranch] = useState<BranchAnswers>(() => initialBranchAnswers(user));
  const [primary, setPrimary] = useState<string | null>(null);
  const [others, setOthers] = useState<string[]>([]);
  const [noCode, setNoCode] = useState(false);
  const [level, setLevel] = useState<SkillLevel | null>(null);
  const [goal, setGoal] = useState<CareerGoal | null>(null);
  const [focus, setFocus] = useState<FocusArea[]>([]);
  const [pace, setPace] = useState<WeeklyPace>("steady");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asksTrack = branchAsksTrack(user, branch, catalog?.disciplines, catalog?.branches);
  const discipline = catalog?.branches.find((b) => b.code === (branch.branchCode ?? user?.branch_code))?.discipline ?? user?.discipline ?? null;
  // The department the student is in — or has just picked on the branch step — decides whether coding is part of their programme at all.
  // A student who writes their own branch has no family, so the department they chose for it decides.
  const department = (branch.otherLabel != null ? branch.otherDepartment : null) ?? catalog?.disciplines.find((d) => d.code === discipline)?.department ?? user?.department ?? null;
  const codes = (user?.coding_opt_in ?? false) || (department ? departmentCan(catalog, department, "coding_practice") : capabilitiesOf(user).coding_practice);
  // A programme without coding is never asked which language it codes in.
  const steps = codes ? allSteps : allSteps.filter((s) => s.id !== "language");
  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;
  // "I don't code yet" is only on offer to a student who is leading with their branch's core prep.
  const coreFirst = branch.trackFocus === "core_first";
  const languageOk = !codes || !!primary || (coreFirst && noCode);

  const canContinue =
    current.id === "branch" ? branchAnswersComplete(user, branch, asksTrack) : current.id === "language" ? languageOk : current.id === "about" ? !!level && !!goal : true;

  const selectPrimary = (id: string) => {
    setPrimary(id);
    setNoCode(false);
    // Picking a language as the main one takes it out of the "also" list.
    setOthers((list) => list.filter((l) => l !== id));
  };

  const finish = async () => {
    if (!languageOk || !level || !goal) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ user: AuthUser }>("/me/onboarding", {
        ...branchPayload(branch),
        ...(branch.trackFocus ? { track_focus: branch.trackFocus, core_interests: branch.interests } : {}),
        ...(primary ? { primary_language: primary, preferred_languages: others } : {}),
        skill_level: level,
        career_goal: goal,
        focus_areas: focus,
        weekly_pace: pace,
      });
      const token = getToken();
      if (token) login(token, res.user);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your answers. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!canContinue) return;
    if (isLast) void finish();
    else setStep((s) => s + 1);
  };

  return (
    <Modal
      onClose={onSkip}
      title="Let's set up your practice"
      subtitle={`Step ${step + 1} of ${steps.length} · ${current.title}`}
      icon={Sparkles}
      size="xl"
      closeOnBackdrop={false}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            disabled={saving}
            className="rounded-md text-2xs font-semibold text-text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary disabled:opacity-50"
          >
            Skip for now
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => s - 1)} disabled={saving} leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={next}
              disabled={!canContinue}
              isLoading={saving}
              rightIcon={isLast ? undefined : <ArrowRight className="h-3.5 w-3.5" />}
            >
              {isLast ? "Finish" : "Continue"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Progress */}
        <div className="flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label="Onboarding progress">
          {steps.map((s, i) => (
            <span key={s.id} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-accent-primary" : "bg-elevated")} />
          ))}
        </div>

        <p className="text-xs text-text-secondary">{current.subtitle}</p>

        {error && (
          <p role="alert" className="rounded-lg bg-status-danger/10 px-3 py-2 text-2xs font-semibold text-status-danger">
            {error}
          </p>
        )}

        {current.id === "branch" && (
          <BranchFields user={user} value={branch} onChange={setBranch} onDisputed={(updated) => { const token = getToken(); if (token) login(token, updated); }} />
        )}

        {current.id === "language" && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">Which language do you code in most?</h3>
              <PrimaryLanguageChoice value={primary} onChange={selectPrimary} />
              {coreFirst && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={noCode}
                  onClick={() => {
                    setNoCode((v) => !v);
                    setPrimary(null);
                    setOthers([]);
                  }}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                    noCode ? "border-accent-primary bg-accent-primary/10 text-accent-primary ring-1 ring-accent-primary/40" : "border-border-subtle bg-surface text-primary hover:border-border-strong hover:bg-elevated"
                  )}
                >
                  I don&apos;t code yet
                  <span className="mt-0.5 block text-2xs font-medium text-text-muted">That&apos;s fine — your dashboard leads with your branch. You can add a language any time.</span>
                </button>
              )}
            </section>
            {!noCode && (
              <section className="space-y-2">
                <h3 className="text-xs font-bold text-primary">
                  Anything else you&apos;re comfortable with? <span className="font-medium text-text-muted">(optional)</span>
                </h3>
                <OtherLanguagesChoice primary={primary} value={others} onChange={setOthers} />
              </section>
            )}
          </div>
        )}

        {current.id === "about" && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">{codes ? "How would you rate your coding right now?" : "How would you rate your preparation right now?"}</h3>
              <RadioCards label={codes ? "Coding level" : "Preparation level"} value={level} onChange={setLevel} choices={skillLevelsFor(codes)} />
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">What are you preparing for?</h3>
              <RadioCards label="Main goal" value={goal} onChange={setGoal} choices={careerGoalsFor(discipline, department)} />
            </section>
          </div>
        )}

        {current.id === "plan" && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">
                What do you want to spend time on? <span className="font-medium text-text-muted">(optional)</span>
              </h3>
              <ChipMulti label="Focus areas" value={focus} onChange={setFocus} choices={focusAreasFor(discipline, codes)} />
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">How much do you want to practise?</h3>
              <RadioCards
                label="Weekly pace"
                value={pace}
                onChange={setPace}
                choices={WEEKLY_PACES.map((p) => ({ ...p, hint: paceHint(p, codes) }))}
              />
              <p className="text-2xs text-text-muted">This sets your weekly goal on the dashboard. You can change any of these answers later in Settings.</p>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}
