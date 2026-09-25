import { test, expect } from "@playwright/test";
import { login, watchForErrors, reportIssues } from "./_helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const SIGNUP_EMAIL = `qa.signup.${stamp}@example.com`;

test.describe("Signup flow + staff Placements authoring page", () => {
  test("student self-registration creates a real account and logs them in", async ({ page }) => {
    const issues = watchForErrors(page);
    await page.goto("/signup");
    await page.getByPlaceholder("e.g. Alex Chen").fill("QA Signup Student");
    await page.getByPlaceholder("alex@example.com").fill(SIGNUP_EMAIL);
    await page.getByPlaceholder("e.g. alex_coder").fill(`qa_signup_${stamp}`);
    await page.getByPlaceholder("e.g. Apex Inst of Tech").fill("QA Independent Test Institute");
    await page.getByPlaceholder("Create a strong password").fill("QaSignupPass123!");
    await page.getByRole("button", { name: "Create Account & Continue" }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 15000 });
    expect(page.url()).toContain("/dashboard");
    reportIssues("student signup", issues);
  });

  test("staff Placements page: Companies/Drives/Prep/Recommended Problems tabs all render", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_internal");
    await page.goto("/admin/placements");
    await page.waitForTimeout(1500);
    await expect(page.locator("body")).toContainText("Companies");

    for (const tabName of ["Drives", "Prep Questions", "Recommended Problems"]) {
      await page.getByRole("button", { name: tabName }).click();
      await page.waitForTimeout(800);
      const bodyText = await page.locator("body").innerText();
      expect(bodyText.length).toBeGreaterThan(100);
    }
    reportIssues("staff placements authoring page", issues);
  });
});
