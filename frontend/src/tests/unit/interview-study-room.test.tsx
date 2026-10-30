import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Study mode in the live interview room (the Merchant Navy sets): after an answer is submitted the room keeps it on screen with the model
 * answer and how much of it was covered, and waits for "Next question". Driven through the real InterviewSessionView, with the voice, the
 * proctoring engine and the network replaced by fakes, exactly like the ordinary room's tests.
 */

// The whole room runs for real (animation, timers); on a loaded machine running the suite in parallel 6 s is not always enough.
configure({ asyncUtilTimeout: 15000 });

const voice = vi.hoisted(() => ({ speak: vi.fn(), startListening: vi.fn(), stopListening: vi.fn(), cancel: vi.fn() }));
const net = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), postFormData: vi.fn(), getFile: vi.fn() }));
const proctor = vi.hoisted(() => ({ endSession: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn(), from: "merchant-navy" as string | null }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ slug: "set-1", ...(nav.from ? { from: nav.from } : {}) }),
}));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: net.get, post: net.post, postFormData: net.postFormData, getFile: net.getFile } };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready", user: { id: 1, name: "Asha Nair" } }) }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <main data-testid="shell">{children}</main>,
}));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>LOADING SESSION</div> }));
vi.mock("@/components/dashboard/interviews/room/timing", () => ({ timing: { countdownSeconds: 0, afterGreetingMs: 0 } }));
vi.mock("@/lib/voice/VoiceEngine", () => ({ hasSpeechRecognition: () => true, hasSpeechSynthesis: () => true, hasMediaRecorder: () => true }));
vi.mock("@/lib/voice/browserVoiceEngine", () => ({
  BrowserVoiceEngine: class {
    speak = voice.speak;
    startListening = voice.startListening;
    stopListening = voice.stopListening;
    cancel = voice.cancel;
  },
}));
vi.mock("@/lib/proctoring/useInterviewProctoring", async () => {
  const React = await import("react");
  return {
    useInterviewProctoring: () => {
      const [phase, setPhase] = React.useState("consent");
      React.useEffect(() => {
        const timer = setTimeout(() => setPhase("active"), 30);
        return () => clearTimeout(timer);
      }, []);
      return {
        phase,
        session: { violation_count: 0, max_violations: 3 },
        lastViolation: null,
        consentError: null,
        previewVideoRef: { current: null },
        devicePreviewReady: true,
        cameraStream: null,
        enableDevicePreview: vi.fn(),
        grantConsentAndStart: vi.fn(),
        resumeFullscreen: vi.fn(),
        endSession: proctor.endSession,
      };
    },
  };
});
vi.mock("@/components/proctoring/InterviewSessionHud", () => ({ InterviewSessionHud: () => null, StrikePill: () => <span>0/3 strikes</span> }));
vi.mock("@/components/proctoring/InterviewProctoringConsentGate", () => ({ InterviewProctoringConsentGate: () => null }));
vi.mock("@/components/proctoring/InterviewProctoringLockedScreen", () => ({ InterviewProctoringLockedScreen: () => null }));

import { InterviewSessionView } from "@/components/dashboard/interviews/InterviewSessionView";

const q = (id: number, order: number, text: string) => ({ interview_question_id: id, order, total: 2, question_text: text, category: "technical", difficulty: "standard", expected_duration_seconds: 90 });
const q1 = q(11, 1, "What are the four distinct stages of passage planning?");
const q2 = q(12, 2, "What is a Mate's Receipt?");

const feedback = (over: Record<string, unknown> = {}) => ({
  method: "text_match",
  match_percent: 50,
  band: "yellow",
  label: "Getting there",
  points: { covered: 2, partial: 0, missed: 2, total: 4 },
  reference_answer: "Appraisal, Planning, Execution, and Monitoring.",
  segments: [
    { text: "Appraisal, ", status: "missed" },
    { text: "Planning, ", status: "covered" },
    { text: "Execution, ", status: "missed" },
    { text: "and Monitoring.", status: "covered" },
  ],
  missed: ["Appraisal", "Execution"],
  unverified: false,
  ...over,
});

const startPayload = (total: number, study = true) => ({ session: { id: 1, status: "in_progress", current_question_order: 0 }, total_questions: total, answered_count: 0, complete: false, question: q1, study });

/** Sits one question: begin (the first time), let the interviewer finish, speak, stop, submit. */
async function answerOne(first = false) {
  if (first) fireEvent.click(await screen.findByRole("button", { name: /Begin interview/i }));
  fireEvent.click(await screen.findByRole("button", { name: /Start now/i }));
  await screen.findByText("Listening…");
  fireEvent.click(screen.getByRole("button", { name: /Stop & review/i }));
  await screen.findByLabelText("Review your answer (edit if needed)");
  fireEvent.click(screen.getByRole("button", { name: /Submit answer/i }));
}

beforeEach(() => {
  nav.push.mockReset();
  nav.from = "merchant-navy";
  voice.speak.mockReset().mockResolvedValue(undefined);
  voice.startListening.mockReset().mockResolvedValue(undefined);
  voice.stopListening.mockReset().mockResolvedValue({ transcript: "planning and monitoring", audioBlob: new Blob(["x"]), voicedMs: 4000 });
  voice.cancel.mockReset();
  net.get.mockReset().mockRejectedValue(new Error("no result yet"));
  net.post.mockReset().mockResolvedValue(startPayload(2));
  net.postFormData.mockReset();
  net.getFile.mockReset().mockRejectedValue(new Error("no voice clips in this test"));
  proctor.endSession.mockReset();
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  URL.createObjectURL = vi.fn(() => "blob:answer");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("study mode in the live interview room", () => {
  it("says it is a study set, not an AI-scored interview, before it begins", async () => {
    render(<InterviewSessionView variant="mock" />);

    expect(await screen.findByText("Merchant Navy Orals")).toBeTruthy();
    expect(screen.getByText("Study mode · not scored by AI")).toBeTruthy();
    expect(await screen.findByText("Learn from every answer")).toBeTruthy();
  });

  it("keeps the answer on screen with the model answer and the match, and only goes on when the candidate presses Next question", async () => {
    net.postFormData.mockResolvedValue({ complete: false, next_question: q2, feedback: feedback() });
    render(<InterviewSessionView variant="mock" />);
    await answerOne(true);

    // The feedback panel: the question, the match (a coloured line + the number), what was said, the model answer.
    const panel = await screen.findByTestId("study-feedback");
    expect(within(panel).getByText(q1.question_text)).toBeTruthy();
    expect(within(panel).getByText("Question 1 of 2")).toBeTruthy();
    const meter = within(panel).getByTestId("match-meter");
    expect(meter.getAttribute("data-band")).toBe("yellow");
    expect(within(meter).getByText("50%")).toBeTruthy();
    expect(within(meter).getByRole("meter").getAttribute("aria-valuenow")).toBe("50");
    expect(within(meter).getByText("2 of 4 key points covered")).toBeTruthy();
    expect(within(panel).getByTestId("your-answer").textContent).toBe("planning and monitoring");
    expect(within(panel).getByTestId("model-answer").textContent).toContain("Appraisal, ");

    // What was covered and what was left out are marked on the model answer itself.
    const status = (text: string) => within(panel).getByText((_, el) => el?.tagName === "SPAN" && el.getAttribute("data-status") !== null && el.textContent?.startsWith(text) === true).getAttribute("data-status");
    expect(status("Planning")).toBe("covered");
    expect(status("Appraisal")).toBe("missed");

    // Nothing moved on by itself: the next question has not been asked.
    expect(voice.speak).not.toHaveBeenCalledWith(q2.question_text, expect.anything(), expect.anything());
    expect(screen.getAllByRole("button", { name: /Next question/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Getting there").length).toBeGreaterThan(0);

    voice.speak.mockClear();
    fireEvent.click(screen.getAllByRole("button", { name: /Next question/i })[0]);

    await waitFor(() => expect(voice.speak).toHaveBeenCalledWith(q2.question_text, expect.anything(), expect.anything()));
    expect(screen.queryByTestId("study-feedback")).toBeNull();
    // and the question just answered is now in the transcript, the progress has moved to question 2
    expect(within(screen.getByRole("log", { name: "Interview transcript" })).getByText("You: planning and monitoring")).toBeTruthy();
    for (const steps of screen.getAllByRole("list", { name: "Interview progress" })) {
      expect(within(steps).getAllByRole("listitem")[1].getAttribute("aria-current")).toBe("step");
    }
  });

  it("goes on with Enter as well", async () => {
    net.postFormData.mockResolvedValue({ complete: false, next_question: q2, feedback: feedback() });
    render(<InterviewSessionView variant="mock" />);
    await answerOne(true);
    await screen.findByTestId("study-feedback");

    voice.speak.mockClear();
    fireEvent.keyDown(document.body, { key: "Enter" });

    await waitFor(() => expect(voice.speak).toHaveBeenCalledWith(q2.question_text, expect.anything(), expect.anything()));
  });

  it("is coloured by the match: red for a poor answer, green for a strong one", async () => {
    net.postFormData.mockResolvedValue({ complete: false, next_question: q2, feedback: feedback({ match_percent: 10, band: "red", label: "Needs more work", points: { covered: 0, partial: 0, missed: 4, total: 4 } }) });
    const { unmount } = render(<InterviewSessionView variant="mock" />);
    await answerOne(true);
    expect((await screen.findByTestId("match-meter")).getAttribute("data-band")).toBe("red");
    expect(screen.getAllByText("Needs more work").length).toBeGreaterThan(0);
    unmount();
    cleanup();

    net.postFormData.mockResolvedValue({ complete: false, next_question: q2, feedback: feedback({ match_percent: 90, band: "green", label: "Strong answer", points: { covered: 4, partial: 0, missed: 0, total: 4 } }) });
    render(<InterviewSessionView variant="mock" />);
    await answerOne(true);
    expect((await screen.findByTestId("match-meter")).getAttribute("data-band")).toBe("green");
    expect(screen.getAllByText("Strong answer").length).toBeGreaterThan(0);
  });

  it("tells the candidate when the model answer has not been checked yet", async () => {
    net.postFormData.mockResolvedValue({ complete: false, next_question: q2, feedback: feedback({ unverified: true }) });
    render(<InterviewSessionView variant="mock" />);
    await answerOne(true);

    expect(await screen.findByText("This model answer is still being checked.")).toBeTruthy();
  });

  it("says plainly what the match can and cannot tell them", async () => {
    net.postFormData.mockResolvedValue({ complete: false, next_question: q2, feedback: feedback() });
    render(<InterviewSessionView variant="mock" />);
    await answerOne(true);

    expect(await screen.findByText(/not marked by AI and it cannot tell whether what you said is correct/)).toBeTruthy();
  });

  it("finishes the set from the last feedback: 'Finish set' ends proctoring and shows the study summary, with a way back to Merchant Navy", async () => {
    net.post.mockResolvedValue(startPayload(1));
    net.postFormData.mockResolvedValue({ complete: true, feedback: feedback() });
    net.get.mockImplementation(async (path: string) => {
      if (path.endsWith("/result")) {
        return {
          status: "scored",
          composite_score_percent: 50,
          passed: null,
          study: true,
          reattemptable: true,
          responses: [{ question_text: q1.question_text, category: "technical", transcript_text: "planning and monitoring", has_audio: false, response_id: 1, score: 50, feedback: "Matched 50%", study: feedback() }],
        };
      }
      throw new Error("no summary");
    });
    render(<InterviewSessionView variant="mock" />);
    await answerOne(true);

    // the last answer still shows its feedback, and the button says what it does
    await screen.findByTestId("study-feedback");
    expect(proctor.endSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: /Finish set/i })[0]);

    expect(await screen.findByText("Set complete")).toBeTruthy();
    expect(proctor.endSession).toHaveBeenCalledTimes(1);
    const summary = await screen.findByTestId("study-summary");
    expect(within(summary).getByTestId("match-meter").getAttribute("data-band")).toBe("yellow");
    expect(screen.queryByText(/Scoring your interview with AI/)).toBeNull();
    expect(screen.getByRole("button", { name: "Practise this set again" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back to Merchant Navy" }));
    expect(nav.push).toHaveBeenCalledWith("/dashboard/merchant-navy");
  });

  it("leads back to the Mock AI Interview when the set was opened from there", async () => {
    nav.from = null;
    net.post.mockResolvedValue(startPayload(1));
    net.postFormData.mockResolvedValue({ complete: true, feedback: feedback() });
    net.get.mockImplementation(async (path: string) => {
      if (path.endsWith("/result")) return { status: "scored", composite_score_percent: 50, passed: null, study: true, reattemptable: true, responses: [] };
      throw new Error("no summary");
    });
    render(<InterviewSessionView variant="mock" />);
    await answerOne(true);
    await screen.findByTestId("study-feedback");
    fireEvent.click(screen.getAllByRole("button", { name: /Finish set/i })[0]);

    await screen.findByText("Set complete");
    fireEvent.click(await screen.findByRole("button", { name: "Back to Mock Interviews" }));
    expect(nav.push).toHaveBeenCalledWith("/dashboard/interviews");
  });

  it("shows a Rule of the Road card with its questions, keeps it on screen through the feedback, and leaves an ordinary question without one", async () => {
    const card = "/ror-cards/card-005.png";
    const c1 = { ...q(21, 1, "Night, open sea. A vessel is 30 degrees on your starboard bow. Identify the vessel from the lights shown."), image: card };
    const c2 = { ...q(22, 2, "What are your Rule, role and action?"), image: card };
    net.post.mockResolvedValue({ ...startPayload(2), question: c1 });
    net.postFormData.mockResolvedValue({ complete: false, next_question: c2, feedback: feedback() });
    render(<InterviewSessionView variant="mock" />);

    // before the question is asked there is nothing to look at
    await screen.findByRole("button", { name: /Begin interview/i });
    expect(screen.queryByTestId("card-figure")).toBeNull();

    await answerOne(true);

    // in the feedback the picture is still there, above what they said and the model answer
    const panel = await screen.findByTestId("study-feedback");
    const figure = screen.getByTestId("card-figure");
    expect(figure.querySelector("img")?.getAttribute("src")).toBe(card);
    expect(figure.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(figure.querySelector("img")?.getAttribute("alt") ?? "").not.toMatch(/trawl|fishing|aground|pilot|tug|anchor|sailing/i);

    // the next question of the same card keeps the same picture
    fireEvent.click(within(panel).getByRole("button", { name: /Next question/i }));
    await waitFor(() => expect(voice.speak).toHaveBeenCalledWith(c2.question_text, expect.anything(), expect.anything()));
    expect(screen.getByTestId("card-figure").querySelector("img")?.getAttribute("src")).toBe(card);
  });

  it("an ordinary question has no card in the room", async () => {
    net.postFormData.mockResolvedValue({ complete: false, next_question: q2, feedback: feedback() });
    render(<InterviewSessionView variant="mock" />);
    await answerOne(true);
    await screen.findByTestId("study-feedback");

    expect(screen.queryByTestId("card-figure")).toBeNull();
  });

  it("an ordinary interview is untouched: its answer goes straight on to the next question, with no feedback screen", async () => {
    net.post.mockResolvedValue(startPayload(2, false));
    net.postFormData.mockResolvedValue({ complete: false, next_question: q2 });
    render(<InterviewSessionView variant="mock" />);
    await answerOne(true);

    await waitFor(() => expect(voice.speak).toHaveBeenCalledWith(q2.question_text, expect.anything(), expect.anything()));
    expect(screen.queryByTestId("study-feedback")).toBeNull();
    expect(screen.queryByText("Study mode · not scored by AI")).toBeNull();
    expect(screen.getByText("AI Interview")).toBeTruthy();
  });
});
