export type InterviewType = "general" | "company" | "tpo_mock" | "company_hiring";
export type InterviewStatus = "draft" | "published" | "cancelled";
export type InterviewSessionStatus = "invited" | "in_progress" | "completed";
export type QuestionCategory = "technical" | "behavioral" | "hr" | "situational" | "aptitude";
export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface BankQuestion {
  id: number;
  question_text: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  expected_duration_seconds: number;
  tags: string[] | null;
}

export interface AttachedInterviewQuestion {
  id: number;
  interview_id: number;
  interview_question_bank_id: number;
  display_order: number;
  question_bank: BankQuestion;
}

export interface InterviewSummary {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: InterviewStatus;
  interview_type: InterviewType;
  is_mock: boolean;
  company_id: number | null;
  placement_drive_id: number | null;
  owning_college_id: number | null;
  owning_company_id: number | null;
  sessions_count?: number;
  placement_drive?: { id: number; title: string; role_title: string } | null;
  company?: { id: number; name: string; logo: string | null } | null;
}

export interface StudentInterviewSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  interview_type: InterviewType;
  is_mock: boolean;
  company: { id: number; name: string; logo: string | null } | null;
  question_count: number;
  /** Sum of each question's expected_duration_seconds plus a flat prep allowance — null if the interview has no questions yet. */
  estimated_total_seconds: number | null;
  my_session_status: InterviewSessionStatus | null;
}

export interface InterviewProctoringSummary {
  id: number;
  status: "active" | "locked" | "completed";
  violation_count: number;
  locked_at: string | null;
  violations?: {
    id: number;
    type: string;
    counted_toward_lock: boolean;
    occurred_at: string;
  }[];
}

export interface InterviewSessionRow {
  id: number;
  interview_id: number;
  user_id: number;
  status: InterviewSessionStatus;
  invited_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  current_question_order: number;
  user: { id: number; name: string; email: string };
  proctoring_session?: InterviewProctoringSummary | null;
  /** Only ever set for a track-round session — see InterviewTrackAdvancementService. */
  composite_score_percent?: number | null;
  reviewed_at?: string | null;
  advanced?: boolean;
  /** Set once ScoreInterviewSessionJob has scored this session — distinct from reviewed_at (a human's own pass). */
  ai_scored_at?: string | null;
  /** Present only on the single-session responses() payload — the round's own qualifying_score_percent, so the UI can tell "passed" from merely "reviewed". */
  interview?: { id: number; qualifying_score_percent: number | null };
}

export const VIOLATION_TYPE_LABEL: Record<string, string> = {
  fullscreen_exit: "Exited fullscreen",
  tab_switch: "Switched tab or window",
  devtools_detected: "Developer tools opened",
  paste_attempt: "Attempted to paste",
  window_blur: "Window lost focus",
  context_menu_blocked: "Right-click blocked",
  tab_close_attempt: "Attempted to close or navigate away",
};

export interface InterviewResponseRow {
  id: number;
  interview_session_id: number;
  interview_question_id: number;
  transcript_text: string | null;
  audio_path: string | null;
  audio_duration_seconds: number | null;
  answered_at: string | null;
  interview_question: {
    id: number;
    display_order: number;
    question_bank: { id: number; question_text: string; category: QuestionCategory; difficulty: QuestionDifficulty };
  };
  /** A reviewer's (or Gemini's — see ai_scored) 0-100 score against the round's rubric, populated for every interview now, not only track rounds. */
  score?: number | null;
  review_notes?: string | null;
  scored_at?: string | null;
  /** True if `score`/`review_notes` were written by ScoreInterviewSessionJob and never since edited by a human. */
  ai_scored?: boolean;
}

export interface TakeQuestionPayload {
  interview_question_id: number;
  order: number;
  total: number;
  question_text: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  expected_duration_seconds: number;
}

export interface StartInterviewResponse {
  session: { id: number; status: InterviewSessionStatus; current_question_order: number };
  total_questions: number;
  answered_count: number;
  complete: boolean;
  question: TakeQuestionPayload | null;
}

export interface AnswerInterviewResponse {
  complete: boolean;
  next_question?: TakeQuestionPayload;
}

export type InterviewResultStatus = "scoring" | "scored" | "needs_human_review";

export interface InterviewResultQuestion {
  question_text: string;
  category: QuestionCategory;
  score: number;
  feedback: string;
}

/** GET /interviews/{interview}/result — polled by the completion screen right after a candidate finishes. See ScoreInterviewSessionJob on the backend. */
export interface InterviewResult {
  status: InterviewResultStatus;
  composite_score_percent: number | null;
  /** Only ever non-null for a track round — a standalone interview has no pass/fail concept. */
  passed: boolean | null;
  responses: InterviewResultQuestion[];
}

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  hr: "HR",
  situational: "Situational",
  aptitude: "Aptitude",
};

export const CATEGORY_COLORS: Record<QuestionCategory, string> = {
  technical: "bg-accent-primary/10 text-accent-primary border-accent-primary/25",
  behavioral: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
  hr: "bg-amber-500/10 text-amber-500 border-amber-500/25",
  situational: "bg-rose-500/10 text-rose-400 border-rose-500/25",
  aptitude: "bg-sky-500/10 text-sky-400 border-sky-500/25",
};

export const DIFFICULTY_COLORS: Record<QuestionDifficulty, string> = {
  easy: "bg-status-success/15 text-status-success",
  medium: "bg-status-warning/15 text-status-warning",
  hard: "bg-status-danger/15 text-status-danger",
};
