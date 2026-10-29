import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async (importOriginal) => ({ ...(await importOriginal<typeof import("framer-motion")>()), useReducedMotion: () => true }));

import { InterviewBoot } from "@/components/dashboard/interviews/room/InterviewBoot";
import { InterviewLobby, type InterviewLobbyProps } from "@/components/dashboard/interviews/room/InterviewLobby";
import { depthStyle, LiveTranscript, type TranscriptTurn } from "@/components/dashboard/interviews/room/LiveTranscript";
import { SILENCE_NOTICE_MS, useOnline, useSilenceWatch } from "@/components/dashboard/interviews/room/useRoomHealth";
import { InterviewProctoringConsentGate } from "@/components/proctoring/InterviewProctoringConsentGate";
import { InterviewProctoringLockedScreen } from "@/components/proctoring/InterviewProctoringLockedScreen";
import { InterviewSessionHud } from "@/components/proctoring/InterviewSessionHud";
import { resetIntegrityUi, setIntegrityUi } from "@/lib/integrity/store";
import type { IntegrityPolicy, PreflightCheck } from "@/lib/integrity/types";
import { Camera } from "lucide-react";

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  resetIntegrityUi();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetIntegrityUi();
});

const lobby = (over: Partial<InterviewLobbyProps> = {}): InterviewLobbyProps => ({
  sessionLabel: "AI Interview",
  candidateName: "Asha Rao",
  previewVideoRef: { current: null },
  cameraStream: null,
  devicePreviewReady: false,
  onEnableDevices: vi.fn(),
  onConsent: vi.fn(),
  starting: false,
  blocked: false,
  startLabel: "Start Proctored Interview",
  consentError: null,
  rules: [
    { icon: Camera, text: "Your camera stays on." },
    { icon: Camera, tone: "warn", text: "Leaving this window counts as a strike." },
  ],
  disclosure: null,
  footer: "By continuing you consent.",
  ...over,
});

const check = (over: Partial<PreflightCheck> & Pick<PreflightCheck, "id" | "label">): PreflightCheck => ({ status: "ok", required: true, ...over });

describe("the interview lobby (the proctored guide screen)", () => {
  it("greets the candidate by first name, on the aptRun brand, with the rules and the strike meter", () => {
    render(<InterviewLobby {...lobby()} />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Let's get you set up, Asha.");
    expect(screen.getByRole("img", { name: "AptRun" })).toBeTruthy();
    expect(screen.getByText("Your camera stays on.")).toBeTruthy();
    expect(screen.getByText("3 strikes")).toBeTruthy();
    expect(screen.getByText(/Leaving this window counts as a strike/)).toBeTruthy();
  });

  it("asks for the camera and microphone first, from the preview area and from the bottom bar", () => {
    const onEnableDevices = vi.fn();
    render(<InterviewLobby {...lobby({ onEnableDevices })} />);

    const buttons = screen.getAllByRole("button", { name: /Enable camera & (mic|microphone)/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onEnableDevices).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/First, allow your camera and microphone/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start Proctored Interview" })).toBeNull();
  });

  it("offers Start once the devices are on, and starts when pressed", () => {
    const onConsent = vi.fn();
    render(<InterviewLobby {...lobby({ devicePreviewReady: true, onConsent })} />);

    fireEvent.click(screen.getByRole("button", { name: "Start Proctored Interview" }));
    expect(onConsent).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Everything checks out. Start when you are ready.")).toBeTruthy();
    expect(screen.getByText(/Say a few words to test it/)).toBeTruthy();
  });

  it("holds the button and says exactly what is still missing while a required check is not green", () => {
    setIntegrityUi({
      policy: { camera: "required" } as unknown as IntegrityPolicy,
      checks: [check({ id: "browser", label: "Browser" }), check({ id: "screen", label: "Screen share", status: "pending" })],
    });
    const onConsent = vi.fn();
    render(<InterviewLobby {...lobby({ devicePreviewReady: true, onConsent })} />);

    const start = screen.getByRole("button", { name: "Finish the system check to start" }) as HTMLButtonElement;
    expect(start.disabled).toBe(true);
    expect(screen.getByText("Still needed: Screen share")).toBeTruthy();
    expect(screen.getByRole("list", { name: "System check" })).toBeTruthy();
  });

  it("shows the consent error, a starting state, and lets the candidate leave without starting", () => {
    const onLeave = vi.fn();
    render(<InterviewLobby {...lobby({ devicePreviewReady: true, starting: true, consentError: "Fullscreen was refused.", onLeave })} />);

    expect(screen.getByRole("alert").textContent).toBe("Fullscreen was refused.");
    expect((screen.getByRole("button", { name: /Starting/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Leave/ }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("is what the interview's consent gate renders, with the interview's own rules", () => {
    render(
      <InterviewProctoringConsentGate
        phase="consent"
        consentError={null}
        devicePreviewReady
        previewVideoRef={{ current: null }}
        onEnableDevices={vi.fn()}
        onConsent={vi.fn()}
        candidateName="Asha Rao"
        sessionLabel="Vault AI Interview"
        sessionNote="Series 1 · Set 2 of 3"
      />
    );

    expect(screen.getByTestId("interview-lobby")).toBeTruthy();
    expect(screen.getByText("Series 1 · Set 2 of 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start Proctored Interview" })).toBeTruthy();
    expect(screen.getByText(/3rd strike ends your attempt/)).toBeTruthy();
  });
});

describe("the boot screen", () => {
  it("is the one screen shown while the interview loads, on the room's backdrop with the AptRun brand", () => {
    const { container } = render(<InterviewBoot />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Getting your interview ready")).toBeTruthy();
    expect(screen.getByRole("img", { name: "AptRun" })).toBeTruthy();
    expect(Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src"))).toContain("/brand/aptrun-monogram.png");
  });
});

describe("the locked screen", () => {
  it("is on the same backdrop and sends the candidate back", () => {
    const onBack = vi.fn();
    render(<InterviewProctoringLockedScreen session={{ status: "locked", violation_count: 3, max_violations: 3, locked_at: null }} onBack={onBack} />);

    expect(screen.getByTestId("interview-locked")).toBeTruthy();
    expect(screen.getByText(/locked out of this interview/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Back to Interviews/ }));
    expect(onBack).toHaveBeenCalled();
  });
});

describe("the proctoring watermark", () => {
  const hud = (container: HTMLElement) => container.querySelector(".pointer-events-none.select-none") as HTMLElement;

  it("never prints the candidate's name", () => {
    const { container } = render(
      <InterviewSessionHud embedded phase="active" session={null} lastViolation={null} candidateName="Asha Rao" cameraStream={null} onResumeFullscreen={vi.fn()} />
    );

    expect(hud(container).textContent).not.toMatch(/Asha|Rao/);
    expect(hud(container).textContent).toContain("AptRun");
  });

  it("carries the attempt's reference instead, so a leaked screenshot can still be traced", () => {
    setIntegrityUi({ marker: "7F3A21" });
    const { container } = render(
      <InterviewSessionHud embedded phase="active" session={null} lastViolation={null} candidateName="Asha Rao" cameraStream={null} onResumeFullscreen={vi.fn()} />
    );

    expect(hud(container).textContent).toContain("#7F3A21");
    expect(hud(container).textContent).not.toMatch(/Asha|Rao/);
  });

  it("offers a way back into fullscreen, in a dialog", () => {
    const onResume = vi.fn();
    render(<InterviewSessionHud embedded phase="fullscreen_lost" session={null} lastViolation={null} candidateName="Asha Rao" cameraStream={null} onResumeFullscreen={onResume} />);

    expect(screen.getByRole("alertdialog", { name: "You left fullscreen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume Fullscreen" }));
    expect(onResume).toHaveBeenCalled();
  });
});

const turn = (over: Partial<TranscriptTurn> & Pick<TranscriptTurn, "id" | "role" | "text">): TranscriptTurn => ({ active: false, settled: true, ...over });

describe("the transcript is drawn straight onto the screen", () => {
  it("has no card around it: no border, no panel background, no shadow", () => {
    render(<LiveTranscript speaker="ai" turns={[turn({ id: "q1-ai", role: "ai", text: "Hello", active: true })]} />);

    const section = screen.getByRole("region", { name: "Live transcript" });
    expect(section.className).not.toMatch(/\bborder\b|bg-surface|shadow|rounded-\[/);
  });

  it("lets what has been said slip back into the screen, the further back the fainter", () => {
    const now = depthStyle(0, false, false);
    const prev = depthStyle(1, false, false);
    const older = depthStyle(2, false, false);
    const oldest = depthStyle(5, false, false);

    expect(now).toEqual({ opacity: 1, scale: 1, blur: 0 });
    expect(prev.opacity).toBeLessThan(now.opacity);
    expect(older.opacity).toBeLessThan(prev.opacity);
    expect(oldest.opacity).toBeLessThan(older.opacity);
    expect(prev.scale).toBeLessThan(1);
    expect(oldest.scale).toBeLessThan(older.scale);
    expect(prev.blur).toBe(0); // the previous turn stays crisp — it is still being read from
    expect(oldest.blur).toBeGreaterThan(older.blur);
  });

  it("brings everything forward, in focus, while the reader is scrolling back through it", () => {
    for (const distance of [0, 1, 2, 5]) {
      expect(depthStyle(distance, true, false)).toEqual({ opacity: 0.92, scale: 1, blur: 0 });
    }
  });

  it("never blurs under reduced motion", () => {
    expect(depthStyle(2, false, true).blur).toBe(0);
    expect(depthStyle(9, false, true).blur).toBe(0);
  });
});

describe("real-time health", () => {
  // The watch measures with performance.now(), which has to be faked along with the timers.
  const fakeClock = () => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });

  it("notices a microphone that has been open and silent for too long, and clears the moment sound returns", () => {
    fakeClock();
    const signal = { level: 0, pulse: 0 };
    const { result } = renderHook(() => useSilenceWatch(signal, true));
    expect(result.current).toBe(false);

    act(() => void vi.advanceTimersByTime(SILENCE_NOTICE_MS - 500));
    expect(result.current).toBe(false);

    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current).toBe(true);

    signal.level = 0.3;
    act(() => void vi.advanceTimersByTime(300));
    expect(result.current).toBe(false);
  });

  it("does not run, and so never complains, when the microphone isn't open", () => {
    fakeClock();
    const { result } = renderHook(() => useSilenceWatch({ level: 0, pulse: 0 }, false));
    act(() => void vi.advanceTimersByTime(SILENCE_NOTICE_MS * 3));
    expect(result.current).toBe(false);
  });

  it("starts the silence clock again for each new answer", () => {
    fakeClock();
    const signal = { level: 0, pulse: 0 };
    const { result, rerender } = renderHook(({ active }) => useSilenceWatch(signal, active), { initialProps: { active: true } });
    act(() => void vi.advanceTimersByTime(SILENCE_NOTICE_MS + 500));
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);
    rerender({ active: true });
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current).toBe(false);
  });

  it("follows the browser going offline and coming back", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(result.current).toBe(false);

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    act(() => void window.dispatchEvent(new Event("online")));
    expect(result.current).toBe(true);
  });
});
