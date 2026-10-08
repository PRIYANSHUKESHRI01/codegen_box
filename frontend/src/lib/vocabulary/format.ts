import type { VocabularyKind, VocabularyQuestion } from "@/types/learningCentre";

const SESSION_PATH = "/dashboard/learning-centre/vocabulary/session";

/** The URL for starting (or opening) a practice session. */
export function sessionHref(opts: { kind: VocabularyKind; deck?: string | null; attemptId?: number | null; from?: number | null }): string {
  const params = new URLSearchParams();
  if (opts.attemptId) {
    params.set("attemptId", String(opts.attemptId));
  } else {
    params.set("kind", opts.kind);
    if (opts.deck) params.set("deck", opts.deck);
    if (opts.from) params.set("from", String(opts.from));
  }
  return `${SESSION_PATH}?${params.toString()}`;
}

export interface TextPart {
  text: string;
  hit: boolean;
}

// Built at runtime: the project type-checks against an ES5 target, which rejects a literal /u flag.
const WORD_CHAR = new RegExp("[\\p{L}\\p{N}]", "u");

/**
 * Splits a sentence around the first whole-word occurrence of `word`
 * (case-insensitive, a space in a phrase matches any run of whitespace), so
 * the example can show the word in bold. Without a match the whole sentence
 * comes back as one plain part. Boundaries are checked by hand rather than
 * with lookbehind, which older Safari does not support.
 */
export function splitAroundWord(sentence: string, word: string): TextPart[] {
  const trimmed = word.trim();
  if (!trimmed) return [{ text: sentence, hit: false }];

  const pattern = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "giu");

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sentence)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const before = start > 0 ? sentence[start - 1] : "";
    const after = end < sentence.length ? sentence[end] : "";
    if ((before && WORD_CHAR.test(before)) || (after && WORD_CHAR.test(after))) {
      if (match[0].length === 0) pattern.lastIndex++;
      continue;
    }

    const parts: TextPart[] = [];
    if (start > 0) parts.push({ text: sentence.slice(0, start), hit: false });
    parts.push({ text: match[0], hit: true });
    if (end < sentence.length) parts.push({ text: sentence.slice(end), hit: false });
    return parts;
  }

  return [{ text: sentence, hit: false }];
}

/** "8 letters" or "2 words · 8 letters" — under the hint for a typed answer. */
export function letterCountLabel(q: Pick<VocabularyQuestion, "letters" | "word_count">): string {
  const letters = q.letters ?? 0;
  const words = q.word_count ?? 1;
  const l = `${letters} letter${letters === 1 ? "" : "s"}`;
  return words > 1 ? `${words} words · ${l}` : l;
}

/** "45 sec" under a minute, "2 min 10 sec" above. */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s === 0 ? `${m} min` : `${m} min ${s} sec`;
}

/** How many of the six memory boxes are lit for a word, 0 for a word never answered. */
export function strengthLevel(box: number | null | undefined): number {
  if (box === null || box === undefined) return 0;
  return Math.max(0, Math.min(5, box)) + 1;
}

/** Human title for a session kind, used where the server's own title is not at hand. */
export function kindLabel(kind: VocabularyKind): string {
  return { daily: "Today’s sprint", deck: "Deck sprint", weak: "Weak words", custom: "Quick quiz" }[kind];
}

/** Share of a total that is done, 0–100, safe for a total of zero. */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((100 * part) / total) : 0;
}

/** A warm one-line verdict for the end-of-session screen. */
export function verdictFor(score: number): { headline: string; tone: "great" | "good" | "keep" } {
  if (score >= 90) return { headline: "Excellent session", tone: "great" };
  if (score >= 70) return { headline: "Good work", tone: "good" };
  return { headline: "These words are still settling in", tone: "keep" };
}
