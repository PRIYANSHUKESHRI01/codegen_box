/**
 * In-browser face identity descriptor & geometric matching.
 *
 * Uses MediaPipe's 478 3D facial mesh landmarks to compute an invariant facial proportion
 * vector (inter-ocular distance, nose-to-chin, mouth-to-eye, jawline contours).
 * Normalised against scale and position so natural student movements do not corrupt the signature.
 *
 * Zero database storage needed: stored in browser session state and compared live every 1-2 seconds.
 */

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

// MediaPipe landmark indices for key facial features
const NOSE_TIP = 1;
const NOSE_BRIDGE = 168;
const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const CHIN = 152;
const FOREHEAD = 10;
const LEFT_MOUTH = 61;
const RIGHT_MOUTH = 291;
const UPPER_LIP = 0;
const LOWER_LIP = 17;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;
const JAW_POINTS = [58, 172, 136, 150, 152, 377, 365, 397, 288];

function dist(p1: Point3D, p2: Point3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z ?? 0) - (p2.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Extracts a normalized 24-dimensional facial geometry vector from MediaPipe landmarks.
 * Returns null if required landmarks are missing or malformed.
 */
export function extractFaceDescriptor(landmarks: Point3D[]): number[] | null {
  if (!landmarks || landmarks.length < 468) return null;

  const leftEye = landmarks[LEFT_EYE_INNER];
  const rightEye = landmarks[RIGHT_EYE_INNER];
  const nose = landmarks[NOSE_TIP];
  const noseBridge = landmarks[NOSE_BRIDGE];
  const chin = landmarks[CHIN];
  const forehead = landmarks[FOREHEAD];
  const leftMouth = landmarks[LEFT_MOUTH];
  const rightMouth = landmarks[RIGHT_MOUTH];
  const leftCheek = landmarks[LEFT_CHEEK];
  const rightCheek = landmarks[RIGHT_CHEEK];

  if (!leftEye || !rightEye || !nose || !chin || !forehead || !leftMouth || !rightMouth || !leftCheek || !rightCheek) {
    return null;
  }

  // Unit of scale: inter-ocular distance (distance between eye inner corners)
  const iod = dist(leftEye, rightEye);
  if (iod < 1e-4) return null;

  // Face width and height
  const faceWidth = dist(leftCheek, rightCheek);
  const faceHeight = dist(forehead, chin);
  if (faceWidth < 1e-4 || faceHeight < 1e-4) return null;

  const vector: number[] = [
    // 1. Proportions to inter-ocular distance
    dist(nose, chin) / iod,
    dist(forehead, nose) / iod,
    dist(leftMouth, rightMouth) / iod,
    dist(nose, leftMouth) / iod,
    dist(nose, rightMouth) / iod,
    dist(leftEye, leftMouth) / iod,
    dist(rightEye, rightMouth) / iod,
    dist(leftEye, nose) / iod,
    dist(rightEye, nose) / iod,

    // 2. Proportions to overall face dimensions
    faceHeight / faceWidth,
    dist(nose, chin) / faceHeight,
    dist(forehead, noseBridge) / faceHeight,
    dist(leftMouth, rightMouth) / faceWidth,
    dist(leftCheek, nose) / faceWidth,
    dist(rightCheek, nose) / faceWidth,

    // 3. Eye-to-mouth symmetry & vertical alignment
    dist(leftEye, leftCheek) / iod,
    dist(rightEye, rightCheek) / iod,
    dist(landmarks[UPPER_LIP], landmarks[LOWER_LIP]) / iod,

    // 4. Jawline curvature relative to chin
    dist(landmarks[JAW_POINTS[0]], chin) / faceWidth,
    dist(landmarks[JAW_POINTS[1]], chin) / faceWidth,
    dist(landmarks[JAW_POINTS[2]], chin) / faceWidth,
    dist(landmarks[JAW_POINTS[5]], chin) / faceWidth,
    dist(landmarks[JAW_POINTS[6]], chin) / faceWidth,
    dist(landmarks[JAW_POINTS[7]], chin) / faceWidth,
  ];

  // L2 Normalize the vector
  let normSq = 0;
  for (const v of vector) normSq += v * v;
  const norm = Math.sqrt(normSq);
  if (norm < 1e-5) return null;

  return vector.map((v) => v / norm);
}

/**
 * Computes cosine similarity between two normalized face descriptors.
 * Returns a value between -1.0 and 1.0 (typically 0.85-0.99 for same person).
 */
export function computeFaceSimilarity(d1: number[], d2: number[]): number {
  if (!d1 || !d2 || d1.length !== d2.length || d1.length === 0) return 0;

  let dot = 0;
  for (let i = 0; i < d1.length; i++) {
    dot += d1[i] * d2[i];
  }

  return Math.max(0, Math.min(1, dot));
}

/** Threshold below which a face is considered non-matching */
export const FACE_MATCH_THRESHOLD = 0.82;

/**
 * Captures a high-resolution snapshot still from a video element into JPEG data URL.
 */
export function captureVideoStill(video: HTMLVideoElement, quality = 0.82): string | null {
  if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(640, video.videoWidth);
    canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Draw video unmirrored
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return null;
  }
}
