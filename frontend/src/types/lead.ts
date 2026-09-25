export const LEAD_STATUSES = ["new", "contacted", "engaged", "converted", "lost"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  engaged: "Engaged",
  converted: "Converted",
  lost: "Lost",
};

export const LEAD_STATUS_BADGE_CLASS: Record<LeadStatus, string> = {
  new: "bg-accent-secondary/15 text-accent-secondary border-accent-secondary/30",
  contacted: "bg-accent-primary/15 text-accent-primary border-accent-primary/30",
  engaged: "bg-status-warning/15 text-status-warning border-status-warning/30",
  converted: "bg-status-success/15 text-status-success border-status-success/30",
  lost: "bg-elevated text-text-muted border-border-subtle",
};

/** One row of GET /marketing/leads — real, computed data only, nothing fabricated. */
export interface LeadSummary {
  id: number;
  name: string;
  email: string;
  created_at: string;
  lead_status: LeadStatus;
  is_blocked: boolean;
  plan_name: string | null;
  subscription_status: string | null;
  solved_score: number;
  note_count: number;
  /** Which Mellow Marketing employee owns this lead — null if none exists yet to assign it to. */
  assigned_to_name: string | null;
}

export interface LeadNote {
  id: number;
  note: string;
  author_name: string;
  created_at: string;
}

export interface LeadDetail {
  lead: {
    id: number;
    name: string;
    email: string;
    created_at: string;
    lead_status: LeadStatus;
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
  notes: LeadNote[];
}

export interface LeadPage {
  data: LeadSummary[];
  current_page: number;
  last_page: number;
  total: number;
}
