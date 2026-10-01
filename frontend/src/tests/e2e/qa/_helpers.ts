import { Page, expect } from "@playwright/test";

export const DEMO = {
  superadmin: { email: "aryan@mellow.ai", password: "super_secure_key_2026", home: "/superadmin" },
  admin_internal: { email: "priya@mellow.ai", password: "mellow_staff_ops_99", home: "/admin" },
  admin_tpo: { email: "tpo@apex.edu.in", password: "apex_tpo_placement_2026", home: "/admin" },
  admin_company: { email: "hiring@nimbuslabs.example.com", password: "nimbus_hiring_demo_26", home: "/admin" },
  user: { email: "alex.chen@student.apex.edu", password: "alex_coder_codeforge", home: "/dashboard" },
};

/** Collects console errors + page errors + failed requests for the life of a page. */
export function watchForErrors(page: Page) {
  const issues: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Next.js dev overlay noise / expected 401s from useAuthGuard probing are not real bugs
      if (text.includes("Failed to load resource") && text.includes("401")) return;
      issues.push(`[console.error] ${text}`);
    }
  });
  page.on("pageerror", (err) => issues.push(`[pageerror] ${err.message}`));
  page.on("requestfailed", (req) => {
    // Next.js RSC prefetch requests routinely get aborted when a real
    // navigation supersedes them — benign, not an app bug.
    if (req.url().includes("_rsc=") && req.failure()?.errorText === "net::ERR_ABORTED") return;
    issues.push(`[requestfailed] ${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });
  return issues;
}

export async function login(page: Page, role: keyof typeof DEMO) {
  const creds = DEMO[role];
  // superadmin/admin_internal are Mellow-internal-only roles — they no
  // longer have any UI affordance on the customer-facing /login page (see
  // that page's own comment on LoginRole), so exercise the real path staff
  // actually use: the unlisted /mellow-internal sign-in.
  const isInternal = role === "superadmin" || role === "admin_internal";
  await page.goto(isInternal ? "/mellow-internal" : "/login");
  await page.getByPlaceholder(isInternal ? "you@mellowvault.com" : "name@domain.com").fill(creds.email);
  await page.getByPlaceholder("Enter your password").fill(creds.password);
  await page
    .getByRole("button", { name: /Enter Internal Console|Enter Admin Portal|Launch Candidate Arena/ })
    .click();
  await page.waitForURL((url) => url.pathname.startsWith(creds.home), { timeout: 15000 });
  await expect(page.locator("body")).toBeVisible();
}

export async function logout(page: Page) {
  await page.evaluate(() => localStorage.clear());
}

export function reportIssues(label: string, issues: string[]) {
  if (issues.length === 0) {
    console.log(`  OK — no console/request errors during: ${label}`);
  } else {
    console.log(`  !! ISSUES during: ${label}`);
    for (const i of issues) console.log(`     ${i}`);
  }
}
