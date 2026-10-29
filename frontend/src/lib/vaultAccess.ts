import type { StudentVaultResponse } from "@/types/vault";

/** Where a student with access goes. Opened in a new tab: Mellow Vault is a separate product with its own sign-in. */
export const MELLOW_VAULT_URL = "https://mellowvault.com/developer_admin";

/**
 * Whether the Mellow Vault door is open for a student, and if not, why. One answer, read by the button, the hero and the page's
 * ordering, so they can never disagree.
 *
 *  • open            - the readiness score has cleared the Vault line and the plan includes the Vault.
 *  • locked / score  - below the line. The page explains how the Vault helps and how far there is to go.
 *  • locked / plan   - the score qualifies but the plan does not include the Vault (the server refuses it too - HTTP 402).
 *  • locked / review - Mellow staff are holding the profile; nothing about the score or the choices is lost.
 *
 * A student who is already listed, or already hired, counts as past the line even if the score has dipped between the exit
 * and the entry threshold (the server's hysteresis: in at 60, out only below 55) - the page must not lock someone out who is in.
 */
export type VaultDoor = { state: "open" } | { state: "locked"; reason: "score" | "plan" | "review"; pointsNeeded: number };

export function vaultDoor(data: Pick<StudentVaultResponse, "readiness" | "access" | "profile">): VaultDoor {
  const status = data.profile?.status;
  const pointsNeeded = Math.max(0, data.readiness.points_needed);

  if (status === "hidden_by_mellow") return { state: "locked", reason: "review", pointsNeeded };

  const pastTheLine = pointsNeeded === 0 || status === "visible" || status === "hired";
  if (!pastTheLine) return { state: "locked", reason: "score", pointsNeeded };

  // A hire is worth celebrating whatever the plan; everything else needs a plan that includes the Vault.
  if (!data.access && status !== "hired") return { state: "locked", reason: "plan", pointsNeeded: 0 };

  return { state: "open" };
}
