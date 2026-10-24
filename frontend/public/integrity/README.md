# Exam-integrity assets

Served to the browser by the proctored exam pages (see `src/lib/integrity/detectors/vision.ts`).

| Path | What | Source |
| --- | --- | --- |
| `models/face_landmarker.task` | face landmark model (how many faces, where the head points) | `storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/` — Apache-2.0 |
| `models/efficientdet_lite0.tflite` | object detector (is there a phone in the picture) | `storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/` — Apache-2.0 |
| `wasm/` | the MediaPipe runtime | copied from `node_modules/@mediapipe/tasks-vision/wasm` by `scripts/copy-integrity-assets.mjs` (git-ignored) |

They are served from our own origin on purpose: a campus network may block CDNs, and a CDN outage must not change an exam.
Everything runs in the student's browser; no video or audio is sent anywhere by these models.
