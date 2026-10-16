/**
 * Every role the platform has, as the superadmin's account screens label them.
 * The shared ROLE_LABEL in ./types only knows the five roles the older tabs deal
 * with (and the Audit Log builds its filter from it), so the account screens
 * keep this complete map rather than widening that one.
 */
export const ACCOUNT_ROLE: Record<string, { label: string; badge: string }> = {
  superadmin: { label: "Superadmin", badge: "bg-amber-500/10 text-amber-500 border-amber-500/25" },
  admin_internal: { label: "Mellow Staff (Ops)", badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" },
  admin_marketing: { label: "Mellow Staff (Marketing)", badge: "bg-rose-500/10 text-rose-400 border-rose-500/25" },
  admin_tpo: { label: "College TPO", badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25" },
  section_coordinator: { label: "Section Coordinator", badge: "bg-sky-500/10 text-sky-400 border-sky-500/25" },
  admin_company: { label: "Hiring Company", badge: "bg-violet-500/10 text-violet-400 border-violet-500/25" },
  user: { label: "Student / Coder", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" },
};

export const roleInfo = (role: string) => ACCOUNT_ROLE[role] ?? { label: role, badge: "bg-elevated text-text-secondary border-border-subtle" };

export const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All accounts" },
  { value: "admin_tpo", label: "College TPOs" },
  { value: "section_coordinator", label: "Section Coordinators" },
  { value: "user", label: "Students & coders" },
  { value: "admin_company", label: "Hiring companies" },
  { value: "admin_internal,admin_marketing", label: "Mellow staff" },
  { value: "superadmin", label: "Superadmins" },
];

/** Plan filter values the user directory understands (see SuperAdminController::users()). */
export const PLAN_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Any plan" },
  { value: "paid", label: "Any paid plan" },
  { value: "grandmaster", label: "Grandmaster (Mellow Academy)" },
  { value: "expert", label: "Expert" },
  { value: "free", label: "Free (Coder)" },
  { value: "none", label: "No running plan" },
];
