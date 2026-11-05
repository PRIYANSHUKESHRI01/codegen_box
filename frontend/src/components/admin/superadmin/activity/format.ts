import type { AccountState, ActivityRole, CollegeStatus } from "@/types/activity";

const IST = "Asia/Kolkata";

/** "just now", "5 min ago", "3 h ago", "2 days ago" — and a date once it is older than a month. */
export function ago(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "never";
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date(iso);
}

/** "4 Nov, 8:15 pm" in India time — the clock the platform runs on. */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short", year: "numeric" });
}

export function clock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
}

/** Whole seconds as the shortest honest reading: "40 s", "12 min", "1 h 5 min". */
export function span(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export const ROLE_NAME: Record<ActivityRole, string> = {
  user: "Student",
  admin_tpo: "TPO",
  section_coordinator: "Coordinator",
  admin_company: "Hiring partner",
  admin_internal: "Mellow Ops",
  admin_marketing: "Marketing",
  superadmin: "Superadmin",
};

export const ROLE_TONE: Record<ActivityRole, string> = {
  user: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-300",
  admin_tpo: "bg-cyan-500/10 text-cyan-700 border-cyan-500/25 dark:text-cyan-300",
  section_coordinator: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300",
  admin_company: "bg-violet-500/10 text-violet-700 border-violet-500/25 dark:text-violet-300",
  admin_internal: "bg-indigo-500/10 text-indigo-600 border-indigo-500/25 dark:text-indigo-300",
  admin_marketing: "bg-rose-500/10 text-rose-600 border-rose-500/25 dark:text-rose-300",
  superadmin: "bg-amber-500/10 text-amber-600 border-amber-500/25 dark:text-amber-300",
};

export interface StateMeta {
  label: string;
  /** What it means, in the words a founder would use on a call. */
  hint: string;
  tone: string;
  dot: string;
}

export const STATE_META: Record<CollegeStatus, StateMeta> = {
  not_opened: { label: "Login not opened", hint: "The login was issued and nobody has used it yet.", tone: "bg-rose-500/10 text-rose-600 border-rose-500/25 dark:text-rose-300", dot: "bg-rose-500" },
  tried: { label: "Tried, no password yet", hint: "They typed the one-time password but never chose their own.", tone: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300", dot: "bg-amber-500" },
  password_set: { label: "Password set, not in yet", hint: "They chose a password but have not signed in.", tone: "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-300", dot: "bg-amber-500" },
  active: { label: "Active", hint: "Seen within the last week.", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 dark:text-emerald-300", dot: "bg-emerald-500" },
  dormant: { label: "Gone quiet", hint: "Used it before, not seen for over a week.", tone: "bg-slate-500/10 text-slate-600 border-slate-500/25 dark:text-slate-300", dot: "bg-slate-400" },
  no_tpo: { label: "No TPO account", hint: "This college has no TPO login yet.", tone: "bg-slate-500/10 text-slate-600 border-slate-500/25 dark:text-slate-300", dot: "bg-slate-400" },
};

export const STATE_ORDER: CollegeStatus[] = ["not_opened", "tried", "password_set", "dormant", "active", "no_tpo"];

export const EVENT_NAME: Record<string, string> = {
  login: "Signed in",
  login_failed: "Failed sign-in",
  login_blocked: "Blocked account tried to sign in",
  temp_password: "Opened the login (one-time password)",
  otp_requested: "Asked for a verification code",
  password_set: "Chose their own password",
  password_changed: "Changed their password",
};

export const EVENT_TONE: Record<string, string> = {
  login: "text-emerald-600 dark:text-emerald-300",
  login_failed: "text-rose-600 dark:text-rose-300",
  login_blocked: "text-rose-600 dark:text-rose-300",
  temp_password: "text-cyan-700 dark:text-cyan-300",
  otp_requested: "text-cyan-700 dark:text-cyan-300",
  password_set: "text-emerald-600 dark:text-emerald-300",
  password_changed: "text-amber-700 dark:text-amber-300",
};

export const REASON_NAME: Record<string, string> = {
  bad_password: "wrong password",
  unknown_email: "no such e-mail address",
  wrong_portal: "wrong tab on the sign-in page",
  blocked: "account blocked",
  activation: "first password",
  reset: "after a reset",
  settings: "from Settings",
};

export function isAccountState(s: string): s is AccountState {
  return ["not_opened", "tried", "password_set", "active", "dormant"].includes(s);
}
