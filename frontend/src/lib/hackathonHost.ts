import { api } from "@/lib/api";
import { localDatetimeInputToUtcIso, utcIsoToLocalDatetimeInput } from "@/lib/datetime";
import type {
  Announcement,
  HackathonAudience,
  HackathonCriterion,
  HackathonFormPayload,
  HostCollegeOption,
  HostHackathonDetail,
  HostHackathonRow,
  HostRegistration,
  HostScope,
  HostSubmission,
} from "@/types/hackathon";

/**
 * The host-facing API. Ops/superadmin and hiring partners hit the same operations under different
 * prefixes (the server scopes what each may touch), so one set of screens serves both: pass the scope.
 */
export function hostApi(scope: HostScope) {
  const base = scope === "admin" ? "/admin/hackathons" : "/company/hackathons";
  const one = (id: number) => `${base}/${id}`;
  type Wrapped = { hackathon: HostHackathonDetail };

  return {
    list: () =>
      api.get<{ hackathons: HostHackathonRow[]; counts: { total: number; draft: number; live: number; judging: number; needs_scoring: number } }>(base),
    get: (id: number) => api.get<Wrapped>(one(id)),
    /** Every active college a hackathon can be mapped to, plus platform-wide student totals. */
    colleges: () => api.get<{ colleges: HostCollegeOption[]; totals: { students: number; independent_students: number } }>(`${base}/colleges`),
    create: (body: HackathonFormPayload) => api.post<Wrapped>(base, body),
    update: (id: number, body: HackathonFormPayload) => api.put<Wrapped>(one(id), body),
    remove: (id: number) => api.delete<{ message: string }>(one(id)),

    uploadCover: (id: number, file: File) => {
      const form = new FormData();
      form.append("cover", file);
      return api.postFormData<Wrapped>(`${one(id)}/cover`, form);
    },
    deleteCover: (id: number) => api.delete<Wrapped>(`${one(id)}/cover`),

    publish: (id: number) => api.post<Wrapped>(`${one(id)}/publish`),
    unpublish: (id: number) => api.post<Wrapped>(`${one(id)}/unpublish`),
    cancel: (id: number, reason: string) => api.post<Wrapped>(`${one(id)}/cancel`, { reason }),

    registrations: (id: number, q = "") =>
      api.get<{ registrations: HostRegistration[]; totals: { participants: number; teams: number } }>(
        `${one(id)}/registrations${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`
      ),
    exportRegistrations: (id: number) => api.getFile(`${one(id)}/registrations/export`),

    submissions: (id: number) =>
      api.get<{ submissions: HostSubmission[]; criteria: HackathonCriterion[]; judging_open: boolean; unscored_count: number; results_published: boolean }>(
        `${one(id)}/submissions`
      ),
    score: (id: number, submissionId: number, scores: { criterion: string; score: number }[], feedback: string | null) =>
      api.post<{ submission: HostSubmission; unscored_count: number }>(`${one(id)}/submissions/${submissionId}/score`, { scores, feedback }),
    disqualify: (id: number, submissionId: number, reason: string) =>
      api.post<{ submission: HostSubmission; unscored_count: number }>(`${one(id)}/submissions/${submissionId}/disqualify`, { reason }),
    reinstate: (id: number, submissionId: number) =>
      api.post<{ submission: HostSubmission; unscored_count: number }>(`${one(id)}/submissions/${submissionId}/reinstate`),
    publishResults: (id: number) =>
      api.post<{ outcome: { ranked: number; disqualified: number }; hackathon: HostHackathonDetail }>(`${one(id)}/publish-results`),

    postAnnouncement: (id: number, body: { title: string; body: string }) => api.post<{ announcement: Announcement }>(`${one(id)}/announcements`, body),
    deleteAnnouncement: (id: number, announcementId: number) => api.delete<{ message: string }>(`${one(id)}/announcements/${announcementId}`),
  };
}

/** Where each host screen lives, per dashboard. */
export function hostPaths(scope: HostScope) {
  const root = scope === "admin" ? "/admin/hackathons" : "/admin/company/hackathons";

  return {
    list: root,
    edit: (id?: number) => (id ? `${root}/edit?id=${id}` : `${root}/edit`),
    manage: (id: number, tab?: string) => `${root}/manage?id=${id}${tab ? `&tab=${tab}` : ""}`,
  };
}

/* ── The editing form's own shape ─────────────────────────────────────────── */

export interface PrizeRow {
  place: string;
  title: string;
  reward: string;
  /** One perk per line. */
  perks: string;
}

export interface FormState {
  title: string;
  tagline: string;
  description: string;
  accent: HackathonFormPayload["accent"];
  themes: string[];
  mode: HackathonFormPayload["mode"];
  location: string;
  registration_opens_at: string;
  registration_closes_at: string;
  starts_at: string;
  ends_at: string;
  results_expected_at: string;
  min_team_size: string;
  max_team_size: string;
  max_participants: string;
  prize_pool_amount: string;
  currency: string;
  prizes: PrizeRow[];
  tracks: { name: string; description: string }[];
  criteria: { name: string; weight: string; description: string }[];
  rules: string;
  eligibility: string;
  faqs: { question: string; answer: string }[];
  resources: { label: string; url: string }[];
  is_featured: boolean;
  audience: HackathonAudience;
  collegeIds: number[];
}

/** A local datetime-input value `days` from now at a given hour — sensible defaults for a new hackathon's schedule. */
function inDays(days: number, hour: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return utcIsoToLocalDatetimeInput(d.toISOString());
}

export function emptyForm(): FormState {
  return {
    title: "",
    tagline: "",
    description: "",
    accent: "violet",
    themes: [],
    mode: "online",
    location: "",
    registration_opens_at: inDays(1, 10),
    registration_closes_at: inDays(8, 18),
    starts_at: inDays(10, 10),
    ends_at: inDays(12, 18),
    results_expected_at: inDays(17, 18),
    min_team_size: "1",
    max_team_size: "4",
    max_participants: "",
    prize_pool_amount: "0",
    currency: "INR",
    prizes: [],
    tracks: [],
    criteria: [],
    rules: "",
    eligibility: "",
    faqs: [],
    resources: [],
    is_featured: false,
    audience: "all",
    collegeIds: [],
  };
}

export function formFromHackathon(h: HostHackathonDetail): FormState {
  return {
    title: h.title,
    tagline: h.tagline,
    description: h.description,
    accent: h.accent,
    themes: h.themes ?? [],
    mode: h.mode,
    location: h.location ?? "",
    registration_opens_at: utcIsoToLocalDatetimeInput(h.registration_opens_at),
    registration_closes_at: utcIsoToLocalDatetimeInput(h.registration_closes_at),
    starts_at: utcIsoToLocalDatetimeInput(h.starts_at),
    ends_at: utcIsoToLocalDatetimeInput(h.ends_at),
    results_expected_at: utcIsoToLocalDatetimeInput(h.results_expected_at),
    min_team_size: String(h.min_team_size),
    max_team_size: String(h.max_team_size),
    max_participants: h.max_participants === null ? "" : String(h.max_participants),
    prize_pool_amount: String(h.prize_pool_amount),
    currency: h.currency,
    prizes: h.prizes.map((p) => ({ place: String(p.place), title: p.title, reward: p.reward ?? "", perks: p.perks.join("\n") })),
    tracks: h.tracks.map((t) => ({ name: t.name, description: t.description ?? "" })),
    criteria: h.criteria.map((c) => ({ name: c.name, weight: String(c.weight), description: c.description ?? "" })),
    rules: h.rules ?? "",
    eligibility: h.eligibility ?? "",
    faqs: h.faqs.map((f) => ({ question: f.question, answer: f.answer })),
    resources: h.resources.map((r) => ({ label: r.label, url: r.url })),
    is_featured: h.is_featured,
    audience: h.audience,
    collegeIds: h.college_ids ?? [],
  };
}

/** The request body for a form. Dates leave as UTC instants (see lib/datetime for why); blank optional rows are dropped. */
export function payloadFromForm(f: FormState, canFeature: boolean): HackathonFormPayload {
  const trim = (s: string) => s.trim();
  const optional = (s: string) => (trim(s) === "" ? null : trim(s));

  return {
    title: trim(f.title),
    tagline: trim(f.tagline),
    description: trim(f.description),
    accent: f.accent,
    themes: f.themes,
    mode: f.mode,
    location: optional(f.location),
    registration_opens_at: localDatetimeInputToUtcIso(f.registration_opens_at),
    registration_closes_at: localDatetimeInputToUtcIso(f.registration_closes_at),
    starts_at: localDatetimeInputToUtcIso(f.starts_at),
    ends_at: localDatetimeInputToUtcIso(f.ends_at),
    results_expected_at: f.results_expected_at ? localDatetimeInputToUtcIso(f.results_expected_at) : null,
    min_team_size: Number(f.min_team_size),
    max_team_size: Number(f.max_team_size),
    max_participants: trim(f.max_participants) === "" ? null : Number(f.max_participants),
    prize_pool_amount: Number(f.prize_pool_amount || 0),
    currency: f.currency,
    prizes: f.prizes
      .filter((p) => trim(p.title) !== "")
      .map((p) => ({
        place: Number(p.place),
        title: trim(p.title),
        reward: optional(p.reward),
        perks: p.perks.split("\n").map(trim).filter(Boolean),
      })),
    tracks: f.tracks.filter((t) => trim(t.name) !== "").map((t) => ({ name: trim(t.name), description: optional(t.description) })),
    criteria: f.criteria.filter((c) => trim(c.name) !== "").map((c) => ({ name: trim(c.name), weight: Number(c.weight), description: optional(c.description) })),
    rules: optional(f.rules),
    eligibility: optional(f.eligibility),
    faqs: f.faqs.filter((q) => trim(q.question) !== "" && trim(q.answer) !== "").map((q) => ({ question: trim(q.question), answer: trim(q.answer) })),
    resources: f.resources.filter((r) => trim(r.label) !== "" && trim(r.url) !== "").map((r) => ({ label: trim(r.label), url: trim(r.url) })),
    is_featured: canFeature ? f.is_featured : false,
    audience: f.audience,
    college_ids: f.audience === "colleges" ? f.collegeIds : [],
  };
}

/** Problems a form has before it is even sent — the same rules the server enforces, so the host finds out instantly. */
export function validateForm(f: FormState): Record<string, string> {
  const e: Record<string, string> = {};
  const ts = (s: string) => (s ? new Date(s).getTime() : NaN);

  if (f.title.trim().length < 3) e.title = "Give the hackathon a title (at least 3 characters).";
  if (f.tagline.trim().length < 3) e.tagline = "Add a one-line tagline.";
  if (f.description.trim().length < 40) e.description = "Write at least a couple of sentences — students decide whether to join from this.";

  const opens = ts(f.registration_opens_at);
  const closes = ts(f.registration_closes_at);
  const starts = ts(f.starts_at);
  const ends = ts(f.ends_at);

  if ([opens, closes, starts, ends].some(Number.isNaN)) {
    e.schedule = "Fill in all four schedule dates.";
  } else {
    if (closes < opens) e.registration_closes_at = "Registration can't close before it opens.";
    if (ends <= starts) e.ends_at = "The submission deadline must be after the kickoff.";
    if (closes > ends) e.registration_closes_at = "Registration can't stay open past the submission deadline.";
    if (opens >= ends) e.registration_opens_at = "Registration must open before the deadline.";
    if (f.results_expected_at && ts(f.results_expected_at) < ends) e.results_expected_at = "Results can't be expected before the deadline.";
  }

  const min = Number(f.min_team_size);
  const max = Number(f.max_team_size);
  if (!Number.isInteger(min) || min < 1 || min > 10) e.min_team_size = "Between 1 and 10.";
  if (!Number.isInteger(max) || max < 1 || max > 10) e.max_team_size = "Between 1 and 10.";
  else if (Number.isInteger(min) && max < min) e.max_team_size = "Can't be smaller than the minimum.";

  if (f.max_participants.trim() !== "" && (!Number.isInteger(Number(f.max_participants)) || Number(f.max_participants) < 2)) e.max_participants = "Leave blank for no limit, or at least 2.";
  if (!Number.isFinite(Number(f.prize_pool_amount)) || Number(f.prize_pool_amount) < 0) e.prize_pool_amount = "Enter 0 or more.";
  if (f.mode !== "online" && f.location.trim() === "") e.location = "Add a location — this hackathon isn't fully online.";

  const places = f.prizes.filter((p) => p.title.trim()).map((p) => p.place);
  if (new Set(places).size !== places.length) e.prizes = "Two prizes share the same place.";
  if (f.prizes.some((p) => p.title.trim() && (!Number.isInteger(Number(p.place)) || Number(p.place) < 1))) e.prizes = "Every prize needs a place (1, 2, 3…).";

  const criteria = f.criteria.filter((c) => c.name.trim());
  if (criteria.length > 0) {
    const total = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);
    if (Math.abs(total - 100) > 0.01) e.criteria = `Weights must add up to 100 — they add up to ${Math.round(total * 100) / 100}.`;
    if (new Set(criteria.map((c) => c.name.trim().toLowerCase())).size !== criteria.length) e.criteria = "Each criterion needs a different name.";
  }

  const tracks = f.tracks.filter((t) => t.name.trim()).map((t) => t.name.trim().toLowerCase());
  if (new Set(tracks).size !== tracks.length) e.tracks = "Each track needs a different name.";

  if (f.audience === "colleges" && f.collegeIds.length === 0) e.audience = "Pick at least one college, or open the hackathon to all students.";

  if (f.resources.some((r) => r.url.trim() && !/^https?:\/\//i.test(r.url.trim()))) e.resources = "Resource links must start with https://";

  return e;
}

/** Turns an ApiError's `{field: [messages]}` into one flat, readable list for an error summary. */
export function flattenErrors(errors?: Record<string, string[]>): string[] {
  return errors ? Object.values(errors).flat() : [];
}
