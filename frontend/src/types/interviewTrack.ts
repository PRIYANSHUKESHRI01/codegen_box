import type { InterviewType, QuestionCategory, QuestionDifficulty } from "@/types/interview";

export type InterviewTrackType = "general" | "company" | "tpo_mock" | "company_hiring";
export type InterviewTrackStatus = "draft" | "published" | "cancelled";

export interface RoundConfig {
  round_number: 1 | 2 | 3;
  round_name: string;
  question_count: number;
  difficulty: QuestionDifficulty;
  /** Keys are QuestionCategory, values are integer weights that must sum to exactly 100. */
  category_weights: Partial<Record<QuestionCategory, number>>;
  qualifying_score_percent: number;
}

export interface InterviewRoleTemplate {
  id: number;
  name: string;
  description: string | null;
  tech_stack_tags: string[] | null;
  rounds_config: RoundConfig[];
  owning_college_id: number | null;
  owning_company_id: number | null;
  is_active: boolean;
  tracks_count?: number;
}

export interface TrackRound {
  id: number;
  slug: string;
  round_number: number;
  round_name: string;
  status: "draft" | "published" | "cancelled";
  category_weights: Partial<Record<QuestionCategory, number>>;
  qualifying_score_percent: number;
  interview_type: InterviewType;
  sessions_count?: number;
}

export interface InterviewTrackSummary {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  status: InterviewTrackStatus;
  track_type: InterviewTrackType;
  role_title: string | null;
  interview_role_template_id: number | null;
  company_id: number | null;
  placement_drive_id: number | null;
  owning_college_id: number | null;
  owning_company_id: number | null;
  rounds_count?: number;
  rounds?: TrackRound[];
  role_template?: { id: number; name: string } | null;
  placement_drive?: { id: number; title: string; role_title: string } | null;
  company?: { id: number; name: string; logo: string | null } | null;
  college_ids?: number[] | null;
}

export interface TrackPipelineRound {
  interview_slug: string;
  round_number: number;
  round_name: string;
  question_count: number;
  qualifying_score_percent: number;
  locked: boolean;
  my_session_status: "invited" | "in_progress" | "completed" | null;
  composite_score_percent: number | null;
  passed: boolean | null;
}

export interface StudentInterviewTrackSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  role_title: string | null;
  track_type: InterviewTrackType;
  company: { id: number; name: string; logo: string | null } | null;
  round_count: number;
  my_round1_status: "invited" | "in_progress" | "completed" | null;
}

export interface TrackPipeline {
  track: {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    role_title: string | null;
  };
  rounds: TrackPipelineRound[];
}

/** A round's category weights turned into "N needed" targets against its question_count — purely a client-side planning aid for the generation checklist, never persisted. */
export function roundCategoryTargets(round: RoundConfig): Partial<Record<QuestionCategory, number>> {
  const targets: Partial<Record<QuestionCategory, number>> = {};
  for (const [category, weight] of Object.entries(round.category_weights)) {
    targets[category as QuestionCategory] = Math.round(((weight ?? 0) / 100) * round.question_count);
  }
  return targets;
}

export function categoryWeightsSum(weights: Partial<Record<QuestionCategory, number>>): number {
  return Object.values(weights).reduce((sum, w) => sum + (w ?? 0), 0);
}
