/** One row of GET /admin/customers — a converted "Mellow Direct" lead, real computed data only. */
export interface CustomerSummary {
  id: number;
  name: string;
  email: string;
  converted_at: string;
  is_blocked: boolean;
  plan_name: string | null;
  subscription_status: string | null;
  solved_score: number;
  note_count: number;
  /** Which Mellow Internal employee owns servicing this customer — null if none exists yet to assign it to. */
  assigned_to_name: string | null;
  /** Which Mellow Marketing employee converted this lead in the first place. */
  converted_by_name: string | null;
}

export interface CustomerNote {
  id: number;
  note: string;
  author_name: string;
  created_at: string;
}

export interface CustomerDetail {
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    created_at: string;
    converted_at: string;
    assigned_marketing_name: string | null;
    subscription: { plan_name: string | null; status: string | null; current_period_end: string | null } | null;
  };
  stats: {
    solved_by_difficulty: {
      total_solved: number;
      easy: { solved: number; total: number };
      medium: { solved: number; total: number };
      hard: { solved: number; total: number };
    };
    solved_score: number;
    streak: { current: number; max: number };
    activity: { date: string; count: number; level: number }[];
    recent_submissions: {
      problem_title: string;
      problem_slug: string;
      difficulty: string;
      language: string;
      status: string;
      runtime_ms: number | null;
      memory_kb: number | null;
      submitted_at: string;
    }[];
  };
  notes: CustomerNote[];
}

export interface CustomerPage {
  data: CustomerSummary[];
  current_page: number;
  last_page: number;
  total: number;
}
