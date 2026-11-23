import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async (importOriginal) => ({ ...(await importOriginal<typeof import("framer-motion")>()), useReducedMotion: () => true }));

import { InterviewComplete, InterviewError } from "@/components/dashboard/interviews/room/InterviewComplete";
import type { InterviewResult } from "@/types/interview";

beforeEach(() => {
  // The score counts up when it scrolls into view; jsdom has no IntersectionObserver.
  (window as unknown as Record<string, unknown>).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(cleanup);

const responses: InterviewResult["responses"] = [
  { question_text: "Tell me about a project.", category: "behavioral", transcript_text: "I built a portal.", has_audio: true, response_id: 1, score: 78, feedback: "Clear, but name your own contribution." },
  { question_text: "Design a rate limiter.", category: "technical", transcript_text: "Token bucket.", has_audio: true, response_id: 2, score: 64, feedback: "Good start; discuss distributed counters." },
];
const scored = (percent: number, over: Partial<InterviewResult> = {}): InterviewResult => ({ status: "scored", composite_score_percent: percent, passed: null, reattemptable: true, responses, ...over });

const view = (over: Partial<React.ComponentProps<typeof InterviewComplete>> = {}) =>
  render(<InterviewComplete vault={false} result={null} totalQuestions={3} answeredCount={3} elapsedSeconds={125} reattempting={false} onReattempt={vi.fn()} onBack={vi.fn()} {...over} />);

describe("the interview's result screen", () => {
  it("keeps the orb thinking and says the answers are being scored until the result arrives", () => {
    view({ result: { status: "scoring", composite_score_percent: null, passed: null, responses: [] } });

    expect(screen.getByTestId("interview-complete")).toBeTruthy();
    expect(screen.getByText("Interview complete")).toBeTruthy();
    expect(screen.getByText("Scoring your interview with AI...")).toBeTruthy();
    expect(screen.getByText("What happens next")).toBeTruthy();
    expect(screen.queryByText("Per-question feedback")).toBeNull();
  });

  it("shows how many questions were answered and how long it took", () => {
    view();

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Questions answered")).toBeTruthy();
    expect(screen.getByText("2:05")).toBeTruthy();
    expect(screen.getByText("Time taken")).toBeTruthy();
  });

  it("shows the score, whether the round was passed, and the feedback for every question", () => {
    view({ result: scored(82, { passed: true }) });

    expect(screen.getByRole("img", { name: "AI-scored result: 82 out of 100" })).toBeTruthy();
    expect(screen.getByText("You passed this round")).toBeTruthy();
    const feedback = screen.getByRole("region", { name: "Per-question feedback" });
    expect(within(feedback).getByText("Tell me about a project.")).toBeTruthy();
    expect(within(feedback).getByText("78/100")).toBeTruthy();
    expect(within(feedback).getByText("Good start; discuss distributed counters.")).toBeTruthy();
    expect(screen.getByText("Scored by AI — a human reviewer can still adjust this.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Re-attempt/ })).toBeNull();
  });

  it("recommends a re-attempt under 60% and runs it from the button, which shows its own busy state", () => {
    const onReattempt = vi.fn();
    const { rerender } = view({ result: scored(48, { passed: false }), onReattempt });

    expect(screen.getByText("Score below 60% — Re-attempt Recommended")).toBeTruthy();
    expect(screen.getByText("Didn't clear this round's threshold")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Re-attempt Interview/ }));
    expect(onReattempt).toHaveBeenCalledTimes(1);

    rerender(<InterviewComplete vault={false} result={scored(48, { passed: false })} totalQuestions={3} answeredCount={3} elapsedSeconds={null} reattempting onReattempt={onReattempt} onBack={vi.fn()} />);
    expect((screen.getByRole("button", { name: /Starting fresh attempt/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not offer a re-attempt the server has ruled out", () => {
    view({ result: scored(40, { reattemptable: false }) });

    expect(screen.queryByText("Score below 60% — Re-attempt Recommended")).toBeNull();
    expect(screen.queryByRole("button", { name: /Re-attempt/ })).toBeNull();
  });

  it("speaks of a Vault set, not a round: its own title, its series note, no pass/fail, and a way back to the circuit", () => {
    const onBack = vi.fn();
    view({ vault: true, result: scored(55, { passed: null }), onBack });

    expect(screen.getByText("Set complete")).toBeTruthy();
    expect(screen.getAllByText("Your score for this set").length).toBeGreaterThan(0);
    expect(screen.getByText(/counts toward your Mellow Vault series/)).toBeTruthy();
    expect(screen.queryByText("Score below 60% — Re-attempt Recommended")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to Qualification Circuit" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("tells the candidate a person will review the answers when the AI could not score them, and lets them retry if allowed", () => {
    view({ result: { status: "needs_human_review", composite_score_percent: null, passed: null, reattemptable: true, responses: [] } });

    expect(screen.getByText("All Answers Saved & Secure")).toBeTruthy();
    expect(screen.getByText(/All answers safely captured/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Re-attempt Interview/ })).toBeTruthy();
  });

  it("offers 'Proceed to Set 2' and auto-advances when Set 1 of a Vault qualification is scored", () => {
    const onStartNextSet = vi.fn();
    view({
      vault: true,
      result: scored(75, { passed: null }),
      qualification: { stack_key: "laravel", role_key: "backend", series_number: 1, set_number: 1 },
      onStartNextSet,
    });

    expect(screen.getByText(/Up Next · Set 2 of 3/)).toBeTruthy();
    expect(screen.getByText("Ready for Set 2?")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start Set 2 Now/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Proceed to Set 2/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Pause Timer/ })).toBeTruthy();

    // Clicking pause timer pauses auto-advance
    fireEvent.click(screen.getByRole("button", { name: /Pause Timer/ }));
    expect(screen.queryByRole("button", { name: /Pause Timer/ })).toBeNull();

    // Clicking proceed to set 2 calls onStartNextSet with 2
    fireEvent.click(screen.getByRole("button", { name: /Proceed to Set 2/ }));
    expect(onStartNextSet).toHaveBeenCalledWith(2);
  });

  it("shows Series 3 of 3 Completed celebration card when Set 3 is finished", () => {
    view({
      vault: true,
      result: scored(80, { passed: null }),
      qualification: { stack_key: "laravel", role_key: "backend", series_number: 1, set_number: 3 },
    });

    expect(screen.getByText(/Series 3 of 3 Completed!/)).toBeTruthy();
    expect(screen.getByText("You Have Completed All 3 Qualification Sets")).toBeTruthy();
    expect(screen.getByRole("button", { name: /View Circuit Standing/ })).toBeTruthy();
  });
});

describe("the interview's error screen", () => {
  it("explains what happened and offers both a retry and a way out, since there is no dashboard around it any more", () => {
    const onRetry = vi.fn();
    const onBack = vi.fn();
    render(<InterviewError message="This interview is locked." retrying={false} onRetry={onRetry} onBack={onBack} backLabel="Back to Interviews" />);

    expect(screen.getByText("Couldn't start this interview")).toBeTruthy();
    expect(screen.getByText("This interview is locked.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Try Again/ }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Interviews" }));
    expect(onRetry).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});
