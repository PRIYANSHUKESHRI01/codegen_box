"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SUBSCRIPTION_CHANGED_EVENT } from "@/lib/projectLab";
import type { MySubscriptionResponse } from "@/types/subscription";

export interface MyPlanState {
  /** The last answer, or null until the first one arrives (and for anyone who has no plan of their own to show). */
  plan: MySubscriptionResponse | null;
  loading: boolean;
  /** Fetch again now. */
  refresh: () => Promise<void>;
}

/**
 * The signed-in account's plan (GET /me/subscription), kept current: it re-reads
 * itself whenever anything announces a plan change — a purchase on this page, or
 * lib/planSync noticing that a superadmin changed it — so a chip or card built on
 * it never shows a plan the account no longer has.
 *
 * `enabled` false (staff, a role with no plan chip) makes no request at all.
 * Like useEntitlements, this only decides what the UI SHOWS; the server refuses
 * anything the plan doesn't include whatever the screen thinks.
 */
export function useMyPlan(enabled = true): MyPlanState {
  const [plan, setPlan] = useState<MySubscriptionResponse | null>(null);
  const [loading, setLoading] = useState(enabled);

  const load = useCallback(async () => {
    try {
      setPlan(await api.get<MySubscriptionResponse>("/me/subscription"));
    } catch {
      /* keep the last answer; the server still enforces everything */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPlan(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const run = () => {
      if (!cancelled) void load();
    };

    run();
    window.addEventListener(SUBSCRIPTION_CHANGED_EVENT, run);

    return () => {
      cancelled = true;
      window.removeEventListener(SUBSCRIPTION_CHANGED_EVENT, run);
    };
  }, [enabled, load]);

  return { plan, loading, refresh: load };
}
