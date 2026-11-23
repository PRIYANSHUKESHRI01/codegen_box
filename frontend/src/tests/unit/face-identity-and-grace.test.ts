import { describe, expect, it } from "vitest";
import {
  extractFaceDescriptor,
  computeFaceSimilarity,
  FACE_MATCH_THRESHOLD,
  type Point3D,
} from "@/lib/integrity/detectors/faceIdentity";

describe("Face Identity Descriptor & Cosine Matching", () => {
  it("returns null when landmarks are incomplete or missing", () => {
    expect(extractFaceDescriptor([])).toBeNull();
    const shortList: Point3D[] = Array.from({ length: 100 }, () => ({ x: 0, y: 0, z: 0 }));
    expect(extractFaceDescriptor(shortList)).toBeNull();
  });

  it("extracts a 24-dimensional normalized descriptor from valid 478 landmarks", () => {
    const dummyLandmarks: Point3D[] = Array.from({ length: 478 }, (_, i) => ({
      x: 0.5 + Math.sin(i) * 0.1,
      y: 0.5 + Math.cos(i) * 0.1,
      z: 0.01 * (i % 5),
    }));

    // Ensure valid eye distances
    dummyLandmarks[133] = { x: 0.45, y: 0.4, z: 0 }; // LEFT_EYE_INNER
    dummyLandmarks[362] = { x: 0.55, y: 0.4, z: 0 }; // RIGHT_EYE_INNER
    dummyLandmarks[1] = { x: 0.5, y: 0.5, z: 0.05 };  // NOSE_TIP
    dummyLandmarks[152] = { x: 0.5, y: 0.75, z: 0 }; // CHIN
    dummyLandmarks[10] = { x: 0.5, y: 0.2, z: 0 };   // FOREHEAD
    dummyLandmarks[234] = { x: 0.35, y: 0.5, z: 0 }; // LEFT_CHEEK
    dummyLandmarks[454] = { x: 0.65, y: 0.5, z: 0 }; // RIGHT_CHEEK
    dummyLandmarks[61] = { x: 0.46, y: 0.65, z: 0 }; // LEFT_MOUTH
    dummyLandmarks[291] = { x: 0.54, y: 0.65, z: 0 };// RIGHT_MOUTH

    const descriptor = extractFaceDescriptor(dummyLandmarks);
    expect(descriptor).not.toBeNull();
    expect(descriptor).toHaveLength(24);

    // Verify L2 normalization: sum of squares == 1
    const sumSq = descriptor!.reduce((sum, val) => sum + val * val, 0);
    expect(sumSq).toBeCloseTo(1.0, 4);
  });

  it("computes cosine similarity accurately", () => {
    const vecA = [0.6, 0.8, 0.0];
    const vecB = [0.6, 0.8, 0.0];
    expect(computeFaceSimilarity(vecA, vecB)).toBeCloseTo(1.0, 4);

    const vecC = [0.8, -0.6, 0.0];
    expect(computeFaceSimilarity(vecA, vecC)).toBeCloseTo(0.0, 4);

    expect(FACE_MATCH_THRESHOLD).toBe(0.82);
  });

  it("discriminates between matching and non-matching face geometry", () => {
    // Two similar faces (slight natural variation in expression)
    const baseVector = [
      0.35, 0.42, 0.28, 0.15, 0.16, 0.25, 0.26, 0.18, 0.19,
      0.88, 0.32, 0.29, 0.45, 0.38, 0.39, 0.21, 0.22, 0.11,
      0.31, 0.34, 0.37, 0.41, 0.36, 0.33,
    ];
    const normBase = Math.sqrt(baseVector.reduce((a, b) => a + b * b, 0));
    const normalizedBase = baseVector.map((v) => v / normBase);

    // Minor deviation (same person slightly smiling)
    const samePerson = baseVector.map((v, i) => v + (i % 2 === 0 ? 0.01 : -0.01));
    const normSame = Math.sqrt(samePerson.reduce((a, b) => a + b * b, 0));
    const normalizedSame = samePerson.map((v) => v / normSame);

    const matchSimilarity = computeFaceSimilarity(normalizedBase, normalizedSame);
    expect(matchSimilarity).toBeGreaterThanOrEqual(FACE_MATCH_THRESHOLD);

    // Drastically different face geometry (different person)
    const differentPerson = baseVector.map((v, i) => (i % 2 === 0 ? -v : v * 0.2));
    const normDiff = Math.sqrt(differentPerson.reduce((a, b) => a + b * b, 0));
    const normalizedDiff = differentPerson.map((v) => v / normDiff);

    const diffSimilarity = computeFaceSimilarity(normalizedBase, normalizedDiff);
    expect(diffSimilarity).toBeLessThan(FACE_MATCH_THRESHOLD);
  });
});
