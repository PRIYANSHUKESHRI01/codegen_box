/**
 * Is the camera giving a live picture of a room?
 *
 * Three ways a camera "works" while showing nothing useful: it is covered (black), it is frozen on one frame (a paused
 * virtual camera, a looped clip that stalled, a crashed driver), or its label gives away that it is software. The first
 * two are judged from tiny 32×24 samples taken about once a second; the third from the device label.
 *
 * Pure logic, unit-tested. The sampling itself (drawing a video frame to a canvas) lives in the engine.
 */

/** Names that mean "this is software, not a lens". Deliberately a short list of unambiguous tools. */
const VIRTUAL_CAMERA =
  /obs[\s-]*(virtual|camera)|virtual\s*(cam|camera|webcam)|\bvcam\b|manycam|xsplit|snap\s*camera|droidcam|iriun|epoccam|\bcamo\b|splitcam|e2esoft|mmhmm|chromacam|webcamoid|streamlabs|v4l2loopback|unity\s*video|\bndi\b|screen\s*capture|capture\s*card|obsbot\s*virtual|vtuber|facerig|yawcam/i;

export function isVirtualCameraLabel(label: string): boolean {
  return VIRTUAL_CAMERA.test(label);
}

export interface FrameSample {
  /** Average luminance 0–255. */
  mean: number;
  /** A cheap hash of the sampled pixels: equal hash ≈ identical picture. */
  hash: number;
}

/** Reduces an RGBA buffer (e.g. a 32×24 canvas read-back) to a sample. */
export function sampleFrame(rgba: Uint8ClampedArray): FrameSample {
  let sum = 0;
  let hash = 2166136261;
  const pixels = rgba.length / 4;

  for (let i = 0; i < rgba.length; i += 4) {
    const lum = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    sum += lum;
    // Quantise so sensor noise (±2 levels) does not make a still picture look alive, then FNV-1a.
    hash ^= Math.round(lum / 8);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return { mean: pixels ? sum / pixels : 0, hash };
}

export const BLACK_MEAN = 12;
export const BLACK_SECONDS = 8;
export const FROZEN_SECONDS = 25;

export type HealthFinding = { type: "camera_blocked"; data: { seconds: number } } | { type: "camera_frozen"; data: { seconds: number } };

/**
 * Feed one sample per call (about one a second). Returns a finding when the camera has been dark / frozen long enough,
 * once per episode. A real camera in a room always has sensor noise, so an unchanged hash for FROZEN_SECONDS is not a
 * person sitting still — it is a picture that has stopped being produced.
 */
export class CameraHealth {
  private darkSince: number | null = null;
  private lastHash: number | null = null;
  private sameSince: number | null = null;
  private reportedDark = false;
  private reportedFrozen = false;

  feed(sample: FrameSample, t: number): HealthFinding | null {
    let finding: HealthFinding | null = null;

    if (sample.mean < BLACK_MEAN) {
      this.darkSince ??= t;
      if (!this.reportedDark && t - this.darkSince >= BLACK_SECONDS * 1000) {
        this.reportedDark = true;
        finding = { type: "camera_blocked", data: { seconds: Math.round((t - this.darkSince) / 1000) } };
      }
    } else {
      this.darkSince = null;
      this.reportedDark = false;
    }

    if (this.lastHash !== null && sample.hash === this.lastHash) {
      this.sameSince ??= t;
      if (!finding && !this.reportedFrozen && sample.mean >= BLACK_MEAN && t - this.sameSince >= FROZEN_SECONDS * 1000) {
        this.reportedFrozen = true;
        finding = { type: "camera_frozen", data: { seconds: Math.round((t - this.sameSince) / 1000) } };
      }
    } else {
      this.sameSince = null;
      this.reportedFrozen = false;
    }
    this.lastHash = sample.hash;

    return finding;
  }
}
