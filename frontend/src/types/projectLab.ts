// Mirrors the JSON returned by the Project Lab endpoints (backend
// ProjectLabController / ProjectWorkspaceController / AdminProjectLabController
// and App\Services\ProjectLab\ProjectLabPresenter). `code` values on a failed
// request (ApiError.code) are listed in PROJECT_LAB_ERROR below.

import type { PlanPricing } from "./pricing";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type TopicStatus = "draft" | "published" | "archived";
export type EnrollmentStatus = "active" | "submitted" | "reviewed" | "abandoned";
export type SubmissionStatus = "pending_review" | "in_review" | "reviewed" | "needs_changes";
export type WorkspaceStatus = "starting" | "running" | "stopped" | "failed" | "destroyed";

/** Stable machine codes the API adds next to `message` — switch on these, never on the text. */
export const PROJECT_LAB_ERROR = {
  required: "project_lab_required",
  hoursExhausted: "workspace_hours_exhausted",
  activeProjectsFull: "active_projects_full",
  capacity: "workspace_capacity",
  hostError: "workspace_host_error",
  notRunning: "workspace_not_running",
  disabled: "workspaces_disabled",
  priceChanged: "price_changed",
  snapshotTooLarge: "snapshot_too_large",
} as const;

export interface ProjectLabSummary {
  /** May use Project Lab right now (SOW body, PDF, workspace, submit). */
  enabled: boolean;
  source: "addon" | "plan" | "institution" | "none";
  plan: { code: string; name: string } | null;
  days_remaining: number | null;
  period_ends_at: string | null;
  hours: { limit: number | null; used: number; remaining: number | null };
  projects: { limit: number | null; active: number };
  /**
   * The plan that includes Project Lab (Expert), with its live price — what the lock screen offers.
   * null when that plan isn't on sale. `workspace_hours` / `active_projects` are what it includes; null = unlimited.
   */
  upgrade: (PlanPricing & { workspace_hours: number | null; active_projects: number | null }) | null;
}

export interface ProjectCardData {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  difficulty: Difficulty;
  estimated_hours: number;
  tech_stack: string[];
  outcomes: string[];
  icon: string | null;
  is_free_sample: boolean;
  milestone_count: number;
  enrollment: { id: number; status: EnrollmentStatus; milestones_done: number; milestones_total: number } | null;
}

export interface ProjectMilestoneData {
  id: number;
  position: number;
  title: string;
  estimated_hours: number;
  /** Withheld (null / []) until the student has Project Lab. */
  description: string | null;
  acceptance_criteria: string[];
}

export interface ProjectTopicDetail extends ProjectCardData {
  sow_version: number;
  has_sow: boolean;
  sow_locked: boolean;
  sow_markdown: string | null;
  can_download_sow: boolean;
  milestones: ProjectMilestoneData[];
}

export interface WorkspaceState {
  id: number;
  status: WorkspaceStatus;
  ready: boolean;
  /** Editor URL including the access token; null unless the workspace is live. */
  ide_url: string | null;
  /** e.g. https://p{port}--ws-abc.ws.example.com/ — replace {port}. */
  preview_url_template: string | null;
  ide_port: number;
  /** What the editor's paste guard does for this project (set by the server; the page relays it to the guard). */
  guard_mode: "enforce" | "report" | "open";
  stop_reason: "user" | "submitted" | "idle" | "max_session" | "lapsed" | "hours_exhausted" | "disk_full" | "host_error" | null;
  error: string | null;
  started_at: string | null;
  disk_mb: number | null;
}

export interface SubmissionData {
  id: number;
  attempt: number;
  status: SubmissionStatus;
  score: number | null;
  rubric: { criterion: string; score: number; max: number }[];
  feedback: string | null;
  repo_url: string | null;
  live_url: string | null;
  notes: string | null;
  milestones_done: number;
  milestones_total: number;
  has_snapshot: boolean;
  snapshot_size_bytes: number;
  warnings: string[];
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface EnrollmentMilestone extends ProjectMilestoneData {
  done: boolean;
  completed_at: string | null;
}

export interface EnrollmentData {
  id: number;
  status: EnrollmentStatus;
  started_at: string | null;
  submitted_at: string | null;
  sow_version: number;
  sow_outdated: boolean;
  entitled: boolean;
  topic: {
    id: number;
    slug: string;
    title: string;
    category: string;
    difficulty: Difficulty;
    estimated_hours: number;
    tech_stack: string[];
    sow_version: number;
    sow_markdown: string | null;
  };
  milestones: EnrollmentMilestone[];
  progress: { done: number; total: number };
  workspace: WorkspaceState | null;
  submissions: SubmissionData[];
}

// ── Responses ────────────────────────────────────────────────────────────────
export interface CatalogResponse {
  project_lab: ProjectLabSummary;
  topics: ProjectCardData[];
  categories: string[];
}
export interface TopicResponse {
  project_lab: ProjectLabSummary;
  topic: ProjectTopicDetail;
}
export interface MyProjectsResponse {
  project_lab: ProjectLabSummary;
  projects: ProjectCardData[];
}
export interface EnrollmentResponse {
  project_lab: ProjectLabSummary;
  enrollment: EnrollmentData;
}
export interface WorkspaceResponse {
  workspace: WorkspaceState | null;
  project_lab: ProjectLabSummary;
}
export interface HeartbeatResponse {
  status: WorkspaceStatus;
  stop_reason?: WorkspaceState["stop_reason"];
  hours?: ProjectLabSummary["hours"];
  enabled?: boolean;
}

// ── Pricing ──────────────────────────────────────────────────────────────────
export interface QuoteLine {
  code: string;
  name: string;
  kind: "base" | "addon";
  list_price: number;
  discount: number;
  /** Percent the discount represents (the plan's own discount, or the add-on bundle discount). */
  discount_percent: number;
  price: number;
  duration_days: number | null;
}
export interface PurchaseQuote {
  currency: string;
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  total: number;
  bundle_applied: boolean;
}

// ── Admin ────────────────────────────────────────────────────────────────────
export interface AdminTopicRow {
  id: number;
  slug: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  estimated_hours: number;
  status: TopicStatus;
  is_free_sample: boolean;
  sow_version: number;
  has_sow: boolean;
  milestone_count: number;
  enrollment_count: number;
  display_order: number;
  published_at: string | null;
  updated_at: string | null;
}

export interface AdminMilestone {
  id?: number;
  position?: number;
  title: string;
  description: string | null;
  acceptance_criteria: string[];
  estimated_hours: number;
}

export interface AdminTopicFull {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  difficulty: Difficulty;
  estimated_hours: number;
  tech_stack: string[];
  outcomes: string[];
  sow_markdown: string | null;
  sow_version: number;
  status: TopicStatus;
  is_free_sample: boolean;
  /** strict: pasting from outside the workspace is refused (default). open: the guard is off. */
  authorship_mode: AuthorshipMode;
  icon: string | null;
  display_order: number;
  enrollment_count: number;
  published_at: string | null;
  milestones: (AdminMilestone & { id: number; position: number })[];
}

export interface AdminSubmissionRow {
  id: number;
  attempt: number;
  status: SubmissionStatus;
  score: number | null;
  student: { id: number; name: string; email: string };
  topic: { id: number; title: string; slug: string };
  repo_url: string | null;
  live_url: string | null;
  has_snapshot: boolean;
  snapshot_size_bytes: number;
  milestones_done: number;
  milestones_total: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  /** The authorship label frozen at hand-in (null when no evidence was gathered). */
  authorship: AuthorshipLabel | null;
}

export type AuthorshipMode = "strict" | "open";
export type AuthorshipLabel = "clear" | "review" | "attention" | "not_checked";

/** The evidence behind "did the student write this?", frozen on the submission. Metadata only: no text ever. */
export interface AuthorshipEvidence {
  version: number;
  generated_at: string;
  mode: "enforce" | "report" | "open";
  label: AuthorshipLabel;
  signals: { code: string; level: "review" | "attention"; text: string }[];
  guard: {
    session_seconds: number;
    active_seconds: number;
    coverage: number | null;
    last_seen_at: string | null;
    version: string | null;
    counts: Record<string, number>;
    refused: { attempts: number; chars: number; largest: number; would_have_been: number };
    internal: { pastes: number; chars: number; sow_commands: number };
    typing: { fast: number; robotic: number };
    synthetic: number;
    windows_refused: number;
    first_event_at: string | null;
    last_event_at: string | null;
  };
  git: {
    path: string;
    commits: number;
    commits_after_first: number;
    first_at: string | null;
    last_at: string | null;
    span_minutes: number;
    added_after_first: number;
    largest: { lines: number; share: number; subject: string } | null;
    top: { lines: number; subject: string; at: string }[];
    authors: number;
    other_repositories: number;
  } | null;
  extensions: { extra: string[] };
}

export interface AuthorshipTimelineRow {
  kind: string;
  size: number | null;
  target: string | null;
  at: string;
  report_only: boolean;
}

export interface AdminSubmissionDetail extends AdminSubmissionRow {
  integrity: AuthorshipEvidence | null;
  integrity_events: AuthorshipTimelineRow[];
  notes: string | null;
  rubric: { criterion: string; score: number; max: number }[];
  feedback: string | null;
  warnings: string[];
  reviewer: string | null;
  milestones: { id: number; title: string; acceptance_criteria: string[]; done: boolean }[];
  previous_attempts: { id: number; attempt: number; status: SubmissionStatus; score: number | null; submitted_at: string }[];
}
