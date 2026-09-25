/**
 * Mirrors User::PERMISSIONS_INTERNAL/PERMISSIONS_MARKETING on the backend —
 * the real access boundary is server-side (EnsureUserHasPermission on every
 * gated route); this catalog exists so the superadmin hiring UI and the
 * Mellow dashboards themselves can show/hide the right things without
 * duplicating the list from memory in three different components.
 */
export const INTERNAL_PERMISSIONS = ["colleges", "platform_users", "problem_bank", "placements", "contests", "interviews", "customers", "articles", "talent_pool"] as const;
export const MARKETING_PERMISSIONS = ["leads", "lead_outreach"] as const;

export type InternalPermission = (typeof INTERNAL_PERMISSIONS)[number];
export type MarketingPermission = (typeof MARKETING_PERMISSIONS)[number];
export type Permission = InternalPermission | MarketingPermission;

export const PERMISSION_LABELS: Record<Permission, string> = {
  colleges: "Partner Colleges & TPOs",
  platform_users: "Platform Users",
  problem_bank: "Problem Bank",
  placements: "Companies & Placement Drives",
  contests: "Contests",
  interviews: "AI Interviews",
  customers: "My Customers",
  articles: "Articles",
  talent_pool: "Talent Pool",
  leads: "View & Manage Leads",
  lead_outreach: "Send Bulk Lead Emails",
};

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  colleges: "Onboard partner colleges, provision TPO accounts, assign institutional plans.",
  platform_users: "Create and moderate individual coder accounts.",
  problem_bank: "View the practice-problem catalog and its real submission stats.",
  placements: "Manage the company catalog and scheduled placement drives.",
  contests: "Curate and run platform contests.",
  interviews: "Curate and run AI voice interviews.",
  customers: "View converted leads handed off from Marketing.",
  articles: "Write and publish the Articles knowledge base.",
  talent_pool: "Schedule Talent Pool assessments and oversee the shared candidate marketplace.",
  leads: "View assigned leads, update their status, and log notes.",
  lead_outreach: "Send bulk check-in emails to leads.",
};

export function permissionCatalogForRole(role: "admin_internal" | "admin_marketing"): readonly Permission[] {
  return role === "admin_internal" ? INTERNAL_PERMISSIONS : MARKETING_PERMISSIONS;
}
