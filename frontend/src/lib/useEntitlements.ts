"use client";

import { useMyPlan } from "@/lib/useMyPlan";
import type { Entitlements } from "@/types/subscription";

/**
 * What the signed-in student's plan includes — reads from the shared `useMyPlan`
 * module store so sidebar, header PlanChip, and page-level gates never trigger
 * duplicate GET /me/subscription requests on mount or navigation.
 */
export function useEntitlements(enabled = true): Entitlements | null {
  const { plan } = useMyPlan(enabled);
  return enabled ? (plan?.entitlements ?? null) : null;
}
