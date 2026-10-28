import type { CohortVaultAi, VaultAiAccess, VaultAiReason } from "@/types/vaultAi";

/**
 * The words for the Vault AI Interview's lock, kept in one place so the dashboard card, the sidebar chip, the page and the TPO's
 * roster can never describe the same student differently. The rule itself is the server's; this only phrases its answer.
 */

/** "1 day" / "45 days". */
export function daysPhrase(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

type LockView = Pick<VaultAiAccess, "state" | "reasons" | "days_remaining" | "readiness">;

/** What is still missing, most pressing first. */
function has(view: { reasons: VaultAiReason[] }, reason: VaultAiReason): boolean {
  return view.reasons.includes(reason);
}

/**
 * The text on the card's button while the interview is locked: the live countdown ("Unlocks in 45 days"), and once the wait is over
 * but readiness is short, what is left to do.
 */
export function unlockButtonLabel(view: LockView): string {
  if (view.state === "unavailable") return "Not available for your year";
  if (has(view, "year_not_set")) return "Waiting for your college to set your year";
  if (has(view, "waiting_period") && view.days_remaining !== null) return `Unlocks in ${daysPhrase(Math.max(1, view.days_remaining))}`;
  if (has(view, "waiting_period")) return "Unlocks after your waiting period";
  if (has(view, "readiness")) return `Reach ${view.readiness?.required ?? 60}% readiness to unlock`;
  return "Enter Vault AI Interview";
}

/** The short chip beside the sidebar item: "45d", or a plain lock when it is not a countdown. */
export function sidebarChip(view: LockView): string | null {
  if (has(view, "waiting_period") && view.days_remaining !== null) return `${Math.max(1, view.days_remaining)}d`;
  return null;
}

/** The sidebar item's tooltip. */
export function sidebarTitle(view: LockView): string {
  const label = unlockButtonLabel(view);
  return `Vault AI Interview — ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/** A line for the TPO's roster: where one student stands on the interview. */
export function cohortVaultAiLabel(v: CohortVaultAi | null | undefined): string {
  if (!v) return "—";
  if (v.state === "open") return "Unlocked";
  if (v.state === "unavailable") return "Not offered";
  if (v.reasons.includes("year_not_set")) return "Year not set";
  if (v.reasons.includes("waiting_period") && v.days_remaining !== null) return `Unlocks in ${daysPhrase(Math.max(1, v.days_remaining))}`;
  if (v.reasons.includes("readiness")) return `Needs ${v.readiness_required ?? 60}% readiness`;
  return "Locked";
}
