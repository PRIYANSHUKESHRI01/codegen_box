import { StrictMode } from "react";
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The live interview screen, end to end through the real InterviewSessionView with the browser's voice, the proctoring engine and the
 * network replaced by fakes: the interviewer speaks a question, the candidate answers, reviews and submits, and the transcript follows.
 */

// The whole interview runs through real components (animation, canvas fallbacks, timers); on a busy machine the default 1 s wait is not always enough.
configure({ asyncUtilTimeout: 6000 });

const voice = vi.hoisted(() => ({
  speak: vi.fn(),
  startListening: vi.fn(),
  stopListening: vi.fn(),
  cancel: vi.fn(),
}));
const net = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), postFormData: vi.fn(), getFile: vi.fn() }));
const proctor = vi.hoisted(() => ({ endSession: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams({ slug: "backend-1" }),
}));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { get: net.get, post: net.post, postFormData: net.postFormData, getFile: net.getFile } };
});
vi.mock("@/lib/useAuthGuard", () => ({ useAuthGuard: () => ({ status: "ready", user: { id: 1, name: "Asha Rao" } }) }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/dashboard/DashboardShell", () => ({
  DashboardShell: ({ children, hideChrome }: { children: React.ReactNode; hideChrome?: boolean }) => (
    <main data-testid="shell" data-hide-chrome={String(!!hideChrome)}>
      {children}
    </main>
  ),
}));
vi.mock("@/components/ui/SessionLoader", () => ({ SessionLoader: () => <div>LOADING SESSION</div> }));
// The real interview counts 3-2-1 and pauses after the greeting; a test does not wait through that.
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
// Like the real thing, proctoring only goes live after the candidate has agreed on the consent screen — i.e. after the interview has been fetched.
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
vi.mock("@/components/proctoring/InterviewSessionHud", () => ({
  InterviewSessionHud: () => null,
  StrikePill: ({ session }: { session: { violation_count: number; max_violations: number } }) => (
    <span>
      {session.violation_count}/{session.max_violations} strikes
    </span>
  ),
}));
vi.mock("@/components/proctoring/InterviewProctoringConsentGate", () => ({ InterviewProctoringConsentGate: () => null }));
vi.mock("@/components/proctoring/InterviewProctoringLockedScreen", () => ({ InterviewProctoringLockedScreen: () => null }));

import { InterviewSessionView } from "@/components/dashboard/interviews/InterviewSessionView";

const q1 = { interview_question_id: 11, order: 1, total: 2, question_text: "Tell me about a project you are proud of.", category: "technical", difficulty: "easy", expected_duration_seconds: 120 };
const q2 = { interview_question_id: 12, order: 2, total: 2, question_text: "How do you handle disagreement in a team?", category: "behavioral", difficulty: "medium", expected_duration_seconds: 90 };

/** Lets a test decide when the interviewer finishes speaking, and read what the page asked the voice to do. */
function controlSpeech() {
  let finish: () => void = () => undefined;
  voice.speak.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  return { finish: () => act(() => finish()) };
}

/** The interview waits at "Begin interview" until the candidate says they are ready. */
const begin = async () => fireEvent.click(await screen.findByRole("button", { name: /(Begin|Continue) interview/i }));

const transcriptLog = () => screen.getByRole("log", { name: "Interview transcript" });

beforeEach(() => {
  voice.speak.mockReset();
  voice.startListening.mockReset().mockResolvedValue(undefined);
  voice.stopListening.mockReset().mockResolvedValue({ transcript: "I built a chat app", audioBlob: new Blob(["x"]), voicedMs: 4000 });
  voice.cancel.mockReset();
  net.get.mockReset().mockRejectedValue(new Error("no result yet"));
  net.post.mockReset().mockResolvedValue({ session: { id: 1, status: "in_progress", current_question_order: 1 }, total_questions: 2, answered_count: 0, complete: false, question: q1 });
  net.postFormData.mockReset();
  net.getFile.mockReset().mockRejectedValue(new Error("no voice clips in this test"));
  proctor.endSession.mockReset();
  // jsdom has no canvas, no object URLs and no layout observers; the room must cope without them.
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  URL.createObjectURL = vi.fn(() => "blob:answer");
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

describe("the live interview room", () => {
  it("shows the interviewer asking, then hands over to the candidate and announces the question once it has been said", async () => {
    const speech = controlSpeech();
    render(<InterviewSessionView variant="mock" />);
    await begin();

    // While the question is being read, the room says so and the question is not yet announced to a screen reader.
    await waitFor(() => expect(voice.speak).toHaveBeenCalledWith(q1.question_text, expect.objectContaining({ onBoundary: expect.any(Function), onStart: expect.any(Function) }), { audioUrl: null }));
    expect(await screen.findByText("AptRun is asking")).toBeTruthy();
    expect(within(transcriptLog()).queryByText(/Tell me about a project/)).toBeNull();
    // The whole transcript panel, header and the proctoring strike counter are part of the room.
    expect(screen.getByText("Live transcript")).toBeTruthy();
    expect(screen.getByText("0/3 strikes")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Having trouble/i })).toBeTruthy();

    speech.finish();

    expect(await screen.findByText("Get ready to answer")).toBeTruthy();
    expect(within(transcriptLog()).getByText(`AptRun Interviewer: ${q1.question_text}`)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start now/i })).toBeTruthy();
  });

  it("writes the candidate's answer into the transcript live, then lets them edit it before submitting", async () => {
    const speech = controlSpeech();
    render(<InterviewSessionView variant="mock" />);
    await begin();
    await waitFor(() => expect(voice.speak).toHaveBeenCalled());
    speech.finish();

    fireEvent.click(await screen.findByRole("button", { name: /Start now/i }));
    expect(await screen.findByText("Listening…")).toBeTruthy();
    await waitFor(() => expect(voice.startListening).toHaveBeenCalled());

    // Speech arrives piece by piece: what is committed, and a tail that may still change.
    const callbacks = voice.startListening.mock.calls[0][0] as { onInterimTranscript: (text: string, parts: { final: string; interim: string }) => void; onAudioLevel: (n: number) => void };
    act(() => callbacks.onInterimTranscript("I built a chat", { final: "I built", interim: "a chat" }));
    for (const word of ["I", "built", "a", "chat"]) expect(screen.getAllByText(word).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Stop & review/i }));

    const editor = (await screen.findByLabelText("Review your answer (edit if needed)")) as HTMLTextAreaElement;
    expect(editor.value).toBe("I built a chat app");
    expect(await screen.findByText("Review your answer")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Re-record/i })).toBeTruthy();

    fireEvent.change(editor, { target: { value: "I built a chat app with Laravel" } });
    expect(editor.value).toBe("I built a chat app with Laravel");
  });

  it("submits the answer, files it into the transcript history and moves on to the next question", async () => {
    const speech = controlSpeech();
    net.postFormData.mockResolvedValue({ complete: false, next_question: q2 });
    render(<InterviewSessionView variant="mock" />);
    await begin();
    await waitFor(() => expect(voice.speak).toHaveBeenCalled());
    speech.finish();

    fireEvent.click(await screen.findByRole("button", { name: /Start now/i }));
    await screen.findByText("Listening…");
    fireEvent.click(screen.getByRole("button", { name: /Stop & review/i }));
    await screen.findByLabelText("Review your answer (edit if needed)");

    // The next question is asked as soon as the answer is accepted.
    voice.speak.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Submit answer/i }));

    await waitFor(() => expect(voice.speak).toHaveBeenCalledWith(q2.question_text, expect.anything(), expect.anything()));
    const [path, form] = net.postFormData.mock.calls[0] as [string, FormData];
    expect(path).toBe("/interviews/backend-1/answer");
    expect(form.get("interview_question_id")).toBe("11");
    expect(form.get("transcript_text")).toBe("I built a chat app");

    // Both sides of the first exchange stay in the transcript.
    const log = transcriptLog();
    await waitFor(() => expect(within(log).getByText("You: I built a chat app")).toBeTruthy());
    expect(within(log).getByText(`AptRun Interviewer: ${q1.question_text}`)).toBeTruthy();
    // The progress bar has moved to the second question.
    // (The bar is drawn twice, once per breakpoint; CSS shows exactly one of them.)
    for (const steps of screen.getAllByRole("list", { name: "Interview progress" })) {
      expect(within(steps).getAllByRole("listitem")[1].getAttribute("aria-current")).toBe("step");
    }
  });

  it("finishes the interview after the last answer: ends proctoring and shows the completion screen", async () => {
    const speech = controlSpeech();
    net.post.mockResolvedValue({ session: { id: 1, status: "in_progress", current_question_order: 2 }, total_questions: 1, answered_count: 0, complete: false, question: q1 });
    net.postFormData.mockResolvedValue({ complete: true });
    render(<InterviewSessionView variant="mock" />);
    await begin();
    await waitFor(() => expect(voice.speak).toHaveBeenCalled());
    speech.finish();

    fireEvent.click(await screen.findByRole("button", { name: /Start now/i }));
    await screen.findByText("Listening…");
    fireEvent.click(screen.getByRole("button", { name: /Stop & review/i }));
    await screen.findByLabelText("Review your answer (edit if needed)");
    fireEvent.click(screen.getByRole("button", { name: /Submit answer/i }));

    expect(await screen.findByText("Interview complete")).toBeTruthy();
    expect(proctor.endSession).toHaveBeenCalledTimes(1);
  });

  it("falls back to a typed answer, in the same transcript, when the microphone can't be used", async () => {
    const speech = controlSpeech();
    voice.startListening.mockRejectedValue(new Error("Microphone access failed", { cause: "permission_denied" }));
    render(<InterviewSessionView variant="mock" />);
    await begin();
    await waitFor(() => expect(voice.speak).toHaveBeenCalled());
    speech.finish();

    fireEvent.click(await screen.findByRole("button", { name: /Start now/i }));

    const typed = (await screen.findByLabelText("Type your answer")) as HTMLTextAreaElement;
    expect(await screen.findByText("Type your answer")).toBeTruthy();
    expect(screen.getByText(/couldn't access your microphone/i)).toBeTruthy();
    const next = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);

    fireEvent.change(typed, { target: { value: "I led the team" } });
    expect(next.disabled).toBe(false);
  });

  it("never draws the dashboard (sidebar, header) around the interview — not at setup, not live, not on the result", async () => {
    const speech = controlSpeech();
    net.post.mockResolvedValue({ session: { id: 1, status: "in_progress", current_question_order: 1 }, total_questions: 1, answered_count: 0, complete: false, question: q1 });
    net.postFormData.mockResolvedValue({ complete: true });
    render(<InterviewSessionView variant="mock" />);

    // The consent screen is on (the very first render): already without the dashboard.
    expect(screen.getByTestId("shell").getAttribute("data-hide-chrome")).toBe("true");

    // Live: still without it.
    await begin();
    await waitFor(() => expect(voice.speak).toHaveBeenCalled());
    expect(screen.getByTestId("interview-room")).toBeTruthy();
    expect(screen.getByTestId("shell").getAttribute("data-hide-chrome")).toBe("true");
    speech.finish();

    fireEvent.click(await screen.findByRole("button", { name: /Start now/i }));
    await screen.findByText("Listening…");
    fireEvent.click(screen.getByRole("button", { name: /Stop & review/i }));
    await screen.findByLabelText("Review your answer (edit if needed)");
    fireEvent.click(screen.getByRole("button", { name: /Submit answer/i }));

    // The result is on the room's own backdrop too — the way out is its own buttons, not the dashboard's sidebar.
    expect(await screen.findByText("Interview complete")).toBeTruthy();
    expect(screen.getByTestId("interview-complete")).toBeTruthy();
    expect(screen.getByTestId("shell").getAttribute("data-hide-chrome")).toBe("true");
  });

  it("does not start asking until the candidate says they are ready, however long that takes", async () => {
    controlSpeech();
    net.get.mockResolvedValue({ estimated_total_seconds: 960 });
    render(<InterviewSessionView variant="mock" />);

    // Proctoring is live, the room is open — and nothing is said.
    expect(await screen.findByText("You're all set, Asha.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Begin interview" })).toBeTruthy();
    expect(screen.getByText(/2 questions, about 16 minutes/)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(voice.speak).not.toHaveBeenCalled();
    expect(screen.queryByText("AptRun is asking")).toBeNull();

    await begin();
    await waitFor(() => expect(voice.speak).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("AptRun is asking")).toBeTruthy();
  });

  it("starts after Begin even in React's dev double-mount (the page is not mistaken for one that was left)", async () => {
    voice.speak.mockImplementation(() => Promise.resolve());
    render(
      <StrictMode>
        <InterviewSessionView variant="mock" />
      </StrictMode>
    );

    await begin();

    await waitFor(() => expect(voice.speak).toHaveBeenCalledWith(q1.question_text, expect.anything(), expect.anything()));
  });

  it("begins when the candidate presses Enter, as on any ready screen", async () => {
    controlSpeech();
    render(<InterviewSessionView variant="mock" />);
    await screen.findByRole("button", { name: "Begin interview" });

    fireEvent.keyDown(document.body, { key: "Enter" });

    await waitFor(() => expect(voice.speak).toHaveBeenCalledTimes(1));
  });

  it("welcomes a candidate back to a half-finished interview, instead of starting it from the top", async () => {
    controlSpeech();
    net.post.mockResolvedValue({ session: { id: 1, status: "in_progress", current_question_order: 1 }, total_questions: 3, answered_count: 1, complete: false, question: q2 });
    render(<InterviewSessionView variant="mock" />);

    expect(await screen.findByText("Welcome back, Asha.")).toBeTruthy();
    expect(screen.getByText(/You've answered 1 of 3/)).toBeTruthy();
    await begin();
    await waitFor(() => expect(voice.speak).toHaveBeenCalledWith(q2.question_text, expect.anything(), expect.anything()));
  });

  describe("with the interviewer's real voice", () => {
    const greeting = "Hi, I'm your AptRun interviewer. I'll ask one question at a time.";
    const withVoice = (over: Record<string, unknown> = {}) =>
      net.post.mockResolvedValue({
        session: { id: 1, status: "in_progress", current_question_order: 0 },
        total_questions: 3,
        answered_count: 0,
        complete: false,
        question: q1,
        speech: { enabled: true, lines: { greeting, welcome_back: "Welcome back." } },
        ...over,
      });

    it("fetches the voice while the candidate is still getting ready, so it is there the moment they begin", async () => {
      controlSpeech();
      withVoice();
      net.getFile.mockResolvedValue(new Blob(["audio"], { type: "audio/wav" }));
      render(<InterviewSessionView variant="mock" />);

      await screen.findByRole("button", { name: "Begin interview" });
      await waitFor(() => expect(net.getFile).toHaveBeenCalledWith("/interviews/backend-1/questions/11/speech"));
      expect(net.getFile).toHaveBeenCalledWith("/interviews-speech/lines/greeting");
      expect(voice.speak).not.toHaveBeenCalled();
    });

    it("says hello first, in the real voice and written in the transcript, then asks the first question in it too", async () => {
      voice.speak.mockImplementation(() => Promise.resolve());
      withVoice();
      net.getFile.mockResolvedValue(new Blob(["audio"], { type: "audio/wav" }));
      render(<InterviewSessionView variant="mock" />);
      await begin();

      await waitFor(() => expect(voice.speak).toHaveBeenCalledTimes(2));
      const [hello, question] = voice.speak.mock.calls;
      expect(hello[0]).toBe(greeting);
      expect(hello[2]).toEqual({ audioUrl: "blob:answer" });
      expect(question[0]).toBe(q1.question_text);
      expect(question[2]).toEqual({ audioUrl: "blob:answer" });
      expect(await within(transcriptLog()).findByText(`AptRun Interviewer: ${greeting}`)).toBeTruthy();
    });

    it("reads the question in the browser voice when its clip can't be had — and skips the hello rather than switch voices", async () => {
      voice.speak.mockImplementation(() => Promise.resolve());
      withVoice();
      net.getFile.mockRejectedValue(new Error("503 speech_unavailable"));
      render(<InterviewSessionView variant="mock" />);
      await begin();

      await waitFor(() => expect(voice.speak).toHaveBeenCalledTimes(1));
      expect(voice.speak.mock.calls[0][0]).toBe(q1.question_text);
      expect(voice.speak.mock.calls[0][2]).toEqual({ audioUrl: null });
      expect(within(transcriptLog()).queryByText(new RegExp(greeting.slice(0, 20)))).toBeNull();
    });

    it("never asks the server for audio when the interviewer has no real voice", async () => {
      controlSpeech();
      render(<InterviewSessionView variant="mock" />);
      await begin();
      await waitFor(() => expect(voice.speak).toHaveBeenCalled());

      expect(net.getFile).not.toHaveBeenCalled();
    });
  });

  it("labels a Vault set with its series and set number", async () => {
    controlSpeech();
    net.get.mockResolvedValue({ qualification: { series_number: 2, set_number: 1 } });
    render(<InterviewSessionView variant="vault" />);

    expect(await screen.findByText("Series 2 · Set 1 of 3")).toBeTruthy();
    expect(screen.getByText("Vault AI Interview")).toBeTruthy();
  });
});
