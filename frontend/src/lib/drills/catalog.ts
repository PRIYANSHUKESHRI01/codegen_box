import { createRng } from "./rng";
import { CIRCUITS_PACK } from "./circuits";
import { DIGITAL_PACK } from "./digital";
import { QUICKCALCS_PACK } from "./quickcalcs";
import type { DrillQuestion, Level, PackDef, PackId, SkillDef } from "./types";

/**
 * Every pack and skill. The ids here must match backend/config/drills.php — the API only accepts those, and a test fails if the two drift apart.
 */
export const PACKS: readonly PackDef[] = [DIGITAL_PACK, CIRCUITS_PACK, QUICKCALCS_PACK];

export const ALL_SKILLS: readonly SkillDef[] = PACKS.flatMap((p) => p.skills);

const SKILL_BY_ID = new Map(ALL_SKILLS.map((s) => [s.id, s]));
const PACK_BY_ID = new Map(PACKS.map((p) => [p.id, p]));

export const getSkill = (id: string): SkillDef | undefined => SKILL_BY_ID.get(id);
export const getPack = (id: string): PackDef | undefined => PACK_BY_ID.get(id as PackId);

/** The pack a skill belongs to. */
export const packOf = (skillId: string): PackDef | undefined => {
  const skill = SKILL_BY_ID.get(skillId);
  return skill ? PACK_BY_ID.get(skill.pack) : undefined;
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** How many times a generator is retried with a neighbouring seed if it throws, before the error is allowed to surface. */
const RETRIES = 6;

/**
 * Builds a question. Pure: the same (skill, level, seed) always gives the same question, so a question id is enough to rebuild it.
 * A generator that throws for an unlucky seed is retried on the next seed — practice must never dead-end on a rare draw.
 */
export function buildQuestion(skillId: string, level: Level, seed: number): DrillQuestion {
  const skill = SKILL_BY_ID.get(skillId);
  if (!skill) throw new Error(`Unknown drill skill: ${skillId}`);

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const usedSeed = (seed + attempt) >>> 0;
    try {
      const body = skill.generate(createRng((usedSeed ^ hash(`${skillId}:${level}`)) >>> 0), level);
      return { ...body, id: `${skillId}:${level}:${usedSeed}`, skill: skillId, level };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not build a ${skillId} question`);
}

/** Rebuilds a question from its id, or null when the id is not one this build understands. */
export function rebuildQuestion(id: string): DrillQuestion | null {
  const [skill, level, seed] = id.split(":");
  const lvl = Number(level);
  const s = Number(seed);
  if (!skill || !SKILL_BY_ID.has(skill) || ![1, 2, 3].includes(lvl) || !Number.isInteger(s)) return null;
  try {
    return buildQuestion(skill, lvl as Level, s);
  } catch {
    return null;
  }
}

/**
 * Packs in the order a student of this branch should see them: the pack built for their branch first, then the shared digital basics,
 * then the rest. `discipline` is the branch family code (ece / eee / mech / civil / cse / other); unknown or missing → digital first.
 */
export function packsForBranch(discipline: string | null | undefined): PackDef[] {
  const key = discipline ?? "other";
  const rank = (p: PackDef) => {
    const mine = p.audience.includes(key);
    if (mine && p.id !== "digital") return 0;
    if (p.id === "digital") return mine ? 1 : 2;
    return 3;
  };
  return [...PACKS].sort((a, b) => rank(a) - rank(b));
}

/** Whether a pack was built for this branch (drives the "For your branch" label). */
export const isPackForBranch = (pack: PackDef, discipline: string | null | undefined): boolean => pack.audience.includes(discipline ?? "other");
