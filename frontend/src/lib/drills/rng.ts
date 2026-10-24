/**
 * A small seeded random generator (mulberry32). Every drill question is a pure function of (skill, level, seed), so a question can be
 * regenerated exactly from its id, tests are reproducible, and nothing needs to be stored on a server.
 */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** A new array with the items in random order. */
  shuffle<T>(items: readonly T[]): T[];
  chance(probability: number): boolean;
  /** `count` distinct items. */
  sample<T>(items: readonly T[], count: number): T[];
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T,>(items: readonly T[]): T => items[int(0, items.length - 1)];
  const shuffle = <T,>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };

  return { next, int, pick, shuffle, chance: (p) => next() < p, sample: (items, count) => shuffle(items).slice(0, count) };
}

/** A fresh seed for a new question. */
export function randomSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 4294967296);
}
