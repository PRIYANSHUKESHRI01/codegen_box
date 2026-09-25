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

export interface VoiceListenCallbacks {
  /** Fires repeatedly while listening with the running transcript (finalized so far + the current in-progress chunk) — for live captions. Never fires if interim results aren't supported; callers must degrade gracefully (no live caption shown). */
  onInterimTranscript?: (text: string) => void;
  /** Fires roughly once per animation frame with a normalized 0-1 mic input level — for a live waveform/level meter. Never fires if AudioContext/analyser isn't available; callers must degrade gracefully (meter just shows an idle baseline). */
  onAudioLevel?: (level: number) => void;
  /** Fires on a recognition error. Transient errors are reported here but do NOT stop listening — only a thrown startListening() rejection (see below) is actually fatal. */
  onError?: (error: VoiceListenError) => void;
}

export interface VoiceEngine {
  isTtsSupported(): boolean;
  isSttSupported(): boolean;
  /** Speaks the question text aloud. Resolves when speech finishes (or immediately if TTS isn't supported). */
  speak(text: string): Promise<void>;
  /**
   * Starts capturing the candidate's spoken answer — live transcript + a raw
   * audio recording in parallel. Rejects with an Error whose `cause` is a
   * VoiceListenError when microphone access itself fails (most commonly
   * `"permission_denied"`) — callers should inspect `.cause` to show a
   * specific message rather than silently falling back.
   */
  startListening(callbacks?: VoiceListenCallbacks): Promise<void>;
  /** Stops capture and resolves with whatever was captured. `audioBlob` is null if MediaRecorder isn't supported or capture never started. */
  stopListening(): Promise<{ transcript: string; audioBlob: Blob | null }>;
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
