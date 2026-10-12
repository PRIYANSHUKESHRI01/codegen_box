import { test, expect, type Page } from "@playwright/test";
import { login, watchForErrors, reportIssues, DEMO } from "./_helpers";

/**
 * Hack Arena — needs the demo data from HackathonSeeder (part of DatabaseSeeder): five hackathons,
 * one live, one with registration open, one announced, one being judged, one finished.
 */
test.describe.configure({ mode: "serial" });

/** A `datetime-local` value `offsetHours` from now, in the browser's local time. */
const local = (offsetHours: number) => {
  const d = new Date(Date.now() + offsetHours * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Sign in without going through the login form. The login endpoint allows 5 attempts a minute per account
 * (a real protection), and this suite needs the same students and staff many times over; signing in through
 * the API once per role and reusing the session is the standard answer. The first test below still exercises
 * the real login form end to end.
 */
const sessions = new Map<string, { token: string; user: unknown }>();

async function signIn(page: Page, role: keyof typeof DEMO) {
  let session = sessions.get(role);

  if (!session) {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";
    const res = await fetch(`${api}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: DEMO[role].email, password: DEMO[role].password }),
    });
    session = await res.json();
    if (!session?.token) throw new Error(`API sign-in failed for ${role}`);
    sessions.set(role, session);
  }

  await page.goto("/login");
  await page.evaluate(([token, user]) => {
    localStorage.setItem("aptrun_token", token as string);
    localStorage.setItem("aptrun_user", JSON.stringify(user));
  }, [session.token, session.user]);
}

async function openArena(page: Page) {
  await page.goto("/arena");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15000 });
}

test.describe("Hack Arena — student", () => {
  test("the Arena is entered from a dashboard banner, never the sidebar, and Exit returns to the dashboard", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");

    const sidebar = page.getByRole("navigation", { name: "Dashboard sections" });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText(/hack ?arena|hackathon/i)).toHaveCount(0);

    await page.getByRole("link", { name: /Enter Hack Arena/ }).click();
    await page.waitForURL("**/arena");

    // A compact player card (a quiet "Welcome back" + the name as the page heading + @handle), and the sidebar is gone — this is its own world.
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByText("@alex_coder").first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Dashboard sections" })).toHaveCount(0);

    await page.getByRole("button", { name: /Exit Arena/ }).first().click();
    await page.waitForURL("**/dashboard");
    reportIssues("arena entry + exit", issues);
  });

  test("the lobby shows the five demo hackathons with their hosts and phases", async ({ page }) => {
    const issues = watchForErrors(page);
    await signIn(page, "user");
    await openArena(page);

    for (const title of ["AI for Bharat Build Sprint", "Nimbus Cloud-Native Challenge", "GreenCode Climate Hack", "HealthTech Hack Day", "Campus Connect Hack 2.0"]) {
      await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
    }

    await expect(page.getByText("Nimbus Labs").first()).toBeVisible(); // hosted by a hiring partner
    await expect(page.getByText("Live now").first()).toBeVisible();

    // Filters narrow the catalogue.
    // The status filters are SlidingTabs (role=tab), with a count badge inside the name — hence the prefix match.
    await page.getByRole("tab", { name: /^Past/ }).click();
    await expect(page.getByRole("link", { name: "Campus Connect Hack 2.0" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "GreenCode Climate Hack" })).toHaveCount(0);
    reportIssues("lobby", issues);
  });

  test("a finished hackathon shows its podium, the leaderboard and the student's own result", async ({ page }) => {
    const issues = watchForErrors(page);
    await signIn(page, "user");
    await page.goto("/arena/hackathon?slug=campus-connect-hack-2");

    await expect(page.getByRole("heading", { level: 1, name: "Campus Connect Hack 2.0" })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("tab", { name: "Results" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("The podium")).toBeVisible();
    await expect(page.getByText("StudySync").first()).toBeVisible();
    await expect(page.getByText("YOU", { exact: true })).toBeVisible(); // Alex's own row is marked
    reportIssues("completed hackathon", issues);
  });

  test("the detail page tabs all render", async ({ page }) => {
    const issues = watchForErrors(page);
    await signIn(page, "user");
    await page.goto("/arena/hackathon?slug=nimbus-cloud-native-challenge");
    await expect(page.getByRole("heading", { level: 1, name: /Nimbus Cloud-Native Challenge/ })).toBeVisible({ timeout: 15000 });

    for (const [tab, expected] of [
      ["Prizes", /How projects are judged/],
      ["Schedule", /Registration opens/],
      ["Rules", /Frequently asked questions/],
      ["Updates", /Mentor line-up announced/],
    ] as const) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByText(expected).first()).toBeVisible();
    }
    reportIssues("detail tabs", issues);
  });

  test("a team-only hackathon will not let a student register solo, and an invalid invite code is explained", async ({ page }) => {
    await signIn(page, "user");
    await page.goto("/arena/hackathon?slug=nimbus-cloud-native-challenge");
    await page.getByRole("button", { name: /Register now/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Go solo")).toHaveCount(0); // min team size is 2
    await dialog.getByText("Join a team").click();
    await dialog.getByRole("textbox", { name: "Invite code" }).fill("NOSUCHCD");
    await dialog.getByRole("button", { name: "Join team" }).click();
    await expect(dialog.getByText(/does not match any team/)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
});

test.describe("Hack Arena — access", () => {
  test("a college TPO is turned away from the Arena and refused by the hosting API", async ({ page, request }) => {
    await signIn(page, "admin_tpo");
    await page.goto("/arena");
    await page.waitForURL((url) => !url.pathname.startsWith("/arena"), { timeout: 15000 });

    // The page guard is only convenience; the server is the real boundary.
    const token = await page.evaluate(() => localStorage.getItem("aptrun_token"));
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

    for (const path of ["/arena/home", "/arena/hackathons", "/admin/hackathons", "/company/hackathons"]) {
      expect((await request.get(`${api}${path}`, { headers })).status(), path).toBe(403);
    }
    expect((await request.post(`${api}/admin/hackathons`, { headers, data: {} })).status()).toBe(403);
  });

  test("Hackathons appears in Mellow Ops and Hiring Hub navigation, not in the student or TPO rail", async ({ page }) => {
    await signIn(page, "admin_internal");
    await page.goto(DEMO.admin_internal.home);
    await expect(page.getByRole("navigation", { name: "Dashboard sections" }).getByText("Hackathons")).toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await signIn(page, "admin_company");
    await page.goto(DEMO.admin_company.home);
    await expect(page.getByRole("navigation", { name: "Dashboard sections" }).getByText("Hackathons")).toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await signIn(page, "admin_tpo");
    await page.goto(DEMO.admin_tpo.home);
    // Wait for the TPO's own navigation to render before asserting something is absent from it.
    const tpoNav = page.getByRole("navigation", { name: "Dashboard sections" });
    await expect(tpoNav.getByText("Campus Drives")).toBeVisible();
    await expect(tpoNav.getByText("Hackathons")).toHaveCount(0);
  });
});

test.describe("Hack Arena — hosting", () => {
  const title = `E2E Hack ${Date.now().toString().slice(-6)}`;

  test("Ops creates and publishes a hackathon, and a student can find it and register", async ({ page }) => {
    test.setTimeout(90000);
    const issues = watchForErrors(page);

    await signIn(page, "admin_internal");
    await page.goto("/admin/hackathons/edit");
    await expect(page.getByRole("heading", { name: /New hackathon/ }).first()).toBeVisible({ timeout: 15000 });

    await page.locator("#h-title").fill(title);
    await page.locator("#h-tagline").fill("A hackathon created by the end-to-end test.");
    await page.locator("#h-desc").fill("This hackathon exists to prove that a host can create, publish and open registration, end to end, through the real screens.");
    await page.locator("#h-ropen").fill(local(-1));
    await page.locator("#h-rclose").fill(local(48));
    await page.locator("#h-start").fill(local(72));
    await page.locator("#h-end").fill(local(96));
    await page.locator("#h-res").fill(local(120));

    await page.getByRole("button", { name: /Save & publish/ }).click();
    await page.waitForURL("**/admin/hackathons/manage?id=*", { timeout: 20000 });
    await expect(page.getByText("Registration open").first()).toBeVisible();

    // …and the student finds it in the Arena and registers solo.
    await page.evaluate(() => localStorage.clear());
    await signIn(page, "user");
    await openArena(page);
    await page.getByRole("searchbox", { name: "Search hackathons" }).fill(title);
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible({ timeout: 20000 });
    await page.getByRole("link", { name: title }).first().click();

    await page.getByRole("button", { name: /Register now/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Register" }).click();
    await expect(page.getByText(/You're in/).first()).toBeVisible({ timeout: 15000 });
    reportIssues("create → publish → register", issues);
  });

  test("a hiring partner sees only its own hackathons, with the same screens", async ({ page }) => {
    await signIn(page, "admin_company");
    await page.goto("/admin/company/hackathons");
    await expect(page.getByRole("heading", { name: "Hackathons" }).first()).toBeVisible({ timeout: 15000 });

    await expect(page.getByText("Nimbus Cloud-Native Challenge").first()).toBeVisible();
    await expect(page.getByText("AI for Bharat Build Sprint")).toHaveCount(0); // hosted by AptRun, not by this company
    await expect(page.getByText(title)).toHaveCount(0); // Ops' hackathon created above
  });
});

test.describe("Hack Arena — audience", () => {
  const title = `E2E Campus ${Date.now().toString().slice(-6)}`;

  test("Ops maps a hackathon to one college: its students get it immediately, other colleges' students never see it", async ({ page, request }) => {
    test.setTimeout(90000);
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

    await signIn(page, "admin_internal");
    await page.goto("/admin/hackathons/edit");
    await expect(page.getByRole("heading", { name: /New hackathon/ }).first()).toBeVisible({ timeout: 15000 });

    await page.locator("#h-title").fill(title);
    await page.locator("#h-tagline").fill("Only one campus can see this.");
    await page.locator("#h-desc").fill("A hackathon mapped to a single college, to prove that it reaches those students at once and nobody else.");
    await page.locator("#h-ropen").fill(local(-1));
    await page.locator("#h-rclose").fill(local(48));
    await page.locator("#h-start").fill(local(72));
    await page.locator("#h-end").fill(local(96));
    await page.locator("#h-res").fill(local(120));

    // Choosing "Specific colleges" with none picked is refused…
    await page.getByRole("radio", { name: /Specific colleges/ }).click();
    await page.getByRole("button", { name: /Save & publish/ }).click();
    await expect(page.getByText(/Pick at least one college/).first()).toBeVisible();

    // …then pick Apex and publish — no approval step.
    await page.getByLabel("Search colleges").fill("Apex");
    await page.getByRole("checkbox").first().check({ force: true });
    await page.getByRole("button", { name: /Save & publish/ }).click();
    await page.waitForURL("**/admin/hackathons/manage?id=*", { timeout: 20000 });
    await expect(page.getByText("1 college").first()).toBeVisible();
    await expect(page.getByText("Registration open").first()).toBeVisible();

    // The Apex student sees it, flagged as exclusive.
    await page.evaluate(() => localStorage.clear());
    await signIn(page, "user");
    await openArena(page);
    await page.getByRole("searchbox", { name: "Search hackathons" }).fill(title);
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Your college only").first()).toBeVisible({ timeout: 20000 });

    // A student of another college does not (checked against the API, as that is the real boundary).
    const outsider = await request.post(`${api}/login`, { data: { email: "ananya.iyer@student.meridian.edu.in", password: "campus_demo_2026" }, headers: { Accept: "application/json" } });
    const token = (await outsider.json()).token;
    const catalogue = await request.get(`${api}/arena/hackathons?q=${encodeURIComponent(title)}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    expect((await catalogue.json()).hackathons).toHaveLength(0);
  });
});

