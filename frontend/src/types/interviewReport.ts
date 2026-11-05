/** GET /tpo/interviews/{slug}/results — see MockInterviewReportService::cohort() on the server. */
export interface InterviewResultRow {
  session_id: number;
  student_id: number;
  name: string;
  roll_number: string | null;
  section: string | null;
  branch: string | null;
  status: "invited" | "in_progress" | "completed";
  score: number | null;
  tier: "Strong" | "Developing" | "Needs practice" | "Not scored";
  answered: number;
  questions: number;
  strikes: number;
  locked: boolean;
  started_at: string | null;
  completed_at: string | null;
  scoring_failed: boolean;
  rank: number | null;
}

export interface InterviewNotAttempted {
  student_id: number;
  name: string;
  roll_number: string | null;
  section: string | null;
  branch: string | null;
  blocked: boolean;
}

export interface InterviewResults {
  interview: {
    id: number;
    slug: string;
    title: string;
    description: string | null;
    status: "draft" | "published" | "cancelled";
    schedule_state: "unscheduled" | "upcoming" | "open" | "closed";
    opens_at: string | null;
    closes_at: string | null;
    audience: string;
    target_score: number;
    question_count: number;
  };
  participation: {
    audience: number;
    started: number;
    completed: number;
    in_progress: number;
    not_started: number;
    scored: number;
    completion_rate: number;
  };
  scores: {
    average: number | null;
    median: number | null;
    highest: number | null;
    lowest: number | null;
    target: number;
    pass_count: number;
    pass_rate: number | null;
    distribution: { label: string; count: number }[];
  };
  questions: { order: number; question: string; category: string | null; difficulty: string | null; answered: number; average: number | null }[];
  categories: { category: string; average: number; answers: number }[];
  integrity: { students_flagged: number; locked: number; total_strikes: number };
  students: InterviewResultRow[];
  not_attempted: InterviewNotAttempted[];
  insights: string[];
}
