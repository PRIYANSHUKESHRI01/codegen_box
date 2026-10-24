import type { Rng } from "./rng";
import type { Expr } from "./logic";

/** 1 = warm-up, 2 = standard, 3 = stretch. Each skill says in its own words what its levels mean. */
export type Level = 1 | 2 | 3;

export type PackId = "digital" | "circuits" | "quickcalcs";

/** One choice in a choice/multi question. `label` is Markdown with LaTeX. */
export interface Choice {
  id: string;
  label: string;
}

/** What input the student is given. */
export type AnswerSpec =
  | { kind: "text"; placeholder?: string; mono?: boolean; maxLength?: number }
  | { kind: "number"; unit?: string; placeholder?: string }
  | { kind: "choice"; options: Choice[] }
  | { kind: "multi"; options: Choice[] }
  /** A truth table whose output column the student fills with 0/1. */
  | { kind: "table"; inputs: string[]; rows: number };

/** What the student gave. Only the field that matches the question's input kind is used. */
export interface Response {
  text?: string;
  /** A number answer, as typed (parsed leniently by the checker). */
  number?: string;
  choice?: string;
  multi?: string[];
  /** The output column of a truth table; null = not filled yet. */
  table?: (0 | 1 | null)[];
}

/** A picture that belongs to the question. */
export type Figure =
  | { type: "circuit"; expr: Expr; /** values to show on the input terminals, if the question gives them */ inputs?: Record<string, 0 | 1>; output?: string }
  | { type: "table"; inputs: string[]; rows: (0 | 1)[][]; /** output column header and values (null = to be filled) */ output: string; values: (0 | 1 | null)[] };

/** What a generator produces; the framework adds `id`, `skill` and `level`. */
export interface QuestionBody {
  /** Markdown with LaTeX. */
  prompt: string;
  figure?: Figure;
  answer: AnswerSpec;
  /** One-line nudge the student can ask for before answering. */
  hint?: string;
  /** The correct answer in the same shape a student would give it — used to verify the question itself and to show "the answer". */
  solution: Response;
  /** How the answer reads, as Markdown, once revealed ("**1011 0100**"). */
  solutionText: string;
  /** Worked steps, as Markdown, shown after answering. At least one. */
  explanation: string[];
  /** Whether a response is correct. Must accept `solution`. */
  check: (response: Response) => boolean;
}

export interface DrillQuestion extends QuestionBody {
  /** `${skill}:${level}:${seed}` — enough to rebuild the question. */
  id: string;
  skill: string;
  level: Level;
}

export type QuestionGenerator = (rng: Rng, level: Level) => QuestionBody;

export interface SkillDef {
  id: string;
  pack: PackId;
  title: string;
  /** One line on what the skill is. */
  blurb: string;
  /** What each level asks, in plain words: [warm-up, standard, stretch]. */
  levels: readonly [string, string, string];
  generate: QuestionGenerator;
}

export interface PackDef {
  id: PackId;
  title: string;
  blurb: string;
  /** Branch families this pack is built for (drives ordering and the "For your branch" label). */
  audience: readonly string[];
  skills: readonly SkillDef[];
}
