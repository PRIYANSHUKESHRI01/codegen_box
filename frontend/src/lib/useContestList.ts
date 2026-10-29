"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ContestSummary } from "@/types/liveContest";

/**
 * The contests the signed-in student can see (`GET /contests`), loaded once `enabled` turns true. A programme without contests
 * never enables it - the server would answer 403 - so `loading` is false from the start in that case.
 */
export function useContestList(enabled: boolean): { contests: ContestSummary[]; loading: boolean } {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .get<{ contests: ContestSummary[] }>("/contests")
      .then((res) => {
        if (!cancelled) setContests(res.contests);
      })
      .catch(() => {
        if (!cancelled) setContests([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { contests, loading };
}
