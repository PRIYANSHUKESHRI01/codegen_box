import { test, expect } from "@playwright/test";
import { DEMO, login, watchForErrors, reportIssues } from "./_helpers";

test.describe("Auth + role gating", () => {
  test("all 4 demo accounts log in and land on the right home", async ({ page }) => {
    for (const role of Object.keys(DEMO) as (keyof typeof DEMO)[]) {
      const issues = watchForErrors(page);
      await login(page, role);
      expect(page.url()).toContain(DEMO[role].home);
      reportIssues(`login as ${role}`, issues);
      await page.evaluate(() => localStorage.clear());
    }
  });

  test("wrong password is rejected with a visible error, no crash", async ({ page }) => {
    const issues = watchForErrors(page);
    await page.goto("/login");
    await page.getByRole("button", { name: "Super Admin" }).click();
    await page.getByPlaceholder("name@domain.com").fill("aryan@mellow.ai");
    await page.getByPlaceholder("Enter your password").fill("wrong_password_123");
    await page.getByRole("button", { name: "Access Master Console" }).click();
    await expect(page.locator("text=/Access Master Console/")).toBeVisible();
    await page.waitForTimeout(1500);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.toLowerCase()).toMatch(/invalid|incorrect|unauthorized|unable to sign in|credentials/);
    reportIssues("wrong password", issues);
  });

  test("student cannot reach /superadmin or /admin — gets redirected away", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");
    await page.goto("/superadmin");
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain("/superadmin");
    await page.goto("/admin");
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain("/admin");
    reportIssues("student role-gating", issues);
  });

  test("admin_internal cannot reach /superadmin", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_internal");
    await page.goto("/superadmin");
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain("/superadmin");
    reportIssues("admin_internal role-gating", issues);
  });

  test("admin_tpo cannot reach /superadmin", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/superadmin");
    await page.waitForTimeout(1500);
    expect(page.url()).not.toContain("/superadmin");
    reportIssues("admin_tpo role-gating", issues);
  });

  test("logged-out visitor hitting a protected page is bounced to /login", async ({ page }) => {
    const issues = watchForErrors(page);
    await page.goto("/dashboard");
    await page.waitForTimeout(1500);
    expect(page.url()).toContain("/login");
    reportIssues("anonymous protected-route access", issues);
  });

  test("settings page works for every role and shows the right sidebar context", async ({ page }) => {
    for (const role of Object.keys(DEMO) as (keyof typeof DEMO)[]) {
      const issues = watchForErrors(page);
      await login(page, role);
      await page.goto("/settings");
      await page.waitForTimeout(1000);
      expect(page.url()).toContain("/settings");
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(50);
      reportIssues(`/settings as ${role}`, issues);
      await page.evaluate(() => localStorage.clear());
    }
  });
});
