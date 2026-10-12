/**
 * Hack Arena API shapes. Mirrors App\Services\Hackathons\HackathonPresenter on
 * the backend — that class is the single place that decides what each audience
 * may see, so these types only describe what it already filtered.
 */

export type HackathonStatus = "draft" | "published" | "cancelled";

/** Where a hackathon is in its life — derived from the clock on the server, never stored. */
export type HackathonPhase =
  | "draft"
  | "cancelled"
  | "upcoming"
  | "registration_open"
  | "starting_soon"
  | "live"
  | "judging"
  | "completed";

export type HackathonMode = "online" | "in_person" | "hybrid";

/** Who a hackathon is shown to: every student, or only the students of the colleges its host mapped it to. */
export type HackathonAudience = "all" | "colleges";

export type HackathonAccent = "indigo" | "violet" | "fuchsia" | "rose" | "amber" | "emerald" | "teal" | "sky";

export interface HackathonHost {
  type: "platform" | "company";
  name: string;
  /** A company's mark: a short emoji or an image URL. Always null for the platform. */
  logo: string | null;
  industry: string | null;
  website_url: string | null;
}

export interface HackathonPrize {
  place: number;
  title: string;
  reward: string | null;
  perks: string[];
}

export interface HackathonTrack {
  name: string;
  description: string | null;
}

export interface HackathonCriterion {
  name: string;
  weight: number;
  description: string | null;
}

export interface HackathonFaq {
  question: string;
  answer: string;
}

export interface HackathonResource {
  label: string;
  url: string;
}

/** The viewer's own entry in a hackathon, as it appears on a card. Rank/score are null until the host publishes results. */
export interface MyEntry {
  team_id: number;
  team_name: string | null;
  role: "leader" | "member";
  submission_status: "draft" | "submitted" | null;
  rank: number | null;
  award_label: string | null;
  score: number | null;
  is_disqualified: boolean;
}

export interface HackathonCard {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  cover_url: string | null;
  accent: HackathonAccent;
  themes: string[];
  mode: HackathonMode;
  location: string | null;
  host: HackathonHost;
  status: HackathonStatus;
  phase: HackathonPhase;
  is_featured: boolean;
  /** 'colleges' = exclusive to the viewer's own college (a student only ever receives one their college is mapped to). */
  audience: HackathonAudience;
  registration_opens_at: string;
  registration_closes_at: string;
  starts_at: string;
  ends_at: string;
  results_published_at: string | null;
  prize_pool: { amount: number; currency: string };
  team_size: { min: number; max: number };
  participants_count: number;
  teams_count: number;
  max_participants: number | null;
  spots_left: number | null;
  registration_open: boolean;
  mine: MyEntry | null;
}

export interface TimelineEvent {
  key: string;
  label: string;
  at: string;
  state: "done" | "next" | "upcoming";
  expected: boolean;
}

export type RegistrationState = "open" | "full" | "not_open" | "closed" | "registered" | "unavailable";

export interface TeamMember {
  user_id: number;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  is_leader: boolean;
  is_you?: boolean;
}

export interface MyTeam {
  id: number;
  name: string;
  invite_code: string;
  is_leader: boolean;
  max_size: number;
  min_size: number;
  locked: boolean;
  members: TeamMember[];
}

export interface TeamSummary {
  id: number;
  name: string;
  members: Omit<TeamMember, "is_you">[];
}

/** The viewer's own team's project. Marks and feedback are empty/null until results are published. */
export interface MyProject {
  id: number;
  title: string;
  tagline: string | null;
  description: string | null;
  track: string | null;
  repo_url: string | null;
  demo_url: string | null;
  video_url: string | null;
  tech_stack: string[];
  status: "draft" | "submitted";
  submitted_at: string | null;
  updated_at: string | null;
  feedback: string | null;
  scores: Record<string, number>;
  score: number | null;
  rank: number | null;
  award_label: string | null;
  is_disqualified: boolean;
  disqualified_reason: string | null;
}

/** A project as other students see it in the gallery and results. */
export interface PublicProject {
  id: number;
  title: string;
  tagline: string | null;
  description: string | null;
  track: string | null;
  repo_url: string | null;
  demo_url: string | null;
  video_url: string | null;
  tech_stack: string[];
  submitted_at: string | null;
  team: TeamSummary;
  rank: number | null;
  award_label: string | null;
  score: number | null;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  author: string | null;
  created_at: string;
}

export interface SubmissionAccess {
  allowed: boolean;
  code: string | null;
  message: string | null;
}

export interface HackathonDetail extends HackathonCard {
  description: string;
  rules: string | null;
  eligibility: string | null;
  prizes: HackathonPrize[];
  tracks: HackathonTrack[];
  criteria: HackathonCriterion[];
  faqs: HackathonFaq[];
  resources: HackathonResource[];
  timeline: TimelineEvent[];
  registration: {
    state: RegistrationState;
    can_register: boolean;
    allows_teams: boolean;
    team_required: boolean;
  };
  submission_access: SubmissionAccess;
  my_team: MyTeam | null;
  my_submission: MyProject | null;
  announcements: Announcement[];
  gallery_open: boolean;
  results_published: boolean;
  podium: PublicProject[];
  viewer: {
    role: string | null;
    is_student: boolean;
    can_manage: boolean;
    /** A host looking at the arena the way a student would — read-only. */
    is_preview: boolean;
  };
}

export interface ArenaStats {
  joined: number;
  submitted: number;
  wins: number;
  podiums: number;
  active: number;
}

export interface ArenaHome {
  stats: ArenaStats | null;
  featured: HackathonCard | null;
  live: HackathonCard[];
  upcoming: HackathonCard[];
  recent_results: { hackathon: HackathonCard; winner: PublicProject | null }[];
  totals: { live: number; upcoming: number; past: number };
}

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface ArenaCatalogue {
  hackathons: HackathonCard[];
  meta: PageMeta;
  themes: string[];
}

export type CatalogueFilter = "all" | "live" | "open" | "upcoming" | "past";

// ───────────────────────────── host side ─────────────────────────────

export interface HostHackathonRow {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  cover_url: string | null;
  accent: HackathonAccent;
  status: HackathonStatus;
  phase: HackathonPhase;
  host: HackathonHost;
  mode: HackathonMode;
  is_featured: boolean;
  audience: HackathonAudience;
  /** How many colleges it is mapped to (0 when open to all). */
  college_count: number;
  registration_opens_at: string;
  registration_closes_at: string;
  starts_at: string;
  ends_at: string;
  results_published_at: string | null;
  participants_count: number;
  teams_count: number;
  submitted_count: number;
  unscored_count: number;
  max_participants: number | null;
  prize_pool: { amount: number; currency: string };
}

export interface HostHackathonDetail extends HostHackathonRow {
  description: string;
  themes: string[];
  location: string | null;
  results_expected_at: string | null;
  min_team_size: number;
  max_team_size: number;
  currency: string;
  prize_pool_amount: number;
  prizes: HackathonPrize[];
  tracks: HackathonTrack[];
  criteria: HackathonCriterion[];
  rules: string | null;
  eligibility: string | null;
  faqs: HackathonFaq[];
  resources: HackathonResource[];
  cancelled_reason: string | null;
  college_ids: number[];
  colleges: { id: number; name: string; short_code: string; city: string | null }[];
  has_cover: boolean;
  announcements: Announcement[];
}

export interface HostRegistration {
  id: number;
  registered_at: string | null;
  role: "leader" | "member";
  student: {
    id: number;
    name: string;
    email: string;
    handle: string | null;
    avatar_url: string | null;
    college: string | null;
    branch: string | null;
  };
  team: { id: number; name: string };
}

export interface HostSubmission {
  id: number;
  title: string;
  tagline: string | null;
  description: string | null;
  track: string | null;
  repo_url: string | null;
  demo_url: string | null;
  video_url: string | null;
  tech_stack: string[];
  status: "draft" | "submitted";
  submitted_at: string | null;
  updated_at: string | null;
  team: TeamSummary & { size: number };
  scores: Record<string, number>;
  final_score: number | null;
  rank: number | null;
  award_label: string | null;
  feedback: string | null;
  scored_at: string | null;
  is_disqualified: boolean;
  disqualified_reason: string | null;
}

/** The body the host's form sends. Dates are UTC ISO strings. */
export interface HackathonFormPayload {
  title: string;
  tagline: string;
  description: string;
  accent: HackathonAccent;
  themes: string[];
  mode: HackathonMode;
  location: string | null;
  registration_opens_at: string;
  registration_closes_at: string;
  starts_at: string;
  ends_at: string;
  results_expected_at: string | null;
  min_team_size: number;
  max_team_size: number;
  max_participants: number | null;
  prize_pool_amount: number;
  currency: string;
  prizes: HackathonPrize[];
  tracks: HackathonTrack[];
  criteria: HackathonCriterion[];
  rules: string | null;
  eligibility: string | null;
  faqs: HackathonFaq[];
  resources: HackathonResource[];
  is_featured: boolean;
  audience: HackathonAudience;
  /** Only sent (and only meaningful) when audience is 'colleges'. */
  college_ids: number[];
}

/** One college a host can map a hackathon to, with an aggregate student count (never a roster). */
export interface HostCollegeOption {
  id: number;
  name: string;
  short_code: string;
  city: string | null;
  state: string | null;
  student_count: number;
}

/** Which dashboard the host is working from — decides the API prefix and where "back" goes. */
export type HostScope = "admin" | "company";
