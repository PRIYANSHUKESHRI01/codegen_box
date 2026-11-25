import { createRef } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

vi.mock("@/lib/integrity/detectors/faceIdentity", () => ({
  captureVideoStill: vi.fn(() => "data:image/jpeg;base64,fake-photo"),
  computeFaceSimilarity: vi.fn(() => 0.99),
}));

vi.mock("@/lib/integrity/detectors/vision", () => ({
  loadVision: vi.fn(async () => ({
    analyse: () => ({ faces: 1, yaw: 0, pitch: 0, faceDescriptor: [0.1, 0.2, 0.3] }),
    close: vi.fn(),
  })),
}));

vi.mock("@/lib/integrity/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrity/store")>();
  return {
    ...actual,
    useIntegrityUi: () => ({
      attached: true,
      policy: null,
      checks: [],
      hold: null,
      guardian: { mode: "off", summary: null, pairing: null, busy: false, error: null },
      assurance: "web",
      marker: null,
      ai: "ready",
      graceWarning: null,
      stillsSent: 0,
      screenShared: false,
      actions: null,
    }),
  };
});

import { InterviewLobby } from "@/components/dashboard/interviews/room/InterviewLobby";
import { IntegrityEngine } from "@/lib/integrity/engine";

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("InterviewLobby mandatory photo verification", () => {
  it("blocks starting the interview until the user clicks Take Verification Photo and captures a photo", async () => {
    const onConsent = vi.fn();
    const previewRef = createRef<HTMLVideoElement>();

    render(
      <div>
        <video ref={previewRef} />
        <InterviewLobby
          sessionLabel="Vault AI Interview"
          candidateName="Asha Rao"
          previewVideoRef={previewRef}
          cameraStream={null}
          devicePreviewReady={true}
          onEnableDevices={vi.fn()}
          onConsent={onConsent}
          starting={false}
          blocked={false}
          startLabel="Start Proctored Interview"
          consentError={null}
          rules={[]}
          disclosure={null}
          footer="By continuing you consent."
        />
      </div>
    );

    const startBlockedBtn = screen.getByRole("button", { name: /^Take verification photo to start$/ }) as HTMLButtonElement;
    expect(startBlockedBtn.disabled).toBe(true);
    expect(onConsent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^Take Verification Photo$/ }));

    const startReadyBtn = (await screen.findByRole("button", { name: /Start Proctored Interview/i })) as HTMLButtonElement;
    expect(startReadyBtn.disabled).toBe(false);

    fireEvent.click(startReadyBtn);
    await waitFor(() => expect(onConsent).toHaveBeenCalledWith("data:image/jpeg;base64,fake-photo", [0.1, 0.2, 0.3]));
  });
});

describe("IntegrityEngine face_away 5-second grace timer", () => {
  it("allows 5 seconds of looking away instead of locking at 2–3 seconds", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));

    const engine = new IntegrityEngine({
      surface: "interview",
      basePath: "/interviews/test-slug",
      keepKey: "test",
      userKey: "1",
      activityLabel: "interview",
      handlers: {
        phase: vi.fn(),
        session: vi.fn(),
        violation: vi.fn(),
        consentError: vi.fn(),
        camera: vi.fn(),
        previewReady: vi.fn(),
      },
    });

    const eng = engine as unknown as {
      phase: string;
      ended: boolean;
      lockNow: ReturnType<typeof vi.fn>;
      emit: ReturnType<typeof vi.fn>;
      still: ReturnType<typeof vi.fn>;
      evaluateGraceGuard: (analysis: { faces: number; yaw: number | null; pitch: number | null }, sim: number | null) => void;
    };
    eng.phase = "active";
    eng.ended = false;
    eng.lockNow = vi.fn();
    eng.emit = vi.fn();
    eng.still = vi.fn(() => Promise.resolve());

    // First away frame starts 5-second countdown
    eng.evaluateGraceGuard({ faces: 1, yaw: 0.35, pitch: 0 }, 1.0);
    expect(eng.lockNow).not.toHaveBeenCalled();

    // At 3 seconds elapsed (previously locked here!) it must still NOT lock
    vi.advanceTimersByTime(3000);
    eng.evaluateGraceGuard({ faces: 1, yaw: 0.35, pitch: 0 }, 1.0);
    expect(eng.lockNow).not.toHaveBeenCalled();

    // At 5 seconds elapsed it now locks with the 5-second message
    vi.advanceTimersByTime(2000);
    eng.evaluateGraceGuard({ faces: 1, yaw: 0.35, pitch: 0 }, 1.0);
    expect(eng.lockNow).toHaveBeenCalledTimes(1);
    expect(eng.lockNow.mock.calls[0][0]).toContain("5 seconds");
  });

  it("waits to enter the consent phase until policy is loaded so the proctoring lobby does not flash small-then-full", async () => {
    const phases: string[] = [];
    const engine = new IntegrityEngine({
      surface: "interview",
      basePath: "/interviews/test-slug",
      keepKey: "test",
      userKey: "1",
      activityLabel: "interview",
      handlers: {
        phase: (p) => phases.push(p),
        session: vi.fn(),
        violation: vi.fn(),
        consentError: vi.fn(),
        camera: vi.fn(),
        previewReady: vi.fn(),
      },
    });

    const eng = engine as unknown as {
      loadPolicy: () => Promise<void>;
      buildChecks: () => void;
      watchPreStart: () => void;
      policy: unknown;
      mode: string;
    };

    let policyResolvedBeforeConsent = false;
    eng.loadPolicy = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      eng.mode = "integrity";
      policyResolvedBeforeConsent = !phases.includes("consent");
    });
    eng.buildChecks = vi.fn();
    eng.watchPreStart = vi.fn();

    await engine.init();

    expect(policyResolvedBeforeConsent).toBe(true);
    expect(phases).toEqual(["consent"]);
  });
});
