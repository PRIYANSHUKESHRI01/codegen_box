/**
 * Carries an attempt's live resources across in-app page changes.
 *
 * A contest has a page per problem, and moving from problem 1 to problem 2 unmounts one page and mounts the next inside
 * the same browser tab. If the camera and the shared screen were closed on unmount and re-requested on mount, the student
 * would be asked to pick their screen again at every problem — and each re-prompt is a window in which the share is off.
 * So an unmounting engine parks its streams here for a few seconds; an engine that mounts in that window with the same
 * key (same contest) and the same signed-in user takes them over. If nobody claims them they are released.
 *
 * The key is per attempt-group (`contest:<slug>`, or the full base path for everything else) and per user, so nothing
 * can ever be handed to a different person or a different exam.
 */

export interface KeptAttempt {
  userKey: string;
  camera: MediaStream | null;
  screen: MediaStream | null;
  /** The page-instance id the server already knows for this attempt: reusing it means "the same tab", not "a takeover". */
  instance: string;
  deviceId: { did: string; fp: string } | null;
  /** Stop everything the entry holds. */
  release: () => void;
  /**
   * Nobody took the entry over within a moment: the student has left the attempt's pages (not just moved to the next
   * problem). The streams are kept for the longer grace period in case they come straight back, but fullscreen should not
   * be left on a page that is no longer an exam.
   */
  onUnclaimed?: () => void;
}

const GRACE_MS = 20_000;
const UNCLAIMED_MS = 1_500;

const parked = new Map<string, { entry: KeptAttempt; timer: number; quick: number }>();

export function park(key: string, entry: KeptAttempt): void {
  discard(key);
  const timer = window.setTimeout(() => {
    parked.delete(key);
    entry.release();
  }, GRACE_MS);
  const quick = window.setTimeout(() => entry.onUnclaimed?.(), UNCLAIMED_MS);
  parked.set(key, { entry, timer, quick });
}

/** Takes the parked resources for `key` if they are this user's, still live, and not yet expired. */
export function claim(key: string, userKey: string): KeptAttempt | null {
  const hit = parked.get(key);
  if (!hit) return null;

  window.clearTimeout(hit.timer);
  window.clearTimeout(hit.quick);
  parked.delete(key);

  if (hit.entry.userKey !== userKey) {
    hit.entry.release();

    return null;
  }

  return hit.entry;
}

/** Drops and releases whatever is parked under `key`. */
export function discard(key: string): void {
  const hit = parked.get(key);
  if (!hit) return;
  window.clearTimeout(hit.timer);
  window.clearTimeout(hit.quick);
  parked.delete(key);
  hit.entry.release();
}

/** For tests. */
export function parkedCount(): number {
  return parked.size;
}
