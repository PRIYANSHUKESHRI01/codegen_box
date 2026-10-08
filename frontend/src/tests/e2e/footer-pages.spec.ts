import { test, expect } from "@playwright/test";

/**
 * Every footer link must land on a real page, not a "#" placeholder. These
 * tests click through the footer the way a visitor would.
 */
test.describe("Footer and public content pages", () => {
  const FOOTER_TARGETS: { link: string; url: RegExp; heading: RegExp }[] = [
    { link: "Campus Drive Management", url: /\/features\/campus-drives$/, heading: /Campus Drive Management/ },
    { link: "Student Onboarding", url: /\/features\/student-onboarding$/, heading: /Student Onboarding/ },
    { link: "Readiness Analytics", url: /\/features\/placement-analytics$/, heading: /Readiness Analytics/ },
    { link: "Proctored Assessments", url: /\/features\/proctored-assessments$/, heading: /Proctored Assessments/ },
    { link: "Personal Learning Centre", url: /\/features\/learning-centre$/, heading: /Learning Centre/ },
    { link: "Company Prep Packs", url: /\/features\/company-prep$/, heading: /Prep Packs/ },
    { link: "Practice Arena", url: /\/features\/practice-arena$/, heading: /Practice Arena/ },
    { link: "Hire From Campuses", url: /\/features\/campus-hiring$/, heading: /Hire From Campuses/ },
    { link: "Talent Pool", url: /\/features\/talent-pool$/, heading: /Talent Pool/ },
    { link: "AI Interviews", url: /\/features\/ai-interviews$/, heading: /AI Interviews/ },
    { link: "About", url: /\/about$/, heading: /placement season/i },
    { link: "Contact", url: /\/contact$/, heading: /placement season/i },
  ];

  for (const t of FOOTER_TARGETS) {
    test(`footer link "${t.link}" opens its page`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: t.link, exact: true }).click();
      await expect(page).toHaveURL(t.url);
      await expect(page.locator("h1").first()).toContainText(t.heading);
    });
  }

  test("legal links in the footer bar open Privacy and Terms", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.locator("h1")).toContainText("Privacy Policy");

    await page.getByRole("link", { name: "Terms of Service" }).first().click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.locator("h1")).toContainText("Terms of Service");
  });

  test("footer has no dead '#' links and keeps the support email", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    expect(await footer.locator('a[href="#"]').count()).toBe(0);
    await expect(footer.locator('a[href="mailto:support@mellowvault.com"]').first()).toBeVisible();
  });

  test("a feature page offers the right call to action and related pages", async ({ page }) => {
    await page.goto("/features/campus-drives");
    await expect(page.getByRole("button", { name: /Book a Demo for Your College/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keep exploring" })).toBeVisible();

    await page.getByRole("button", { name: /Book a Demo for Your College/i }).first().click();
    await expect(page.getByText("Tell us a bit about your college")).toBeVisible();
  });

  test("student feature pages send people straight to sign-up", async ({ page }) => {
    await page.goto("/features/learning-centre");
    await expect(page.getByRole("link", { name: /Create Student Account/i }).first()).toHaveAttribute("href", "/signup");
  });

  test("nav items open the audience hub pages, from the landing page and from sub pages", async ({ page }) => {
    for (const [from, name, url, heading] of [
      ["/", "Colleges", /\/colleges$/, /command center/i],
      ["/about", "Students", /\/students$/, /visiting next week/i],
      ["/", "Recruiters", /\/recruiters$/, /already prepared/i],
    ] as const) {
      await page.goto(from);
      await page.getByRole("navigation", { name: "Main Navigation" }).getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(page.locator("h1")).toContainText(heading);
    }
  });

  test("footer column headings open their hub page", async ({ page }) => {
    for (const [name, url] of [
      ["For Colleges", /\/colleges$/],
      ["For Students", /\/students$/],
      ["For Recruiters", /\/recruiters$/],
      ["Company", /\/about$/],
    ] as const) {
      await page.goto("/");
      await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test("a hub lists its feature pages and links onward", async ({ page }) => {
    await page.goto("/colleges");
    await expect(page.getByRole("button", { name: /Book a Demo for Your College/i }).first()).toBeVisible();
    await page.getByRole("link", { name: /Campus Drive Management/ }).first().click();
    await expect(page).toHaveURL(/\/features\/campus-drives$/);

    // The breadcrumb climbs back up to the hub.
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "For Colleges" }).click();
    await expect(page).toHaveURL(/\/colleges$/);
  });

  test("the student hub sends people straight to sign-up", async ({ page }) => {
    await page.goto("/students");
    await expect(page.getByRole("link", { name: /Create Student Account/i }).first()).toHaveAttribute("href", "/signup");
  });
});
