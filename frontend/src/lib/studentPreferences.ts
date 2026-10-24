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
  | "skill_building"
  | "core_company"
  | "psu_gate"
  | "mba_admission"
  | "professional_certs"
  | "govt_exams"
  | "academia"
  | "entrepreneurship";
export type FocusArea = "problem_solving" | "contests" | "mock_interviews" | "communication" | "soft_skills" | "projects" | "core_subjects";
/** What a non-CS student leads with — mirrors StudentPreferences::TRACK_FOCUS. */
export type TrackFocus = "core_first" | "balanced" | "it_first";
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
  { id: "core_company", label: "Core company", hint: "A role in my own branch — L&T, Tata, Bosch, TI and the like" },
  { id: "psu_gate", label: "PSU / GATE", hint: "Prepare for GATE or public-sector recruitment" },
  { id: "mba_admission", label: "MBA / PGDM admission", hint: "Prepare for CAT, XAT, CMAT or a college's own test" },
  { id: "professional_certs", label: "Professional qualification", hint: "CA, CS, CMA, CFA, ACCA and similar" },
  { id: "govt_exams", label: "Government exams", hint: "Banking, SSC, UPSC and state services" },
  { id: "academia", label: "Teaching & academia", hint: "NET / SET, B.Ed, research or a teaching role" },
  { id: "entrepreneurship", label: "Start something of my own", hint: "A business, a start-up or a family firm" },
];

const CORE_GOAL_IDS: readonly CareerGoal[] = ["core_company", "psu_gate"];
const NON_TECH_GOAL_IDS: readonly CareerGoal[] = ["mba_admission", "professional_certs", "govt_exams", "academia", "entrepreneurship"];

/** What each non-engineering department leads with, in order; everything else follows. */
const GOAL_ORDER: Record<string, readonly CareerGoal[]> = {
  management: ["campus_placement", "internship", "mba_admission", "entrepreneurship", "professional_certs", "higher_studies", "skill_building"],
  commerce: ["campus_placement", "professional_certs", "higher_studies", "govt_exams", "internship", "entrepreneurship", "skill_building"],
  arts: ["campus_placement", "academia", "govt_exams", "higher_studies", "internship", "entrepreneurship", "skill_building"],
};

/**
 * Core goals only make sense outside CSE; CSE students see the list exactly as it always was. A student of another department
 * (Management, Commerce, Arts …) gets goals that fit their programme instead of "Competitive programming".
 */
export function careerGoalsFor(discipline: string | null | undefined, department?: string | null): readonly Choice<CareerGoal>[] {
  if (department && department !== "engineering") {
    const order = GOAL_ORDER[department] ?? ["campus_placement", "internship", "higher_studies", "govt_exams", "entrepreneurship", "skill_building"];
    return order.map((id) => CAREER_GOALS.find((g) => g.id === id)!).filter(Boolean);
  }
  const core = !!discipline && !["cse", "other"].includes(discipline);
  const base = CAREER_GOALS.filter((g) => !NON_TECH_GOAL_IDS.includes(g.id));
  if (!core) return base.filter((g) => !CORE_GOAL_IDS.includes(g.id));
  return [...base.filter((g) => CORE_GOAL_IDS.includes(g.id)), ...base.filter((g) => !CORE_GOAL_IDS.includes(g.id))];
}

/** "How would you rate your coding?" is meaningless without coding: the same three levels, worded for preparing in your own field. */
export function skillLevelsFor(codes: boolean): readonly Choice<SkillLevel>[] {
  if (codes) return SKILL_LEVELS;
  return [
    { id: "beginner", label: "Just starting", hint: "Building the basics of my subject" },
    { id: "intermediate", label: "Comfortable", hint: "I know the fundamentals and can handle most questions" },
    { id: "advanced", label: "Strong", hint: "Working on advanced topics and exam-level questions" },
  ];
}

export const FOCUS_AREAS: readonly Choice<FocusArea>[] = [
  { id: "problem_solving", label: "Problem solving", hint: "DSA practice" },
  { id: "contests", label: "Contests", hint: "Timed, ranked rounds" },
  { id: "mock_interviews", label: "Mock interviews", hint: "AI-led interview practice" },
  { id: "communication", label: "Communication", hint: "Speaking, listening, vocabulary" },
  { id: "soft_skills", label: "Soft skills", hint: "Aptitude and behavioural tests" },
  { id: "projects", label: "Projects", hint: "Project Lab and hackathons" },
  { id: "core_subjects", label: "Core subjects", hint: "Technical practice for my branch" },
];

/**
 * Focus areas offered to a student: "Core subjects" only exists outside CSE. A programme without coding is offered only the areas it
 * has — interviews, communication, soft skills and its own subject (no problem solving, contests or projects).
 */
export function focusAreasFor(discipline: string | null | undefined, codes = true): readonly Choice<FocusArea>[] {
  if (!codes) {
    return FOCUS_AREAS.filter((f) => ["mock_interviews", "communication", "soft_skills", "core_subjects"].includes(f.id)).map((f) =>
      f.id === "core_subjects" ? { ...f, label: "My subject", hint: "Practice and tests for my own programme" } : f
    );
  }
  const core = !!discipline && !["cse", "other"].includes(discipline);
  return core ? FOCUS_AREAS : FOCUS_AREAS.filter((f) => f.id !== "core_subjects");
}

/** What a weekly pace means in numbers: problems for a coder, practice questions (three a problem, as the dashboard counts them) for everyone else. */
export function paceHint(p: { hint: string; solved: number }, codes: boolean): string {
  return codes ? `${p.hint} · ${p.solved} problems a week` : `${p.hint} · ${p.solved * 3} practice questions a week`;
}

export const TRACK_FOCUS: readonly Choice<TrackFocus>[] = [
  { id: "core_first", label: "Core first", hint: "Lead with my branch's technical prep; coding is optional" },
  { id: "balanced", label: "Core + IT", hint: "My branch's prep and coding side by side" },
  { id: "it_first", label: "IT roles first", hint: "TCS / Infosys / product roles — the software prep, plus core on the side" },
];

/** Areas a student can say they are drawn to, per branch family. Mirrors StudentPreferences::CORE_INTERESTS. */
export const CORE_INTERESTS: Record<string, readonly { id: string; label: string }[]> = {
  ece: [
    { id: "vlsi", label: "VLSI & chip design" },
    { id: "embedded", label: "Embedded systems" },
    { id: "communication_rf", label: "Communication & RF" },
    { id: "signal_processing", label: "Signal processing" },
    { id: "analog_design", label: "Analog design" },
    { id: "iot", label: "IoT" },
  ],
  eee: [
    { id: "power_systems", label: "Power systems" },
    { id: "power_electronics_ev", label: "Power electronics & EV" },
    { id: "electrical_machines", label: "Electrical machines" },
    { id: "control_systems", label: "Control systems" },
    { id: "renewable_energy", label: "Renewable energy" },
    { id: "electrical_design", label: "Electrical design" },
  ],
  mech: [
    { id: "design_cad", label: "Design & CAD" },
    { id: "thermal", label: "Thermal & HVAC" },
    { id: "manufacturing", label: "Manufacturing" },
    { id: "automotive_ev", label: "Automotive & EV" },
    { id: "robotics", label: "Robotics" },
    { id: "quality_production", label: "Quality & production" },
  ],
  civil: [
    { id: "structural", label: "Structural" },
    { id: "geotechnical", label: "Geotechnical" },
    { id: "transportation", label: "Transportation" },
    { id: "construction_management", label: "Construction management" },
    { id: "environmental", label: "Environmental" },
    { id: "planning_surveying", label: "Planning & surveying" },
  ],
};

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
