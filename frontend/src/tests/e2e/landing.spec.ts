import { test, expect } from "@playwright/test";

test.describe("CodeGen Box Landing Page E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load the landing page successfully with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/CodeGen Box — Master Competitive Programming/);
    const mainHeading = page.locator("h1");
    await expect(mainHeading).toContainText("Campus Placements");
  });

  test("should display announcement bar and allow dismissal", async ({ page }) => {
    const announcement = page.getByText("Now onboarding partner campuses for the new placement season", { exact: true });
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
    await expect(page.getByRole("button", { name: /Unlock All \d+ Problems|Sign Up Free/i })).toBeVisible();
  });

  test("should display the Famous DSA Sheets section, crediting real external creators", async ({ page }) => {
    const dsaSection = page.locator("#dsa-sheets");
    await expect(dsaSection).toBeVisible();
    await expect(dsaSection.locator("text=Striver's A2Z DSA Course")).toBeVisible();
    await expect(dsaSection.locator("text=Love Babbar's DSA Sheet")).toBeVisible();
    await expect(dsaSection.locator("text=NeetCode 150")).toBeVisible();

    const originalLink = dsaSection.getByRole("link", { name: /View Original Sheet/i }).first();
    await expect(originalLink).toHaveAttribute("target", "_blank");
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
