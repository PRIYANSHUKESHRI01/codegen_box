"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Save } from "lucide-react";
import { ChipMulti, OtherLanguagesChoice, PrimaryLanguageChoice, RadioCards } from "@/components/onboarding/PreferenceFields";
import { Button } from "@/components/ui/Button";
import { api, ApiError } from "@/lib/api";
import { getToken, type AuthUser } from "@/lib/auth";
import { useAuth } from "@/lib/AuthContext";
import { CAREER_GOALS, FOCUS_AREAS, SKILL_LEVELS, WEEKLY_PACES, type CareerGoal, type FocusArea, type SkillLevel, type WeeklyPace } from "@/lib/studentPreferences";

interface Form {
  primary: string | null;
  others: string[];
  level: SkillLevel | null;
  goal: CareerGoal | null;
  focus: FocusArea[];
  pace: WeeklyPace;
}

/** Order-insensitive comparison of two string lists. */
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

const sameForm = (a: Form, b: Form) =>
  a.primary === b.primary && sameSet(a.others, b.others) && a.level === b.level && a.goal === b.goal && sameSet(a.focus, b.focus) && a.pace === b.pace;

/** What the account has saved, in the shape the form edits. */
function savedForm(user: AuthUser): Form {
  return {
    primary: user.primary_language ?? null,
    others: (user.preferred_languages ?? []).filter((l) => l !== user.primary_language),
    level: user.skill_level ?? null,
    goal: user.career_goal ?? null,
    focus: user.focus_areas ?? [],
    pace: user.weekly_pace ?? "steady",
  };
}

/**
 * Settings → Preferences → Coding preferences: the same answers the first-login
 * wizard collects, editable any time. These are real — saved to the account,
 * they set the language the editor opens in, the weekly goal on the dashboard,
 * and what the student's TPO sees next to what they actually write.
 *
 * The form follows the account: if the saved answers change underneath it (the
 * session is re-checked a moment after the page opens, or they answered on
 * another device) and the student hasn't started editing, it picks up the new
 * values — so a stale cache can never show old answers or overwrite fresh ones
 * on Save. Once they've started editing, their edits are left alone.
 */
export function CodingPreferencesSection({ user, onToast }: { user: AuthUser; onToast: (message: string) => void }) {
  const { login } = useAuth();

  const saved = useMemo(
    () => savedForm(user),
    // Depend on the answers themselves, not the user object, which is a new reference on every session re-check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user.primary_language, JSON.stringify(user.preferred_languages), user.skill_level, user.career_goal, JSON.stringify(user.focus_areas), user.weekly_pace]
  );

  const [form, setForm] = useState<Form>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formRef = useRef(form);
  formRef.current = form;
  const previousSaved = useRef(saved);

  useEffect(() => {
    if (sameForm(previousSaved.current, saved)) return;
    // Pick up the new saved answers only if the form still matched the old ones, i.e. nothing is being edited.
    if (sameForm(formRef.current, previousSaved.current)) setForm(saved);
    previousSaved.current = saved;
  }, [saved]);

  const patch = (change: Partial<Form>) => setForm((current) => ({ ...current, ...change }));
  const dirty = !sameForm(form, saved);

  const selectPrimary = (id: string) =>
    setForm((current) => ({ ...current, primary: id, others: current.others.filter((l) => l !== id) }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<{ user: AuthUser }>("/me/preferences", {
        ...(form.primary ? { primary_language: form.primary } : {}),
        preferred_languages: form.others,
        ...(form.level ? { skill_level: form.level } : {}),
        ...(form.goal ? { career_goal: form.goal } : {}),
        focus_areas: form.focus,
        weekly_pace: form.pace,
      });
      const token = getToken();
      if (token) login(token, res.user);
      onToast("Coding preferences saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6 rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6" aria-labelledby="coding-prefs-heading">
      <div>
        <h3 id="coding-prefs-heading" className="text-sm font-bold text-primary">
          Coding Preferences
        </h3>
        <p className="mt-0.5 text-xs text-text-muted">
          The code editor opens in your language, your weekly goal follows your pace, and your placement cell sees what you're aiming for.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-status-danger/10 px-3 py-2 text-2xs font-semibold text-status-danger">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-primary">Main language</h4>
        <PrimaryLanguageChoice value={form.primary} onChange={selectPrimary} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-primary">Also comfortable with</h4>
        <OtherLanguagesChoice primary={form.primary} value={form.others} onChange={(others) => patch({ others })} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-primary">Coding level</h4>
        <RadioCards label="Coding level" value={form.level} onChange={(level) => patch({ level })} choices={SKILL_LEVELS} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-primary">Preparing for</h4>
        <RadioCards label="Main goal" value={form.goal} onChange={(goal) => patch({ goal })} choices={CAREER_GOALS} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-primary">Focus areas</h4>
        <ChipMulti label="Focus areas" value={form.focus} onChange={(focus) => patch({ focus })} choices={FOCUS_AREAS} />
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-primary">Weekly pace</h4>
        <RadioCards
          label="Weekly pace"
          value={form.pace}
          onChange={(pace) => patch({ pace })}
          choices={WEEKLY_PACES.map((p) => ({ ...p, hint: `${p.hint} · ${p.solved} problems a week` }))}
        />
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-4">
        {!dirty && <span className="text-2xs text-text-muted">All changes saved</span>}
        <Button size="sm" onClick={save} disabled={!dirty} isLoading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>
          Save coding preferences
        </Button>
      </div>
    </section>
  );
}
