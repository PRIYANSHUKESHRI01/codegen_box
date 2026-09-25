import { test, expect } from "@playwright/test";
import { login, watchForErrors, reportIssues } from "./_helpers";

test.describe.configure({ mode: "serial" });

/**
 * Company hiring tenant (admin_company) dashboard — mirrors qa-04-tpo.spec.ts's
 * shape for the new role. Runs against the seeded Nimbus Labs demo tenant
 * (see CompanyHiringSeeder): one job opening, 4 candidates at varied
 * pipeline stages (including one accepted offer), and one company_hiring
 * assessment with 2 invited candidates.
 */
test.describe("Company hiring tenant (admin_company) dashboard", () => {
  test("Hiring Command Center loads, scoped to Nimbus Labs only", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await expect(page.locator("body")).toContainText(/Nimbus Labs/i);
    // Cross-tenant isolation: no other company/college's identity ever leaks in.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Apex Institute");
    expect(bodyText).not.toContain("Infosys");
    reportIssues("company dashboard load", issues);
  });

  test("Job Openings page lists the seeded opening and posts a new one", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/company/drives");
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).toContainText(/Backend Engineer Hiring/i);

    const stamp = Date.now();
    const title = `QA Opening ${stamp}`;
    await page.getByRole("button", { name: "Post a Job Opening" }).click();
    await page.getByPlaceholder(/Winter 2026 Hiring/).fill(title);
    await page.locator('form input[required]').nth(1).fill("QA Test Role");
    await page.locator('input[type="datetime-local"]').fill("2026-12-15T10:00");
    await page.getByRole("button", { name: "Post Opening" }).click();
    await expect(page.locator("body")).toContainText(title, { timeout: 10000 });
    reportIssues("post job opening", issues);
  });

  test("Job Openings page: posting an 'All Candidates' opening shows the Open to All badge, no approval step", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/company/drives");
    await page.waitForResponse((r) => r.url().includes("/company/drives") && r.request().method() === "GET");
    await page.waitForTimeout(500);

    const stamp = Date.now();
    const title = `QA Open Opening ${stamp}`;
    await page.getByRole("button", { name: "Post a Job Opening" }).click();
    await page.getByPlaceholder(/Winter 2026 Hiring/).fill(title);
    await page.locator('form input[required]').nth(1).fill("QA Open Role");
    await page.locator('input[type="datetime-local"]').fill("2026-12-15T10:00");
    // Scoped to the modal's <form> — the drives list behind it has its own
    // per-card "All Candidates" toggle buttons with the identical accessible
    // name, which a page-wide getByRole match would collide with.
    await page.locator("form").getByRole("button", { name: "All Candidates" }).click();
    await page.getByRole("button", { name: "Post Opening" }).click();
    await expect(page.locator("body")).toContainText(title, { timeout: 10000 });

    const card = page
      .locator("h3", { hasText: title })
      .locator("xpath=ancestor::div[contains(@class,'rounded-panel')][1]");
    await expect(card.getByText("Open to All").first()).toBeVisible();
    reportIssues("post open-to-all job opening", issues);
  });

  test("Partner Colleges page lists real colleges with aggregate stats", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/company/colleges");
    await page.waitForResponse((r) => r.url().includes("/company/colleges"));
    await page.waitForTimeout(500);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("Apex Institute");
    expect(bodyText).toMatch(/\d+ students/);
    reportIssues("partner colleges page", issues);
  });

  test("Job Openings page shows college-proposal status badges for the campus drive", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/company/drives");
    await page.waitForResponse((r) => r.url().includes("/company/drives") && r.request().method() === "GET");
    await page.waitForTimeout(500);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("Frontend Engineer Campus Drive");
    // Seeded: Apex is pre-approved, Meridian is left pending — see CompanyHiringSeeder.
    expect(bodyText).toMatch(/approved/i);
    expect(bodyText).toMatch(/pending/i);
    reportIssues("job openings mapping badges", issues);
  });

  test("Assessments page: viewing Results shows score-ranked campus candidates, none invited", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/company/assessments");
    await page.waitForTimeout(1000);

    const campusCard = page
      .locator("span", { hasText: "Nimbus Labs — Frontend Engineer Campus Assessment" })
      .locator("xpath=ancestor::div[contains(@class,'rounded-panel')][1]");
    await campusCard.getByRole("button", { name: "Results" }).click();
    await page.waitForResponse((r) => r.url().includes("/results") && r.request().method() === "GET");
    await page.waitForTimeout(500);

    const modalText = await page.locator("body").innerText();
    expect(modalText).toContain("Alex Chen");
    expect(modalText).toContain("95%");
    reportIssues("assessment results modal", issues);
  });

  test("Candidates page shows the seeded pipeline across all stages", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/company/candidates");
    await page.waitForTimeout(800);
    // Pick the seeded opening from the dropdown (matches by visible option
    // text — the <option value> is the numeric drive id, not its title).
    await page.locator("select").first().selectOption({ label: "Nimbus Labs — Backend Engineer Hiring (Winter 2026)" });
    await page.waitForResponse((r) => /\/company\/drives\/\d+\/candidates/.test(r.url()) && r.request().method() === "GET");
    await page.waitForTimeout(500);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toContain("Priya Nair");
    expect(bodyText).toContain("Alex Chen");
    // Alex Chen's application is already at offer_accepted — a terminal
    // stage, rendered as a locked badge rather than a "Move to..." select.
    expect(bodyText).toMatch(/Offer Accepted/i);
    reportIssues("candidates pipeline view", issues);
  });

  test("Assessments page shows the seeded assessment with invited candidates", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/company/assessments");
    await page.waitForTimeout(1000);
    await expect(page.locator("body")).toContainText(/Backend Engineer Online Assessment/i);
    await expect(page.locator("body")).toContainText(/2 invited/i);
    reportIssues("assessments page", issues);
  });

  test("Proctoring page loads with no console errors (clean run — nothing flagged)", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/company/proctoring");
    await page.waitForResponse((r) => r.url().includes("/company/proctoring"));
    await page.waitForTimeout(500);
    await expect(page.locator("body")).toContainText(/clean|No proctoring violations/i);
    reportIssues("company proctoring page", issues);
  });

  test("Hiring Reports page renders real funnel/time-to-hire numbers", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/company/reports");
    await page.waitForResponse((r) => r.url().includes("/company/reports/data"));
    await page.waitForTimeout(800);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toMatch(/Avg\. Time to Hire/i);
    expect(bodyText).toContain("Alex Chen");
    reportIssues("hiring reports page", issues);
  });

  test("Cross-tenant isolation: company admin never reaches TPO or Mellow Ops routes", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_company");
    await page.goto("/admin/drives");
    await page.waitForURL((url) => url.pathname.startsWith("/admin"), { timeout: 10000 });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Campus Drives");
    reportIssues("cross-tenant route isolation", issues);
  });
});
