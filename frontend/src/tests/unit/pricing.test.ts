import { describe, expect, it } from "vitest";
import { formatInr, hasDiscount, limitBullets, monthlyEquivalent, previewSalePrice, termSuffix } from "@/lib/pricing";
import type { PlanEntitlements } from "@/types/pricing";

const e = (over: Partial<PlanEntitlements> = {}): PlanEntitlements => ({
  practice_problems_per_day: null,
  mock_interviews_per_day: null,
  free_trial_uses: null,
  drive_access: true,
  hackathon_access: true,
  vault_access: true,
  project_lab_access: true,
  workspace_hours_per_month: 80,
  active_projects: 3,
  ...over,
});

describe("pricing helpers", () => {
  it("formats rupees with Indian digit grouping", () => {
    expect(formatInr(0)).toBe("₹0");
    expect(formatInr(1199)).toBe("₹1,199");
    expect(formatInr(4999)).toBe("₹4,999");
    expect(formatInr(149000)).toBe("₹1,49,000");
    expect(formatInr(2999.4)).toBe("₹2,999");
  });

  it("names the billing term", () => {
    expect(termSuffix({ term_unit: "year" })).toBe("/ year");
    expect(termSuffix({ term_unit: "month" })).toBe("/ month");
    expect(termSuffix({ term_unit: null })).toBe("");
  });

  it("only calls it a discount when something is actually taken off", () => {
    expect(hasDiscount({ discount_percent: 40, discount_amount: 800 })).toBe(true);
    expect(hasDiscount({ discount_percent: 0, discount_amount: 0 })).toBe(false);
    expect(hasDiscount({ discount_percent: 40, discount_amount: 0 })).toBe(false);
  });

  describe("previewSalePrice — must agree with the server's Plan::discountFor", () => {
    it("rounds the way the server does", () => {
      expect(previewSalePrice(1999, 40)).toEqual({ discountAmount: 800, salePrice: 1199 });
      expect(previewSalePrice(4999, 40)).toEqual({ discountAmount: 2000, salePrice: 2999 });
    });

    it("handles no discount, a free price and silly percentages", () => {
      expect(previewSalePrice(4999, 0)).toEqual({ discountAmount: 0, salePrice: 4999 });
      expect(previewSalePrice(0, 40)).toEqual({ discountAmount: 0, salePrice: 0 });
      expect(previewSalePrice(4999, -5)).toEqual({ discountAmount: 0, salePrice: 4999 });
      expect(previewSalePrice(4999, 250)).toEqual({ discountAmount: 4999, salePrice: 0 });
    });
  });

  describe("monthlyEquivalent", () => {
    it("spreads a yearly price over twelve months", () => {
      expect(monthlyEquivalent({ sale_price: 1199, term_days: 365, is_free: false })).toBe(100);
      expect(monthlyEquivalent({ sale_price: 2999, term_days: 365, is_free: false })).toBe(250);
    });

    it("has nothing to say for a free plan or one already billed monthly", () => {
      expect(monthlyEquivalent({ sale_price: 0, term_days: null, is_free: true })).toBeNull();
      expect(monthlyEquivalent({ sale_price: 399, term_days: 30, is_free: false })).toBeNull();
      expect(monthlyEquivalent({ sale_price: 399, term_days: null, is_free: false })).toBeNull();
    });
  });

  describe("limitBullets — the promises come from the plan's real limits", () => {
    it("reads the free plan as one try of everything and one problem a day", () => {
      const b = limitBullets(e({ practice_problems_per_day: 1, free_trial_uses: 1 }));
      expect(b.practice).toBe("Solve 1 coding problem every day");
      expect(b.interviews).toMatch(/once/);
      expect(b.interviews).toMatch(/AI mock interview/);
    });

    it("reads Expert as 10 problems and 3 AI interviews a day", () => {
      const b = limitBullets(e({ practice_problems_per_day: 10, mock_interviews_per_day: 3 }));
      expect(b.practice).toBe("Solve 10 coding problems every day");
      expect(b.interviews).toBe("3 AI mock interviews per day, scored instantly");
    });

    it("reads Grandmaster as unlimited problems and 10 AI interviews a day", () => {
      const b = limitBullets(e({ practice_problems_per_day: null, mock_interviews_per_day: 10 }));
      expect(b.practice).toBe("Unlimited coding problems — no daily cap");
      expect(b.interviews).toBe("10 AI mock interviews per day, scored instantly");
    });

    it("follows the numbers if they change", () => {
      expect(limitBullets(e({ practice_problems_per_day: 25, mock_interviews_per_day: null })).practice).toBe("Solve 25 coding problems every day");
      expect(limitBullets(e({ mock_interviews_per_day: null })).interviews).toBe("Unlimited AI mock interviews, scored instantly");
    });
  });
});
