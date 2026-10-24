import { buildQuestion } from "./catalog";
import { randomSeed } from "./rng";
import type { DrillQuestion, Level, Response } from "./types";

/** Questions in one sitting. Short on purpose: a session ends on a result, and the next one is one tap away. */
export const SESSION_SIZE = 10;

/**
 * The next question for a skill at a level, not repeating any prompt already seen in this sitting. Tries a handful of seeds; if every one
 * repeats (a tiny question space), the last one is used rather than looping.
 */
export function drawQuestion(skillId: string, level: Level, seen: ReadonlySet<string>, seed: () => number = randomSeed): DrillQuestion {
  let question = buildQuestion(skillId, level, seed());
  for (let tries = 0; tries < 12 && seen.has(question.prompt); tries++) {
    question = buildQuestion(skillId, level, seed());
  }
  return question;
}

/** Whether the student has given enough of an answer to check: an empty box or a half-filled table is not an attempt. */
export function isAnswerReady(question: DrillQuestion, response: Response): boolean {
  switch (question.answer.kind) {
    case "text":
      return (response.text ?? "").trim().length > 0;
    case "number":
      return (response.number ?? "").trim().length > 0;
    case "choice":
      return !!response.choice;
    case "multi":
      return (response.multi?.length ?? 0) > 0;
    case "table":
      return !!response.table && response.table.length === question.answer.rows && response.table.every((cell) => cell !== null);
  }
}

/** The blank response a question starts with. */
export function blankResponse(question: DrillQuestion): Response {
  return question.answer.kind === "table" ? { table: Array(question.answer.rows).fill(null) } : {};
}

/** Checks a response; a checker that throws on odd input counts as wrong rather than crashing the page. */
export function gradeResponse(question: DrillQuestion, response: Response): boolean {
  try {
    return question.check(response) === true;
  } catch {
    return false;
  }
}

/** One answered question, in the shape the API takes. */
export interface DrillAttempt {
  pack: string;
  skill: string;
  difficulty: Level;
  correct: boolean;
  seconds: number;
  /** The proctored sitting this answer was given in (null when study proctoring is off). The server only accepts answers into a sitting. */
  sitting_id?: number | null;
}
