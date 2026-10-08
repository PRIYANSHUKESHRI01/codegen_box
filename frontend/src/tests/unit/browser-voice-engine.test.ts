import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserVoiceEngine } from "@/lib/voice/browserVoiceEngine";

/**
 * Regression tests for the SpeechRecognition handling in BrowserVoiceEngine.
 *
 * The bugs these pin down all come from how real Chrome behaves and a naive
 * wrapper does not: stop() returns BEFORE the last words arrive (the browser
 * delivers one more final result, then onend), continuous recognition ends on
 * its own after a pause, and some browsers never fire onend at all.
 */

type Handler<E = unknown> = ((event: E) => void) | null;

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  /** How the next stop() behaves: deliver a final result later, fire onend without one, or do nothing at all. */
  static onStop: "final-then-end" | "end-only" | "silent" = "final-then-end";
  static finalOnStop = "";

  continuous = false;
  interimResults = false;
  lang = "";
  startCalls = 0;
  onresult: Handler<{ resultIndex: number; results: unknown[] }> = null;
  onerror: Handler<{ error: string }> = null;
  onend: Handler = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() {
    this.startCalls += 1;
  }

  stop() {
    if (FakeRecognition.onStop === "silent") return;
    setTimeout(() => {
      if (FakeRecognition.onStop === "final-then-end" && FakeRecognition.finalOnStop) this.emit(FakeRecognition.finalOnStop, true);
      this.onend?.(null);
    }, 40);
  }

  abort() {}

  /** Mirrors the real event: `results` holds every result so far and `resultIndex` points at the first one that changed. */
  emit(transcript: string, isFinal: boolean, resultIndex = 0) {
    const results = Array.from({ length: resultIndex + 1 }, (_, i) =>
      i === resultIndex ? Object.assign([{ transcript }], { isFinal }) : Object.assign([{ transcript: "" }], { isFinal: true })
    );
    this.onresult?.({ resultIndex, results });
  }
}

class FakeRecorder {
  static isTypeSupported = () => true;
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: Handler<{ data: Blob }> = null;
  onstop: Handler = null;

  constructor(_stream: unknown, _options?: unknown) {}

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(["audio-bytes"]) });
      this.onstop?.(null);
    }, 5);
  }
}

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.onStop = "final-then-end";
  FakeRecognition.finalOnStop = "";

  Object.assign(window, { webkitSpeechRecognition: FakeRecognition, MediaRecorder: FakeRecorder });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: () => {} }] }) },
  });
});

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  delete (window as unknown as Record<string, unknown>).MediaRecorder;
});

describe("BrowserVoiceEngine speech recognition", () => {
  it("waits for the final result the browser delivers after stop(), so the end of the answer is not lost", async () => {
    FakeRecognition.finalOnStop = "I wake up at seven and brush my teeth";
    const engine = new BrowserVoiceEngine();
    await engine.startListening();

    const { transcript, audioBlob } = await engine.stopListening();

    expect(transcript).toBe("I wake up at seven and brush my teeth");
    expect(audioBlob).not.toBeNull();
  });

  it("keeps words the recognizer heard but never finalized", async () => {
    FakeRecognition.onStop = "end-only";
    const engine = new BrowserVoiceEngine();
    await engine.startListening();

    FakeRecognition.instances[0].emit("every morning", true);
    FakeRecognition.instances[0].emit("I wake up", false, 1);

    const { transcript } = await engine.stopListening();

    expect(transcript).toBe("every morning I wake up");
  });

  it("restarts when the browser ends the session on its own, but not after the caller stops", async () => {
    const engine = new BrowserVoiceEngine();
    await engine.startListening();
    const recognition = FakeRecognition.instances[0];
    expect(recognition.startCalls).toBe(1);

    recognition.onend?.(null); // Chrome gave up after a pause
    await new Promise((r) => setTimeout(r, 400));
    expect(recognition.startCalls).toBe(2);

    await engine.stopListening();
    recognition.onend?.(null); // would be a restart if stop had not been requested
    await new Promise((r) => setTimeout(r, 400));
    expect(recognition.startCalls).toBe(2);
  });

  it("does not hang forever when the browser never fires onend after stop()", async () => {
    FakeRecognition.onStop = "silent";
    const engine = new BrowserVoiceEngine();
    await engine.startListening();

    const started = Date.now();
    const { audioBlob } = await engine.stopListening();

    expect(audioBlob).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(2500);
  });

  it("reports voicedMs as unknown (null), not zero, when the level meter could not run", async () => {
    const engine = new BrowserVoiceEngine();
    await engine.startListening();

    const { voicedMs } = await engine.stopListening();

    expect(voicedMs).toBeNull();
  });

  it("does not restart a recognizer whose microphone permission was denied", async () => {
    const engine = new BrowserVoiceEngine();
    await engine.startListening();
    const recognition = FakeRecognition.instances[0];

    recognition.onerror?.({ error: "not-allowed" });
    recognition.onend?.(null);
    await new Promise((r) => setTimeout(r, 400));

    expect(recognition.startCalls).toBe(1);
    await engine.stopListening();
  });
});
