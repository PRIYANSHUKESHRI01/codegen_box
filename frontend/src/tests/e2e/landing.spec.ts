import { test, expect, type Page } from "@playwright/test";

/**
 * Every number and date on the landing page comes from GET /api/public/landing. The browser tests answer that one request themselves,
 * with values that are NOT the page's defaults (a 65% Vault bar, a 9:30 PM contest), so a pass proves the page is quoting the backend
 * and that it does not depend on a database being up.
 */
const inFuture = (ms: number) => new Date(Date.now() + ms).toISOString();

const LANDING = () => ({
  generated_at: new Date().toISOString(),
  policy: {
    vault_bar: 65,
    daily: { name: "AptRun Daily Challenge", start_label: "9:30 PM IST", duration_minutes: 90, problems: 3, points: 600, timezone: "Asia/Kolkata" },
    week: { resets_on: "Monday", timezone: "Asia/Kolkata" },
  },
  stats: {
    depth: {
      problems: 2105, test_cases: 8221, languages: 19, interview_questions: 5200, interview_stacks: 40, interview_domains: 12,
      assessment_questions: 4225, company_packs: 9, company_questions: 378, departments: 4, branches: 20,
    },
    adoption: { students: null, colleges: null, contests_held: null, solutions_judged: null, vouchers_sent: null },
  },
  contest: { title: "AptRun Daily Challenge", start_at: inFuture(3 * 3_600_000), ends_at: inFuture(4.5 * 3_600_000), is_live: false, registration: "open", registered: null },
  rewards: {
    live: true,
    week: { key: "2026-11-02", starts_at: inFuture(-86_400_000), resets_at: inFuture(4 * 86_400_000) },
    prizes: [{ rank: 1, brand: "Burger King", amount: 499, logo: "/rewards/burger-king.svg", color: "#D62300", tagline: "A Whopper meal on us" }],
    next: null,
    participants: null,
    shelf: [
      { key: "amazon", brand: "Amazon", logo: "/rewards/amazon.svg", color: "#FF9900" },
      { key: "zomato", brand: "Zomato", logo: "/rewards/zomato.svg", color: "#E23744" },
    ],
  },
  companies: [{ name: "Infosys", slug: "infosys", industry: "IT Services", questions: 42 }],
  departments: [
    { code: "engineering", name: "Engineering & Technology", short: "Engineering", description: "CSE, IT, ECE, EEE, Mechanical and Civil.", accent: "indigo", icon: "cpu", disciplines: 5 },
    { code: "management", name: "Management", short: "Management", description: "BBA, MBA and allied programmes.", accent: "violet", icon: "briefcase", disciplines: 2 },
  ],
});

async function openLanding(page: Page, landing: unknown = LANDING()) {
  await page.route("**/public/landing", (route) =>
    landing ? route.fulfill({ json: landing }) : route.fulfill({ status: 503, json: { message: "down" } })
  );
  await page.goto("/");
}

test.describe("AptRun Landing Page E2E", () => {
  test.beforeEach(async ({ page }) => {
    await openLanding(page);
  });

  test("should load the landing page successfully with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/AptRun — The Placement Sandbox for Colleges/);
    const mainHeading = page.locator("h1");
    await expect(mainHeading).toContainText(/placement-ready/i);
    await expect(mainHeading).toContainText(/one platform/i);
  });

  test("the announcement bar quotes tonight's challenge and this week's top voucher, and can be dismissed", async ({ page }) => {
    const bar = page.getByLabel("Dismiss announcement").locator("..");
    await expect(bar).toContainText(/Daily Challenge/);
    await expect(bar).toContainText(/Burger King/);

    await page.getByLabel("Dismiss announcement").click();
    await expect(page.getByLabel("Dismiss announcement")).toHaveCount(0);
  });

  test("one header button switches between the light and dark theme and remembers it", async ({ page }) => {
    const toDark = page.getByRole("button", { name: "Switch to dark theme" }).locator("visible=true");
    await toDark.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem("aptrun-theme"))).toBe("dark");

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: "Switch to light theme" }).locator("visible=true").click();
    await expect(page.locator("html")).toHaveClass(/light/);
    expect(await page.evaluate(() => localStorage.getItem("aptrun-theme"))).toBe("light");
    // there is no three-way picker in the public header any more
    await expect(page.getByRole("radio", { name: /System theme/i })).toHaveCount(0);
  });

  test("should show no coding problems, problem counts or problem search", async ({ page }) => {
    await expect(page.locator("#problems")).toHaveCount(0);
    await expect(page.getByText(/Practice Problems|DSA Topics|Real Test Cases/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Search problems/i })).toHaveCount(0);
  });

  test("speaks to colleges first, then students, on one switch", async ({ page }) => {
    const tabs = page.getByRole("tablist", { name: "Choose your side" });
    await expect(tabs.getByRole("tab", { name: /placement cells/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#audience-panel")).toContainText("Run the whole placement season");

    await tabs.getByRole("tab", { name: /students/i }).click();
    await expect(page.locator("#audience-panel")).toContainText("Practise daily. Compete weekly. Get found.");

    await expect(page.getByRole("button", { name: /Book a demo/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /I'm a Student/i }).first()).toHaveAttribute("href", "/signup");
    // hiring partners are parked for now
    await expect(page.getByRole("button", { name: /Hire from partner campuses/i })).toHaveCount(0);
  });

  test("a /#students link opens the student side", async ({ page }) => {
    // A fresh load with the hash (a link from another page), not a hash change on a page that is still hydrating.
    await page.goto("about:blank");
    await page.goto("/#students");
    await expect(page.getByRole("tab", { name: /students/i })).toHaveAttribute("aria-selected", "true");
  });

  test("Book a Demo opens the contact form preset to colleges", async ({ page }) => {
    await page.getByRole("button", { name: /Book a demo/i }).first().click();
    await expect(page.getByText("Tell us a bit about your college")).toBeVisible();
  });

  test("the hero counts down to the server's start time for tonight's contest", async ({ page }) => {
    const timer = page.getByRole("timer").first();
    await expect(timer).toBeVisible();
    await expect(timer).toHaveAttribute("aria-label", /\d+ hours \d+ minutes/);
  });

  test("the Mellow Vault card opens its lock at the SERVER's bar (65%)", async ({ page }) => {
    const vault = page.locator("#vault");
    await vault.scrollIntoViewIfNeeded();
    await expect(vault.getByRole("heading", { level: 3 })).toContainText("65%");
    await expect(vault.getByRole("heading", { level: 3 })).toContainText("Unlock Mellow Vault");

    const slider = vault.getByRole("slider", { name: /Your readiness score/i });
    const status = vault.getByRole("status");

    await slider.fill("64");
    await expect(status).toContainText("Mellow Vault is locked");
    await expect(status).toContainText("1 more point to open it");

    await slider.fill("65");
    await expect(status).toContainText("Mellow Vault is unlocked");
  });

  test("the nav takes students to the Mellow Vault and weekly rewards pages", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "the main navigation is a menu on small screens");
    const nav = page.getByRole("navigation", { name: "Main Navigation" });

    await nav.getByRole("link", { name: "Mellow Vault" }).click();
    await expect(page).toHaveURL(/\/vault$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Unlock Mellow Vault");

    await page.getByRole("navigation", { name: "Main Navigation" }).getByRole("link", { name: "Rewards" }).click();
    await expect(page).toHaveURL(/\/rewards$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Win vouchers");
  });

  test("the landing page cards link on to the two pages", async ({ page }) => {
    await expect(page.locator("#rewards").getByRole("link", { name: /How the rewards work/ })).toHaveAttribute("href", "/rewards");
    await expect(page.locator("#vault").getByRole("link", { name: /How Mellow Vault works/ })).toHaveAttribute("href", "/vault");
  });

  test("the rewards card shows the live prize, the contest hour and the shelf", async ({ page }) => {
    const rewards = page.locator("#rewards");
    await rewards.scrollIntoViewIfNeeded();
    await expect(rewards).toContainText("Burger King");
    await expect(rewards).toContainText("₹499");
    await expect(rewards).toContainText("9:30 PM IST");
    await expect(rewards.getByAltText("Amazon").first()).toBeVisible();
    await expect(rewards).toContainText(/not affiliated with, or endorsed by/i);
  });

  test("should answer common questions in the FAQ", async ({ page }) => {
    const faq = page.locator("#faq");
    await faq.getByText("What is Mellow Vault, and how do students unlock it?").click();
    await expect(faq.getByText(/only after the student gives consent|until they consent/i).first()).toBeVisible();
    await expect(faq.getByText(/65%/).first()).toBeVisible();
  });

  test("skip link jumps to the main content", async ({ page }) => {
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: /Skip to main content/i });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });

  test("footer should offer a real contact method, not a fake newsletter form", async ({ page }) => {
    const contactLink = page.locator('a[href="mailto:support@mellowvault.com"]');
    await expect(contactLink.first()).toBeVisible();
  });
});

test.describe("AptRun Landing Page when the API is down", () => {
  test("still reads, on the defaults, and draws no numbers it cannot back", async ({ page }) => {
    await openLanding(page, null);

    await expect(page.locator("h1")).toContainText(/placement-ready/i);
    await expect(page.getByLabel("Dismiss announcement")).toHaveCount(0);
    await expect(page.getByLabel("The platform in numbers")).toHaveCount(0);
    await expect(page.locator("#vault").getByRole("heading", { level: 3 })).toContainText("60%");
    await expect(page.locator("#rewards")).toContainText(/announced on Monday/);
  });
});
