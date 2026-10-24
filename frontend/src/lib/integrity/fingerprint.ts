/**
 * Who is on the other end — as far as a browser can say.
 *
 *   did  a random id this browser profile keeps for itself (localStorage + IndexedDB, so clearing one is not enough). The
 *        SAME `did` on two accounts at once is one browser profile, i.e. one person taking two attempts or lending a login.
 *        Different lab PCs get different ids even when their hardware is identical — which a pure hardware fingerprint
 *        cannot do — so the server can use it without flagging a lab full of identical machines.
 *   fp   SHA-256 over the `did` plus things that do not change during an attempt (browser family, platform, cores, memory,
 *        screen size, time zone, GPU). The server stores the first and records `device_changed` if a later batch differs.
 *
 * Neither is a secret and neither is proof of identity; they make "moved to another machine mid-attempt" visible.
 */

const KEY = "aptrun.did";
const DB = "aptrun-integrity";
const STORE = "kv";

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

function idbGet(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore(STORE);
      open.onerror = () => resolve(null);
      open.onsuccess = () => {
        try {
          const req = open.result.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
          req.onsuccess = () => resolve(typeof req.result === "string" ? req.result : null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

function idbSet(value: string): void {
  try {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => {
      try {
        open.result.transaction(STORE, "readwrite").objectStore(STORE).put(value, KEY);
      } catch {
        /* storage is best effort */
      }
    };
  } catch {
    /* storage is best effort */
  }
}

let memo: string | null = null;

/** The browser profile's persistent random id (created on first use, kept in two stores). */
export async function deviceId(): Promise<string> {
  if (memo) return memo;

  let value: string | null = null;
  try {
    value = window.localStorage.getItem(KEY);
  } catch {
    /* storage may be blocked */
  }
  if (!value) value = await idbGet();
  if (!value || !/^[a-f0-9]{32}$/.test(value)) value = randomHex(16);

  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* storage may be blocked */
  }
  idbSet(value);

  memo = value;
  return value;
}

export function resetDeviceIdMemo(): void {
  memo = null;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function gpu(): string {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    return ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
  } catch {
    return "";
  }
}

/** Browser family without the version (a mid-attempt auto-update must not read as a different browser). */
export function browserFamily(ua: string = navigator.userAgent): string {
  return ua.replace(/\d+([._]\d+)*/g, "").slice(0, 160);
}

export async function deviceFingerprint(): Promise<{ did: string; fp: string }> {
  const did = await deviceId();
  const nav = navigator as Navigator & { deviceMemory?: number };
  const parts = [
    did,
    browserFamily(),
    navigator.platform,
    String(navigator.hardwareConcurrency ?? ""),
    String(nav.deviceMemory ?? ""),
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    gpu(),
  ];

  return { did: await sha256Hex(`did:${did}`).then((h) => h.slice(0, 32)), fp: (await sha256Hex(parts.join("|"))).slice(0, 48) };
}

/** A fresh per-page-load id; the server lets only the newest one report an attempt. */
export function newInstanceId(): string {
  return `i${randomHex(10)}`;
}
