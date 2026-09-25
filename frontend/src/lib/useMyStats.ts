"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { MyStats } from "@/types/studentStats";

/**
 * Real solved-count/streak/topic-mastery/etc for the signed-in student —
 * shared by the dashboard, performance report, and practice pages so they
 * never independently re-derive (or worse, re-fabricate) the same numbers.
 * A plain per-page hook (matching this codebase's existing loadX()
 * useCallback+useEffect pattern), not a global context — the payload is
 * cheap enough to refetch per page.
 */
export function useMyStats(enabled: boolean = true) {
  const [stats, setStats] = useState<MyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<MyStats>("/me/stats");
      setStats(res);
    } catch {
      setError("Failed to load your stats.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { stats, loading, error, reload };
}
