import { getCachedBranchCatalog, useBranchCatalog, type Discipline } from "@/lib/branches";
import type { CoreDifficulty, CoreDiscipline, CoreQuestionFlag, CoreStatus, CoreType, CoreUsage } from "@/types/core";

const ENGINEERING_LABELS: Record<string, [string, string]> = {
  ece: ["Electronics & Communication", "ECE"],
  eee: ["Electrical & Electronics", "EEE"],
  mech: ["Mechanical", "Mech"],
  civil: ["Civil", "Civil"],
};

/**
 * A discipline's name / short name by code. Read from the branch catalogue once it has loaded (so every department's families are
 * covered), with the four engineering names as a fallback; a code we know nothing about is shown as itself rather than blank.
 */
const lookup = (index: 0 | 1) =>
  new Proxy({} as Record<CoreDiscipline, string>, {
    get: (_t, code) => {
      if (typeof code !== "string") return undefined;
      const found = getCachedBranchCatalog()?.disciplines.find((d) => d.code === code);
      return (index === 0 ? found?.name : found?.short) ?? ENGINEERING_LABELS[code]?.[index] ?? code;
    },
  });

export const DISCIPLINE_LABEL: Record<CoreDiscipline, string> = lookup(0);

export const DISCIPLINE_SHORT: Record<CoreDiscipline, string> = lookup(1);

/** Every discipline that has Domain Prep, in catalogue order, with its department — what the Ops console lets staff write questions for. */
export function useCoreDisciplines(): (Pick<Discipline, "code" | "name" | "short"> & { department: string })[] {
  const catalog = useBranchCatalog();
  const rows = (catalog?.disciplines ?? []).filter((d) => d.domain_prep ?? ["ece", "eee", "mech", "civil"].includes(d.code));

  return rows.length > 0
    ? rows.map((d) => ({ code: d.code, name: d.name, short: d.short, department: d.department ?? "engineering" }))
    : Object.entries(ENGINEERING_LABELS).map(([code, [name, short]]) => ({ code, name, short, department: "engineering" }));
}

export const TYPE_LABEL: Record<CoreType, string> = {
  mcq_single: "Single answer",
  mcq_multi: "Multiple answers",
  numeric: "Numerical",
};

export const TYPE_HINT: Record<CoreType, string> = {
  mcq_single: "Exactly one option is correct",
  mcq_multi: "One or more options are correct (MSQ)",
  numeric: "The answer is a number, accepted inside a range (NAT)",
};

export const STATUS_LABEL: Record<CoreStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  retired: "Retired",
};

export const STATUS_BADGE: Record<CoreStatus, string> = {
  draft: "bg-elevated text-text-muted",
  in_review: "bg-status-warning/15 text-status-warning",
  published: "bg-status-success/15 text-status-success",
  retired: "bg-status-danger/10 text-status-danger",
};

export const FLAG_LABEL: Record<CoreQuestionFlag, string> = {
  too_easy: "Too easy",
  too_hard: "Too hard",
  low_discrimination: "Doesn't separate strong from weak",
  negative_discrimination: "Strong students get it wrong",
  suspected_key: "Key looks wrong",
};

export const DIFFICULTY_BADGE: Record<CoreDifficulty, string> = {
  easy: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  hard: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export const USAGE_LABEL: Record<CoreUsage, string> = {
  practice: "Practice only",
  test: "Tests only",
  both: "Practice & tests",
};

export const USAGE_HINT: Record<CoreUsage, string> = {
  practice: "Shown with the answer and explanation after each try",
  test: "Only inside timed tests — never revealed by practice",
  both: "Can appear in practice and in tests",
};

/** The usual negative-marking schemes, as one-click presets (GATE uses ⅓ for 1-mark and ⅔ for 2-mark questions). */
export const NEGATIVE_PRESETS: { label: string; of: number }[] = [
  { label: "None", of: 0 },
  { label: "¼ of marks", of: 0.25 },
  { label: "⅓ of marks", of: 1 / 3 },
  { label: "½ of marks", of: 0.5 },
];

export function negativeFor(marks: number, fraction: number): number {
  return Math.round(marks * fraction * 100) / 100;
}

/** "ECE-ANA-0001 · Analog Circuits › Oscillators" — how a question is identified in lists. */
export function questionLabel(q: { external_id: string | null; id: number }): string {
  return q.external_id ?? `#${q.id}`;
}

/** First line of a stem as plain text for list rows (maths shown as written, markdown markers dropped). */
export function plainPreview(stem: string, max = 140): string {
  const flat = stem.replace(/\s+/g, " ").replace(/[*_`#>]/g, "").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
