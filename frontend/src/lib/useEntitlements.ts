"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/projectLab";
import type { Entitlements, MySubscriptionResponse } from "@/types/subscription";

/**
 * What the signed-in student's plan includes — the limits, the switches (Hack
 * Arena, Project Lab) and, on the free plan, how many of the one-time tries are
 * spent. `null` until the answer arrives, or for anyone without a student plan
 * (staff, a TPO), so callers can show nothing rather than a lock that flashes
 * and disappears.
 *
 * This only decides what the UI SHOWS. Every restricted action is refused again
 * by the server (HTTP 402 `plan_required` / `trial_used`), so a stale answer
 * here can at worst show a button that then explains why it didn't work.
 * Re-reads itself after anything that changes the plan (a purchase).
 */
export function useEntitlements(enabled = true): Entitlements | null {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  useEffect(() => {
    if (!enabled) {
      setEntitlements(null);
      return;
    }

    let cancelled = false;

    const load = () =>
      api
        .get<MySubscriptionResponse>("/me/subscription")
        .then((res) => {
          if (!cancelled) setEntitlements(res.entitlements ?? null);
        })
        .catch(() => {
          /* leave the last answer in place; the server still enforces everything */
        });

    load();
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, load);

    return () => {
      cancelled = true;
      window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, load);
    };
  }, [enabled]);

  return entitlements;
}
