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

export interface PersonDetail {
  user: PersonRef & { college: string | null; is_blocked: boolean };
  facts: AccountFacts;
  online_now: boolean;
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
