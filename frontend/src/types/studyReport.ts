import type { MatchBand, StudyAttemptStanding, StudyScorePoint } from "./interview";

/** One question of a finished study sitting, as it was when the student sat it (a snapshot: later edits to the bank do not change it). */
export interface StudyReportQuestion {
  question: string;
  /** The picture of a Rule of the Road card, on this site. */
  image: string | null;
  /** The syllabus topic; for a ROR card it names the kind of vessel, so it is only ever shown after the sitting. */
  topic: string | null;
  answer: string;
  model_answer: string;
  percent: number;
  band: MatchBand;
  /** The key points of the model answer the answer left out, most important first. */
  missed: string[];
  unverified: boolean;
}

/** GET /study-attempts/{id}: everything the downloadable report is made of. */
export interface StudyReport {
  attempt: {
    id: number;
    exam: string;
    stack_key: string;
    set_number: number;
    set_title: string;
    score: number;
    question_count: number;
    answered_count: number;
    partial: boolean;
    counts: Record<MatchBand, number>;
    duration_seconds: number | null;
    completed_at: string | null;
    results: StudyReportQuestion[];
  };
  student: { name: string };
  standing: StudyAttemptStanding;
}

export interface StudyOverviewSet {
  round_id: string;
  set_number: number;
  title: string;
  attempts: number;
  best_score: number;
  last_score: number;
  previous_score: number | null;
  delta: number | null;
  last_at: string | null;
  history: StudyScorePoint[];
}

export interface StudyOverviewExam {
  stack_key: string;
  name: string;
  sets_practised: number;
  sets_total: number | null;
  attempts: number;
  /** The mean of each set's latest score. */
  average_latest: number | null;
  best_score: number;
  last_at: string | null;
  sets: StudyOverviewSet[];
}

/** GET /study-attempts */
export interface StudyOverview {
  totals: { attempts: number; sets_practised: number; questions_answered: number; seconds: number };
  exams: StudyOverviewExam[];
}
