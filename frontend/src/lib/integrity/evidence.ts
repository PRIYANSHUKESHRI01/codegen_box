import { ApiError } from "@/lib/api";

/**
 * Evidence stills: small JPEGs cut from the camera (and the shared screen) and sent to the server, where they are stored
 * encrypted and shown to authorised reviewers only. A still is what turns "the software says it saw a phone" into
 * something a person can look at and decide — it is the part of the system that does not depend on trusting the browser's
 * judgement, only on the browser having had a camera pointed at the room.
 *
 * Video itself never leaves the browser. Only these stills do, at intervals the server chooses (and randomises here so the
 * moment of the next one cannot be timed), plus an immediate one whenever the camera analysis flags something.
 */

export interface UploadApi {
  postFormData<T>(path: string, formData: FormData): Promise<T>;
}

export interface StillSource {
  kind: "webcam" | "screen";
  /** The playing <video> to draw from. */
  video: HTMLVideoElement | null;
  /** Longest side of the JPEG, px. */
  maxSide: number;
  quality: number;
}

interface Queued {
  blob: Blob;
  kind: "webcam" | "screen";
  capturedAt: number;
  flagged: boolean;
  reason?: string;
  meta?: Record<string, unknown>;
  tries: number;
}

const MAX_QUEUE = 6;

/** Draws the current frame to a JPEG, or null when the video has nothing to show yet (not playing / black). */
export async function captureStill(source: StillSource): Promise<Blob | null> {
  const v = source.video;
  if (!v || v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) return null;

  const scale = Math.min(1, source.maxSide / Math.max(v.videoWidth, v.videoHeight));
  const w = Math.max(2, Math.round(v.videoWidth * scale));
  const h = Math.max(2, Math.round(v.videoHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(v, 0, 0, w, h);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", source.quality));
}

export class EvidenceUploader {
  private queue: Queued[] = [];
  private busy = false;
  private stopped = false;
  sent = 0;

  constructor(
    private readonly api: UploadApi,
    private readonly sessionId: string,
    private readonly onSent?: (total: number) => void,
    private readonly now: () => number = () => Date.now()
  ) {}

  stop(): void {
    this.stopped = true;
    this.queue = [];
  }

  /** Adds a still. When the queue is full the oldest UNFLAGGED one makes room; flagged stills are never shed for routine ones. */
  add(blob: Blob, kind: "webcam" | "screen", opts: { flagged?: boolean; reason?: string; meta?: Record<string, unknown> } = {}): void {
    if (this.stopped) return;

    if (this.queue.length >= MAX_QUEUE) {
      const i = this.queue.findIndex((q) => !q.flagged);
      if (i === -1 && !opts.flagged) return;
      this.queue.splice(i === -1 ? 0 : i, 1);
    }

    this.queue.push({ blob, kind, capturedAt: this.now(), flagged: !!opts.flagged, reason: opts.reason, meta: opts.meta, tries: 0 });
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.busy || this.stopped) return;
    this.busy = true;

    try {
      while (this.queue.length > 0 && !this.stopped) {
        const item = this.queue[0];
        const form = new FormData();
        form.append("image", item.blob, `${item.kind}.jpg`);
        form.append("kind", item.kind);
        form.append("captured_at", String(item.capturedAt));
        if (item.flagged) form.append("flagged", "1");
        if (item.reason) form.append("reason", item.reason);
        if (item.meta) form.append("meta", JSON.stringify(item.meta));

        try {
          const res = await this.api.postFormData<{ stored: boolean }>(`/integrity/${this.sessionId}/evidence`, form);
          this.queue.shift();
          if (res?.stored) {
            this.sent += 1;
            this.onSent?.(this.sent);
          }
        } catch (err) {
          // 4xx other than throttling = the server will never take this one (ended, malformed): drop it.
          if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) {
            this.queue.shift();
          } else if (++item.tries >= 3) {
            this.queue.shift();
          } else {
            await new Promise((r) => setTimeout(r, 1500 * item.tries));
          }
        }
      }
    } finally {
      this.busy = false;
    }
  }
}

/** Next delay, in ms, for a cadence of `seconds` with ±30 % jitter so nobody can time the next still. */
export function jitteredMs(seconds: number, random: () => number = Math.random): number {
  return Math.round(seconds * 1000 * (0.7 + random() * 0.6));
}
