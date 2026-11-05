import { test, expect, type Page } from "@playwright/test";
import { landing } from "../unit/landingFixture";

/**
 * The four content pages (/colleges, /students, /rewards, /vault) read GET /api/public/landing. These tests answer that one request
 * themselves, with values that are NOT the pages' defaults (a 65% Vault bar, a 9:30 PM contest), so a pass proves the pages quote the
 * backend and that they do not depend on a database being up.
 */
async function openPage(page: Page, path: string, data: unknown = landing()) {
  await page.route("**/public/landing", (route) => (data ? route.fulfill({ json: data }) : route.fulfill({ status: 503, json: { message: "down" } })));
  await page.goto(path);
}

test.describe("Rewards page", () => {
  test("shows the live prize, the server's contest hour and the rules", async ({ page }) => {
    await openPage(page, "/rewards");
    await expect(page.locator("h1")).toContainText("Win vouchers");
    await expect(page.getByText("Burger King voucher")).toBeVisible();
    await expect(page.locator("body")).toContainText("9:30 PM IST");

    await page.getByRole("link", { name: "Read the rules" }).click();
    await expect(page.locator("#rules")).toBeInViewport();
    await expect(page.locator("#rules")).toContainText("lower total penalty ranks higher");
  });

  test("joins free: the main action goes to sign-up", async ({ page }) => {
    await openPage(page, "/rewards");
    await expect(page.getByRole("link", { name: /Join free and play tonight/ }).first()).toHaveAttribute("href", "/signup");
  });
});

test.describe("Mellow Vault page", () => {
  test("is short, quotes the server's bar and its slider opens the lock exactly there", async ({ page }) => {
    await openPage(page, "/vault");
    await expect(page.locator("h1")).toContainText("Reach 65% readiness");

    const slider = page.getByRole("slider", { name: /Your readiness score/i });
    await slider.fill("64");
    await expect(page.getByRole("status")).toContainText("Mellow Vault is locked");
    await slider.fill("65");
    await expect(page.getByRole("status")).toContainText("Mellow Vault is unlocked");

    // an intro, three steps, the student's controls and one close
    await expect(page.locator("main > section")).toHaveCount(4);
  });

  test("opens Mellow Vault in a new tab", async ({ page }) => {
    await openPage(page, "/vault");
    const link = page.getByRole("link", { name: /Visit Mellow Vault/ });
    await expect(link).toHaveAttribute("href", "https://mellowvault.com");
    await expect(link).toHaveAttribute("target", "_blank");
  });
});

test.describe("Colleges page", () => {
  test("promises the whole season, opens the demo form and shows the departments from the backend", async ({ page }) => {
    await openPage(page, "/colleges");
    await expect(page.locator("h1")).toContainText("Run your entire placement season");
    await expect(page.locator("#depts-heading").locator("xpath=ancestor::section")).toContainText("Engineering");

    await page.getByRole("button", { name: /Book a demo/i }).first().click();
    await expect(page.getByText("Tell us a bit about your college")).toBeVisible();
  });

  test("invents no customers or sample figures", async ({ page }) => {
    await openPage(page, "/colleges");
    await expect(page.getByText(/Nova Systems|Quantica|Sample data/)).toHaveCount(0);
  });
});

test.describe("Students page", () => {
  test("promises the student's side and leads on to the rewards and the Vault pages", async ({ page }) => {
    await openPage(page, "/students");
    await expect(page.locator("h1")).toContainText("Get placement-ready");
    await expect(page.getByRole("link", { name: /Create student account/ }).first()).toHaveAttribute("href", "/signup");

    const next = page.locator("#next-heading").locator("xpath=ancestor::section");
    await expect(next).toContainText("Burger King");
    await next.getByRole("link", { name: /See how the Vault works/ }).click();
    await expect(page).toHaveURL(/\/vault$/);
  });
});

test.describe("when the API is down", () => {
  for (const path of ["/colleges", "/students", "/rewards", "/vault"]) {
    test(`${path} still reads`, async ({ page }) => {
      await openPage(page, path, null);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/undefined|NaN/);
    });
  }
});
