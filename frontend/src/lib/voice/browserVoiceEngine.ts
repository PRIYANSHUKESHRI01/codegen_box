import { hasMediaRecorder, hasSpeechRecognition, hasSpeechSynthesis, type VoiceEngine, type VoiceListenCallbacks, type VoiceListenError } from "./VoiceEngine";

/** Minimal shape of the non-standard (webkit-prefixed on most browsers) SpeechRecognition API — not in lib.dom.d.ts. */
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

/** Maps the browser's raw SpeechRecognition error codes to our small, UI-meaningful set. */
function mapRecognitionError(code: string): VoiceListenError {
  if (code === "not-allowed" || code === "permission-denied" || code === "service-not-allowed") return "permission_denied";
  if (code === "no-speech" || code === "audio-capture") return "no_speech";
  if (code === "network") return "network";
  return "unknown";
}

/** Normalized level above which a frame counts as someone speaking. Deliberately low (room hiss is ~0.02-0.04): a quiet speaker must still register, because the server rejects silence anyway. */
const VOICED_LEVEL = 0.05;

/** How long stopListening() waits for the browser to deliver its last, still-pending speech result before giving up on it. */
const RECOGNITION_DRAIN_MS = 1500;

/** RMS of a time-domain byte buffer (128 = silence), normalized to roughly 0-1 for typical speech levels. */
function computeRmsLevel(data: Uint8Array): number {
  let sumSquares = 0;
  for (let i = 0; i < data.length; i++) {
    const centered = (data[i] - 128) / 128;
    sumSquares += centered * centered;
  }
  const rms = Math.sqrt(sumSquares / data.length);
  return Math.min(1, rms * 4); // typical speech RMS is small; scale up so the meter isn't perpetually near-empty
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as (new () => SpeechRecognitionLike) | undefined)
    ?? (w.webkitSpeechRecognition as (new () => SpeechRecognitionLike) | undefined)
    ?? null;
}

/**
 * The only VoiceEngine implementation today — Web Speech API for TTS/STT
 * plus MediaRecorder for the stored answer recording, all free and built
 * into the browser. One MediaStream is acquired lazily on the first
 * startListening() call and reused for the rest of the interview, so the
 * candidate is only ever prompted for mic permission once.
 */
export class BrowserVoiceEngine implements VoiceEngine {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private recognition: SpeechRecognitionLike | null = null;
  private chunks: Blob[] = [];
  private finalTranscript = "";
  /** Words the recognizer has heard but not yet finalized — folded into the transcript if the browser never finalizes them. */
  private interimChunk = "";
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  // Chrome ends a continuous recognition session on its own after a stretch of
  // silence (and sometimes just at a time limit). Unless stopListening() asked
  // for the stop, onend restarts it so a thoughtful pause mid-answer doesn't
  // silently cut the transcript off there.
  private stopRequested = false;
  private restartCount = 0;
  private recognitionEnded: (() => void) | null = null;

  // Real speech detected by the level meter, so callers can refuse to score a
  // recording of a muted mic without needing the (optional) recognizer.
  private voicedMs = 0;
  private lastLevelTickAt = 0;
  /** False until the meter has actually measured a frame — an unmeasured recording must not look like a silent one. */
  private meterRan = false;

  // Audio level metering — the AudioContext/analyser/source are set up once
  // (lazily, off the same persistent `stream`) and reused for the whole
  // interview, same lifecycle as `stream` itself; only the rAF polling loop
  // starts/stops per question.
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private levelRafId: number | null = null;

  isTtsSupported(): boolean {
    return hasSpeechSynthesis();
  }

  isSttSupported(): boolean {
    return hasSpeechRecognition() && hasMediaRecorder();
  }

  speak(text: string): Promise<void> {
    if (!this.isTtsSupported()) return Promise.resolve();

    return new Promise((resolve) => {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.98;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }

  async startListening(callbacks?: VoiceListenCallbacks): Promise<void> {
    this.chunks = [];
    this.finalTranscript = "";
    this.interimChunk = "";
    this.stopRequested = false;
    this.restartCount = 0;
    this.recognitionEnded = null;
    this.voicedMs = 0;
    this.lastLevelTickAt = 0;
    this.meterRan = false;

    if (!this.stream) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        const cause: VoiceListenError = name === "NotAllowedError" || name === "PermissionDeniedError" ? "permission_denied" : "unknown";
        throw new Error("Microphone access failed", { cause });
      }
    }

    if (hasMediaRecorder()) {
      const recorder = new MediaRecorder(this.stream, { mimeType: this.pickMimeType() });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      recorder.start();
      this.recorder = recorder;
    }

    this.startLevelMetering(callbacks?.onAudioLevel);

    const Ctor = getSpeechRecognitionCtor();
    if (Ctor) this.startRecognition(Ctor, callbacks);
  }

  /** One recognizer session; onend re-enters here so the engine keeps listening until stopListening() says otherwise. */
  private startRecognition(Ctor: new () => SpeechRecognitionLike, callbacks?: VoiceListenCallbacks): void {
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    let fatal = false;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          this.finalTranscript += (this.finalTranscript ? " " : "") + result[0].transcript.trim();
        } else {
          interimChunk += result[0].transcript;
        }
      }
      this.interimChunk = interimChunk.trim();
      callbacks?.onInterimTranscript?.((this.finalTranscript + " " + interimChunk).trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      const kind = mapRecognitionError(event.error);
      // Permission problems will not fix themselves on a restart.
      if (kind === "permission_denied") fatal = true;
      // A no-speech/network blip shouldn't kill the session — the
      // candidate can still submit whatever final transcript was
      // captured so far, or fall back to editing it by hand. Still
      // reported so the UI can show a transient, non-blocking hint.
      callbacks?.onError?.(kind);
    };

    recognition.onend = () => {
      if (this.stopRequested || fatal || this.recognition !== recognition) {
        this.recognitionEnded?.();
        return;
      }
      // Ended on its own mid-answer (silence timeout) — pick up again, with a cap so a
      // recognizer that dies instantly cannot spin forever.
      if (this.restartCount >= 30) return;
      this.restartCount += 1;
      window.setTimeout(() => {
        if (this.stopRequested || this.recognition !== recognition) return;
        try {
          recognition.start();
        } catch {
          // start() throws if the session is somehow already running — nothing to do.
        }
      }, 250);
    };

    recognition.start();
    this.recognition = recognition;
  }

  /** Lazily sets up one AudioContext/analyser off the persistent stream, then runs a rAF loop calling `onLevel` until stopped. Silently no-ops if AudioContext isn't available or gets blocked — the meter is a nice-to-have, never load-bearing. */
  private startLevelMetering(onLevel?: (level: number) => void): void {
    if (!onLevel || !this.stream) return;

    try {
      if (!this.audioContext) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.audioContext = new Ctor();
        this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
        this.sourceNode.connect(this.analyser);
      }
      this.audioContext.resume?.().catch(() => {});
    } catch {
      return;
    }

    const analyser = this.analyser;
    if (!analyser) return;
    const buffer = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      const level = computeRmsLevel(buffer);
      onLevel(level);

      const now = performance.now();
      this.meterRan = true;
      if (this.lastLevelTickAt && level > VOICED_LEVEL) this.voicedMs += now - this.lastLevelTickAt;
      this.lastLevelTickAt = now;

      this.levelRafId = requestAnimationFrame(tick);
    };
    this.lastLevelTickAt = 0;
    this.levelRafId = requestAnimationFrame(tick);
  }

  private stopLevelMetering(): void {
    if (this.levelRafId !== null) {
      cancelAnimationFrame(this.levelRafId);
      this.levelRafId = null;
    }
  }

  async stopListening(): Promise<{ transcript: string; audioBlob: Blob | null; voicedMs: number | null }> {
    this.stopLevelMetering();
    this.stopRequested = true;

    // SpeechRecognition.stop() does not return the last words — the browser
    // delivers one more (final) result AFTER it, then fires onend. Reading the
    // transcript straight away drops the end of the answer, so wait for onend
    // (bounded: some browsers never fire it).
    const recognition = this.recognition;
    this.recognition = null;
    let recognitionDrained: Promise<void> = Promise.resolve();
    if (recognition) {
      recognitionDrained = new Promise<void>((resolve) => {
        this.recognitionEnded = resolve;
        window.setTimeout(resolve, RECOGNITION_DRAIN_MS);
      });
      try {
        recognition.stop();
      } catch {
        this.recognitionEnded?.();
      }
    }

    let audioBlob: Blob | null = null;
    const recorded = this.recorder && this.recorder.state !== "inactive"
      ? new Promise<Blob>((resolve) => {
          const recorder = this.recorder!;
          recorder.onstop = () => resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
          recorder.stop();
        })
      : null;

    [audioBlob] = await Promise.all([recorded, recognitionDrained]);
    this.recorder = null;
    this.recognitionEnded = null;

    // Anything the recognizer heard but never finalized still counts.
    const transcript = [this.finalTranscript, this.interimChunk].filter(Boolean).join(" ").trim();
    this.finalTranscript = "";
    this.interimChunk = "";

    return { transcript, audioBlob, voicedMs: this.meterRan ? Math.round(this.voicedMs) : null };
  }

  cancel(): void {
    if (this.isTtsSupported()) window.speechSynthesis.cancel();
    this.currentUtterance = null;

    this.stopLevelMetering();
    this.stopRequested = true;

    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.abort();
      this.recognition = null;
    }

    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      this.recorder.stop();
    }
    this.recorder = null;

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.analyser = null;
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  private pickMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? "";
  }
}
