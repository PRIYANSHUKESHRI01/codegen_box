"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { EMPTY_SUMMARY, fetchDrillSummary, flushAttempts, type DrillSummary } from "./api";

/**
 * The student's drill picture (GET /me/drills): per-skill history for mastery, the day streak, this week. Answers still waiting to be sent
 * (an earlier tab closed mid-session, a dropped connection) are sent first, so what is shown includes them.
 * `summary` is never null once loaded; if the request fails the page can still run on an empty one, and `error` says why.
 */
export function useDrillSummary(enabled = true) {
  const [summary, setSummary] = useState<DrillSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await flushAttempts();
      setSummary(await fetchDrillSummary());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load your progress.");
      setSummary((current) => current ?? EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { summary, error, loading, reload };
}
