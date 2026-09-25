// Mirrors backend/app/Models/ProctoringViolation.php's TYPES/STRIKE_TYPES —
// keep these two lists in sync if either side changes.
export type ViolationType =
  | "fullscreen_exit"
  | "tab_switch"
  | "devtools_detected"
  | "paste_attempt"
  | "window_blur"
  | "context_menu_blocked"
  | "tab_close_attempt";

export const STRIKE_VIOLATION_TYPES: ViolationType[] = ["fullscreen_exit", "tab_switch", "devtools_detected"];

export const VIOLATION_LABEL: Record<ViolationType, string> = {
  fullscreen_exit: "Exited fullscreen",
  tab_switch: "Switched tab or window",
  devtools_detected: "Developer tools opened",
  paste_attempt: "Attempted to paste",
  window_blur: "Window lost focus",
  context_menu_blocked: "Right-click blocked",
  tab_close_attempt: "Attempted to close or navigate away",
};

export type ProctoringPhase =
  | "idle" // not yet enabled (problem still loading)
  | "consent" // showing the consent/device-check gate
  | "starting" // consent granted, requesting camera/mic/fullscreen, calling /start
  | "active" // recording + monitoring live
  | "fullscreen_lost" // was active, exited fullscreen — blocking "resume" prompt
  | "locked" // 3 strikes — contest access ends
  | "blocked" // couldn't get camera/mic/fullscreen — never entered
  | "completed" // candidate finished every question normally — camera/mic/fullscreen torn down, not a violation
  | "error";

// Mirrors ContestProctoringController::sessionPayload()'s exact JSON keys —
// snake_case like every other API response type in this codebase (see
// ContestSummary in liveContest.ts). Previously declared as camelCase here,
// which silently meant violation_count/max_violations were always
// `undefined` on the client — the strike counter and violation toast never
// actually displayed a real count.
export interface ProctoringSessionState {
  status: "active" | "locked" | "completed";
  violation_count: number;
  max_violations: number;
  locked_at: string | null;
}

export interface DeviceInfo {
  user_agent: string;
  platform: string;
  screen_width: number;
  screen_height: number;
  language: string;
  timezone: string;
}
