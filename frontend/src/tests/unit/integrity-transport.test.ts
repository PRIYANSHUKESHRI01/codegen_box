import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { EvidenceUploader, jitteredMs } from "@/lib/integrity/evidence";
import { claim, discard, park, parkedCount } from "@/lib/integrity/keeper";
import { IntegrityTransport, type TransportOptions } from "@/lib/integrity/transport";
import type { BatchAck } from "@/lib/integrity/types";

const session = { status: "active" as const, violation_count: 0, max_violations: 3, locked_at: null };
const ack = (n: number, over: Partial<BatchAck> = {}): BatchAck => ({ ack: n, nonce: `nonce-${n}`, status: "active", locked: false, session, strikes: [], guardian: null, duplicate: false, server_time_ms: 0, ...over });

/** A transport with a fake clock and hand-cranked timers, so every step is deterministic. */
function rig(post: (path: string, body: unknown, init?: RequestInit) => Promise<unknown>, over: Partial<TransportOptions> = {}) {
  let clock = 1_000_000;
  const timers = new Map<number, () => void>();
  let nextTimer = 1;

  const onAck = vi.fn();
  const onSuperseded = vi.fn();
  const onResync = vi.fn(async () => ({ nonce: "fresh", next_batch_id: 7 }));
  const onFatal = vi.fn();

  const t = new IntegrityTransport({
    api: { post: post as never },
    id: "sess-1",
    instance: "inst-1",
    nonce: "nonce-0",
    nextBatchId: 1,
    beatIntervalMs: 10_000,
    getState: () => ({ visible: true }),
    getFingerprint: () => "fp-1",
    onAck,
    onSuperseded,
    onResync,
    onFatal,
    now: () => clock,
    setTimer: (fn) => {
      timers.set(nextTimer, fn);

      return nextTimer++;
    },
    clearTimer: (id) => void timers.delete(id),
    ...over,
  });

  return {
    t, onAck, onSuperseded, onResync, onFatal,
    advance: (ms: number) => void (clock += ms),
    /** Fire the single pending timer (the next scheduled beat) and wait for it. */
    async tick() {
      const [id, fn] = Array.from(timers.entries())[0] ?? [];
      if (id === undefined) throw new Error("no timer is pending");
      timers.delete(id);
      fn!();
      await new Promise((r) => setTimeout(r, 0));
    },
    pending: () => timers.size,
  };
}

describe("IntegrityTransport", () => {
  it("sends batches in order, carrying the nonce it was last given", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const post = vi.fn(async (_p: string, body: unknown) => {
      calls.push(body as Record<string, unknown>);

      return ack(calls.length);
    });
    const r = rig(post);
    r.t.start();

    r.t.emit("window_blur");
    await r.tick();
    await r.tick();

    expect(calls[0]).toMatchObject({ batch_id: 1, nonce: "nonce-0", instance: "inst-1", fp: "fp-1", state: { visible: true } });
    expect((calls[0].events as unknown[]).length).toBe(1);
    expect(calls[1]).toMatchObject({ batch_id: 2, nonce: "nonce-1" }); // the answer's nonce, not the first one
    expect((calls[1].events as unknown[]).length).toBe(0); // an empty beat is still a beat — silence is what is punished
    expect(r.onAck).toHaveBeenCalledTimes(2);
  });

  it("flushes at once for a serious event and rides the next beat for a minor one", async () => {
    const post = vi.fn(async () => ack(1));
    const r = rig(post);
    r.t.start();

    r.t.emit("shortcut_blocked");
    await new Promise((x) => setTimeout(x, 0));
    expect(post).not.toHaveBeenCalled();

    r.t.emit("tab_switch");
    await new Promise((x) => setTimeout(x, 0));
    expect(post).toHaveBeenCalledTimes(1);
    expect(((post.mock.calls[0] as unknown as [string, { events: unknown[] }])[1]).events).toHaveLength(2); // the minor one went along
  });

  it("re-sends a batch that failed UNCHANGED, so a lost answer neither drops nor duplicates events", async () => {
    let attempt = 0;
    const bodies: Array<Record<string, unknown>> = [];
    const post = vi.fn(async (_p: string, body: unknown) => {
      bodies.push(JSON.parse(JSON.stringify(body)));
      if (++attempt === 1) throw new TypeError("network down");

      return ack(1);
    });
    const r = rig(post);
    r.t.start();

    r.t.emit("paste_attempt");
    await r.tick(); // fails
    r.t.emit("print_attempt"); // arrives while the failed batch is still pending
    await r.tick(); // retry

    expect(bodies[1].batch_id).toBe(bodies[0].batch_id);
    expect(bodies[1].nonce).toBe(bodies[0].nonce);
    expect(bodies[1].events).toEqual(bodies[0].events);

    await r.tick(); // the next batch carries the event that arrived in between
    expect((bodies[2].events as Array<{ type: string }>).map((e) => e.type)).toEqual(["print_attempt"]);
    expect(bodies[2].batch_id).toBe(2);
  });

  it("tells the page how long the server has been silent, for its 'reconnecting' layer", async () => {
    const post = vi.fn(async () => {
      throw new TypeError("offline");
    });
    const r = rig(post);
    r.t.start();

    r.advance(30_000);
    expect(r.t.secondsSinceAck()).toBe(30);
    await r.tick();
    expect(r.t.secondsSinceAck()).toBe(30); // a failed attempt does not reset it
  });

  it("stops and says so when another tab or device has taken the attempt", async () => {
    const post = vi.fn(async () => {
      throw new ApiError("another tab", 409, undefined, "superseded");
    });
    const r = rig(post);
    r.t.start();

    await r.tick();
    expect(r.onSuperseded).toHaveBeenCalledTimes(1);
    expect(r.pending()).toBe(0); // no more beats
  });

  it("recovers from a broken nonce chain by asking for fresh credentials, keeping the events", async () => {
    let n = 0;
    const bodies: Array<Record<string, unknown>> = [];
    const post = vi.fn(async (_p: string, body: unknown) => {
      bodies.push(JSON.parse(JSON.stringify(body)));
      if (++n === 1) throw new ApiError("out of sync", 409, undefined, "bad_nonce");

      return ack(7);
    });
    const r = rig(post);
    r.t.start();

    r.t.emit("paste_attempt");
    await r.tick();
    expect(r.onResync).toHaveBeenCalledTimes(1);

    await r.tick();
    expect(bodies[1]).toMatchObject({ batch_id: 7, nonce: "fresh" });
    expect((bodies[1].events as Array<{ type: string }>).map((e) => e.type)).toEqual(["paste_attempt"]);
  });

  it("gives up cleanly on an attempt that does not exist", async () => {
    const post = vi.fn(async () => {
      throw new ApiError("gone", 404);
    });
    const r = rig(post);
    r.t.start();

    await r.tick();
    expect(r.onFatal).toHaveBeenCalledTimes(1);
    expect(r.pending()).toBe(0);
  });

  it("sends only the network view that changed, and the code only with a serious event", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const post = vi.fn(async (_p: string, body: unknown) => {
      bodies.push(body as Record<string, unknown>);

      return ack(bodies.length);
    });
    const getContext = vi.fn((withCode: boolean) => ({ contest_problem_id: 4, ...(withCode ? { code: "print(1)" } : {}) }));
    const r = rig(post, { getNet: () => ({ srflx: ["203.0.113.9"], host: [] }), getContext });
    r.t.start();

    await r.tick(); // empty beat
    r.t.emit("fullscreen_exit"); // urgent
    await new Promise((x) => setTimeout(x, 0));

    expect(bodies[0].net).toEqual({ srflx: ["203.0.113.9"], host: [] });
    expect(bodies[1].net).toBeUndefined();
    expect(bodies[0].ctx).toEqual({ contest_problem_id: 4 });
    expect(bodies[1].ctx).toEqual({ contest_problem_id: 4, code: "print(1)" });
  });

  it("does not grow without bound while the network is down", () => {
    const r = rig(vi.fn(async () => ack(1)));
    r.t.start();
    for (let i = 0; i < 1000; i++) r.t.emit(i % 2 ? "window_blur" : "paste_attempt");

    expect(r.t.queued).toBeLessThanOrEqual(420);
  });
});

describe("EvidenceUploader", () => {
  const blob = () => new Blob(["x"], { type: "image/jpeg" });

  it("uploads in order and counts what was stored", async () => {
    const sent: string[] = [];
    const api = { postFormData: vi.fn(async (_p: string, form: FormData) => (sent.push(String(form.get("reason") ?? "")), { stored: true })) };
    const onSent = vi.fn();
    const up = new EvidenceUploader(api as never, "sess-1", onSent);

    up.add(blob(), "webcam", { reason: "a" });
    up.add(blob(), "screen", { reason: "b" });
    await new Promise((r) => setTimeout(r, 20));

    expect(sent).toEqual(["a", "b"]);
    expect(onSent).toHaveBeenLastCalledWith(2);
    expect(api.postFormData.mock.calls[0][0]).toBe("/integrity/sess-1/evidence");
  });

  it("never sheds a flagged still to make room for a routine one", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const kept: string[] = [];
    const api = { postFormData: vi.fn(async (_p: string, form: FormData) => (await gate, kept.push(String(form.get("reason"))), { stored: true })) };
    const up = new EvidenceUploader(api as never, "s");

    up.add(blob(), "webcam", { flagged: true, reason: "phone" }); // goes in flight and waits on the gate
    for (let i = 0; i < 8; i++) up.add(blob(), "webcam", { reason: `routine-${i}` });
    up.add(blob(), "webcam", { flagged: true, reason: "faces" });
    release();
    await new Promise((r) => setTimeout(r, 50));

    expect(kept).toContain("phone");
    expect(kept).toContain("faces");
    expect(kept.filter((k) => k.startsWith("routine")).length).toBeLessThan(8);
  });

  it("drops a still the server will never take, without retrying forever", async () => {
    const api = { postFormData: vi.fn(async () => Promise.reject(new ApiError("ended", 409, undefined, "ended"))) };
    const up = new EvidenceUploader(api as never, "s");
    up.add(blob(), "webcam");
    await new Promise((r) => setTimeout(r, 20));

    expect(api.postFormData).toHaveBeenCalledTimes(1);
    expect(up.sent).toBe(0);
  });

  it("jitters the cadence so the next picture cannot be timed", () => {
    expect(jitteredMs(30, () => 0)).toBe(21_000);
    expect(jitteredMs(30, () => 1)).toBe(39_000);
    expect(jitteredMs(30, () => 0.5)).toBe(30_000);
  });
});

describe("keeper", () => {
  const entry = (user: string, release = vi.fn()) => ({ userKey: user, camera: null, screen: null, instance: "i", deviceId: null, release });

  it("hands parked resources to the same user's next page, once", () => {
    const e = entry("u1");
    park("contest:a", e);
    expect(claim("contest:a", "u1")).toBe(e);
    expect(claim("contest:a", "u1")).toBeNull();
    expect(e.release).not.toHaveBeenCalled();
  });

  it("never hands them to a different user — it releases them instead", () => {
    const e = entry("u1");
    park("contest:b", e);
    expect(claim("contest:b", "u2")).toBeNull();
    expect(e.release).toHaveBeenCalledTimes(1);
  });

  it("releases what nobody claims", () => {
    vi.useFakeTimers();
    const e = entry("u1");
    park("contest:c", e);
    vi.advanceTimersByTime(25_000);
    expect(e.release).toHaveBeenCalledTimes(1);
    expect(parkedCount()).toBe(0);
    vi.useRealTimers();
  });

  it("parking again under the same key releases the previous entry; discard releases too", () => {
    const first = entry("u1");
    const second = entry("u1");
    park("contest:d", first);
    park("contest:d", second);
    expect(first.release).toHaveBeenCalledTimes(1);
    discard("contest:d");
    expect(second.release).toHaveBeenCalledTimes(1);
  });
});
