import { api } from "@/lib/api";
import type { ProblemDetail } from "@/types/problem";

/**
 * Starts fetching a contest problem the moment a student shows intent to open it (hovering, focusing or touching its row),
 * so the solve screen usually mounts with the problem already in hand instead of a skeleton. Same small, safe shape as
 * problemPrefetch.ts: a handful of entries, each good for 30 s, failures forgotten so the real screen retries for real.
 *
 * The endpoint only READS — it never starts a clock or records an "opened" mark — so fetching early changes nothing about the contest.
 */

type Payload = { problem: ProblemDetail; points: number };

const TTL_MS = 30_000;
const MAX_ENTRIES = 16;
const cache = new Map<string, { at: number; promise: Promise<Payload>; resolved?: Payload }>();

const keyOf = (slug: string, contestProblemId: string | number) => `${slug}:${contestProblemId}`;
const fresh = (entry: { at: number }) => Date.now() - entry.at < TTL_MS;
export const contestProblemPath = (slug: string, contestProblemId: string | number) => `/contests/${slug}/problems/${contestProblemId}`;

function request(slug: string, contestProblemId: string | number): Promise<Payload> {
  const key = keyOf(slug, contestProblemId);
  const entry: { at: number; promise: Promise<Payload>; resolved?: Payload } = {
    at: Date.now(),
    promise: api.get<Payload>(contestProblemPath(slug, contestProblemId)).then((res) => {
      entry.resolved = res;
      return res;
    }),
  };
  cache.set(key, entry);

  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }

  entry.promise.catch(() => {
    if (cache.get(key)?.promise === entry.promise) cache.delete(key);
  });

  return entry.promise;
}

/** Populate the cache immediately from bulk responses (e.g. `GET /contests/{slug}?include_details=1`). */
export function seedContestProblems(
  slug: string,
  items: Array<{ id: number | string; problem: ProblemDetail; points: number }> | undefined
): void {
  if (!slug || !items?.length) return;
  const now = Date.now();
  for (const item of items) {
    const key = keyOf(slug, item.id);
    const resolved: Payload = { problem: item.problem, points: item.points };
    cache.set(key, { at: now, promise: Promise.resolve(resolved), resolved });
  }
}

/** Synchronously reads a cached problem if already resolved — allows 0ms question toggles. */
export function peekContestProblem(slug: string, contestProblemId: string | number): Payload | null {
  if (!slug || !contestProblemId) return null;
  const hit = cache.get(keyOf(slug, contestProblemId));
  return hit && fresh(hit) && hit.resolved ? hit.resolved : null;
}

/** Fire and forget: warm the cache for a problem the student is about to open. */
export function prefetchContestProblem(slug: string, contestProblemId: string | number): void {
  if (!slug || !contestProblemId) return;
  const hit = cache.get(keyOf(slug, contestProblemId));
  if (hit && fresh(hit)) return;
  void request(slug, contestProblemId).catch(() => {});
}

/** The problem for the solve screen: the prefetched answer when there is a fresh one, otherwise a normal request. */
export function loadContestProblem(slug: string, contestProblemId: string | number): Promise<Payload> {
  const hit = cache.get(keyOf(slug, contestProblemId));
  return hit && fresh(hit) ? hit.promise : request(slug, contestProblemId);
}

/** Test seam. */
export function __resetContestProblemPrefetchForTests(): void {
  cache.clear();
}
