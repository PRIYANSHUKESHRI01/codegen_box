"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import type { ProctoringPhase, ProctoringSessionState, ViolationType } from "@/lib/proctoring/types";
import { IntegrityEngine } from "./engine";
import type { IntegritySurface } from "./types";

export interface UseIntegrityEngineOptions {
  surface: IntegritySurface;
  /** The surface's own proctoring base path, e.g. `/contests/weekly-12/problems/45` or `/me/sittings/41`. */
  basePath: string;
  /** Streams for this key are carried over to the next page of the same attempt group (see keeper.ts). */
  keepKey: string;
  activityLabel: string;
  /** Only starts once true (the attempt has actually loaded). */
  enabled: boolean;
  getContext?: (withCode: boolean) => Record<string, unknown> | null;
}

export interface UseIntegrityEngineResult {
  phase: ProctoringPhase;
  session: ProctoringSessionState | null;
  lastViolation: { type: ViolationType; count: number; max: number } | null;
  consentError: string | null;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  devicePreviewReady: boolean;
  /** The live camera + microphone, as state so a tile mounted after the consent gate (the interview's self-view) can show it. */
  cameraStream: MediaStream | null;
  enableDevicePreview: () => Promise<void>;
  grantConsentAndStart: () => Promise<void>;
  resumeFullscreen: () => void;
  /** Call the instant the attempt is finished: stops the camera, screen share and fullscreen and closes the integrity log. */
  endSession: () => void;
  shareScreen: () => Promise<void>;
  connectGuardian: () => Promise<void>;
  resolveHold: () => Promise<void>;
}

/**
 * The one React binding for the integrity engine. `useProctoring` (contests) and `useInterviewProctoring` (everything
 * else) are thin wrappers over it, so all five proctored pages keep the hook contract they were written against and gain
 * the whole layer — checklist, telemetry, evidence, holds — without changing.
 */
export function useIntegrityEngine({ surface, basePath, keepKey, activityLabel, enabled, getContext }: UseIntegrityEngineOptions): UseIntegrityEngineResult {
  const { user } = useAuth();
  const userKey = String(user?.id ?? "anonymous");

  const [phase, setPhase] = useState<ProctoringPhase>("idle");
  const [session, setSession] = useState<ProctoringSessionState | null>(null);
  const [lastViolation, setLastViolation] = useState<{ type: ViolationType; count: number; max: number } | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [devicePreviewReady, setDevicePreviewReady] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // The engine reads the latest context through a ref, so it never needs to be rebuilt when the code changes.
  const contextRef = useRef(getContext);
  useEffect(() => {
    contextRef.current = getContext;
  }, [getContext]);

  const engine = useMemo(
    () =>
      new IntegrityEngine({
        surface,
        basePath,
        keepKey,
        userKey,
        activityLabel,
        getContext: (withCode) => contextRef.current?.(withCode) ?? null,
        handlers: {
          phase: setPhase,
          session: setSession,
          violation: setLastViolation,
          consentError: setConsentError,
          camera: setCameraStream,
          previewReady: setDevicePreviewReady,
        },
      }),
    // A new attempt (different base path / user) is a new engine.
    [surface, basePath, keepKey, userKey, activityLabel]
  );

  useEffect(() => {
    if (!enabled) return;
    void engine.init();

    // In-app navigation (contest problem 1 → 2) hands the live streams to the next page; anything else releases them.
    return () => engine.destroy({ keep: true });
  }, [engine, enabled]);

  // The consent screen's self-check preview. The video element appears and disappears with the gate, so attach on every change.
  useEffect(() => {
    const el = previewVideoRef.current;
    if (!el) return;
    if (el.srcObject !== cameraStream) el.srcObject = cameraStream;
    if (cameraStream) void el.play().catch(() => undefined);
  }, [cameraStream, devicePreviewReady, phase]);

  const enableDevicePreview = useCallback(() => engine.enableDevicePreview(), [engine]);
  const grantConsentAndStart = useCallback(() => engine.grantConsentAndStart(), [engine]);
  const resumeFullscreen = useCallback(() => engine.resumeFullscreen(), [engine]);
  const endSession = useCallback(() => engine.end(), [engine]);
  const shareScreen = useCallback(() => engine.shareScreen(), [engine]);
  const connectGuardian = useCallback(() => engine.connectGuardian(), [engine]);
  const resolveHold = useCallback(() => engine.resolveHold(), [engine]);

  return {
    phase,
    session,
    lastViolation,
    consentError,
    previewVideoRef,
    devicePreviewReady,
    cameraStream,
    enableDevicePreview,
    grantConsentAndStart,
    resumeFullscreen,
    endSession,
    shareScreen,
    connectGuardian,
    resolveHold,
  };
}

/** Which surface a proctoring base path belongs to — the wrappers use it so their callers never have to say. */
export function surfaceFromBasePath(basePath: string): IntegritySurface {
  if (basePath.startsWith("/contests/")) return "contest";
  if (basePath.startsWith("/soft-skills/")) return "soft_skill";
  if (basePath.startsWith("/core/")) return "core_test";
  if (basePath.startsWith("/me/sittings/")) return "study";

  return "interview";
}
