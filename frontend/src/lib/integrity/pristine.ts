/**
 * "Is the browser still telling the truth?"
 *
 * The cheapest cheat against a web proctor is a userscript / extension that runs before the page and replaces the
 * functions the proctor listens through — `document.hasFocus()` always true, `document.hidden` always false,
 * `requestFullscreen` doing nothing. This module checks for exactly that, without trusting anything the page's own
 * realm says about itself:
 *
 *   - a fresh same-origin `about:blank` iframe has an untouched copy of every built-in, and its `Function.prototype.toString`
 *     is used to read the source of the page's functions (so patching the page's `toString` does not help);
 *   - a genuine built-in prints as `function name() { [native code] }`. A JavaScript replacement prints its own source, and
 *     a Proxy wrapper prints an ANONYMOUS native stub — the name is missing — which is how wrappers are caught;
 *   - a property that was overridden on the `document` object itself (rather than inherited from `Document.prototype`)
 *     is an override by definition.
 *
 * This is detection, not prevention: a patch that also fixes up what the iframe sees defeats it. That is why the same
 * facts are cross-checked by the Guardian (the operating system's view) and why the server treats silence as a finding.
 */

let cached: Window | null | undefined;

/** An untouched realm, or null when one cannot be made (sandboxed / CSP-restricted). */
export function pristineWindow(): Window | null {
  if (cached !== undefined) return cached;
  try {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:0;height:0;border:0;visibility:hidden";
    document.documentElement.appendChild(frame);
    cached = frame.contentWindow;
  } catch {
    cached = null;
  }
  return cached;
}

/** For tests: forget the cached realm. */
export function resetPristineWindow(): void {
  cached = undefined;
}

type AnyFn = (...args: unknown[]) => unknown;

/** The function's source as printed by an UNTOUCHED `Function.prototype.toString`. */
export function sourceOf(fn: unknown, realm: Window | null = pristineWindow()): string {
  try {
    const toString = (realm as (Window & typeof globalThis) | null)?.Function?.prototype?.toString ?? Function.prototype.toString;
    return toString.call(fn as AnyFn);
  } catch {
    return "";
  }
}

/** True for a genuine built-in called `name` (anonymous native stubs — Proxy wrappers — fail, as do JS replacements). */
export function isGenuineNative(source: string, name: string): boolean {
  if (!/\[native code\]/.test(source)) return false;
  // "function hasFocus() { [native code] }" / "function get hidden() { [native code] }" — whitespace differs per engine.
  const normalised = source.replace(/\s+/g, " ");
  return new RegExp(`function\\s+(get\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`).test(normalised);
}

interface Probe {
  /** What shows up in the report. */
  label: string;
  /** The function to inspect, or undefined when this browser does not have it (not a finding). */
  get: () => unknown;
  /** Its expected built-in name. */
  name: string;
}

function getter(proto: object | undefined, prop: string): unknown {
  return proto ? Object.getOwnPropertyDescriptor(proto, prop)?.get : undefined;
}

function probes(): Probe[] {
  const list: Probe[] = [];
  const D = typeof Document !== "undefined" ? Document.prototype : undefined;

  list.push({ label: "document.hasFocus", get: () => D?.hasFocus, name: "hasFocus" });
  list.push({ label: "document.hidden", get: () => getter(D, "hidden"), name: "hidden" });
  list.push({ label: "document.visibilityState", get: () => getter(D, "visibilityState"), name: "visibilityState" });
  list.push({ label: "document.fullscreenElement", get: () => getter(D, "fullscreenElement"), name: "fullscreenElement" });
  list.push({ label: "document.exitFullscreen", get: () => D?.exitFullscreen, name: "exitFullscreen" });
  list.push({ label: "element.requestFullscreen", get: () => (typeof Element !== "undefined" ? Element.prototype.requestFullscreen : undefined), name: "requestFullscreen" });

  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  const MD = md ? Object.getPrototypeOf(md) : undefined;
  list.push({ label: "mediaDevices.getUserMedia", get: () => MD?.getUserMedia, name: "getUserMedia" });
  list.push({ label: "mediaDevices.getDisplayMedia", get: () => MD?.getDisplayMedia, name: "getDisplayMedia" });
  list.push({ label: "mediaDevices.enumerateDevices", get: () => MD?.enumerateDevices, name: "enumerateDevices" });

  return list;
}

/** Properties that must be inherited from the prototype; an own property on the `document` object is an override. */
const OWN_OVERRIDES = ["hidden", "visibilityState", "hasFocus", "fullscreenElement", "exitFullscreen", "webkitHidden", "webkitVisibilityState", "onvisibilitychange"] as const;

/**
 * Everything wrong with the built-ins the proctor depends on, as short labels (empty when intact).
 * The first call per page also creates the pristine iframe.
 */
export function findTamper(): string[] {
  const findings: string[] = [];
  const realm = pristineWindow();

  for (const probe of probes()) {
    const fn = probe.get();
    if (typeof fn !== "function") continue;
    if (!isGenuineNative(sourceOf(fn, realm), probe.name)) findings.push(`${probe.label} is not the browser's own`);
  }

  for (const prop of OWN_OVERRIDES) {
    if (Object.prototype.hasOwnProperty.call(document, prop)) findings.push(`document.${prop} was overridden`);
  }

  // The tool used to read all of the above must itself be the real one.
  if (realm && !isGenuineNative(sourceOf(Function.prototype.toString, realm), "toString")) {
    findings.push("Function.prototype.toString was replaced");
  }

  return findings;
}

/** Signs of a browser being driven by a script rather than a person. Empty when none. */
export function findAutomation(): string[] {
  if (typeof navigator === "undefined" || typeof window === "undefined") return [];
  // Build-time escape hatch for OUR OWN Playwright runs (never set in a production build).
  if (process.env.NEXT_PUBLIC_INTEGRITY_ALLOW_AUTOMATION === "1") return [];

  const findings: string[] = [];
  const w = window as unknown as Record<string, unknown>;
  const ua = navigator.userAgent;

  if (navigator.webdriver === true) findings.push("navigator.webdriver");
  if (/HeadlessChrome|PhantomJS|Electron\//i.test(ua)) findings.push("headless/embedded user agent");
  for (const key of ["callPhantom", "_phantom", "__nightmare", "__playwright", "__pw_manual", "__pwInitScripts", "__puppeteer_evaluation_script__", "domAutomation", "domAutomationController", "_selenium", "__webdriver_script_fn", "__driver_evaluate", "__webdriver_evaluate"]) {
    if (key in w) findings.push(`window.${key}`);
  }
  if (Array.from(Object.keys(document)).some((k) => /^\$?cdc_|^\$chrome_asyncScriptInfo/.test(k))) findings.push("chromedriver marker");
  if (/Chrome\//.test(ua) && !(w.chrome as unknown) && !/Edg|OPR|Brave|Mobile/.test(ua)) findings.push("Chrome without window.chrome");

  return findings;
}

/** Extensions that put their own scripts or styles into the page (content scripts expose themselves through resource URLs). */
export function findExtensionInjection(): string[] {
  const hosts = new Set<string>();
  const scheme = /^(chrome|moz|safari-web)-extension:\/\/([^/]+)/;

  try {
    for (const entry of performance.getEntriesByType("resource")) {
      const m = scheme.exec(entry.name);
      if (m) hosts.add(m[2]);
    }
    document.querySelectorAll<HTMLElement>("script[src], link[href], iframe[src], img[src]").forEach((el) => {
      const m = scheme.exec(el.getAttribute("src") ?? el.getAttribute("href") ?? "");
      if (m) hosts.add(m[2]);
    });
  } catch {
    /* nothing to report */
  }

  return Array.from(hosts).slice(0, 5);
}
