export type VoiceVerificationStatus = "not_started" | "in_progress" | "verified" | "blocked";

export interface VoiceVerificationPromptItem {
  id: number;
  position: number;
  slug: string;
  title: string;
  category: string;
  prompt_text: string;
  guidance: string | null;
  target_seconds: number;
  min_seconds: number;
  completed: boolean;
  recorded_duration_seconds: number;
  transcript_preview: string | null;
  recorded_at: string | null;
}

export interface VoiceVerificationStatusResponse {
  required: boolean;
  status: VoiceVerificationStatus;
  proctoring_status?: string;
  enrollment_lock_count?: number;
  max_enrollment_attempts?: number;
  remaining_enrollment_attempts?: number;
  can_retry_enrollment?: boolean;
  required_duration_seconds: number;
  min_enroll_duration_seconds: number;
  total_duration_seconds: number;
  samples_count: number;
  total_prompts: number;
  ready_to_complete: boolean;
  completed_at: string | null;
  last_verified_at: string | null;
  last_match_score: number | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  voice_summary: string | null;
  prompts: VoiceVerificationPromptItem[];
}
