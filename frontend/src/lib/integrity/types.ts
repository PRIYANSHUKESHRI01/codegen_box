// Shapes shared by the browser-side integrity engine. The server owns the policy and the event catalogue
// (backend/app/Services/Integrity/EventCatalog.php + Profiles.php); this file mirrors only what the browser needs.

/** The five proctored surfaces. The server decides which profile each runs under. */
export type IntegritySurface = "contest" | "interview" | "soft_skill" | "core_test" | "study";

/** Events the BROWSER may report. Server- and Guardian-only types are rejected (and punished) by the server. */
export type WebEventType =
  | "fullscreen_exit"
  | "tab_switch"
  | "devtools_detected"
  | "paste_attempt"
  | "window_blur"
  | "context_menu_blocked"
  | "tab_close_attempt"
  | "focus_lost"
  | "focus_regained"
  | "tamper_detected"
  | "automation_detected"
  | "synthetic_input"
  | "extension_suspected"
  | "multi_monitor"
  | "display_changed"
  | "screen_share_stopped"
  | "screen_share_changed"
  | "camera_lost"
  | "camera_blocked"
  | "camera_frozen"
  | "virtual_camera"
  | "mic_lost"
  | "no_face"
  | "multiple_faces"
  | "face_away"
  | "phone_detected"
  | "speech_detected"
  | "ai_unavailable"
  | "offline_period"
  | "shortcut_blocked"
  | "screenshot_key"
  | "print_attempt";

export interface IntegrityEvent {
  type: WebEventType;
  /** Client clock, ms. The server maps it onto its own clock and never lets it reach into the future or before the previous beat. */
  t: number;
  data?: Record<string, unknown>;
}

export type Requirement = "required" | "optional" | "off";

/** What the server requires of this attempt. Everything here is also enforced or verified server-side. */
export interface IntegrityPolicy {
  profile: string;
  beat_interval: number;
  stale_after: number;
  webcam_snapshot: number;
  screen_snapshot: number;
  screen_share: Requirement;
  camera: Requirement;
  guardian: Requirement;
  chromium_only: boolean;
  block_multi_monitor: boolean;
  focus_loss_strike: number;
  ai: boolean;
  clipboard: "editor_only" | "block_all" | "off";
  stun_servers: string[];
  retention_days: number;
  flagged_retention_days: number;
}

export interface GuardianBlocker {
  type: string;
  title: string;
  fix: string;
  detail: string | null;
}

export interface GuardianSummary {
  mode: Requirement;
  connected: boolean;
  version: string | null;
  outdated: boolean;
  blockers: GuardianBlocker[];
  download_url: string;
  /** What the server is offering at download_url, when it serves the file itself (size in bytes). */
  download?: { version: string | null; size: number; sha256: string } | null;
}

export interface IntegrityBootstrap {
  id: string;
  nonce: string;
  next_batch_id: number;
  status: string;
  assurance: "web" | "guardian";
  marker: string;
  policy: IntegrityPolicy;
  guardian: GuardianSummary;
  session: { status: "active" | "locked" | "completed"; violation_count: number; max_violations: number; locked_at: string | null };
  server_time_ms: number;
}

export interface BatchAck {
  ack: number;
  nonce: string;
  status: string;
  locked: boolean;
  session: IntegrityBootstrap["session"];
  strikes: { type: string; count: number }[];
  guardian: { connected: boolean; fresh: boolean } | null;
  duplicate: boolean;
  server_time_ms: number;
}

export type CheckStatus = "pending" | "working" | "ok" | "warn" | "fail" | "skipped";

export interface PreflightCheck {
  id: "browser" | "tamper" | "camera" | "mic" | "display" | "screen" | "network" | "guardian" | "automation";
  label: string;
  status: CheckStatus;
  required: boolean;
  /** What was found, in a sentence a student understands. */
  detail?: string;
  /** What to do about a failure. */
  fix?: string;
}

/** A blocking layer over the exam: the attempt keeps running on the server, so it must be cleared quickly. */
export interface Hold {
  kind: "screen_share" | "signal" | "camera" | "superseded" | "guardian" | "microphone";
  title: string;
  message: string;
  /** Label of the button that clears it (needs a click — browsers only allow some actions from a user gesture). */
  action?: string;
  /** True when nothing the student can do here helps (the attempt is open somewhere else). */
  final?: boolean;
}
