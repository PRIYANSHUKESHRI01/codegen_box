"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { LearningCentreOverview } from "@/types/learningCentre";

/** Powers the Learning Centre hub's header stats strip. Mirrors useAdminOverviewCounts's plain per-consumer hook shape. */
export function useLearningCentreOverview() {
  const [overview, setOverview] = useState<LearningCentreOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<LearningCentreOverview>("/learning-centre/overview");
      setOverview(res);
    } catch {
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { overview, loading, reload };
}
