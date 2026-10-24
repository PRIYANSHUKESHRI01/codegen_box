import { isVirtualCameraLabel } from "./cameraHealth";

export interface CameraHandle {
  stream: MediaStream;
  /** What the operating system calls the camera. */
  label: string;
  /** The label names a software camera (OBS, ManyCam, a phone-as-webcam app …). */
  virtual: boolean;
}

export class MediaError extends Error {
  constructor(
    message: string,
    readonly kind: "denied" | "none" | "busy" | "unsupported" | "other"
  ) {
    super(message);
  }
}

function describe(err: unknown, what: string): MediaError {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return new MediaError(`${what} access is blocked. Allow it in your browser's address bar (the camera icon) and try again.`, "denied");
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return new MediaError(`No ${what.toLowerCase()} was found on this computer. Connect one and try again.`, "none");
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return new MediaError(`${what} is being used by another program. Close it and try again.`, "busy");
  }

  return new MediaError(`Couldn't open the ${what.toLowerCase()}. Please try again.`, "other");
}

/** Opens the camera (and microphone). One permission prompt; the same stream is kept for the whole attempt. */
export async function openCameraAndMic(opts: { video: boolean; audio: boolean }): Promise<CameraHandle> {
  if (!navigator.mediaDevices?.getUserMedia) throw new MediaError("This browser can't use the camera. Use a recent Chrome or Edge on a computer.", "unsupported");

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: opts.video ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } } : false,
      audio: opts.audio ? { echoCancellation: true } : false,
    });
  } catch (err) {
    throw describe(err, opts.video ? "Camera and microphone" : "Microphone");
  }

  const label = stream.getVideoTracks()[0]?.label ?? "";

  return { stream, label, virtual: isVirtualCameraLabel(label) };
}

export interface StreamWatch {
  onEnded: (kind: "video" | "audio") => void;
  onMuted: (kind: "video" | "audio", muted: boolean) => void;
}

/** Fires when a track is unplugged / revoked / muted by the system. Returns the unsubscribe. */
export function watchStream(stream: MediaStream, h: StreamWatch): () => void {
  const undo: Array<() => void> = [];

  for (const track of stream.getTracks()) {
    const kind = track.kind === "video" ? "video" : "audio";
    const ended = () => h.onEnded(kind);
    const mute = () => h.onMuted(kind, true);
    const unmute = () => h.onMuted(kind, false);
    track.addEventListener("ended", ended);
    track.addEventListener("mute", mute);
    track.addEventListener("unmute", unmute);
    undo.push(() => {
      track.removeEventListener("ended", ended);
      track.removeEventListener("mute", mute);
      track.removeEventListener("unmute", unmute);
    });
  }

  return () => undo.forEach((u) => u());
}

export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop());
}

/** A live stream that is actually delivering (every track "live"). */
export function isStreamLive(stream: MediaStream | null | undefined): boolean {
  return !!stream && stream.getTracks().length > 0 && stream.getTracks().every((t) => t.readyState === "live");
}

/** A hidden <video> that plays a stream so frames can be read from it. Muted + playsInline so autoplay is always allowed. */
export function attachHiddenVideo(stream: MediaStream): HTMLVideoElement {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.autoplay = true;
  v.setAttribute("aria-hidden", "true");
  v.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:2px;height:2px;opacity:0;pointer-events:none";
  v.srcObject = stream;
  document.body.appendChild(v);
  void v.play().catch(() => undefined);

  return v;
}

export function detachHiddenVideo(v: HTMLVideoElement | null): void {
  if (!v) return;
  v.pause();
  v.srcObject = null;
  v.remove();
}

/** Reads a tiny RGBA thumbnail from a playing video (for brightness / freeze checks). null while it has no picture. */
export function thumbnail(v: HTMLVideoElement, w = 32, h = 24): Uint8ClampedArray | null {
  if (v.readyState < 2 || v.videoWidth === 0) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(v, 0, 0, w, h);

  return ctx.getImageData(0, 0, w, h).data;
}
