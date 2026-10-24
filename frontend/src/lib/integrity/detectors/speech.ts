/**
 * "Is someone talking?" — a deliberately simple gate, not speech recognition. It compares the microphone level against a
 * slowly-learned room noise floor: speech sits well above the floor and keeps going; a door slam or a cough does not.
 * It reports sustained speech once per episode (a helper reading answers aloud, the student dictating to a phone) and
 * nothing else — no audio ever leaves the browser, only the fact and its length.
 *
 * Pure logic, unit-tested. The Web Audio plumbing (an AnalyserNode sampled ~10×/s) lives in the engine.
 */

const SPEECH_ABOVE_FLOOR_DB = 12;
const MIN_ABSOLUTE_DB = -48;
const SUSTAIN_MS = 6_000;
const REARM_MS = 60_000;
const GAP_TOLERANCE_MS = 1_200; // a breath between words does not end the episode

/** Root-mean-square level of float samples (-1…1) in dB relative to full scale. */
export function levelDb(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / Math.max(1, samples.length));

  return rms > 1e-8 ? 20 * Math.log10(rms) : -100;
}

export class SpeechGate {
  private floor = -60;
  private speechSince: number | null = null;
  private lastLoud = 0;
  private lastFired = -Infinity;

  /** @returns sustained-speech seconds when an episode completes, else null */
  feed(db: number, t: number): number | null {
    const loud = db > this.floor + SPEECH_ABOVE_FLOOR_DB && db > MIN_ABSOLUTE_DB;

    if (!loud) {
      // Learn the room: drift the floor toward what quiet sounds like, faster downward than upward.
      this.floor += (db - this.floor) * (db < this.floor ? 0.2 : 0.02);
      if (this.speechSince !== null && t - this.lastLoud > GAP_TOLERANCE_MS) this.speechSince = null;

      return null;
    }

    this.lastLoud = t;
    this.speechSince ??= t;

    if (t - this.speechSince >= SUSTAIN_MS && t - this.lastFired >= REARM_MS) {
      this.lastFired = t;
      const seconds = Math.round((t - this.speechSince) / 1000);
      this.speechSince = null;

      return seconds;
    }

    return null;
  }
}
