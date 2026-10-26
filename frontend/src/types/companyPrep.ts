/** One (round, category, year) combination of a company's PYQs and how many questions sit in it. */
export interface CompanyPrepBreakdownRow {
  round: string | null;
  category: string;
  year: number;
  count: number;
}

export interface CompanyPrepSummary {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  industry: string | null;
  overview: string | null;
  hiring_process: { name: string; description?: string }[];
  prep_questions_count: number;
  recommended_problems_count: number;
  years: number[];
  rounds: string[];
  categories: string[];
  /**
   * Exact (round x category x year) combinations. Lets the hub answer "Technical Interview in 2024" per company
   * instead of guessing from three independent lists. Absent on an API that hasn't been updated yet — the hub
   * then falls back to matching each filter on its own.
   */
  breakdown?: CompanyPrepBreakdownRow[];
  has_live_drive: boolean;
  live_drive_id: number | null;
}

export interface CompanyPrepDetail {
  company: {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
    website_url: string | null;
    industry: string | null;
    overview: string | null;
    hiring_process: { name: string; description?: string }[];
  };
  prep_questions: {
    id: number;
    asked_year: number;
    category: string;
    round_name: string | null;
    question: string;
    answer_notes: string | null;
  }[];
  recommended_problems: {
    problem_slug: string;
    topic_tag: string | null;
    priority: number;
    title: string | null;
    difficulty: string | null;
    /** False when the slug names no problem in the catalogue — the card can't open an editor. */
    available: boolean;
    /** This student has an accepted submission. Absent on an API that hasn't been updated yet. */
    solved?: boolean;
  }[];
  live_drive: {
    id: number;
    title: string;
    role_title: string;
    ctc_range: string | null;
    drive_date: string;
  } | null;
}
