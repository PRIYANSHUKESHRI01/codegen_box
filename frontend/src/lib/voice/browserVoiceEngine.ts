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
  private currentUtterance: SpeechSynthesisUtterance | null = null;

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
    if (Ctor) {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-IN";
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
        callbacks?.onInterimTranscript?.((this.finalTranscript + " " + interimChunk).trim());
      };
      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        // A no-speech/network blip shouldn't kill the session — the
        // candidate can still submit whatever final transcript was
        // captured so far, or fall back to editing it by hand. Still
        // reported so the UI can show a transient, non-blocking hint.
        callbacks?.onError?.(mapRecognitionError(event.error));
      };
      recognition.start();
      this.recognition = recognition;
    }
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
      onLevel(computeRmsLevel(buffer));
      this.levelRafId = requestAnimationFrame(tick);
    };
    this.levelRafId = requestAnimationFrame(tick);
  }

  private stopLevelMetering(): void {
    if (this.levelRafId !== null) {
      cancelAnimationFrame(this.levelRafId);
      this.levelRafId = null;
    }
  }

  async stopListening(): Promise<{ transcript: string; audioBlob: Blob | null }> {
    this.stopLevelMetering();

    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }

    let audioBlob: Blob | null = null;
    if (this.recorder && this.recorder.state !== "inactive") {
      audioBlob = await new Promise<Blob>((resolve) => {
        const recorder = this.recorder!;
        recorder.onstop = () => resolve(new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" }));
        recorder.stop();
      });
    }
    this.recorder = null;

    const transcript = this.finalTranscript.trim();
    this.finalTranscript = "";

    return { transcript, audioBlob };
  }

  cancel(): void {
    if (this.isTtsSupported()) window.speechSynthesis.cancel();
    this.currentUtterance = null;

    this.stopLevelMetering();

    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
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
