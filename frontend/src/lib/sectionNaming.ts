import type { BranchCatalog } from "@/lib/branches";
import type { CohortStudent } from "@/types/cohort";

/**
 * How a college's sections are named. A TPO who is looking at the CSE students and files some of them in a new section should not
 * have to type "CSE_" every time (and should not end up with "A" next to "CSE_A"), so the section box starts with the branch as its
 * prefix: `CSE_` -> they type the letter -> `CSE_A`.
 *
 * Pure functions, no React: the rules live here so they can be tested once.
 */

export const SECTION_MAX_LENGTH = 20;

/** "cse" -> "CSE_", "mech" -> "MECH_": the family's own short code (its label, "CSE / IT", is a sentence, not a name). Null for "other"/unknown. */
export function prefixForDiscipline(_catalog: BranchCatalog | null, discipline: string | null | undefined): string | null {
  if (!discipline || discipline === "other") return null;

  const clean = discipline.toUpperCase().replace(/[^A-Z0-9]+/g, "");

  return clean.length > 0 && clean.length <= 8 ? `${clean}_` : null;
}

/** One specific branch: its own short name ("IT" -> "IT_", "CSE-AIML" -> "CSE-AIML_"), falling back to its family's code. */
export function prefixForBranch(catalog: BranchCatalog | null, branchCode: string | null | undefined): string | null {
  const branch = catalog?.branches.find((b) => b.code === branchCode);
  if (!branch) return null;

  const clean = branch.short.toUpperCase().replace(/[^A-Z0-9-]+/g, "").replace(/^-+|-+$/g, "");

  return clean.length > 0 && clean.length <= 10 ? `${clean}_` : prefixForDiscipline(catalog, branch.discipline);
}

/**
 * The prefix for a new section, from what the TPO is looking at:
 *   1. the branch they have filtered the roster to (a whole family -> "CSE_", one branch of it -> that branch's own short name), else
 *   2. the one branch family every selected student belongs to.
 * Several families at once (a mixed selection, or "All branches" with nothing narrowing it) give null.
 */
export function sectionPrefix(catalog: BranchCatalog | null, branchFilter: string, selected: readonly Pick<CohortStudent, "discipline">[]): string | null {
  if (branchFilter.startsWith("family:")) return prefixForDiscipline(catalog, branchFilter.slice("family:".length));
  if (branchFilter.startsWith("code:")) return prefixForBranch(catalog, branchFilter.slice("code:".length));

  const families = new Set(selected.map((s) => s.discipline ?? ""));
  if (families.size === 1) return prefixForDiscipline(catalog, Array.from(families)[0]);

  return null;
}

/** Sections that already start with the prefix, case-insensitively: the ones the TPO is most likely to be adding to. */
export function sectionsWithPrefix(existing: readonly string[], prefix: string | null): string[] {
  if (!prefix) return [];
  const p = prefix.toLowerCase();

  return existing.filter((s) => s.toLowerCase().startsWith(p)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** The next free letter after the sections already there: CSE_A, CSE_B exist -> "CSE_C". Null when the prefix is missing or A–Z is used up. */
export function nextSectionName(existing: readonly string[], prefix: string | null): string | null {
  if (!prefix) return null;

  const taken = new Set(sectionsWithPrefix(existing, prefix).map((s) => s.slice(prefix.length).trim().toUpperCase()));

  for (let code = 65; code <= 90; code++) {
    const letter = String.fromCharCode(code);
    if (!taken.has(letter)) return `${prefix}${letter}`;
  }

  return null;
}

/** A section box that still holds only the prefix has not been filled in: treat it as empty (never save a section called "CSE_"). */
export function isPrefixOnly(value: string, prefix: string | null): boolean {
  return !!prefix && value.trim().toLowerCase() === prefix.toLowerCase();
}

/** What to save: trimmed, with the prefix upper-cased the way it was offered ("cse_a" typed by hand -> "CSE_a" would be wrong, so only a matching prefix is normalised). */
export function cleanSectionInput(value: string, prefix: string | null): string {
  const trimmed = value.trim();

  if (prefix && trimmed.length > prefix.length && trimmed.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase()) {
    return prefix + trimmed.slice(prefix.length);
  }

  return trimmed;
}
