import { describe, expect, it } from "vitest";
import { AttentionRules, AWAY_MS, headPose, MULTI_MS, NO_FACE_MS, type Observation } from "@/lib/integrity/detectors/attention";
import { BLACK_SECONDS, CameraHealth, FROZEN_SECONDS, isVirtualCameraLabel, sampleFrame } from "@/lib/integrity/detectors/cameraHealth";
import { levelDb, SpeechGate } from "@/lib/integrity/detectors/speech";

const obs = (t: number, over: Partial<Observation> = {}): Observation => ({ t, faces: 1, yaw: 0.02, pitch: 0.05, ...over });

/** Feeds `seconds` of identical frames, one per second, and returns every finding. */
function run(rules: AttentionRules, from: number, seconds: number, over: Partial<Observation>) {
  const out = [];
  for (let s = 0; s <= seconds; s++) out.push(...rules.feed(obs(from + s * 1000, over)));

  return out;
}

describe("AttentionRules", () => {
  it("says nothing about a student who sits and works", () => {
    const rules = new AttentionRules();
    expect(run(rules, 0, 120, {})).toEqual([]);
  });

  it("reports an empty chair only after it has stayed empty, and only once", () => {
    const rules = new AttentionRules();
    expect(run(rules, 0, NO_FACE_MS / 1000 - 1, { faces: 0, yaw: null, pitch: null })).toEqual([]);

    const found = run(rules, NO_FACE_MS, 30, { faces: 0, yaw: null, pitch: null });
    expect(found.map((f) => f.type)).toEqual(["no_face"]);
  });

  it("forgets a brief walk-out: coming back resets the clock", () => {
    const rules = new AttentionRules();
    run(rules, 0, 5, { faces: 0, yaw: null, pitch: null });
    run(rules, 6000, 2, {});
    expect(run(rules, 9000, 6, { faces: 0, yaw: null, pitch: null })).toEqual([]);
  });

  it("flags a second person who stays in view, not one who passes", () => {
    const rules = new AttentionRules();
    expect(run(rules, 0, 2, { faces: 2 })).toEqual([]);
    run(rules, 3000, 0, {});
    expect(run(rules, 4000, 3, { faces: 2 })).toEqual([]);

    const found = run(rules, 10_000, MULTI_MS / 1000 + 1, { faces: 2 });
    expect(found.map((f) => f.type)).toEqual(["multiple_faces"]);
    expect(found[0]).toMatchObject({ data: { faces: 2 } });
  });

  it("measures 'looking away' against the student's own posture, not a fixed angle", () => {
    const rules = new AttentionRules();
    // Someone who sits off-axis: their baseline is yaw 0.3 — that is NOT away.
    expect(run(rules, 0, 40, { yaw: 0.3, pitch: 0.1 })).toEqual([]);

    // Turning well away from that baseline for long enough is.
    const found = run(rules, 41_000, AWAY_MS / 1000 + 2, { yaw: 0.3 + 0.4, pitch: 0.1 });
    expect(found.map((f) => f.type)).toEqual(["face_away"]);
  });

  it("does not call a glance down 'away'", () => {
    const rules = new AttentionRules();
    run(rules, 0, 20, {});
    expect(run(rules, 21_000, 3, { pitch: 0.5 })).toEqual([]);
    expect(run(rules, 25_000, 20, {})).toEqual([]);
  });

  it("needs a phone to be seen twice before it says so", () => {
    const rules = new AttentionRules();
    expect(rules.feed(obs(0, { phone: 0.9 }))).toEqual([]);
    expect(rules.feed(obs(30_000, { phone: 0.9 }))).toEqual([]); // the first sighting went stale

    expect(rules.feed(obs(33_000, { phone: 0.8 })).map((f) => f.type)).toEqual(["phone_detected"]);
    // …and then not again for a minute.
    expect(rules.feed(obs(40_000, { phone: 0.9 }))).toEqual([]);
    expect(rules.feed(obs(42_000, { phone: 0.9 }))).toEqual([]);
  });

  it("ignores weak phone scores", () => {
    const rules = new AttentionRules();
    expect(rules.feed(obs(0, { phone: 0.3 }))).toEqual([]);
    expect(rules.feed(obs(3000, { phone: 0.4 }))).toEqual([]);
  });
});

describe("headPose", () => {
  const p = (x: number, y: number) => ({ x, y });

  it("is ~0 for a face looking straight at the camera and grows as the nose moves toward a cheek", () => {
    const straight = headPose(p(0.5, 0.55), p(0.3, 0.5), p(0.7, 0.5), p(0.5, 0.2), p(0.5, 0.8));
    expect(straight?.yaw).toBeCloseTo(0, 5);

    const turned = headPose(p(0.62, 0.55), p(0.3, 0.5), p(0.7, 0.5), p(0.5, 0.2), p(0.5, 0.8));
    expect(turned!.yaw).toBeGreaterThan(0.25);
  });

  it("gives up on a degenerate face", () => {
    expect(headPose(p(0, 0), p(0.5, 0.5), p(0.5, 0.5), p(0.5, 0.5), p(0.5, 0.5))).toBeNull();
  });
});

describe("camera health", () => {
  const frame = (value: number, jitter = 0) => {
    const px = new Uint8ClampedArray(32 * 24 * 4);
    for (let i = 0; i < px.length; i += 4) {
      const v = value + ((i / 4) % 7) * jitter;
      px[i] = px[i + 1] = px[i + 2] = v;
      px[i + 3] = 255;
    }

    return px;
  };

  it("recognises software cameras by name and leaves real ones alone", () => {
    for (const label of ["OBS Virtual Camera", "ManyCam Virtual Webcam", "Snap Camera", "DroidCam Source 3", "Iriun Webcam", "XSplit VCam", "mmhmm Virtual Camera"]) {
      expect(isVirtualCameraLabel(label), label).toBe(true);
    }
    for (const label of ["Integrated Camera", "HD Webcam C270", "Logitech BRIO", "USB2.0 HD UVC WebCam", "FaceTime HD Camera", "Integrated_Webcam_HD"]) {
      expect(isVirtualCameraLabel(label), label).toBe(false);
    }
  });

  it("reports a covered camera once it has stayed dark long enough", () => {
    const health = new CameraHealth();
    let found = null;
    for (let s = 0; s < BLACK_SECONDS - 1; s++) expect(health.feed(sampleFrame(frame(2)), s * 1000)).toBeNull();
    for (let s = BLACK_SECONDS - 1; s < BLACK_SECONDS + 3; s++) found ??= health.feed(sampleFrame(frame(2)), s * 1000);
    expect(found?.type).toBe("camera_blocked");
  });

  it("a frozen picture is reported, a living one (sensor noise) is not", () => {
    const frozen = new CameraHealth();
    let found = null;
    for (let s = 0; s <= FROZEN_SECONDS + 2; s++) found ??= frozen.feed(sampleFrame(frame(120)), s * 1000);
    expect(found?.type).toBe("camera_frozen");

    const alive = new CameraHealth();
    for (let s = 0; s <= FROZEN_SECONDS + 5; s++) expect(alive.feed(sampleFrame(frame(100 + (s % 9) * 16, 9)), s * 1000)).toBeNull();
  });
});

describe("speech gate", () => {
  it("reports sustained speech above the room's noise floor, once", () => {
    const gate = new SpeechGate();
    for (let i = 0; i < 80; i++) gate.feed(-62, i * 100); // a quiet room teaches the floor

    let said: number | null = null;
    let reports = 0;
    for (let i = 0; i < 90; i++) {
      const r = gate.feed(-30 + (i % 3), 8000 + i * 100);
      if (r !== null) {
        said = r;
        reports++;
      }
    }
    expect(said).toBeGreaterThanOrEqual(6);
    expect(reports).toBe(1);
  });

  it("ignores a cough or a door", () => {
    const gate = new SpeechGate();
    for (let i = 0; i < 50; i++) gate.feed(-62, i * 100);
    let reported = false;
    for (let i = 0; i < 12; i++) reported ||= gate.feed(-25, 6000 + i * 100) !== null; // 1.2 s of noise
    for (let i = 0; i < 100; i++) reported ||= gate.feed(-62, 7200 + i * 100) !== null;
    expect(reported).toBe(false);
  });

  it("measures level in dB from float samples", () => {
    expect(levelDb(new Float32Array(256))).toBe(-100);
    expect(levelDb(new Float32Array(256).fill(1))).toBeCloseTo(0, 5);
    expect(levelDb(new Float32Array(256).fill(0.1))).toBeCloseTo(-20, 1);
  });
});
