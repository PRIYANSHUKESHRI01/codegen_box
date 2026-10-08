import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { estimateMs, ListeningPlayerEngine, type Segment, type SynthLike, type UtteranceLike, type UtteranceOptions } from "@/lib/listening/playerEngine";
import type { VoiceLike } from "@/lib/listening/voices";

/**
 * The player engine against a fake speech synthesiser. Each behaviour here is
 * one a real student hits: the queue advancing sentence by sentence, pausing
 * and resuming, replaying, switching speed mid-sentence, the exam rules, and
 * the browser quirks (an `onend` that never comes, a late callback from a
 * sentence we already cancelled, autoplay being blocked).
 */

interface Spoken {
  text: string;
  options: UtteranceOptions;
  utterance: UtteranceLike;
}

class FakeSynth implements SynthLike {
  spoken: Spoken[] = [];
  cancels = 0;
  voices: VoiceLike[] = [];
  private voiceListener: (() => void) | null = null;
  pendingOptions: UtteranceOptions[] = [];

  speak(utterance: UtteranceLike) {
    const options = this.pendingOptions.shift()!;
    this.spoken.push({ text: (utterance as unknown as { text: string }).text, options, utterance });
  }
  cancel() {
    this.cancels += 1;
  }
  getVoices() {
    return this.voices;
  }
  onVoicesChanged(listener: () => void) {
    this.voiceListener = listener;
    return () => {
      this.voiceListener = null;
    };
  }
  /** Simulates Chrome finishing its async voice load. */
  loadVoices(voices: VoiceLike[]) {
    this.voices = voices;
    this.voiceListener?.();
  }
  get last(): Spoken {
    return this.spoken[this.spoken.length - 1];
  }
  texts() {
    return this.spoken.map((s) => s.text);
  }
  /** The browser reporting that the latest sentence finished. */
  end(which: Spoken = this.last) {
    which.utterance.onend?.();
  }
  error(error: string, which: Spoken = this.last) {
    which.utterance.onerror?.({ error });
  }
}

function makeEngine(synth: FakeSynth | null = new FakeSynth()) {
  const engine = new ListeningPlayerEngine({
    synth,
    createUtterance: (text, options) => {
      synth?.pendingOptions.push(options);
      return { text, onstart: null, onend: null, onerror: null } as unknown as UtteranceLike;
    },
  });
  return { engine, synth };
}

const seg = (texts: string[], speakers: (string | null)[] = []): Segment[] => texts.map((text, index) => ({ index, text, speaker: speakers[index] ?? null }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("sequence playback", () => {
  it("speaks one sentence at a time and advances only when the previous one ends", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two.", "Three."]), null);

    engine.play();
    expect(synth!.texts()).toEqual(["One."]);
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", index: 0, plays: 1, total: 3 });

    vi.advanceTimersByTime(3000); // nothing ends -> the next sentence must not start by itself (still inside the watchdog's allowance)
    expect(synth!.texts()).toEqual(["One."]);

    synth!.end();
    vi.advanceTimersByTime(380);
    expect(synth!.texts()).toEqual(["One.", "Two."]);
    expect(engine.getSnapshot().index).toBe(1);
  });

  it("finishes in the ended state after the last sentence and counts exactly one play", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);

    engine.play();
    synth!.end();
    vi.advanceTimersByTime(380);
    synth!.end();

    expect(engine.getSnapshot()).toMatchObject({ status: "ended", index: 1, plays: 1 });
    expect(synth!.texts()).toEqual(["One.", "Two."]);
  });

  it("pauses longer when the speaker changes than when the same person keeps talking", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["A one.", "A two.", "B one."], ["A", "A", "B"]), [{ key: "A", gender: null }, { key: "B", gender: null }]);

    engine.play();
    synth!.end();
    vi.advanceTimersByTime(380); // same speaker: short gap
    expect(synth!.texts()).toHaveLength(2);

    synth!.end();
    vi.advanceTimersByTime(380); // speaker changes: 380ms is not enough
    expect(synth!.texts()).toHaveLength(2);
    vi.advanceTimersByTime(400);
    expect(synth!.texts()).toHaveLength(3);
  });

  it("starting play twice does not speak twice", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);

    engine.play();
    engine.play();

    expect(synth!.texts()).toEqual(["One."]);
    expect(engine.getSnapshot().plays).toBe(1);
  });

  it("does nothing for a lesson with no sentences", () => {
    const { engine, synth } = makeEngine();
    engine.load([], null);

    engine.play();

    expect(synth!.spoken).toHaveLength(0);
    expect(engine.getSnapshot().status).toBe("idle");
  });
});

describe("pause and resume", () => {
  it("pause stops the speech and remembers the sentence; play resumes that same sentence without costing a play", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two.", "Three."]), null);
    engine.play();
    synth!.end();
    vi.advanceTimersByTime(380);
    expect(engine.getSnapshot().index).toBe(1);

    const cancelsBefore = synth!.cancels;
    engine.pause();
    expect(synth!.cancels).toBeGreaterThan(cancelsBefore);
    expect(engine.getSnapshot()).toMatchObject({ status: "paused", index: 1, plays: 1 });

    engine.play();
    expect(synth!.texts()).toEqual(["One.", "Two.", "Two."]);
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", plays: 1 });
  });

  it("a late callback from the sentence that was cancelled by pausing does nothing", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    engine.play();
    const first = synth!.last;

    engine.pause();
    first.utterance.onend?.(); // the browser reports the cancelled sentence ending, late
    vi.advanceTimersByTime(5000);

    expect(synth!.texts()).toEqual(["One."]);
    expect(engine.getSnapshot().status).toBe("paused");
  });

  it("toggle flips between playing and paused", () => {
    const { engine } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);

    engine.toggle();
    expect(engine.getSnapshot().status).toBe("playing");
    engine.toggle();
    expect(engine.getSnapshot().status).toBe("paused");
  });

  it("playing again after the lesson ended starts from the top and counts a second play", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["Only one."]), null);
    engine.play();
    synth!.end();
    expect(engine.getSnapshot().status).toBe("ended");

    engine.play();

    expect(engine.getSnapshot()).toMatchObject({ status: "playing", index: 0, plays: 2 });
    expect(synth!.texts()).toEqual(["Only one.", "Only one."]);
  });
});

describe("seeking and replaying", () => {
  it("seeking while playing carries on playing from the new sentence", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two.", "Three."]), null);
    engine.play();

    engine.seek(2);

    expect(synth!.last.text).toBe("Three.");
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", index: 2, plays: 1 });
  });

  it("seeking while idle or paused waits there, paused, instead of starting playback", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two.", "Three."]), null);

    engine.seek(1);

    expect(synth!.spoken).toHaveLength(0);
    expect(engine.getSnapshot()).toMatchObject({ status: "paused", index: 1 });
    engine.play();
    expect(synth!.last.text).toBe("Two.");
  });

  it("clamps out-of-range seeks", () => {
    const { engine } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);

    engine.seek(99);
    expect(engine.getSnapshot().index).toBe(1);
    engine.seek(-5);
    expect(engine.getSnapshot().index).toBe(0);
  });

  it("replayCurrent says the current sentence again and then carries on", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two.", "Three."]), null);
    engine.play();
    synth!.end();
    vi.advanceTimersByTime(380);

    engine.replayCurrent();
    expect(synth!.texts()).toEqual(["One.", "Two.", "Two."]);

    synth!.end();
    vi.advanceTimersByTime(380);
    expect(synth!.last.text).toBe("Three.");
  });

  it("playOne plays exactly one sentence and then stops, paused on it", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two.", "Three."]), null);

    engine.playOne(1);
    expect(synth!.texts()).toEqual(["Two."]);
    expect(engine.getSnapshot()).toMatchObject({ status: "playing", single: true, index: 1 });

    synth!.end();
    vi.advanceTimersByTime(5000);

    expect(synth!.texts()).toEqual(["Two."]);
    expect(engine.getSnapshot()).toMatchObject({ status: "paused", single: false, index: 1 });
  });

  it("playOne does not count as a full play", () => {
    const { engine } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);

    engine.playOne(0);

    expect(engine.getSnapshot().plays).toBe(0);
  });
});

describe("speed", () => {
  it("changing speed mid-sentence restarts that sentence at the new speed", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    engine.play();
    expect(synth!.last.options.rate).toBe(1);

    engine.setRate(0.75);

    expect(synth!.texts()).toEqual(["One.", "One."]);
    expect(synth!.last.options.rate).toBe(0.75);
    expect(engine.getSnapshot().rate).toBe(0.75);
  });

  it("the new speed applies to the sentences that follow", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    engine.setRate(1.25);
    engine.play();
    synth!.end();
    vi.advanceTimersByTime(380);

    expect(synth!.last.options.rate).toBe(1.25);
  });

  it("only the offered speeds are accepted", () => {
    const { engine } = makeEngine();
    engine.load(seg(["One."]), null);

    engine.setRate(3);
    expect(engine.getSnapshot().rate).toBe(1);
    engine.setRate(1.25);
    engine.setRate(0.9);
    expect(engine.getSnapshot().rate).toBe(1);
  });
});

describe("exam rules", () => {
  it("allows exactly the configured number of full plays", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["Only one."]), null);
    engine.configure({ maxPlays: 2, locked: true });

    engine.play();
    synth!.end();
    engine.play();
    synth!.end();
    expect(engine.getSnapshot()).toMatchObject({ status: "ended", plays: 2 });

    engine.play(); // a third is refused

    expect(engine.getSnapshot()).toMatchObject({ status: "ended", plays: 2 });
    expect(synth!.spoken).toHaveLength(2);
  });

  it("pausing and resuming inside a play does not use up a play", () => {
    const { engine } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    engine.configure({ maxPlays: 1, locked: true });

    engine.play();
    engine.pause();
    engine.play();
    engine.pause();
    engine.play();

    expect(engine.getSnapshot()).toMatchObject({ status: "playing", plays: 1 });
  });

  it("locks seeking, replaying and speed, and pins the speed to normal", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two.", "Three."]), null);
    engine.setRate(0.75);
    engine.configure({ locked: true });

    expect(engine.getSnapshot().rate).toBe(1);

    engine.play();
    engine.seek(2);
    engine.replayCurrent();
    engine.setRate(0.75);

    expect(engine.getSnapshot()).toMatchObject({ index: 0, rate: 1 });
    expect(synth!.texts()).toEqual(["One."]);
  });

  it("unlocking restores freedom", () => {
    const { engine } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    engine.configure({ locked: true });
    engine.configure({ locked: false });

    engine.setRate(0.75);

    expect(engine.getSnapshot().rate).toBe(0.75);
  });
});

describe("browser quirks", () => {
  it("keeps going if the browser never reports the end of a sentence", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["Short one.", "Second one."]), null);
    engine.play();

    vi.advanceTimersByTime(estimateMs("Short one.", 1) + 380 + 1);

    expect(synth!.texts()).toEqual(["Short one.", "Second one."]);
  });

  it("a real end arriving after the watchdog already moved on is ignored (no skipped sentence)", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two.", "Three."]), null);
    engine.play();
    const first = synth!.last;

    vi.advanceTimersByTime(estimateMs("One.", 1) + 380 + 1);
    expect(synth!.texts()).toEqual(["One.", "Two."]);

    first.utterance.onend?.(); // the old sentence finally reports in
    vi.advanceTimersByTime(380);

    expect(synth!.texts()).toEqual(["One.", "Two."]);
  });

  it("an error that is just our own cancel() is not a failure", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    engine.play();

    synth!.error("interrupted");
    synth!.error("canceled");
    vi.advanceTimersByTime(380);

    expect(engine.getSnapshot()).toMatchObject({ status: "playing", problem: null });
    expect(synth!.texts()).toEqual(["One."]);
  });

  it("autoplay being blocked pauses and says so instead of racing through silently", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    engine.play();

    synth!.error("not-allowed");

    expect(engine.getSnapshot()).toMatchObject({ status: "paused", problem: "blocked", index: 0 });
    vi.advanceTimersByTime(5000);
    expect(synth!.texts()).toEqual(["One."]);
  });

  it("gives up after three sentences in a row fail to speak", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two.", "Three.", "Four.", "Five."]), null);
    engine.play();

    for (let i = 0; i < 3; i++) {
      synth!.error("synthesis-failed");
      vi.advanceTimersByTime(380);
    }

    expect(engine.getSnapshot()).toMatchObject({ status: "paused", problem: "failed" });
    expect(synth!.spoken.length).toBeLessThanOrEqual(3);
  });

  it("a good sentence resets the failure count", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["1.", "2.", "3.", "4.", "5."]), null);
    engine.play();

    synth!.error("synthesis-failed");
    vi.advanceTimersByTime(380);
    synth!.error("synthesis-failed");
    vi.advanceTimersByTime(380);
    synth!.end(); // success resets the streak
    vi.advanceTimersByTime(380);
    synth!.error("synthesis-failed");
    vi.advanceTimersByTime(380);

    expect(engine.getSnapshot().problem).toBeNull();
    expect(engine.getSnapshot().status).toBe("playing");
  });

  it("reports unsupported and stays inert when the browser has no speech synthesis", () => {
    const { engine } = makeEngine(null);
    engine.load(seg(["One."]), null);

    engine.play();
    engine.playOne(0);

    expect(engine.supported).toBe(false);
    expect(engine.getSnapshot().status).toBe("unsupported");
  });
});

describe("voices", () => {
  const heera: VoiceLike = { name: "Microsoft Heera - English (India)", lang: "en-IN", localService: true };
  const ravi: VoiceLike = { name: "Microsoft Ravi - English (India)", lang: "en-IN", localService: true };
  const zira: VoiceLike = { name: "Microsoft Zira Desktop - English (United States)", lang: "en-US", localService: true };

  it("speaks each speaker with their own voice and the voice's language", () => {
    const synth = new FakeSynth();
    synth.voices = [heera, ravi, zira];
    const { engine } = makeEngine(synth);
    engine.load(seg(["Hi.", "Hello."], ["A", "B"]), [{ key: "A", gender: "female" }, { key: "B", gender: "male" }]);

    engine.play();
    synth.end();
    vi.advanceTimersByTime(700);

    expect(synth.spoken[0].options.voice).toBe(heera);
    expect(synth.spoken[1].options.voice).toBe(ravi);
    expect(synth.spoken[0].options.lang).toBe("en-IN");
  });

  it("separates speakers by pitch when there is no choice of voice", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["Hi.", "Hello."], ["A", "B"]), [{ key: "A", gender: null }, { key: "B", gender: null }]);

    engine.play();
    synth!.end();
    vi.advanceTimersByTime(700);

    expect(synth!.spoken[0].options.pitch).not.toBe(synth!.spoken[1].options.pitch);
  });

  it("changing the accent re-chooses the voice and restarts the sentence being spoken", () => {
    const synth = new FakeSynth();
    synth.voices = [heera, zira];
    const { engine } = makeEngine(synth);
    engine.load(seg(["One.", "Two."]), null);
    engine.play();
    expect(synth.last.options.voice).toBe(heera);

    engine.setAccent("en-US");

    expect(synth.last.options.voice).toBe(zira);
    expect(synth.texts()).toEqual(["One.", "One."]);
    expect(engine.getSnapshot()).toMatchObject({ accent: "en-US", voiceName: zira.name });
  });

  it("picks up voices that Chrome loads late", () => {
    const synth = new FakeSynth();
    const { engine } = makeEngine(synth);
    engine.connect();
    engine.load(seg(["One."]), null);
    expect(engine.getSnapshot().voiceCount).toBe(0);

    synth.loadVoices([heera, zira]);

    expect(engine.getSnapshot()).toMatchObject({ voiceCount: 2, voiceName: heera.name });
  });

  it("dispose releases the voice listener", () => {
    const synth = new FakeSynth();
    const { engine } = makeEngine(synth);
    engine.connect();

    engine.dispose();
    synth.loadVoices([heera]);

    expect(engine.getSnapshot().voiceCount).toBe(0);
  });
});

describe("lifecycle and subscription", () => {
  it("load resets a lesson in progress", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    engine.play();
    synth!.end();
    vi.advanceTimersByTime(380);

    engine.load(seg(["New one."]), null);

    expect(engine.getSnapshot()).toMatchObject({ status: "idle", index: 0, plays: 0, total: 1 });
    vi.advanceTimersByTime(10_000);
    expect(synth!.texts()).toEqual(["One.", "Two."]);
  });

  it("notifies subscribers on change, and keeps the same snapshot object when nothing changed", () => {
    const { engine } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);

    engine.play();
    expect(listener).toHaveBeenCalled();

    const before = engine.getSnapshot();
    engine.setAccent("auto"); // already auto: no change
    expect(engine.getSnapshot()).toBe(before);

    unsubscribe();
    listener.mockClear();
    engine.pause();
    expect(listener).not.toHaveBeenCalled();
  });

  it("dispose silences everything that was scheduled", () => {
    const { engine, synth } = makeEngine();
    engine.load(seg(["One.", "Two."]), null);
    engine.play();
    synth!.end();

    engine.dispose();
    vi.advanceTimersByTime(10_000);

    expect(synth!.texts()).toEqual(["One."]);
  });
});

describe("estimateMs", () => {
  it("grows with sentence length and with slower speeds, and never gets tiny", () => {
    expect(estimateMs("Hi.", 1)).toBeGreaterThan(3000);
    expect(estimateMs("a".repeat(200), 1)).toBeGreaterThan(estimateMs("a".repeat(50), 1));
    expect(estimateMs("a".repeat(100), 0.75)).toBeGreaterThan(estimateMs("a".repeat(100), 1.25));
  });
});
