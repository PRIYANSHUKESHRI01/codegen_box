"use client";

import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * The only two unauthenticated reads in the whole app — real numbers/real
 * problems for the public marketing landing page (Stats, Problem Explorer,
 * the navbar's ⌘K search). See backend PublicController for exactly what's
 * safe to expose. Shared here so all three consumers can never drift out of
 * sync with each other the way the old hardcoded per-section fake data did.
 */
export interface PublicStats {
  problems_total: number;
  problems_easy: number;
  problems_medium: number;
  problems_hard: number;
  topics_total: number;
  test_cases_total: number;
  languages_total: number;
}

export interface PublicSampleProblem {
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export function usePublicStats(): PublicStats | null {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    api
      .get<PublicStats>("/public/stats")
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  return stats;
}

export function usePublicSampleProblems(): { problems: PublicSampleProblem[]; loading: boolean } {
  const [problems, setProblems] = useState<PublicSampleProblem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ problems: PublicSampleProblem[] }>("/public/problems/sample")
      .then((res) => setProblems(res.problems))
      .catch(() => setProblems([]))
      .finally(() => setLoading(false));
  }, []);

  return { problems, loading };
}
