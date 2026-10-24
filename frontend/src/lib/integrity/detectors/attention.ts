/**
 * Turns a stream of per-frame camera observations into the few findings worth reporting. Pure logic (no browser APIs)
 * so it is fully unit-tested: the models are noisy frame to frame — a blink, a head turn to a keyboard, a shadow — and the
 * only way to make them usable is to require a finding to HOLD for a while before it counts, and to speak about each
 * episode once.
 *
 *   no_face         nobody in the frame for NO_FACE_MS
 *   multiple_faces  two or more faces for MULTI_MS
 *   face_away       head turned / lowered well away from where it started for AWAY_MS
 *   phone_detected  a phone seen in two detections a few seconds apart (one frame is often a false positive)
 *
 * "Away" is measured against the student's own posture, not a fixed angle: the first frames of the attempt set the
 * baseline, so someone who sits off-axis or reads from a laptop below the camera is not flagged for it.
 */

export interface Observation {
  /** ms timestamp of the frame. */
  t: number;
  faces: number;
  /** Normalised head-turn and head-tilt of the first face (see `headPose`), or null when no face / not measurable. */
  yaw: number | null;
  pitch: number | null;
  /** Best "cell phone" score from the object detector for this frame, if it ran. */
  phone?: number;
}

export type Finding =
  | { type: "no_face"; data: { seconds: number } }
  | { type: "multiple_faces"; data: { faces: number; seconds: number } }
  | { type: "face_away"; data: { seconds: number; yaw: number; pitch: number } }
  | { type: "phone_detected"; data: { score: number } };

export const NO_FACE_MS = 8_000;
export const MULTI_MS = 4_000;
export const AWAY_MS = 8_000;
const REARM_MS = { no_face: 45_000, multiple_faces: 60_000, face_away: 45_000, phone_detected: 60_000 } as const;

const YAW_LIMIT = 0.22;
const PITCH_LIMIT = 0.2;
const PHONE_SCORE = 0.5;
const PHONE_CONFIRM_GAP_MS = 10_000;
const BASELINE_FRAMES = 8;

/** A face-mesh landmark in normalised image coordinates. */
export interface Point {
  x: number;
  y: number;
}

/**
 * Head turn (yaw) and tilt (pitch) from five face-mesh landmarks, as ratios rather than degrees — they only need to be
 * stable and monotonic, since `AttentionRules` compares them against the student's own baseline.
 *   nose tip (1), left/right cheek (234 / 454), forehead (10), chin (152)
 */
export function headPose(nose: Point, leftCheek: Point, rightCheek: Point, forehead: Point, chin: Point): { yaw: number; pitch: number } | null {
  const width = rightCheek.x - leftCheek.x;
  const height = chin.y - forehead.y;
  if (Math.abs(width) < 1e-4 || Math.abs(height) < 1e-4) return null;

  return {
    yaw: (nose.x - (leftCheek.x + rightCheek.x) / 2) / width,
    pitch: (nose.y - (forehead.y + chin.y) / 2) / height,
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);

  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export class AttentionRules {
  private noFaceSince: number | null = null;
  private multiSince: number | null = null;
  private awaySince: number | null = null;
  private firstPhoneAt: number | null = null;
  private baseline: { yaw: number; pitch: number } | null = null;
  private samples: { yaw: number[]; pitch: number[] } = { yaw: [], pitch: [] };
  private lastFired: Partial<Record<Finding["type"], number>> = {};

  /** @returns the findings this frame completes (usually none) */
  feed(o: Observation): Finding[] {
    const out: Finding[] = [];

    // ── nobody there ──
    if (o.faces === 0) {
      this.noFaceSince ??= o.t;
      if (o.t - this.noFaceSince >= NO_FACE_MS && this.armed("no_face", o.t)) {
        out.push({ type: "no_face", data: { seconds: Math.round((o.t - this.noFaceSince) / 1000) } });
      }
    } else {
      this.noFaceSince = null;
    }

    // ── more than one ──
    if (o.faces >= 2) {
      this.multiSince ??= o.t;
      if (o.t - this.multiSince >= MULTI_MS && this.armed("multiple_faces", o.t)) {
        out.push({ type: "multiple_faces", data: { faces: o.faces, seconds: Math.round((o.t - this.multiSince) / 1000) } });
      }
    } else {
      this.multiSince = null;
    }

    // ── looking away from where they started ──
    if (o.faces === 1 && o.yaw !== null && o.pitch !== null) {
      if (this.baseline === null) {
        this.samples.yaw.push(o.yaw);
        this.samples.pitch.push(o.pitch);
        if (this.samples.yaw.length >= BASELINE_FRAMES) this.baseline = { yaw: median(this.samples.yaw), pitch: median(this.samples.pitch) };
      } else {
        const dy = Math.abs(o.yaw - this.baseline.yaw);
        const dp = Math.abs(o.pitch - this.baseline.pitch);
        if (dy > YAW_LIMIT || dp > PITCH_LIMIT) {
          this.awaySince ??= o.t;
          if (o.t - this.awaySince >= AWAY_MS && this.armed("face_away", o.t)) {
            out.push({ type: "face_away", data: { seconds: Math.round((o.t - this.awaySince) / 1000), yaw: round(dy), pitch: round(dp) } });
          }
        } else {
          this.awaySince = null;
        }
      }
    } else if (o.faces !== 1) {
      this.awaySince = null;
    }

    // ── a phone, seen twice ──
    if (o.phone !== undefined) {
      // A sighting nobody confirmed within the window was a false alarm; forget it.
      if (this.firstPhoneAt !== null && o.t - this.firstPhoneAt > PHONE_CONFIRM_GAP_MS) this.firstPhoneAt = null;

      if (o.phone >= PHONE_SCORE) {
        if (this.firstPhoneAt === null) {
          this.firstPhoneAt = o.t;
        } else if (o.t - this.firstPhoneAt >= 1000 && this.armed("phone_detected", o.t)) {
          out.push({ type: "phone_detected", data: { score: round(o.phone) } });
          this.firstPhoneAt = null;
        }
      }
    }

    return out;
  }

  /** An episode is reported once, then not again until it has been quiet for the re-arm window. */
  private armed(type: Finding["type"], t: number): boolean {
    const last = this.lastFired[type];
    if (last !== undefined && t - last < REARM_MS[type]) return false;
    this.lastFired[type] = t;

    return true;
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
