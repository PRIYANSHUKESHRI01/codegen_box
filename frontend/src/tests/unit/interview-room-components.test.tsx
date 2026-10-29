import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Reduced motion makes every animation land instantly, which is what lets a unit test read the end state.
vi.mock("framer-motion", async (importOriginal) => ({ ...(await importOriginal<typeof import("framer-motion")>()), useReducedMotion: () => true }));

import { AnimatedWords } from "@/components/dashboard/interviews/room/AnimatedWords";
import { InterviewRoom, type InterviewRoomProps } from "@/components/dashboard/interviews/room/InterviewRoom";
import { LiveTranscript, type TranscriptTurn } from "@/components/dashboard/interviews/room/LiveTranscript";

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});
afterEach(cleanup);

const opacityOf = (word: string) => (screen.getByText(word) as HTMLElement).style.opacity;

describe("AnimatedWords", () => {
  it("shows only the words that have been said, keeping the others in place but invisible", () => {
    render(<AnimatedWords text="Tell me about yourself" revealed={2} />);

    expect(opacityOf("Tell")).toBe("1");
    expect(opacityOf("me")).toBe("1");
    expect(opacityOf("about")).toBe("0");
    expect(opacityOf("yourself")).toBe("0");
  });

  it("puts the cursor right after the last word that has been said, not at the end of the hidden ones", () => {
    const { container } = render(<AnimatedWords text="a b c d" revealed={2} caret />);

    const cursor = container.querySelector("span[aria-hidden]") as HTMLElement;
    expect(cursor).toBeTruthy();
    const wordBeforeCursor = cursor.previousSibling?.previousSibling as HTMLElement; // [word] [space] [cursor]
    expect(wordBeforeCursor.textContent).toBe("b");
  });

  it("shows every word once the revealed count is left out, with the cursor after the last", () => {
    const { container } = render(<AnimatedWords text="one two" caret />);

    expect(opacityOf("one")).toBe("1");
    expect(opacityOf("two")).toBe("1");
    const cursor = container.querySelector("span[aria-hidden]") as HTMLElement;
    expect((cursor.previousSibling?.previousSibling as HTMLElement).textContent).toBe("two");
  });

  it("draws words the recognizer has not committed yet in a muted colour", () => {
    render(<AnimatedWords text="I built a chat" provisionalFrom={2} />);

    expect(screen.getByText("built").className).not.toContain("text-text-muted");
    expect(screen.getByText("a").className).toContain("text-text-muted");
    expect(screen.getByText("chat").className).toContain("text-text-muted");
  });

  it("highlights the word being spoken while the interviewer is mid-sentence, and stops when they finish", () => {
    const { rerender } = render(<AnimatedWords text="one two three" revealed={2} />);
    expect(screen.getByText("two").className).toContain("text-accent-primary");
    expect(screen.getByText("one").className).not.toContain("text-accent-primary");

    rerender(<AnimatedWords text="one two three" revealed={3} />);
    expect(screen.getByText("three").className).not.toContain("text-accent-primary");
  });
});

const turn = (over: Partial<TranscriptTurn> & Pick<TranscriptTurn, "id" | "role" | "text">): TranscriptTurn => ({ active: false, settled: true, ...over });

describe("LiveTranscript", () => {
  it("lists both sides in order and announces only finished turns to screen readers", () => {
    render(
      <LiveTranscript
        speaker="ai"
        turns={[
          turn({ id: "q1-ai", role: "ai", text: "What is a closure?" }),
          turn({ id: "q1-you", role: "you", text: "A function that remembers its scope" }),
          turn({ id: "q2-ai", role: "ai", text: "Explain event loops", active: true, settled: false, revealedWords: 1 }),
        ]}
      />
    );

    const log = screen.getByRole("log", { name: "Interview transcript" });
    expect(within(log).getByText("AptRun Interviewer: What is a closure?")).toBeTruthy();
    expect(within(log).getByText("You: A function that remembers its scope")).toBeTruthy();
    // The question still being asked is not read out word by word.
    expect(within(log).queryByText(/event loops/)).toBeNull();
    // The interviewer is mid-question, so that turn carries the live marker.
    expect(screen.getByText("LIVE")).toBeTruthy();
  });

  it("marks the turn that is happening right now as live — and nothing when no one is talking", () => {
    const turns = [
      turn({ id: "q1-ai", role: "ai", text: "Question one", active: true }),
      turn({ id: "q1-you", role: "you", text: "My answer", active: true, settled: false }),
    ];
    const { rerender } = render(<LiveTranscript speaker="you" turns={turns} />);
    // Only the candidate's turn is live while they are the one speaking.
    expect(screen.getAllByText("LIVE")).toHaveLength(1);
    expect(screen.getByText("My").closest("li")?.textContent).toContain("LIVE");

    rerender(<LiveTranscript speaker="idle" turns={turns} />);
    expect(screen.queryByText("LIVE")).toBeNull();
  });

  it("shows a muted placeholder while the candidate has said nothing yet", () => {
    render(<LiveTranscript speaker="you" turns={[turn({ id: "a-you", role: "you", text: "", placeholder: "Your answer will appear here", settled: false })]} />);
    expect(screen.getByText(/Your answer will appear here/)).toBeTruthy();
  });

  it("renders an editor in place of the words when the turn has one", () => {
    render(<LiveTranscript speaker="you" turns={[turn({ id: "a-you", role: "you", text: "draft", active: true, settled: false, editor: <textarea aria-label="Edit answer" defaultValue="draft" /> })]} />);
    expect((screen.getByLabelText("Edit answer") as HTMLTextAreaElement).value).toBe("draft");
  });

  it("lets go of the live edge when the reader scrolls up, and offers a way back", () => {
    const { container } = render(<LiveTranscript speaker="you" turns={[turn({ id: "q1-ai", role: "ai", text: "A long transcript" })]} />);
    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 300 });

    expect(screen.queryByRole("button", { name: /Back to live/i })).toBeNull();

    scroller.scrollTop = 100; // well above the bottom (700)
    fireEvent.scroll(scroller);
    const back = screen.getByRole("button", { name: /Back to live/i });

    act(() => {
      fireEvent.click(back);
    });
    expect(scroller.scrollTop).toBe(700);
  });
});

const room = (over: Partial<InterviewRoomProps> = {}): InterviewRoomProps => ({
  sessionLabel: "AI Interview",
  steps: [
    { label: "1 · Technical", state: "done" },
    { label: "2 · HR", state: "current" },
    { label: "Question 3", state: "todo" },
  ],
  elapsedSeconds: 125,
  strikes: <span>0/3 strikes</span>,
  mode: "idle",
  signal: { level: 0, pulse: 0 },
  status: { key: "prep", title: "Get ready to answer", countdown: { secondsLeft: 8, totalSeconds: 10, label: "until recording" } },
  actions: <button>Start now</button>,
  cameraStream: null,
  candidateName: "Asha Rao",
  micLabel: "Microphone Array (Realtek)",
  micLive: false,
  micUnavailable: false,
  turns: [turn({ id: "q1-ai", role: "ai", text: "Tell me about yourself", active: true })],
  speaker: "idle",
  online: true,
  ...over,
});

describe("InterviewRoom", () => {
  it("is branded AptRun, with the monogram at its centre", () => {
    const { container } = render(<InterviewRoom {...room()} />);

    expect(screen.getByRole("img", { name: "AptRun" })).toBeTruthy(); // the wordmark, top-left
    const marks = Array.from(container.querySelectorAll("img")).map((img) => img.getAttribute("src"));
    expect(marks).toContain("/brand/aptrun-monogram.png"); // the orb's centre disc
  });

  it("shows the clock, the mic, the camera tile, the strike counter and the controls", () => {
    render(<InterviewRoom {...room()} />);

    expect(screen.getByText("2:05")).toBeTruthy();
    expect(screen.getByText("Mic: Microphone Array (Realtek)")).toBeTruthy();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("0/3 strikes")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start now" })).toBeTruthy();
    expect(screen.getByText("Get ready to answer")).toBeTruthy();
  });

  it("counts down in a timer that screen readers are not asked to read out every second", () => {
    render(<InterviewRoom {...room()} />);

    const timer = screen.getByRole("timer");
    expect(timer.textContent).toContain("0:08");
    expect(timer.getAttribute("aria-live")).toBe("off");
  });

  it("marks the current question in the progress bar", () => {
    render(<InterviewRoom {...room()} />);

    for (const bar of screen.getAllByRole("list", { name: "Interview progress" })) {
      const items = within(bar).getAllByRole("listitem");
      expect(items).toHaveLength(3);
      expect(items[1].getAttribute("aria-current")).toBe("step");
      expect(items[0].getAttribute("aria-current")).toBeNull();
    }
  });

  it("says so when the camera is unavailable and the mic is not being used", () => {
    render(<InterviewRoom {...room({ micUnavailable: true })} />);

    expect(screen.getByText("Camera unavailable")).toBeTruthy();
    expect(screen.getByText(/Typing instead/i)).toBeTruthy();
  });

  it("opens the help panel from the corner button and closes it on Escape", () => {
    render(<InterviewRoom {...room()} />);

    fireEvent.click(screen.getByRole("button", { name: /Having trouble/i }));
    expect(screen.getByRole("dialog", { name: "Interview help" })).toBeTruthy();
    expect(screen.getByText(/Can't hear the question/i)).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    // AnimatePresence plays the exit animation first; under reduced motion it is removed on the next frame.
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(screen.queryByRole("dialog", { name: "Interview help" })).toBeNull();
        resolve();
      }, 400)
    );
  });
});
