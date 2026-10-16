"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { LanguageInsights } from "@/types/languageInsights";

/**
 * The signed-in student's own language breakdown (GET /me/language-insights) —
 * which language they really solve in, how it's going in each, where to improve.
 * A plain per-page hook, same shape as useMyStats, because the payload is small
 * and only the dashboard and performance report ask for it. `refreshKey` is any
 * string that changes when the answer should be fetched again — the card passes
 * the student's saved preferences, so finishing onboarding while the page is open
 * replaces "Not answered yet" with what they just said.
 */
export function useLanguageInsights(enabled: boolean = true, refreshKey: string = "") {
  const [insights, setInsights] = useState<LanguageInsights | null>(null);
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
      setInsights(await api.get<LanguageInsights>("/me/language-insights"));
    } catch {
      setError("Couldn't load your language breakdown.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refreshKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { insights, loading, error, reload };
}
