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
  /** Real spaced-repetition mastery; absent from an older API. */
  words_mastered_total?: number;
  vocabulary_words_total?: number;
  vocabulary_due?: number;
  /** Library lessons only; absent from an older API. */
  listening_lessons_total?: number;
  listening_lessons_passed?: number;
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
  /** "library" = shared passage; "ai" = generated for this student around their own topic. */
  source: "library" | "ai";
  /** The topic the student asked for (AI-generated passages only). */
  interest: string | null;
  is_mine: boolean;
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
  source: "library" | "ai";
  interest: string | null;
  is_mine: boolean;
}

/** One passage word after aligning what the student said against the text. */
export interface SpeakingWordResult {
  word: string;
  /** ok = said as written · close = near-identical · wrong = a different word · missed = skipped */
  status: "ok" | "close" | "wrong" | "missed";
  /** What was actually heard in its place (close/wrong only). */
  heard: string | null;
}

export type SpeakingPurpose = "interview" | "workplace" | "tech" | "everyday";

export interface SpeakingAttemptResult {
  id: number;
  attempt_number: number;
  transcript_text: string;
  has_audio: boolean;
  duration_seconds: number;
  pacing_wpm: number | null;
  filler_count: number | null;
  overall_score: number | null;
  clarity_score: number | null;
  fluency_score: number | null;
  accuracy_score: number | null;
  feedback: string | null;
  improvement_tips: string[];
  /** The passage word by word, marked up with what was actually said. Empty for attempts scored before this existed. */
  words: SpeakingWordResult[];
  /** Words that may have sounded wrong — soft, informational hints that never changed the score. */
  pronunciation: { word: string; heard_as: string }[];
  /** One deterministic sentence about what was skipped or changed. */
  accuracy_note: string | null;
  long_pauses: number | null;
  passed: boolean;
  scoring_failed: boolean;
  created_at: string;
}

export const SPEAKING_PASS_THRESHOLD = 60;

/** One multiple-choice result row — shared by Vocabulary Sprint and (extended below) the Listening Lab. */
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

// ---- Listening Lab ----

/** comprehension = one speaker + questions · conversation = two or three speakers + questions · dictation = hear it, type it. */
export type ListeningFormat = "comprehension" | "conversation" | "dictation";

/** Mirrors App\Models\ListeningLesson::SKILL_LABELS — keep the two lists in sync. */
export type ListeningSkill = "main_idea" | "detail" | "numbers" | "inference" | "vocabulary" | "purpose" | "dictation";

export const LISTENING_SKILL_LABELS: Record<ListeningSkill, string> = {
  main_idea: "Main idea",
  detail: "Key details",
  numbers: "Numbers & times",
  inference: "Reading between the lines",
  vocabulary: "Words in context",
  purpose: "Speaker's purpose",
  dictation: "Dictation",
};

/** One line of what each skill means, shown next to the skill so a student knows what they're being trained on. */
export const LISTENING_SKILL_HINTS: Record<ListeningSkill, string> = {
  main_idea: "What is this really about?",
  detail: "Catching facts, names and places",
  numbers: "Times, dates, prices and counts",
  inference: "What the speaker means but doesn't say",
  vocabulary: "Working out a word from how it's used",
  purpose: "Why the speaker is talking",
  dictation: "Hearing every word and spelling it",
};

export const LISTENING_FORMAT_LABELS: Record<ListeningFormat, string> = {
  comprehension: "Passage",
  conversation: "Conversation",
  dictation: "Dictation",
};

export const LISTENING_FORMAT_HINTS: Record<ListeningFormat, string> = {
  comprehension: "Listen to one speaker, then answer questions",
  conversation: "Follow a real conversation between two or three people",
  dictation: "Hear each sentence and type exactly what you hear",
};

export interface ListeningLessonSummary {
  id: number;
  title: string;
  category: string;
  difficulty: Difficulty;
  format: ListeningFormat;
  /** Questions to answer — or, for a dictation, sentences to type. */
  question_count: number;
  estimated_seconds: number;
  skills: ListeningSkill[];
  speaker_count: number;
  best_score: number | null;
  attempt_count: number;
  passed: boolean;
  last_attempt_at: string | null;
  /** "library" = shared lesson; "ai" = written for this student around their own topic. */
  source: "library" | "ai";
  interest: string | null;
  is_mine: boolean;
}

export interface ListeningSkillRow {
  skill: ListeningSkill;
  label: string;
  correct: number;
  total: number;
  pct: number;
}

export interface ListeningNextStep {
  lesson_id: number;
  title: string;
  difficulty: Difficulty;
  format: ListeningFormat;
  reason: string;
}

export interface ListeningSummary {
  lessons_total: number;
  lessons_passed: number;
  average_best_score: number | null;
  attempts_total: number;
  current_level: Difficulty;
  levels: Record<Difficulty, { total: number; passed: number }>;
  skills: ListeningSkillRow[];
  weakest_skill: { skill: ListeningSkill; label: string; pct: number } | null;
  recommended: ListeningNextStep | null;
}

export interface ListeningIndexResponse {
  lessons: ListeningLessonSummary[];
  my_lessons: ListeningLessonSummary[];
  summary: ListeningSummary;
}

export interface ListeningSpeaker {
  key: string;
  label: string;
  gender: "female" | "male" | null;
}

/** One spoken sentence — the unit the audio player plays and a question's evidence points at. */
export interface ListeningSentence {
  index: number;
  text: string;
  speaker: string | null;
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
  format: ListeningFormat;
  source: "library" | "ai";
  interest: string | null;
  is_mine: boolean;
  speakers: ListeningSpeaker[] | null;
  sentences: ListeningSentence[];
  estimated_seconds: number;
  item_count: number;
  /** The skills this lesson trains overall (not which question trains which — that is only revealed after answering). */
  skills: ListeningSkill[];
  /** Empty for a dictation, whose sentences are the items. */
  questions: ListeningQuestionUnanswered[];
}

export interface ListeningHistory {
  attempt_count: number;
  best_score: number | null;
  last_score: number | null;
  passed: boolean;
}

export type ListeningMode = "practice" | "exam";

/** Multiple-choice row, with the skill it trained and the sentence that holds the answer. */
export interface ListeningQuestionResult extends QuizResultItem {
  question: string;
  skill: ListeningSkill | null;
  /** Index of the sentence containing the answer (for the transcript highlight), or null when unknown. */
  evidence: number | null;
}

export interface ListeningDictationResult {
  index: number;
  target: string;
  typed: string;
  accuracy: number;
  is_correct: boolean;
  words: SpeakingWordResult[];
}

export interface ListeningSkillBreakdownRow {
  skill: ListeningSkill;
  label: string;
  correct: number;
  total: number;
}

export interface ListeningSubmitResponse {
  attempt: {
    id: number;
    attempt_number: number;
    score: number;
    passed: boolean;
    mode: ListeningMode;
    is_new_best: boolean;
    previous_best: number | null;
  };
  format: ListeningFormat;
  results: ListeningQuestionResult[] | ListeningDictationResult[];
  skill_breakdown: ListeningSkillBreakdownRow[];
  next: ListeningNextStep | null;
}

export const LISTENING_PASS_THRESHOLD = 60;

/** Exam mode: how many times the audio may be played (per sentence for a dictation). */
export const LISTENING_EXAM_MAX_PLAYS = 2;

/** What the student can ask for when writing their own lesson. */
export const LISTENING_KINDS: { key: "passage" | "conversation"; label: string; hint: string }[] = [
  { key: "conversation", label: "Conversation", hint: "Two or three people talking" },
  { key: "passage", label: "Talk or announcement", hint: "One person speaking" },
];

/** Things a job-seeker actually has to listen to — one tap fills the topic box. */
export const LISTENING_TOPIC_IDEAS = [
  "A telephonic HR round",
  "My team's daily stand-up",
  "A client call about a delay",
  "An offer letter call from HR",
  "A campus placement announcement",
  "A technical interview about my project",
];

// ---- Vocabulary Sprint ----

/** daily = today's mix of reviews and new words · deck = one deck · weak = words you keep missing · custom = the AI quiz on any topic. */
export type VocabularyKind = "daily" | "deck" | "weak" | "custom";

/** meaning = pick what the word means · word = pick the word for a meaning · cloze = pick the word that fits a sentence · recall = type the word. */
export type VocabularyQuestionType = "meaning" | "word" | "cloze" | "recall";

/** new = never answered · learning = just met or recently missed · familiar = coming back in days · mastered = long-term memory. */
export type WordStatus = "new" | "learning" | "familiar" | "mastered";

/** A word as it is introduced and reviewed. */
export interface VocabularyCard {
  word_id: number | null;
  word: string;
  part_of_speech: string | null;
  meaning: string;
  example: string;
  synonyms: string[];
  note: string | null;
}

/** One row of the Word Bank. */
export interface VocabularyWordRow {
  id: number;
  word: string;
  part_of_speech: string;
  level: Difficulty;
  deck: string | null;
  deck_title: string | null;
  meaning: string;
  example: string;
  synonyms: string[];
  note: string | null;
  pair_word: string | null;
  is_mine: boolean;
  status: WordStatus;
  box: number | null;
  seen_count: number;
  correct_count: number;
  is_weak: boolean;
  /** "today", "tomorrow", "in 3 days" … null until the word has been answered once. */
  next_review: string | null;
}

/** A question as the browser receives it — never carries the answer. */
export interface VocabularyQuestion {
  index: number;
  type: VocabularyQuestionType;
  prompt: string;
  part_of_speech: string | null;
  /** The second look at a word met earlier in the same session. */
  is_echo: boolean;
  /** Only the meaning question shows the word, because there the word IS the question. */
  word?: string;
  sentence?: string;
  options?: string[];
  /** Recall only: "m _ _ _ _ _ _ _". */
  hint?: string;
  letters?: number;
  word_count?: number;
}

export interface VocabularyAnswerProgress {
  box_before: number | null;
  box_after: number;
  status: WordStatus;
  moved_up: boolean;
  became_mastered: boolean;
  next_review: string | null;
}

/** What comes back after committing one answer. */
export interface VocabularyAnswerResult {
  index: number;
  type: VocabularyQuestionType;
  is_correct: boolean;
  /** Typed answers only: one letter off — a spelling slip, still counted as not remembered. */
  close: boolean;
  selected_index: number | null;
  response: string | null;
  correct_index: number | null;
  correct_answer: string | null;
  explanation: string;
  card: VocabularyCard;
  progress: VocabularyAnswerProgress | null;
}

export interface VocabularySummary {
  score: number;
  correct: number;
  total: number;
  duration_seconds: number | null;
  new_words_met: number;
  words_moved_up: number;
  mastered_now: VocabularyCard[];
  missed: VocabularyCard[];
  daily_goal: { answered: number; goal: number; reached: boolean };
  streak_days: number;
  can_retry_missed: boolean;
}

/** A practice session, whether just created or being picked up again. */
export interface VocabularySession {
  attempt_id: number;
  kind: VocabularyKind;
  deck: string | null;
  title: string;
  topic: string;
  difficulty: string;
  total: number;
  new_count: number;
  review_count: number;
  /** Nothing was due and nothing was new, so this is free practice. */
  practice: boolean;
  retry: boolean;
  /** "Meet the word" cards for a session that has not started yet. */
  cards: VocabularyCard[];
  questions: VocabularyQuestion[];
  results: VocabularyAnswerResult[];
  answered: number;
  complete: boolean;
  summary: VocabularySummary | null;
}

export type VocabularyAnswerResponse = VocabularyAnswerResult & {
  answered: number;
  total: number;
  complete: boolean;
  summary: VocabularySummary | null;
};

export interface VocabularyDeckProgress {
  slug: string;
  title: string;
  tagline: string;
  level: Difficulty;
  total: number;
  new: number;
  learning: number;
  familiar: number;
  mastered: number;
  due: number;
}

export interface VocabularyOverview {
  totals: {
    library_words: number;
    new: number;
    learning: number;
    familiar: number;
    mastered: number;
    due_today: number;
    weak: number;
    my_words: number;
    mastered_this_week: number;
  };
  today: { answered: number; goal: number; goal_reached: boolean; streak_days: number; accuracy_7d: number | null };
  next_sprint: {
    state: "ready" | "practice" | "empty";
    new_words: number;
    reviews_due: number;
    questions: number;
    minutes: number;
    focus_deck: { slug: string; title: string } | null;
  };
  resume: { attempt_id: number; kind: VocabularyKind; title: string; answered: number; total: number } | null;
  word_of_the_day: (Omit<VocabularyWordRow, "box" | "seen_count" | "correct_count" | "is_weak" | "next_review"> & { id: number }) | null;
  decks: VocabularyDeckProgress[];
}

export interface VocabularyWordsResponse {
  counts: { all: number; new: number; learning: number; familiar: number; mastered: number; weak: number };
  words: VocabularyWordRow[];
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}

export const VOCABULARY_STATUS_LABELS: Record<WordStatus, string> = {
  new: "New",
  learning: "Learning",
  familiar: "Familiar",
  mastered: "Mastered",
};

export const VOCABULARY_STATUS_HINTS: Record<WordStatus, string> = {
  new: "You haven't met this word yet",
  learning: "Still settling in — it comes back soon",
  familiar: "Getting comfortable — it comes back in a few days",
  mastered: "In your long-term memory — it only needs an occasional check",
};

export const VOCABULARY_TOPIC_SUGGESTIONS = [
  "Technology",
  "Campus Life",
  "Interviews & Careers",
  "Business",
  "Travel",
  "Science",
] as const;
