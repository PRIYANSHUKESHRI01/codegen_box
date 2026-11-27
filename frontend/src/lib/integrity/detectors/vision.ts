import { headPose } from "./attention";
import { extractFaceDescriptor } from "./faceIdentity";

/**
 * In-browser face and phone detection with MediaPipe (WebAssembly, served from our own origin — see public/integrity).
 * Loaded lazily the first time an attempt needs it, never at page load, and always optional: if the runtime cannot be
 * fetched, the device is too slow, or WebGL/WASM is unavailable, the attempt carries on and the engine reports
 * `ai_unavailable` (the evidence stills still go to the reviewer, who can see the room for themselves).
 *
 * Nothing here is trusted by the server as proof — a modified browser can say "one face, looking at the screen" — which
 * is exactly why the rest of the system treats these findings as flags that attach a still, not as verdicts.
 */

export interface FrameAnalysis {
  faces: number;
  yaw: number | null;
  pitch: number | null;
  /** Highest "cell phone" confidence, only when the (slower) object detector ran for this frame. */
  phone?: number;
  /** 24-dimensional normalized facial landmark descriptor for live candidate verification. */
  faceDescriptor?: number[] | null;
}

export interface VisionEngine {
  analyse(video: HTMLVideoElement, withObjects: boolean): FrameAnalysis | null;
  close(): void;
}

const NOSE = 1;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const FOREHEAD = 10;
const CHIN = 152;

export type Delegate = "CPU" | "GPU";

export interface LoadVisionOptions {
  /** Skip the 7.25 MB ObjectDetector download when only checking face landmarks (e.g., Lobby photo check). */
  includeObjects?: boolean;
}

type VisionModule = typeof import("@mediapipe/tasks-vision");
type FilesetResolverInstance = Awaited<ReturnType<VisionModule["FilesetResolver"]["forVisionTasks"]>>;
type FaceLandmarkerInstance = Awaited<ReturnType<VisionModule["FaceLandmarker"]["createFromOptions"]>>;

let visionModPromise: Promise<VisionModule> | null = null;
const filesetCache = new Map<string, Promise<FilesetResolverInstance>>();
const faceModelCache = new Map<string, Promise<FaceLandmarkerInstance>>();

function getFileset(base: string): Promise<FilesetResolverInstance> {
  let cached = filesetCache.get(base);
  if (!cached) {
    cached = (async () => {
      visionModPromise ??= import("@mediapipe/tasks-vision");
      const vision = await visionModPromise;
      return vision.FilesetResolver.forVisionTasks(`${base}/wasm`);
    })().catch((err) => {
      filesetCache.delete(base);
      throw err;
    });
    filesetCache.set(base, cached);
  }
  return cached;
}

function getSharedFaceLandmarker(base: string, delegate: Delegate): Promise<FaceLandmarkerInstance> {
  const key = `${base}|${delegate}`;
  let cached = faceModelCache.get(key);
  if (!cached) {
    cached = (async () => {
      const fileset = await getFileset(base);
      const vision = await (visionModPromise ??= import("@mediapipe/tasks-vision"));
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${base}/models/face_landmarker.task`, delegate },
        runningMode: "VIDEO",
        numFaces: 4,
        minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55,
        minTrackingConfidence: 0.5,
      });
    })().catch((err) => {
      faceModelCache.delete(key);
      throw err;
    });
    faceModelCache.set(key, cached);
  }
  return cached;
}

/** Loads the models on ONE delegate. Reuses cached WASM + FaceLandmarker singletons across Lobby -> Live room so photo capture & room start are fast. */
export async function loadVision(base = "/integrity", delegate: Delegate = "CPU", opts?: LoadVisionOptions): Promise<VisionEngine> {
  const includeObjects = opts?.includeObjects ?? true;
  const faces = await getSharedFaceLandmarker(base, delegate);

  let objects: Awaited<ReturnType<VisionModule["ObjectDetector"]["createFromOptions"]>> | null = null;
  if (includeObjects) {
    try {
      const fileset = await getFileset(base);
      const vision = await (visionModPromise ??= import("@mediapipe/tasks-vision"));
      objects = await vision.ObjectDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: `${base}/models/efficientdet_lite0.tflite`, delegate },
        runningMode: "VIDEO",
        scoreThreshold: 0.35,
        maxResults: 6,
      });
    } catch {
      objects = null; // faces still work without the phone detector
    }
  }

  let lastTs = 0;
  const stamp = () => {
    lastTs = Math.max(lastTs + 1, Math.round(performance.now()));

    return lastTs;
  };

  return {
    analyse(video, withObjects) {
      if (video.readyState < 2 || video.videoWidth === 0) return null;
      const ts = stamp();

      const result = faces.detectForVideo(video, ts);
      const list = result.faceLandmarks ?? [];
      let yaw: number | null = null;
      let pitch: number | null = null;
      let faceDescriptor: number[] | null = null;

      if (list.length >= 1) {
        const l = list[0];
        const pose = l[NOSE] && l[LEFT_CHEEK] && l[RIGHT_CHEEK] && l[FOREHEAD] && l[CHIN] ? headPose(l[NOSE], l[LEFT_CHEEK], l[RIGHT_CHEEK], l[FOREHEAD], l[CHIN]) : null;
        yaw = pose?.yaw ?? null;
        pitch = pose?.pitch ?? null;
        faceDescriptor = extractFaceDescriptor(l);
      }

      const out: FrameAnalysis = { faces: list.length, yaw, pitch, faceDescriptor };

      if (withObjects && objects) {
        let best = 0;
        for (const d of objects.detectForVideo(video, stamp()).detections) {
          for (const c of d.categories) {
            if (c.categoryName === "cell phone") best = Math.max(best, c.score);
          }
        }
        out.phone = best;
      }

      return out;
    },
    close() {
      // Keep the shared FaceLandmarker cached so transitioning Lobby -> Live room stays instant; close only private ObjectDetector.
      objects?.close();
    },
  };
}
