import { ApiError } from "@/lib/api";
import type { BatchAck, IntegrityEvent, WebEventType } from "./types";

/**
 * The page's side of the telemetry channel: batches of events, sent one at a time so the server's rotating nonce and
 * batch counter stay in lock-step. The server treats silence as a finding and refuses answers when no batch has been
 * acknowledged recently, so this is built to keep trying — and to say so honestly (`secondsSinceAck`) when it cannot.
 *
 * What it guarantees:
 *   - ordering: one request in flight; the next batch is built only after the previous is acknowledged;
 *   - at-least-once: a batch that fails stays as `pending` and is re-sent unchanged (the server acknowledges a repeated
 *     batch id without ingesting it twice), so a lost answer never duplicates or drops events;
 *   - urgency: a strike-class event flushes immediately rather than waiting for the next beat;
 *   - bounded memory: the queue is capped, shedding the least important events first.
 */

/** Events that flush at once. Everything else rides the next beat. */
export const URGENT_EVENTS: ReadonlySet<WebEventType> = new Set<WebEventType>([
  "fullscreen_exit", "tab_switch", "devtools_detected", "focus_lost", "tamper_detected", "automation_detected", "multi_monitor",
  "screen_share_stopped", "screen_share_changed", "camera_lost", "camera_blocked", "virtual_camera", "mic_lost", "synthetic_input",
]);

/** Dropped first when the queue is full: they add nothing a reviewer needs once the strike-class events are kept. */
const DISPOSABLE: ReadonlySet<WebEventType> = new Set<WebEventType>(["window_blur", "context_menu_blocked", "shortcut_blocked", "focus_regained", "offline_period"]);

const MAX_QUEUE = 400;
const MAX_PER_BATCH = 60;

export interface TransportApi {
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
}

export interface TransportOptions {
  api: TransportApi;
  id: string;
  instance: string;
  nonce: string;
  nextBatchId: number;
  beatIntervalMs: number;
  /** Snapshot of the page, sent with every batch. */
  getState: () => Record<string, unknown>;
  /** The page's own view of its network addresses (only sent when it changed). */
  getNet?: () => { srflx: string[]; host: string[] } | null;
  getFingerprint: () => string | null;
  /** Context a surface needs when a strike lands (the contest problem and the code open at the time). */
  getContext?: (withCode: boolean) => Record<string, unknown> | null;
  onAck: (ack: BatchAck) => void;
  /** Another tab or device now owns this attempt. */
  onSuperseded: () => void;
  /** The nonce chain broke; resolve with fresh credentials (or null to give up for now). */
  onResync: () => Promise<{ nonce: string; next_batch_id: number } | null>;
  /** A fatal answer (the attempt does not exist / is not ours). */
  onFatal: (error: ApiError) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export class IntegrityTransport {
  private queue: IntegrityEvent[] = [];
  private pending: { body: Record<string, unknown>; count: number } | null = null;
  private inflight = false;
  private again = false;
  private stopped = true;
  private timer: number | null = null;
  private failures = 0;
  private lastNetKey = "";
  private lastResyncAt = 0;

  private nonce: string;
  private nextBatchId: number;
  private lastAckAt: number;

  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => number;
  private readonly clearTimer: (id: number) => void;

  constructor(private readonly o: TransportOptions) {
    this.nonce = o.nonce;
    this.nextBatchId = o.nextBatchId;
    this.now = o.now ?? (() => Date.now());
    this.setTimer = o.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms));
    this.clearTimer = o.clearTimer ?? ((id) => window.clearTimeout(id));
    this.lastAckAt = this.now();
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────────────────────────────────────────────

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.lastAckAt = this.now();
    this.schedule(this.o.beatIntervalMs);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }

  /** Seconds since the server last acknowledged anything — what the page uses to warn "reconnecting…" before answers are refused. */
  secondsSinceAck(): number {
    return Math.max(0, Math.round((this.now() - this.lastAckAt) / 1000));
  }

  /** Re-seed after the server issued fresh credentials (the start call is idempotent and returns them). */
  reseed(nonce: string, nextBatchId: number): void {
    this.nonce = nonce;
    this.nextBatchId = nextBatchId;
    this.failures = 0;
  }

  // ── events ────────────────────────────────────────────────────────────────────────────────────────────────────────

  emit(type: WebEventType, data?: Record<string, unknown>): void {
    this.queue.push({ type, t: this.now(), ...(data && Object.keys(data).length ? { data } : {}) });

    if (this.queue.length > MAX_QUEUE) {
      const keep = this.queue.filter((e) => !DISPOSABLE.has(e.type));
      this.queue = keep.length > MAX_QUEUE ? keep.slice(-MAX_QUEUE) : keep.concat(this.queue.filter((e) => DISPOSABLE.has(e.type)).slice(-20)).sort((a, b) => a.t - b.t);
    }

    if (URGENT_EVENTS.has(type)) void this.flush();
  }

  /** Events waiting (for tests and the unload path). */
  get queued(): number {
    return this.queue.length + (this.pending ? this.pending.count : 0);
  }

  // ── sending ───────────────────────────────────────────────────────────────────────────────────────────────────────

  async flush(): Promise<void> {
    if (this.stopped) return;
    if (this.inflight) {
      this.again = true;

      return;
    }

    this.inflight = true;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;

    let nextDelay = this.o.beatIntervalMs;
    try {
      const body = this.pending?.body ?? this.build();
      const res = await this.o.api.post<BatchAck>(`/integrity/${this.o.id}/events`, body);

      this.pending = null;
      this.failures = 0;
      this.nonce = res.nonce;
      this.nextBatchId = Math.max(this.nextBatchId, (res.ack || Number(body.batch_id)) + 1);
      this.lastAckAt = this.now();
      this.o.onAck(res);

      // More waiting than one batch carries (or an urgent event arrived mid-flight): go again at once.
      if (this.queue.length >= MAX_PER_BATCH || this.again) nextDelay = 0;
    } catch (err) {
      nextDelay = await this.handleFailure(err);
    } finally {
      this.inflight = false;
      this.again = false;
      if (!this.stopped) this.schedule(nextDelay);
    }
  }

  /** Best-effort send on the way out (tab closing): a keep-alive request that outlives the page. */
  flushOnUnload(extra?: IntegrityEvent): void {
    if (this.stopped) return;
    if (extra) this.queue.push(extra);
    if (this.inflight) return; // its answer is lost with the page; the server records the silence
    const body = this.pending?.body ?? this.build();
    void this.o.api.post(`/integrity/${this.o.id}/events`, body, { keepalive: true }).catch(() => undefined);
  }

  private build(): Record<string, unknown> {
    const events = this.queue.splice(0, MAX_PER_BATCH);
    const withCode = events.some((e) => URGENT_EVENTS.has(e.type));

    const body: Record<string, unknown> = {
      batch_id: this.nextBatchId,
      nonce: this.nonce,
      instance: this.o.instance,
      t: this.now(),
      state: this.o.getState(),
      events,
    };

    const fp = this.o.getFingerprint();
    if (fp) body.fp = fp;

    const net = this.o.getNet?.();
    if (net) {
      const key = JSON.stringify(net);
      if (key !== this.lastNetKey) {
        body.net = net;
        this.lastNetKey = key;
      }
    }

    const ctx = this.o.getContext?.(withCode);
    if (ctx) body.ctx = ctx;

    this.pending = { body, count: events.length };

    return body;
  }

  /** @returns how long to wait before the next try */
  private async handleFailure(err: unknown): Promise<number> {
    this.failures += 1;
    const backoff = Math.min(8000, 1000 * 2 ** Math.min(this.failures - 1, 3));

    if (!(err instanceof ApiError)) return backoff; // offline / DNS / TLS — keep the batch, try again

    if (err.status === 409 && err.code === "superseded") {
      this.stop();
      this.o.onSuperseded();

      return 0;
    }

    if (err.status === 409 && err.code === "bad_nonce") {
      if (this.now() - this.lastResyncAt < 4000) return 2000;
      this.lastResyncAt = this.now();
      const fresh = await this.o.onResync();
      if (fresh) {
        // The events of the batch that was refused are not lost: they go back to the front of the queue.
        if (this.pending) this.queue.unshift(...((this.pending.body.events as IntegrityEvent[]) ?? []));
        this.pending = null;
        this.reseed(fresh.nonce, fresh.next_batch_id);

        return 0;
      }

      return backoff;
    }

    if (err.status === 404 || err.status === 401 || err.status === 403) {
      this.stop();
      this.o.onFatal(err);

      return 0;
    }

    if (err.status === 429) return Math.max(backoff, 5000);

    return backoff; // 5xx, 422: keep the batch
  }

  private schedule(ms: number): void {
    if (this.stopped) return;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }
}
