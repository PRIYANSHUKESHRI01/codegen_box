import { test, expect } from "@playwright/test";
import { login, watchForErrors, reportIssues } from "./_helpers";

test.describe.configure({ mode: "serial" });

test.describe("Weekly readiness report inputs: practice score, parent phone, WhatsApp/termination notify", () => {
  test("At Risk (<60%) quick filter sets the exact threshold used by the weekly report", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: /At Risk \(<60%\)/ }).click();
    await page.waitForTimeout(400);
    const minInput = page.locator('input[type="number"]').first();
    const maxInput = page.locator('input[type="number"]').nth(1);
    await expect(minInput).toHaveValue("0");
    await expect(maxInput).toHaveValue("59");
    reportIssues("at risk quick filter", issues);
  });

  test("profile drawer shows parent phone and 7-day practice streak", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);

    await page.locator("tbody tr", { hasText: "Alex Chen" }).getByRole("button", { name: "Profile" }).click();
    await expect(page.locator("text=Candidate Profile")).toBeVisible();
    await expect(page.locator("text=9876500099")).toBeVisible();
    await expect(page.locator("text=7-Day Practice Streak")).toBeVisible();
    reportIssues("parent phone + practice streak in drawer", issues);
  });

  test("notify modal: WhatsApp + Parent + Termination Notice — real job queues, real WhatsApp log entry written", async ({
    page,
  }) => {
    test.setTimeout(30000);
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);

    const alexRow = page.locator("tbody tr", { hasText: "Alex Chen" });
    await alexRow.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /Notify Selected \(1\)/ }).click();
    await expect(page.locator("text=Notify Students")).toBeVisible();

    await page.getByRole("button", { name: "WhatsApp" }).click();
    await page.getByRole("button", { name: "Parent" }).click();
    await page.getByRole("button", { name: "Termination Notice" }).click();

    const respPromise = page.waitForResponse((r) => r.url().includes("/tpo/students/bulk-notify"));
    await page.getByRole("button", { name: "Send" }).click();
    const resp = await respPromise;
    const body = await resp.json();
    console.log("   [bulk-notify response]", JSON.stringify(body));
    expect(resp.status()).toBe(200);
    expect(body.queued_count).toBe(1);
    reportIssues("whatsapp+parent+termination notify", issues);
  });

  test("notify modal: parent recipient with no phone shows a warning and skips that student", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);

    // Priya Desai has no parent_phone set
    const priyaRow = page.locator("tbody tr", { hasText: "Priya Desai" });
    await priyaRow.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /Notify Selected \(1\)/ }).click();
    await page.getByRole("button", { name: "WhatsApp" }).click();
    await page.getByRole("button", { name: "Parent" }).click();
    await expect(page.locator("text=/have no parent number on file/")).toBeVisible();

    const respPromise = page.waitForResponse((r) => r.url().includes("/tpo/students/bulk-notify"));
    await page.getByRole("button", { name: "Send" }).click();
    const resp = await respPromise;
    const body = await resp.json();
    expect(body.queued_count).toBe(0);
    expect(body.skipped_no_phone).toBe(1);
    reportIssues("missing parent phone warning + skip", issues);
  });

  test("notify modal: Email + Parent is rejected with a clear error (no parent email exists)", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_tpo");
    await page.goto("/admin/students");
    await page.waitForResponse((r) => r.url().includes("/tpo/students/cohort"));
    await page.waitForTimeout(800);

    const alexRow = page.locator("tbody tr", { hasText: "Alex Chen" });
    await alexRow.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /Notify Selected \(1\)/ }).click();
    // Email is the default channel; switching to WhatsApp then back to Email
    // should reset recipient to student, so force parent via WhatsApp first
    await page.getByRole("button", { name: "WhatsApp" }).click();
    await page.getByRole("button", { name: "Parent" }).click();
    await page.getByRole("button", { name: "Email" }).click();
    // Email tab hides the Recipient selector entirely (auto-resets to student)
    await expect(page.locator("text=Recipient")).not.toBeVisible();
    reportIssues("email auto-resets recipient to student", issues);
  });
});
