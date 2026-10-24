// Mirrors backend/app/Models/ProctoringViolation.php's TYPES/STRIKE_TYPES —
// keep these two lists in sync if either side changes. The exam-integrity layer
// (lib/integrity, backend App\Services\Integrity\EventCatalog) adds many more
// event types; the labels below cover everything a student can be shown.
export type LegacyViolationType =
  | "fullscreen_exit"
  | "tab_switch"
  | "devtools_detected"
  | "paste_attempt"
  | "window_blur"
  | "context_menu_blocked"
  | "tab_close_attempt";

/** Anything the server can name in a strike: the original seven plus the integrity layer's. (Open-ended on purpose.) */
export type ViolationType = LegacyViolationType | (string & {});

export const STRIKE_VIOLATION_TYPES: LegacyViolationType[] = ["fullscreen_exit", "tab_switch", "devtools_detected"];

export const VIOLATION_LABEL: Record<string, string> = {
  fullscreen_exit: "Exited fullscreen",
  tab_switch: "Switched tab or window",
  devtools_detected: "Developer tools opened",
  paste_attempt: "Attempted to paste",
  window_blur: "Window lost focus",
  context_menu_blocked: "Right-click blocked",
  tab_close_attempt: "Attempted to close or navigate away",
  focus_lost: "Left the exam window",
  tamper_detected: "Proctoring code was tampered with",
  automation_detected: "Browser automation detected",
  synthetic_input: "Scripted keystrokes",
  multi_monitor: "A second screen was connected",
  screen_share_stopped: "Screen sharing was stopped",
  screen_share_changed: "Shared a window instead of the entire screen",
  camera_lost: "Camera stopped",
  camera_blocked: "Camera covered",
  virtual_camera: "Software camera in use",
  multiple_faces: "More than one person in view",
  telemetry_gap: "Proctoring signal was lost",
  guardian_gap: "Guardian signal was lost",
  network_not_allowed: "Outside the exam network",
  os_foreground_away: "Another application took the foreground",
  forbidden_process: "A program that is not allowed was opened",
  remote_session: "Remote desktop session",
  overlay_window: "Overlay on top of the exam",
  capture_excluded_window: "A window hidden from screen sharing",
  proxy_detected: "Traffic goes through a proxy",
  vpn_detected: "VPN active",
  root_ca_added: "Security certificate installed",
  hosts_modified: "Network settings edited",
  injected_input: "Keystrokes injected by software",
  guardian_page_mismatch: "Page and computer disagree",
  guardian_host_mismatch: "Guardian is on a different computer",
};

export function violationLabel(type: string): string {
  return VIOLATION_LABEL[type] ?? type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

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
