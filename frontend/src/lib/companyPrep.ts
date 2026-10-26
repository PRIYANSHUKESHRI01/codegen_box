/**
 * Filtering, faceting and sorting for the Company PYQ hub — pure functions, so every rule the page applies is
 * unit-tested (tests/unit/company-prep.test.ts) rather than only "looked at".
 *
 * Three facets (round, category, year) plus free text and "my college's live drive". They combine with AND, and
 * the three facets are answered from the API's `breakdown` — the exact (round x category x year) combinations — so
 * "Technical Interview" + "2024" only keeps a company that really asked a technical-interview question in 2024.
 * An API without `breakdown` (older deploy) falls back to checking each facet against its own list.
 */

import type { CompanyPrepSummary } from "@/types/companyPrep";

export type PrepFacet = "round" | "category" | "year";

export interface PrepFilters {
  query: string;
  round: string | null;
  category: string | null;
  year: number | null;
  /** Only companies that have a published drive for the student's own college. */
  liveOnly: boolean;
}

export const NO_FILTERS: PrepFilters = { query: "", round: null, category: null, year: null, liveOnly: false };

export type PrepSort = "recommended" | "questions" | "recent" | "rounds" | "name";

export const DEFAULT_SORT: PrepSort = "recommended";

export const SORT_OPTIONS: { value: PrepSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "questions", label: "Most PYQs" },
  { value: "recent", label: "Latest year" },
  { value: "rounds", label: "Most rounds" },
  { value: "name", label: "Name A–Z" },
];

/** The order the categories read in a hiring process; anything the API adds later is appended after these. */
export const CATEGORY_ORDER = ["Aptitude", "Coding", "Technical", "System Design", "HR", "Behavioral"];

export function hasActiveFilters(f: PrepFilters): boolean {
  return !!f.query.trim() || f.round !== null || f.category !== null || f.year !== null || f.liveOnly;
}

/** How many of the three facets are set (the free-text box and the live toggle are counted separately in the UI). */
function hasFacet(f: PrepFilters): boolean {
  return f.round !== null || f.category !== null || f.year !== null;
}

/* ── Matching ───────────────────────────────────────────────────────────── */

function haystackOf(c: CompanyPrepSummary): string {
  return [
    c.name,
    c.slug.replace(/-/g, " "),
    c.industry ?? "",
    ...c.rounds,
    ...c.categories,
    ...c.hiring_process.map((s) => s.name),
  ]
    .join(" ")
    .toLowerCase();
}

/** Every word typed must appear somewhere in the company's name / industry / rounds / categories / stages. Hyphens count as spaces ("tcs-digital" finds TCS Digital). */
export function matchesQuery(c: CompanyPrepSummary, query: string): boolean {
  const tokens = query.toLowerCase().replace(/[-_]+/g, " ").split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = haystackOf(c);
  return tokens.every((t) => hay.includes(t));
}

export type FacetSelection = Pick<PrepFilters, "round" | "category" | "year">;

function rowMatches(row: { round: string | null; category: string; year: number }, sel: FacetSelection): boolean {
  return (
    (sel.round === null || row.round === sel.round) &&
    (sel.category === null || row.category === sel.category) &&
    (sel.year === null || row.year === sel.year)
  );
}

function selectionWithout(f: FacetSelection, ignore?: PrepFacet): FacetSelection {
  return {
    round: ignore === "round" ? null : f.round,
    category: ignore === "category" ? null : f.category,
    year: ignore === "year" ? null : f.year,
  };
}

function facetsMatch(c: CompanyPrepSummary, sel: FacetSelection): boolean {
  if (sel.round === null && sel.category === null && sel.year === null) return true;
  if (c.breakdown) return c.breakdown.some((row) => rowMatches(row, sel));
  return (
    (sel.round === null || c.rounds.includes(sel.round)) &&
    (sel.category === null || c.categories.includes(sel.category)) &&
    (sel.year === null || c.years.includes(sel.year))
  );
}

/** `ignore` leaves one facet out — used to count what each chip of that facet WOULD show if it were picked. */
export function companyMatches(c: CompanyPrepSummary, f: PrepFilters, ignore?: PrepFacet): boolean {
  if (f.liveOnly && !c.has_live_drive) return false;
  if (!matchesQuery(c, f.query)) return false;
  return facetsMatch(c, selectionWithout(f, ignore));
}

export function filterCompanies(companies: CompanyPrepSummary[], f: PrepFilters): CompanyPrepSummary[] {
  return companies.filter((c) => companyMatches(c, f));
}

/**
 * Questions of this company that satisfy the round / category / year selection, or null when the API can't say
 * (no `breakdown`). With no facet selected it is simply the company's total.
 */
export function matchingQuestionCount(c: CompanyPrepSummary, f: PrepFilters): number | null {
  if (!hasFacet(f)) return c.prep_questions_count;
  if (!c.breakdown) return null;
  const sel = selectionWithout(f);
  return c.breakdown.reduce((sum, row) => (rowMatches(row, sel) ? sum + row.count : sum), 0);
}

/* ── Facets ─────────────────────────────────────────────────────────────── */

export interface FacetOptions {
  rounds: string[];
  categories: string[];
  years: number[];
}

/** Every value the catalogue has for each facet, in a STABLE order (chips must not jump around while you filter). */
export function facetOptions(companies: CompanyPrepSummary[]): FacetOptions {
  const roundCompanies = new Map<string, number>();
  const categories = new Set<string>();
  const years = new Set<number>();

  for (const c of companies) {
    for (const r of Array.from(new Set(c.rounds))) roundCompanies.set(r, (roundCompanies.get(r) ?? 0) + 1);
    c.categories.forEach((x) => categories.add(x));
    c.years.forEach((y) => years.add(y));
  }

  const rounds = Array.from(roundCompanies.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  const known = CATEGORY_ORDER.filter((x) => categories.has(x));
  const extra = Array.from(categories)
    .filter((x) => !CATEGORY_ORDER.includes(x))
    .sort((a, b) => a.localeCompare(b));

  return { rounds, categories: [...known, ...extra], years: Array.from(years).sort((a, b) => b - a) };
}

/**
 * For one facet: how many companies would remain if each value were picked, given everything else that is
 * selected. The facet's own current pick is ignored so its siblings still show a real count (otherwise choosing
 * "2024" would zero every other year).
 */
export function facetCounts(companies: CompanyPrepSummary[], f: PrepFilters, facet: PrepFacet): Map<string | number, number> {
  const counts = new Map<string | number, number>();
  const others = selectionWithout(f, facet);

  for (const c of companies) {
    if (!companyMatches(c, f, facet)) continue;

    const values = new Set<string | number>();
    if (c.breakdown) {
      for (const row of c.breakdown) {
        if (!rowMatches(row, others)) continue;
        const v = facet === "round" ? row.round : facet === "category" ? row.category : row.year;
        if (v !== null) values.add(v);
      }
    } else {
      const pool: (string | number)[] = facet === "round" ? c.rounds : facet === "category" ? c.categories : c.years;
      pool.forEach((v) => values.add(v));
    }
    values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  }
  return counts;
}

/* ── One company's own questions (the company page) ─────────────────────── */

export interface PrepQuestionFacets {
  round_name: string | null;
  category: string;
  asked_year: number;
}

const asRow = (q: PrepQuestionFacets) => ({ round: q.round_name, category: q.category, year: q.asked_year });

/** Every word typed must appear in the question, its answer notes, its round or its category. */
export function questionMatchesText(q: PrepQuestionFacets & { question: string; answer_notes: string | null }, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const hay = `${q.question} ${q.answer_notes ?? ""} ${q.round_name ?? ""} ${q.category}`.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

export function filterQuestions<T extends PrepQuestionFacets>(items: T[], sel: FacetSelection, include: (q: T) => boolean = () => true): T[] {
  return items.filter((q) => include(q) && rowMatches(asRow(q), sel));
}

/** How many questions each chip of `facet` would show, given every other selection (and the text search, via `include`). */
export function questionFacetCounts<T extends PrepQuestionFacets>(
  items: T[],
  sel: FacetSelection,
  facet: PrepFacet,
  include: (q: T) => boolean = () => true
): Map<string | number, number> {
  const counts = new Map<string | number, number>();
  const others = selectionWithout(sel, facet);
  for (const q of items) {
    if (!include(q) || !rowMatches(asRow(q), others)) continue;
    const v = facet === "round" ? q.round_name : facet === "category" ? q.category : q.asked_year;
    if (v === null || v === "") continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
}

/** Drop selections the catalogue has no such value for (a stale or hand-edited URL) so they can't silently empty the page. */
export function sanitizeFilters(f: PrepFilters, options: FacetOptions): PrepFilters {
  return {
    ...f,
    round: f.round !== null && options.rounds.includes(f.round) ? f.round : null,
    category: f.category !== null && options.categories.includes(f.category) ? f.category : null,
    year: f.year !== null && options.years.includes(f.year) ? f.year : null,
  };
}

/* ── Sorting + summary ──────────────────────────────────────────────────── */

export function sortCompanies(companies: CompanyPrepSummary[], sort: PrepSort, f: PrepFilters): CompanyPrepSummary[] {
  const count = (c: CompanyPrepSummary) => matchingQuestionCount(c, f) ?? c.prep_questions_count;
  const latest = (c: CompanyPrepSummary) => (c.years.length ? Math.max(...c.years) : 0);
  const byName = (a: CompanyPrepSummary, b: CompanyPrepSummary) => a.name.localeCompare(b.name);

  const list = [...companies];
  switch (sort) {
    case "name":
      return list.sort(byName);
    case "questions":
      return list.sort((a, b) => count(b) - count(a) || byName(a, b));
    case "recent":
      return list.sort((a, b) => latest(b) - latest(a) || count(b) - count(a) || byName(a, b));
    case "rounds":
      return list.sort((a, b) => b.rounds.length - a.rounds.length || count(b) - count(a) || byName(a, b));
    case "recommended":
    default:
      // A drive coming to the student's own campus is the most useful pack to open first.
      return list.sort((a, b) => Number(b.has_live_drive) - Number(a.has_live_drive) || count(b) - count(a) || byName(a, b));
  }
}

export interface CatalogueSummary {
  companies: number;
  questions: number;
  dsaProblems: number;
  firstYear: number | null;
  lastYear: number | null;
  rounds: number;
  liveDrives: number;
}

export function summarizeCatalogue(companies: CompanyPrepSummary[]): CatalogueSummary {
  const rounds = new Set<string>();
  const years: number[] = [];
  let questions = 0;
  let dsaProblems = 0;
  let liveDrives = 0;

  for (const c of companies) {
    questions += c.prep_questions_count;
    dsaProblems += c.recommended_problems_count;
    if (c.has_live_drive) liveDrives += 1;
    c.rounds.forEach((r) => rounds.add(r));
    years.push(...c.years);
  }

  return {
    companies: companies.length,
    questions,
    dsaProblems,
    liveDrives,
    rounds: rounds.size,
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
  };
}

/* ── URL <-> state ──────────────────────────────────────────────────────── */

const SORTS = new Set<string>(SORT_OPTIONS.map((o) => o.value));

/** Reads `?q=&round=&category=&year=&live=1&sort=` so a filtered hub survives Back from a company page and can be shared. */
export function parseFilterSearch(search: string): { filters: PrepFilters; sort: PrepSort } {
  const p = new URLSearchParams(search);
  const year = Number(p.get("year"));
  const sort = p.get("sort") ?? "";
  return {
    filters: {
      query: p.get("q") ?? "",
      round: p.get("round") || null,
      category: p.get("category") || null,
      year: Number.isInteger(year) && year > 0 ? year : null,
      liveOnly: p.get("live") === "1",
    },
    sort: SORTS.has(sort) ? (sort as PrepSort) : DEFAULT_SORT,
  };
}

/** Inverse of parseFilterSearch: "" when nothing is set, else "?…" (defaults are left out to keep the URL clean). */
export function filterSearch(f: PrepFilters, sort: PrepSort): string {
  const p = new URLSearchParams();
  if (f.query.trim()) p.set("q", f.query.trim());
  if (f.round !== null) p.set("round", f.round);
  if (f.category !== null) p.set("category", f.category);
  if (f.year !== null) p.set("year", String(f.year));
  if (f.liveOnly) p.set("live", "1");
  if (sort !== DEFAULT_SORT) p.set("sort", sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** The facet selection a company page should open with ("&round=…&year=…"), so the filters you used carry through. */
export function detailFilterQuery(f: PrepFilters): string {
  const p = new URLSearchParams();
  if (f.round !== null) p.set("round", f.round);
  if (f.category !== null) p.set("category", f.category);
  if (f.year !== null) p.set("year", String(f.year));
  const s = p.toString();
  return s ? `&${s}` : "";
}

/**
 * The Practice Arena filtered to one company's recommended set. The Arena only narrows the catalogue when it is given
 * `slugs` (the company name alone just labels the page) — the same address the drive "Prepare" screen uses.
 */
export function curatedPracticeHref(slugs: string[], companyName: string): string {
  const clean = slugs.map((x) => x.trim()).filter(Boolean);
  if (clean.length === 0) return "/dashboard/practice";
  return `/dashboard/practice?slugs=${clean.map(encodeURIComponent).join(",")}&company=${encodeURIComponent(companyName)}`;
}

/** "?company=hcltech&round=…&year=…" — a company page's query for a given facet selection. */
export function companyPageSearch(slug: string, sel: FacetSelection): string {
  const p = new URLSearchParams();
  p.set("company", slug);
  if (sel.round !== null) p.set("round", sel.round);
  if (sel.category !== null) p.set("category", sel.category);
  if (sel.year !== null) p.set("year", String(sel.year));
  return `?${p.toString()}`;
}

/** Id of the coding-problems section on a company page — the return address points at it so Back lands where the student left. */
export const CODING_PROBLEMS_ANCHOR = "coding-problems";

/* ── Presenting a company's questions: by round, as short rows ──────────── */

export interface QuestionGroup<T> {
  /** Stable key for open/closed state: the round's name, or "" for questions that belong to no round. */
  key: string;
  round: string | null;
  items: T[];
}

/**
 * Splits questions into their hiring rounds so a 42-question pack reads as four or five short sections instead of one endless
 * list. Rounds come out in `order` (the company's hiring-process order); a round not named there follows, in the order it first
 * appears; questions with no round go last. Within a round the incoming order (newest year first) is kept.
 */
export function groupByRound<T extends { round_name: string | null }>(items: T[], order: string[] = []): QuestionGroup<T>[] {
  const byKey = new Map<string, QuestionGroup<T>>();
  const firstSeen: string[] = [];

  for (const item of items) {
    const round = item.round_name && item.round_name.trim() !== "" ? item.round_name : null;
    const key = round ?? "";
    let group = byKey.get(key);
    if (!group) {
      group = { key, round, items: [] };
      byKey.set(key, group);
      firstSeen.push(key);
    }
    group.items.push(item);
  }

  const rank = (key: string) => {
    if (key === "") return Number.MAX_SAFE_INTEGER; // no round: last
    const i = order.indexOf(key);
    return i === -1 ? Number.MAX_SAFE_INTEGER - 1 : i;
  };

  return firstSeen
    .map((key, seen) => ({ key, seen }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.seen - b.seen)
    .map(({ key }) => byKey.get(key) as QuestionGroup<T>);
}

/**
 * A question's one-line headline and a short preview of the rest, for the collapsed row. PYQs are written as a title line
 * ("Problem: Count Palindromic Substrings (…)", "Profit and Loss with Successive Discounts:") followed by the body, so the first
 * line is the headline. A leading "Problem:" / "Question:" label is dropped (it is on every coding question and says nothing).
 */
export function splitQuestion(text: string): { title: string; preview: string; body: string } {
  const all = text.split(/\r?\n/);
  const first = all.findIndex((l) => l.trim() !== "");
  if (first === -1) return { title: "", preview: "", body: "" };

  const headline = all[first].trim();
  const title = headline.replace(/^(problem|question)\s*[:\-–—]\s*/i, "").replace(/\s*:$/, "").trim() || headline;
  // Everything after the headline, with its own line breaks (the expanded row shows it as written).
  const body = all.slice(first + 1).join("\n").trim();
  const preview = body.replace(/\s+/g, " ");
  return { title, preview, body };
}
