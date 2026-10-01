/**
 * Shared types/mappers for every superadmin tab panel — lifted out of the
 * old monolithic superadmin/page.tsx, mirroring components/admin/placements/
 * types.ts's role in that page's own tab split.
 */

export type PlatformRole = "superadmin" | "admin_internal" | "admin_tpo" | "admin_marketing" | "user";

/** A user of ANY role, as returned by the superadmin-only /superadmin/users cross-role directory. */
export interface ApiPlatformUser {
  id: number;
  name: string;
  email: string;
  handle: string | null;
  role: PlatformRole;
  is_blocked: boolean;
  created_at: string;
  college: { id: number; name: string } | null;
  /** Real academic fields, present on every User row regardless of role (null for staff/TPO accounts). */
  branch: string | null;
  /** Real, attached server-side only on this endpoint's page rows — never fabricated, never computed per-row at unbounded scale. */
  subscription_plan_name?: string | null;
  /** Only present for role=user rows. */
  readiness_tier?: "Placement Ready" | "In Progress" | "Needs Training";
  /** Granular section access — only ever non-null for admin_internal/admin_marketing rows. See User::hasPermission on the backend. */
  permissions: string[] | null;
}

/** Laravel's default paginate() envelope — only the fields actually used. */
export interface ApiPage<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

export interface ApiAuditLog {
  id: number;
  actor_name: string;
  actor_role: string;
  action: string;
  target_type: string | null;
  target_label: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export type CollegeTier = "Academic Enterprise" | "Pro Campus" | "Standard" | "Custom";

export interface ApiCollege {
  id: number;
  name: string;
  short_code: string;
  tier: CollegeTier;
  placement_rate: string;
  is_active: boolean;
  active_students_count?: number;
  created_at: string;
  users?: { id: number; name: string; email: string; is_blocked: boolean }[];
  subscription_status?: string | null;
  subscription_days_remaining?: number | null;
  /** Null legitimately means custom/Academic-Enterprise pricing with no fixed number on file. */
  plan_price?: number | null;
  /** Null = unlimited (Academic Enterprise, or a custom plan negotiated as unlimited). */
  plan_max_students?: number | null;
}

export const ROLE_LABEL: Record<PlatformRole, string> = {
  superadmin: "Superadmin",
  admin_internal: "Mellow Staff (Ops)",
  admin_marketing: "Mellow Staff (Marketing)",
  admin_tpo: "College TPO",
  user: "Student / Coder",
};

export const ROLE_BADGE_CLASS: Record<PlatformRole, string> = {
  superadmin: "bg-amber-500/10 text-amber-500 border-amber-500/25",
  admin_internal: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25",
  admin_marketing: "bg-rose-500/10 text-rose-400 border-rose-500/25",
  admin_tpo: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25",
  user: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
};

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatInr(amount: number): string {
  return amount.toLocaleString("en-IN");
}
