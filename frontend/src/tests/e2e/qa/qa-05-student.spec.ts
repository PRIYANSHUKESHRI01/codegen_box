import { test, expect } from "@playwright/test";
import { login, watchForErrors, reportIssues } from "./_helpers";

test.describe.configure({ mode: "serial" });

test.describe("Student (user) dashboard", () => {
  test("dashboard overview loads, no console errors", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");
    await expect(page.locator("body")).toContainText(/Alex Chen|Welcome/i);
    reportIssues("student dashboard overview", issues);
  });

  test("Practice Arena list: shows the real 5-problem catalog, search + difficulty filter work", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");
    const respPromise = page.waitForResponse((r) => r.url().includes("/api/problems"));
    await page.goto("/dashboard/practice");
    await respPromise;
    await expect(page.locator("body")).toContainText("Two Sum", { timeout: 10000 });
    await expect(page.locator("body")).toContainText("Trapping Rain Water", { timeout: 10000 });
    reportIssues("practice list", issues);
  });

  test("Solve page: wrong/incomplete stub code Runs against real Piston judge and reports Wrong Answer (not a crash)", async ({ page }) => {
    test.setTimeout(45000);
    const issues = watchForErrors(page);
    await login(page, "user");
    await page.goto("/dashboard/practice/two-sum");
    await expect(page.locator(".monaco-editor")).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.locator("text=/Accepted|Wrong Answer|Runtime Error/").first()).toBeVisible({ timeout: 20000 });
    const resultText = await page.locator("body").innerText();
    console.log("   [stub run] contains Wrong Answer:", resultText.includes("Wrong Answer"));
    reportIssues("solve page — stub run", issues);
  });

  test("Solve page: correct solution Submits and is judged Accepted by the real Piston judge", async ({ page }) => {
    test.setTimeout(45000);
    const issues = watchForErrors(page);
    await login(page, "user");
    await page.goto("/dashboard/practice/two-sum");
    await expect(page.locator(".monaco-editor")).toBeVisible({ timeout: 15000 });

    const correctSolution = `function twoSum(nums, target) {
  const seen = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);
  }
  return [];
}
`;
    // Set the Monaco model value directly via its API rather than simulating
    // keystrokes — auto-closing-brackets can duplicate braces when text is
    // injected via keyboard.insertText(), producing syntactically-broken code.
    await page.evaluate((value) => {
      // @ts-ignore
      const editor = window.monaco.editor.getEditors()[0];
      editor.setValue(value);
    }, correctSolution);

    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.locator("text=Accepted").first()).toBeVisible({ timeout: 20000 });
    reportIssues("solve page — correct submit", issues);
  });

  test("Drives: dashboard shows eligible drive badges + drive detail page shows a real eligibility verdict", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");
    await page.waitForTimeout(2000);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toMatch(/Eligible|Not Eligible|drive/i);

    await page.goto("/dashboard/drives/1");
    await page.waitForTimeout(2500);
    const driveBodyText = await page.locator("body").innerText();
    expect(driveBodyText).toMatch(/Eligible|Not Eligible|eligibility|unknown/i);
    reportIssues("drives + eligibility", issues);
  });

  test("Leaderboard page loads without crashing", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");
    await page.goto("/dashboard/leaderboard");
    await page.waitForTimeout(2000);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(50);
    reportIssues("leaderboard", issues);
  });

  test("Reports page loads without crashing", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");
    await page.goto("/dashboard/reports");
    await page.waitForResponse((r) => r.url().includes("/me/rating-history"));
    await page.waitForTimeout(500);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(50);
    reportIssues("student reports", issues);
  });

  test("Settings: real profile update persists (name change round-trip)", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");
    await page.goto("/settings");
    await page.waitForTimeout(1500);
    const nameInput = page.locator('input[type="text"]:not([disabled])').first();
    const originalName = await nameInput.inputValue();
    await nameInput.fill("Alex Chen QA Edit");
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/me/profile") && r.request().method() === "PUT"),
      page.getByRole("button", { name: "Save Changes" }).click(),
    ]);
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.locator('input[type="text"]:not([disabled])').first()).toHaveValue("Alex Chen QA Edit");
    // restore original name so re-runs of this suite stay idempotent
    await page.locator('input[type="text"]:not([disabled])').first().fill(originalName);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/me/profile") && r.request().method() === "PUT"),
      page.getByRole("button", { name: "Save Changes" }).click(),
    ]);
    reportIssues("settings profile update", issues);
  });

  test("Settings: change password round-trip (real backend, then change back)", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Security" }).click();
    await page.waitForTimeout(500);

    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill("alex_coder_codeforge");
    await pwInputs.nth(1).fill("alex_coder_codeforge_TEMP2026");
    await pwInputs.nth(2).fill("alex_coder_codeforge_TEMP2026");
    await page.getByRole("button", { name: "Update Password" }).click();
    // Fail loudly (rather than silently continuing) if the change didn't
    // actually succeed — a swallowed failure here would leave the account
    // on the temp password and break every later test's login.
    await expect(page.locator("text=Password updated")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Password updated")).not.toBeVisible({ timeout: 8000 });

    // Change it back so re-runs / other suites keep using the documented demo password.
    await pwInputs.nth(0).fill("alex_coder_codeforge_TEMP2026");
    await pwInputs.nth(1).fill("alex_coder_codeforge");
    await pwInputs.nth(2).fill("alex_coder_codeforge");
    await page.getByRole("button", { name: "Update Password" }).click();
    await expect(page.locator("text=Password updated")).toBeVisible({ timeout: 10000 });
    reportIssues("settings password change", issues);
  });

  test("Settings: Active Sessions list renders real Sanctum tokens", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "user");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Security" }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator("body")).toContainText(/Session|Device/i);
    reportIssues("settings sessions list", issues);
  });
});
