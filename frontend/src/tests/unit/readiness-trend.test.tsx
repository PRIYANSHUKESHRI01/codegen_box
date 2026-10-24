import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InactivityNotice } from "@/components/dashboard/student/InactivityNotice";
import { ReadinessBreakdown } from "@/components/dashboard/student/ReadinessBreakdown";
import { ReadinessTrend } from "@/components/dashboard/student/ReadinessTrend";
import type { ReadinessDecay, ReadinessHistory } from "@/types/studentStats";

afterEach(cleanup);

const decay = (over: Partial<ReadinessDecay> = {}): ReadinessDecay => ({
  enabled: true,
  tracking: true,
  points: 4,
  missed_days: 4,
  window_days: 21,
  per_day: 1,
  free_days: 0,
  practised_today: false,
  last_active: "2026-10-20",
  idle_days: 2,
  max_points: 21,
  ...over,
});

const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;

const history = (over: Partial<ReadinessHistory["summary"]> = {}, scores = [30, 34, 41, 47, 55, 61]): ReadinessHistory => ({
  points: scores.map((score, i) => ({ date: day(10 + i), score, base_score: score + (i === scores.length - 1 ? 3 : 0), penalty: i === scores.length - 1 ? 3 : 0, active: i % 2 === 0 })),
  summary: { score: scores[scores.length - 1], threshold: 60, tracking_since: day(10), best: Math.max(...scores), first_crossed_on: day(15), change_7d: 31, days_to_threshold: null, ...over },
});

/** The chart itself — lucide icons are SVGs too. */
const chartSvg = () => screen.getByRole("img", { name: /Readiness score over/ }) as unknown as SVGSVGElement;

describe("ReadinessTrend", () => {
  it("draws the climb against the Vault line and says what happened", () => {
    render(<ReadinessTrend history={history()} exitThreshold={55} />);

    expect(screen.getByRole("heading", { name: /day by day/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /from 30 to 61.*Vault line is 60/ })).toBeTruthy();
    expect(screen.getByText("Vault line · 60")).toBeTruthy();
    expect(screen.getByText("+31")).toBeTruthy();
    expect(screen.getByText("You're past the line")).toBeTruthy();
    // 6 days on a 14-day-minimum axis, one dot a day.
    expect(chartSvg().querySelectorAll("circle")).toHaveLength(6);
  });

  it("promises a date only when the API found a real trend", () => {
    const { rerender } = render(<ReadinessTrend history={history({ score: 26, days_to_threshold: 17, first_crossed_on: null }, [10, 14, 18, 22, 26])} />);
    expect(screen.getByText("~17 days to 60")).toBeTruthy();
    expect(screen.getByText("Not yet")).toBeTruthy();

    rerender(<ReadinessTrend history={history({ score: 26, days_to_threshold: null, first_crossed_on: null }, [10, 14, 18, 22, 26])} />);
    expect(screen.getByText("Keep going to see a trend")).toBeTruthy();
  });

  it("shows a day's score and what was lost to missed days on hover", () => {
    render(<ReadinessTrend history={history()} />);

    const svg = chartSvg();
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 640, height: 190, right: 640, bottom: 190, x: 0, y: 0, toJSON: () => ({}) });
    // jsdom has no PointerEvent, so fireEvent drops clientX; a MouseEvent carrying the pointer event's name keeps it.
    act(() => {
      svg.dispatchEvent(new MouseEvent("pointermove", { clientX: 640, bubbles: true }));
    });

    const tip = screen.getByRole("status");
    expect(tip.textContent).toContain("61");
    expect(tip.textContent).toContain("64 earned − 3 for missed days");

    fireEvent.pointerLeave(svg);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers the same numbers as a table", () => {
    render(<ReadinessTrend history={history()} />);

    fireEvent.click(screen.getByRole("button", { name: /show as table/i }));

    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(7); // header + six days
    expect(screen.getByText("−3")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Readiness score over/ })).toBeNull();
  });

  it("is honest on day one: a single point and an invitation to come back", () => {
    render(<ReadinessTrend history={history({ change_7d: null, best: 12, first_crossed_on: null, score: 12 }, [12])} />);

    expect(screen.getByText(/come back tomorrow/i)).toBeTruthy();
    expect(chartSvg().querySelectorAll("circle")).toHaveLength(1);
    expect(chartSvg().querySelector("path.stroke-accent-primary")).toBeNull();
  });
});

describe("InactivityNotice", () => {
  it("says what missed days cost and that today is not yet covered", () => {
    render(<InactivityNotice decay={decay()} score={52} baseScore={56} />);

    expect(screen.getByText(/cost you 4 points \(56 earned → 52\)/)).toBeTruthy();
    expect(screen.getByText(/skipped 4 of the last 21 days/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /practise now/i }).getAttribute("href")).toBe("/dashboard/practice");
  });

  it("tells a student who is back today that nothing more is lost", () => {
    render(<InactivityNotice decay={decay({ practised_today: true })} score={52} baseScore={56} />);

    expect(screen.getByText(/nothing more is lost today/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /practise now/i })).toBeNull();
  });

  it("celebrates a clean record and states the price of a missed day", () => {
    render(<InactivityNotice decay={decay({ points: 0, missed_days: 0, practised_today: true })} score={60} baseScore={60} />);

    expect(screen.getByText("No points lost to missed days")).toBeTruthy();
    expect(screen.getByText(/takes 1 point off your score/)).toBeTruthy();
  });

  it("renders nothing before tracking begins, when switched off, or against an older API", () => {
    expect(render(<InactivityNotice decay={decay({ tracking: false })} score={50} />).container.firstChild).toBeNull();
    expect(render(<InactivityNotice decay={decay({ enabled: false })} score={50} />).container.firstChild).toBeNull();
    expect(render(<InactivityNotice decay={undefined} score={50} />).container.firstChild).toBeNull();
  });
});

describe("ReadinessBreakdown missed-days row", () => {
  const comps = [{ key: "interview_performance", label: "AI Interviews", score: 80, weight_percent: 20, contribution: 16 }];

  it("adds a red row for the points lost, and leaves a clean student's breakdown untouched", () => {
    const { rerender } = render(<ReadinessBreakdown components={comps} nextSteps={[]} decay={decay()} />);
    const row = screen.getByTestId("decay-row");
    expect(row.textContent).toContain("Missed days");
    expect(row.textContent).toContain("4 of 21 days");
    expect(row.textContent).toContain("−4");

    rerender(<ReadinessBreakdown components={comps} nextSteps={[]} decay={decay({ points: 0, missed_days: 0 })} />);
    expect(screen.queryByTestId("decay-row")).toBeNull();

    rerender(<ReadinessBreakdown components={comps} nextSteps={[]} />);
    expect(screen.queryByTestId("decay-row")).toBeNull();
  });

  it("keeps the compact dashboard card to the row, without the explanation", () => {
    render(<ReadinessBreakdown components={comps} nextSteps={[]} decay={decay()} compact />);

    expect(screen.getByTestId("decay-row")).toBeTruthy();
    expect(screen.queryByText(/stops growing the day you practise/)).toBeNull();
  });
});
