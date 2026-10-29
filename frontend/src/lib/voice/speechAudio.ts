import { api } from "@/lib/api";
import { estimateWordTimeline, wordSpans } from "./spokenReveal";

/**
 * The interviewer's real voice: audio produced by a neural text-to-speech model on the server (see backend/config/interview_speech.php),
 * fetched ahead of time and played here. Everything in this file is optional by design — when there is no voice configured, the request
 * fails, or the audio won't play, the caller simply falls back to the browser's own voice and the candidate never sees a problem.
 */

/** How long to wait for a clip before giving up on it and using the browser voice: a clip not yet made takes the provider a few seconds. */
export const SPEECH_FETCH_TIMEOUT_MS = 9000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

/**
 * The clips of one interview, fetched once each. `prefetch` starts a download without waiting; `get` waits for it (up to a limit) and gives
 * back a playable URL, or null for "use the browser voice". Object URLs are released by `dispose`, so a long interview doesn't leak audio.
 */
export class SpeechAudioCache {
  private clips = new Map<string, Promise<string | null>>();
  private urls: string[] = [];

  prefetch(key: string, path: string): void {
    if (this.clips.has(key)) return;
    this.clips.set(
      key,
      api
        .getFile(path)
        .then((blob) => {
          if (!blob || blob.size === 0) return null;
          const url = URL.createObjectURL(blob);
          this.urls.push(url);
          return url;
        })
        .catch(() => null)
    );
  }

  /** Starts the download if it hasn't started, then waits for it. */
  get(key: string, path: string, timeoutMs: number = SPEECH_FETCH_TIMEOUT_MS): Promise<string | null> {
    this.prefetch(key, path);
    return withTimeout(this.clips.get(key) as Promise<string | null>, timeoutMs, null);
  }

  dispose(): void {
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls = [];
    this.clips.clear();
  }
}

export interface SpeechAudioCallbacks {
  /** The sound actually started (the audio is playing), not merely requested. */
  onStart?: () => void;
  /** The voice has reached the word at `charIndex` of `text` — the same signal the browser voice gives, so the transcript needs no special case. */
  onBoundary?: (charIndex: number) => void;
}

export interface SpeechPlayback {
  /** "ended" once it has played out, "failed" if it never got going (the caller should use another voice). */
  finished: Promise<"ended" | "failed">;
  cancel: () => void;
}

/**
 * Plays a clip of the interviewer and reports where it is in the sentence. A neural voice doesn't say which word it is on, but it does say
 * how long the whole clip lasts — so the words are laid along that real duration (long words and pauses weigh more, exactly as in the
 * estimate used for the browser voice) and reported as playback passes them. That keeps the written transcript within a word or two of the
 * voice, which a fixed-speed guess never could.
 */
export function playSpeechAudio(url: string, text: string, callbacks: SpeechAudioCallbacks = {}): SpeechPlayback {
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = url;

  const spans = wordSpans(text);
  const { starts, total } = estimateWordTimeline(text);
  let scale = 1;
  let reported = -1;
  let frame = 0;
  let started = false;
  let settled = false;
  let resolveFinished: (value: "ended" | "failed") => void = () => undefined;
  const finished = new Promise<"ended" | "failed">((resolve) => {
    resolveFinished = resolve;
  });

  const settle = (value: "ended" | "failed") => {
    if (settled) return;
    settled = true;
    cancelAnimationFrame(frame);
    audio.onended = audio.onerror = audio.onplaying = audio.onloadedmetadata = null;
    resolveFinished(value);
  };

  const follow = () => {
    const elapsed = audio.currentTime * 1000;
    let word = reported;
    while (word + 1 < starts.length && starts[word + 1] * scale <= elapsed) word += 1;
    if (word !== reported && word >= 0) {
      reported = word;
      callbacks.onBoundary?.(spans[word].start);
    }
    frame = requestAnimationFrame(follow);
  };

  audio.onloadedmetadata = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0 && total > 0) scale = (audio.duration * 1000) / total;
  };
  audio.onplaying = () => {
    if (started) return;
    started = true;
    callbacks.onStart?.();
    frame = requestAnimationFrame(follow);
  };
  audio.onended = () => settle(started ? "ended" : "failed");
  // An error before any sound is "didn't work"; one after sound began just ends the clip (the sentence was already being said).
  audio.onerror = () => settle(started ? "ended" : "failed");

  audio.play().catch(() => settle("failed"));

  return {
    finished,
    cancel: () => {
      audio.pause();
      settle(started ? "ended" : "failed");
    },
  };
}
