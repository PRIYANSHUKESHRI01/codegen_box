import type { Level } from "./types";

/**
 * Mastery, in the spirit of Khan Academy's skill levels: it is judged on a rolling window of the student's most recent answers to a skill,
 * so it goes up with consistent good work and slides back down when a skill goes cold. It is practice feedback, not a grade — it never
 * reaches the readiness score.
 */

/** One stored answer: [1 if correct, difficulty 1–3]. The server returns them newest first. */
export type RecentAnswer = readonly [number, number];

export type MasteryKey = "new" | "attempted" | "familiar" | "proficient" | "mastered";

export interface Mastery {
  key: MasteryKey;
  label: string;
  /** 0–4, for rendering a meter. */
  rank: 0 | 1 | 2 | 3 | 4;
  /** What it takes to reach the next level, in plain words. Null at the top. */
  next: string | null;
  /** Share of recent answers that were right, 0–1; null with no answers. */
  accuracy: number | null;
}

const LABELS: Record<MasteryKey, string> = { new: "Not started", attempted: "Attempted", familiar: "Familiar", proficient: "Proficient", mastered: "Mastered" };

export function masteryFrom(recent: readonly RecentAnswer[]): Mastery {
  const n = recent.length;
  const correct = recent.filter((r) => r[0] === 1).length;
  const accuracy = n ? correct / n : null;
  const right = (minDifficulty: number) => recent.filter((r) => r[0] === 1 && r[1] >= minDifficulty).length;

  const make = (key: MasteryKey, rank: Mastery["rank"], next: string | null): Mastery => ({ key, label: LABELS[key], rank, next, accuracy });

  if (n === 0) return make("new", 0, "Answer a few questions to get started.");

  if (n >= 8 && (accuracy ?? 0) >= 0.875 && right(3) >= 3) return make("mastered", 4, null);

  if (n >= 6 && (accuracy ?? 0) >= 0.75 && right(2) >= 3) {
    return make("proficient", 3, n < 8 ? "Keep going — a few more strong answers, including level 3, make this Mastered." : "Get almost every answer right, including at level 3, to reach Mastered.");
  }

  if (n >= 4 && (accuracy ?? 0) >= 0.6) {
    return make("familiar", 2, right(2) >= 3 ? "Answer more questions in a row correctly to reach Proficient." : "Get level 2 questions right to reach Proficient.");
  }

  return make("attempted", 1, n < 4 ? `Answer ${4 - n} more to see how you are doing.` : "Get 3 of every 5 right to reach Familiar.");
}

/**
 * The difficulty to start a session at, from the stored recent answers (newest first). Replays them oldest → newest through the same
 * rule the session uses, so the next session picks up where the last one left the student.
 */
export function levelFromHistory(recentNewestFirst: readonly RecentAnswer[]): Level {
  return replay([...recentNewestFirst].reverse().map((r) => r[0] === 1));
}

/** Level after a run of results (oldest first): 3 right in a row at a level moves up, 2 wrong in a row moves down. */
export function replay(results: readonly boolean[], start: Level = 1): Level {
  let level = start;
  let right = 0;
  let wrong = 0;
  for (const ok of results) {
    if (ok) {
      right += 1;
      wrong = 0;
      if (right >= 3 && level < 3) {
        level = (level + 1) as Level;
        right = 0;
      }
    } else {
      wrong += 1;
      right = 0;
      if (wrong >= 2 && level > 1) {
        level = (level - 1) as Level;
        wrong = 0;
      }
    }
  }
  return level;
}

/** A skill's rolling accuracy as a percentage, or null when there is nothing to judge. */
export const accuracyPercent = (recent: readonly RecentAnswer[]): number | null => (recent.length ? Math.round((recent.filter((r) => r[0] === 1).length / recent.length) * 100) : null);
