import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Camera, ShieldAlert } from "lucide-react";

vi.mock("framer-motion", async (importOriginal) => ({ ...(await importOriginal<typeof import("framer-motion")>()), useReducedMotion: () => true }));

const support = vi.hoisted(() => ({ tts: true, stt: true, recorder: true }));
vi.mock("@/lib/voice/VoiceEngine", () => ({
  hasSpeechSynthesis: () => support.tts,
  hasSpeechRecognition: () => support.stt,
  hasMediaRecorder: () => support.recorder,
}));

const net = vi.hoisted(() => ({ getFile: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getFile: net.getFile } }));

const play = vi.hoisted(() => ({ playSpeechAudio: vi.fn(), cancel: vi.fn() }));
vi.mock("@/lib/voice/speechAudio", () => ({ playSpeechAudio: play.playSpeechAudio }));

import { BeforeYouStart, BriefingGrid, BriefingHero, HowItWorks } from "@/components/dashboard/interviews/briefing/BriefingParts";
import { InterviewerCard } from "@/components/dashboard/interviews/briefing/InterviewerCard";

type Perms = Partial<Record<"camera" | "microphone", PermissionState>>;
function stubPermissions(states: Perms | null) {
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: states === null ? undefined : { query: vi.fn(async ({ name }: { name: "camera" | "microphone" }) => ({ state: states[name] ?? "prompt" })) },
  });
}

beforeEach(() => {
  support.tts = support.stt = support.recorder = true;
  net.getFile.mockReset();
  play.playSpeechAudio.mockReset();
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
  stubPermissions({ camera: "granted", microphone: "granted" });
});
afterEach(cleanup);

describe("the briefing's layout pieces", () => {
  it("puts the interview and the interviewer side by side", () => {
    render(<BriefingGrid main={<p>the interview</p>} aside={<p>the interviewer</p>} />);

    expect(screen.getByText("the interview")).toBeTruthy();
    expect(screen.getByText("the interviewer")).toBeTruthy();
  });

  it("says what the interview is and how far along the candidate is", () => {
    const { container } = render(
      <BriefingHero
        eyebrow={<span>Vault qualification</span>}
        title="Backend Developer — Set 1"
        description="Foundational questions."
        questionCount={5}
        answered={2}
        facts={[
          { label: "Questions", value: 5 },
          { label: "Est. time", value: "~16 min" },
        ]}
        note="Counts toward your series."
      />
    );

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Backend Developer — Set 1");
    expect(screen.getByText("Foundational questions.")).toBeTruthy();
    expect(screen.getByText("~16 min")).toBeTruthy();
    expect(screen.getByText("Counts toward your series.")).toBeTruthy();
    // One pip per question, the answered ones filled.
    expect(container.querySelectorAll(".h-2.w-7")).toHaveLength(5);
    expect(container.querySelectorAll(".h-2.w-7.bg-status-success")).toHaveLength(2);
  });

  it("explains the four beats of an interview, and adapts them to what the browser can do", () => {
    const { rerender } = render(<HowItWorks voiceSupported speechSupported />);
    const steps = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      expect.stringContaining("Listen"),
      expect.stringContaining("Answer"),
      expect.stringContaining("Review"),
      expect.stringContaining("Get scored"),
    ]);
    expect(screen.getByText(/written out live as you talk/)).toBeTruthy();

    rerender(<HowItWorks voiceSupported={false} speechSupported={false} />);
    expect(screen.getByText(/your browser will show it as text instead/)).toBeTruthy();
    expect(screen.getByText(/you'll type your answers instead/)).toBeTruthy();
  });

  it("lists what to do before starting, marking the strike rule as the one to take seriously", () => {
    render(
      <BeforeYouStart
        items={[
          { icon: Camera, text: "Camera on." },
          { icon: ShieldAlert, tone: "warn", text: "After 3 strikes it is locked." },
        ]}
      />
    );

    expect(screen.getByText("Before you start")).toBeTruthy();
    expect(screen.getByText("Camera on.")).toBeTruthy();
    expect(screen.getByText("After 3 strikes it is locked.").previousElementSibling?.className).toContain("status-warning");
  });
});

describe("the interviewer card", () => {
  it("shows the interviewer, the start button the page gives it, and a note under it", () => {
    render(
      <InterviewerCard title="Ready when you are" subtitle="You choose when." footnote="About 16 min in all.">
        <button>Start Set 1</button>
      </InterviewerCard>
    );

    expect(screen.getByRole("region", { name: "Ready when you are" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start Set 1" })).toBeTruthy();
    expect(screen.getByText("About 16 min in all.")).toBeTruthy();
  });

  it("reads this browser and says plainly when everything is in order", async () => {
    render(<InterviewerCard title="Ready" subtitle="s" />);

    expect(await screen.findByText("Looks good")).toBeTruthy();
    expect(screen.getByText("Questions are read aloud to you")).toBeTruthy();
    expect(screen.getByText("Allowed")).toBeTruthy();
  });

  it("warns, while there is time to act, about what will not work", async () => {
    support.tts = false;
    support.stt = false;
    stubPermissions({ camera: "denied", microphone: "granted" });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    render(<InterviewerCard title="Ready" subtitle="s" />);

    expect(await screen.findByText("4 to check")).toBeTruthy();
    expect(screen.getByText(/questions will be shown as text/)).toBeTruthy();
    expect(screen.getByText(/you'll type your answers/)).toBeTruthy();
    expect(screen.getByText(/Blocked for this site/)).toBeTruthy();
    expect(screen.getByText(/can't go fullscreen/)).toBeTruthy();
  });

  it("treats a browser that won't say whether the camera is allowed as fine — it is simply asked at the start", async () => {
    stubPermissions(null);
    render(<InterviewerCard title="Ready" subtitle="s" />);

    expect(await screen.findByText(/asked to allow them when you start/)).toBeTruthy();
    expect(screen.getByText("Looks good")).toBeTruthy();
  });

  it("can leave the checks out (for a finished interview)", () => {
    render(<InterviewerCard title="Complete" subtitle="s" showChecks={false} />);

    expect(screen.queryByRole("list", { name: "Your setup" })).toBeNull();
  });

  it("offers a preview of the interviewer's voice only when there is a real voice to preview", async () => {
    const { rerender } = render(<InterviewerCard title="Ready" subtitle="s" />);
    await screen.findByText("Looks good");
    expect(screen.queryByRole("button", { name: /Hear your interviewer/ })).toBeNull();

    rerender(<InterviewerCard title="Ready" subtitle="s" voicePreview={{ text: "Hi, I'm your interviewer." }} />);
    expect(screen.getByRole("button", { name: /Hear your interviewer/ })).toBeTruthy();
  });

  it("plays the interviewer's hello on request, says it is speaking, and is ready to be played again", async () => {
    let finish: (value: "ended") => void = () => undefined;
    let callbacks: { onStart?: () => void } = {};
    net.getFile.mockResolvedValue(new Blob(["wav"]));
    play.playSpeechAudio.mockImplementation((_url: string, _text: string, cb: { onStart?: () => void }) => {
      callbacks = cb;
      return { finished: new Promise((resolve) => (finish = resolve)), cancel: play.cancel };
    });
    render(<InterviewerCard title="Ready" subtitle="s" voicePreview={{ text: "Hi, I'm your interviewer." }} />);

    fireEvent.click(screen.getByRole("button", { name: /Hear your interviewer/ }));
    await vi.waitFor(() => expect(play.playSpeechAudio).toHaveBeenCalled());
    expect(net.getFile).toHaveBeenCalledWith("/interviews-speech/lines/greeting");
    expect(play.playSpeechAudio.mock.calls[0][1]).toBe("Hi, I'm your interviewer.");

    act(() => callbacks.onStart?.());
    expect(screen.getByRole("button", { name: /Speaking/ })).toBeTruthy();

    await act(async () => finish("ended"));
    expect(screen.getByRole("button", { name: /Hear your interviewer/ })).toBeTruthy();
  });

  it("quietly does nothing when the clip can't be fetched", async () => {
    net.getFile.mockRejectedValue(new Error("503"));
    render(<InterviewerCard title="Ready" subtitle="s" voicePreview={{ text: "Hi." }} />);

    fireEvent.click(screen.getByRole("button", { name: /Hear your interviewer/ }));

    expect(await screen.findByRole("button", { name: /Hear your interviewer/ })).toBeTruthy();
    expect(play.playSpeechAudio).not.toHaveBeenCalled();
  });
});
