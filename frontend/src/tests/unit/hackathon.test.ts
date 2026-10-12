import { describe, expect, it } from "vitest";
import {
  ACCENTS,
  accentVars,
  cardAction,
  catalogueQueryString,
  compactMoney,
  formatMoney,
  formatRange,
  hackathonHref,
  initialsOf,
  isHttpUrl,
  nextMilestone,
  ordinal,
  relativeTime,
  timeLeft,
} from "@/lib/hackathon";
import { emptyForm, flattenErrors, payloadFromForm, validateForm, type FormState } from "@/lib/hackathonHost";
import type { HackathonCard, HackathonPhase } from "@/types/hackathon";

const NOW = new Date("2026-10-09T12:00:00Z").getTime();
const at = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

/** A card with just enough set for the helpers under test. */
function card(overrides: Partial<HackathonCard> = {}): HackathonCard {
  return {
    id: 1,
    slug: "demo",
    title: "Demo",
    tagline: "A demo",
    cover_url: null,
    accent: "violet",
    themes: [],
    mode: "online",
    location: null,
    host: { type: "platform", name: "AptRun", logo: null, industry: null, website_url: null },
    status: "published",
    phase: "registration_open",
    is_featured: false,
    audience: "all",
    registration_opens_at: at(-48),
    registration_closes_at: at(48),
    starts_at: at(72),
    ends_at: at(120),
    results_published_at: null,
    prize_pool: { amount: 100000, currency: "INR" },
    team_size: { min: 1, max: 4 },
    participants_count: 0,
    teams_count: 0,
    max_participants: null,
    spots_left: null,
    registration_open: true,
    mine: null,
    ...overrides,
  };
}

describe("money", () => {
  it("shortens rupees the way people in India say them", () => {
    expect(compactMoney(150000, "INR")).toBe("₹1.5L");
    expect(compactMoney(200000, "INR")).toBe("₹2L");
    expect(compactMoney(75000, "INR")).toBe("₹75K");
    expect(compactMoney(10_000_000, "INR")).toBe("₹1 Cr");
    expect(compactMoney(25_000_000, "INR")).toBe("₹2.5 Cr");
    expect(compactMoney(500, "INR")).toBe("₹500");
  });

  it("says so when there is no cash prize", () => {
    expect(compactMoney(0, "INR")).toBe("Perks & recognition");
    expect(compactMoney(-5, "USD")).toBe("Perks & recognition");
  });

  it("formats other currencies compactly", () => {
    expect(compactMoney(25000, "USD")).toBe("$25K");
  });

  it("groups digits Indian-style for the full figure", () => {
    expect(formatMoney(150000, "INR")).toContain("1,50,000");
  });

  it("does not throw on a currency code it does not know", () => {
    expect(() => formatMoney(10, "???")).not.toThrow();
    expect(() => compactMoney(10_000, "???")).not.toThrow();
  });
});

describe("dates", () => {
  const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();

  it("collapses a range inside one month", () => {
    expect(formatRange(local(2026, 10, 12), local(2026, 10, 14))).toMatch(/^12 – 14 Oct/);
  });

  it("keeps both months when a range spans two", () => {
    const text = formatRange(local(2026, 10, 28), local(2026, 11, 2));
    expect(text).toContain("28 Oct");
    expect(text).toContain("2 Nov");
  });

  it("shows a single day once", () => {
    expect(formatRange(local(2026, 10, 12), local(2026, 10, 12))).toBe("12 Oct");
  });

  it("splits a time remaining into days, hours, minutes and seconds", () => {
    const left = timeLeft(at(49.5), NOW);
    expect(left).toMatchObject({ days: 2, hours: 1, minutes: 30, seconds: 0 });
    expect(left.total).toBe(49.5 * 3_600_000);
  });

  it("never counts below zero once the moment has passed", () => {
    expect(timeLeft(at(-3), NOW)).toEqual({ total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("describes a moment relative to now", () => {
    expect(relativeTime(at(72), NOW)).toBe("in 3 days");
    expect(relativeTime(at(24), NOW)).toBe("in 1 day");
    expect(relativeTime(at(5), NOW)).toBe("in 5 hours");
    expect(relativeTime(at(-48), NOW)).toBe("2 days ago");
    expect(relativeTime(at(-1), NOW)).toBe("1 hour ago");
    expect(relativeTime(new Date(NOW + 20_000).toISOString(), NOW)).toBe("just now");
  });
});

describe("small helpers", () => {
  it("writes ordinals, including the teens", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect([11, 12, 13].map(ordinal)).toEqual(["11th", "12th", "13th"]);
    expect([21, 22, 23, 101, 111].map(ordinal)).toEqual(["21st", "22nd", "23rd", "101st", "111th"]);
  });

  it("takes initials from the first and last word", () => {
    expect(initialsOf("Alex Chen")).toBe("AC");
    expect(initialsOf("  priya  ")).toBe("P");
    expect(initialsOf("Dr. Rajeshwar Kumar Sharma")).toBe("DS");
    expect(initialsOf("")).toBe("?");
  });

  it("accepts only http(s) links", () => {
    expect(isHttpUrl("https://github.com/a/b")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("ftp://files.example.com")).toBe(false);
    expect(isHttpUrl("example.com")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });

  it("builds the catalogue query string, leaving defaults out", () => {
    expect(catalogueQueryString({})).toBe("");
    expect(catalogueQueryString({ phase: "all", q: "  " })).toBe("");
    expect(catalogueQueryString({ phase: "live", mode: "hybrid", q: " ai ", page: 2 })).toBe("?phase=live&mode=hybrid&q=ai&page=2");
    expect(catalogueQueryString({ page: 1 })).toBe("");
  });

  it("links by query string (the app is a static export) and encodes the slug", () => {
    expect(hackathonHref("ai-sprint")).toBe("/arena/hackathon?slug=ai-sprint");
    expect(hackathonHref("ai-sprint", "results")).toBe("/arena/hackathon?slug=ai-sprint&tab=results");
    expect(hackathonHref("a b&c")).toBe("/arena/hackathon?slug=a%20b%26c");
  });

  it("publishes every accent as a pair of CSS variables", () => {
    for (const accent of ACCENTS) {
      const vars = accentVars(accent) as Record<string, string>;
      expect(vars["--ar-a"]).toMatch(/^\d+ \d+ \d+$/);
      expect(vars["--ar-b"]).toMatch(/^\d+ \d+ \d+$/);
    }
  });
});

describe("what to count down to", () => {
  it("counts to opening before registration opens", () => {
    expect(nextMilestone(card({ phase: "upcoming" }))?.label).toBe("Registration opens in");
  });

  it("counts to whichever comes first while registering: closing or kickoff", () => {
    expect(nextMilestone(card({ phase: "registration_open", registration_closes_at: at(24), starts_at: at(72) }))?.label).toBe("Registration closes in");
    expect(nextMilestone(card({ phase: "registration_open", registration_closes_at: at(80), starts_at: at(72) }))?.label).toBe("Kickoff in");
  });

  it("counts to the deadline while live, and to nothing once judging starts", () => {
    expect(nextMilestone(card({ phase: "live" }))).toMatchObject({ label: "Submissions close in" });
    for (const phase of ["judging", "completed", "cancelled", "draft"] as HackathonPhase[]) {
      expect(nextMilestone(card({ phase }))).toBeNull();
    }
  });
});

describe("a card's call to action", () => {
  const mine = (over: Partial<NonNullable<HackathonCard["mine"]>> = {}) => ({
    team_id: 1,
    team_name: "Team",
    role: "leader" as const,
    submission_status: null,
    rank: null,
    award_label: null,
    score: null,
    is_disqualified: false,
    ...over,
  });

  it("invites an unregistered student to register while registration is open", () => {
    expect(cardAction(card())).toEqual({ label: "Register now", emphasis: "primary" });
    expect(cardAction(card({ phase: "live" }))).toEqual({ label: "Join late", emphasis: "primary" });
  });

  it("only offers details when registration is not open", () => {
    expect(cardAction(card({ phase: "upcoming", registration_open: false }))).toEqual({ label: "View details", emphasis: "secondary" });
    expect(cardAction(card({ phase: "starting_soon", registration_open: false })).label).toBe("View details");
  });

  it("sends a registered student to their project while live", () => {
    expect(cardAction(card({ phase: "live", mine: mine({ submission_status: "draft" }) })).label).toBe("Continue project");
    expect(cardAction(card({ phase: "live", mine: mine() })).label).toBe("Continue project");
    expect(cardAction(card({ phase: "live", mine: mine({ submission_status: "submitted" }) })).label).toBe("View your project");
  });

  it("points to results, or to the wait for them", () => {
    expect(cardAction(card({ phase: "completed", registration_open: false, mine: mine({ rank: 2 }) })).label).toBe("See your result");
    expect(cardAction(card({ phase: "completed", registration_open: false, mine: mine() })).label).toBe("View results");
    expect(cardAction(card({ phase: "completed", registration_open: false })).label).toBe("View results");
    expect(cardAction(card({ phase: "judging", registration_open: false, mine: mine() })).label).toBe("Track results");
    expect(cardAction(card({ phase: "judging", registration_open: false })).label).toBe("See projects");
  });
});

/* ── The host's form ──────────────────────────────────────────────────────── */

function validForm(over: Partial<FormState> = {}): FormState {
  return {
    ...emptyForm(),
    title: "Open Source Sprint",
    tagline: "Ship a contribution in a weekend.",
    description: "Pick a project you love, find a good first issue and get a pull request merged before the deadline.",
    ...over,
  };
}

describe("hackathon form validation", () => {
  it("accepts a sensible new hackathon", () => {
    expect(validateForm(validForm())).toEqual({});
  });

  it("asks for the essentials", () => {
    const e = validateForm(emptyForm());
    expect(e.title).toBeDefined();
    expect(e.tagline).toBeDefined();
    expect(e.description).toBeDefined();
  });

  it("checks the schedule is in order", () => {
    const base = validForm();
    expect(validateForm({ ...base, registration_closes_at: base.registration_opens_at.replace(/\d{2}:\d{2}$/, "00:00"), registration_opens_at: base.registration_closes_at })).toHaveProperty("registration_closes_at");
    expect(validateForm({ ...base, ends_at: base.starts_at })).toHaveProperty("ends_at");
    // Registration may not stay open past the deadline.
    expect(validateForm({ ...base, registration_closes_at: "2099-01-01T10:00", ends_at: "2098-12-31T10:00", starts_at: "2098-12-30T10:00" })).toHaveProperty("registration_closes_at");
    expect(validateForm({ ...base, results_expected_at: base.starts_at })).toHaveProperty("results_expected_at");
    expect(validateForm({ ...base, starts_at: "" })).toHaveProperty("schedule");
  });

  it("checks team size", () => {
    expect(validateForm(validForm({ min_team_size: "5", max_team_size: "3" }))).toHaveProperty("max_team_size");
    expect(validateForm(validForm({ min_team_size: "0" }))).toHaveProperty("min_team_size");
    expect(validateForm(validForm({ max_team_size: "11" }))).toHaveProperty("max_team_size");
    expect(validateForm(validForm({ min_team_size: "1", max_team_size: "1" }))).toEqual({});
  });

  it("needs a location unless the hackathon is fully online", () => {
    expect(validateForm(validForm({ mode: "hybrid", location: "" }))).toHaveProperty("location");
    expect(validateForm(validForm({ mode: "in_person", location: "  " }))).toHaveProperty("location");
    expect(validateForm(validForm({ mode: "hybrid", location: "Pune" }))).toEqual({});
    expect(validateForm(validForm({ mode: "online", location: "" }))).toEqual({});
  });

  it("requires judging weights to add up to 100, but lets a host leave them out", () => {
    expect(validateForm(validForm({ criteria: [] }))).toEqual({});
    expect(
      validateForm(validForm({ criteria: [{ name: "A", weight: "60", description: "" }, { name: "B", weight: "40", description: "" }] }))
    ).toEqual({});
    expect(
      validateForm(validForm({ criteria: [{ name: "A", weight: "50", description: "" }, { name: "B", weight: "30", description: "" }] })).criteria
    ).toMatch(/add up to 100.*80/);
    expect(
      validateForm(validForm({ criteria: [{ name: "A", weight: "50", description: "" }, { name: "a", weight: "50", description: "" }] })).criteria
    ).toMatch(/different name/);
  });

  it("rejects two prizes for the same place", () => {
    expect(validateForm(validForm({ prizes: [{ place: "1", title: "Gold", reward: "", perks: "" }, { place: "1", title: "Also gold", reward: "", perks: "" }] }))).toHaveProperty("prizes");
    expect(validateForm(validForm({ prizes: [{ place: "1", title: "Gold", reward: "", perks: "" }, { place: "2", title: "Silver", reward: "", perks: "" }] }))).toEqual({});
  });

  it("ignores blank rows rather than complaining about them", () => {
    expect(validateForm(validForm({ prizes: [{ place: "1", title: "", reward: "", perks: "" }], tracks: [{ name: "", description: "" }] }))).toEqual({});
  });

  it("rejects duplicate tracks and non-http resource links", () => {
    expect(validateForm(validForm({ tracks: [{ name: "AI", description: "" }, { name: "ai", description: "" }] }))).toHaveProperty("tracks");
    expect(validateForm(validForm({ resources: [{ label: "Guide", url: "javascript:alert(1)" }] }))).toHaveProperty("resources");
    expect(validateForm(validForm({ resources: [{ label: "Guide", url: "https://example.com" }] }))).toEqual({});
  });

  it("checks the capacity is blank or a sensible number", () => {
    expect(validateForm(validForm({ max_participants: "" }))).toEqual({});
    expect(validateForm(validForm({ max_participants: "1" }))).toHaveProperty("max_participants");
    expect(validateForm(validForm({ max_participants: "abc" }))).toHaveProperty("max_participants");
    expect(validateForm(validForm({ max_participants: "200" }))).toEqual({});
  });
});

describe("hackathon form → request body", () => {
  it("converts numbers, trims text and sends dates as UTC instants", () => {
    const body = payloadFromForm(
      validForm({
        title: "  Padded title  ",
        max_participants: "250",
        prize_pool_amount: "150000",
        registration_opens_at: "2026-10-12T10:00",
      }),
      true
    );

    expect(body.title).toBe("Padded title");
    expect(body.max_participants).toBe(250);
    expect(body.prize_pool_amount).toBe(150000);
    expect(body.min_team_size).toBe(1);
    expect(body.registration_opens_at).toBe(new Date("2026-10-12T10:00").toISOString());
    expect(body.registration_opens_at.endsWith("Z")).toBe(true);
  });

  it("sends null for anything left empty, and drops blank rows", () => {
    const body = payloadFromForm(
      validForm({
        max_participants: "",
        location: "  ",
        rules: "",
        eligibility: "",
        results_expected_at: "",
        prizes: [{ place: "1", title: "Gold", reward: "", perks: "Interview\n\n  AptRun Pro  \n" }, { place: "2", title: "", reward: "", perks: "" }],
        tracks: [{ name: "AI", description: "" }, { name: "", description: "x" }],
        faqs: [{ question: "Solo?", answer: "Yes" }, { question: "Half", answer: "" }],
        resources: [{ label: "Guide", url: "https://x.dev" }, { label: "", url: "" }],
      }),
      true
    );

    expect(body.max_participants).toBeNull();
    expect(body.location).toBeNull();
    expect(body.rules).toBeNull();
    expect(body.eligibility).toBeNull();
    expect(body.results_expected_at).toBeNull();
    expect(body.prizes).toEqual([{ place: 1, title: "Gold", reward: null, perks: ["Interview", "AptRun Pro"] }]);
    expect(body.tracks).toEqual([{ name: "AI", description: null }]);
    expect(body.faqs).toEqual([{ question: "Solo?", answer: "Yes" }]);
    expect(body.resources).toEqual([{ label: "Guide", url: "https://x.dev" }]);
  });

  it("only lets a host who may feature a hackathon do so", () => {
    expect(payloadFromForm(validForm({ is_featured: true }), true).is_featured).toBe(true);
    expect(payloadFromForm(validForm({ is_featured: true }), false).is_featured).toBe(false);
  });
});

describe("hackathon audience", () => {
  it("defaults a new hackathon to every student", () => {
    const f = emptyForm();
    expect(f.audience).toBe("all");
    expect(f.collegeIds).toEqual([]);
  });

  it("needs at least one college when it is limited to colleges", () => {
    expect(validateForm(validForm({ audience: "colleges", collegeIds: [] }))).toHaveProperty("audience");
    expect(validateForm(validForm({ audience: "colleges", collegeIds: [3] }))).toEqual({});
    expect(validateForm(validForm({ audience: "all", collegeIds: [] }))).toEqual({});
  });

  it("sends the chosen colleges only when the audience is colleges", () => {
    const limited = payloadFromForm(validForm({ audience: "colleges", collegeIds: [4, 9] }), true);
    expect(limited.audience).toBe("colleges");
    expect(limited.college_ids).toEqual([4, 9]);

    // A stale selection must never ride along once the host switches back to everyone.
    const open = payloadFromForm(validForm({ audience: "all", collegeIds: [4, 9] }), true);
    expect(open.audience).toBe("all");
    expect(open.college_ids).toEqual([]);
  });
});

describe("server error summaries", () => {
  it("flattens field errors into one list", () => {
    expect(flattenErrors({ title: ["Too short."], "prizes.0.title": ["Required.", "Too long."] })).toEqual(["Too short.", "Required.", "Too long."]);
    expect(flattenErrors(undefined)).toEqual([]);
  });
});
