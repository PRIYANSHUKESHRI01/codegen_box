import { api } from "@/lib/api";
import type { ProblemDetail } from "@/types/problem";

/**
 * Starts fetching a problem the moment a student shows intent to open it (hovering,
 * focusing or touching its Solve button), so by the time the solve screen mounts the
 * answer is usually already here and the screen opens with the problem on it instead
 * of a skeleton.
 *
 * Kept deliberately small and safe:
 *  - at most a handful of entries, each good for 30 s — long enough to bridge a click,
 *    short enough that a stale "solved" flag never outlives the next visit;
 *  - a failed prefetch is forgotten, so the solve screen retries for real and shows the
 *    real error rather than a cached one;
 *  - a submission that changes the problem's state calls invalidateProblem().
 */

type Detail = { problem: ProblemDetail };

const TTL_MS = 30_000;
const MAX_ENTRIES = 8;

const cache = new Map<string, { at: number; promise: Promise<Detail> }>();

const fresh = (entry: { at: number }) => Date.now() - entry.at < TTL_MS;

function request(slug: string): Promise<Detail> {
  const promise = api.get<Detail>(`/problems/${slug}`);
  cache.set(slug, { at: Date.now(), promise });

  // The oldest entry goes first once there are too many.
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }

  // A failure must not be served to the screen that actually needs the problem.
  promise.catch(() => {
    if (cache.get(slug)?.promise === promise) cache.delete(slug);
  });

  return promise;
}

/** Fire and forget: warm the cache for a problem the student is about to open. */
export function prefetchProblem(slug: string): void {
  if (!slug) return;
  const hit = cache.get(slug);
  if (hit && fresh(hit)) return;
  void request(slug).catch(() => {});
}

/** The problem for the solve screen: the prefetched answer when there is a fresh one, otherwise a normal request. */
export function loadProblem(slug: string): Promise<Detail> {
  const hit = cache.get(slug);
  return hit && fresh(hit) ? hit.promise : request(slug);
}

/** Forget what we know about a problem (its solved flag just changed). */
export function invalidateProblem(slug: string): void {
  cache.delete(slug);
}

/** Test seam. */
export function __resetProblemPrefetchForTests(): void {
  cache.clear();
}
