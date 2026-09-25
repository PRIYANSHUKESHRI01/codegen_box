export type Role =
  | "user"
  | "admin_internal"
  | "admin_tpo"
  | "admin_marketing"
  | "superadmin"
  | "section_coordinator"
  | "admin_company";

export interface AuthCollege {
  id: number;
  name: string;
  short_code: string;
  city: string | null;
  state: string | null;
  tier: "Academic Enterprise" | "Pro Campus" | "Standard";
  placement_rate: string;
  is_active: boolean;
}

/** A company hiring tenant — set only for an admin_company account, mirroring AuthCollege for admin_tpo. */
export interface AuthCompany {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  industry: string | null;
  account_type: "catalog_only" | "hiring_tenant";
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  handle: string | null;
  college_id: number | null;
  company_id: number | null;
  is_blocked: boolean;
  college: AuthCollege | null;
  company: AuthCompany | null;
  /** Academic profile — set by the student's college via roster import, never self-editable. */
  roll_number: string | null;
  branch: string | null;
  /** For a student, the section they're in; for a section_coordinator, the one section they manage. Set by the TPO either way, never self-editable. */
  section: string | null;
  cgpa: string | null;
  backlogs: number | null;
  phone: string | null;
  /** Set only after a real Firebase SMS-OTP round-trip (see PhoneVerificationController) — never true just because `phone` is on file. */
  phone_verified_at: string | null;
  /** Real uploaded photo, or null to fall back to an initials avatar (see lib/avatarColor.ts) — same field for every role. */
  avatar_url: string | null;
  /**
   * Granular section access for admin_internal/admin_marketing accounts,
   * set by superadmin (see User::hasPermission on the backend) — null for
   * every other role, which has no permission system of its own. The
   * backend is the real enforcement; this only drives which sections the
   * dashboard bothers to show.
   */
  permissions: string[] | null;
  /**
   * The "recruiter-ready profile" fields — self-edited by a student via
   * StudentProfileController, meaningless (and always null/0) for any other
   * role. `has_resume`/`resume_uploaded_at` are the only resume-related
   * facts ever exposed here; the file itself is only reachable through the
   * authenticated /me/resume download route, never a public URL.
   */
  bio: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  skills: string[] | null;
  has_resume: boolean;
  resume_uploaded_at: string | null;
  /** 0-100, stored (not computed on read) — see User::computeProfileCompletion(). Distinct from the TPO-facing "readiness score," which isn't exposed to the student themselves today. */
  profile_completion_percent: number;
}

/** True for superadmin (always) or when `key` is present in the signed-in user's granted permissions. */
export function userHasPermission(user: AuthUser | null, key: string): boolean {
  if (!user) return false;
  if (user.role === "superadmin") return true;
  return (user.permissions ?? []).includes(key);
}

const TOKEN_KEY = "codeforge_token";
const USER_KEY = "codeforge_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

/**
 * Where a role lands after login, and where a guarded page should bounce a
 * signed-in user who isn't allowed to view it.
 */
export function homeRouteForRole(role: Role): string {
  switch (role) {
    case "superadmin":
      return "/superadmin";
    case "admin_internal":
      return "/admin?view=mellow";
    case "admin_tpo":
      return "/admin?view=tpo";
    case "admin_marketing":
      return "/marketing";
    case "section_coordinator":
      return "/coordinator";
    case "admin_company":
      return "/admin?view=company";
    default:
      return "/dashboard";
  }
}
