/**
 * Real company marks, resolved from a company's NAME — everywhere in AptRun.
 *
 * `companies.logo` in the database is a short emoji (e.g. 🟣) — fine as a last resort, but a student, a TPO or a hiring partner
 * looking at "Capgemini" should see Capgemini. The official wordmarks live in /public/company-logos/<slug>.svg (the app is a
 * static export, so they are plain files, not API data) and are found from whatever name the company has:
 *   1. its slug ("tcs-digital"),
 *   2. a known way of writing it ("TCS Ninja", "HCL Tech", "L&T Mindtree"),
 *   3. a typo of its name ("capegemni", "Infosis Limited", "Cognizent") — so a TPO who types a drive's company by hand gets the
 *      logo as they type, with no extra step, and so does a record that was already saved with the typo.
 *
 * Adding a company: drop `<slug>.svg` into public/company-logos and add a line to BRANDS (and to FUZZY_NAMES / ALIASES if people
 * write it differently). A company with no entry still renders — as its emoji, or a gradient monogram — so a new row in the
 * database never breaks a page.
 */

export interface CompanyBrand {
  /** Key = the company's catalogue slug. */
  key: string;
  /** The name to show — and to suggest when someone has typed it wrong. */
  name: string;
  /** Public path of the wordmark. */
  logo: string;
  /** Brand colour — tints card banners, glows and hover shadows. */
  color: string;
}

const BRANDS: Record<string, CompanyBrand> = {
  infosys: { key: "infosys", name: "Infosys", logo: "/company-logos/infosys.svg", color: "#007CC3" },
  "tcs-digital": { key: "tcs-digital", name: "TCS", logo: "/company-logos/tcs-digital.svg", color: "#2A5CAA" },
  wipro: { key: "wipro", name: "Wipro", logo: "/company-logos/wipro.svg", color: "#7A3FA0" },
  accenture: { key: "accenture", name: "Accenture", logo: "/company-logos/accenture.svg", color: "#A100FF" },
  hcltech: { key: "hcltech", name: "HCLTech", logo: "/company-logos/hcltech.svg", color: "#0F5FDC" },
  capgemini: { key: "capgemini", name: "Capgemini", logo: "/company-logos/capgemini.svg", color: "#0070AD" },
  "tech-mahindra": { key: "tech-mahindra", name: "Tech Mahindra", logo: "/company-logos/tech-mahindra.svg", color: "#E31837" },
  ltimindtree: { key: "ltimindtree", name: "LTIMindtree", logo: "/company-logos/ltimindtree.svg", color: "#00539F" },
  cognizant: { key: "cognizant", name: "Cognizant", logo: "/company-logos/cognizant.svg", color: "#1F4BB7" },
};

/** Other ways a slug or display name writes the same company, spelled right ("tcs-ninja", "HCL Tech", "L&T Mindtree"). */
const ALIASES: [RegExp, string][] = [
  [/infosys/, "infosys"],
  [/\btcs\b|tata[\s-]*consultancy/, "tcs-digital"],
  [/wipro/, "wipro"],
  [/accenture/, "accenture"],
  [/hcl[\s-]*tech|\bhcl\b/, "hcltech"],
  [/capgemini/, "capgemini"],
  [/tech[\s-]*mahindra/, "tech-mahindra"],
  [/lti[\s-]*mindtree|\bltim\b|mindtree/, "ltimindtree"],
  [/cognizant/, "cognizant"],
];

/** Spellings (lower-case, no spaces) a typo is measured against. Short ones (tcs, hcl) are only ever matched exactly. */
const FUZZY_NAMES: [string, string][] = [
  ["infosys", "infosys"],
  ["tcs", "tcs-digital"],
  ["tataconsultancyservices", "tcs-digital"],
  ["tataconsultancy", "tcs-digital"],
  ["wipro", "wipro"],
  ["accenture", "accenture"],
  ["hcltech", "hcltech"],
  ["hcltechnologies", "hcltech"],
  ["capgemini", "capgemini"],
  ["techmahindra", "tech-mahindra"],
  ["ltimindtree", "ltimindtree"],
  ["mindtree", "ltimindtree"],
  ["cognizant", "cognizant"],
];

/** Words that say "this is a company", not which one — dropped before comparing ("Capgemini India Pvt. Ltd" = "capgemini"). */
const NOISE = new Set(["ltd", "limited", "pvt", "private", "inc", "incorporated", "corp", "corporation", "llc", "llp", "plc", "co", "company", "india", "global", "the", "and"]);

/** How many typos a name of this length may contain. */
export function allowedTypos(length: number): number {
  return length <= 4 ? 0 : length <= 7 ? 1 : 2;
}

/** Edit distance where swapping two neighbouring letters counts once ("cognizant" / "congizant" = 1). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const wordsOf = (name: string): string[] =>
  name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !NOISE.has(w));

export type BrandMatchKind = "slug" | "alias" | "typo";

export interface BrandMatch {
  brand: CompanyBrand;
  /** `typo` means the name is a misspelling — the one case worth offering a correction for. */
  kind: BrandMatchKind;
}

function typoMatch(name: string): CompanyBrand | null {
  const words = wordsOf(name);
  if (words.length === 0) return null;

  // The whole name, each word, and each neighbouring pair ("tech" + "mahendra") — a typed name rarely equals the catalogue's wording.
  const candidates = new Set<string>([words.join("")]);
  words.forEach((w, i) => {
    if (w.length >= 5) candidates.add(w);
    if (i + 1 < words.length) candidates.add(w + words[i + 1]);
  });

  let best: { key: string; distance: number } | null = null;
  for (const candidate of Array.from(candidates)) {
    for (const [known, key] of FUZZY_NAMES) {
      const allowed = allowedTypos(known.length);
      if (Math.abs(candidate.length - known.length) > allowed) continue;
      const distance = editDistance(candidate, known);
      if (distance <= allowed && (best === null || distance < best.distance)) best = { key, distance };
    }
  }
  return best ? BRANDS[best.key] : null;
}

/** Which known company a slug / name is, and how sure we are — null when it is not one we hold a logo for. */
export function matchCompanyBrand(slug?: string | null, name?: string | null): BrandMatch | null {
  const s = (slug ?? "").trim().toLowerCase();
  if (s && BRANDS[s]) return { brand: BRANDS[s], kind: "slug" };

  const haystack = `${s} ${(name ?? "").toLowerCase()}`;
  for (const [pattern, key] of ALIASES) {
    if (pattern.test(haystack)) return { brand: BRANDS[key], kind: "alias" };
  }

  const typo = typoMatch(`${(name ?? "").trim()}`) ?? typoMatch(s.replace(/-/g, " "));
  return typo ? { brand: typo, kind: "typo" } : null;
}

export function getCompanyBrand(slug?: string | null, name?: string | null): CompanyBrand | null {
  return matchCompanyBrand(slug, name)?.brand ?? null;
}

/**
 * The spelling to suggest when a typed name is a misspelling of a company we know ("capegemni" → "Capgemini"); null when it is
 * already right, is just a different way of writing the company ("TCS Ninja"), or is not a company we know.
 */
export function suggestCompanyName(typed: string): string | null {
  const t = typed.trim();
  if (t.length < 3) return null;
  const match = matchCompanyBrand(null, t);
  return match && match.kind === "typo" ? match.brand.name : null;
}

/** Fallback hues for companies with no brand entry — stable per name, so a card never changes colour between visits. */
const FALLBACK_COLORS = ["#6366F1", "#8B5CF6", "#0EA5E9", "#14B8A6", "#F59E0B", "#EC4899"];

function hashOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** The accent colour to theme a company's card with. */
export function companyAccent(slug?: string | null, name?: string | null): string {
  return getCompanyBrand(slug, name)?.color ?? FALLBACK_COLORS[hashOf(`${slug ?? ""}${name ?? ""}`) % FALLBACK_COLORS.length];
}

/** "#007CC3" -> "0 124 195" — the space-separated form Tailwind needs for `rgb(var(--x) / 0.2)`. */
export function hexToRgbTriplet(hex: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "99 102 241";
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
