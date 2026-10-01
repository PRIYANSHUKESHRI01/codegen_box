/** Module accent color — same 5-color palette as TOPIC_COLORS/TOPIC_GRADIENTS in @/types/article, kept visually consistent across the whole Learning Centre. */
export type ModuleColor = "indigo" | "emerald" | "amber" | "sky" | "rose";

export const MODULE_COLORS: Record<ModuleColor, string> = {
  indigo: "bg-accent-primary/10 text-accent-primary border-accent-primary/25",
  emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
  amber: "bg-amber-500/10 text-amber-500 border-amber-500/25",
  sky: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/25",
};

export const MODULE_GRADIENTS: Record<ModuleColor, string> = {
  indigo: "from-accent-primary/25 to-accent-primary/5",
  emerald: "from-emerald-500/25 to-emerald-500/5",
  amber: "from-amber-500/25 to-amber-500/5",
  sky: "from-sky-500/25 to-sky-500/5",
  rose: "from-rose-500/25 to-rose-500/5",
};

export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface LearningCentreOverview {
  total_sessions: number;
  best_speaking_score: number | null;
  day_streak: number;
  words_mastered_this_week: number;
}

// ---- Speaking Practice ----

export interface SpeakingPromptSummary {
  id: number;
  title: string;
  category: string;
  difficulty: Difficulty;
  word_count: number;
  best_score: number | null;
  attempt_count: number;
}

export interface SpeakingPromptDetail {
  id: number;
  title: string;
  passage_text: string;
  category: string;
  difficulty: Difficulty;
  word_count: number;
  target_wpm_min: number;
  target_wpm_max: number;
}

export interface SpeakingAttemptResult {
  id: number;
  attempt_number: number;
  transcript_text: string;
  has_audio: boolean;
  duration_seconds: number;
  pacing_wpm: number | null;
  overall_score: number | null;
  clarity_score: number | null;
  fluency_score: number | null;
  accuracy_score: number | null;
  feedback: string | null;
  improvement_tips: string[];
  passed: boolean;
  scoring_failed: boolean;
  created_at: string;
}

export const SPEAKING_PASS_THRESHOLD = 60;

// ---- Listening Lab ----

export interface ListeningLessonSummary {
  id: number;
  title: string;
  category: string;
  difficulty: Difficulty;
  question_count: number;
  best_score: number | null;
}

export interface ListeningQuestionUnanswered {
  question: string;
  options: string[];
}

export interface ListeningLessonDetail {
  id: number;
  title: string;
  passage_text: string;
  category: string;
  difficulty: Difficulty;
  questions: ListeningQuestionUnanswered[];
}

export interface QuizResultItem {
  question?: string;
  word?: string;
  sentence?: string;
  options: string[];
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
  explanation: string;
}

export interface ListeningSubmitResponse {
  attempt: { id: number; attempt_number: number; score: number; passed: boolean };
  results: QuizResultItem[];
}

export const LISTENING_PASS_THRESHOLD = 60;

// ---- Vocabulary Sprint ----

export interface VocabularyQuestionUnanswered {
  word: string;
  sentence: string;
  options: string[];
}

export interface VocabularyGenerateResponse {
  attempt_id: number;
  topic: string;
  difficulty: Difficulty;
  questions: VocabularyQuestionUnanswered[];
}

export interface VocabularySubmitResponse {
  attempt: { id: number; score: number; passed: boolean };
  results: QuizResultItem[];
}

export const VOCABULARY_PASS_THRESHOLD = 60;

export const VOCABULARY_TOPIC_SUGGESTIONS = [
  "Technology",
  "Campus Life",
  "Interviews & Careers",
  "Business",
  "Travel",
  "Science",
] as const;
