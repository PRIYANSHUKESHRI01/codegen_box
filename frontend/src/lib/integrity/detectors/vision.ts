import { headPose } from "./attention";

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

/** Loads the models on ONE delegate. The caller decides which (see IntegrityEngine.startVision): CPU first, because a software-emulated GPU can be a hundred times slower than the CPU path. */
export async function loadVision(base = "/integrity", delegate: Delegate = "CPU"): Promise<VisionEngine> {
  const vision = await import("@mediapipe/tasks-vision");
  const fileset = await vision.FilesetResolver.forVisionTasks(`${base}/wasm`);

  const faces = await vision.FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${base}/models/face_landmarker.task`, delegate },
    runningMode: "VIDEO",
    numFaces: 3,
  });

  let objects: Awaited<ReturnType<typeof vision.ObjectDetector.createFromOptions>> | null = null;
  try {
    objects = await vision.ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${base}/models/efficientdet_lite0.tflite`, delegate },
      runningMode: "VIDEO",
      scoreThreshold: 0.35,
      maxResults: 6,
    });
  } catch {
    objects = null; // faces still work without the phone detector
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

      if (list.length >= 1) {
        const l = list[0];
        const pose = l[NOSE] && l[LEFT_CHEEK] && l[RIGHT_CHEEK] && l[FOREHEAD] && l[CHIN] ? headPose(l[NOSE], l[LEFT_CHEEK], l[RIGHT_CHEEK], l[FOREHEAD], l[CHIN]) : null;
        yaw = pose?.yaw ?? null;
        pitch = pose?.pitch ?? null;
      }

      const out: FrameAnalysis = { faces: list.length, yaw, pitch };

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
      faces.close();
      objects?.close();
    },
  };
}
