// Copies MediaPipe's WebAssembly runtime out of node_modules into public/integrity/wasm so the exam page loads its
// camera-analysis engine from OUR origin (same host as the app), not from a CDN that a campus network may block or that
// could be unavailable mid-exam. Runs before `next dev` / `next build` / after `npm install`; safe to run any time.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join(root, "public", "integrity", "wasm");

if (!existsSync(from)) {
  console.warn("[integrity] @mediapipe/tasks-vision is not installed; camera analysis will report 'unavailable'.");
  process.exit(0);
}

mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log("[integrity] copied the camera-analysis runtime to public/integrity/wasm");
