import type { WebEventType } from "../types";

type Emit = (type: WebEventType, data?: Record<string, unknown>) => void;

/** Same-type events inside this window are one event: one real Alt-Tab fires blur, visibilitychange and sometimes a fullscreen change. */
const DEDUPE_MS = 1500;
/** Backup for the platforms where losing focus to an overlay window never fires `blur`. */
const POLL_MS = 400;

export interface FocusOptions {
  /** Seconds the exam window may stay unfocused before it is a strike. 0 = never a strike (still logged). */
  focusLossStrikeSeconds: number;
  /** The page left fullscreen: the engine puts up the blocking "resume" layer. */
  onFullscreenExit: () => void;
  now?: () => number;
}

/**
 * Everything that means "the student is not looking at the exam": the tab hidden, the window unfocused (including
 * overlays that steal focus without a blur event, found by polling `document.hasFocus()`), fullscreen left, and the
 * page being closed. The old detector counted `window_blur` as informational only — which made a second monitor free:
 * clicking onto the other screen blurs the window but hides nothing. A blur that lasts longer than the policy allows
 * is now a `focus_lost`, which the server prices as a strike.
 */
export function installFocusDetector(emit: Emit, o: FocusOptions): () => void {
  const now = o.now ?? (() => Date.now());
  const last: Record<string, number> = {};
  const once = (type: WebEventType, data?: Record<string, unknown>) => {
    const t = now();
    if (t - (last[type] ?? 0) < DEDUPE_MS) return;
    last[type] = t;
    emit(type, data);
  };

  let blurredAt: number | null = null;
  let lossTimer: number | null = null;
  let lossReported = false;

  const startBlur = () => {
    if (blurredAt !== null) return;
    blurredAt = now();
    lossReported = false;
    once("window_blur");

    if (o.focusLossStrikeSeconds > 0) {
      lossTimer = window.setTimeout(() => {
        if (blurredAt !== null && !document.hasFocus()) {
          lossReported = true;
          emit("focus_lost", { duration_ms: now() - blurredAt });
        }
      }, o.focusLossStrikeSeconds * 1000);
    }
  };

  const endBlur = () => {
    if (blurredAt === null) return;
    const duration = now() - blurredAt;
    blurredAt = null;
    if (lossTimer !== null) window.clearTimeout(lossTimer);
    lossTimer = null;
    if (lossReported) emit("focus_regained", { duration_ms: duration });
    lossReported = false;
  };

  const onVisibility = () => {
    if (document.hidden) once("tab_switch");
  };
  const onFullscreen = () => {
    if (!document.fullscreenElement) {
      once("fullscreen_exit");
      o.onFullscreenExit();
    }
  };
  const onBlur = () => startBlur();
  const onFocus = () => endBlur();
  const poll = window.setInterval(() => {
    const focused = document.hasFocus();
    if (!focused) startBlur();
    else endBlur();
  }, POLL_MS);

  // beforeunload: the page is going away mid-attempt. The transport sends one last batch with keepalive; here we only name it.
  const onBeforeUnload = () => emit("tab_close_attempt");

  document.addEventListener("visibilitychange", onVisibility);
  document.addEventListener("fullscreenchange", onFullscreen);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("fullscreenchange", onFullscreen);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("beforeunload", onBeforeUnload);
    window.clearInterval(poll);
    if (lossTimer !== null) window.clearTimeout(lossTimer);
  };
}
