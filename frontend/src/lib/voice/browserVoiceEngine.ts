import {
  hasMediaRecorder,
  hasSpeechRecognition,
  hasSpeechSynthesis,
  type VoiceEngine,
  type VoiceListenCallbacks,
  type VoiceListenError,
  type VoiceSpeakCallbacks,
  type VoiceSpeakOptions,
} from "./VoiceEngine";
import { computeRmsLevel, VOICED_LEVEL } from "./level";
import { playSpeechAudio, type SpeechPlayback } from "./speechAudio";

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

/** How long stopListening() waits for the browser to deliver its last, still-pending speech result before giving up on it. */
const RECOGNITION_DRAIN_MS = 1500;

/** How long speak() waits for the browser to list its voices before using whatever is default. */
const VOICES_WAIT_MS = 400;

/**
 * The most natural-sounding English voice this browser has, or null to leave the browser's default. Neural voices ("Natural" in Edge) are by
 * far the best; after those a voice that runs on this machine is preferred over a network one — it reports word timing, works offline and
 * doesn't cut out mid-question — and Indian English wins ties because that is who is listening.
 */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = 0;

  for (const voice of voices) {
    const lang = voice.lang.replace("_", "-").toLowerCase();
    if (!lang.startsWith("en")) continue;

    let score = 1;
    if (lang === "en-in") score += 30;
    else if (lang === "en-us" || lang === "en-gb") score += 20;
    else score += 10;
    if (/natural|neural/i.test(voice.name)) score += 40;
    if (voice.localService) score += 6;
    if (voice.default) score += 3;

    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }

  return best;
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
  /** The clip of the interviewer's real voice that is playing, if any. */
  private currentSpeechAudio: SpeechPlayback | null = null;
  /** Set by cancel(): a clip that was stopped before it began must not fall back to speaking in the browser voice. */
  private speechCancelled = false;

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

  async speak(text: string, callbacks?: VoiceSpeakCallbacks, options?: VoiceSpeakOptions): Promise<void> {
    // The real voice first: a recording of this question made by a neural model. Anything short of it playing falls straight through to the
    // browser's own voice below, so the question is always read.
    this.speechCancelled = false;
    if (options?.audioUrl) {
      this.currentSpeechAudio?.cancel();
      const playback = playSpeechAudio(options.audioUrl, text, callbacks);
      this.currentSpeechAudio = playback;
      const outcome = await playback.finished;
      if (this.currentSpeechAudio === playback) this.currentSpeechAudio = null;
      // "ended", or the candidate left the page while it was starting: either way nothing more is to be said.
      if (outcome === "ended" || this.speechCancelled) return;
    }

    if (!this.isTtsSupported()) return;

    const voices = await this.loadVoices();

    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(voices);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = 0.98;

      let settled = false;
      // Some voices (Chrome's network ones in particular) occasionally go quiet without ever firing onend, which would leave the
      // interview waiting on a question nobody is reading. Generous: ~140 ms a character is about half the normal speaking pace.
      const watchdog = window.setTimeout(() => {
        synth.cancel();
        settle();
      }, text.length * 140 + 5000);
      const settle = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(watchdog);
        resolve();
      };

      utterance.onstart = () => callbacks?.onStart?.();
      utterance.onboundary = (event) => {
        if (event.name && event.name !== "word") return;
        callbacks?.onBoundary?.(event.charIndex);
      };
      utterance.onend = settle;
      utterance.onerror = settle;
      // Chrome drops an utterance's events if nothing references it, so keep it on the instance until the next one replaces it.
      this.currentUtterance = utterance;
      synth.speak(utterance);
    });
  }

  /** Chrome fills the voice list in after page load, so the first call can find it empty; wait briefly for it rather than speaking in whatever voice is default. */
  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length > 0) return Promise.resolve(now);

    return new Promise((resolve) => {
      const done = () => {
        window.clearTimeout(timer);
        synth.removeEventListener?.("voiceschanged", done);
        resolve(synth.getVoices());
      };
      const timer = window.setTimeout(done, VOICES_WAIT_MS);
      synth.addEventListener?.("voiceschanged", done);
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
      callbacks?.onInterimTranscript?.((this.finalTranscript + " " + interimChunk).trim(), { final: this.finalTranscript, interim: this.interimChunk });
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
    this.speechCancelled = true;
    this.currentSpeechAudio?.cancel();
    this.currentSpeechAudio = null;
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
