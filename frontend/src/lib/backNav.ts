/**
 * Where "Back" goes on every signed-in page.
 *
 * ONE table is the source of truth: each page names its parent, and the header's back arrow follows the chain upward
 * ("up", like a file manager, rather than "wherever you happened to come from" — so it is predictable, never loops, and
 * is not confused by the browser's own history or by a page that was opened in a new tab). The label on the arrow is
 * the parent's title ("Back to Core Prep"), so a student always knows where it leads.
 *
 * Portal roots (a role's home) have no parent: there is nothing above them, so no arrow.
 *
 * A unit test (tests/unit/back-nav.test.ts) walks src/app and fails when a page exists that is neither registered
 * here nor deliberately listed as having its own chrome, so a new page cannot ship without a way back.
 */

export interface RouteNode {
  /** Short page name — the text after "Back to …" on the page below it. */
  title: string;
  /** The page one level up (optionally with a ?query or #section to land on), or null for a portal root. */
  parent: string | null;
  /** What the arrow says when the parent's own title is not the right words ("Review queue" rather than "Projects"). */
  backLabel?: string;
  /**
   * Query parameters the PARENT page cannot work without, copied from this page's own address when going up. A contest problem's
   * parent is the contest, which is identified by `?slug=` — an arrow that dropped it would land on a page that has nothing to show.
   */
  carry?: readonly string[];
}

/** A role's home page. Shown without an arrow. */
const ROOT = null;

export const ROUTE_TREE: Record<string, RouteNode> = {
  // ── Student ──
  "/dashboard": { title: "Overview", parent: ROOT },
  "/dashboard/articles": { title: "Articles", parent: "/dashboard" },
  "/dashboard/articles/topic": { title: "Article topic", parent: "/dashboard/articles" },
  "/dashboard/articles/view": { title: "Article", parent: "/dashboard/articles" },
  "/dashboard/billing": { title: "Plans & Billing", parent: "/dashboard" },
  "/dashboard/company-prep": { title: "Company PYQs", parent: "/dashboard" },
  "/dashboard/company-prep/view": { title: "Company Prep", parent: "/dashboard/company-prep", backLabel: "All Companies" },
  "/dashboard/contests": { title: "Contests", parent: "/dashboard" },
  "/dashboard/contests/view": { title: "Contest", parent: "/dashboard/contests" },
  "/dashboard/contests/problem": { title: "Contest problem", parent: "/dashboard/contests/view", carry: ["slug"] },
  "/dashboard/core": { title: "Core Prep", parent: "/dashboard" },
  "/dashboard/core/practice": { title: "Core practice", parent: "/dashboard/core" },
  "/dashboard/core/tests": { title: "Core tests", parent: "/dashboard/core" },
  "/dashboard/core/session": { title: "Core test", parent: "/dashboard/core/tests" },
  "/dashboard/core/result": { title: "Core result", parent: "/dashboard/core/tests" },
  "/dashboard/drills": { title: "Skill Drills", parent: "/dashboard" },
  "/dashboard/drills/session": { title: "Drill", parent: "/dashboard/drills" },
  // The list of drives. A single drive (?driveId=…) is the same route and passes its own back target (the list) to the shell.
  "/dashboard/drives": { title: "Upcoming Drives", parent: "/dashboard" },
  "/dashboard/interview-tracks": { title: "Mock AI Interview", parent: "/dashboard/interviews" },
  "/dashboard/interviews": { title: "Mock AI Interview", parent: "/dashboard" },
  "/dashboard/merchant-navy": { title: "Merchant Navy", parent: "/dashboard" },
  "/dashboard/merchant-navy/reports": { title: "My Reports", parent: "/dashboard/merchant-navy" },
  "/dashboard/interviews/practice": { title: "Practice interview", parent: "/dashboard/interviews" },
  "/dashboard/interviews/session": { title: "Interview", parent: "/dashboard/interviews" },
  "/dashboard/interviews/view": { title: "Interview", parent: "/dashboard/interviews" },
  "/dashboard/leaderboard": { title: "Leaderboard", parent: "/dashboard" },
  "/dashboard/learning-centre": { title: "Learning Centre", parent: "/dashboard" },
  "/dashboard/learning-centre/listening": { title: "Listening", parent: "/dashboard/learning-centre" },
  "/dashboard/learning-centre/listening/session": { title: "Listening lesson", parent: "/dashboard/learning-centre/listening" },
  "/dashboard/learning-centre/speaking": { title: "Speaking", parent: "/dashboard/learning-centre" },
  "/dashboard/learning-centre/speaking/session": { title: "Speaking practice", parent: "/dashboard/learning-centre/speaking" },
  "/dashboard/learning-centre/vocabulary": { title: "Vocabulary", parent: "/dashboard/learning-centre" },
  "/dashboard/learning-centre/vocabulary/session": { title: "Vocabulary sprint", parent: "/dashboard/learning-centre/vocabulary" },
  "/dashboard/learning-centre/vocabulary/words": { title: "Word list", parent: "/dashboard/learning-centre/vocabulary" },
  "/dashboard/practice": { title: "Practice Arena", parent: "/dashboard" },
  "/dashboard/practice/view": { title: "Practice Arena", parent: "/dashboard/practice" },
  "/dashboard/projects": { title: "Project Lab", parent: "/dashboard" },
  "/dashboard/projects/view": { title: "Project", parent: "/dashboard/projects" },
  // The workspace's address names the enrollment, not the topic, so the topic page cannot be rebuilt from it: up means the project list.
  "/dashboard/projects/workspace": { title: "Project", parent: "/dashboard/projects" },
  "/dashboard/reports": { title: "Performance Report", parent: "/dashboard" },
  "/dashboard/soft-skills": { title: "Soft Skills", parent: "/dashboard" },
  "/dashboard/soft-skills/session": { title: "Soft Skills", parent: "/dashboard/soft-skills" },
  "/dashboard/soft-skills/view": { title: "Soft Skills", parent: "/dashboard/soft-skills" },
  "/dashboard/talent-pool": { title: "Talent Pool", parent: "/dashboard" },
  "/dashboard/vault": { title: "Mellow Vault", parent: "/dashboard" },
  "/dashboard/vault-interviews": { title: "Vault AI Interview", parent: "/dashboard" },
  "/dashboard/vault-interviews/view": { title: "Qualification set", parent: "/dashboard/vault-interviews" },
  "/dashboard/vault-interviews/session": { title: "Qualification set", parent: "/dashboard/vault-interviews" },

  // ── Shared by every role: their parent is whichever portal root the signed-in role has (resolved in resolveBack) ──
  "/settings": { title: "Settings", parent: "@portal" },
  "/notifications": { title: "Notifications", parent: "@portal" },

  // ── Placement cell (TPO), platform ops and hiring partners all live under /admin ──
  "/admin": { title: "Home", parent: ROOT },
  "/admin/analytics": { title: "Analytics", parent: "/admin" },
  "/admin/articles": { title: "Articles", parent: "/admin" },
  "/admin/articles/new": { title: "New article", parent: "/admin/articles" },
  "/admin/articles/edit": { title: "Edit article", parent: "/admin/articles" },
  "/admin/company/assessments": { title: "Assessments", parent: "/admin" },
  "/admin/company/candidates": { title: "Candidates", parent: "/admin" },
  "/admin/company/colleges": { title: "Colleges", parent: "/admin" },
  "/admin/company/drives": { title: "Drives", parent: "/admin" },
  "/admin/company/hackathons": { title: "Hackathons", parent: "/admin" },
  "/admin/company/hackathons/edit": { title: "Edit hackathon", parent: "/admin/company/hackathons" },
  "/admin/company/hackathons/manage": { title: "Manage hackathon", parent: "/admin/company/hackathons" },
  "/admin/company/interviews": { title: "Interviews", parent: "/admin" },
  "/admin/company/proctoring": { title: "Proctoring", parent: "/admin" },
  "/admin/company/reports": { title: "Reports", parent: "/admin" },
  "/admin/company/soft-skills": { title: "Soft skills", parent: "/admin" },
  "/admin/company/talent-pool": { title: "Talent pool", parent: "/admin" },
  "/admin/company/vault": { title: "Vault", parent: "/admin" },
  "/admin/contests": { title: "Contests", parent: "/admin" },
  "/admin/coordinators": { title: "Coordinators", parent: "/admin" },
  "/admin/core-prep": { title: "Domain Prep", parent: "/admin" },
  "/admin/customers": { title: "Customers", parent: "/admin" },
  "/admin/drives": { title: "Drives", parent: "/admin" },
  "/admin/hackathons": { title: "Hackathons", parent: "/admin" },
  "/admin/hackathons/edit": { title: "Edit hackathon", parent: "/admin/hackathons" },
  "/admin/hackathons/manage": { title: "Manage hackathon", parent: "/admin/hackathons" },
  "/admin/interviews": { title: "AI Interviews", parent: "/admin" },
  "/admin/interviews/question-bank": { title: "AI Interviews", parent: "/admin/interviews" },
  "/admin/interviews/mock-questions": { title: "AI Interviews", parent: "/admin/interviews" },
  "/admin/interviews/tracks": { title: "AI Interviews", parent: "/admin/interviews" },
  "/admin/mock-contests": { title: "Mock contests", parent: "/admin" },
  "/admin/mock-core-tests": { title: "Core tests", parent: "/admin" },
  "/admin/mock-interviews": { title: "Mock interviews", parent: "/admin" },
  "/admin/mock-soft-skills": { title: "Mock soft skills", parent: "/admin" },
  "/admin/placements": { title: "Placements", parent: "/admin" },
  "/admin/proctoring": { title: "Proctoring", parent: "/admin" },
  "/admin/projects": { title: "Projects", parent: "/admin" },
  "/admin/projects/edit": { title: "Projects", parent: "/admin/projects" },
  "/admin/projects/review": { title: "Projects", parent: "/admin/projects?tab=review", backLabel: "Review queue" },
  "/admin/reports": { title: "Reports", parent: "/admin" },
  "/admin/soft-skills": { title: "Soft skills", parent: "/admin" },
  "/admin/students": { title: "Students", parent: "/admin" },
  "/admin/students/report": { title: "Students", parent: "/admin/students" },
  "/admin/talent-pool": { title: "Talent pool", parent: "/admin" },
  "/admin/vault": { title: "Vault", parent: "/admin" },

  // ── Other portals ──
  "/superadmin": { title: "Executive", parent: ROOT },
  "/marketing": { title: "Lead Growth", parent: ROOT },
  "/marketing/inquiries": { title: "Inquiries", parent: "/marketing" },
  "/coordinator": { title: "Section Cell", parent: ROOT },
  "/coordinator/proctoring": { title: "Proctoring", parent: "/coordinator" },
  "/coordinator/reports": { title: "Reports", parent: "/coordinator" },
};

/**
 * Pages that are not part of the signed-in app shell, or draw their own chrome and their own way back — the public
 * marketing site, sign-in, and the Hack Arena (which has its own "Back to my dashboard"). Listed so the coverage test
 * can tell "forgot to register" from "deliberately exempt".
 */
export const OWN_CHROME_ROUTES: readonly string[] = [
  "/",
  "/about",
  "/colleges",
  "/contact",
  "/login",
  "/mellow-internal",
  "/pricing",
  "/privacy",
  "/recruiters",
  "/signup",
  "/students",
  "/terms",
  "/arena",
  "/arena/hackathon",
  "/arena/my",
];

/** The marketing site's feature pages (/features/*) are public and use the site's own navigation. */
export const OWN_CHROME_PREFIXES: readonly string[] = ["/features/"];

export interface BackTarget {
  href: string;
  /** "Core Prep" — the arrow reads "Back to Core Prep". */
  label: string;
}

export interface PortalInfo {
  label: string;
  href: string;
}

const normalise = (path: string) => (path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path);

/**
 * The page one level above `pathname`, or null when there is none (a portal root, or a page with its own chrome).
 * An unregistered route is not an error here — the arrow simply leads to the role's home — but the coverage test makes
 * sure that never happens for a page that exists.
 */
export function resolveBack(pathname: string | null | undefined, portal: PortalInfo, search: string | URLSearchParams = ""): BackTarget | null {
  if (!pathname) return null;
  const path = normalise(pathname);
  const portalPath = normalise(portal.href.split("?")[0]);

  if (path === portalPath) return null;
  if (OWN_CHROME_ROUTES.includes(path) || OWN_CHROME_PREFIXES.some((p) => path.startsWith(p))) return null;

  const node = ROUTE_TREE[path];

  // Not registered: lead home rather than nowhere.
  if (!node) return { href: portal.href, label: portal.label };

  // A portal root of some role has no parent. For this role's own root we already returned; for another role's root
  // (a superadmin looking at a TPO page, say) fall back to this role's home.
  if (node.parent === null) return { href: portal.href, label: portal.label };

  if (node.parent === "@portal") return { href: portal.href, label: portal.label };

  // The parent may carry a ?query or #section to land on; its registry entry is found by the bare path.
  const parentPath = node.parent.split(/[?#]/)[0];
  const parent = ROUTE_TREE[parentPath];
  const parentIsRoot = !parent || parent.parent === null;

  // A parent that is a portal root means "home" for the viewer — unless the page asked for a specific spot on it.
  if (parentIsRoot && node.parent === parentPath) return { href: portal.href, label: node.backLabel ?? portal.label };

  return { href: withCarried(node.parent, node.carry, search), label: node.backLabel ?? parent?.title ?? portal.label };
}

/**
 * "Back" normally goes UP the tree, not to wherever you came from. The one exception is a page that was opened FROM
 * somewhere specific and says so: a problem opened from a company's PYQ page carries `?from=<that page>`, and both
 * back arrows on the problem screen then lead back there — to the same company, with the same filters — instead of up to
 * the Practice Arena.
 *
 * The value arrives in the address bar, so it is never trusted as a URL: only these in-app pages are accepted
 * (anything else — another site, `//host`, `javascript:`, `/admin`, a `..` path — is ignored and the normal "up" applies).
 */
export const RETURN_TO_PARAM = "from";

const RETURN_TO_PATHS: readonly string[] = ["/dashboard/company-prep", "/dashboard/company-prep/view"];

/** Fragment (#section) a return address may carry, so the student lands where they left. Letters, digits, - and _ only. */
const FRAGMENT = /^#[A-Za-z0-9_-]{1,40}$/;

export function safeReturnTo(raw: string | null | undefined): BackTarget | null {
  if (!raw || raw.length > 400) return null;
  // Must be a plain absolute in-app path: one leading slash, no backslashes, control characters or spaces.
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(raw)) return null;

  const hashAt = raw.indexOf("#");
  const beforeHash = hashAt === -1 ? raw : raw.slice(0, hashAt);
  const fragment = hashAt === -1 ? "" : raw.slice(hashAt);
  if (fragment && !FRAGMENT.test(fragment)) return null;

  const queryAt = beforeHash.indexOf("?");
  const path = queryAt === -1 ? beforeHash : beforeHash.slice(0, queryAt);
  if (!RETURN_TO_PATHS.includes(path)) return null;

  const node = ROUTE_TREE[path];
  return node ? { href: raw, label: node.title } : null;
}

/** `href` plus `from=<returnTo>` — what a page adds to a link when it wants the destination's Back to lead back to it. */
export function withReturnTo(href: string, returnTo?: string | null): string {
  if (!returnTo) return href;
  return `${href}${href.includes("?") ? "&" : "?"}${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}`;
}

/** `href` plus the carried parameters found in `search` (a `?a=b` string or URLSearchParams); unchanged when there is nothing to carry. */
function withCarried(href: string, carry: readonly string[] | undefined, search: string | URLSearchParams): string {
  if (!carry || carry.length === 0) return href;

  const from = typeof search === "string" ? new URLSearchParams(search) : search;
  const wanted = new URLSearchParams();
  for (const key of carry) {
    const value = from.get(key);
    if (value) wanted.set(key, value);
  }

  const query = wanted.toString();
  if (query === "") return href;

  const hash = href.indexOf("#");
  const base = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? "" : href.slice(hash);

  return `${base}${base.includes("?") ? "&" : "?"}${query}${fragment}`;
}
