import type { WebEventType } from "../types";

type Emit = (type: WebEventType, data?: Record<string, unknown>) => void;

/** Docked developer tools shrink the page inside the window; this much is far more than any toolbar. */
export const DEVTOOLS_SIZE_THRESHOLD_PX = 160;
/** A `debugger` statement that takes longer than this was paused by an attached debugger. */
const DEBUGGER_PAUSE_MS = 120;
const CHECK_MS = 1000;

/** Pure: does the window/page size gap look like docked devtools? Only meaningful while the page is fullscreen. */
export function sizeGapSuggestsDevtools(outerW: number, outerH: number, innerW: number, innerH: number): boolean {
  return outerW - innerW > DEVTOOLS_SIZE_THRESHOLD_PX || outerH - innerH > DEVTOOLS_SIZE_THRESHOLD_PX;
}

/**
 * Three independent signs that developer tools are open, so closing one panel layout or undocking does not hide it:
 *
 *   1. size gap      docked tools shrink the viewport (checked only in fullscreen, where a browser has no other chrome)
 *   2. debugger      a Web Worker runs `debugger;` once a second. With tools closed it costs nothing; with tools open the
 *                    worker pauses at the statement and the elapsed time gives it away. It runs in a WORKER so the page
 *                    itself never freezes.
 *   3. console probe an element with a getter on `id` is logged; an open console reads the property to draw the preview.
 *
 * A finding is reported when it is seen on two consecutive checks (once per time the tools are opened), so a stray
 * layout change is not a strike. Honest limit: a student can disable breakpoints and undock the tools, which defeats 1
 * and 2; the Guardian (process / window level) and the evidence stills are what back this up.
 */
export function installDevtoolsDetector(emit: Emit, now: () => number = () => performance.now()): () => void {
  let worker: Worker | null = null;
  let workerUrl: string | null = null;
  let lastPauseMs = 0;
  let consoleHit = false;

  try {
    const source = "setInterval(function(){var t=performance.now();debugger;postMessage(performance.now()-t)},1000)";
    workerUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    worker = new Worker(workerUrl);
    worker.onmessage = (e: MessageEvent<number>) => {
      lastPauseMs = Number(e.data) || 0;
    };
  } catch {
    worker = null; // blocked by policy: signals 1 and 3 still work
  }

  const probe = new Image();
  Object.defineProperty(probe, "id", {
    get() {
      consoleHit = true;

      return "";
    },
  });

  let open = false;
  let streak = 0;

  const check = () => {
    consoleHit = false;
    // eslint-disable-next-line no-console
    console.debug(probe);

    const reasons: string[] = [];
    if (document.fullscreenElement && sizeGapSuggestsDevtools(window.outerWidth, window.outerHeight, window.innerWidth, window.innerHeight)) reasons.push("size");
    if (lastPauseMs > DEBUGGER_PAUSE_MS) reasons.push("debugger");
    if (consoleHit) reasons.push("console");
    lastPauseMs = 0;

    streak = reasons.length > 0 ? streak + 1 : 0;
    const nowOpen = streak >= 2;

    if (nowOpen && !open) emit("devtools_detected", { signals: reasons, t: Math.round(now()) });
    open = nowOpen;
  };

  const timer = window.setInterval(check, CHECK_MS);

  return () => {
    window.clearInterval(timer);
    worker?.terminate();
    if (workerUrl) URL.revokeObjectURL(workerUrl);
  };
}
