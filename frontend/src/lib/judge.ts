import { api, ApiError } from "./api";

/**
 * Run/Submit no longer execute code inside the request. The API validates,
 * enqueues and answers at once with either the verdict (cache hit / no
 * queue) or a token; the verdict is then collected from GET /judge/{token}.
 * This wraps that whole exchange so callers still just `await` a result —
 * exactly the shape the old synchronous endpoints returned.
 *
 * Polling is deliberately gentle: 400ms, then backing off x1.5 up to 2s. A
 * typical judge takes 0.3-2s, so most runs cost 2-4 polls; when a whole class
 * submits at once the backoff is what keeps 1,000 browsers from turning the
 * wait into 1,000 requests/second.
 */

interface JudgeEnvelope<T> {
  state: "queued" | "running" | "done" | "error";
  token: string | null;
  position?: number;
  poll_after_ms?: number;
  http_status?: number;
  result?: T;
  message?: string;
}

export interface JudgeProgress {
  state: "queued" | "running";
  /** Approximate place in line when it was queued (1 = next up). */
  position?: number;
}

const MAX_WAIT_MS = 120_000;
const MAX_POLL_INTERVAL_MS = 2_000;
// The server may ask for longer than our own backoff cap when the queue is deep
// (see JudgeQueue::pollHint) — honour it, but never wait so long the UI feels dead.
const MAX_SERVER_HINT_MS = 5_000;
const MAX_CONSECUTIVE_POLL_FAILURES = 4;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function unwrapDone<T>(envelope: JudgeEnvelope<T>): T {
  const status = envelope.http_status ?? 200;

  if (status >= 400) {
    const message = (envelope.result as { message?: string } | undefined)?.message;
    throw new ApiError(message ?? "The judge could not run your code.", status);
  }

  return envelope.result as T;
}

export async function executeJudged<T>(
  path: string,
  body: unknown,
  onProgress?: (progress: JudgeProgress) => void
): Promise<T> {
  let envelope = await api.post<JudgeEnvelope<T>>(path, body);
  const deadline = Date.now() + MAX_WAIT_MS;
  let delay = envelope.poll_after_ms ?? 400;
  let failures = 0;

  for (;;) {
    if (envelope.state === "done") return unwrapDone(envelope);

    if (envelope.state === "error") {
      throw new ApiError(envelope.message ?? "The judge could not complete this run. Please try again.", 503);
    }

    if (!envelope.token) throw new ApiError("The judge returned an unexpected response. Please try again.", 502);

    if (Date.now() > deadline) {
      throw new ApiError("Judging is taking longer than usual. Your code is still queued — check back in a moment.", 504);
    }

    onProgress?.({ state: envelope.state, position: envelope.position });

    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.5), MAX_POLL_INTERVAL_MS);

    try {
      envelope = await api.get<JudgeEnvelope<T>>(`/judge/${envelope.token}`);
      failures = 0;
      if (envelope.poll_after_ms) delay = Math.max(delay, Math.min(envelope.poll_after_ms, MAX_SERVER_HINT_MS));
    } catch (err) {
      // 404 = expired/unknown, 4xx other than rate limiting = a real answer: stop.
      if (err instanceof ApiError && err.status !== 429 && err.status < 500) throw err;

      // Rate-limited or a transient network/5xx blip: keep the same token and try again.
      if (++failures >= MAX_CONSECUTIVE_POLL_FAILURES) {
        throw new ApiError("Lost contact with the judge. Please check your connection and try again.", 503);
      }
      delay = Math.max(delay, MAX_POLL_INTERVAL_MS);
    }
  }
}
