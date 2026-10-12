import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFS,
  KEY_STEP,
  KEY_STEP_LARGE,
  PANEL_MAX,
  PANEL_MIN,
  PREVIEW_MAX,
  PREVIEW_MIN,
  clamp,
  parsePrefs,
  resizeByKey,
} from "@/lib/projectLabLayout";

describe("clamp", () => {
  it("keeps a value inside the range and rounds to whole pixels", () => {
    expect(clamp(100, 280, 760)).toBe(280);
    expect(clamp(900, 280, 760)).toBe(760);
    expect(clamp(400.6, 280, 760)).toBe(401);
  });
});

describe("parsePrefs", () => {
  it("falls back to the defaults for nothing, garbage or the wrong shape", () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("{not json")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("42")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs("null")).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('["panelOpen"]')).toEqual(DEFAULT_PREFS);
  });

  it("returns a copy, so changing the result can never change the shared defaults", () => {
    const prefs = parsePrefs(null);
    prefs.panelOpen = false;
    expect(DEFAULT_PREFS.panelOpen).toBe(true);
  });

  it("restores what was saved", () => {
    const saved = { panelOpen: false, panelWidth: 420, previewWidth: 500, focus: true, tipDismissed: true };
    expect(parsePrefs(JSON.stringify(saved))).toEqual(saved);
  });

  it("keeps the good fields of a partly valid record and defaults the rest", () => {
    expect(parsePrefs(JSON.stringify({ focus: true, panelOpen: "yes", tipDismissed: 1 }))).toEqual({ ...DEFAULT_PREFS, focus: true });
  });

  it("pulls out-of-range widths back inside the limits and drops non-numbers", () => {
    const wide = parsePrefs(JSON.stringify({ panelWidth: 5000, previewWidth: 10 }));
    expect(wide.panelWidth).toBe(PANEL_MAX);
    expect(wide.previewWidth).toBe(PREVIEW_MIN);

    const narrow = parsePrefs(JSON.stringify({ panelWidth: 3, previewWidth: 99999 }));
    expect(narrow.panelWidth).toBe(PANEL_MIN);
    expect(narrow.previewWidth).toBe(PREVIEW_MAX);

    const junk = parsePrefs(JSON.stringify({ panelWidth: "wide", previewWidth: null }));
    expect(junk.panelWidth).toBeNull();
    expect(junk.previewWidth).toBeNull();
  });
});

describe("resizeByKey", () => {
  // A pane on the LEFT of its divider (direction 1) grows to the right.
  it("grows a left-hand pane with ArrowRight and shrinks it with ArrowLeft", () => {
    expect(resizeByKey(400, "ArrowRight", false, PANEL_MIN, PANEL_MAX, 1)).toBe(400 + KEY_STEP);
    expect(resizeByKey(400, "ArrowLeft", false, PANEL_MIN, PANEL_MAX, 1)).toBe(400 - KEY_STEP);
  });

  // A pane on the RIGHT of its divider (direction -1) grows to the left.
  it("grows a right-hand pane with ArrowLeft", () => {
    expect(resizeByKey(500, "ArrowLeft", false, PREVIEW_MIN, PREVIEW_MAX, -1)).toBe(500 + KEY_STEP);
    expect(resizeByKey(500, "ArrowRight", false, PREVIEW_MIN, PREVIEW_MAX, -1)).toBe(500 - KEY_STEP);
  });

  it("takes bigger steps with Shift", () => {
    expect(resizeByKey(400, "ArrowRight", true, PANEL_MIN, PANEL_MAX, 1)).toBe(400 + KEY_STEP_LARGE);
  });

  it("never leaves the allowed range", () => {
    expect(resizeByKey(PANEL_MAX - 5, "ArrowRight", false, PANEL_MIN, PANEL_MAX, 1)).toBe(PANEL_MAX);
    expect(resizeByKey(PANEL_MIN + 5, "ArrowLeft", true, PANEL_MIN, PANEL_MAX, 1)).toBe(PANEL_MIN);
  });

  it("jumps to the limits with Home and End", () => {
    expect(resizeByKey(400, "Home", false, PANEL_MIN, PANEL_MAX, 1)).toBe(PANEL_MIN);
    expect(resizeByKey(400, "End", false, PANEL_MIN, PANEL_MAX, 1)).toBe(PANEL_MAX);
  });

  it("ignores every other key", () => {
    expect(resizeByKey(400, "a", false, PANEL_MIN, PANEL_MAX, 1)).toBeNull();
    expect(resizeByKey(400, "ArrowUp", false, PANEL_MIN, PANEL_MAX, 1)).toBeNull();
    expect(resizeByKey(400, "Tab", true, PANEL_MIN, PANEL_MAX, 1)).toBeNull();
  });
});
