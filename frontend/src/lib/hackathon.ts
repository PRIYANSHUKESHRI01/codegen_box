import { useEffect, useState, type CSSProperties } from "react";
import { api, ApiError } from "@/lib/api";
import type {
  ArenaCatalogue,
  ArenaHome,
  ArenaStats,
  CatalogueFilter,
  HackathonAccent,
  HackathonCard,
  HackathonDetail,
  HackathonMode,
  HackathonPhase,
  PublicProject,
} from "@/types/hackathon";

/* ── Accent colours ────────────────────────────────────────────────────────
 * A hackathon picks one of eight colour families. Rather than eight sets of
 * utility classes, each is two RGB triples published as CSS variables (--ar-a
 * → --ar-b run the gradient); arena.css turns them into glows, borders and
 * button fills, so one hackathon's page and cards all stay in key.
 */
const ACCENT_TRIPLES: Record<HackathonAccent, { a: string; b: string }> = {
  indigo: { a: "99 102 241", b: "56 189 248" },
  violet: { a: "139 92 246", b: "236 72 153" },
  fuchsia: { a: "217 70 239", b: "251 146 60" },
  rose: { a: "244 63 94", b: "251 146 60" },
  amber: { a: "245 158 11", b: "244 63 94" },
  emerald: { a: "16 185 129", b: "132 204 22" },
  teal: { a: "20 184 166", b: "99 102 241" },
  sky: { a: "14 165 233", b: "139 92 246" },
};

export const ACCENTS = Object.keys(ACCENT_TRIPLES) as HackathonAccent[];

/** Inline style that tints a subtree with a hackathon's colours. */
export function accentVars(accent: HackathonAccent): CSSProperties {
  const t = ACCENT_TRIPLES[accent] ?? ACCENT_TRIPLES.indigo;
  return { "--ar-a": t.a, "--ar-b": t.b } as CSSProperties;
}

/** Swatch gradient for the host's colour picker. */
export function accentSwatch(accent: HackathonAccent): string {
  const t = ACCENT_TRIPLES[accent] ?? ACCENT_TRIPLES.indigo;
  return `linear-gradient(135deg, rgb(${t.a}), rgb(${t.b}))`;
}

/* ── Phases ───────────────────────────────────────────────────────────────── */

export type PhaseTone = "live" | "open" | "soon" | "judging" | "done" | "muted";

export const PHASE_META: Record<HackathonPhase, { label: string; tone: PhaseTone; hint: string }> = {
  draft: { label: "Draft", tone: "muted", hint: "Only you can see this." },
  cancelled: { label: "Cancelled", tone: "muted", hint: "This hackathon was called off." },
  upcoming: { label: "Opening soon", tone: "soon", hint: "Registration has not opened yet." },
  registration_open: { label: "Registration open", tone: "open", hint: "Sign up now." },
  starting_soon: { label: "Starts soon", tone: "soon", hint: "Registration has closed; kickoff is near." },
  live: { label: "Live now", tone: "live", hint: "Building is under way." },
  judging: { label: "Judging", tone: "judging", hint: "Submissions are closed; results are coming." },
  completed: { label: "Completed", tone: "done", hint: "Results are in." },
};

export const MODE_LABEL: Record<HackathonMode, string> = {
  online: "Online",
  in_person: "In person",
  hybrid: "Hybrid",
};

/** The next moment worth counting down to, or null when there isn't one (judging, finished…). */
export function nextMilestone(h: Pick<HackathonCard, "phase" | "registration_opens_at" | "registration_closes_at" | "starts_at" | "ends_at">): { label: string; at: string } | null {
  switch (h.phase) {
    case "upcoming":
      return { label: "Registration opens in", at: h.registration_opens_at };
    case "registration_open":
      // Kickoff is what people plan around; registration closing is the urgent one if it comes first.
      return new Date(h.registration_closes_at) < new Date(h.starts_at)
        ? { label: "Registration closes in", at: h.registration_closes_at }
        : { label: "Kickoff in", at: h.starts_at };
    case "starting_soon":
      return { label: "Kickoff in", at: h.starts_at };
    case "live":
      return { label: "Submissions close in", at: h.ends_at };
    default:
      return null;
  }
}

/** What a card's call to action says and where the student should land, given their own state. */
export function cardAction(h: HackathonCard): { label: string; emphasis: "primary" | "secondary" } {
  const mine = h.mine;

  if (mine) {
    if (h.phase === "live") {
      return { label: mine.submission_status === "submitted" ? "View your project" : "Continue project", emphasis: "primary" };
    }
    if (h.phase === "completed") return { label: mine.rank ? "See your result" : "View results", emphasis: "secondary" };
    if (h.phase === "judging") return { label: "Track results", emphasis: "secondary" };
    return { label: "Open your entry", emphasis: "secondary" };
  }

  if (h.phase === "completed") return { label: "View results", emphasis: "secondary" };
  if (h.phase === "judging") return { label: "See projects", emphasis: "secondary" };
  if (h.registration_open) return { label: h.phase === "live" ? "Join late" : "Register now", emphasis: "primary" };

  return { label: "View details", emphasis: "secondary" };
}

/* ── Formatting ───────────────────────────────────────────────────────────── */

/** "₹1,50,000" — the full figure, with the locale's own digit grouping. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** "₹1.5L", "₹2 Cr", "$25K" — what fits on a card. Indian lakh/crore for rupees, as people there say it. */
export function compactMoney(amount: number, currency: string): string {
  if (amount <= 0) return "Perks & recognition";

  const trim = (n: number) => String(Math.round(n * 10) / 10).replace(/\.0$/, "");

  if (currency === "INR") {
    if (amount >= 10_000_000) return `₹${trim(amount / 10_000_000)} Cr`;
    if (amount >= 100_000) return `₹${trim(amount / 100_000)}L`;
    if (amount >= 1_000) return `₹${trim(amount / 1_000)}K`;
    return `₹${amount}`;
  }

  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, notation: "compact", minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

const DATE_SHORT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
const DATE_LONG: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const TIME: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

export function formatDate(iso: string, withYear = false): string {
  return new Date(iso).toLocaleDateString("en-IN", withYear ? DATE_LONG : DATE_SHORT);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", DATE_SHORT)}, ${d.toLocaleTimeString("en-IN", TIME)}`;
}

/** "12 – 14 Oct", "28 Oct – 2 Nov", or "12 Oct" for a single day. */
export function formatRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);

  if (s.toDateString() === e.toDateString()) return formatDate(startIso);

  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} – ${e.getDate()} ${e.toLocaleDateString("en-IN", { month: "short" })}`;
  }

  return `${formatDate(startIso)} – ${formatDate(endIso)}`;
}

export interface TimeLeft {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function timeLeft(targetIso: string, now: number = Date.now()): TimeLeft {
  const total = Math.max(0, new Date(targetIso).getTime() - now);
  const seconds = Math.floor(total / 1000);

  return {
    total,
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3_600),
    minutes: Math.floor((seconds % 3_600) / 60),
    seconds: seconds % 60,
  };
}

/** "in 3 days", "in 5 hours", "2 days ago", "just now". */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return "just now";

  const [value, unit] = abs >= day ? [Math.round(abs / day), "day"] : abs >= hour ? [Math.round(abs / hour), "hour"] : [Math.round(abs / minute), "minute"];
  const span = `${value} ${unit}${value === 1 ? "" : "s"}`;

  return diff > 0 ? `in ${span}` : `${span} ago`;
}

/** Re-renders on an interval with the current time — for countdowns. Starts at 0 so server/static HTML never disagrees with the client. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

export const MEDALS: Record<number, { label: string; emoji: string; text: string; ring: string; fill: string }> = {
  1: { label: "1st", emoji: "🥇", text: "text-amber-300", ring: "ring-amber-300/50", fill: "from-amber-300 to-yellow-500" },
  2: { label: "2nd", emoji: "🥈", text: "text-slate-200", ring: "ring-slate-200/45", fill: "from-slate-200 to-slate-400" },
  3: { label: "3rd", emoji: "🥉", text: "text-orange-300", ring: "ring-orange-300/45", fill: "from-orange-300 to-amber-600" },
};

export function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** Initials for an avatar fallback — first and last word. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** True for an absolute http(s) URL — the only kind a project link may be. */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** The message from a failed API call, or a fallback — the server's wording is written for users. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message || fallback : fallback;
}

/** Machine-readable reason for a failed call (e.g. "full", "team_locked"), if the server sent one. */
export function errorCode(err: unknown): string | undefined {
  return err instanceof ApiError ? err.code : undefined;
}

/* ── API ──────────────────────────────────────────────────────────────────── */

export interface CatalogueQuery {
  phase?: CatalogueFilter;
  mode?: HackathonMode | "";
  host?: "platform" | "company" | "";
  theme?: string;
  q?: string;
  page?: number;
}

export function catalogueQueryString(query: CatalogueQuery): string {
  const params = new URLSearchParams();

  if (query.phase && query.phase !== "all") params.set("phase", query.phase);
  if (query.mode) params.set("mode", query.mode);
  if (query.host) params.set("host", query.host);
  if (query.theme) params.set("theme", query.theme);
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.page && query.page > 1) params.set("page", String(query.page));

  const s = params.toString();
  return s ? `?${s}` : "";
}

const slugPath = (slug: string) => `/arena/hackathons/${encodeURIComponent(slug)}`;

export const arenaApi = {
  home: () => api.get<ArenaHome>("/arena/home"),
  catalogue: (query: CatalogueQuery) => api.get<ArenaCatalogue>(`/arena/hackathons${catalogueQueryString(query)}`),
  mine: () => api.get<{ stats: ArenaStats | null; hackathons: HackathonCard[] }>("/arena/mine"),
  detail: (slug: string) => api.get<{ hackathon: HackathonDetail }>(slugPath(slug)),
  register: (slug: string, body: { mode: "solo" | "create" | "join"; team_name?: string; invite_code?: string }) =>
    api.post<{ hackathon: HackathonDetail }>(`${slugPath(slug)}/register`, body),
  withdraw: (slug: string) => api.post<{ hackathon: HackathonDetail }>(`${slugPath(slug)}/withdraw`),
  removeMember: (slug: string, userId: number) => api.post<{ hackathon: HackathonDetail }>(`${slugPath(slug)}/team/members/${userId}/remove`),
  saveProject: (slug: string, body: Record<string, unknown>) => api.put<{ hackathon: HackathonDetail }>(`${slugPath(slug)}/submission`, body),
  gallery: (slug: string, params: { track?: string; q?: string; page?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.track) qs.set("track", params.track);
    if (params.q?.trim()) qs.set("q", params.q.trim());
    if (params.page && params.page > 1) qs.set("page", String(params.page));
    const s = qs.toString();
    return api.get<{ projects: PublicProject[]; meta: { page: number; last_page: number; total: number }; results_published: boolean }>(
      `${slugPath(slug)}/gallery${s ? `?${s}` : ""}`
    );
  },
  results: (slug: string) => api.get<{ results: PublicProject[]; criteria: { name: string; weight: number }[] }>(`${slugPath(slug)}/results`),
};

/** Where a card should send the student. A query string, not a path param — the app is a static export. */
export function hackathonHref(slug: string, tab?: string): string {
  return `/arena/hackathon?slug=${encodeURIComponent(slug)}${tab ? `&tab=${tab}` : ""}`;
}
