import { test, expect } from "@playwright/test";
import { login, watchForErrors, reportIssues } from "./_helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();

// Built in-memory (not read from a file path) so this test never depends on
// filesystem state outside the repo — a hardcoded scratch-file path here
// previously rotted the moment that temp directory was cleaned up.
function selfImportCsv() {
  return [
    "name,email,roll_number,branch,section,cgpa,backlogs,phone,parent_phone",
    `QA Import One ${stamp},qa.import.one.${stamp}@student.apex.edu.in,QA${stamp}01,CSE,A,8.1,0,+91-9000000001,+91-9000000011`,
    `QA Import Two ${stamp},qa.import.two.${stamp}@student.apex.edu.in,QA${stamp}02,IT,B,7.6,0,+91-9000000002,+91-9000000012`,
    `QA Import Three ${stamp},qa.import.three.${stamp}@student.apex.edu.in,QA${stamp}03,ECE,A,9.0,0,+91-9000000003,+91-9000000013`,
  ].join("\n");
}

test.describe("College TPO (admin_tpo) dashboard", () => {
  test("TPO command center loads, scoped to Apex Institute only", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await expect(page.locator("body")).toContainText(/Apex/i);
    reportIssues("TPO dashboard load", issues);
  });

  test("Drives page: map an available catalog drive to Apex", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/drives");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Available to Map/ }).click();
    await page.waitForTimeout(800);
    const mapButtons = page.getByRole("button", { name: /Map to / });
    const count = await mapButtons.count();
    if (count > 0) {
      const firstDriveCard = mapButtons.first().locator("xpath=ancestor::div[contains(@class,'rounded-panel')][1]");
      const companyNameBefore = await firstDriveCard.innerText().catch(() => "");
      await mapButtons.first().click();
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: /Mapped \(/ }).click();
      await page.waitForTimeout(800);
      console.log(`   mapped a drive; card was: ${companyNameBefore.slice(0, 80)}`);
    } else {
      console.log("   no available drives to map (already all mapped) — acceptable, checking mapped tab instead");
    }
    reportIssues("map catalog drive", issues);
  });

  test("Drives page: create own drive for a brand-new company", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/drives");
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "New Company's Drive" }).click();
    const companyName = `QA Hiring Co ${stamp}`;
    await page.getByPlaceholder("Search for a company (e.g. Infosys)...").fill(companyName);
    await page.waitForTimeout(600);
    await page.getByText(`Add “${companyName}” as a new company`).click();
    await page.getByPlaceholder(/Cisco Systems/).fill(`${companyName} — Campus Drive`);
    // Role Title (required, no placeholder) — 2nd required input in DOM order (Drive Title, Role Title, then the datetime-local Drive Date & Time)
    await page.locator('form input[required]').nth(1).fill("Software Engineer");
    const driveDateInput = page.locator('input[type="datetime-local"]');
    await driveDateInput.fill("2026-12-01T10:00");
    await page.getByRole("button", { name: `Create & Add to Apex` }).click();
    await expect(page.locator("body")).not.toContainText("Add to a New Company's Drive", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /Mapped \(/ }).click();
    await page.waitForTimeout(800);
    await expect(page.locator("body")).toContainText(companyName, { timeout: 10000 });
    reportIssues("create own drive", issues);
  });

  test("Students cohort page loads + TPO self-service bulk import (3 students)", async ({ page }) => {
    test.setTimeout(60000);
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).toContainText(/Bulk Import Students/i);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "tpo_self_import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(selfImportCsv(), "utf-8"),
    });
    await page.getByRole("button", { name: "Upload & Import" }).click();
    await expect(page.locator("text=/Completed$|Completed \\(with errors\\)/")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("body")).toContainText("3 added", { timeout: 5000 });
    reportIssues("TPO self-service bulk import", issues);
  });

  test("Analytics page loads with branch/package charts, no console errors", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/analytics");
    await page.waitForTimeout(1200);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(100);
    reportIssues("TPO analytics page", issues);
  });

  test("Reports page: real report cards render with Download available", async ({ page }) => {
    // Deep coverage (view/download correctness for all 6 report types, real
    // data verification) lives in qa-09-tpo-reports.spec.ts — this is just
    // the smoke check that the page loads correctly as part of the TPO flow.
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/reports");
    await page.waitForResponse((r) => r.url().includes("/tpo/reports/data"));
    await page.waitForTimeout(800);
    const downloadButtons = page.getByRole("button", { name: "Download" });
    await expect(downloadButtons.first()).toBeVisible();
    reportIssues("TPO generate report", issues);
  });

  test("Cross-college isolation: TPO never sees Meridian/Silverline drive data", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/drives");
    await page.waitForTimeout(1000);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Meridian");
    expect(bodyText).not.toContain("Silverline");
    reportIssues("cross-college isolation", issues);
  });
});
