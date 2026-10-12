import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  FIRST_HELLO_GRACE_MS,
  GuardBridge,
  STALE_AFTER_MS,
  extractCommandBlocks,
  parseGuardMessage,
  type BridgeDeps,
  type GuardEvent,
  type GuardMode,
} from "@/lib/projectLabGuard";

describe("extractCommandBlocks", () => {
  it("returns the bash/sh blocks of a SOW and leaves code fences in other languages to be typed", () => {
    const sow = [
      "## Setup",
      "```bash",
      "cd ~",
      "composer create-project laravel/laravel app",
      "```",
      "",
      "Write this yourself:",
      "```php",
      "<?php echo 'type me';",
      "```",
      "```",
      "no language at all",
      "```",
      "```sh",
      "php artisan serve",
      "```",
    ].join("\n");

    expect(extractCommandBlocks(sow)).toEqual(["cd ~\ncomposer create-project laravel/laravel app", "php artisan serve"]);
  });

  it("copes with CRLF, indentation, an unclosed fence, nothing at all and absurd sizes", () => {
    expect(extractCommandBlocks("```bash\r\nls -la\r\n```\r\n")).toEqual(["ls -la"]);
    expect(extractCommandBlocks("  ```shell\n  echo hi\n  ```")).toEqual(["  echo hi"]);
    expect(extractCommandBlocks("```bash\nnever closed")).toEqual([]);
    expect(extractCommandBlocks(null)).toEqual([]);
    expect(extractCommandBlocks("")).toEqual([]);

    const huge = "```bash\n" + "x".repeat(10_000) + "\n```";
    expect(extractCommandBlocks(huge)[0]).toHaveLength(4_000);

    const many = Array.from({ length: 60 }, (_, i) => "```bash\necho " + i + "\n```").join("\n");
    expect(extractCommandBlocks(many)).toHaveLength(40);
  });

  it("finds the Getting started commands in the real Hospital Management System SOW", () => {
    const sow = readFileSync(resolve(__dirname, "../../../../backend/database/seeders/data/project-lab/hospital-management-system.md"), "utf8");
    const blocks = extractCommandBlocks(sow);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain("composer create-project laravel/laravel hospital-management-system");
    expect(blocks[0]).toContain("php artisan serve --host=0.0.0.0 --port=8000");
  });
});

describe("parseGuardMessage", () => {
  it("accepts the guard's three messages", () => {
    expect(parseGuardMessage({ aptrun: "guard", type: "hello", v: "1.0.0" })).toEqual({ type: "hello", v: "1.0.0" });
    expect(parseGuardMessage({ aptrun: "guard", type: "alive", v: "1.0.0", mode: "enforce", counts: { x: 1 } })).toEqual({ type: "alive", v: "1.0.0", mode: "enforce" });

    const events = parseGuardMessage({
      aptrun: "guard",
      type: "events",
      v: "1.0.0",
      events: [{ id: "a1", t: 5, kind: "paste_blocked", size: 40, target: "editor", meta: { reportOnly: true } }, { id: "a2", t: 6, kind: "fast_typing" }],
    });
    expect(events).toEqual({
      type: "events",
      v: "1.0.0",
      events: [
        { id: "a1", t: 5, kind: "paste_blocked", size: 40, target: "editor", meta: { reportOnly: true } },
        { id: "a2", t: 6, kind: "fast_typing", size: null, target: null },
      ],
    });
  });

  it("rejects anything else, and drops malformed events instead of failing the batch", () => {
    for (const bad of [null, "text", 42, {}, { aptrun: "other", type: "hello", v: "1" }, { aptrun: "guard", type: "hello" }, { aptrun: "guard", type: "nope", v: "1" }, { aptrun: "guard", type: "hello", v: "x".repeat(40) }]) {
      expect(parseGuardMessage(bad)).toBeNull();
    }

    const parsed = parseGuardMessage({ aptrun: "guard", type: "events", v: "1", events: [{ id: "ok", t: 1, kind: "k" }, null, "str", { id: 5, t: 1, kind: "k" }, { id: "no-time", kind: "k" }] });
    expect(parsed && parsed.type === "events" ? parsed.events.map((e) => e.id) : []).toEqual(["ok"]);
  });
});

describe("GuardBridge", () => {
  const ORIGIN = "https://ws-abc.example.com";

  function setup(options: { mode?: GuardMode; send?: BridgeDeps["send"] } = {}) {
    const clock = { t: 1_000_000 };
    const frame = { postMessage: vi.fn() };
    const send = options.send ?? vi.fn(() => Promise.resolve());
    const state = { mode: options.mode ?? ("enforce" as GuardMode) };
    const bridge = new GuardBridge({
      frameWindow: () => frame,
      frameOrigin: () => ORIGIN,
      mode: () => state.mode,
      commands: () => ["composer install", "php artisan serve"],
      send,
      now: () => clock.t,
    });
    const fromGuard = (data: unknown, origin = ORIGIN, source: unknown = frame) => bridge.handleMessage({ source, origin, data });
    const events = (n: number, kind = "paste_blocked", prefix = "e"): GuardEvent[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, t: 1, kind, size: 10, target: "editor" }));

    return { bridge, clock, frame, send: send as ReturnType<typeof vi.fn>, state, fromGuard, events };
  }

  it("answers the guard's hello with the server's policy and the SOW commands, addressed to the editor's origin only", () => {
    const { fromGuard, frame } = setup({ mode: "report" });

    expect(fromGuard({ aptrun: "guard", type: "hello", v: "1.0.0" })).toBe(true);
    expect(frame.postMessage).toHaveBeenCalledWith({ aptrun: "guard-policy", mode: "report", trusted: ["composer install", "php artisan serve"] }, ORIGIN);
  });

  it("ignores messages from any other window or origin, and anything that is not a guard message", () => {
    const { fromGuard, frame, bridge } = setup();

    expect(fromGuard({ aptrun: "guard", type: "hello", v: "1" }, "https://evil.example.com")).toBe(false);
    expect(fromGuard({ aptrun: "guard", type: "hello", v: "1" }, ORIGIN, { postMessage: vi.fn() })).toBe(false);
    expect(fromGuard({ aptrun: "guard", type: "hello", v: "1" }, ORIGIN, null)).toBe(false);
    expect(fromGuard({ hello: "world" })).toBe(false);

    expect(frame.postMessage).not.toHaveBeenCalled();
    expect(bridge.snapshot().status).toBe("starting");
  });

  it("counts refused and inside pastes once each, even if the same event is sent twice", () => {
    const { fromGuard, bridge, events } = setup();

    fromGuard({ aptrun: "guard", type: "events", v: "1", events: [...events(3), ...events(2, "paste_internal", "i"), ...events(1, "paste_trusted", "t"), ...events(1, "fast_typing", "f")] });
    fromGuard({ aptrun: "guard", type: "events", v: "1", events: events(3) }); // a repeat

    expect(bridge.snapshot().counters).toEqual({ refused: 3, inside: 3 });
  });

  it("is 'starting' for a moment, 'outdated' if the loaded editor never answers, 'active' while it does, 'missing' when it goes quiet, and 'off' for an open project", () => {
    const { bridge, clock, fromGuard, state } = setup();

    // The wait for a first hello starts when the frame has loaded, not before: a slow start is not a missing guard.
    expect(bridge.status()).toBe("starting");
    clock.t += FIRST_HELLO_GRACE_MS * 10;
    expect(bridge.status()).toBe("starting");

    bridge.frameLoaded();
    clock.t += FIRST_HELLO_GRACE_MS - 1;
    expect(bridge.status()).toBe("starting");
    clock.t += 2;
    expect(bridge.status()).toBe("outdated");

    fromGuard({ aptrun: "guard", type: "alive", v: "1" });
    expect(bridge.status()).toBe("active");

    clock.t += STALE_AFTER_MS - 1;
    expect(bridge.status()).toBe("active");
    clock.t += 2;
    expect(bridge.status()).toBe("missing");

    state.mode = "open";
    expect(bridge.status()).toBe("off");
  });

  it("a guard that said hello before the frame's load event stays active, and the frame load does not reset it", () => {
    const { bridge, clock, fromGuard } = setup();

    fromGuard({ aptrun: "guard", type: "hello", v: "1" });
    clock.t += 1_000;
    bridge.frameLoaded();
    clock.t += FIRST_HELLO_GRACE_MS * 2;
    fromGuard({ aptrun: "guard", type: "alive", v: "1" });

    expect(bridge.status()).toBe("active");
  });

  it("sends the queued events with a note that the guard is running", async () => {
    const { bridge, fromGuard, send, events } = setup();
    fromGuard({ aptrun: "guard", type: "events", v: "1.0.0", events: events(2) });

    await bridge.flush();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ v: "1.0.0", active: true });
    expect(send.mock.calls[0][0].events.map((e: GuardEvent) => e.id)).toEqual(["e0", "e1"]);
    expect(send.mock.calls[0][1]).toEqual({ keepalive: false });
  });

  it("still sends a pulse when there is nothing to report, but not when the guard is silent", async () => {
    const { bridge, fromGuard, send, clock } = setup();

    await bridge.flush(); // never heard from: nothing to say
    expect(send).not.toHaveBeenCalled();

    fromGuard({ aptrun: "guard", type: "alive", v: "1" });
    await bridge.flush();
    expect(send).toHaveBeenCalledWith({ v: "1", active: true, events: [] }, { keepalive: false });

    clock.t += STALE_AFTER_MS + 1;
    send.mockClear();
    await bridge.flush();
    expect(send).not.toHaveBeenCalled();
  });

  it("marks the report as active:false when events are pending but the guard has gone quiet", async () => {
    const { bridge, fromGuard, send, clock, events } = setup();
    fromGuard({ aptrun: "guard", type: "events", v: "1", events: events(1) });
    clock.t += STALE_AFTER_MS + 1;

    await bridge.flush(true);

    expect(send.mock.calls[0][0].active).toBe(false);
    expect(send.mock.calls[0][1]).toEqual({ keepalive: true });
  });

  it("keeps the events when sending fails and retries them next time, without spinning", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const { bridge, fromGuard, events } = setup({ send });
    fromGuard({ aptrun: "guard", type: "events", v: "1", events: events(60) });

    await bridge.flush();
    expect(send).toHaveBeenCalledTimes(1);

    await bridge.flush();
    expect(send.mock.calls[1][0].events).toHaveLength(50);
    expect(send.mock.calls[2][0].events).toHaveLength(10); // 60 events leave in batches of 50 and 10
  });

  it("sends nothing at all for a project that allows pasting", async () => {
    const { bridge, fromGuard, send, events } = setup({ mode: "open" });
    fromGuard({ aptrun: "guard", type: "events", v: "1", events: events(3) });

    await bridge.flush();

    expect(send).not.toHaveBeenCalled();
  });
});
