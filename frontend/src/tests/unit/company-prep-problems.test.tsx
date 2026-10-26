import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const prefetch = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, prefetch }) }));

const prefetchProblem = vi.fn();
const warmUpEditor = vi.fn();
vi.mock("@/lib/problemPrefetch", () => ({ prefetchProblem: (slug: string) => prefetchProblem(slug) }));
vi.mock("@/lib/editorWarmup", () => ({ warmUpEditor: () => warmUpEditor() }));

import { RecommendedProblems } from "@/components/company-prep/RecommendedProblems";
import { solveHref } from "@/components/practice/SolveButton";
import { curatedPracticeHref } from "@/lib/companyPrep";
import type { CompanyPrepDetail } from "@/types/companyPrep";

type P = CompanyPrepDetail["recommended_problems"][number];
const prob = (slug: string, over: Partial<P> = {}): P => ({ problem_slug: slug, topic_tag: "Arrays", priority: 1, title: slug.replace(/-/g, " "), difficulty: "easy", available: true, solved: false, ...over });

const PROBLEMS: P[] = [
  prob("two-sum", { title: "Two Sum", priority: 1, solved: true }),
  prob("maximum-subarray", { title: "Maximum Subarray", difficulty: "medium", priority: 2 }),
  prob("ghost-problem", { title: null, difficulty: null, available: false, priority: 3 }),
];

beforeEach(() => {
  vi.useFakeTimers();
  push.mockReset();
  prefetch.mockReset();
  prefetchProblem.mockReset();
  warmUpEditor.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("curatedPracticeHref", () => {
  it("filters the Arena to the company's set, the way the drive Prepare screen does", () => {
    expect(curatedPracticeHref(["two-sum", "3sum"], "TCS (Tata Consultancy Services)")).toBe("/dashboard/practice?slugs=two-sum,3sum&company=TCS%20(Tata%20Consultancy%20Services)");
  });

  it("falls back to the plain Arena when there is nothing to curate", () => {
    expect(curatedPracticeHref([], "Acme")).toBe("/dashboard/practice");
    expect(curatedPracticeHref(["", "  "], "Acme")).toBe("/dashboard/practice");
  });
});

describe("solveHref", () => {
  it("is the address of the code editor — there is no /dashboard/practice/<slug> page in the static export (that was the 404)", () => {
    expect(solveHref("two-sum")).toBe("/dashboard/practice/view?slug=two-sum");
  });
});

describe("company recommended problems", () => {
  it("points every available problem at the code editor for that exact slug", () => {
    render(<RecommendedProblems problems={PROBLEMS} companyName="Acme" />);

    expect(screen.getByRole("link", { name: /Solve Two Sum/ }).getAttribute("href")).toBe("/dashboard/practice/view?slug=two-sum");
    expect(screen.getByRole("link", { name: /Solve Maximum Subarray/ }).getAttribute("href")).toBe("/dashboard/practice/view?slug=maximum-subarray");
    for (const link of screen.getAllByRole("link")) expect(link.getAttribute("href")).not.toMatch(/^\/dashboard\/practice\/[^v?]/);
  });

  it("a problem that isn't in the catalogue is shown but is not a link", () => {
    render(<RecommendedProblems problems={PROBLEMS} companyName="Acme" />);

    expect(screen.getByText("ghost-problem")).toBeTruthy();
    expect(screen.getByText(/Not in the catalogue yet/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /ghost-problem/ })).toBeNull();
  });

  it("Practice in Arena opens the Arena filtered to this company's problems only", () => {
    render(<RecommendedProblems problems={PROBLEMS} companyName="Acme Corp" />);

    expect(screen.getByRole("link", { name: /Practice in Arena/ }).getAttribute("href")).toBe("/dashboard/practice?slugs=two-sum,maximum-subarray&company=Acme%20Corp");
  });

  it("shows this student's progress and marks solved problems", () => {
    render(<RecommendedProblems problems={PROBLEMS} companyName="Acme" />);

    expect(screen.getByText("1/2 solved")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Problems solved" }).getAttribute("aria-valuenow")).toBe("1");
    expect(screen.getByRole("link", { name: /Solve Two Sum \(already solved\)/ }).textContent).toContain("Solve again");
    expect(screen.getByRole("link", { name: /Solve Maximum Subarray$/ }).textContent).toContain("Solve");
  });

  it("a click opens the editor through the resilient navigator and answers at once with 'Opening…'", () => {
    render(<RecommendedProblems problems={PROBLEMS} companyName="Acme" />);

    fireEvent.click(screen.getByRole("link", { name: /Solve Maximum Subarray/ }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/dashboard/practice/view?slug=maximum-subarray");
    expect(screen.getByText("Opening…")).toBeTruthy();
    // …and nothing else can be started while that is happening
    fireEvent.click(screen.getByRole("link", { name: /Solve Two Sum/ }));
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("a ctrl/cmd-click is left to the browser (open in a new tab), not hijacked", () => {
    render(<RecommendedProblems problems={PROBLEMS} companyName="Acme" />);

    fireEvent.click(screen.getByRole("link", { name: /Solve Maximum Subarray/ }), { ctrlKey: true });
    fireEvent.click(screen.getByRole("link", { name: /Solve Maximum Subarray/ }), { metaKey: true });

    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByText("Opening…")).toBeNull();
  });

  it("starts fetching the problem and the editor as soon as the pointer is over a card", () => {
    render(<RecommendedProblems problems={PROBLEMS} companyName="Acme" />);

    fireEvent.pointerEnter(screen.getByRole("link", { name: /Solve Maximum Subarray/ }));

    expect(prefetchProblem).toHaveBeenCalledWith("maximum-subarray");
    expect(warmUpEditor).toHaveBeenCalled();
    expect(prefetch).toHaveBeenCalledWith("/dashboard/practice/view?slug=maximum-subarray");
  });

  it("stops saying 'Opening…' if the editor never opens", () => {
    render(<RecommendedProblems problems={PROBLEMS} companyName="Acme" />);

    fireEvent.click(screen.getByRole("link", { name: /Solve Maximum Subarray/ }));
    expect(screen.getByText("Opening…")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(12_100);
    });
    expect(screen.queryByText("Opening…")).toBeNull();
  });

  it("when given the company page to return to, every card link and the click-through carry it, so the editor's Back leads back here", () => {
    const returnTo = "/dashboard/company-prep/view?company=acme&year=2024#coding-problems";
    render(<RecommendedProblems problems={PROBLEMS} companyName="Acme" returnTo={returnTo} />);

    const expected = "/dashboard/practice/view?slug=maximum-subarray&from=" + encodeURIComponent(returnTo);
    expect(screen.getByRole("link", { name: /Solve Maximum Subarray/ }).getAttribute("href")).toBe(expected);

    fireEvent.click(screen.getByRole("link", { name: /Solve Maximum Subarray/ }));
    expect(push).toHaveBeenCalledWith(expected);
  });

  it("renders nothing when a company has no recommended problems", () => {
    const { container } = render(<RecommendedProblems problems={[]} companyName="Acme" />);
    expect(container.innerHTML).toBe("");
  });

  it("an API that doesn't send `solved` yet just shows no progress marks", () => {
    const legacy = PROBLEMS.map(({ solved: _solved, ...rest }) => rest) as P[];
    render(<RecommendedProblems problems={legacy} companyName="Acme" />);

    expect(screen.getByText("0/2 solved")).toBeTruthy();
    expect(screen.queryByText("Solved")).toBeNull();
  });
});
