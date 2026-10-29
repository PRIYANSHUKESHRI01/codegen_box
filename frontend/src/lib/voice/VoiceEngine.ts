/**
 * The swap seam for AI Interview voice: every call site (the session-taking
 * page) talks to this interface only, never to SpeechSynthesis/
 * SpeechRecognition/MediaRecorder directly. `browserVoiceEngine.ts` is the
 * only implementation today (the user's explicit choice — free, zero new
 * infra, ships immediately); a future self-hosted engine (e.g. Piper TTS +
 * faster-whisper STT proxied through the backend) is a second class
 * implementing this same interface, with no changes needed anywhere else.
 */
/** `permission_denied` is effectively fatal for this attempt (caller should fall back to typed answers); `no_speech`/`network`/`unknown` are transient — listening keeps running. */
export type VoiceListenError = "permission_denied" | "no_speech" | "network" | "unknown";

export interface VoiceSpeakCallbacks {
  /** The voice actually began making sound — not merely when speak() was called (a network voice can take a second to start). */
  onStart?: () => void;
  /**
   * The voice reached a new word; `charIndex` is that word's offset into the text passed to speak(). Only fires when the browser's voice
   * reports word timing — Chrome's network ("Google ...") voices never do — so a caller must keep its own estimate and treat this as a correction.
   */
  onBoundary?: (charIndex: number) => void;
}

export interface VoiceSpeakOptions {
  /**
   * A recording of this very text in a better voice (a neural voice made on the server), as a playable URL. When it is given the engine
   * plays it instead of speaking with the browser's own voice, reporting the same `onStart` / `onBoundary` events; if it can't be played
   * the browser voice reads the text as usual. Never required: null/absent means "use the browser voice".
   */
  audioUrl?: string | null;
}

export interface VoiceListenCallbacks {
  /**
   * Fires repeatedly while listening with the running transcript (finalized so far + the current in-progress chunk) — for live captions. `parts`
   * splits the same text into what the recognizer has committed and what it may still revise, so a caption can show the tail as provisional.
   * Never fires if interim results aren't supported; callers must degrade gracefully (no live caption shown).
   */
  onInterimTranscript?: (text: string, parts?: { final: string; interim: string }) => void;
  /** Fires roughly once per animation frame with a normalized 0-1 mic input level — for a live waveform/level meter. Never fires if AudioContext/analyser isn't available; callers must degrade gracefully (meter just shows an idle baseline). */
  onAudioLevel?: (level: number) => void;
  /** Fires on a recognition error. Transient errors are reported here but do NOT stop listening — only a thrown startListening() rejection (see below) is actually fatal. */
  onError?: (error: VoiceListenError) => void;
}

export interface VoiceEngine {
  isTtsSupported(): boolean;
  isSttSupported(): boolean;
  /** Speaks the question text aloud. Resolves when speech finishes (or immediately if TTS isn't supported, or if the browser never reports an end). */
  speak(text: string, callbacks?: VoiceSpeakCallbacks, options?: VoiceSpeakOptions): Promise<void>;
  /**
   * Starts capturing the candidate's spoken answer — live transcript + a raw
   * audio recording in parallel. Rejects with an Error whose `cause` is a
   * VoiceListenError when microphone access itself fails (most commonly
   * `"permission_denied"`) — callers should inspect `.cause` to show a
   * specific message rather than silently falling back.
   */
  startListening(callbacks?: VoiceListenCallbacks): Promise<void>;
  /**
   * Stops capture and resolves with whatever was captured. `audioBlob` is null if MediaRecorder isn't supported or capture never started.
   * `voicedMs` is how long actual speech was detected by the level meter, or null when it was never measured (no `onAudioLevel`
   * callback, or no AudioContext) — lets a caller refuse to submit a recording of a muted mic without ever blocking on "unknown".
   */
  stopListening(): Promise<{ transcript: string; audioBlob: Blob | null; voicedMs: number | null }>;
  /** Stops any in-flight speech/listening without resolving a result — used on navigation away mid-question. */
  cancel(): void;
}

export function hasSpeechSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export function hasMediaRecorder(): boolean {
  return typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;
}
