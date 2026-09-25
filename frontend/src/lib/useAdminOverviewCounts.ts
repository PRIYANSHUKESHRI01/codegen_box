"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { AdminOverview } from "@/types/adminOverview";

/**
 * Real segment counts for Mellow Ops — shared by the Overview tab and the
 * sidebar's own badges (Partner Colleges/Problem Bank), so a nav badge
 * never shows a different number than the tab it links to. Mirrors
 * useMyStats's plain per-consumer hook shape rather than a global context —
 * this payload is cheap enough to fetch wherever it's needed.
 */
export function useAdminOverviewCounts(enabled: boolean = true) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<AdminOverview>("/admin/overview");
      setOverview(res);
    } catch {
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { overview, loading, reload };
}
