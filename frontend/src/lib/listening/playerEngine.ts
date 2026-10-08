import { planVoices, rankVoices, type AccentPref, type SpeakerSpec, type VoiceAssignment, type VoiceLike } from "./voices";

/**
 * The Listening Lab's audio player, with no React in it.
 *
 * It exists because a lesson cannot simply be handed to
 * `speechSynthesis.speak(wholeText)`:
 *  - Chrome silently stops long utterances after ~15 seconds on several voices,
 *    so a 100-word passage can end mid-sentence with no error. Speaking one
 *    sentence at a time sidesteps it.
 *  - There is no seek, no real pause on every platform, no speed change
 *    mid-speech and no "replay that bit" — all of which are exactly what a
 *    listening student needs. A sentence queue gives every one of them.
 *  - Browsers sometimes never fire `onend` (or garbage-collect the utterance
 *    before it can). A per-sentence watchdog keeps the queue moving.
 *
 * "Pause" is implemented as cancel-and-remember-the-sentence: native
 * pause()/resume() is unreliable across Chrome/Safari/Android, whereas
 * restarting the current sentence always works and is what a learner wants
 * anyway (you hear the sentence whole).
 *
 * Everything the browser provides arrives through `EngineDeps`, so the whole
 * state machine is unit-tested with a fake synthesiser.
 */

export interface Segment {
  index: number;
  text: string;
  /** Speaker key, or null for a single-speaker passage / dictation. */
  speaker: string | null;
}

export interface UtteranceLike {
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

export interface UtteranceOptions {
  rate: number;
  pitch: number;
  lang: string;
  voice: VoiceLike | null;
}

export interface SynthLike {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  getVoices(): VoiceLike[];
  /** Subscribe to the browser finishing its (asynchronous) voice list load. Returns an unsubscribe. */
  onVoicesChanged?(listener: () => void): () => void;
}

export interface EngineDeps {
  synth: SynthLike | null;
  createUtterance: (text: string, options: UtteranceOptions) => UtteranceLike;
}

export type PlayerStatus = "idle" | "playing" | "paused" | "ended" | "unsupported";

export interface PlayerSnapshot {
  status: PlayerStatus;
  /** The sentence being spoken, or the next to speak when paused. */
  index: number;
  total: number;
  /** How many times playback has been started from the top. Resuming from a pause does not count. */
  plays: number;
  rate: number;
  accent: AccentPref;
  /** Name of the voice reading the first speaker, for the picker's caption. Null when the browser lists none. */
  voiceName: string | null;
  /** How many voices the browser has listed so far — changes when Chrome finishes loading them, so the accent picker re-renders. */
  voiceCount: number;
  /** Set when the browser refused to play (autoplay policy) or kept failing — the UI tells the student what to do. */
  problem: "blocked" | "failed" | null;
  /** True while a single-sentence replay (not the full sequence) is what's playing. */
  single: boolean;
}

export interface EngineRules {
  /** Maximum full plays (exam mode). Null = unlimited. */
  maxPlays: number | null;
  /** When true the student cannot seek, replay a sentence or change speed (exam mode). */
  locked: boolean;
}

export const RATES = [0.75, 1, 1.25] as const;

const GAP_SAME_SPEAKER_MS = 380;
const GAP_NEW_SPEAKER_MS = 700;
/** After this many sentences in a row fail to speak, stop retrying and tell the student. */
const MAX_CONSECUTIVE_FAILURES = 3;
const DEFAULT_LANG = "en-IN";

export class ListeningPlayerEngine {
  private segments: Segment[] = [];
  private speakers: SpeakerSpec[] = [{ key: "default", gender: null }];
  private voices: VoiceLike[] = [];
  private plan = new Map<string, VoiceAssignment>();

  private status: PlayerStatus;
  private index = 0;
  private plays = 0;
  private rate = 1;
  private accent: AccentPref = "auto";
  private problem: PlayerSnapshot["problem"] = null;
  private single = false;
  private rules: EngineRules = { maxPlays: null, locked: false };

  /** Bumped on every cancel/restart; callbacks from a superseded run compare against it and do nothing. */
  private run = 0;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  /** Held so the browser cannot garbage-collect the live utterance before its `onend` fires (a real Chrome bug). */
  private live: UtteranceLike | null = null;
  private consecutiveFailures = 0;

  private listeners = new Set<() => void>();
  private snapshot: PlayerSnapshot;
  private unsubscribeVoices: (() => void) | null = null;

  /**
   * Construction has no side effects (it only reads the voice list), so an
   * engine created by a discarded render — React dev mode double-invokes
   * render — leaves nothing behind. The browser listener is registered by
   * connect() and released by dispose().
   */
  constructor(private readonly deps: EngineDeps) {
    this.status = deps.synth ? "idle" : "unsupported";
    this.refreshVoices();
    this.snapshot = this.buildSnapshot();
  }

  /** Starts listening for the browser finishing its asynchronous voice load. Safe to call more than once. */
  connect(): void {
    if (this.unsubscribeVoices) return;
    this.unsubscribeVoices = this.deps.synth?.onVoicesChanged?.(() => {
      this.refreshVoices();
      this.emit();
    }) ?? null;
    // Voices may have arrived between construction and now.
    this.refreshVoices();
    this.emit();
  }

  // ---- subscription (shaped for useSyncExternalStore) ---------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): PlayerSnapshot => this.snapshot;

  // ---- setup --------------------------------------------------------------------------------

  /** Replaces the lesson. Stops anything playing and starts again from the top with zero plays used. */
  load(segments: Segment[], speakers: SpeakerSpec[] | null): void {
    this.halt();
    this.segments = segments;
    this.speakers = speakers && speakers.length > 0 ? speakers : [{ key: "default", gender: null }];
    this.index = 0;
    this.plays = 0;
    this.problem = null;
    this.single = false;
    this.consecutiveFailures = 0;
    this.status = this.deps.synth ? "idle" : "unsupported";
    this.replan();
    this.emit();
  }

  configure(rules: Partial<EngineRules>): void {
    this.rules = { ...this.rules, ...rules };
    if (this.rules.locked) {
      // Exam rules fix the speed so it cannot be slowed down to cheat the test.
      this.setRateInternal(1);
    }
    this.emit();
  }

  get supported(): boolean {
    return this.deps.synth !== null;
  }

  /** Accents this browser can really deliver, for the picker. */
  get voiceList(): VoiceLike[] {
    return this.voices;
  }

  // ---- transport ----------------------------------------------------------------------------

  /** Starts from the top (counting a play), or resumes from where it was paused. */
  play(): void {
    if (!this.deps.synth || this.segments.length === 0) return;
    if (this.status === "playing" && !this.single) return;

    const fromTop = this.status === "idle" || this.status === "ended";
    if (fromTop) {
      if (this.rules.maxPlays !== null && this.plays >= this.rules.maxPlays) return;
      this.index = 0;
      this.plays += 1;
    }

    this.problem = null;
    this.consecutiveFailures = 0;
    this.startSequence(this.index);
  }

  pause(): void {
    if (this.status !== "playing") return;
    this.halt();
    this.single = false;
    this.status = "paused";
    this.emit();
  }

  toggle(): void {
    if (this.status === "playing") this.pause();
    else this.play();
  }

  /** Moves to a sentence. If it was playing it keeps playing from there; otherwise it waits, paused, there. */
  seek(index: number): void {
    if (this.rules.locked || this.segments.length === 0) return;
    const target = clamp(index, 0, this.segments.length - 1);
    const wasPlaying = this.status === "playing" && !this.single;

    this.halt();
    this.index = target;
    this.single = false;

    if (wasPlaying) {
      this.startSequence(target);
      return;
    }
    if (this.status !== "unsupported") this.status = "paused";
    this.emit();
  }

  /** Replays the current sentence from its start, then carries on (what a student means by "say that again"). */
  replayCurrent(): void {
    if (this.rules.locked) return;
    this.seek(this.index);
    if (this.status !== "playing") this.startSequence(this.index);
  }

  /** Plays exactly one sentence and stops — used to tap a line of the transcript and hear it. */
  playOne(index: number): void {
    if (!this.deps.synth || this.segments.length === 0) return;
    const target = clamp(index, 0, this.segments.length - 1);

    this.halt();
    this.index = target;
    this.single = true;
    this.problem = null;
    this.consecutiveFailures = 0;
    this.status = "playing";
    this.emit();
    this.speak(target, this.run);
  }

  setRate(rate: number): void {
    if (this.rules.locked) return;
    this.setRateInternal(rate);
  }

  setAccent(accent: AccentPref): void {
    if (accent === this.accent) return;
    this.accent = accent;
    this.replan();
    if (this.status === "playing") this.restartCurrent();
    else this.emit();
  }

  /** Stops all speech and releases the browser listener. The engine can be reused afterwards via connect() and load(). */
  dispose(): void {
    this.halt();
    this.unsubscribeVoices?.();
    this.unsubscribeVoices = null;
  }

  // ---- internals ----------------------------------------------------------------------------

  private setRateInternal(rate: number): void {
    const next = RATES.includes(rate as (typeof RATES)[number]) ? rate : 1;
    if (next === this.rate) return;
    this.rate = next;
    if (this.status === "playing") this.restartCurrent();
    else this.emit();
  }

  /** Re-speaks the current sentence with the current voice/rate settings. */
  private restartCurrent(): void {
    const wasSingle = this.single;
    this.halt();
    this.single = wasSingle;
    this.status = "playing";
    this.emit();
    this.speak(this.index, this.run, wasSingle ? "single" : "sequence");
  }

  private startSequence(from: number): void {
    this.halt();
    this.single = false;
    this.status = "playing";
    this.index = from;
    this.emit();
    this.speak(from, this.run, "sequence");
  }

  private speak(i: number, runId: number, mode: "sequence" | "single" = this.single ? "single" : "sequence"): void {
    const synth = this.deps.synth;
    const segment = this.segments[i];
    if (!synth || !segment) return;

    this.index = i;
    const assignment = this.plan.get(segment.speaker ?? "default") ?? this.plan.get("default") ?? { voice: null, pitch: 1 };
    const utterance = this.deps.createUtterance(segment.text, {
      rate: this.rate,
      pitch: assignment.pitch,
      lang: assignment.voice?.lang ?? DEFAULT_LANG,
      voice: assignment.voice,
    });
    this.live = utterance;

    let settled = false;
    const finish = (failed: boolean) => {
      if (settled || runId !== this.run) return;
      settled = true;
      if (this.watchdog) clearTimeout(this.watchdog);
      this.watchdog = null;
      this.consecutiveFailures = failed ? this.consecutiveFailures + 1 : 0;
      this.afterSentence(i, runId, mode);
    };

    utterance.onend = () => finish(false);
    utterance.onerror = (event) => {
      const reason = event?.error;
      // cancel() on our own queue reports "interrupted"/"canceled" — that is us moving on, not a failure.
      if (reason === "interrupted" || reason === "canceled") return;
      if (reason === "not-allowed") {
        if (runId !== this.run) return;
        this.halt();
        this.status = "paused";
        this.problem = "blocked";
        this.emit();
        return;
      }
      finish(true);
    };

    // If the browser never reports the end, keep going after a generous estimate of the sentence's length.
    this.watchdog = setTimeout(() => finish(false), estimateMs(segment.text, this.rate));

    synth.speak(utterance);
    this.emit();
  }

  private afterSentence(i: number, runId: number, mode: "sequence" | "single"): void {
    if (runId !== this.run) return;

    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.halt();
      this.status = "paused";
      this.problem = "failed";
      this.single = false;
      this.emit();
      return;
    }

    if (mode === "single") {
      this.halt();
      this.single = false;
      this.status = "paused";
      this.emit();
      return;
    }

    const next = i + 1;
    if (next >= this.segments.length) {
      this.halt();
      this.status = "ended";
      this.single = false;
      this.emit();
      return;
    }

    const changedSpeaker = this.segments[next].speaker !== this.segments[i].speaker;
    this.gapTimer = setTimeout(() => {
      this.gapTimer = null;
      if (runId !== this.run) return;
      this.index = next;
      this.emit();
      this.speak(next, runId, "sequence");
    }, changedSpeaker ? GAP_NEW_SPEAKER_MS : GAP_SAME_SPEAKER_MS);
  }

  /** Cancels any speech and pending timers and invalidates callbacks from the run being stopped. */
  private halt(): void {
    this.run += 1;
    if (this.gapTimer) clearTimeout(this.gapTimer);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.gapTimer = null;
    this.watchdog = null;
    this.live = null;
    try {
      this.deps.synth?.cancel();
    } catch {
      // cancel() on a torn-down synth must never break navigation.
    }
  }

  private refreshVoices(): void {
    this.voices = this.deps.synth?.getVoices() ?? [];
    this.replan();
  }

  private replan(): void {
    this.plan = planVoices(this.voices, this.speakers, this.accent);
    // A single-speaker passage and a dictation always read with the best voice for the accent.
    if (!this.plan.has("default")) {
      const best = rankVoices(this.voices, this.accent)[0] ?? null;
      this.plan.set("default", { voice: best, pitch: 1 });
    }
  }

  private buildSnapshot(): PlayerSnapshot {
    const first = this.plan.get(this.speakers[0]?.key ?? "default") ?? this.plan.get("default");
    return {
      status: this.status,
      index: this.index,
      total: this.segments.length,
      plays: this.plays,
      rate: this.rate,
      accent: this.accent,
      voiceName: first?.voice?.name ?? null,
      voiceCount: this.voices.length,
      problem: this.problem,
      single: this.single,
    };
  }

  private emit(): void {
    const next = this.buildSnapshot();
    const prev = this.snapshot;
    // Keep the same object when nothing changed so useSyncExternalStore does not re-render needlessly.
    if (prev && (Object.keys(next) as (keyof PlayerSnapshot)[]).every((k) => next[k] === prev[k])) return;
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** A deliberately generous guess at how long a sentence takes to say, used only as a safety net if `onend` never comes. */
export function estimateMs(text: string, rate: number): number {
  const perChar = 95 / Math.max(0.5, rate);
  return Math.round(text.length * perChar + 3500);
}

/** The real browser's synthesiser, adapted to the engine's narrow interface. Null where speech synthesis does not exist. */
export function createBrowserDeps(): EngineDeps {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return { synth: null, createUtterance: () => ({ onstart: null, onend: null, onerror: null }) };
  }

  const synth: SynthLike = {
    speak: (u) => window.speechSynthesis.speak(u as unknown as SpeechSynthesisUtterance),
    cancel: () => window.speechSynthesis.cancel(),
    getVoices: () => window.speechSynthesis.getVoices(),
    onVoicesChanged: (listener) => {
      window.speechSynthesis.addEventListener("voiceschanged", listener);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", listener);
    },
  };

  return {
    synth,
    createUtterance: (text, options) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate;
      utterance.pitch = options.pitch;
      utterance.lang = options.lang;
      if (options.voice) utterance.voice = options.voice as SpeechSynthesisVoice;
      return utterance as unknown as UtteranceLike;
    },
  };
}
