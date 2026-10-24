"use client";

import { useSyncExternalStore } from "react";
import type { GuardianSummary, Hold, IntegrityPolicy, PreflightCheck } from "./types";

/**
 * What the proctoring UI needs beyond the original hook result: the pre-flight checklist, a blocking "hold" (screen
 * share stopped, signal lost, …), the Guardian card, and the assurance badge. One attempt is on screen at a time, so
 * this is a module-level store the integrity engine writes and the consent gate / overlay read — which is what lets
 * the five proctored pages keep their existing hook contract unchanged.
 */
export interface GuardianUi {
  mode: "required" | "optional" | "off";
  summary: GuardianSummary | null;
  /** The one-time code + deep link while pairing is in progress. */
  pairing: { code: string; deepLink: string; downloadUrl: string; expiresAt: string } | null;
  busy: boolean;
  error: string | null;
}

export interface IntegrityUiState {
  /** An engine is attached (the attempt's gate or exam is on screen). */
  attached: boolean;
  policy: IntegrityPolicy | null;
  checks: PreflightCheck[];
  hold: Hold | null;
  guardian: GuardianUi;
  assurance: "web" | "guardian" | null;
  /** Short per-attempt marker shown in the window title — what the Guardian looks for. */
  marker: string | null;
  ai: "off" | "loading" | "ready" | "unavailable";
  /** Stills sent as evidence so far this attempt (shown to the student: nothing is sent silently). */
  stillsSent: number;
  screenShared: boolean;
  /** What the gate and the hold layer can ask the engine to do (each needs a click, so it runs from their buttons). */
  actions: { shareScreen: () => void; connectGuardian: () => void; resolveHold: () => void } | null;
}

const INITIAL: IntegrityUiState = {
  attached: false,
  policy: null,
  checks: [],
  hold: null,
  guardian: { mode: "off", summary: null, pairing: null, busy: false, error: null },
  assurance: null,
  marker: null,
  ai: "off",
  stillsSent: 0,
  screenShared: false,
  actions: null,
};

let state: IntegrityUiState = INITIAL;
const listeners = new Set<() => void>();

export function getIntegrityUi(): IntegrityUiState {
  return state;
}

export function setIntegrityUi(patch: Partial<IntegrityUiState> | ((s: IntegrityUiState) => Partial<IntegrityUiState>)): void {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function resetIntegrityUi(): void {
  state = INITIAL;
  listeners.forEach((l) => l());
}

/** Updates one check in place (adds it when missing, keeping the display order stable by `order`). */
export function setCheck(check: PreflightCheck): void {
  const order: PreflightCheck["id"][] = ["browser", "tamper", "automation", "camera", "mic", "display", "screen", "network", "guardian"];
  setIntegrityUi((s) => {
    const rest = s.checks.filter((c) => c.id !== check.id);
    const checks = [...rest, check].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return { checks };
  });
}

export function useIntegrityUi(): IntegrityUiState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getIntegrityUi,
    () => INITIAL
  );
}

/** True when every REQUIRED check has passed (warnings do not block). */
export function checksPass(checks: PreflightCheck[]): boolean {
  return checks.every((c) => !c.required || c.status === "ok" || c.status === "skipped");
}
