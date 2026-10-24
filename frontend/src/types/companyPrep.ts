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
    available: boolean;
  }[];
  live_drive: {
    id: number;
    title: string;
    role_title: string;
    ctc_range: string | null;
    drive_date: string;
  } | null;
}

