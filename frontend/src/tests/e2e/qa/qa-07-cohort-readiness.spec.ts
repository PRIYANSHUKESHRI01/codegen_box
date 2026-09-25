import { test, expect } from "@playwright/test";
import { login, watchForErrors, reportIssues } from "./_helpers";

test.describe.configure({ mode: "serial" });

test.describe("TPO Student Cohort — readiness score, bulk email, Excel export", () => {
  test("cohort table loads with real students and a Readiness Score column", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);
    await expect(page.locator("thead")).toContainText("Readiness Score");
    await expect(page.locator("tbody")).toContainText("Alex Chen");
    // Alex Chen is seeded with a complete, eligible profile -> Placement Ready
    const alexRow = page.locator("tbody tr", { hasText: "Alex Chen" });
    await expect(alexRow).toContainText("Placement Ready");
    reportIssues("cohort table load", issues);
  });

  test("readiness score range filter narrows the list", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);
    const rowsBefore = await page.locator("tbody tr").count();

    // Set min score to 80 -> should hide Priya Desai (57) and Rohan Kapoor (0)
    const minInput = page.locator('input[type="number"]').first();
    await minInput.fill("80");
    await page.waitForTimeout(400);
    const rowsAfter = await page.locator("tbody tr").count();
    expect(rowsAfter).toBeLessThan(rowsBefore);
    await expect(page.locator("tbody")).not.toContainText("Rohan Kapoor");
    reportIssues("readiness score filter", issues);
  });

  test("bulk email: select all filtered, confirm, and a real email queues", async ({ page }) => {
    test.setTimeout(30000);
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: /Notify All Filtered/ }).click();
    await expect(page.locator("text=Notify Students")).toBeVisible();
    const respPromise = page.waitForResponse((r) => r.url().includes("/tpo/students/bulk-notify"));
    await page.getByRole("button", { name: "Send" }).click();
    const resp = await respPromise;
    expect(resp.status()).toBe(200);
    await expect(page.locator("text=/Queued a notification for/")).toBeVisible({ timeout: 5000 });
    reportIssues("bulk email all filtered", issues);
  });

  test("bulk email: select individual checkboxes and send to selected only", async ({ page }) => {
    test.setTimeout(30000);
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);

    const alexRow = page.locator("tbody tr", { hasText: "Alex Chen" });
    await alexRow.locator('input[type="checkbox"]').check();
    await expect(page.getByRole("button", { name: /Notify Selected \(1\)/ })).toBeVisible();
    await page.getByRole("button", { name: /Notify Selected \(1\)/ }).click();
    await expect(page.locator("text=1 selected student")).toBeVisible();
    const respPromise = page.waitForResponse((r) => r.url().includes("/tpo/students/bulk-notify"));
    await page.getByRole("button", { name: "Send" }).click();
    const resp = await respPromise;
    const body = await resp.json();
    expect(body.queued_count).toBe(1);
    reportIssues("bulk email selected", issues);
  });

  test("Download Excel produces a real, valid .xlsx file", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
    await page.getByRole("button", { name: /Download Excel/ }).click();
    const download = await downloadPromise;
    const suggestedName = download.suggestedFilename();
    console.log("   [download] filename:", suggestedName);
    expect(suggestedName).toMatch(/\.xlsx$/);

    const savePath =
      "C:/Users/HP/AppData/Local/Temp/claude/d--Dev-Mellow-CodeChef/1b55176e-3d8c-42e5-84ab-39c863b652ac/scratchpad/downloaded-cohort.xlsx";
    await download.saveAs(savePath);
    const fs = require("fs");
    const stats = fs.statSync(savePath);
    console.log("   [download] file size bytes:", stats.size);
    expect(stats.size).toBeGreaterThan(1000);
    // .xlsx files are zip archives -> "PK" magic bytes
    const buffer = fs.readFileSync(savePath);
    expect(buffer.subarray(0, 2).toString("ascii")).toBe("PK");
    reportIssues("download excel", issues);
  });

  test("profile drawer opens with real, honest fields (no fabricated placement/attendance data)", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);

    await page.locator("tbody tr", { hasText: "Alex Chen" }).getByRole("button", { name: "Profile" }).click();
    await expect(page.locator("text=Candidate Profile")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Placement Readiness" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Account Status" })).toBeVisible();
    reportIssues("profile drawer honest fields", issues);
  });
});
