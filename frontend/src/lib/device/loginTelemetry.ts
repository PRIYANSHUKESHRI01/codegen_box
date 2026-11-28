/**
 * Collects rich browser, laptop/hardware, GPU, OS, and network telemetry at sign-in time.
 * Used for superadmin login security logs and future/optional Laptop + IP binding.
 *
 * Always fail-soft: never throws or blocks login, even in strict privacy browsers
 * or non-secure HTTP contexts where `crypto.subtle` may be unavailable.
 */

export interface LoginDeviceTelemetry {
  device_id: string;
  device_fingerprint: string;
  device_type: "laptop" | "desktop" | "mobile" | "tablet";
  os: string | null;
  os_version: string | null;
  browser: string | null;
  browser_version: string | null;
  platform: string | null;
  architecture: string | null;
  cpu_cores: number | null;
  device_memory_gb: number | null;
  gpu_vendor: string | null;
  gpu_renderer: string | null;
  screen_resolution: string | null;
  color_depth: number | null;
  pixel_ratio: number | null;
  touch_points: number | null;
  timezone: string | null;
  language: string | null;
  languages: string[];
  network_type: string | null;
  effective_type: string | null;
  downlink_mbps: number | null;
  rtt_ms: number | null;
  save_data: boolean | null;
  user_agent_data: Record<string, unknown> | null;
}

const DEVICE_ID_STORAGE_KEY = "aptrun_device_id";

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.length >= 8 && existing.length <= 128) return existing;
    const generated =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `dev_${crypto.randomUUID()}`
        : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return "dev_ephemeral";
  }
}

function getWebGLGpuInfo(): { vendor: string | null; renderer: string | null } {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return { vendor: null, renderer: null };

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      return {
        vendor: typeof vendor === "string" && vendor ? vendor : null,
        renderer: typeof renderer === "string" && renderer ? renderer : null,
      };
    }

    const vendor = gl.getParameter(gl.VENDOR);
    const renderer = gl.getParameter(gl.RENDERER);
    return {
      vendor: typeof vendor === "string" && vendor ? vendor : null,
      renderer: typeof renderer === "string" && renderer ? renderer : null,
    };
  } catch {
    return { vendor: null, renderer: null };
  }
}

function parseUserAgentFallback(ua: string): {
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  os_version: string | null;
  device_type: "laptop" | "desktop" | "mobile" | "tablet";
} {
  let device_type: "laptop" | "desktop" | "mobile" | "tablet" = "laptop";
  if (/iPad|Tablet|Nexus 7|SM-T\d/i.test(ua)) device_type = "tablet";
  else if (/Mobi|iPhone|Android.+Mobile|Windows Phone/i.test(ua)) device_type = "mobile";

  let browser: string | null = null;
  let browser_version: string | null = null;
  const edgeMatch = ua.match(/Edg(?:e|A|iOS)?\/([\d.]+)/);
  const oprMatch = ua.match(/(?:OPR|Opera)\/([\d.]+)/);
  const ffMatch = ua.match(/(?:Firefox|FxiOS)\/([\d.]+)/);
  const chromeMatch = ua.match(/(?:Chrome|CriOS)\/([\d.]+)/);
  const safariMatch = ua.match(/Version\/([\d.]+).*Safari/);

  if (edgeMatch) {
    browser = "Edge";
    browser_version = edgeMatch[1];
  } else if (oprMatch) {
    browser = "Opera";
    browser_version = oprMatch[1];
  } else if (ffMatch) {
    browser = "Firefox";
    browser_version = ffMatch[1];
  } else if (chromeMatch) {
    browser = "Chrome";
    browser_version = chromeMatch[1];
  } else if (safariMatch) {
    browser = "Safari";
    browser_version = safariMatch[1];
  }

  let os: string | null = null;
  let os_version: string | null = null;
  if (/Windows NT 10\.0/i.test(ua)) {
    os = "Windows";
    os_version = "10/11";
  } else if (/Mac OS X ([\d_]+)/i.test(ua)) {
    os = "macOS";
    os_version = (ua.match(/Mac OS X ([\d_]+)/i)?.[1] ?? "").replace(/_/g, ".");
  } else if (/Android ([\d.]+)/i.test(ua)) {
    os = "Android";
    os_version = ua.match(/Android ([\d.]+)/i)?.[1] ?? null;
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = "iOS";
    os_version = (ua.match(/OS ([\d_]+)/i)?.[1] ?? "").replace(/_/g, ".") || null;
  } else if (/CrOS/i.test(ua)) {
    os = "ChromeOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  return { browser, browser_version, os, os_version, device_type };
}

/** Pure-JS deterministic 64-hex hash fallback when `crypto.subtle` is unavailable (e.g. non-HTTPS LAN IP). */
function fallbackHashHex(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  let h3 = 0x85ebca6b;
  let h4 = 0xc2b2ae35;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
    h3 = Math.imul(h3 ^ (ch << 3), 0xc2b2ae35) >>> 0;
    h4 = Math.imul(h4 ^ (ch >>> 1), 0x27d4eb2f) >>> 0;
  }
  return [h1, h2, h3, h4, h1 ^ h3, h2 ^ h4, h1 ^ h2, h3 ^ h4]
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle && typeof TextEncoder !== "undefined") {
      const encoded = new TextEncoder().encode(input);
      const digest = await crypto.subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* fallback below */
  }
  return fallbackHashHex(input);
}

interface NavigatorUADataLike {
  brands?: { brand: string; version: string }[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{
    architecture?: string;
    bitness?: string;
    model?: string;
    platformVersion?: string;
    uaFullVersion?: string;
    fullVersionList?: { brand: string; version: string }[];
  }>;
}

interface NetworkInfoLike {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export async function collectLoginTelemetry(): Promise<LoginDeviceTelemetry | undefined> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return undefined;
  }

  try {
    const ua = navigator.userAgent || "";
    const parsed = parseUserAgentFallback(ua);
    const gpu = getWebGLGpuInfo();
    const deviceId = getOrCreateDeviceId();

    const nav = navigator as Navigator & {
      deviceMemory?: number;
      userAgentData?: NavigatorUADataLike;
      connection?: NetworkInfoLike;
      mozConnection?: NetworkInfoLike;
      webkitConnection?: NetworkInfoLike;
    };

    let os = parsed.os;
    let osVersion = parsed.os_version;
    let browser = parsed.browser;
    let browserVersion = parsed.browser_version;
    let platform = navigator.platform || null;
    let architecture: string | null = null;
    let userAgentData: Record<string, unknown> | null = null;

    const uad = nav.userAgentData;
    if (uad) {
      if (uad.platform) platform = uad.platform;
      if (uad.platform === "Windows") os = "Windows";
      else if (uad.platform === "macOS") os = "macOS";
      else if (uad.platform === "Linux") os = "Linux";

      let high: Awaited<ReturnType<NonNullable<NavigatorUADataLike["getHighEntropyValues"]>>> | null = null;
      if (typeof uad.getHighEntropyValues === "function") {
        high = await Promise.race([
          uad.getHighEntropyValues(["architecture", "bitness", "model", "platformVersion", "fullVersionList"]).catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 150)),
        ]);
      }

      if (high) {
        if (high.architecture) {
          architecture = high.bitness ? `${high.architecture} (${high.bitness}-bit)` : high.architecture;
        }
        if (os === "Windows" && high.platformVersion) {
          const major = parseInt(high.platformVersion.split(".")[0] ?? "0", 10);
          if (!Number.isNaN(major)) osVersion = major >= 13 ? "11" : "10";
        } else if (high.platformVersion && !osVersion) {
          osVersion = high.platformVersion;
        }

        const primaryBrand = (high.fullVersionList ?? uad.brands ?? []).find(
          (b) => b.brand && !/Not.*Brand/i.test(b.brand) && !/Chromium/i.test(b.brand)
        );
        if (primaryBrand) {
          browser = primaryBrand.brand.replace("Google ", "").replace("Microsoft ", "");
          browserVersion = primaryBrand.version;
        }

        userAgentData = {
          platform: uad.platform ?? null,
          mobile: uad.mobile ?? null,
          architecture: high.architecture ?? null,
          bitness: high.bitness ?? null,
          model: high.model ?? null,
          platformVersion: high.platformVersion ?? null,
        };
      }
    }

    const screenWidth = typeof screen !== "undefined" ? screen.width : null;
    const screenHeight = typeof screen !== "undefined" ? screen.height : null;
    const pixelRatio = typeof window.devicePixelRatio === "number" ? Number(window.devicePixelRatio.toFixed(2)) : null;
    const colorDepth = typeof screen !== "undefined" ? screen.colorDepth : null;
    const screenResolution =
      screenWidth && screenHeight ? `${screenWidth}x${screenHeight}${pixelRatio ? ` @ ${pixelRatio}x` : ""}` : null;

    let timezone: string | null = null;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      timezone = null;
    }

    const cpuCores = typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null;
    const deviceMemoryGb = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
    const touchPoints = typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : null;

    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    const networkType = conn?.type ?? null;
    const effectiveType = conn?.effectiveType ?? null;
    const downlinkMbps = typeof conn?.downlink === "number" ? conn.downlink : null;
    const rttMs = typeof conn?.rtt === "number" ? conn.rtt : null;
    const saveData = typeof conn?.saveData === "boolean" ? conn.saveData : null;

    // Hardware + OS + display signature for deterministic laptop identification across sessions
    const fingerprintSource = [
      gpu.vendor ?? "",
      gpu.renderer ?? "",
      String(cpuCores ?? ""),
      String(deviceMemoryGb ?? ""),
      String(screenWidth ?? ""),
      String(screenHeight ?? ""),
      String(colorDepth ?? ""),
      platform ?? "",
      architecture ?? "",
      timezone ?? "",
    ].join("|");

    const deviceFingerprint = await sha256Hex(fingerprintSource);

    return {
      device_id: deviceId,
      device_fingerprint: deviceFingerprint,
      device_type: parsed.device_type,
      os,
      os_version: osVersion,
      browser,
      browser_version: browserVersion,
      platform,
      architecture,
      cpu_cores: cpuCores,
      device_memory_gb: deviceMemoryGb,
      gpu_vendor: gpu.vendor,
      gpu_renderer: gpu.renderer,
      screen_resolution: screenResolution,
      color_depth: colorDepth,
      pixel_ratio: pixelRatio,
      touch_points: touchPoints,
      timezone,
      language: navigator.language || null,
      languages: Array.isArray(navigator.languages) ? [...navigator.languages].slice(0, 6) : [],
      network_type: networkType,
      effective_type: effectiveType,
      downlink_mbps: downlinkMbps,
      rtt_ms: rttMs,
      save_data: saveData,
      user_agent_data: userAgentData,
    };
  } catch {
    return undefined;
  }
}
