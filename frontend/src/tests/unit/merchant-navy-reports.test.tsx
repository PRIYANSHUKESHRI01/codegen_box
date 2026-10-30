import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const net = vi.hoisted(() => ({ get: vi.fn() }));
const pdf = vi.hoisted(() => ({ downloadStudyReport: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/dashboard/merchant-navy/reports", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: net.get } };
});
vi.mock("@/lib/toast", () => ({ toast }));
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready", user: { id: 1, name: "Asha Nair" } }) }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <main data-testid="shell">
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>LOADING SESSION</div> }));
// The real PDF code is exercised in study-report.test.ts; here only that the button hands it the sitting's report.
vi.mock("@/lib/studyReportPdf", async () => {
  const actual = await vi.importActual<typeof import("@/lib/studyReportPdf")>("@/lib/studyReportPdf");
  return { ...actual, downloadStudyReport: pdf.downloadStudyReport };
});

import MerchantNavyReportsPage from "@/app/dashboard/merchant-navy/reports/page";
import { StudySummary } from "@/components/dashboard/interviews/room/StudySummary";
import { ScoreTrend } from "@/components/dashboard/merchantNavy/ScoreTrend";
import { ApiError } from "@/lib/api";
import type { InterviewResult, StudyAttemptStanding, StudyFeedback } from "@/types/interview";
import type { StudyOverview } from "@/types/studyReport";

const point = (id: number, score: number, over: Record<string, unknown> = {}) => ({ id, score, completed_at: `2026-10-${10 + id}T10:00:00+00:00`, partial: false, answered: 23, total: 23, duration_seconds: 900, ...over });

const OVERVIEW: StudyOverview = {
  totals: { attempts: 4, sets_practised: 2, questions_answered: 92, seconds: 3720 },
  exams: [
    {
      stack_key: "ror_cards",
      name: "Rule of the Road (ROR) Cards",
      sets_practised: 2,
      sets_total: 10,
      attempts: 4,
      average_latest: 66,
      best_score: 81,
      last_at: "2026-10-30T10:00:00+00:00",
      sets: [
        { round_id: "mock-ror_cards-r1", set_number: 1, title: "Set 1", attempts: 3, best_score: 81, last_score: 72, previous_score: 81, delta: -9, last_at: "2026-10-30T10:00:00+00:00", history: [point(1, 40), point(2, 81), point(3, 72)] },
        { round_id: "mock-ror_cards-r2", set_number: 2, title: "Set 2", attempts: 1, best_score: 60, last_score: 60, previous_score: null, delta: null, last_at: "2026-10-12T10:00:00+00:00", history: [point(4, 60, { partial: true, answered: 5 })] },
      ],
    },
  ],
};

const feedback = (percent: number): StudyFeedback => ({
  method: "text_match", match_percent: percent, band: percent >= 70 ? "green" : percent >= 30 ? "yellow" : "red", label: "x",
  points: { covered: 1, partial: 0, missed: 1, total: 2 }, reference_answer: "Model.", segments: [{ text: "Model.", status: "covered" }], missed: [], unverified: false,
});

const standing = (over: Partial<StudyAttemptStanding> = {}): StudyAttemptStanding => ({
  id: 12, number: 3, attempts: 3, previous_score: 64, delta: 8, best_score: 72, is_personal_best: true, history: [point(1, 50), point(2, 64), point(12, 72)], ...over,
});

const result = (attempt: StudyAttemptStanding | null): InterviewResult => ({
  attempt, status: "scored", composite_score_percent: 72, passed: null, study: true, reattemptable: true,
  responses: [{ question_text: "First question?", category: "technical", transcript_text: "I said alpha", has_audio: false, response_id: 1, score: 72, feedback: "", study: feedback(72) }],
});

beforeEach(() => {
  net.get.mockReset();
  pdf.downloadStudyReport.mockReset().mockResolvedValue("AptRun-Report.pdf");
  toast.success.mockReset();
  toast.error.mockReset();
});
afterEach(cleanup);

describe("the score trend", () => {
  it("reads in words, oldest first, and draws a point per sitting", () => {
    const { container } = render(<ScoreTrend points={[point(1, 20), point(2, 55), point(3, 90)]} />);

    expect(screen.getByRole("img").getAttribute("aria-label")).toBe("Scores, oldest first: 20%, 55%, 90%");
    expect(container.querySelectorAll("circle").length).toBe(4); // three points + the ring round the newest
  });

  it("draws one sitting as a single point and nothing for none", () => {
    const { container, rerender } = render(<ScoreTrend points={[point(1, 70)]} />);
    expect(container.querySelectorAll("polyline").length).toBe(0);
    rerender(<ScoreTrend points={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("the history on the summary after a sitting", () => {
  it("says the sitting number, how much it moved, the best, and offers the report", async () => {
    render(<StudySummary result={result(standing())} />);

    const card = screen.getByTestId("study-history");
    expect(within(card).getByText(/Sitting 3/)).toBeTruthy();
    expect(within(card).getByText("New best")).toBeTruthy();
    expect(screen.getByTestId("history-trend").textContent).toBe("Up 8 points on last time (64%)");
    expect(within(card).getByRole("link", { name: /All my reports/ }).getAttribute("href")).toBe("/dashboard/merchant-navy/reports");

    net.get.mockResolvedValue({ attempt: { id: 12 } });
    fireEvent.click(within(card).getByRole("button", { name: /Download report/ }));
    await waitFor(() => expect(pdf.downloadStudyReport).toHaveBeenCalledWith({ attempt: { id: 12 } }));
    expect(net.get).toHaveBeenCalledWith("/study-attempts/12");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saved AptRun-Report.pdf"));
  });

  it.each([
    [{ delta: -5, previous_score: 77, is_personal_best: false }, "Down 5 points on last time (77%)"],
    [{ delta: 0, previous_score: 72, is_personal_best: false }, "Level with last time (72%)"],
    [{ delta: null, previous_score: null, number: 1, attempts: 1, is_personal_best: false, history: [point(12, 72)] }, "First sitting of this set: this is the score to beat."],
  ])("describes %j as %s", (over, words) => {
    render(<StudySummary result={result(standing(over as Partial<StudyAttemptStanding>))} />);

    expect(screen.getByTestId("history-trend").textContent).toBe(words);
    expect(screen.queryByText("New best")).toBeNull();
  });

  it("shows nothing about history when the server has none (an older sitting that could not be recorded)", () => {
    render(<StudySummary result={result(null)} />);

    expect(screen.queryByTestId("study-history")).toBeNull();
    expect(screen.queryByRole("button", { name: /Download report/ })).toBeNull();
  });

  it("tells the student when the report could not be made, and lets them try again", async () => {
    render(<StudySummary result={result(standing())} />);
    net.get.mockRejectedValueOnce(new ApiError("That report is not available.", 404));

    const button = screen.getByRole("button", { name: /Download report/ });
    fireEvent.click(button);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("That report is not available."));
    expect(pdf.downloadStudyReport).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /Download report/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("My Reports", () => {
  it("lists every exam and set with the last score, the move, the best and the number of sittings", async () => {
    net.get.mockResolvedValue(OVERVIEW);
    render(<MerchantNavyReportsPage />);

    await screen.findByTestId("reports-exam");
    expect(screen.getByRole("heading", { name: "My Reports" })).toBeTruthy();
    const totals = screen.getByRole("list", { name: "Your totals" });
    expect(within(totals).getByText("4")).toBeTruthy();
    expect(within(totals).getByText("92")).toBeTruthy();
    expect(within(totals).getByText("1 h 2 min")).toBeTruthy();

    const exam = screen.getByTestId("reports-exam");
    expect(within(exam).getByText(/2 of 10 sets practised/)).toBeTruthy();
    expect(within(exam).getByText("66%")).toBeTruthy(); // the average of each set's latest score

    const [one, two] = screen.getAllByTestId("reports-set");
    expect(within(one).getAllByText("72%").length).toBeGreaterThan(0); // the chip, and the same score in the sittings list below it
    expect(within(one).getByText("9 down")).toBeTruthy();
    expect(within(one).getByText("3 sittings", { exact: false })).toBeTruthy();
    expect(within(two).getByText("first sitting")).toBeTruthy();
  });

  it("opens a set to its sittings, newest first, each with its own report to download", async () => {
    net.get.mockImplementation(async (path: string) => (path === "/study-attempts" ? OVERVIEW : { attempt: { id: 2 } }));
    render(<MerchantNavyReportsPage />);
    await screen.findByTestId("reports-exam");

    const [one, two] = screen.getAllByTestId("reports-set");
    const sittings = within(one).getAllByTestId("reports-sitting");
    expect(sittings.map((li) => within(li).getByText(/^Sitting \d$/).textContent)).toEqual(["Sitting 3", "Sitting 2", "Sitting 1"]);
    expect(within(sittings[0]).getByText("72%")).toBeTruthy();
    expect(within(within(two).getByTestId("reports-sitting")).getByText("5 of 23 answered")).toBeTruthy();

    fireEvent.click(within(sittings[1]).getByRole("button", { name: /Download report/ }));
    await waitFor(() => expect(net.get).toHaveBeenCalledWith("/study-attempts/2"));
    await waitFor(() => expect(pdf.downloadStudyReport).toHaveBeenCalledTimes(1));
  });

  it("says plainly that there is nothing yet, and points to the sets", async () => {
    net.get.mockResolvedValue({ totals: { attempts: 0, sets_practised: 0, questions_answered: 0, seconds: 0 }, exams: [] });
    render(<MerchantNavyReportsPage />);

    expect(await screen.findByTestId("reports-empty")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Choose a set/ }).getAttribute("href")).toBe("/dashboard/merchant-navy");
  });

  it("explains a failure and tries again on request", async () => {
    net.get.mockRejectedValueOnce(new ApiError("Server unavailable.", 503)).mockResolvedValueOnce(OVERVIEW);
    render(<MerchantNavyReportsPage />);

    expect((await screen.findByRole("alert")).textContent).toContain("Server unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByTestId("reports-exam");
  });
});
