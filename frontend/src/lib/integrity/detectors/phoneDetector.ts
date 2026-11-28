/**
 * Multi-frame smartphone presence detector & bounding-box plausibility filter.
 *
 * Raw object detection on laptop webcams fluctuates frame-to-frame when phones
 * are tilted, dimly lit, or partially obscured by hands. At the same time,
 * single-frame flickers (a dark mug, wallet, or hand gesture) can trip naive
 * single-threshold detectors. Combining geometric box plausibility with fast
 * multi-frame confirmation + brief hysteresis improves both recall and precision.
 */

export interface DetectionBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

const MIN_CELL_PHONE_RAW = 0.26;
const MIN_REMOTE_FALLBACK_RAW = 0.44;
const REMOTE_SCORE_FACTOR = 0.85;

const HIGH_CONFIDENCE_SCORE = 0.54;
const CONFIRM_SCORE = 0.30;
const SUSPECT_SCORE = 0.26;
const CONFIRM_WINDOW_MS = 4_500;
const CONFIRM_MIN_GAP_MS = 350;
const HOLD_MS = 2_500;

export function isPlausiblePhoneBox(
  box: DetectionBox | null | undefined,
  frameWidth: number,
  frameHeight: number,
  category: string
): boolean {
  if (!box || frameWidth <= 0 || frameHeight <= 0) return true;

  const w = Math.max(0, box.width);
  const h = Math.max(0, box.height);
  if (w < 16 || h < 20) return false;

  const areaRatio = (w * h) / (frameWidth * frameHeight);
  const aspect = w / Math.max(1, h);

  if (category === "cell phone") {
    return areaRatio >= 0.008 && areaRatio <= 0.45 && aspect >= 0.22 && aspect <= 2.6;
  }

  if (category === "remote") {
    // COCO's EfficientDet often labels a dark vertical phone screen/back as "remote"
    return areaRatio >= 0.012 && areaRatio <= 0.36 && aspect >= 0.24 && aspect <= 1.15;
  }

  return false;
}

export function scorePhoneCandidate(
  score: number,
  category: string,
  box: DetectionBox | null | undefined,
  frameWidth: number,
  frameHeight: number
): number {
  if (!isPlausiblePhoneBox(box, frameWidth, frameHeight, category)) return 0;

  if (category === "cell phone" && score >= MIN_CELL_PHONE_RAW) {
    return score;
  }
  if (category === "remote" && score >= MIN_REMOTE_FALLBACK_RAW) {
    return Math.min(1, score * REMOTE_SCORE_FACTOR);
  }
  return 0;
}

export class PhonePresenceTracker {
  private suspectSince: number | null = null;
  private lastSuspectAt = 0;
  private lastConfirmedAt = 0;
  private confirmedUntil = 0;
  private lastScore = 0;

  feed(now: number, score: number | undefined): { active: boolean; score: number } {
    if (score === undefined) {
      const heldAcrossSkippedTicks = this.lastConfirmedAt > 0 && now - this.lastConfirmedAt <= 6_000;
      return { active: now <= this.confirmedUntil || heldAcrossSkippedTicks, score: this.lastScore };
    }

    if (score >= HIGH_CONFIDENCE_SCORE) {
      this.lastScore = score;
      this.suspectSince ??= now;
      this.lastSuspectAt = now;
      this.lastConfirmedAt = now;
      this.confirmedUntil = now + HOLD_MS;
      return { active: true, score };
    }

    if (score >= CONFIRM_SCORE) {
      this.lastScore = score;
      if (this.suspectSince !== null && now - this.lastSuspectAt <= CONFIRM_WINDOW_MS) {
        if (now - this.suspectSince >= CONFIRM_MIN_GAP_MS || now - this.lastSuspectAt >= CONFIRM_MIN_GAP_MS) {
          this.lastConfirmedAt = now;
          this.confirmedUntil = now + HOLD_MS;
          this.lastSuspectAt = now;
          return { active: true, score };
        }
      } else {
        this.suspectSince = now;
      }
      this.lastSuspectAt = now;
      return { active: now <= this.confirmedUntil, score };
    }

    if (score >= SUSPECT_SCORE) {
      this.suspectSince ??= now;
      this.lastSuspectAt = now;
      this.lastScore = score;
      return { active: now <= this.confirmedUntil, score };
    }

    if (now - this.lastSuspectAt > CONFIRM_WINDOW_MS) {
      this.suspectSince = null;
    }
    if (now > this.confirmedUntil) {
      this.lastConfirmedAt = 0;
      this.lastScore = 0;
    }

    return { active: now <= this.confirmedUntil, score: this.lastScore };
  }

  isSuspect(now: number): boolean {
    return (this.suspectSince !== null && now - this.lastSuspectAt <= CONFIRM_WINDOW_MS) || now <= this.confirmedUntil;
  }

  reset(): void {
    this.suspectSince = null;
    this.lastSuspectAt = 0;
    this.lastConfirmedAt = 0;
    this.confirmedUntil = 0;
    this.lastScore = 0;
  }
}
