/**
 * Layout rules for the Project Lab workspace page: how wide the guide panel and
 * the preview may be, how the student's choices are remembered, and how the
 * keyboard resizes a divider. Kept free of React so the rules are unit-tested.
 */

export const PANEL_MIN = 280;
export const PANEL_MAX = 760;
/** Default guide width per tab: the SOW is prose and wants more room than a checklist. */
export const PANEL_DEFAULT = 360;
export const PANEL_DEFAULT_SOW = 480;

export const PREVIEW_MIN = 320;
export const PREVIEW_MAX = 1100;

export const KEY_STEP = 24;
export const KEY_STEP_LARGE = 96;

export interface WorkspacePrefs {
  /** Guide panel open (desktop). */
  panelOpen: boolean;
  /** Guide width in px once the student has dragged it; null = the default for the tab. */
  panelWidth: number | null;
  /** Preview width in px once dragged; null = about 42% of the editor area. */
  previewWidth: number | null;
  /** Focus mode: the dashboard sidebar and header hidden. */
  focus: boolean;
  /** The quick-start tip above the editor was dismissed. */
  tipDismissed: boolean;
}

export const DEFAULT_PREFS: WorkspacePrefs = {
  panelOpen: true,
  panelWidth: null,
  previewWidth: null,
  focus: false,
  tipDismissed: false,
};

export const PREFS_KEY = "aptrun.projectLab.workspaceUi";

export function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

function width(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, min, max) : null;
}

/** Tolerant on purpose: whatever is in storage (old version, hand-edited, corrupt) must never break the page. */
export function parsePrefs(raw: string | null): WorkspacePrefs {
  if (!raw) return { ...DEFAULT_PREFS };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_PREFS };
  }
  if (typeof data !== "object" || data === null) return { ...DEFAULT_PREFS };

  const d = data as Record<string, unknown>;
  return {
    panelOpen: typeof d.panelOpen === "boolean" ? d.panelOpen : DEFAULT_PREFS.panelOpen,
    panelWidth: width(d.panelWidth, PANEL_MIN, PANEL_MAX),
    previewWidth: width(d.previewWidth, PREVIEW_MIN, PREVIEW_MAX),
    focus: typeof d.focus === "boolean" ? d.focus : DEFAULT_PREFS.focus,
    tipDismissed: typeof d.tipDismissed === "boolean" ? d.tipDismissed : DEFAULT_PREFS.tipDismissed,
  };
}

export function loadPrefs(): WorkspacePrefs {
  try {
    return parsePrefs(window.localStorage.getItem(PREFS_KEY));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: WorkspacePrefs): void {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode or storage blocked: the layout simply isn't remembered */
  }
}

/**
 * The new size after an arrow/Home/End key on a divider, or null when the key
 * means nothing to it. `direction` is which way the pane GROWS: 1 when the
 * pane sits left of the divider (ArrowRight grows it), -1 when it sits right
 * of it (ArrowLeft grows it).
 */
export function resizeByKey(size: number, key: string, shift: boolean, min: number, max: number, direction: 1 | -1): number | null {
  const step = shift ? KEY_STEP_LARGE : KEY_STEP;

  switch (key) {
    case "ArrowRight":
      return clamp(size + direction * step, min, max);
    case "ArrowLeft":
      return clamp(size - direction * step, min, max);
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
}
