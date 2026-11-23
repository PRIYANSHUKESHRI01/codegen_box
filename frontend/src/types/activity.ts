/** Superadmin → Live Activity: what the API returns (see SuperAdminActivityController). Dates are ISO strings. */

export type ActivityRole = "user" | "admin_tpo" | "section_coordinator" | "admin_company" | "admin_internal" | "admin_marketing" | "superadmin";

/** Where an account is on the road from "we gave them a login" to "they use it". */
export type AccountState = "not_opened" | "tried" | "password_set" | "active" | "dormant";
export type CollegeStatus = AccountState | "no_tpo";

export interface Pulse {
  as_of: string;
  timezone: string;
  online: { total: number; by_role: Record<string, number>; window_seconds: number };
  active: { last_15_minutes: number; today: number; yesterday: number; this_week: number; last_7_days: number; last_30_days: number };
  today: { sessions: number; avg_minutes: number; sign_ins: number; failed_sign_ins: number; accounts_activated: number; demo_logins_opened: number };
  sections_now: { section: string; users: number }[];
  colleges_now: { id: number; name: string; users: number }[];
}

export interface HourPoint {
  hour: string;
  label: string;
  users: number;
}

export interface DayPoint {
  day: string;
  users: number;
  students: number;
  visits: number;
  minutes: number;
}

export interface WeekPoint {
  week: string;
  users: number;
  current: boolean;
}

export interface OnlineRow {
  user_id: number;
  name: string;
  email: string;
  role: ActivityRole;
  college_id: number | null;
  college: string | null;
  section: string | null;
  path: string | null;
  since: string;
  last_seen_at: string;
  active_minutes: number;
  pages: number;
  device: string | null;
  browser: string | null;
  os: string | null;
}

export interface OnlineList {
  total: number;
  rows: OnlineRow[];
}

export interface LiveResponse {
  pulse: Pulse;
  hourly: HourPoint[];
  daily: DayPoint[];
  weekly: WeekPoint[];
  online: OnlineList;
}

export interface PulseResponse {
  pulse: Pulse;
  online: OnlineList;
}

export interface SectionStat {
  section: string;
  views: number;
  users: number;
  avg_seconds: number;
  avg_scroll: number;
  last_at: string;
}

export interface PatternsResponse {
  heatmap: { cells: number[][]; max: number; visits: number };
  sections: SectionStat[];
}

export interface RankedFeature {
  rank: number;
  section: string;
  category: string;
  color: string;
  views: number;
  users: number;
  total_seconds: number;
  total_minutes: number;
  avg_seconds: number;
  avg_minutes: number;
  avg_scroll: number;
  direct_attempts: number;
  total_engagements: number;
  share_percentage: number;
  usage_tier: "most_popular" | "high_engagement" | "moderate" | "least_used";
  last_at: string | null;
}

export interface FeatureCategoryGroup {
  category: string;
  color: string;
  views: number;
  direct_attempts: number;
  engagements: number;
  users: number;
  minutes: number;
  features_count: number;
  share_percentage: number;
}

export interface FeatureUsageDailyPoint {
  day: string;
  label: string;
  views: number;
  users: number;
  minutes: number;
}

export interface FeatureUsageSummary {
  total_views: number;
  total_minutes: number;
  total_practice_actions: number;
  total_features_tracked: number;
  top_feature: string;
  least_feature: string;
  top_category: string;
}

export interface FeatureUsageResponse {
  period_days: number;
  summary: FeatureUsageSummary;
  ranked_features: RankedFeature[];
  most_used: RankedFeature[];
  least_used: RankedFeature[];
  categories: FeatureCategoryGroup[];
  daily_trend: FeatureUsageDailyPoint[];
  practice_totals: {
    coding_submissions: number;
    core_answers: number;
    speaking_attempts: number;
    listening_attempts: number;
    vocabulary_attempts: number;
    contest_submissions: number;
  };
}

export interface PlanInfo {
  name: string;
  is_demo: boolean;
  ends_at: string | null;
  days_left: number | null;
}

export interface TpoSummary {
  id: number;
  name: string;
  email: string;
  state: AccountState;
  state_label: string;
  issued_at: string;
  last_seen_at: string | null;
}

export interface StudentFunnel {
  total: number;
  activated: number;
  ever_seen: number;
  active_7d: number;
}

export interface CollegeRow {
  id: number;
  name: string;
  code: string | null;
  city: string | null;
  is_active: boolean;
  status: CollegeStatus;
  status_label: string;
  plan: PlanInfo | null;
  tpos: TpoSummary[];
  students: StudentFunnel;
  online_now: number;
  last_activity_at: string | null;
}

export interface CollegeDirectory {
  total: number;
  page: number;
  per_page: number;
  counts: Partial<Record<CollegeStatus, number>>;
  rows: CollegeRow[];
}

export interface PersonRef {
  id: number;
  name: string;
  email: string;
  role: ActivityRole;
  roll_number: string | null;
}

export interface AccountFacts {
  state: AccountState;
  state_label: string;
  created_at: string;
  first_tried_at: string | null;
  password_set_at: string | null;
  first_signin_at: string | null;
  last_signin_at: string | null;
  last_seen_at: string | null;
  sign_ins: number;
  failed_attempts: number;
  visits: number;
  page_views: number;
  active_seconds: number;
}

export interface CollegeAccount extends AccountFacts {
  user: PersonRef;
  device: string | null;
  browser: string | null;
  os: string | null;
}

export interface RecentItem {
  kind: "page" | "auth";
  user_id: number | null;
  name: string | null;
  role: ActivityRole | null;
  what: string;
  reason?: string | null;
  seconds?: number;
  scroll?: number;
  at: string;
}

export interface CollegeDetail {
  college: { id: number; name: string; code: string | null; city: string | null; state: string | null; is_active: boolean; plan: PlanInfo | null };
  status: CollegeStatus;
  status_label: string;
  accounts: CollegeAccount[];
  students: StudentFunnel;
  online_now: number;
  daily: DayPoint[];
  sections: SectionStat[];
  recent: RecentItem[];
  days: number;
}

export interface PeopleRow extends AccountFacts {
  user: PersonRef;
}

export interface PeopleList {
  total: number;
  page: number;
  per_page: number;
  rows: PeopleRow[];
}

export interface PersonVisit {
  id: number;
  started_at: string;
  last_seen_at: string;
  active_minutes: number;
  pages: number;
  device: string | null;
  browser: string | null;
  os: string | null;
  ip: string | null;
  views: { section: string; path: string; at: string; seconds: number; scroll: number }[];
}

export interface PersonInterviewSessionSummary {
  id: number;
  title: string;
  round_name: string | null;
  type: string | null;
  status: string;
  composite_score_percent: number | null;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
}

export interface PersonInterviewSummary {
  total_sessions: number;
  completed_sessions: number;
  total_practice_minutes: number;
  average_score: number;
  sessions: PersonInterviewSessionSummary[];
}

export interface PersonPlatformSummary {
  devices: string[];
  browsers: string[];
  os_list: string[];
  primary_device: string | null;
  last_ip: string | null;
}

export interface VisitorSection {
  section: string;
  views: number;
  active_minutes: number;
  active_seconds: number;
}

export interface VisitorRow {
  user: {
    id: number;
    name: string;
    email: string;
    role: ActivityRole;
    roll_number: string | null;
    college_id: number | null;
    college: string;
    is_independent: boolean;
  };
  visits_count: number;
  active_minutes: number;
  active_seconds: number;
  pages_count: number;
  first_seen_at: string;
  last_seen_at: string;
  is_online: boolean;
  device: string | null;
  browser: string | null;
  os: string | null;
  ip: string | null;
  current_section: string | null;
  current_path: string | null;
  sections: VisitorSection[];
}

export interface VisitorsResponse {
  period: string;
  label: string;
  total: number;
  page: number;
  per_page: number;
  last_page: number;
  rows: VisitorRow[];
}

export interface PersonDetail {
  user: PersonRef & { college: string | null; is_blocked: boolean; is_independent?: boolean };
  facts: AccountFacts;
  online_now: boolean;
  interviews?: PersonInterviewSummary | null;
  platforms?: PersonPlatformSummary;
  events: { event: string; reason: string | null; portal: string | null; device: string | null; browser: string | null; os: string | null; ip: string | null; at: string }[];
  visits: PersonVisit[];
  sections: { section: string; views: number; seconds: number; avg_scroll: number; last_at: string }[];
}

export interface SignInRow {
  id: number;
  event: string;
  reason: string | null;
  user_id: number | null;
  name: string | null;
  email: string | null;
  role: ActivityRole | null;
  college_id: number | null;
  college: string | null;
  portal: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  ip: string | null;
  at: string;
}

export interface SignInList {
  total: number;
  page: number;
  per_page: number;
  rows: SignInRow[];
}

export interface Glance {
  online: number;
  today: number;
  last_7_days: number;
  sign_ins_today: number;
  tracking: boolean;
}

export interface AttentionItem {
  key: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  count: number;
  tab: string;
  examples: { id?: number; label: string; note?: string | null }[];
}

export interface UsageTimelineDataPoint {
  time_key: string;
  label: string;
  full_label: string;
  users: number;
  visits: number;
  minutes: number;
  actions: number;
  interviews: number;
  submissions: number;
  sign_ins: number;
}

export interface UsageTimelineKpis {
  unique_users: number;
  total_visits: number;
  total_minutes: number;
  total_hours: number;
  avg_minutes_per_user: number;
  interviews_completed: number;
  interviews_total: number;
  submissions_total: number;
  sign_ins_total: number;
  peak_metric_label: string;
}

export interface UsageTimelineResponse {
  period: "today" | "yesterday" | "this_week" | "this_month" | "day";
  selected_date: string;
  date_formatted: string;
  timezone: string;
  view_mode: "hourly" | "daily";
  kpis: UsageTimelineKpis;
  graph: UsageTimelineDataPoint[];
  available_range: {
    min_date: string;
    max_date: string;
  };
}
