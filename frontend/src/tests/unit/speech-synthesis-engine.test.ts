import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserVoiceEngine, pickVoice } from "@/lib/voice/browserVoiceEngine";

/**
 * The speaking half of BrowserVoiceEngine: what it reports while the interviewer reads a question aloud (so the transcript can follow
 * along word by word), and the ways real browsers leave it hanging that it has to survive.
 */

class FakeUtterance {
  text: string;
  voice: unknown = null;
  lang = "";
  rate = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: ((event: { name?: string; charIndex: number }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const voice = (name: string, lang: string, extra: Partial<SpeechSynthesisVoice> = {}) =>
  ({ name, lang, localService: true, default: false, voiceURI: name, ...extra }) as SpeechSynthesisVoice;

let spoken: FakeUtterance[];
let voices: SpeechSynthesisVoice[];
let voicesChanged: Array<() => void>;
let synth: {
  cancel: ReturnType<typeof vi.fn>;
  speak: ReturnType<typeof vi.fn>;
  getVoices: () => SpeechSynthesisVoice[];
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  spoken = [];
  voices = [voice("Microsoft Zira", "en-US")];
  voicesChanged = [];
  synth = {
    cancel: vi.fn(),
    speak: vi.fn((u: FakeUtterance) => spoken.push(u)),
    getVoices: () => voices,
    addEventListener: vi.fn((_event: string, cb: () => void) => voicesChanged.push(cb)),
    removeEventListener: vi.fn(),
  };
  Object.assign(window, { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance });
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as unknown as Record<string, unknown>).speechSynthesis;
  delete (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
});

describe("BrowserVoiceEngine.speak", () => {
  it("reports when the voice starts and each word it reaches, and resolves when it ends", async () => {
    const onStart = vi.fn();
    const onBoundary = vi.fn();
    const done = new BrowserVoiceEngine().speak("Tell me about yourself", { onStart, onBoundary });
    await vi.waitFor(() => expect(spoken).toHaveLength(1));

    const utterance = spoken[0];
    utterance.onstart?.();
    utterance.onboundary?.({ name: "word", charIndex: 0 });
    utterance.onboundary?.({ name: "sentence", charIndex: 0 });
    utterance.onboundary?.({ name: "word", charIndex: 8 });
    utterance.onend?.();
    await done;

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onBoundary.mock.calls).toEqual([[0], [8]]);
  });

  it("resolves when the browser reports an error instead of an end", async () => {
    const done = new BrowserVoiceEngine().speak("Hello");
    await vi.waitFor(() => expect(spoken).toHaveLength(1));
    spoken[0].onerror?.();
    await expect(done).resolves.toBeUndefined();
  });

  it("does not wait forever for a voice that goes quiet without ever ending", async () => {
    vi.useFakeTimers();
    const text = "Describe a time you disagreed with a teammate";
    let resolved = false;
    const done = new BrowserVoiceEngine().speak(text).then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(spoken).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(text.length * 140 + 4000);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1500);
    await done;
    expect(resolved).toBe(true);
    // It also tells the browser to stop, so a late voice doesn't talk over the candidate's answer.
    expect(synth.cancel.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("waits briefly for the browser's voice list, then speaks with the best voice in it", async () => {
    voices = [];
    const done = new BrowserVoiceEngine().speak("Hello there");
    await Promise.resolve();
    expect(spoken).toHaveLength(0);

    voices = [voice("Microsoft David", "en-US"), voice("Microsoft Neerja Online (Natural) - English (India)", "en-IN", { localService: false })];
    voicesChanged.forEach((cb) => cb());
    await vi.waitFor(() => expect(spoken).toHaveLength(1));

    expect((spoken[0].voice as SpeechSynthesisVoice).name).toContain("Neerja");
    expect(spoken[0].lang).toBe("en-IN");
    spoken[0].onend?.();
    await done;
  });

  it("speaks anyway, in the default voice, if the list never arrives", async () => {
    vi.useFakeTimers();
    voices = [];
    const done = new BrowserVoiceEngine().speak("Hello");
    await vi.advanceTimersByTimeAsync(450);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].voice).toBeNull();
    spoken[0].onend?.();
    await done;
  });
});

describe("pickVoice", () => {
  it("prefers a neural voice over every other kind", () => {
    const list = [voice("Microsoft David", "en-US", { default: true }), voice("Microsoft Aria Online (Natural) - English (United States)", "en-US", { localService: false })];
    expect(pickVoice(list)?.name).toContain("Aria");
  });

  it("prefers Indian English, then a voice that runs on this machine", () => {
    expect(pickVoice([voice("A", "en-US"), voice("B", "en-IN")])?.name).toBe("B");
    expect(pickVoice([voice("Network", "en-US", { localService: false }), voice("Local", "en-US")])?.name).toBe("Local");
  });

  it("ignores voices that are not English, and returns null when none are", () => {
    expect(pickVoice([voice("Hindi", "hi-IN"), voice("French", "fr-FR")])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
});
