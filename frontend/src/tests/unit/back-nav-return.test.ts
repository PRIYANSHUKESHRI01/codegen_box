import { describe, expect, it } from "vitest";
import { RETURN_TO_PARAM, safeReturnTo, withReturnTo } from "@/lib/backNav";
import { solveHref } from "@/components/practice/SolveButton";
import { CODING_PROBLEMS_ANCHOR, companyPageSearch } from "@/lib/companyPrep";

describe("safeReturnTo — a problem opened from a company's PYQ page goes back there", () => {
  it("accepts a company page, with its filters and the problems anchor", () => {
    const from = "/dashboard/company-prep/view?company=hcltech&round=Hands-on+Coding+Assessment&year=2024#coding-problems";
    expect(safeReturnTo(from)).toEqual({ href: from, label: "Company Prep" });
  });

  it("accepts the hub too, and labels it as the hub", () => {
    expect(safeReturnTo("/dashboard/company-prep?category=Coding")).toEqual({ href: "/dashboard/company-prep?category=Coding", label: "Company PYQs" });
    expect(safeReturnTo("/dashboard/company-prep")).toEqual({ href: "/dashboard/company-prep", label: "Company PYQs" });
  });

  it("ignores anything that is not one of those pages — nobody can be sent off-site or to another area through the address bar", () => {
    const hostile = [
      "https://evil.example/dashboard/company-prep/view",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "/admin",
      "/superadmin",
      "/dashboard/billing",
      "/dashboard/company-prep/../billing",
      "/dashboard/company-prep/view/../../../admin",
      "/dashboard/company-prep-evil",
      "/dashboard/company-prep/view?company=x#bad fragment",
      "/dashboard/company-prep/view?company=x#<script>",
      "/dashboard/company-prep/view?company=x\r\nSet-Cookie: a=b",
      "/dashboard/company-prep/view?company=x y",
      "dashboard/company-prep/view",
      "",
      null,
      undefined,
    ];
    for (const value of hostile) expect(safeReturnTo(value as string | null | undefined), String(value)).toBeNull();
  });

  it("ignores an absurdly long value", () => {
    expect(safeReturnTo(`/dashboard/company-prep/view?company=${"a".repeat(500)}`)).toBeNull();
  });
});

describe("the address that carries the return trip", () => {
  it("withReturnTo appends it, encoded, to a link that already has a query", () => {
    expect(withReturnTo("/dashboard/practice/view?slug=two-sum", "/dashboard/company-prep/view?company=a&year=2024#coding-problems")).toBe(
      "/dashboard/practice/view?slug=two-sum&from=%2Fdashboard%2Fcompany-prep%2Fview%3Fcompany%3Da%26year%3D2024%23coding-problems"
    );
  });

  it("leaves a link alone when there is nowhere to return to (the Arena's own Solve buttons)", () => {
    expect(withReturnTo("/dashboard/practice/view?slug=two-sum")).toBe("/dashboard/practice/view?slug=two-sum");
    expect(withReturnTo("/dashboard/practice/view?slug=two-sum", null)).toBe("/dashboard/practice/view?slug=two-sum");
    expect(solveHref("two-sum")).toBe("/dashboard/practice/view?slug=two-sum");
  });

  it("round-trips: what the company page puts in the link is exactly what the editor reads back", () => {
    const returnTo = `/dashboard/company-prep/view${companyPageSearch("tcs-digital", { round: "Technical & HR Interview", category: "Coding", year: 2024 })}#${CODING_PROBLEMS_ANCHOR}`;
    const link = new URL(solveHref("two-sum", returnTo), "http://localhost");

    expect(link.pathname).toBe("/dashboard/practice/view");
    expect(link.searchParams.get("slug")).toBe("two-sum");

    const back = safeReturnTo(link.searchParams.get(RETURN_TO_PARAM));
    expect(back).not.toBeNull();

    const target = new URL(back!.href, "http://localhost");
    expect(target.pathname).toBe("/dashboard/company-prep/view");
    expect(target.searchParams.get("company")).toBe("tcs-digital");
    expect(target.searchParams.get("round")).toBe("Technical & HR Interview");
    expect(target.searchParams.get("category")).toBe("Coding");
    expect(target.searchParams.get("year")).toBe("2024");
    expect(target.hash).toBe("#coding-problems");
  });
});

describe("companyPageSearch", () => {
  it("is the company alone when nothing is filtered, and adds only what is selected", () => {
    expect(companyPageSearch("hcltech", { round: null, category: null, year: null })).toBe("?company=hcltech");
    expect(companyPageSearch("hcltech", { round: null, category: "HR", year: 2023 })).toBe("?company=hcltech&category=HR&year=2023");
  });
});
