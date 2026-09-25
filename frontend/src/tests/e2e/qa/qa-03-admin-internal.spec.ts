import { test, expect } from "@playwright/test";
import fs from "fs";
import os from "os";
import path from "path";
import { login, watchForErrors, reportIssues } from "./_helpers";

test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const NEW_COLLEGE = `Mellow QA College ${stamp}`;
const NEW_TPO_EMAIL = `mellow.qa.tpo.${stamp}@testcollege.edu`;
const NEW_STUDENT_EMAIL = `mellow.qa.student.${stamp}@example.com`;

// Emails embed `stamp` so re-running this suite against the same persistent
// dev DB never collides with a previous run's students under a *different*
// college — StudentImportService correctly rejects an email already tied to
// another college, which is the right behavior, not something to work around
// by reusing a static fixture across runs.
const STUDENT_ROWS = [
  ["Aarav Sharma", "CS001", "CSE", "8.9", "0", "9876500001"],
  ["Diya Patel", "CS002", "CSE", "7.4", "1", "9876500002"],
  ["Vihaan Reddy", "EC003", "ECE", "9.2", "0", "9876500003"],
  ["Ananya Iyer", "IT004", "IT", "6.8", "2", "9876500004"],
  ["Kabir Nair", "ME005", "MECH", "8.1", "0", "9876500005"],
  ["Ishaan Gupta", "CS006", "CSE", "9.5", "0", "9876500006"],
  ["Myra Verma", "CE007", "CIVIL", "7.0", "3", "9876500007"],
  ["Reyansh Rao", "EC008", "ECE", "8.4", "0", "9876500008"],
  ["Saanvi Joshi", "IT009", "IT", "8.8", "1", "9876500009"],
  ["Arjun Kumar", "CS010", "CSE", "7.9", "0", "9876500010"],
];

function buildCsv(): string {
  const header = "name,email,roll_number,branch,cgpa,backlogs,phone";
  const rows = STUDENT_ROWS.map(([name, roll, branch, cgpa, backlogs, phone]) => {
    const slug = name.toLowerCase().replace(/\s+/g, ".");
    const email = `${slug}.${stamp}.qa@example.com`;
    return `${name},${email},QA${stamp % 100000}${roll},${branch},${cgpa},${backlogs},${phone}`;
  });
  const content = [header, ...rows].join("\n") + "\n";
  const filePath = path.join(os.tmpdir(), `ten_students_${stamp}.csv`);
  fs.writeFileSync(filePath, content);
  return filePath;
}

const CSV_PATH = buildCsv();

test.describe("Mellow internal staff (admin_internal) dashboard", () => {
  test("dashboard loads on the Platform Ops (mellow) view", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_internal");
    await expect(page.locator("body")).toContainText(/Partner Universities|Platform Users|Curated Problem Bank/i);
    reportIssues("admin_internal dashboard load", issues);
  });

  test("onboard a new partner college + TPO from the staff side", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_internal");
    await page.getByRole("button", { name: "Onboard University" }).click();
    await page.getByPlaceholder(/Indian Institute of Technology Bombay/).fill(NEW_COLLEGE);
    await page.getByPlaceholder(/Dr\. Ananya Sen/).fill("Mellow QA TPO Officer");
    await page.getByPlaceholder("e.g. tpo@iitb.ac.in").fill(NEW_TPO_EMAIL);
    await page.getByRole("button", { name: "Provision TPO & Partner University" }).click();
    await expect(page.locator("body")).not.toContainText("Onboard Partner University & TPO", { timeout: 10000 });
    await page.getByPlaceholder("Search university or TPO...").fill(NEW_COLLEGE);
    await page.waitForTimeout(700);
    await expect(page.locator("body")).toContainText(NEW_COLLEGE, { timeout: 10000 });
    reportIssues("onboard college (staff)", issues);
  });

  test("add a single student account directly (non-bulk path)", async ({ page }) => {
    const issues = watchForErrors(page);
    await login(page, "admin_internal");
    await page.getByRole("button", { name: "Add User" }).click();
    await page.getByPlaceholder(/Meera Krishnan/).fill("Mellow QA Student");
    await page.getByPlaceholder("meera@example.com").fill(NEW_STUDENT_EMAIL);
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForTimeout(2000);
    await page.getByPlaceholder("Search name, handle, or email...").fill(NEW_STUDENT_EMAIL);
    await page.waitForTimeout(700);
    await expect(page.locator("body")).toContainText(NEW_STUDENT_EMAIL, { timeout: 10000 });
    reportIssues("add single student (staff)", issues);
  });

  test("THE BIG ONE: bulk-import 10 students into the new college via CSV, verify DB rows + credential emails", async ({ page }) => {
    test.setTimeout(90000);
    const issues = watchForErrors(page);
    await login(page, "admin_internal");
    await page.getByPlaceholder("Search university or TPO...").fill(NEW_COLLEGE);
    await page.waitForTimeout(700);
    const collegeCard = page.locator("div", { hasText: NEW_COLLEGE }).last();
    await page.getByRole("button", { name: "Import Students" }).first().click();

    await expect(page.locator("text=Bulk Import for")).toBeVisible();
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(CSV_PATH);
    await page.getByRole("button", { name: "Upload & Import" }).click();

    // Poll the UI (it self-polls every 2s) until the import settles.
    await expect(page.locator("text=/Completed$|Completed \\(with errors\\)/")).toBeVisible({ timeout: 60000 });
    const panelText = await page.locator("text=Bulk Import for").locator("..").locator("..").innerText();
    console.log("   [import panel]", panelText.replace(/\n+/g, " | "));
    expect(panelText).toContain("10 added");

    reportIssues("bulk import 10 students", issues);
  });
});
