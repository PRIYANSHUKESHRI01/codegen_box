import { api } from "@/lib/api";
import type { RecentAnswer } from "./mastery";
import type { DrillAttempt } from "./session";

export interface DrillSkillStats {
  attempts: number;
  correct: number;
  last_at: string;
  /** Newest first. */
  recent: RecentAnswer[];
}

export interface DrillStreak {
  current: number;
  best: number;
  active_today: boolean;
  /** Answers given today. */
  today: number;
}

export interface DrillSummary {
  skills: Record<string, DrillSkillStats>;
  streak: DrillStreak;
  week: { attempts: number; days: number };
}

export const EMPTY_SUMMARY: DrillSummary = { skills: {}, streak: { current: 0, best: 0, active_today: false, today: 0 }, week: { attempts: 0, days: 0 } };

export const fetchDrillSummary = () => api.get<DrillSummary>("/me/drills");

/** The API takes at most 25 answers per request. */
const BATCH = 25;
const STORAGE_KEY = "aptrun.drills.pending.v1";

/**
 * Answers wait here until the server has them. They are mirrored to localStorage so that closing the tab, losing the connection or a failed
 * request does not lose a student's practice; the next flush (any later drill visit) sends them. Storage can be unavailable — then the
 * queue just lives in memory.
 */
let pending: DrillAttempt[] = readStored();
let flushing: Promise<void> | null = null;

function readStored(): DrillAttempt[] {
  try {
    if (typeof window === "undefined") return [];
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isAttempt) : [];
  } catch {
    return [];
  }
}

function isAttempt(x: unknown): x is DrillAttempt {
  const a = x as DrillAttempt;
  return !!a && typeof a.pack === "string" && typeof a.skill === "string" && [1, 2, 3].includes(a.difficulty) && typeof a.correct === "boolean";
}

/** Answers the server will never accept (the sitting is locked, gone or not ours): retrying only clogs the queue, so they are dropped. */
function isPermanentRefusal(error: unknown): boolean {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && [403, 404, 409, 422, 423, 428].includes(status);
}

function persist() {
  try {
    if (typeof window === "undefined") return;
    if (pending.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: memory only */
  }
}

export const pendingAttemptCount = () => pending.length;

/** Queues an answer. Send it with {@link flushAttempts}. */
export function queueAttempt(attempt: DrillAttempt) {
  pending.push({ ...attempt, seconds: Math.max(0, Math.min(900, Math.round(attempt.seconds))) });
  persist();
}

/**
 * Sends everything queued, a batch at a time (a batch is a run of answers from one sitting). Never throws: after a failure that may pass
 * (network, server error) the answers stay queued for the next try; after one that never will (see isPermanentRefusal) that batch is
 * dropped. `keepalive` lets the last request survive a page being closed.
 */
export function flushAttempts(options: { keepalive?: boolean } = {}): Promise<void> {
  if (flushing) return flushing;
  if (pending.length === 0) return Promise.resolve();

  flushing = (async () => {
    try {
      while (pending.length > 0) {
        const sitting = pending[0].sitting_id ?? null;
        let size = 1;
        while (size < BATCH && size < pending.length && (pending[size].sitting_id ?? null) === sitting) size++;
        const batch = pending.slice(0, size);

        try {
          await api.post(
            "/me/drills/attempts",
            { sitting_id: sitting, attempts: batch.map(({ sitting_id: _unused, ...answer }) => answer) },
            options.keepalive ? { keepalive: true } : undefined
          );
        } catch (error) {
          if (!isPermanentRefusal(error)) throw error;
        }

        pending = pending.slice(size);
        persist();
      }
    } catch {
      /* keep the rest queued */
    } finally {
      flushing = null;
    }
  })();

  return flushing;
}

/** Test seam: forget the queue. */
export function resetPendingAttempts() {
  pending = [];
  flushing = null;
  persist();
}
