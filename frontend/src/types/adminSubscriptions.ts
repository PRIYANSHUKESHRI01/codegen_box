// Mirrors the JSON of the superadmin subscription and account endpoints
// (SuperAdminSubscriptionController, SuperAdminAccountController and
// SubscriptionAdminPresenter on the backend). Money is whole rupees.

import type { SubscriptionCoverage } from "./subscription";
import type { PaymentReceipt } from "./payments";

export type SubscriptionState = "active" | "expired" | "canceled";

/** How a subscription came to exist. `system` is the free plan every student starts on. */
export type SubscriptionSource = "purchase" | "admin_grant" | "admin_assigned" | "system";

export type SubscriberType = "user" | "college" | "company" | "deleted";

export interface AdminSubscriptionRow {
  id: number;
  state: SubscriptionState;
  plan: { code: string; name: string; audience: "individual" | "institution" | "company"; kind: "base" | "addon"; is_free: boolean } | null;
  subscriber: { type: SubscriberType; id: number | null; name: string; email: string | null; detail: string | null };
  source: SubscriptionSource;
  is_trial: boolean;
  started_at: string | null;
  /** null = never expires (the free plan). */
  current_period_end: string | null;
  days_remaining: number | null;
  canceled_at: string | null;
  /** What the subscriber was actually charged; 0 for something given free; null when nothing was recorded. */
  price_paid: number | null;
  /** Given by hand with nothing received — brings in no revenue. */
  complimentary: boolean;
  paid_through_gateway: boolean;
  payment_reference: string | null;
  granted_by: string | null;
  reason: string | null;
  canceled_by: string | null;
  cancel_reason: string | null;
  extensions: number;
  can_extend: boolean;
  can_cancel: boolean;
}

export interface SubscriptionsSummary {
  paid_individual: number;
  complimentary: number;
  colleges: number;
  companies: number;
  ending_7_days: number;
  canceled_30_days: number;
}

export interface AdminSubscriptionsResponse {
  summary: SubscriptionsSummary;
  subscriptions: AdminSubscriptionRow[];
  pagination: { current_page: number; last_page: number; total: number };
}

export interface StudentSearchHit {
  id: number;
  name: string;
  email: string;
  college: string | null;
  is_blocked: boolean;
  plan_name: string | null;
  plan_source: "individual" | "institution" | "none";
  days_remaining: number | null;
}

export type GrantKind = "complimentary" | "offline_payment";

export interface GrantPlanBody {
  plan_code: string;
  days: number;
  kind: GrantKind;
  amount?: number;
  reference?: string;
  reason: string;
}

/** The answer to any plan change: the row as it now is, and (for a student) their coverage as their own screen will read it. */
export interface SubscriptionChangeResponse {
  subscription: AdminSubscriptionRow;
  coverage?: SubscriptionCoverage;
  warning?: string;
}

// ───────────────────────────── the "Manage" drawer ─────────────────────────────

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  handle: string | null;
  phone: string | null;
  phone_verified: boolean;
  role: string;
  college: { id: number; name: string } | null;
  company: { id: number; name: string } | null;
  section: string | null;
  roll_number: string | null;
  branch: string | null;
  cgpa: string | null;
  backlogs: number | null;
  permissions: string[] | null;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  blocked_by: string | null;
  created_at: string;
  last_seen_at: string | null;
  lead_status: string | null;
  is_lead: boolean;
}

export interface ManagedActivity {
  id: number;
  action: string;
  /** "self" when the account did it itself; otherwise the name of whoever acted on it. */
  by: string;
  by_role: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface ManagedUserResponse {
  user: ManagedUser;
  login: {
    login_id: string;
    password_state: "temporary" | "set_by_user";
    credential_state?: "viewable" | "owner_set" | "not_recorded" | "protected";
    credentials_email_sent_at: string | null;
    last_seen_at: string | null;
    active_sessions: number;
  };
  /** Students only. */
  plan: {
    coverage: SubscriptionCoverage;
    covered_by_college: boolean;
    college_name: string | null;
    history: AdminSubscriptionRow[];
    addons: { code: string; name: string; days_remaining: number | null }[];
  } | null;
  payments: PaymentReceipt[];
  activity: ManagedActivity[];
  capabilities: {
    edit: boolean;
    reset_password: boolean;
    revoke_sessions: boolean;
    view_as: boolean;
    delete: boolean;
    grant_plan: boolean;
    block: boolean;
  };
}

export interface ViewAsResponse {
  token: string;
  user: import("@/lib/auth").AuthUser;
  expires_at: string;
  minutes: number;
}

export interface DeletionPreview {
  user: { id: number; name: string; email: string; role: string };
  impact: {
    practice_submissions: number;
    contest_entries: number;
    interview_sessions: number;
    drive_applications: number;
    subscriptions: number;
    payments_kept: number;
  };
}
