import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { IntegrityEngine } from "@/lib/integrity/engine";
import { getIntegrityUi, resetIntegrityUi } from "@/lib/integrity/store";
import { AnswerEditor } from "@/components/dashboard/interviews/room/AnswerEditor";
import { VoiceVerificationGate } from "@/components/dashboard/voice/VoiceVerificationGate";
import { extractAcousticSignatureFromPCM } from "@/lib/voice/acousticSignature";
import { api } from "@/lib/api";

describe("Multiple-person camera detection (5-second reminder + block)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetIntegrityUi();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetIntegrityUi();
  });

  it("shows a 5-second countdown reminder on multiple_faces and locks after 5 seconds", () => {
    const phases: string[] = [];
    const engine = new IntegrityEngine({
      surface: "interview",
      basePath: "/interviews/test",
      keepKey: "test-key",
      userKey: "user-1",
      activityLabel: "interview",
      handlers: {
        phase: (p) => phases.push(p),
        session: () => undefined,
        violation: () => undefined,
        consentError: () => undefined,
        camera: () => undefined,
        previewReady: () => undefined,
      },
    });

    (engine as unknown as { phase: string }).phase = "active";
    const guard = (engine as unknown as {
      evaluateGraceGuard: (a: { faces: number; yaw: number | null; pitch: number | null }, sim: number | null) => void;
    }).evaluateGraceGuard.bind(engine);

    vi.setSystemTime(new Date("2026-11-26T10:00:00.000Z"));
    guard({ faces: 2, yaw: 0, pitch: 0 }, null);

    expect(getIntegrityUi().graceWarning).toMatchObject({
      type: "multiple_faces",
      secondsRemaining: 5,
    });

    // At 3 seconds remaining it should NOT lock yet
    vi.setSystemTime(new Date("2026-11-26T10:00:02.000Z"));
    guard({ faces: 2, yaw: 0, pitch: 0 }, null);
    expect(getIntegrityUi().graceWarning?.secondsRemaining).toBe(3);
    expect(phases).not.toContain("locked");

    // After 5 full seconds it must lock
    vi.setSystemTime(new Date("2026-11-26T10:00:05.000Z"));
    guard({ faces: 2, yaw: 0, pitch: 0 }, null);
    expect(getIntegrityUi().graceWarning).toBeNull();
    expect(phases).toContain("locked");
  });

  it("clears the 5-second warning if the extra person leaves within 5 seconds", () => {
    const engine = new IntegrityEngine({
      surface: "interview",
      basePath: "/interviews/test",
      keepKey: "test-key-2",
      userKey: "user-1",
      activityLabel: "interview",
      handlers: {
        phase: () => undefined,
        session: () => undefined,
        violation: () => undefined,
        consentError: () => undefined,
        camera: () => undefined,
        previewReady: () => undefined,
      },
    });
    (engine as unknown as { phase: string }).phase = "active";
    const guard = (engine as unknown as {
      evaluateGraceGuard: (a: { faces: number; yaw: number | null; pitch: number | null }, sim: number | null) => void;
    }).evaluateGraceGuard.bind(engine);

    vi.setSystemTime(new Date("2026-11-26T10:00:00.000Z"));
    guard({ faces: 3, yaw: 0, pitch: 0 }, null);
    expect(getIntegrityUi().graceWarning?.type).toBe("multiple_faces");

    vi.setSystemTime(new Date("2026-11-26T10:00:02.000Z"));
    guard({ faces: 1, yaw: 0, pitch: 0 }, null);
    expect(getIntegrityUi().graceWarning).toBeNull();
  });
});

describe("AnswerEditor improved transcript + audio review UI", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders read-only transcript, custom audio player controls, and speed selector", () => {
    render(
      <AnswerEditor
        label="Your spoken answer"
        value="Dependency injection decouples object creation from business logic."
        audioUrl="blob:http://localhost:3000/sample"
        recordedSeconds={42}
      />
    );

    expect(screen.getByTestId("spoken-transcript-preview")).toBeInTheDocument();
    expect(screen.getByText(/Dependency injection decouples/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play recording" })).toBeInTheDocument();
    expect(screen.getByText("0:42")).toBeInTheDocument();

    const speedBtn = screen.getByTitle("Playback speed");
    expect(speedBtn).toHaveTextContent("1×");
    fireEvent.click(speedBtn);
    expect(speedBtn).toHaveTextContent("1.25×");
  });
});

describe("VoiceVerificationGate", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the one-time 5-minute verification requirement when not started", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      required: true,
      status: "not_started",
      required_duration_seconds: 300,
      min_enroll_duration_seconds: 100,
      total_duration_seconds: 0,
      samples_count: 0,
      total_prompts: 5,
      ready_to_complete: false,
      completed_at: null,
      last_verified_at: null,
      last_match_score: null,
      blocked_at: null,
      blocked_reason: null,
      voice_summary: null,
      prompts: [],
    });

    render(
      <VoiceVerificationGate surfaceLabel="Vault AI Interview" returnTo="/dashboard/vault-interviews">
        <div>Vault Sets</div>
      </VoiceVerificationGate>
    );

    expect(await screen.findByTestId("voice-verification-required-gate")).toBeInTheDocument();
    expect(screen.getByText(/Complete Your One-Time 5-Minute Voice Baseline Verification/)).toBeInTheDocument();
    expect(screen.queryByText("Vault Sets")).not.toBeInTheDocument();
  });

  it("shows blocked panel and hides interview content when voice verification is blocked", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      required: true,
      status: "blocked",
      required_duration_seconds: 300,
      min_enroll_duration_seconds: 100,
      total_duration_seconds: 300,
      samples_count: 5,
      total_prompts: 5,
      ready_to_complete: false,
      completed_at: null,
      last_verified_at: null,
      last_match_score: 21,
      blocked_at: "2026-11-26T05:00:00Z",
      blocked_reason: "Voice mismatch detected.",
      voice_summary: null,
      prompts: [],
    });

    render(
      <VoiceVerificationGate surfaceLabel="Mock AI Interview" returnTo="/dashboard/interviews">
        <div>Mock Explorer</div>
      </VoiceVerificationGate>
    );

    expect(await screen.findByTestId("voice-verification-blocked-gate")).toBeInTheDocument();
    expect(screen.queryByText("Mock Explorer")).not.toBeInTheDocument();
  });

  it("shows retry prompt with remaining attempts when proctoring locked fewer than 3 times", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      required: true,
      status: "in_progress",
      proctoring_status: "locked",
      enrollment_lock_count: 1,
      max_enrollment_attempts: 3,
      remaining_enrollment_attempts: 2,
      can_retry_enrollment: true,
      required_duration_seconds: 300,
      min_enroll_duration_seconds: 100,
      total_duration_seconds: 0,
      samples_count: 0,
      total_prompts: 5,
      ready_to_complete: false,
      completed_at: null,
      last_verified_at: null,
      last_match_score: null,
      blocked_at: null,
      blocked_reason: "Attempt 1 of 3 stopped due to fullscreen exit. 2 attempts remaining.",
      voice_summary: null,
      prompts: [],
    });

    render(
      <VoiceVerificationGate surfaceLabel="Vault AI Interview" returnTo="/dashboard/vault-interviews">
        <div>Vault Sets</div>
      </VoiceVerificationGate>
    );

    expect(await screen.findByTestId("voice-verification-retry-gate")).toBeInTheDocument();
    expect(screen.getAllByText(/2 attempts remaining/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Retry Voice Verification/i })).toBeInTheDocument();
  });
});

describe("Local zero-cost Voice Biometric DSP extractor (v2)", () => {
  const synthesizeVoice = (f0Hz: number, harmonicWeights: number[], sampleRate = 16000, seconds = 1.2) => {
    const length = Math.floor(sampleRate * seconds);
    const pcm = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let val = 0;
      harmonicWeights.forEach((weight, idx) => {
        val += weight * Math.sin(2 * Math.PI * f0Hz * (idx + 1) * t);
      });
      pcm[i] = val * 0.25;
    }
    return pcm;
  };

  it("extracts F0 pitch, 13 MFCCs, and 24 spectral bands cleanly without external APIs", () => {
    const lowMale = extractAcousticSignatureFromPCM(synthesizeVoice(125, [1.0, 0.7, 0.45, 0.25, 0.1], 16000), 16000);
    const highFemale = extractAcousticSignatureFromPCM(synthesizeVoice(235, [0.5, 1.0, 0.85, 0.65, 0.5], 16000), 16000);

    expect(lowMale).not.toBeNull();
    expect(highFemale).not.toBeNull();
    expect(lowMale!.version).toBe(2);
    expect(lowMale!.mfccMean).toHaveLength(13);
    expect(lowMale!.mfccStd).toHaveLength(13);
    expect(lowMale!.bands).toHaveLength(24);
    expect(lowMale!.f0Median).toBeGreaterThan(110);
    expect(lowMale!.f0Median).toBeLessThan(145);
    expect(highFemale!.f0Median).toBeGreaterThan(215);
    expect(highFemale!.f0Median).toBeLessThan(260);
    expect(lowMale!.voicedRatio).toBeGreaterThan(0.9);
  });
});

describe("Phone persistence across non-object vision ticks & pitch look-away", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetIntegrityUi();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetIntegrityUi();
  });

  it("maintains the 2-second phone_detected countdown even when intermediate frames omit phone analysis", () => {
    const phases: string[] = [];
    const engine = new IntegrityEngine({
      surface: "interview",
      basePath: "/interviews/test",
      keepKey: "test-phone-key",
      userKey: "user-1",
      activityLabel: "interview",
      handlers: {
        phase: (p) => phases.push(p),
        session: () => undefined,
        violation: () => undefined,
        consentError: () => undefined,
        camera: () => undefined,
        previewReady: () => undefined,
      },
    });
    (engine as unknown as { phase: string }).phase = "active";
    const guard = (engine as unknown as {
      evaluateGraceGuard: (a: { faces: number; yaw: number | null; pitch: number | null; phone?: number }, sim: number | null) => void;
    }).evaluateGraceGuard.bind(engine);

    vi.setSystemTime(new Date("2026-11-26T10:00:00.000Z"));
    // Frame 0: object detector sees phone
    guard({ faces: 1, yaw: 0, pitch: 0, phone: 0.72 }, null);
    expect(getIntegrityUi().graceWarning).toMatchObject({ type: "phone_detected", secondsRemaining: 2 });

    // Frame 1 (800ms later): object detector skipped (phone undefined) — warning MUST stay active!
    vi.setSystemTime(new Date("2026-11-26T10:00:00.800Z"));
    guard({ faces: 1, yaw: 0, pitch: 0 }, null);
    expect(getIntegrityUi().graceWarning).toMatchObject({ type: "phone_detected", secondsRemaining: 2 });

    // 2.1s later: locks the session cleanly
    vi.setSystemTime(new Date("2026-11-26T10:00:02.100Z"));
    guard({ faces: 1, yaw: 0, pitch: 0 }, null);
    expect(getIntegrityUi().graceWarning).toBeNull();
    expect(phases).toContain("locked");
  });
});
