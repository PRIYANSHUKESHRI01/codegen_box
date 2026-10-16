import { languageLabel } from "./judgeLanguages";
import type { LanguageFinding, Proficiency } from "@/types/languageInsights";

/** How each proficiency reads on screen. Classes use the app-wide status tokens so the same pill works in the student and TPO portals. */
export const PROFICIENCY_META: Record<Proficiency, { label: string; className: string; bar: string }> = {
  strong: { label: "Strong", className: "bg-status-success/10 text-status-success", bar: "bg-status-success" },
  steady: { label: "Steady", className: "bg-accent-primary/10 text-accent-primary", bar: "bg-accent-primary" },
  needs_work: { label: "Needs work", className: "bg-status-danger/10 text-status-danger", bar: "bg-status-danger" },
  getting_started: { label: "Getting started", className: "bg-elevated text-text-muted", bar: "bg-text-muted" },
};

const FAILURE_LABEL: Record<NonNullable<LanguageFinding["dominant_failure"]>, string> = {
  wrong_answer: "wrong answers",
  runtime_error: "runtime errors",
  compile_error: "compile errors",
};

const KIND_TITLE: Record<LanguageFinding["kind"], string> = {
  low_acceptance: "Low acceptance",
  compile_errors: "Frequent compile errors",
  runtime_errors: "Frequent runtime errors",
  preferred_not_practiced: "Main language not practised",
};

export interface FindingCopy {
  title: string;
  /** What the numbers say — neutral wording, reads correctly to the student and to a TPO. */
  detail: string;
  /** What to do about it — shown to the student, not to staff. */
  advice: string;
}

/**
 * Turns a structured finding from the backend into words, with the same
 * language labels the code editor shows ("Python3", never "python"). Kept on the
 * frontend so labels live in exactly one place.
 */
export function describeFinding(finding: LanguageFinding): FindingCopy {
  const label = languageLabel(finding.language);
  const title = `${label} · ${KIND_TITLE[finding.kind]}`;

  switch (finding.kind) {
    case "low_acceptance": {
      const failure = finding.dominant_failure ? `, mostly ${FAILURE_LABEL[finding.dominant_failure]}` : "";
      const stronger = finding.stronger_language
        ? ` ${languageLabel(finding.stronger_language.language)} is at ${finding.stronger_language.acceptance_rate}%.`
        : "";
      return {
        title,
        detail: `Only ${finding.acceptance_rate}% of ${finding.attempts} ${label} submissions were accepted${failure}.${stronger}`,
        advice: `Re-solve a few problems you missed in ${label}, then compare with an accepted solution to see where the approach differed.`,
      };
    }
    case "compile_errors":
      return {
        title,
        detail: `${finding.compile_error_share}% of ${finding.attempts} ${label} submissions failed to compile — syntax and tooling are still slowing things down.`,
        advice: `Revise ${label}'s syntax and input/output basics, and run your code on the sample cases before submitting.`,
      };
    case "runtime_errors":
      return {
        title,
        detail: `${finding.runtime_error_share}% of ${finding.attempts} ${label} submissions crashed at runtime.`,
        advice: `Test empty input, a single element and the largest allowed values before submitting — most crashes come from edge cases.`,
      };
    case "preferred_not_practiced":
      return {
        title,
        detail: `${label} is listed as the main language, but nothing has been submitted in it yet.`,
        advice: `Solve your next few problems in ${label} so it becomes the language you're fastest in.`,
      };
  }
}

/** "Python3 · Java · C++" — a short, readable list, with an overflow count past `max`. */
export function languageList(ids: readonly string[], max = 3): string {
  const shown = ids.slice(0, max).map(languageLabel);
  const extra = ids.length - shown.length;
  return extra > 0 ? `${shown.join(" · ")} +${extra}` : shown.join(" · ");
}

/** Whole days since an ISO timestamp, or null when there isn't one — for "3 days ago" copy. */
export function daysAgo(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000));
}

/** "today", "yesterday", "5 days ago", "3 weeks ago", "2 months ago". */
export function relativeDays(days: number | null): string {
  if (days === null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}
