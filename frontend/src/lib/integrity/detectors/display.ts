import type { WebEventType } from "../types";

type Emit = (type: WebEventType, data?: Record<string, unknown>) => void;

interface ScreenWithExtended extends Screen {
  isExtended?: boolean;
}

/** How many screens make up the desktop. null = this browser will not say. */
export function monitorCount(): number | null {
  const s = window.screen as ScreenWithExtended;
  if (typeof s.isExtended !== "boolean") return null;

  return s.isExtended ? 2 : 1;
}

/** True when the desktop spans more than one screen (a second monitor, a projector, a virtual display set to "extend"). */
export function isExtendedDesktop(): boolean {
  return (window.screen as ScreenWithExtended).isExtended === true;
}

const key = () => `${screen.width}x${screen.height}@${Math.round(window.devicePixelRatio * 100) / 100}`;

/**
 * A second screen is the easiest legitimate-looking cheat — fullscreen stays on one monitor while the answers sit on the
 * other and nothing is ever hidden. This watches `screen.isExtended` (no permission prompt) for it appearing, and the
 * screen geometry for changing (a laptop docked mid-attempt, a virtual display attached, split-screen scaling).
 * Mirrored displays are not "extended" and are fine — they show the same picture.
 */
export function installDisplayDetector(emit: Emit, o: { checkMultiMonitor: boolean }): () => void {
  let extended = isExtendedDesktop();
  let baseline = key();
  let lastChangeAt = 0;

  const check = () => {
    if (o.checkMultiMonitor) {
      const now = isExtendedDesktop();
      if (now && !extended) emit("multi_monitor", { extended: true });
      extended = now;
    }

    const current = key();
    if (current !== baseline && Date.now() - lastChangeAt > 30_000) {
      lastChangeAt = Date.now();
      emit("display_changed", { from: baseline, to: current });
      baseline = current;
    }
  };

  const timer = window.setInterval(check, 2000);
  const onChange = () => check();
  (window.screen as ScreenWithExtended & EventTarget).addEventListener?.("change", onChange);

  return () => {
    window.clearInterval(timer);
    (window.screen as ScreenWithExtended & EventTarget).removeEventListener?.("change", onChange);
  };
}
