import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MyStats } from "@/types/studentStats";
import { FocusAreasCard, RecentSubmissionsCard, SolvedBreakdownCard } from "@/components/dashboard/student/ProgressCards";

// jsdom has no IntersectionObserver (the portal kit's progress bars wait to scroll into view); every real browser does.
class InstantObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe(el: Element) {
    this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", InstantObserver);

afterEach(cleanup);

const stats = {
  solved: { total_solved: 142, easy: { solved: 80, total: 120 }, medium: { solved: 50, total: 140 }, hard: { solved: 12, total: 70 } },
  topic_mastery: [
    { topic: "Arrays", solved: 40, total: 60, accuracy: 88 },
    { topic: "Graphs", solved: 6, total: 35, accuracy: 52 },
    { topic: "Dynamic Programming", solved: 3, total: 40, accuracy: 38 },
    { topic: "Empty", solved: 0, total: 0, accuracy: 0 },
  ],
} as unknown as MyStats;

describe("SolvedBreakdownCard", () => {
  it("shows solved over total for each difficulty, and the total solved", () => {
    render(<SolvedBreakdownCard stats={stats} />);
    expect(screen.getByText("80 / 120")).toBeTruthy();
    expect(screen.getByText("50 / 140")).toBeTruthy();
    expect(screen.getByText("12 / 70")).toBeTruthy();
    expect(screen.getByText("142 solved")).toBeTruthy();
  });

  it("renders zeros, not a crash, before the stats arrive", () => {
    render(<SolvedBreakdownCard stats={null} />);
    expect(screen.getByText("0 solved")).toBeTruthy();
    expect(screen.getAllByText("0 / 0")).toHaveLength(3);
  });
});

describe("FocusAreasCard", () => {
  it("lists the weakest topics first, skips topics with nothing in the catalog, and names the one to start with", () => {
    render(<FocusAreasCard stats={stats} />);
    const names = screen.getAllByText(/Dynamic Programming|Graphs|Arrays|Empty/).map((n) => n.textContent);
    expect(names.indexOf("Dynamic Programming")).toBeLessThan(names.indexOf("Graphs"));
    expect(names.indexOf("Graphs")).toBeLessThan(names.indexOf("Arrays"));
    expect(screen.queryByText("Empty")).toBeNull();
    expect(screen.getByText("Start with Dynamic Programming")).toBeTruthy();
  });

  it("can leave out the callout where the page already says it", () => {
    render(<FocusAreasCard stats={stats} callout={false} />);
    expect(screen.queryByText(/Start with/)).toBeNull();
  });

  it("asks for a few solved problems when there is nothing to rank", () => {
    render(<FocusAreasCard stats={null} />);
    expect(screen.getByText(/Solve a few problems/)).toBeTruthy();
  });
});

describe("RecentSubmissionsCard", () => {
  const subs = [
    { id: 1, problem_title: "Two Sum", problem_slug: "two-sum", difficulty: "easy", language: "python", status: "accepted", runtime_ms: 42, memory_kb: 9800, submitted_at: "2026-10-27T10:00:00Z" },
    { id: 2, problem_title: "Word Ladder", problem_slug: "word-ladder", difficulty: "hard", language: "cpp", status: "wrong_answer", runtime_ms: null, memory_kb: null, submitted_at: "2026-10-26T10:00:00Z" },
  ];

  it("opens each problem, words the verdict, and shows a dash where there is no runtime", () => {
    render(<RecentSubmissionsCard submissions={subs} seeAll={{ href: "/dashboard/reports", label: "Full history" }} />);
    expect(screen.getByRole("link", { name: "Two Sum" }).getAttribute("href")).toBe("/dashboard/practice/view?slug=two-sum");
    expect(screen.getByText("wrong answer")).toBeTruthy();
    const row = screen.getByRole("link", { name: "Word Ladder" }).closest("tr") as HTMLElement;
    expect(within(row).getAllByText("—")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Full history/ }).getAttribute("href")).toBe("/dashboard/reports");
  });

  it("says so when there are none, and while loading", () => {
    const { rerender } = render(<RecentSubmissionsCard submissions={[]} />);
    expect(screen.getByText(/No submissions yet/)).toBeTruthy();
    rerender(<RecentSubmissionsCard submissions={[]} loading />);
    expect(screen.getByText("Loading...")).toBeTruthy();
  });
});
