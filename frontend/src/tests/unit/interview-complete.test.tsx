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

    expect(screen.getByText("Your answers have been saved. A real person will review your responses.")).toBeTruthy();
    expect(screen.getByText("A reviewer reads your transcripts and listens to your recordings.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Re-attempt Interview/ })).toBeTruthy();
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
