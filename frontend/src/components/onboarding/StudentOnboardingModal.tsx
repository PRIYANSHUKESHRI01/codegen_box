"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Code2, Rocket, Sparkles, Target } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { getToken, type AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import {
  CAREER_GOALS,
  FOCUS_AREAS,
  SKILL_LEVELS,
  WEEKLY_PACES,
  type CareerGoal,
  type FocusArea,
  type SkillLevel,
  type WeeklyPace,
} from "@/lib/studentPreferences";
import { ChipMulti, OtherLanguagesChoice, PrimaryLanguageChoice, RadioCards } from "./PreferenceFields";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Your language", subtitle: "We'll open the code editor in it for you.", icon: Code2 },
  { title: "About you", subtitle: "So we can tune practice to where you are.", icon: Target },
  { title: "Your plan", subtitle: "Set a pace you can actually keep.", icon: Rocket },
] as const;

interface StudentOnboardingModalProps {
  /** Fired once the answers are saved (the account is already refreshed by then). */
  onDone: () => void;
  /** "Skip for now" / closing the dialog. */
  onSkip: () => void;
}

/**
 * The first-login questions: which language they code in, how far along they
 * are and what they're aiming for, and how much they want to practise. Three
 * short steps; only the language, level and goal are required, and the whole
 * thing can be skipped (it comes back after a cool-off — see
 * User::needsOnboarding()). The answers feed the code editor's default
 * language, the weekly goal and what the student's TPO sees next to what they
 * actually write.
 */
export function StudentOnboardingModal({ onDone, onSkip }: StudentOnboardingModalProps) {
  const { login } = useAuth();
  const [step, setStep] = useState(0);
  const [primary, setPrimary] = useState<string | null>(null);
  const [others, setOthers] = useState<string[]>([]);
  const [level, setLevel] = useState<SkillLevel | null>(null);
  const [goal, setGoal] = useState<CareerGoal | null>(null);
  const [focus, setFocus] = useState<FocusArea[]>([]);
  const [pace, setPace] = useState<WeeklyPace>("steady");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = step === 0 ? !!primary : step === 1 ? !!level && !!goal : true;
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const selectPrimary = (id: string) => {
    setPrimary(id);
    // Picking a language as the main one takes it out of the "also" list.
    setOthers((list) => list.filter((l) => l !== id));
  };

  const finish = async () => {
    if (!primary || !level || !goal) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ user: AuthUser }>("/me/onboarding", {
        primary_language: primary,
        preferred_languages: others,
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
      subtitle={`Step ${step + 1} of ${STEPS.length} · ${current.title}`}
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
        <div className="flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label="Onboarding progress">
          {STEPS.map((s, i) => (
            <span key={s.title} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-accent-primary" : "bg-elevated")} />
          ))}
        </div>

        <p className="text-xs text-text-secondary">{current.subtitle}</p>

        {error && (
          <p role="alert" className="rounded-lg bg-status-danger/10 px-3 py-2 text-2xs font-semibold text-status-danger">
            {error}
          </p>
        )}

        {step === 0 && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">Which language do you code in most?</h3>
              <PrimaryLanguageChoice value={primary} onChange={selectPrimary} />
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">
                Anything else you're comfortable with? <span className="font-medium text-text-muted">(optional)</span>
              </h3>
              <OtherLanguagesChoice primary={primary} value={others} onChange={setOthers} />
            </section>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">How would you rate your coding right now?</h3>
              <RadioCards label="Coding level" value={level} onChange={setLevel} choices={SKILL_LEVELS} />
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">What are you preparing for?</h3>
              <RadioCards label="Main goal" value={goal} onChange={setGoal} choices={CAREER_GOALS} />
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">
                What do you want to spend time on? <span className="font-medium text-text-muted">(optional)</span>
              </h3>
              <ChipMulti label="Focus areas" value={focus} onChange={setFocus} choices={FOCUS_AREAS} />
            </section>
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-primary">How much do you want to practise?</h3>
              <RadioCards
                label="Weekly pace"
                value={pace}
                onChange={setPace}
                choices={WEEKLY_PACES.map((p) => ({ ...p, hint: `${p.hint} · ${p.solved} problems a week` }))}
              />
              <p className="text-2xs text-text-muted">This sets your weekly goal on the dashboard. You can change any of these answers later in Settings.</p>
            </section>
          </div>
        )}
      </div>
    </Modal>
  );
}
