/**
 * Where recorded webcam/mic chunks go. Today there is exactly one
 * implementation — NullRecordingSink, which keeps a short rolling buffer in
 * memory (for a live self-preview / "did it actually record" sanity check
 * during the session) and discards everything when the session ends. No
 * bytes ever leave the browser.
 *
 * This interface is the seam for adding real persistence later (e.g. direct
 * browser-to-S3/R2 chunk upload via presigned URLs) WITHOUT touching the
 * capture logic in useProctoring.ts at all — that code only ever calls
 * `sink.onChunk(...)` and `sink.onSessionEnd()`, never anything
 * storage-specific.
 */
export interface RecordingSink {
  onChunk(blob: Blob, meta: { index: number; mimeType: string; recordedAt: number }): void;
  /** Called once when recording stops (locked, submitted, or navigated away) — the sink's chance to release/discard everything it's holding. */
  onSessionEnd(): void;
}

/**
 * Keeps only the last `maxBufferedChunks` blobs (a rolling window, default
 * ~2 minutes at 20s/chunk) so a long contest can't slowly balloon browser
 * memory with an hour of un-uploaded video. Nothing is ever persisted past
 * the tab closing, and everything is dropped immediately on session end.
 */
export class NullRecordingSink implements RecordingSink {
  private buffered: Blob[] = [];

  constructor(private readonly maxBufferedChunks: number = 6) {}

  onChunk(blob: Blob): void {
    this.buffered.push(blob);
    while (this.buffered.length > this.maxBufferedChunks) {
      this.buffered.shift();
    }
  }

  /** The most recent buffered chunks, oldest first — for an optional local "preview last N minutes" affordance. Never sent anywhere. */
  getRecentChunks(): Blob[] {
    return [...this.buffered];
  }

  onSessionEnd(): void {
    this.buffered = [];
  }
}
