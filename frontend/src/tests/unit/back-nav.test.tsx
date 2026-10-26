import fs from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn() }),
  usePathname: () => "/dashboard/core/practice",
}));

import { BackButton } from "@/components/navigation/BackButton";
import { OWN_CHROME_PREFIXES, OWN_CHROME_ROUTES, ROUTE_TREE, resolveBack } from "@/lib/backNav";

const STUDENT = { label: "Developer Arena", href: "/dashboard" };
const TPO = { label: "Placement Cell", href: "/admin" };
const OPS = { label: "Platform Ops", href: "/admin?view=mellow" };

beforeEach(() => push.mockReset());
afterEach(cleanup);

/** Every route that has a page.tsx under src/app, as a URL path (route groups and dynamic segments do not occur in this app). */
function appRoutes(): string[] {
  const root = path.resolve(__dirname, "../../app");
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "page.tsx") {
        const rel = path.relative(root, dir).split(path.sep).join("/");
        found.push(rel === "" ? "/" : `/${rel}`);
      }
    }
  };
  walk(root);
  return found.sort();
}

describe("every page has a way back", () => {
  const exempt = (route: string) => OWN_CHROME_ROUTES.includes(route) || OWN_CHROME_PREFIXES.some((p) => route.startsWith(p));
  const routes = appRoutes();

  it("finds the app's pages (guards the walker itself)", () => {
    expect(routes.length).toBeGreaterThan(80);
    expect(routes).toContain("/dashboard/core/practice");
  });

  it("registers every page that is not deliberately exempt — a new page cannot ship without a back target", () => {
    const missing = routes.filter((r) => !exempt(r) && !(r in ROUTE_TREE));
    expect(missing, `Add these to ROUTE_TREE in src/lib/backNav.ts (or to OWN_CHROME_ROUTES if they draw their own chrome): ${missing.join(", ")}`).toEqual([]);
  });

  it("does not keep entries for pages that no longer exist", () => {
    const stale = Object.keys(ROUTE_TREE).filter((r) => !routes.includes(r));
    // The Skill Drills and Practice Interview pages are registered ahead of the pages themselves; remove an entry here only by deleting the page.
    const allowedAhead = ["/dashboard/drills", "/dashboard/drills/session", "/dashboard/interviews/practice"];
    expect(stale.filter((r) => !allowedAhead.includes(r))).toEqual([]);
  });

  it("gives every registered page a parent that exists, with no loops, ending at a portal root", () => {
    for (const [route, node] of Object.entries(ROUTE_TREE)) {
      const seen = new Set<string>([route]);
      let cursor = node;

      while (cursor.parent !== null && cursor.parent !== "@portal") {
        const parentPath = cursor.parent.split(/[?#]/)[0];
        expect(ROUTE_TREE[parentPath], `${route}: parent ${cursor.parent} is not registered`).toBeDefined();
        expect(seen.has(parentPath), `${route}: loop through ${parentPath}`).toBe(false);
        seen.add(parentPath);
        cursor = ROUTE_TREE[parentPath];
      }
    }
  });

  it("never sends a page back to itself", () => {
    for (const route of Object.keys(ROUTE_TREE)) {
      const back = resolveBack(route, STUDENT);
      if (back) expect(back.href.split("?")[0]).not.toBe(route);
    }
  });
});

describe("resolveBack", () => {
  it("leads to the parent page and names it", () => {
    expect(resolveBack("/dashboard/core/practice", STUDENT)).toEqual({ href: "/dashboard/core", label: "Core Prep" });
    expect(resolveBack("/dashboard/core/session", STUDENT)).toEqual({ href: "/dashboard/core/tests", label: "Core tests" });
    expect(resolveBack("/dashboard/learning-centre/vocabulary/words", STUDENT)).toEqual({ href: "/dashboard/learning-centre/vocabulary", label: "Vocabulary" });
  });

  it("leads a page directly under the home to the portal's home, in the portal's own words", () => {
    expect(resolveBack("/dashboard/interviews", STUDENT)).toEqual({ href: "/dashboard", label: "Developer Arena" });
    expect(resolveBack("/admin/analytics", TPO)).toEqual({ href: "/admin", label: "Placement Cell" });
    expect(resolveBack("/admin/analytics", OPS)).toEqual({ href: "/admin?view=mellow", label: "Platform Ops" });
  });

  it("shows no arrow on a portal's home, nor on a page that draws its own chrome", () => {
    expect(resolveBack("/dashboard", STUDENT)).toBeNull();
    expect(resolveBack("/admin", OPS)).toBeNull();
    expect(resolveBack("/login", STUDENT)).toBeNull();
    expect(resolveBack("/features/vault", STUDENT)).toBeNull();
    expect(resolveBack(null, STUDENT)).toBeNull();
  });

  it("settings and notifications go back to whichever home the signed-in role has", () => {
    expect(resolveBack("/settings", STUDENT)).toEqual({ href: "/dashboard", label: "Developer Arena" });
    expect(resolveBack("/notifications", TPO)).toEqual({ href: "/admin", label: "Placement Cell" });
  });

  it("an unregistered page still leads somewhere — home — rather than nowhere", () => {
    expect(resolveBack("/dashboard/brand-new-page", STUDENT)).toEqual({ href: "/dashboard", label: "Developer Arena" });
  });

  it("can land on a query or section of the parent, in words of its own", () => {
    expect(resolveBack("/dashboard/drives", STUDENT)).toEqual({ href: "/dashboard#placement-drives", label: "Placement drives" });
    expect(resolveBack("/admin/projects/review", OPS)).toEqual({ href: "/admin/projects?tab=review", label: "Review queue" });
  });

  it("ignores a trailing slash", () => {
    expect(resolveBack("/dashboard/core/practice/", STUDENT)?.href).toBe("/dashboard/core");
  });
});

describe("BackButton", () => {
  it("is a real link that says where it goes", () => {
    render(<BackButton target={{ href: "/dashboard/core", label: "Core Prep" }} />);
    const link = screen.getByRole("link", { name: "Back to Core Prep" });
    expect(link.getAttribute("href")).toBe("/dashboard/core");
  });

  it("navigates (resiliently) on an ordinary click and shows it has been pressed", () => {
    render(<BackButton target={{ href: "/dashboard/core", label: "Core Prep" }} />);
    const link = screen.getByRole("link", { name: "Back to Core Prep" });

    act(() => {
      fireEvent.click(link);
    });

    expect(push).toHaveBeenCalledWith("/dashboard/core");
    expect(link.getAttribute("aria-busy")).toBe("true");
  });

  it("leaves a modified click (open in a new tab) to the browser", () => {
    render(<BackButton target={{ href: "/dashboard/core", label: "Core Prep" }} />);

    // jsdom would try to follow the link; a real browser opens it in a new tab and leaves this page alone.
    document.addEventListener("click", (e) => e.preventDefault(), { once: true });
    fireEvent.click(screen.getByRole("link", { name: "Back to Core Prep" }), { ctrlKey: true });

    expect(push).not.toHaveBeenCalled();
  });
});

describe("a back arrow whose parent is identified by a parameter", () => {
  it("carries the contest's slug up from a contest problem, so the contest page has something to show", () => {
    expect(resolveBack("/dashboard/contests/problem", STUDENT, "?slug=daily-contest-day-2-6ad0bb059fa1a&contestProblemId=23")).toEqual({
      href: "/dashboard/contests/view?slug=daily-contest-day-2-6ad0bb059fa1a",
      label: "Contest",
    });
    expect(resolveBack("/dashboard/contests/problem", STUDENT, new URLSearchParams("slug=abc&contestProblemId=1"))?.href).toBe("/dashboard/contests/view?slug=abc");
  });

  it("only carries what the node asks for, and falls back to the plain parent when there is nothing to carry", () => {
    expect(resolveBack("/dashboard/contests/problem", STUDENT, "?contestProblemId=23&other=1")?.href).toBe("/dashboard/contests/view");
    expect(resolveBack("/dashboard/contests/problem", STUDENT)?.href).toBe("/dashboard/contests/view");
    expect(resolveBack("/dashboard/core/practice", STUDENT, "?slug=x")?.href).toBe("/dashboard/core");
  });

  it("sends a project workspace to the project list, whose address needs nothing", () => {
    expect(resolveBack("/dashboard/projects/workspace", STUDENT, "?id=9")?.href).toBe("/dashboard/projects");
  });
});
