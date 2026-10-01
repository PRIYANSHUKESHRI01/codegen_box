import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple Tailwind CSS classes cleanly resolving conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Waits for `promise`, but never resolves sooner than `ms` — used to give a
 * real network call a floor on how briefly its own loading state can be
 * visible. Nothing here is fabricated: the fetch genuinely happens and its
 * real result/error still comes through unchanged; this only stops a
 * request that happens to resolve in 20ms on localhost from flashing a
 * spinner open and shut, which reads as broken rather than deliberate. On
 * a slower connection the real fetch time simply dominates and this adds
 * nothing.
 */
export function withMinDelay<T>(promise: Promise<T>, ms: number): Promise<T> {
  const floor = new Promise<void>((resolve) => setTimeout(resolve, ms));
  return Promise.all([promise, floor]).then(([result]) => result);
}

/**
 * Time-of-day greeting, shared across every role's dashboard header so a
 * personalized welcome ("Good evening, Dr. Sharma") is used consistently
 * instead of each page restating its own portal name as the page heading.
 */
export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Filter problems array based on search term, difficulty filter, and optional tag.
 */
export function filterProblems<T extends { title: string; difficulty: string; tags: string[]; description?: string }>(
  problems: T[],
  searchQuery: string,
  difficultyFilter: string,
  selectedTag?: string
): T[] {
  const query = searchQuery.trim().toLowerCase();
  
  return problems.filter((problem) => {
    // Difficulty match
    if (difficultyFilter !== "All" && problem.difficulty.toLowerCase() !== difficultyFilter.toLowerCase()) {
      return false;
    }

    // Tag match
    if (selectedTag && selectedTag !== "All" && !problem.tags.includes(selectedTag)) {
      return false;
    }

    // Search query match in title, tags, or description
    if (query) {
      const matchTitle = problem.title.toLowerCase().includes(query);
      const matchTags = problem.tags.some((t) => t.toLowerCase().includes(query));
      const matchDesc = problem.description ? problem.description.toLowerCase().includes(query) : false;
      return matchTitle || matchTags || matchDesc;
    }

    return true;
  });
}
