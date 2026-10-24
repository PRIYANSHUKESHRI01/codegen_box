import { isCoreDiscipline } from "@/lib/branches";

export type HomeLayout = "software" | "balanced" | "core" | "general";

/**
 * Which home a student lands on. Pure and conservative: anything unknown — no branch yet, a CSE student, a branch
 * whose Core Prep is not live, a track not chosen, or an older cached user object — is the software home, the
 * dashboard that has always existed, so nobody ever sees a layout they did not ask for.
 *
 *  • a programme with no coding practice at all (Management, Commerce, Arts …)  → general: a home with no ratings, problems or contests
 *  • core family + Core Prep available + "core first"  → core
 *  • core family + Core Prep available + "balanced"    → balanced (the usual home with the Core summary on top)
 *  • everything else, including "IT first"             → software
 */
export function resolveHomeLayout(input: { discipline?: string | null; trackFocus?: string | null; coreAvailable?: boolean; codes?: boolean }): HomeLayout {
  if (input.codes === false) return "general";
  if (!isCoreDiscipline(input.discipline) || !input.coreAvailable) return "software";
  if (input.trackFocus === "core_first") return "core";
  if (input.trackFocus === "balanced") return "balanced";
  return "software";
}

/** Whether the page must wait for the Core Prep answer before choosing (so a core student never sees the wrong home flash). */
export function needsCoreCheck(discipline?: string | null): boolean {
  return isCoreDiscipline(discipline);
}
