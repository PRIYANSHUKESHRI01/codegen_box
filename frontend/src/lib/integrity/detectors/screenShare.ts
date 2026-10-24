export interface ShareResult {
  stream: MediaStream;
  /** What the browser says was shared: "monitor" (the whole screen), "window", "browser" (a tab) — Chromium only. */
  surface: "monitor" | "window" | "browser" | "unknown";
}

export class ShareError extends Error {
  constructor(
    message: string,
    readonly kind: "cancelled" | "wrong_surface" | "unsupported" | "other"
  ) {
    super(message);
  }
}

export function supportsScreenShare(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

/** Chromium reports what was shared; Firefox and Safari do not, so a strict profile cannot rely on them. */
export function isChromium(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } };
  const brands = nav.userAgentData?.brands?.map((b) => b.brand).join(",") ?? "";

  return /Chromium|Google Chrome|Microsoft Edge|Brave|Opera/i.test(brands) || /Chrome\/|Edg\//.test(navigator.userAgent);
}

/**
 * Asks the student to share their ENTIRE screen. The request is worded so the picker offers screens first and hides this
 * very tab; afterwards the browser's own report of what was chosen is checked — a window or a tab is refused, because a
 * shared window shows only what the student chooses to put in it.
 *
 * Must be called from a click (browsers refuse otherwise).
 */
export async function requestEntireScreen(opts: { requireVerifiableSurface: boolean }): Promise<ShareResult> {
  if (!supportsScreenShare()) throw new ShareError("This browser can't share the screen. Use a recent Chrome or Edge on a computer.", "unsupported");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "monitor", frameRate: { ideal: 2, max: 5 }, width: { max: 1920 }, height: { max: 1080 } },
      audio: false,
      // Chromium-only hints: start the picker on screens, hide this tab, and refuse switching to another surface later.
      selfBrowserSurface: "exclude",
      surfaceSwitching: "exclude",
      monitorTypeSurfaces: "include",
      preferCurrentTab: false,
    } as DisplayMediaStreamOptions);
  } catch (err) {
    const name = err instanceof DOMException ? err.name : "";
    if (name === "NotAllowedError" || name === "AbortError") {
      throw new ShareError("Screen sharing was cancelled. Choose \"Entire screen\", select your screen, and press Share.", "cancelled");
    }

    throw new ShareError("Couldn't start screen sharing. Please try again.", "other");
  }

  const track = stream.getVideoTracks()[0];
  const surface = ((track?.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface ?? "unknown") as ShareResult["surface"];

  if (surface === "window" || surface === "browser") {
    stream.getTracks().forEach((t) => t.stop());
    throw new ShareError(`You shared ${surface === "window" ? "a single window" : "a browser tab"}. Share your ENTIRE screen instead: choose the "Entire screen" tab, pick your screen and press Share.`, "wrong_surface");
  }

  if (surface === "unknown" && opts.requireVerifiableSurface) {
    stream.getTracks().forEach((t) => t.stop());
    throw new ShareError("This browser can't confirm that your entire screen is shared. Use Chrome or Edge.", "unsupported");
  }

  return { stream, surface };
}
