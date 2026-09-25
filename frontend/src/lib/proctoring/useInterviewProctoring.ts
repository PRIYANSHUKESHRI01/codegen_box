"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { NullRecordingSink, type RecordingSink } from "./recordingSink";
import type { DeviceInfo, ProctoringPhase, ProctoringSessionState, ViolationType } from "./types";

const CHUNK_INTERVAL_MS = 20_000;
const DEDUPE_WINDOW_MS = 1500;
const DEVTOOLS_SIZE_THRESHOLD_PX = 160;
const DEVTOOLS_CHECK_INTERVAL_MS = 1000;

interface UseInterviewProctoringOptions {
  /** e.g. `/interviews/backend-engineer-ai-interview` — the same basePath the session page uses for start/answer. */
  basePath: string;
  /** Only starts once true (the interview session has actually been fetched/started). */
  enabled: boolean;
}

interface UseInterviewProctoringResult {
  phase: ProctoringPhase;
  session: ProctoringSessionState | null;
  lastViolation: { type: ViolationType; count: number; max: number } | null;
  consentError: string | null;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  devicePreviewReady: boolean;
  /**
   * The live camera+mic MediaStream, exposed as state (not just a ref) so a
   * component mounted AFTER the consent gate — the always-on camera tile
   * during the active interview — can attach it to its own <video> element.
   * Unlike contest proctoring (which never shows the camera once active by
   * design), an interview keeps the candidate's self-view visible the whole
   * time, so this needs to outlive the consent gate itself.
   */
  cameraStream: MediaStream | null;
  enableDevicePreview: () => Promise<void>;
  grantConsentAndStart: () => Promise<void>;
  resumeFullscreen: () => void;
  /** Call the instant the candidate finishes their last question — stops the camera/mic tracks and exits fullscreen immediately rather than leaving both running until the page happens to unmount. */
  endSession: () => void;
}

function buildDeviceInfo(): DeviceInfo {
  return {
    user_agent: navigator.userAgent,
    platform: navigator.platform,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Fullscreen enforcement, tab-switch/devtools detection, and client-side
 * webcam/mic recording (never uploaded — see recordingSink.ts) for an AI
 * interview attempt. Structurally mirrors useProctoring.ts (contest
 * proctoring) exactly, minus anything code-submission-specific — a voice
 * interview has no "current code" to auto-submit on lock (see
 * InterviewProctoringService's docblock on the backend for why locking here
 * only ever stops further interaction, never fabricates an answer). The
 * server is still the actual authority on lockout; this hook only detects
 * events fast and stays in sync with whatever the server says the real
 * violation count is.
 */
export function useInterviewProctoring({ basePath, enabled }: UseInterviewProctoringOptions): UseInterviewProctoringResult {
  const [phase, setPhase] = useState<ProctoringPhase>("idle");
  const [session, setSession] = useState<ProctoringSessionState | null>(null);
  const [lastViolation, setLastViolation] = useState<{ type: ViolationType; count: number; max: number } | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [devicePreviewReady, setDevicePreviewReady] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sinkRef = useRef<RecordingSink>(new NullRecordingSink());
  const chunkIndexRef = useRef(0);
  const lastReportedAtRef = useRef<Record<string, number>>({});
  /** True once the session is over for ANY reason (locked out or finished normally) — reportViolation checks this so a deliberate exitFullscreen()/track-stop during teardown never gets misreported as a violation. */
  const sessionEndedRef = useRef(false);

  useEffect(() => {
    if (enabled && phase === "idle") setPhase("consent");
  }, [enabled, phase]);

  const teardownMedia = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraStream(null);
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    sinkRef.current.onSessionEnd();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const reportViolation = useCallback(
    async (type: ViolationType, meta: Record<string, unknown> = {}) => {
      if (sessionEndedRef.current) return;

      const now = Date.now();
      const lastAt = lastReportedAtRef.current[type] ?? 0;
      if (now - lastAt < DEDUPE_WINDOW_MS) return;
      lastReportedAtRef.current[type] = now;

      try {
        const res = await api.post<{ session: ProctoringSessionState; locked: boolean }>(`${basePath}/proctoring/violations`, {
          type,
          meta,
        });

        setSession(res.session);
        setLastViolation({ type, count: res.session.violation_count, max: res.session.max_violations });

        if (res.locked) {
          sessionEndedRef.current = true;
          teardownMedia();
          setPhase("locked");
        } else if (type === "fullscreen_exit" && !document.fullscreenElement) {
          setPhase("fullscreen_lost");
        }
      } catch {
        // A dropped violation report isn't worth retry-storming over — the
        // server independently re-derives lock state from whatever DOES
        // land, and the very next start/answer call re-checks it regardless.
      }
    },
    [basePath, teardownMedia]
  );

  const checkCapabilities = useCallback((): boolean => {
    if (!navigator.mediaDevices?.getUserMedia || !document.documentElement.requestFullscreen) {
      setConsentError("Your browser doesn't support the camera/fullscreen features required for a proctored interview. Please use a recent version of Chrome, Firefox, or Edge on desktop.");
      setPhase("blocked");
      return false;
    }
    return true;
  }, []);

  const enableDevicePreview = useCallback(async () => {
    setConsentError(null);
    if (!checkCapabilities()) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      setConsentError("Camera and microphone access is required to take a proctored interview. Please allow access in your browser and try again.");
      setPhase("blocked");
      return;
    }

    streamRef.current = stream;
    setCameraStream(stream);
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = stream;
      previewVideoRef.current.play().catch(() => {});
    }
    setDevicePreviewReady(true);
  }, [checkCapabilities]);

  const grantConsentAndStart = useCallback(async () => {
    setConsentError(null);
    setPhase("starting");

    let stream = streamRef.current;
    if (!stream) {
      if (!checkCapabilities()) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setConsentError("Camera and microphone access is required to take a proctored interview. Please allow access in your browser and try again.");
        setPhase("blocked");
        return;
      }
      streamRef.current = stream;
      setCameraStream(stream);
    }

    try {
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          sinkRef.current.onChunk(e.data, { index: chunkIndexRef.current++, mimeType: recorder.mimeType, recordedAt: Date.now() });
        }
      };
      recorder.start(CHUNK_INTERVAL_MS);
      recorderRef.current = recorder;
    } catch {
      // Best-effort — a browser without MediaRecorder support still gets
      // the more important live monitoring/enforcement below.
    }

    try {
      const res = await api.post<{ session: ProctoringSessionState }>(`${basePath}/proctoring/start`, {
        device_info: buildDeviceInfo(),
      });
      setSession(res.session);

      if (res.session.status === "locked") {
        sessionEndedRef.current = true;
        teardownMedia();
        setPhase("locked");
        return;
      }
    } catch (err) {
      setConsentError(err instanceof ApiError ? err.message : "Couldn't start the proctoring session. Please try again.");
      teardownMedia();
      setPhase("blocked");
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen requires a user gesture — this is always called from a
      // click handler, so this should succeed; if not, the fullscreen_lost
      // prompt's "Resume" button (also a click handler) is the recovery path.
    }

    setPhase("active");
  }, [basePath, teardownMedia, checkCapabilities]);

  const resumeFullscreen = useCallback(() => {
    document.documentElement
      .requestFullscreen()
      .then(() => setPhase("active"))
      .catch(() => {});
  }, []);

  const endSession = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    teardownMedia();
    setPhase("completed");
  }, [teardownMedia]);

  useEffect(() => {
    if (phase !== "active" && phase !== "fullscreen_lost") return;

    const onVisibilityChange = () => {
      if (document.hidden) reportViolation("tab_switch");
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) reportViolation("fullscreen_exit");
    };
    const onBlur = () => reportViolation("window_blur", {});
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      reportViolation("paste_attempt");
    };
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation("context_menu_blocked");
    };
    const onBeforeUnload = () => {
      api
        .post(`${basePath}/proctoring/violations`, { type: "tab_close_attempt" }, { keepalive: true })
        .catch(() => {});
    };

    let lastDevtoolsState = false;
    const devtoolsInterval = window.setInterval(() => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      const suspected = widthGap > DEVTOOLS_SIZE_THRESHOLD_PX || heightGap > DEVTOOLS_SIZE_THRESHOLD_PX;
      if (suspected && !lastDevtoolsState) {
        reportViolation("devtools_detected");
      }
      lastDevtoolsState = suspected;
    }, DEVTOOLS_CHECK_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearInterval(devtoolsInterval);
    };
  }, [phase, reportViolation, basePath]);

  useEffect(() => teardownMedia, [teardownMedia]);

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
  };
}
