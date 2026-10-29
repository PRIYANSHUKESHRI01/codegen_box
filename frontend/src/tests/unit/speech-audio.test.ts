import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const net = vi.hoisted(() => ({ getFile: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getFile: net.getFile } }));

import { SpeechAudioCache, playSpeechAudio } from "@/lib/voice/speechAudio";
import { BrowserVoiceEngine } from "@/lib/voice/browserVoiceEngine";

/** An <audio> that can be driven by hand: tests decide when it loads, plays, advances and ends. */
class FakeAudio {
  static instances: FakeAudio[] = [];
  static playResult: "ok" | "reject" = "ok";
  preload = "";
  src = "";
  duration = NaN;
  currentTime = 0;
  paused = true;
  onloadedmetadata: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeAudio.instances.push(this);
  }
  play() {
    if (FakeAudio.playResult === "reject") return Promise.reject(new DOMException("blocked", "NotAllowedError"));
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  // test helpers
  load(duration: number) {
    this.duration = duration;
    this.onloadedmetadata?.();
  }
  startPlaying() {
    this.onplaying?.();
  }
}

let frames: Array<() => void> = [];
beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.playResult = "ok";
  frames = [];
  (globalThis as unknown as Record<string, unknown>).Audio = FakeAudio;
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  URL.createObjectURL = vi.fn(() => `blob:clip-${Math.random()}`);
  URL.revokeObjectURL = vi.fn();
  net.getFile.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (globalThis as unknown as Record<string, unknown>).Audio;
});

/** Runs the animation frames queued so far (one tick of the follower). */
const tick = () => {
  const pending = frames;
  frames = [];
  pending.forEach((cb) => cb());
};

describe("SpeechAudioCache", () => {
  it("downloads each clip once, however many times it is asked for, and hands back a playable URL", async () => {
    net.getFile.mockResolvedValue(new Blob(["wav-bytes"]));
    const cache = new SpeechAudioCache();

    cache.prefetch("q:1", "/interviews/x/questions/1/speech");
    const [first, second] = await Promise.all([cache.get("q:1", "/interviews/x/questions/1/speech"), cache.get("q:1", "/interviews/x/questions/1/speech")]);

    expect(net.getFile).toHaveBeenCalledTimes(1);
    expect(first).toMatch(/^blob:/);
    expect(second).toBe(first);
  });

  it("gives null — use the browser voice — when the server has no voice, sends nothing, or is too slow", async () => {
    const cache = new SpeechAudioCache();

    net.getFile.mockRejectedValueOnce(new Error("503 speech_unavailable"));
    expect(await cache.get("q:1", "/a")).toBeNull();

    net.getFile.mockResolvedValueOnce(new Blob([]));
    expect(await cache.get("q:2", "/b")).toBeNull();

    net.getFile.mockReturnValueOnce(new Promise(() => undefined));
    expect(await cache.get("q:3", "/c", 20)).toBeNull();
  });

  it("releases every URL it made when it is disposed of", async () => {
    net.getFile.mockResolvedValue(new Blob(["x"]));
    const cache = new SpeechAudioCache();
    await cache.get("q:1", "/a");
    await cache.get("q:2", "/b");

    cache.dispose();

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});

describe("playSpeechAudio", () => {
  const TEXT = "Tell me about a project. What was hard?";

  it("reports the moment sound starts, then each word as playback passes it — spread over the clip's real length", () => {
    const onStart = vi.fn();
    const onBoundary = vi.fn();
    const playback = playSpeechAudio("blob:clip", TEXT, { onStart, onBoundary });
    const audio = FakeAudio.instances[0];

    audio.load(8); // an 8-second clip
    audio.startPlaying();
    expect(onStart).toHaveBeenCalledTimes(1);

    tick(); // t = 0: the first word
    expect(onBoundary).toHaveBeenLastCalledWith(0);

    audio.currentTime = 4; // halfway through the clip: about halfway through the words
    tick();
    const middle = onBoundary.mock.calls[onBoundary.mock.calls.length - 1][0];
    expect(middle).toBeGreaterThanOrEqual(TEXT.indexOf("project"));
    expect(middle).toBeLessThanOrEqual(TEXT.indexOf("What") + 2);

    audio.currentTime = 7.9;
    tick();
    expect(onBoundary).toHaveBeenLastCalledWith(TEXT.indexOf("hard?"));

    audio.onended?.();
    return expect(playback.finished).resolves.toBe("ended");
  });

  it("reports each word only once, in order", () => {
    const onBoundary = vi.fn();
    playSpeechAudio("blob:clip", "one two three", { onBoundary });
    const audio = FakeAudio.instances[0];
    audio.load(3);
    audio.startPlaying();

    for (const t of [0, 0.1, 0.2, 1.1, 1.2, 2.1, 2.9]) {
      audio.currentTime = t;
      tick();
    }

    expect(onBoundary.mock.calls.map((c) => c[0])).toEqual([0, 4, 8]);
  });

  it("says it failed — so another voice can take over — when the browser refuses to play it", async () => {
    FakeAudio.playResult = "reject";
    const playback = playSpeechAudio("blob:clip", "Hello there.");

    await expect(playback.finished).resolves.toBe("failed");
  });

  it("says it failed when the file cannot be decoded before any sound, but just ends if it breaks halfway", async () => {
    const early = playSpeechAudio("blob:bad", "Hello.");
    FakeAudio.instances[0].onerror?.();
    await expect(early.finished).resolves.toBe("failed");

    const late = playSpeechAudio("blob:ok", "Hello.");
    FakeAudio.instances[1].startPlaying();
    FakeAudio.instances[1].onerror?.();
    await expect(late.finished).resolves.toBe("ended");
  });

  it("stops the sound on cancel", async () => {
    const playback = playSpeechAudio("blob:clip", "Hello there.");
    const audio = FakeAudio.instances[0];
    audio.startPlaying();

    playback.cancel();

    expect(audio.paused).toBe(true);
    await expect(playback.finished).resolves.toBe("ended");
  });
});

describe("BrowserVoiceEngine with the real voice", () => {
  const synth = () => {
    const spoken: string[] = [];
    Object.assign(window, {
      speechSynthesis: {
        cancel: vi.fn(),
        getVoices: () => [{ name: "Any", lang: "en-US", localService: true, default: true }],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        speak: vi.fn((u: { text: string; onend?: () => void }) => {
          spoken.push(u.text);
          setTimeout(() => u.onend?.(), 0);
        }),
      },
      SpeechSynthesisUtterance: class {
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    return spoken;
  };
  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).speechSynthesis;
    delete (window as unknown as Record<string, unknown>).SpeechSynthesisUtterance;
  });

  it("plays the clip instead of speaking, and the browser voice stays quiet", async () => {
    const spoken = synth();
    const onStart = vi.fn();
    const done = new BrowserVoiceEngine().speak("Hello there.", { onStart }, { audioUrl: "blob:clip" });

    const audio = FakeAudio.instances[0];
    audio.load(2);
    audio.startPlaying();
    audio.onended?.();
    await done;

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(spoken).toEqual([]);
  });

  it("falls back to the browser voice, for the same words, when the clip will not play", async () => {
    const spoken = synth();
    FakeAudio.playResult = "reject";

    await new BrowserVoiceEngine().speak("Hello there.", undefined, { audioUrl: "blob:clip" });

    expect(spoken).toEqual(["Hello there."]);
  });

  it("uses the browser voice as before when there is no clip", async () => {
    const spoken = synth();

    await new BrowserVoiceEngine().speak("Hello there.", undefined, { audioUrl: null });

    expect(spoken).toEqual(["Hello there."]);
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("does not start talking in the browser voice if the candidate leaves while the clip is still starting", async () => {
    const spoken = synth();
    const engine = new BrowserVoiceEngine();
    const done = engine.speak("Hello there.", undefined, { audioUrl: "blob:clip" });

    engine.cancel(); // the page was closed before any sound
    await done;

    expect(spoken).toEqual([]);
  });
});
