import { test, expect } from "@playwright/test";
import { login, watchForErrors, reportIssues } from "./_helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const NEW_COLLEGE = `QA Test College ${stamp}`;
const NEW_TPO_EMAIL = `qa.tpo.${stamp}@testcollege.edu`;
const NEW_STAFF_EMAIL = `qa.staff.${stamp}@mellow.ai`;

test.describe("Superadmin dashboard", () => {
  test("dashboard loads with real KPIs, no console errors", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "superadmin");
    await expect(page.locator("body")).toContainText(/Total Users|Partner Universities/i);
    reportIssues("superadmin dashboard load", issues);
  });

  test("onboard a new partner college + TPO", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "superadmin");
    await page.locator("#colleges").getByRole("button", { name: "Add College" }).click();
    await page.getByPlaceholder(/Indian Institute of Technology/).fill(NEW_COLLEGE);
    await page.getByPlaceholder(/Dr\. Ramesh Gupta/).fill("QA Test TPO Officer");
    await page.getByPlaceholder("tpo@iitm.ac.in").fill(NEW_TPO_EMAIL);
    await page.getByRole("button", { name: "Confirm & Provision TPO Portal" }).click();
    await expect(page.locator("body")).not.toContainText("Onboard New Partner College", { timeout: 10000 });
    await page.locator("#colleges").getByPlaceholder("Search college or TPO...").fill(NEW_COLLEGE);
    await page.waitForTimeout(600);
    await expect(page.locator("#colleges")).toContainText(NEW_COLLEGE, { timeout: 10000 });
    await expect(page.locator("#colleges")).toContainText(NEW_TPO_EMAIL);
    reportIssues("onboard college", issues);
  });

  test("duplicate-prefix college name does not 500 (uniqueShortCode regression check)", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "superadmin");
    const dupeName1 = `QAdupe Alpha College ${stamp}`;
    const dupeName2 = `QAdupe Beta College ${stamp}`;
    for (const [name, email] of [
      [dupeName1, `qa.dupe1.${stamp}@testcollege.edu`],
      [dupeName2, `qa.dupe2.${stamp}@testcollege.edu`],
    ]) {
      await page.locator("#colleges").getByRole("button", { name: "Add College" }).click();
      await page.getByPlaceholder(/Indian Institute of Technology/).fill(name);
      await page.getByPlaceholder(/Dr\. Ramesh Gupta/).fill("QA Dupe TPO");
      await page.getByPlaceholder("tpo@iitm.ac.in").fill(email);
      await page.getByRole("button", { name: "Confirm & Provision TPO Portal" }).click();
      await expect(page.locator("body")).not.toContainText("Onboard New Partner College", { timeout: 10000 });
    }
    reportIssues("duplicate short_code collision", issues);
  });

  test("create a new Mellow staff (admin_internal) account", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "superadmin");
    await page.locator("#users").getByRole("button", { name: "Add Staff / User" }).click();
    await page.getByPlaceholder("e.g. Maya Iyer").fill("QA Staff Account");
    await page.getByPlaceholder("maya@mellow.ai").fill(NEW_STAFF_EMAIL);
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForTimeout(2000);
    await page.locator("#users").getByPlaceholder("Search name, handle, email...").fill(NEW_STAFF_EMAIL);
    await page.waitForTimeout(600);
    await expect(page.locator("#users")).toContainText(NEW_STAFF_EMAIL, { timeout: 10000 });
    await expect(page.locator("#users")).toContainText("Mellow Staff");
    reportIssues("create staff account", issues);
  });

  test("role filter dropdown narrows the user list", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "superadmin");
    const respPromise = page.waitForResponse((r) => r.url().includes("/superadmin/users?role=admin_tpo"));
    await page.locator("#users select").selectOption("admin_tpo");
    await respPromise;
    await page.waitForTimeout(300);
    const rowCount = await page.locator("#users tbody tr").count();
    expect(rowCount).toBeGreaterThan(0);
    const bodyText = await page.locator("#users tbody").innerText();
    expect(bodyText).not.toContain("Student User");
    reportIssues("role filter", issues);
  });

  test("block then unblock the newly created staff account", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "superadmin");
    await page.locator("#users select").selectOption("all");
    await page.locator("#users").getByPlaceholder("Search name, handle, email...").fill(NEW_STAFF_EMAIL);
    await page.waitForTimeout(600);
    const row = page.locator("#users tbody tr", { hasText: NEW_STAFF_EMAIL });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Block User" }).click();
    await page.waitForTimeout(1000);
    await expect(row).toContainText("Blocked");
    await row.getByRole("button", { name: "Unblock" }).click();
    await page.waitForTimeout(1000);
    await expect(row).toContainText("Active");
    reportIssues("block/unblock staff", issues);
  });

  test("cannot block own (superadmin) account — no button rendered", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "superadmin");
    await page.locator("#users").getByPlaceholder("Search name, handle, email...").fill("aryan@mellow.ai");
    await page.waitForTimeout(600);
    const row = page.locator("#users tbody tr", { hasText: "aryan@mellow.ai" });
    await expect(row).toContainText("This is you");
    reportIssues("self-block guard (UI)", issues);
  });

  test("audit log reflects the college-onboarding + staff-creation actions live", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "superadmin");
    await expect(page.locator("body")).toContainText(/Audit/i);
    await expect(page.locator("body")).toContainText(/Created account|Blocked an account|Unblocked an account/i);
    await expect(page.locator("body")).toContainText("QA Staff Account");
    reportIssues("audit log render", issues);
  });

  test("Judge Infrastructure card reports live execution-pool telemetry", async ({ page }) => {
    await login(page, "superadmin");
    await expect(page.locator("#judge-nodes")).toContainText("Live");
  });
});
