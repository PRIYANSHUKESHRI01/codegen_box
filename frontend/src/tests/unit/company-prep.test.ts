import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  NO_FILTERS,
  companyMatches,
  detailFilterQuery,
  facetCounts,
  facetOptions,
  filterCompanies,
  filterQuestions,
  filterSearch,
  hasActiveFilters,
  matchesQuery,
  matchingQuestionCount,
  parseFilterSearch,
  questionFacetCounts,
  questionMatchesText,
  sanitizeFilters,
  sortCompanies,
  summarizeCatalogue,
  type PrepFilters,
} from "@/lib/companyPrep";
import { companyAccent, editDistance, getCompanyBrand, hexToRgbTriplet, matchCompanyBrand, suggestCompanyName } from "@/lib/companyBrands";
import type { CompanyPrepBreakdownRow, CompanyPrepSummary } from "@/types/companyPrep";

function company(over: Partial<CompanyPrepSummary> & { name: string; slug: string }, breakdown?: CompanyPrepBreakdownRow[]): CompanyPrepSummary {
  const rows = breakdown ?? [];
  return {
    id: Math.floor(Math.random() * 1e6),
    logo: null,
    industry: "IT Services",
    overview: null,
    hiring_process: [],
    prep_questions_count: rows.reduce((s, r) => s + r.count, 0),
    recommended_problems_count: 0,
    years: Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a),
    rounds: Array.from(new Set(rows.map((r) => r.round).filter((r): r is string => !!r))),
    categories: Array.from(new Set(rows.map((r) => r.category))),
    breakdown: breakdown,
    has_live_drive: false,
    live_drive_id: null,
    ...over,
  };
}

const ACC = company(
  { name: "Accenture", slug: "accenture", industry: "Technology Consulting", has_live_drive: true, hiring_process: [{ name: "Coding Assessment" }] },
  [
    { round: "Coding Assessment", category: "Coding", year: 2025, count: 10 },
    { round: "Coding Assessment", category: "Coding", year: 2024, count: 6 },
    { round: "Communication Assessment", category: "Aptitude", year: 2025, count: 8 },
    { round: "Technical Interview", category: "Technical", year: 2024, count: 4 },
  ]
);
const INF = company({ name: "Infosys", slug: "infosys" }, [
  { round: "Online Assessment", category: "Aptitude", year: 2023, count: 5 },
  { round: "Technical Interview", category: "Technical", year: 2025, count: 3 },
  { round: "HR Interview", category: "HR", year: 2025, count: 2 },
]);
const TCS = company({ name: "TCS Digital", slug: "tcs-digital" }, [
  { round: "Online Assessment", category: "Aptitude", year: 2024, count: 12 },
  { round: null, category: "HR", year: 2024, count: 1 },
]);
const ALL = [INF, TCS, ACC];

const f = (over: Partial<PrepFilters> = {}): PrepFilters => ({ ...NO_FILTERS, ...over });
const names = (list: CompanyPrepSummary[]) => list.map((c) => c.name);

describe("company PYQ filters", () => {
  it("shows everything when nothing is selected", () => {
    expect(names(filterCompanies(ALL, NO_FILTERS))).toEqual(["Infosys", "TCS Digital", "Accenture"]);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });

  it("round: keeps only companies that ran that round", () => {
    expect(names(filterCompanies(ALL, f({ round: "Technical Interview" })))).toEqual(["Infosys", "Accenture"]);
    expect(names(filterCompanies(ALL, f({ round: "Online Assessment" })))).toEqual(["Infosys", "TCS Digital"]);
  });

  it("category and year work on their own", () => {
    expect(names(filterCompanies(ALL, f({ category: "HR" })))).toEqual(["Infosys", "TCS Digital"]);
    expect(names(filterCompanies(ALL, f({ year: 2023 })))).toEqual(["Infosys"]);
    expect(names(filterCompanies(ALL, f({ year: 2025 })))).toEqual(["Infosys", "Accenture"]);
  });

  it("combined facets must hold for the SAME questions, not just each be true somewhere", () => {
    // Infosys asked Technical in 2025 and Aptitude in 2023 — it has "2023" and it has "Technical Interview",
    // but never a Technical Interview question in 2023.
    expect(companyMatches(INF, f({ round: "Technical Interview" }))).toBe(true);
    expect(companyMatches(INF, f({ year: 2023 }))).toBe(true);
    expect(companyMatches(INF, f({ round: "Technical Interview", year: 2023 }))).toBe(false);
    expect(companyMatches(INF, f({ round: "Technical Interview", year: 2025 }))).toBe(true);
    expect(names(filterCompanies(ALL, f({ round: "Technical Interview", year: 2024 })))).toEqual(["Accenture"]);
    expect(names(filterCompanies(ALL, f({ category: "Aptitude", year: 2025 })))).toEqual(["Accenture"]);
  });

  it("falls back to per-facet matching when the API sends no breakdown", () => {
    const legacy = company({ name: "Legacy", slug: "legacy", rounds: ["Technical Interview"], years: [2023, 2025], categories: ["Technical"], prep_questions_count: 7 });
    expect(legacy.breakdown).toBeUndefined();
    expect(companyMatches(legacy, f({ round: "Technical Interview", year: 2023 }))).toBe(true);
    expect(companyMatches(legacy, f({ year: 2024 }))).toBe(false);
    expect(matchingQuestionCount(legacy, f({ year: 2025 }))).toBeNull();
    expect(matchingQuestionCount(legacy, NO_FILTERS)).toBe(7);
  });

  it("a company with no PYQs at all (only DSA problems) is listed unfiltered but never matches a facet", () => {
    const dsaOnly = company({ name: "DSA Only", slug: "dsa-only", recommended_problems_count: 5 }, []);
    expect(companyMatches(dsaOnly, NO_FILTERS)).toBe(true);
    expect(companyMatches(dsaOnly, f({ year: 2025 }))).toBe(false);
  });

  it("live-drive toggle keeps only companies hiring at the student's college", () => {
    expect(names(filterCompanies(ALL, f({ liveOnly: true })))).toEqual(["Accenture"]);
    expect(names(filterCompanies(ALL, f({ liveOnly: true, year: 2023 })))).toEqual([]);
  });

  it("text search is word-by-word over name, industry, rounds, categories and stages", () => {
    expect(matchesQuery(ACC, "accenture")).toBe(true);
    expect(matchesQuery(ACC, "ACCEN")).toBe(true);
    expect(matchesQuery(ACC, "consulting")).toBe(true);
    expect(matchesQuery(ACC, "versant")).toBe(false);
    expect(matchesQuery(ACC, "communication assessment")).toBe(true);
    expect(matchesQuery(ACC, "assessment communication")).toBe(true); // order doesn't matter
    expect(matchesQuery(TCS, "tcs digital")).toBe(true);
    expect(matchesQuery(TCS, "tcs-digital")).toBe(true); // a hyphen is just a word break
    expect(names(filterCompanies(ALL, f({ query: "  interview  " })))).toEqual(["Infosys", "Accenture"]);
    expect(names(filterCompanies(ALL, f({ query: "interview", year: 2024 })))).toEqual(["Accenture"]);
  });

  it("whitespace-only search is not an active filter", () => {
    expect(hasActiveFilters(f({ query: "   " }))).toBe(false);
    expect(names(filterCompanies(ALL, f({ query: "   " })))).toHaveLength(3);
  });
});

describe("matching question counts", () => {
  it("is the company total with no facet selected", () => {
    expect(matchingQuestionCount(ACC, NO_FILTERS)).toBe(28);
    expect(matchingQuestionCount(ACC, f({ query: "accenture", liveOnly: true }))).toBe(28);
  });

  it("sums only the combinations that satisfy every selected facet", () => {
    expect(matchingQuestionCount(ACC, f({ round: "Coding Assessment" }))).toBe(16);
    expect(matchingQuestionCount(ACC, f({ round: "Coding Assessment", year: 2024 }))).toBe(6);
    expect(matchingQuestionCount(ACC, f({ year: 2025 }))).toBe(18);
    expect(matchingQuestionCount(ACC, f({ round: "Technical Interview", year: 2025 }))).toBe(0);
  });
});

describe("facet chips", () => {
  it("lists every value once, in a stable order", () => {
    const o = facetOptions(ALL);
    expect(o.years).toEqual([2025, 2024, 2023]);
    expect(o.categories).toEqual(["Aptitude", "Coding", "Technical", "HR"]); // drive order, not alphabetical
    // rounds: most companies first (Technical Interview x2, Online Assessment x2), then A-Z
    expect(o.rounds.slice(0, 2)).toEqual(["Online Assessment", "Technical Interview"]);
    expect(new Set(o.rounds).size).toBe(o.rounds.length);
  });

  it("an unknown category the API adds later is still offered, after the known ones", () => {
    const odd = company({ name: "Odd", slug: "odd" }, [{ round: "X", category: "Case Study", year: 2025, count: 1 }]);
    expect(facetOptions([ACC, odd]).categories).toEqual(["Aptitude", "Coding", "Technical", "Case Study"]);
  });

  it("counts companies per chip with no filters", () => {
    const years = facetCounts(ALL, NO_FILTERS, "year");
    expect(years.get(2025)).toBe(2);
    expect(years.get(2024)).toBe(2);
    expect(years.get(2023)).toBe(1);
    const cats = facetCounts(ALL, NO_FILTERS, "category");
    expect(cats.get("Aptitude")).toBe(3);
    expect(cats.get("Coding")).toBe(1);
    expect(cats.get("HR")).toBe(2);
  });

  it("each chip count is what you would get by clicking it (other filters respected)", () => {
    const sel = f({ round: "Technical Interview" });
    const years = facetCounts(ALL, sel, "year");
    // Technical Interview was asked in 2024 (Accenture) and 2025 (Infosys); nobody asked it in 2023.
    expect(years.get(2024)).toBe(1);
    expect(years.get(2025)).toBe(1);
    expect(years.get(2023) ?? 0).toBe(0);
    for (const [year, n] of Array.from(years.entries())) expect(filterCompanies(ALL, { ...sel, year: year as number })).toHaveLength(n);
  });

  it("the facet's own selection doesn't zero its siblings", () => {
    const rounds = facetCounts(ALL, f({ round: "Online Assessment" }), "round");
    expect(rounds.get("Online Assessment")).toBe(2);
    expect(rounds.get("Technical Interview")).toBe(2);
  });

  it("a facet count never exceeds the companies that survive the text / live filters", () => {
    const years = facetCounts(ALL, f({ liveOnly: true }), "year");
    expect(years.get(2025)).toBe(1);
    expect(years.get(2023) ?? 0).toBe(0);
  });

  it("stale selections are dropped, valid ones kept", () => {
    const o = facetOptions(ALL);
    expect(sanitizeFilters(f({ round: "Nope", year: 1999, category: "Aptitude" }), o)).toEqual(f({ category: "Aptitude" }));
  });
});

describe("sorting + summary", () => {
  it("recommended puts the college's live drive first, then the biggest pack", () => {
    expect(names(sortCompanies(ALL, "recommended", NO_FILTERS))).toEqual(["Accenture", "TCS Digital", "Infosys"]);
  });

  it("most PYQs follows the questions that match the active filters", () => {
    expect(names(sortCompanies(ALL, "questions", NO_FILTERS))).toEqual(["Accenture", "TCS Digital", "Infosys"]);
    // Only Infosys + Accenture asked a Technical Interview; among those Accenture has 4, Infosys 3.
    expect(names(sortCompanies(filterCompanies(ALL, f({ round: "Technical Interview" })), "questions", f({ round: "Technical Interview" })))).toEqual(["Accenture", "Infosys"]);
  });

  it("A-Z, latest year and most rounds", () => {
    expect(names(sortCompanies(ALL, "name", NO_FILTERS))).toEqual(["Accenture", "Infosys", "TCS Digital"]);
    expect(names(sortCompanies(ALL, "recent", NO_FILTERS))[2]).toBe("TCS Digital");
    expect(names(sortCompanies(ALL, "rounds", NO_FILTERS))[0]).toBe("Accenture");
  });

  it("never mutates the list it was given", () => {
    const before = names(ALL);
    sortCompanies(ALL, "name", NO_FILTERS);
    expect(names(ALL)).toEqual(before);
  });

  it("summarises the catalogue from the data (no hard-coded years)", () => {
    expect(summarizeCatalogue(ALL)).toEqual({
      companies: 3,
      questions: 28 + 10 + 13,
      dsaProblems: 0,
      liveDrives: 1,
      rounds: 5,
      firstYear: 2023,
      lastYear: 2025,
    });
    expect(summarizeCatalogue([])).toMatchObject({ companies: 0, firstYear: null, lastYear: null });
  });
});

describe("filters in the URL", () => {
  it("round-trips", () => {
    const state = f({ query: "tcs", round: "Technical & HR Interview", category: "HR", year: 2024, liveOnly: true });
    const search = filterSearch(state, "name");
    expect(search.startsWith("?")).toBe(true);
    expect(parseFilterSearch(search)).toEqual({ filters: state, sort: "name" });
  });

  it("is empty for the default view", () => {
    expect(filterSearch(NO_FILTERS, DEFAULT_SORT)).toBe("");
    expect(parseFilterSearch("")).toEqual({ filters: NO_FILTERS, sort: DEFAULT_SORT });
  });

  it("ignores garbage rather than throwing", () => {
    expect(parseFilterSearch("?year=abc&sort=bogus&live=yes").filters).toEqual(NO_FILTERS);
    expect(parseFilterSearch("?year=abc&sort=bogus").sort).toBe(DEFAULT_SORT);
    expect(parseFilterSearch("?year=2024.5").filters.year).toBeNull();
  });

  it("hands the facets (not the text search) to the company page", () => {
    expect(detailFilterQuery(NO_FILTERS)).toBe("");
    expect(detailFilterQuery(f({ query: "acc", liveOnly: true }))).toBe("");
    expect(detailFilterQuery(f({ round: "Coding Assessment", year: 2025 }))).toBe("&round=Coding+Assessment&year=2025");
  });
});

describe("company brands", () => {
  it("finds the real logo by slug", () => {
    for (const slug of ["infosys", "tcs-digital", "wipro", "accenture", "hcltech", "capgemini", "tech-mahindra", "ltimindtree", "cognizant"]) {
      expect(getCompanyBrand(slug, null)?.logo).toBe(`/company-logos/${slug}.svg`);
    }
  });

  it("finds it by name when the slug is different", () => {
    expect(getCompanyBrand("tcs-ninja", "TCS Ninja")?.logo).toBe("/company-logos/tcs-digital.svg");
    expect(getCompanyBrand("hcl", "HCL Tech")?.logo).toBe("/company-logos/hcltech.svg");
    expect(getCompanyBrand("lti", "L&T Mindtree")?.logo).toBe("/company-logos/ltimindtree.svg");
    expect(getCompanyBrand("x", "Tata Consultancy Services")?.logo).toBe("/company-logos/tcs-digital.svg");
  });

  it("does not guess for a company it doesn't know", () => {
    expect(getCompanyBrand("zoho", "Zoho")).toBeNull();
    expect(getCompanyBrand("stcs", "Stcs Ltd")).toBeNull(); // 'tcs' inside a longer word is not TCS
  });

  it("themes unknown companies with a stable fallback colour", () => {
    expect(companyAccent("zoho", "Zoho")).toBe(companyAccent("zoho", "Zoho"));
    expect(companyAccent("accenture", "Accenture")).toBe("#A100FF");
  });

  it("converts brand hex to the rgb triplet the CSS variables use", () => {
    expect(hexToRgbTriplet("#007CC3")).toBe("0 124 195");
    expect(hexToRgbTriplet("#fff")).toBe("255 255 255");
    expect(hexToRgbTriplet("nonsense")).toBe("99 102 241");
  });
});

describe("one company's questions", () => {
  const q = (id: number, round_name: string | null, category: string, asked_year: number, question = `Q${id}`, answer_notes: string | null = null) => ({
    id,
    round_name,
    category,
    asked_year,
    question,
    answer_notes,
  });
  const QS = [
    q(1, "Coding Assessment", "Coding", 2025, "Reverse a linked list"),
    q(2, "Coding Assessment", "Coding", 2024, "Two sum with bitwise ops", "Use a hash map"),
    q(3, "Technical Interview", "Technical", 2025, "Explain ACID properties"),
    q(4, null, "HR", 2024, "Tell me about yourself"),
  ];

  it("filters by round, category and year together", () => {
    expect(filterQuestions(QS, { round: "Coding Assessment", category: null, year: null }).map((x) => x.id)).toEqual([1, 2]);
    expect(filterQuestions(QS, { round: "Coding Assessment", category: null, year: 2024 }).map((x) => x.id)).toEqual([2]);
    expect(filterQuestions(QS, { round: null, category: "HR", year: 2025 })).toEqual([]);
    expect(filterQuestions(QS, { round: null, category: null, year: null })).toHaveLength(4);
  });

  it("text search covers the question, the answer notes, the round and the category", () => {
    expect(questionMatchesText(QS[1], "hash map")).toBe(true);
    expect(questionMatchesText(QS[0], "TECHNICAL")).toBe(false);
    expect(questionMatchesText(QS[2], "technical interview")).toBe(true);
    expect(questionMatchesText(QS[3], "hr yourself")).toBe(true);
    expect(questionMatchesText(QS[0], "")).toBe(true);
  });

  it("chip counts are questions, honour the other selections and the text search", () => {
    const none = { round: null, category: null, year: null };
    const years = questionFacetCounts(QS, none, "year");
    expect(years.get(2025)).toBe(2);
    expect(years.get(2024)).toBe(2);
    expect(questionFacetCounts(QS, none, "round").get("Coding Assessment")).toBe(2);
    expect(questionFacetCounts(QS, none, "round").has("null")).toBe(false); // questions without a round add no chip
    // picking the Coding category leaves 2025 with one question, and the text search narrows it further
    expect(questionFacetCounts(QS, { ...none, category: "Coding" }, "year").get(2025)).toBe(1);
    expect(questionFacetCounts(QS, { ...none, category: "Coding" }, "year", (x) => questionMatchesText(x, "hash")).get(2025) ?? 0).toBe(0);
    // the facet's own pick doesn't zero its siblings
    expect(questionFacetCounts(QS, { ...none, year: 2024 }, "year").get(2025)).toBe(2);
  });
});

describe("typed company names — the logo attaches even when the name is misspelled", () => {
  const logoOf = (name: string) => getCompanyBrand(null, name)?.logo ?? null;

  it("finds the logo for the typo from the bug report and the other usual slips", () => {
    expect(logoOf("capegemni")).toBe("/company-logos/capgemini.svg");
    expect(logoOf("Capegemni")).toBe("/company-logos/capgemini.svg");
    expect(logoOf("kapgemini")).toBe("/company-logos/capgemini.svg");
    expect(logoOf("Infosis")).toBe("/company-logos/infosys.svg");
    expect(logoOf("Cognizent")).toBe("/company-logos/cognizant.svg");
    expect(logoOf("congizant")).toBe("/company-logos/cognizant.svg"); // swapped letters
    expect(logoOf("Acenture")).toBe("/company-logos/accenture.svg");
    expect(logoOf("Wiipro")).toBe("/company-logos/wipro.svg");
    expect(logoOf("Tech Mahendra")).toBe("/company-logos/tech-mahindra.svg");
    expect(logoOf("LTIMindtre")).toBe("/company-logos/ltimindtree.svg");
  });

  it("ignores case, spacing, punctuation and 'Pvt Ltd' noise", () => {
    expect(logoOf("  CAPGEMINI  India Pvt. Ltd. ")).toBe("/company-logos/capgemini.svg");
    expect(logoOf("capegemni india pvt ltd")).toBe("/company-logos/capgemini.svg");
    expect(logoOf("Infosys Limited")).toBe("/company-logos/infosys.svg");
    expect(logoOf("tech-mahindra")).toBe("/company-logos/tech-mahindra.svg");
  });

  it("does not attach a logo to names that are merely similar-looking", () => {
    for (const name of ["Infoseek", "Infosec", "Accentia", "Accent", "Wiper", "Capital One", "Cogent", "TCL", "HCM", "Zoho", "Tech Solutions", "Mahindra University", "Stcs Ltd", ""]) {
      expect(logoOf(name), name).toBeNull();
    }
  });

  it("says how it matched: spelled right vs a typo", () => {
    expect(matchCompanyBrand("capgemini", null)?.kind).toBe("slug");
    expect(matchCompanyBrand(null, "TCS Ninja")?.kind).toBe("alias");
    expect(matchCompanyBrand(null, "capegemni")?.kind).toBe("typo");
    expect(matchCompanyBrand(null, "Zoho")).toBeNull();
  });

  it("suggests the right spelling only for a misspelling", () => {
    expect(suggestCompanyName("capegemni")).toBe("Capgemini");
    expect(suggestCompanyName("Infosis ltd")).toBe("Infosys");
    expect(suggestCompanyName("Cognizent")).toBe("Cognizant");
    expect(suggestCompanyName("Capgemini")).toBeNull(); // already right
    expect(suggestCompanyName("TCS Ninja")).toBeNull(); // a different, legitimate way of writing it
    expect(suggestCompanyName("Zoho")).toBeNull();
    expect(suggestCompanyName("ca")).toBeNull();
  });

  it("measures a swapped pair of letters as one typo", () => {
    expect(editDistance("cognizant", "congizant")).toBe(1);
    expect(editDistance("capegemni", "capgemini")).toBe(2);
    expect(editDistance("", "abc")).toBe(3);
    expect(editDistance("same", "same")).toBe(0);
  });

  it("gives a typo'd company the brand colour too", () => {
    expect(companyAccent(null, "capegemni")).toBe("#0070AD");
  });
});
