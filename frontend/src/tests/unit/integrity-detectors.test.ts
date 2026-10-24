import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sizeGapSuggestsDevtools } from "@/lib/integrity/detectors/devtools";
import { installFocusDetector } from "@/lib/integrity/detectors/focus";
import { classifyShortcut } from "@/lib/integrity/detectors/input";
import { parseCandidate } from "@/lib/integrity/detectors/network";
import { findAutomation, findExtensionInjection, findTamper, isGenuineNative, resetPristineWindow } from "@/lib/integrity/pristine";

const key = (over: Partial<Parameters<typeof classifyShortcut>[0]>) => ({ key: "a", code: "KeyA", ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...over });

describe("shortcuts", () => {
  it("blocks the keys that open developer tools, view-source, save and print", () => {
    expect(classifyShortcut(key({ key: "F12", code: "F12" }))).toMatchObject({ block: true, type: "shortcut_blocked" });
    expect(classifyShortcut(key({ key: "I", ctrlKey: true, shiftKey: true }))).toMatchObject({ block: true, combo: "Ctrl+Shift+I" });
    expect(classifyShortcut(key({ key: "j", ctrlKey: true, shiftKey: true }))).toMatchObject({ block: true });
    expect(classifyShortcut(key({ key: "u", ctrlKey: true }))).toMatchObject({ block: true, combo: "Ctrl+U" });
    expect(classifyShortcut(key({ key: "s", metaKey: true }))).toMatchObject({ block: true });
    expect(classifyShortcut(key({ key: "p", ctrlKey: true }))).toMatchObject({ block: true, type: "print_attempt" });
  });

  it("reports screenshot keys without trying to stop what a browser cannot", () => {
    expect(classifyShortcut(key({ key: "PrintScreen", code: "PrintScreen" }))).toMatchObject({ block: false, type: "screenshot_key" });
    expect(classifyShortcut(key({ key: "S", metaKey: true, shiftKey: true }))).toMatchObject({ block: false, type: "screenshot_key" });
  });

  it("leaves ordinary typing and editor shortcuts alone", () => {
    for (const k of [key({}), key({ key: "c", ctrlKey: true }), key({ key: "v", ctrlKey: true }), key({ key: "z", ctrlKey: true }), key({ key: "Enter", code: "Enter" }), key({ key: "/", ctrlKey: true })]) {
      expect(classifyShortcut(k)).toBeNull();
    }
  });
});

describe("developer-tools size gap", () => {
  it("flags docked tools and ignores an ordinary window", () => {
    expect(sizeGapSuggestsDevtools(1920, 1080, 1920, 1080)).toBe(false);
    expect(sizeGapSuggestsDevtools(1920, 1080, 1904, 1040)).toBe(false); // scrollbar + borders
    expect(sizeGapSuggestsDevtools(1920, 1080, 1500, 1040)).toBe(true); // docked right
    expect(sizeGapSuggestsDevtools(1920, 1080, 1904, 800)).toBe(true); // docked bottom
  });
});

describe("WebRTC candidates", () => {
  it("reads public and local addresses and skips obfuscated hosts", () => {
    expect(parseCandidate("candidate:842163049 1 udp 1677729535 203.0.113.9 51472 typ srflx raddr 192.168.1.5 rport 51472")).toEqual({ ip: "203.0.113.9", kind: "srflx" });
    expect(parseCandidate("candidate:1 1 udp 2113937151 192.168.1.5 51472 typ host generation 0")).toEqual({ ip: "192.168.1.5", kind: "host" });
    expect(parseCandidate("candidate:2 1 udp 2113937151 2001:db8::1 40000 typ host")).toEqual({ ip: "2001:db8::1", kind: "host" });
    expect(parseCandidate("candidate:3 1 udp 2113937151 b3a1c1f0-9d8e-4c1e-a6a5-0123456789ab.local 51473 typ host")).toBeNull();
    expect(parseCandidate("garbage")).toBeNull();
  });
});

describe("recognising the browser's own functions", () => {
  it("accepts genuine built-ins in Chrome's and Firefox's spelling", () => {
    expect(isGenuineNative("function hasFocus() { [native code] }", "hasFocus")).toBe(true);
    expect(isGenuineNative("function get hidden() { [native code] }", "hidden")).toBe(true);
    expect(isGenuineNative("function requestFullscreen() {\n    [native code]\n}", "requestFullscreen")).toBe(true);
  });

  it("rejects JavaScript replacements and anonymous Proxy wrappers", () => {
    expect(isGenuineNative("function hasFocus() { return true; }", "hasFocus")).toBe(false);
    expect(isGenuineNative("() => true", "hasFocus")).toBe(false);
    // A Proxy around a function prints an ANONYMOUS native stub.
    expect(isGenuineNative("function () { [native code] }", "hasFocus")).toBe(false);
    expect(isGenuineNative("function bound hasFocus() { [native code] }", "hasFocus")).toBe(false);
    expect(isGenuineNative("", "hasFocus")).toBe(false);
  });
});

describe("page tampering", () => {
  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).hidden;
    delete (document as unknown as Record<string, unknown>).hasFocus;
    resetPristineWindow();
  });

  it("notices a property overridden on the document object itself", () => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    expect(findTamper()).toContain("document.hidden was overridden");
  });

  it("notices a replaced hasFocus", () => {
    (document as unknown as { hasFocus: () => boolean }).hasFocus = () => true;
    expect(findTamper()).toContain("document.hasFocus was overridden");
  });
});

describe("automation", () => {
  const original = Object.getOwnPropertyDescriptor(Navigator.prototype, "webdriver");
  afterEach(() => {
    if (original) Object.defineProperty(Navigator.prototype, "webdriver", original);
    delete (window as unknown as Record<string, unknown>).__playwright;
    vi.unstubAllEnvs();
  });

  it("is quiet in an ordinary browser", () => {
    expect(findAutomation()).toEqual([]);
  });

  it("sees webdriver and the usual injected globals", () => {
    Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => true });
    (window as unknown as Record<string, unknown>).__playwright = {};
    const found = findAutomation();
    expect(found).toContain("navigator.webdriver");
    expect(found).toContain("window.__playwright");
  });

  it("has a build-time switch for our own test runs, off in production", () => {
    Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => true });
    vi.stubEnv("NEXT_PUBLIC_INTEGRITY_ALLOW_AUTOMATION", "1");
    expect(findAutomation()).toEqual([]);
  });
});

describe("extension injection", () => {
  it("names extensions that put scripts into the page", () => {
    const s = document.createElement("script");
    s.setAttribute("src", "chrome-extension://abcdefghijklmnop/content.js");
    document.head.appendChild(s);
    expect(findExtensionInjection()).toEqual(["abcdefghijklmnop"]);
    s.remove();
    expect(findExtensionInjection()).toEqual([]);
  });
});

describe("focus detector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("a blur is logged at once and becomes a focus_lost strike only after the policy's seconds", () => {
    const emit = vi.fn();
    const stop = installFocusDetector(emit, { focusLossStrikeSeconds: 3, onFullscreenExit: vi.fn() });

    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    window.dispatchEvent(new Event("blur"));
    expect(emit).toHaveBeenCalledWith("window_blur", undefined);
    expect(emit).not.toHaveBeenCalledWith("focus_lost", expect.anything());

    vi.advanceTimersByTime(3100);
    expect(emit).toHaveBeenCalledWith("focus_lost", expect.objectContaining({ duration_ms: expect.any(Number) }));

    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    expect(emit).toHaveBeenCalledWith("focus_regained", expect.anything());
    stop();
  });

  it("a blip shorter than the policy never reaches focus_lost", () => {
    const emit = vi.fn();
    const stop = installFocusDetector(emit, { focusLossStrikeSeconds: 3, onFullscreenExit: vi.fn() });

    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    window.dispatchEvent(new Event("blur"));
    vi.advanceTimersByTime(1000);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(10_000);

    expect(emit).not.toHaveBeenCalledWith("focus_lost", expect.anything());
    stop();
  });

  it("catches an overlay that steals focus without ever firing blur", () => {
    const emit = vi.fn();
    const stop = installFocusDetector(emit, { focusLossStrikeSeconds: 2, onFullscreenExit: vi.fn() });

    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    vi.advanceTimersByTime(600); // the poll notices
    expect(emit).toHaveBeenCalledWith("window_blur", undefined);
    vi.advanceTimersByTime(2200);
    expect(emit).toHaveBeenCalledWith("focus_lost", expect.anything());
    stop();
  });

  it("reports tab switches and fullscreen exits once, and tells the engine about the exit", () => {
    const emit = vi.fn();
    const onFullscreenExit = vi.fn();
    const stop = installFocusDetector(emit, { focusLossStrikeSeconds: 0, onFullscreenExit });

    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(emit.mock.calls.filter((c) => c[0] === "tab_switch")).toHaveLength(1);
    delete (document as unknown as Record<string, unknown>).hidden;

    document.dispatchEvent(new Event("fullscreenchange"));
    expect(emit).toHaveBeenCalledWith("fullscreen_exit", undefined);
    expect(onFullscreenExit).toHaveBeenCalled();
    stop();
  });
});
