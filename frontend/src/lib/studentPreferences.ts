import { JUDGE_LANGUAGES } from "./judgeLanguages";

/**
 * What a student can tell us about themselves — first-login onboarding and
 * Settings → Coding preferences read the same lists. The ids mirror
 * App\Support\StudentPreferences on the backend, which rejects anything outside
 * them, so a drifted frontend fails loudly instead of saving junk. Languages
 * are the judge's own ids (see judgeLanguages.ts), so a stored preference can
 * be handed straight to the code editor.
 */

export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type CareerGoal =
  | "campus_placement"
  | "product_company"
  | "internship"
  | "higher_studies"
  | "competitive_programming"
  | "skill_building";
export type FocusArea = "problem_solving" | "contests" | "mock_interviews" | "communication" | "soft_skills" | "projects";
export type WeeklyPace = "casual" | "steady" | "intense";

export interface Choice<T extends string> {
  id: T;
  label: string;
  hint: string;
}

export const SKILL_LEVELS: readonly Choice<SkillLevel>[] = [
  { id: "beginner", label: "Just starting", hint: "Learning syntax and solving easy problems" },
  { id: "intermediate", label: "Comfortable", hint: "Solve most easy and some medium problems" },
  { id: "advanced", label: "Strong", hint: "Medium problems are routine; working on hard ones" },
];

export const CAREER_GOALS: readonly Choice<CareerGoal>[] = [
  { id: "campus_placement", label: "Campus placement", hint: "Clear my college's placement drives" },
  { id: "product_company", label: "Product company", hint: "Aim for top product-based roles" },
  { id: "internship", label: "Internship", hint: "Land an internship this year" },
  { id: "higher_studies", label: "Higher studies", hint: "Prepare for MS / MBA / GATE" },
  { id: "competitive_programming", label: "Competitive programming", hint: "Get better and climb contest ratings" },
  { id: "skill_building", label: "Build my skills", hint: "Learn and improve without a deadline" },
];

export const FOCUS_AREAS: readonly Choice<FocusArea>[] = [
  { id: "problem_solving", label: "Problem solving", hint: "DSA practice" },
  { id: "contests", label: "Contests", hint: "Timed, ranked rounds" },
  { id: "mock_interviews", label: "Mock interviews", hint: "AI-led interview practice" },
  { id: "communication", label: "Communication", hint: "Speaking, listening, vocabulary" },
  { id: "soft_skills", label: "Soft skills", hint: "Aptitude and behavioural tests" },
  { id: "projects", label: "Projects", hint: "Project Lab and hackathons" },
];

export const WEEKLY_PACES: readonly (Choice<WeeklyPace> & { solved: number; hard: number })[] = [
  { id: "casual", label: "Casual", hint: "A few problems a week", solved: 10, hard: 2 },
  { id: "steady", label: "Steady", hint: "A little every day", solved: 20, hard: 5 },
  { id: "intense", label: "Intense", hint: "Serious prep mode", solved: 35, hard: 10 },
];

/** Same cap as StudentPreferences::MAX_LANGUAGES — the primary language plus up to five more. */
export const MAX_LANGUAGES = 6;

/** The languages most students start with, shown first; every other language the judge runs sits behind "More languages". */
export const POPULAR_LANGUAGE_IDS: readonly string[] = ["python", "java", "cpp", "javascript", "c"];

export function choiceLabel<T extends string>(choices: readonly Choice<T>[], id: string | null | undefined): string | null {
  if (!id) return null;
  return choices.find((c) => c.id === id)?.label ?? null;
}

/** The languages a student has chosen, primary first, only ones the judge actually runs. */
export function preferredLanguageList(prefs: { primary_language?: string | null; preferred_languages?: string[] | null }): string[] {
  const known = new Set(JUDGE_LANGUAGES.map((l) => l.id));
  const list = [prefs.primary_language, ...(prefs.preferred_languages ?? [])].filter((id): id is string => !!id && known.has(id));
  return Array.from(new Set(list));
}

/**
 * Which language the editor should open in. In order:
 *   1. the language they last used on this device, if this problem offers it (what every judge does — you
 *      come back to where you left off),
 *   2. their stated primary language, then the other languages they said they know, in order,
 *   3. otherwise the first language the problem offers (the behaviour before preferences existed).
 * `available` is whatever the problem offers; the result is always one of them.
 */
export function pickInitialLanguage(
  available: readonly string[],
  prefs: { primary_language?: string | null; preferred_languages?: string[] | null } | null | undefined,
  lastUsed?: string | null,
  fallback = "javascript"
): string {
  if (available.length === 0) return fallback;

  const offered = new Set(available);
  const candidates = [lastUsed, ...preferredLanguageList(prefs ?? {})];
  const match = candidates.find((id): id is string => !!id && offered.has(id));

  return match ?? available[0];
}

const LAST_LANGUAGE_KEY = "aptrun:last-language";

/** Per-device memory of the language a student last coded in — client-only convenience, never trusted for anything else. */
export function recallLastLanguage(userId: number | null | undefined): string | null {
  if (!userId) return null;
  try {
    return window.localStorage.getItem(`${LAST_LANGUAGE_KEY}:${userId}`);
  } catch {
    return null;
  }
}

export function rememberLastLanguage(userId: number | null | undefined, language: string): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(`${LAST_LANGUAGE_KEY}:${userId}`, language);
  } catch {
    // Private mode / storage blocked — the editor simply falls back to their stated preference next time.
  }
}
