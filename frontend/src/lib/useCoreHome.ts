"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CoreHome } from "@/types/core";

/**
 * The student's Core Prep home (GET /core): whether Core Prep exists for them, their plan usage, mastery,
 * weak topics, tests and recent results. `home` is null until the first answer; `error` only for a real failure
 * (a student for whom Core Prep simply doesn't exist gets `{available: false}`, not an error).
 */
export function useCoreHome(enabled = true) {
  const [home, setHome] = useState<CoreHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHome(await api.get<CoreHome>("/core"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load Core Prep.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { home, error, loading, reload };
}
