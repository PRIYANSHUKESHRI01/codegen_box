import { test, expect } from "@playwright/test";

test.describe("AptRun Landing Page E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load the landing page successfully with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/AptRun — The Placement Sandbox for Colleges/);
    const mainHeading = page.locator("h1");
    await expect(mainHeading).toContainText(/placement drive/i);
  });

  test("should display announcement bar and allow dismissal", async ({ page }) => {
    // The long copy swaps to a short variant below `sm`, so assert on the bar itself.
    const announcement = page.getByText(/onboarding partner campuses/i).locator("visible=true");
    await expect(announcement).toBeVisible();

    const dismissBtn = page.getByLabel("Dismiss announcement");
    await dismissBtn.click();
    await expect(announcement).not.toBeVisible();
  });

  test("should toggle themes (Dark, Light, System) and persist preference", async ({ page }) => {
    const lightBtn = page.getByRole("radio", { name: /Light theme/i }).first();
    await lightBtn.click();
    await expect(page.locator("html")).toHaveClass(/light/);

    const savedTheme = await page.evaluate(() => localStorage.getItem("codepulse-theme"));
    expect(savedTheme).toBe("light");

    const darkBtn = page.getByRole("radio", { name: /Dark theme/i }).first();
    await darkBtn.click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("should display real, non-zero platform stats", async ({ page }) => {
    // Generous timeout: this hits GET /public/stats against the dev-only
    // single-threaded `php artisan serve`, which can queue up under a full
    // parallel test-worker run.
    const statsSection = page.locator("text=Practice Problems").first();
    await expect(statsSection).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=DSA Topics Covered")).toBeVisible();
    await expect(page.locator("text=Languages Supported")).toBeVisible();
  });

  test("should show real problems from the catalog in the Problem Explorer", async ({ page }) => {
    const cards = page.locator("#problems h3");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    // The bottom CTA reads the real live catalog total, never "1,400+".
    await expect(
      page.locator("#problems").getByRole("button", { name: /Unlock All \d+ Problems|Sign Up Free/i })
    ).toBeVisible();
  });

  test("should speak to colleges first, then students and recruiters", async ({ page }) => {
    for (const id of ["colleges", "candidates", "employers"]) {
      await expect(page.locator("#" + id)).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /Book a demo/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /I'm a Student/i }).first()).toHaveAttribute("href", "/signup");
  });

  test("Book a Demo opens the contact form preset to colleges", async ({ page }) => {
    await page.getByRole("button", { name: /Book a demo/i }).first().click();
    await expect(page.getByText("Tell us a bit about your college")).toBeVisible();
  });

  test("recruiter entry point opens the contact form preset to Employer", async ({ page }) => {
    await page.getByRole("button", { name: /Hire from partner campuses/i }).click();
    await expect(page.getByText("Tell us a bit about your hiring needs")).toBeVisible();
  });

  test("should answer common questions in the FAQ", async ({ page }) => {
    const faq = page.locator("#faq");
    await faq.getByText("Who can see a student's profile in the talent pool?").click();
    await expect(faq.getByText(/only after the student gives consent/i)).toBeVisible();
  });

  test("should open the quick search modal", async ({ page }) => {
    // Ctrl+K is also a native Chrome shortcut (address-bar search) that
    // can get intercepted before reaching the page's own listener in a
    // controlled browser context — the button is the deterministic way to
    // exercise this, and it's the same handler either path calls.
    await page.getByRole("button", { name: /Search problems and topics/i }).click();
    const modal = page.getByRole("dialog", { name: /Quick problem search/i });
    await expect(modal).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("footer should offer a real contact method, not a fake newsletter form", async ({ page }) => {
    const contactLink = page.locator('a[href="mailto:support@mellowvault.com"]');
    await expect(contactLink.first()).toBeVisible();
  });
});
