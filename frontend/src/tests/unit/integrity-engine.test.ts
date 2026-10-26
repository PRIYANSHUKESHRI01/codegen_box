import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IntegrityBootstrap, IntegrityPolicy, WebEventType } from "@/lib/integrity/types";

// ── the API: every call is recorded and answered by the test ────────────────────────────────────────────────────────
type Handler = (path: string, body?: unknown) => unknown | Promise<unknown>;
let onGet: Handler = () => ({});
let onPost: Handler = () => ({});
const calls: Array<{ method: "get" | "post"; path: string; body?: unknown }> = [];

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");

  return {
    ...actual,
    api: {
      get: async (path: string) => (calls.push({ method: "get", path }), onGet(path)),
      post: async (path: string, body?: unknown) => (calls.push({ method: "post", path, body }), onPost(path, body)),
      postFormData: async (path: string) => (calls.push({ method: "post", path: path + " [form]" }), { stored: true }),
    },
  };
});

// ── detectors: capture the emit function each is given, so the test can play the part of the browser ────────────────
const emitters: Record<string, (type: WebEventType, data?: Record<string, unknown>) => void> = {};
let focusOptions: { onFullscreenExit: () => void } | null = null;

vi.mock("@/lib/integrity/detectors/focus", () => ({
  installFocusDetector: (emit: never, o: { onFullscreenExit: () => void }) => ((emitters.focus = emit), (focusOptions = o), () => undefined),
}));
vi.mock("@/lib/integrity/detectors/devtools", () => ({ installDevtoolsDetector: (emit: never) => ((emitters.devtools = emit), () => undefined) }));
vi.mock("@/lib/integrity/detectors/input", () => ({ installInputDetector: (emit: never) => ((emitters.input = emit), () => undefined) }));
vi.mock("@/lib/integrity/detectors/display", () => ({
  installDisplayDetector: () => () => undefined,
  isExtendedDesktop: () => false,
  monitorCount: () => 1,
}));
vi.mock("@/lib/integrity/detectors/network", () => ({ installConnectivityDetector: () => () => undefined, startNetworkProbe: () => () => undefined }));
vi.mock("@/lib/integrity/detectors/vision", () => ({ loadVision: vi.fn(async () => Promise.reject(new Error("no wasm in tests"))) }));
let tamperFindings: string[] = [];
vi.mock("@/lib/integrity/pristine", () => ({ findTamper: () => tamperFindings, findAutomation: () => [], findExtensionInjection: () => [] }));
vi.mock("@/lib/integrity/fingerprint", () => ({
  deviceFingerprint: async () => ({ did: "d".repeat(32), fp: "f".repeat(48) }),
  newInstanceId: () => "instance-test-0001",
  browserFamily: () => "Chrome",
}));

const stopTrack = vi.fn();
function fakeStream(opts: { audio?: boolean } = {}) {
  const listeners: Record<string, Array<() => void>> = {};
  const track = (kind: string) => ({
    kind, readyState: "live", label: "Integrated Camera", stop: stopTrack,
    addEventListener: (e: string, fn: () => void) => ((listeners[`${kind}:${e}`] ??= []).push(fn), undefined),
    removeEventListener: () => undefined,
    getSettings: () => ({ displaySurface: "monitor" }),
  });
  const video = track("video");
  const audio = track("audio");

  return {
    stream: { getTracks: () => (opts.audio === false ? [video] : [video, audio]), getVideoTracks: () => [video], getAudioTracks: () => (opts.audio === false ? [] : [audio]) } as unknown as MediaStream,
    fire: (kind: string, e: string) => listeners[`${kind}:${e}`]?.forEach((f) => f()),
  };
}

let camera = fakeStream();
let screenShare = fakeStream({ audio: false });
vi.mock("@/lib/integrity/detectors/media", () => ({
  openCameraAndMic: vi.fn(async () => ({ stream: camera.stream, label: "Integrated Camera", virtual: false })),
  attachHiddenVideo: () => document.createElement("video"),
  detachHiddenVideo: () => undefined,
  isStreamLive: () => true,
  stopStream: (s: MediaStream | null | undefined) => s?.getTracks().forEach((t) => t.stop()),
  thumbnail: () => null,
  watchStream: () => () => undefined,
  MediaError: class extends Error { constructor(m: string, readonly kind: string) { super(m); } },
}));
let chromium = true;
vi.mock("@/lib/integrity/detectors/screenShare", () => ({
  isChromium: () => chromium,
  supportsScreenShare: () => true,
  requestEntireScreen: vi.fn(async () => ({ stream: screenShare.stream, surface: "monitor" })),
  ShareError: class extends Error { constructor(m: string, readonly kind: string) { super(m); } },
}));

import { ApiError } from "@/lib/api";
import { IntegrityEngine, type EngineHandlers } from "@/lib/integrity/engine";
import { discard, parkedCount } from "@/lib/integrity/keeper";
import { getIntegrityUi, resetIntegrityUi } from "@/lib/integrity/store";

const POLICY: IntegrityPolicy = {
  profile: "strict", beat_interval: 10, stale_after: 40, webcam_snapshot: 0, screen_snapshot: 0, screen_share: "required", camera: "required", guardian: "off",
  chromium_only: true, block_multi_monitor: true, focus_loss_strike: 3, ai: false, clipboard: "editor_only", stun_servers: [], retention_days: 45, flagged_retention_days: 365,
};
const session = (violation_count = 0, status: "active" | "locked" = "active") => ({ status, violation_count, max_violations: 3, locked_at: null });
const bootstrap = (over: Partial<IntegrityBootstrap> = {}): IntegrityBootstrap => ({
  id: "uuid-1", nonce: "n0", next_batch_id: 1, status: "active", assurance: "web", marker: "A1B2C3", policy: POLICY,
  guardian: { mode: "off", connected: false, version: null, outdated: false, blockers: [], download_url: "" }, session: session(), server_time_ms: 0, ...over,
});
const ack = (n: number, over: Record<string, unknown> = {}) => ({ ack: n, nonce: `n${n}`, status: "active", locked: false, session: session(), strikes: [], guardian: null, duplicate: false, server_time_ms: 0, ...over });

function handlers() {
  const h = {
    phase: vi.fn(), session: vi.fn(), violation: vi.fn(), consentError: vi.fn(), camera: vi.fn(), previewReady: vi.fn(),
  } satisfies EngineHandlers;
  const phases = () => h.phase.mock.calls.map((c) => c[0] as string);

  return { h, phases };
}

function build(over: Partial<ConstructorParameters<typeof IntegrityEngine>[0]> = {}) {
  const { h, phases } = handlers();
  const engine = new IntegrityEngine({ surface: "contest", basePath: "/contests/c1/problems/4", keepKey: "contest:c1", userKey: "u1", activityLabel: "contest", handlers: h, ...over });

  return { engine, h, phases };
}

const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  tamperFindings = [];
  calls.length = 0;
  resetIntegrityUi();
  discard("contest:c1");
  onGet = (path) => {
    if (path.startsWith("/integrity/policy")) return { enabled: true, policy: POLICY };
    return {};
  };
  onPost = (path) => {
    if (path.endsWith("/proctoring/start")) return { session: session(), integrity: bootstrap() };
    if (path.endsWith("/events")) return ack(1);
    return {};
  };
  camera = fakeStream();
  screenShare = fakeStream({ audio: false });

  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn() } });
  let fullscreen: Element | null = null;
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreen });
  document.documentElement.requestFullscreen = vi.fn(async () => {
    calls.push({ method: "post", path: "<requestFullscreen>" });
    fullscreen = document.documentElement;
  });
  document.exitFullscreen = vi.fn(async () => void (fullscreen = null));
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (document as unknown as Record<string, unknown>).fullscreenElement;
});

/** Walks the gate the way a student does: camera, screen, start. */
async function startAttempt(engine: IntegrityEngine) {
  await engine.init();
  await engine.enableDevicePreview();
  await engine.shareScreen();
  await engine.grantConsentAndStart();
  await settle();
}

const WINDOWS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const useDevice = (ua: string) => vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua);

describe("the Guardian card while it waits", () => {
  beforeEach(() => void useDevice(WINDOWS_UA)); // the Guardian is a Windows program; polling for it only happens there
  const optional = { ...POLICY, guardian: "optional" as const };
  const summary = { mode: "optional", connected: false, version: null, outdated: false, blockers: [], download_url: "" };

  it("says so when the server cannot answer, instead of spinning forever — and clears it once it can", async () => {
    onGet = (path) => {
      if (path.startsWith("/integrity/policy")) return { enabled: true, policy: optional };
      if (path.startsWith("/integrity/guardian")) throw new ApiError("The server cannot accept Guardian connections yet.", 503, undefined, "sodium_missing");
      return {};
    };
    const { engine } = build();
    await engine.init();
    await settle();
    expect(getIntegrityUi().guardian.error).toBeNull(); // one dropped poll is not news

    await vi.advanceTimersByTimeAsync(2500);
    expect(getIntegrityUi().guardian.error).toMatch(/cannot accept Guardian connections yet\. The Guardian cannot connect until this is fixed/);

    onGet = (path) => (path.startsWith("/integrity/guardian") ? { guardian: summary } : path.startsWith("/integrity/policy") ? { enabled: true, policy: optional } : {});
    await vi.advanceTimersByTimeAsync(2500);
    expect(getIntegrityUi().guardian.error).toBeNull();
    engine.destroy({ keep: false });
  });

  it("counts a code's lifetime from when it arrived, whatever this computer's clock says", async () => {
    onPost = (path) => (path.endsWith("/integrity/guardian/code") ? { code: "ABCD-2345", expires_at: "2001-01-01T00:00:00+00:00", ttl: 600, deep_link: "aptrun-guardian://pair?code=ABCD2345", download_url: "" } : {});
    const { engine } = build();
    await engine.init();
    await engine.connectGuardian();

    const left = Date.parse(getIntegrityUi().guardian.pairing!.expiresAt) - Date.now();
    expect(left).toBeGreaterThan(590_000);
    expect(left).toBeLessThanOrEqual(600_000);
    engine.destroy({ keep: false });
  });
});

describe("the pre-start checklist", () => {
  it("asks for what the server's policy requires, and for nothing it does not", async () => {
    const { engine } = build();
    await engine.init();

    const ids = getIntegrityUi().checks.map((c) => c.id);
    expect(ids).toEqual(["browser", "tamper", "automation", "camera", "display", "screen"]);
    expect(getIntegrityUi().checks.find((c) => c.id === "screen")).toMatchObject({ required: true, status: "pending" });
    expect(getIntegrityUi().checks.find((c) => c.id === "guardian")).toBeUndefined();
    engine.destroy({ keep: false });
  });

  it("tells the student BEFORE they start that a browser extension has changed how the page works", async () => {
    tamperFindings = ["document.hasFocus is not the browser's own", "mediaDevices.getUserMedia is not the browser's own"];
    const { engine } = build();
    await engine.init();

    const tamper = getIntegrityUi().checks.find((c) => c.id === "tamper");
    expect(tamper).toMatchObject({ status: "fail", required: true });
    expect(tamper?.detail).toContain("document.hasFocus");
    expect(tamper?.fix).toMatch(/extension/i);

    // fixed (extension switched off) → the gate re-checks on its own and turns green
    tamperFindings = [];
    await vi.advanceTimersByTimeAsync(3000);
    expect(getIntegrityUi().checks.find((c) => c.id === "tamper")?.status).toBe("ok");
    engine.destroy({ keep: false });
  });

  it("ticks the camera and screen rows as the student grants them", async () => {
    const { engine, h } = build();
    await engine.init();
    await engine.enableDevicePreview();
    expect(getIntegrityUi().checks.find((c) => c.id === "camera")?.status).toBe("ok");
    expect(h.previewReady).toHaveBeenCalledWith(true);

    await engine.shareScreen();
    expect(getIntegrityUi().checks.find((c) => c.id === "screen")?.status).toBe("ok");
    expect(getIntegrityUi().screenShared).toBe(true);
    engine.destroy({ keep: false });
  });
});

describe("on a Mac", () => {
  const withGuardian = (guardian: "optional" | "required") => {
    onGet = (path) => (path.startsWith("/integrity/policy") ? { enabled: true, policy: { ...POLICY, guardian } } : {});
  };

  beforeEach(() => void useDevice(MAC_UA));

  it("does not wait for, or poll, a Guardian that cannot run there — an optional one is skipped", async () => {
    withGuardian("optional");
    const { engine } = build();
    await engine.init();
    await vi.advanceTimersByTimeAsync(6000);

    expect(getIntegrityUi().checks.find((c) => c.id === "guardian")).toMatchObject({ status: "skipped", required: false });
    expect(calls.some((c) => c.path.startsWith("/integrity/guardian"))).toBe(false);
    engine.destroy({ keep: false });
  });

  it("says up front that a REQUIRED Guardian cannot be met, instead of waiting forever", async () => {
    withGuardian("required");
    const { engine } = build();
    await engine.init();

    const row = getIntegrityUi().checks.find((c) => c.id === "guardian");
    expect(row).toMatchObject({ status: "fail", required: true });
    expect(row?.fix).toMatch(/Windows/);
    engine.destroy({ keep: false });
  });

  it("takes a proctored attempt end to end with the Guardian optional", async () => {
    withGuardian("optional");
    const { engine, phases } = build();
    await startAttempt(engine);

    expect(phases().at(-1)).toBe("active");
    expect(calls.some((c) => c.path.endsWith("/proctoring/start"))).toBe(true);
    engine.destroy({ keep: false });
  });

  it("tells a Safari user to install Chrome when the profile needs a browser that can prove what is shared", async () => {
    onGet = (path) => (path.startsWith("/integrity/policy") ? { enabled: true, policy: { ...POLICY, chromium_only: true } } : {});
    chromium = false; // Safari
    const { engine } = build();
    await engine.init();

    const row = getIntegrityUi().checks.find((c) => c.id === "browser");
    expect(row?.status).toBe("fail");
    expect(row?.fix).toMatch(/Install Google Chrome/);
    chromium = true;
    engine.destroy({ keep: false });
  });
});

describe("starting", () => {
  it("goes fullscreen BEFORE the start call, sends who and what, and becomes active", async () => {
    const { engine, phases } = build();
    await startAttempt(engine);

    const order = calls.map((c) => c.path);
    expect(order.indexOf("<requestFullscreen>")).toBeLessThan(order.indexOf("/contests/c1/problems/4/proctoring/start"));

    const start = calls.find((c) => c.path.endsWith("/proctoring/start"))!.body as { integrity: Record<string, unknown>; device_info: unknown };
    expect(start.integrity).toMatchObject({ instance: "instance-test-0001", fp: "f".repeat(48), did: "d".repeat(32) });
    expect(start.integrity.preflight).toMatchObject({ camera: "ok", screen: "ok" });
    expect(phases().at(-1)).toBe("active");
    expect(getIntegrityUi()).toMatchObject({ assurance: "web", marker: "A1B2C3" });
    engine.destroy({ keep: false });
  });

  it("keeps the window title tagged with the attempt's marker (what the Guardian looks for)", async () => {
    document.title = "Solve · AptRun";
    const { engine } = build();
    await startAttempt(engine);

    expect(document.title).toBe("[AptRun A1B2C3] Solve · AptRun");
    engine.destroy({ keep: false });
    expect(document.title).toBe("Solve · AptRun");
  });

  it("does not let a student in when the network is not allowed, and explains", async () => {
    onPost = (path) => {
      if (path.endsWith("/proctoring/start")) throw new ApiError("Proctored attempts can only be taken from the exam network.", 403, undefined, "network_not_allowed");
      return {};
    };
    const { engine, h, phases } = build();
    await startAttempt(engine);

    expect(phases().at(-1)).toBe("blocked");
    expect(h.consentError).toHaveBeenLastCalledWith(expect.stringContaining("exam network"));
    engine.destroy({ keep: false });
  });

  it("sends the student back to the checklist (not a dead end) when the Guardian is required but missing", async () => {
    onPost = (path) => {
      if (path.endsWith("/proctoring/start")) throw new ApiError("Open the AptRun Guardian.", 428, undefined, "guardian_required");
      return {};
    };
    const { engine, phases } = build();
    await startAttempt(engine);

    expect(phases().at(-1)).toBe("consent");
    engine.destroy({ keep: false });
  });

  it("an attempt that is already locked never becomes active", async () => {
    onPost = (path) => (path.endsWith("/proctoring/start") ? { session: session(3, "locked"), integrity: bootstrap({ session: session(3, "locked") }) } : {});
    const { engine, phases } = build();
    await startAttempt(engine);

    expect(phases().at(-1)).toBe("locked");
    expect(phases()).not.toContain("active");
  });
});

describe("while the attempt runs", () => {
  it("sends what the detectors see on the next beat, and shows strikes the server confirms", async () => {
    const { engine, h } = build();
    await startAttempt(engine);

    emitters.input("paste_attempt", { via: "paste", length: 12 });
    // a blocked paste is shown to the student at once, as before
    expect(h.violation).toHaveBeenCalledWith(expect.objectContaining({ type: "paste_attempt" }));

    onPost = (path) => (path.endsWith("/events") ? ack(1, { session: session(1), strikes: [{ type: "tab_switch", count: 1 }] }) : {});
    emitters.focus("tab_switch"); // urgent → goes out at once
    await settle();

    const batch = calls.filter((c) => c.path === "/integrity/uuid-1/events").at(-1)!.body as { events: Array<{ type: string }>; nonce: string; instance: string };
    expect(batch.events.map((e) => e.type)).toEqual(["paste_attempt", "tab_switch"]);
    expect(batch.instance).toBe("instance-test-0001");
    expect(h.violation).toHaveBeenLastCalledWith({ type: "tab_switch", count: 1, max: 3 });
    engine.destroy({ keep: false });
  });

  it("ends the attempt when the server says it is locked: media off, fullscreen left, phase locked", async () => {
    const { engine, phases } = build();
    await startAttempt(engine);

    onPost = (path) => (path.endsWith("/events") ? ack(1, { locked: true, session: session(3, "locked") }) : {});
    emitters.focus("tab_switch");
    await settle();

    expect(phases().at(-1)).toBe("locked");
    expect(stopTrack).toHaveBeenCalled();
    expect(document.exitFullscreen).toHaveBeenCalled();
  });

  it("puts up the 'resume fullscreen' layer when fullscreen is left", async () => {
    const { engine, phases } = build();
    await startAttempt(engine);

    focusOptions!.onFullscreenExit();
    expect(phases().at(-1)).toBe("fullscreen_lost");
    engine.destroy({ keep: false });
  });

  it("holds the exam when the screen share is stopped, and clears when it is shared again", async () => {
    const { engine } = build();
    await startAttempt(engine);

    screenShare.fire("video", "ended");
    expect(getIntegrityUi().hold).toMatchObject({ kind: "screen_share", action: "Share entire screen" });
    // …and the stop is reported (urgent: it goes out at once)
    await settle();
    const sent = calls.filter((c) => c.path === "/integrity/uuid-1/events").flatMap((c) => (c.body as { events: Array<{ type: string }> }).events.map((e) => e.type));
    expect(sent).toContain("screen_share_stopped");

    // The hold's button asks for the screen again; once shared, the layer goes.
    screenShare = fakeStream({ audio: false });
    await engine.resolveHold();
    expect(getIntegrityUi().hold).toBeNull();
    engine.destroy({ keep: false });
  });

  it("shows 'reconnecting' once the server has been silent too long, and lets go when it answers again", async () => {
    const { engine } = build();
    await startAttempt(engine);

    onPost = (path) => {
      if (path.endsWith("/events")) throw new TypeError("offline");
      return {};
    };
    await vi.advanceTimersByTimeAsync(30_000);
    expect(getIntegrityUi().hold?.kind).toBe("signal");

    onPost = (path) => (path.endsWith("/events") ? ack(1) : {});
    await vi.advanceTimersByTimeAsync(10_000);
    expect(getIntegrityUi().hold).toBeNull();
    engine.destroy({ keep: false });
  });

  it("stands down, for good, when another tab or device owns the attempt", async () => {
    const { engine } = build();
    await startAttempt(engine);

    onPost = (path) => {
      if (path.endsWith("/events")) throw new ApiError("Opened elsewhere.", 409, undefined, "superseded");
      return {};
    };
    await vi.advanceTimersByTimeAsync(11_000);

    expect(getIntegrityUi().hold).toMatchObject({ kind: "superseded", final: true });
    engine.destroy({ keep: false });
  });

  it("closes the integrity log when the student finishes", async () => {
    const { engine, phases } = build();
    await startAttempt(engine);

    engine.end();
    expect(phases().at(-1)).toBe("completed");
    expect(calls.some((c) => c.path === "/integrity/uuid-1/end")).toBe(true);
    expect(getIntegrityUi().attached).toBe(false);
  });
});

describe("moving between pages of the same attempt", () => {
  it("parks the camera and the shared screen for the next page instead of stopping them", async () => {
    const first = build();
    await startAttempt(first.engine);
    stopTrack.mockClear();

    first.engine.destroy({ keep: true });
    expect(parkedCount()).toBe(1);
    expect(stopTrack).not.toHaveBeenCalled();
    discard("contest:c1");
    expect(stopTrack).toHaveBeenCalled(); // released only when nobody takes them
  });

  it("the next page takes them over, keeps the same instance, and resumes without asking again", async () => {
    const first = build();
    await startAttempt(first.engine);
    first.engine.destroy({ keep: true });
    calls.length = 0;

    const second = build({ basePath: "/contests/c1/problems/5" });
    await second.engine.init();
    await settle();

    const start = calls.find((c) => c.path === "/contests/c1/problems/5/proctoring/start");
    expect(start).toBeTruthy();
    expect((start!.body as { integrity: { instance: string } }).integrity.instance).toBe("instance-test-0001");
    expect(second.phases().at(-1)).toBe("active");
    expect(vi.mocked(navigator.mediaDevices.getUserMedia)).not.toHaveBeenCalled();
    second.engine.destroy({ keep: false });
  });

  it("never hands one student's camera to another", async () => {
    const first = build({ userKey: "u1" });
    await startAttempt(first.engine);
    first.engine.destroy({ keep: true });
    calls.length = 0;

    const other = build({ userKey: "u2" });
    await other.engine.init();
    await settle();

    expect(other.phases().at(-1)).toBe("consent");
    expect(getIntegrityUi().checks.find((c) => c.id === "camera")?.status).toBe("pending");
    expect(getIntegrityUi().checks.find((c) => c.id === "screen")?.status).toBe("pending");
    expect(calls.some((c) => c.path.endsWith("/proctoring/start"))).toBe(false);
    expect(stopTrack).toHaveBeenCalled(); // u1's stream was released, not lent
    other.engine.destroy({ keep: false });
  });
});

describe("when the server has the integrity layer switched off", () => {
  beforeEach(() => {
    onGet = (path) => (path.startsWith("/integrity/policy") ? { enabled: false, policy: null } : {});
    onPost = (path) => (path.endsWith("/proctoring/start") ? { session: session(), integrity: null } : path.endsWith("/violations") ? { session: session(1), locked: false } : {});
  });

  it("asks only for the camera, and starts the original proctoring", async () => {
    const { engine, phases } = build();
    await engine.init();
    expect(getIntegrityUi().checks.map((c) => c.id)).toEqual(["browser", "automation", "camera"]);

    await engine.enableDevicePreview();
    await engine.grantConsentAndStart();
    await settle();

    const start = calls.find((c) => c.path.endsWith("/proctoring/start"))!.body as Record<string, unknown>;
    expect(start.integrity).toBeUndefined();
    expect(phases().at(-1)).toBe("active");
    engine.destroy({ keep: false });
  });

  it("reports strikes to the original violations endpoint, with the open code, and obeys a lock", async () => {
    const { engine, h, phases } = build({ getContext: () => ({ code: "print(1)", language: "python" }) });
    await engine.init();
    await engine.enableDevicePreview();
    await engine.grantConsentAndStart();
    await settle();

    emitters.focus("tab_switch");
    await settle();
    const report = calls.find((c) => c.path.endsWith("/violations"))!;
    expect(report.body).toMatchObject({ type: "tab_switch", current_code: "print(1)", language: "python" });
    expect(h.violation).toHaveBeenCalledWith({ type: "tab_switch", count: 1, max: 3 });

    // events the original server doesn't know are never sent to it
    calls.length = 0;
    emitters.focus("focus_lost" as WebEventType, { duration_ms: 9000 });
    await settle();
    expect(calls.some((c) => c.path.endsWith("/violations"))).toBe(false);

    onPost = (path) => (path.endsWith("/violations") ? { session: session(3, "locked"), locked: true } : {});
    vi.advanceTimersByTime(2000);
    emitters.devtools("devtools_detected");
    await settle();
    expect(phases().at(-1)).toBe("locked");
  });

  it("treats an old server without the policy endpoint the same way", async () => {
    onGet = () => {
      throw new ApiError("Not found", 404);
    };
    const { engine } = build();
    await engine.init();

    expect(getIntegrityUi().checks.map((c) => c.id)).toEqual(["browser", "automation", "camera"]);
    engine.destroy({ keep: false });
  });
});
