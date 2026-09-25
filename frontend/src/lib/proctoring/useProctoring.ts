"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { NullRecordingSink, type RecordingSink } from "./recordingSink";
import type { DeviceInfo, ProctoringPhase, ProctoringSessionState, ViolationType } from "./types";

const CHUNK_INTERVAL_MS = 20_000;
/** Same-type violations within this window are treated as one event, not counted twice — a flaky OS fullscreen transition can fire fullscreenchange twice in a row for one real exit. */
const DEDUPE_WINDOW_MS = 1500;
/** window.outerWidth/Height vs innerWidth/Height gap beyond this suggests a docked devtools panel — a standard, best-effort heuristic (not foolproof, but zero-cost and used broadly by real proctoring products). */
const DEVTOOLS_SIZE_THRESHOLD_PX = 160;
const DEVTOOLS_CHECK_INTERVAL_MS = 1000;

interface UseProctoringOptions {
  /** e.g. `/contests/weekly-12/problems/45` — the same basePath the page already uses for run/submit. */
  basePath: string;
  /** Only starts once true (the problem has actually finished loading) — never on practice pages, which don't call this hook at all. */
  enabled: boolean;
  /** Always reads the LATEST code/language at violation time, never a stale closure — see the ref pattern below. */
  getCurrentCode: () => { code: string; language: string };
}

interface UseProctoringResult {
  phase: ProctoringPhase;
  session: ProctoringSessionState | null;
  /** Set once per violation (cleared after the toast auto-dismisses) — drives the warning toast in ProctoringOverlay. */
  lastViolation: { type: ViolationType; count: number; max: number } | null;
  consentError: string | null;
  /** Only ever used by ProctoringConsentGate's pre-start self-check preview — nothing during the active exam renders a video element anymore. */
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  /** True once the student has granted camera/mic access and can see their own live preview. */
  devicePreviewReady: boolean;
  /** Step 1: requests camera/mic and shows the live self-check preview — does not start the timed/fullscreen session. */
  enableDevicePreview: () => Promise<void>;
  /** Step 2: the actual commit — reuses the stream from enableDevicePreview if already granted, else acquires it fresh. */
  grantConsentAndStart: () => Promise<void>;
  resumeFullscreen: () => void;
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
 * Fullscreen enforcement, tab-switch/devtools detection, paste blocking, and
 * client-side webcam/mic recording (never uploaded — see recordingSink.ts)
 * for ONE contest problem page. The server is the actual authority on
 * lockout (see ProctoringService on the backend); this hook's job is to
 * detect events fast, show clear warnings, and stay in sync with whatever
 * the server says the real violation count is — never to enforce the
 * 3-strike rule itself, since a modified client could otherwise just not
 * call this at all.
 */
export function useProctoring({ basePath, enabled, getCurrentCode }: UseProctoringOptions): UseProctoringResult {
  const [phase, setPhase] = useState<ProctoringPhase>("idle");
  const [session, setSession] = useState<ProctoringSessionState | null>(null);
  const [lastViolation, setLastViolation] = useState<{ type: ViolationType; count: number; max: number } | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [devicePreviewReady, setDevicePreviewReady] = useState(false);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sinkRef = useRef<RecordingSink>(new NullRecordingSink());
  const chunkIndexRef = useRef(0);
  const lastReportedAtRef = useRef<Record<string, number>>({});
  const phaseRef = useRef<ProctoringPhase>("idle");
  const lockedRef = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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
    if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
    sinkRef.current.onSessionEnd();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const reportViolation = useCallback(
    async (type: ViolationType, meta: Record<string, unknown> = {}) => {
      if (lockedRef.current) return;

      const now = Date.now();
      const lastAt = lastReportedAtRef.current[type] ?? 0;
      if (now - lastAt < DEDUPE_WINDOW_MS) return;
      lastReportedAtRef.current[type] = now;

      const { code, language } = getCurrentCode();

      try {
        const res = await api.post<{ session: ProctoringSessionState; locked: boolean }>(`${basePath}/proctoring/violations`, {
          type,
          meta,
          current_code: code || undefined,
          language: language || undefined,
        });

        setSession(res.session);
        setLastViolation({ type, count: res.session.violation_count, max: res.session.max_violations });

        if (res.locked) {
          lockedRef.current = true;
          teardownMedia();
          setPhase("locked");
        } else if (type === "fullscreen_exit" && !document.fullscreenElement) {
          setPhase("fullscreen_lost");
        }
      } catch {
        // A dropped violation report is not something to retry-storm over —
        // the server independently re-derives lock state from whatever DOES
        // land, and the very next run/submit call re-checks it regardless.
      }
    },
    [basePath, getCurrentCode, teardownMedia]
  );

  const checkCapabilities = useCallback((): boolean => {
    if (!navigator.mediaDevices?.getUserMedia || !document.documentElement.requestFullscreen) {
      setConsentError("Your browser doesn't support the camera/fullscreen features required for a proctored contest. Please use a recent version of Chrome, Firefox, or Edge on desktop.");
      setPhase("blocked");
      return false;
    }
    return true;
  }, []);

  // Step 1 of consent: grants camera/mic and shows the student their own
  // live preview so they can check positioning/lighting BEFORE the timed,
  // fullscreen attempt begins — the stream acquired here is the same one
  // grantConsentAndStart later reuses, so there's only ever one permission
  // prompt and no stream re-negotiation.
  const enableDevicePreview = useCallback(async () => {
    setConsentError(null);
    if (!checkCapabilities()) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      setConsentError("Camera and microphone access is required to take a proctored contest. Please allow access in your browser and try again.");
      setPhase("blocked");
      return;
    }

    streamRef.current = stream;
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = stream;
      previewVideoRef.current.play().catch(() => {});
    }
    setDevicePreviewReady(true);
  }, [checkCapabilities]);

  const grantConsentAndStart = useCallback(async () => {
    setConsentError(null);
    setPhase("starting");

    // The expected path: enableDevicePreview already acquired this. The
    // fresh-acquire fallback only matters if this were somehow reachable
    // without the preview step ever running.
    let stream = streamRef.current;
    if (!stream) {
      if (!checkCapabilities()) return;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setConsentError("Camera and microphone access is required to take a proctored contest. Please allow access in your browser and try again.");
        setPhase("blocked");
        return;
      }
      streamRef.current = stream;
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
      // Recording itself is best-effort — a browser without MediaRecorder
      // support still gets the (more important) live monitoring/enforcement
      // below, just without the local preview buffer.
    }

    try {
      const res = await api.post<{ session: ProctoringSessionState }>(`${basePath}/proctoring/start`, {
        device_info: buildDeviceInfo(),
      });
      setSession(res.session);

      if (res.session.status === "locked") {
        lockedRef.current = true;
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
      // Fullscreen requires a user gesture in most browsers — grantConsentAndStart
      // is itself always called from a click handler, so this should succeed;
      // if it doesn't, the fullscreen_lost prompt's "Resume" button (also a
      // click handler) is the recovery path.
    }

    setPhase("active");
  }, [basePath, teardownMedia, checkCapabilities]);

  const resumeFullscreen = useCallback(() => {
    document.documentElement
      .requestFullscreen()
      .then(() => setPhase("active"))
      .catch(() => {});
  }, []);

  // Event listeners — only registered while actually active, so nothing
  // fires during the consent screen or after lock/teardown.
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
      // sendBeacon can't carry an Authorization header, so this uses a
      // keepalive fetch instead (see api.ts's `init` passthrough) — best
      // effort only; if the tab is force-killed rather than navigated, this
      // never fires, same limitation every browser-based proctoring tool has.
      const { code, language } = getCurrentCode();
      api
        .post(
          `${basePath}/proctoring/violations`,
          { type: "tab_close_attempt", current_code: code || undefined, language: language || undefined },
          { keepalive: true }
        )
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
  }, [phase, reportViolation, basePath, getCurrentCode]);

  // Full teardown when the page itself unmounts (navigating away normally).
  useEffect(() => teardownMedia, [teardownMedia]);

  return {
    phase,
    session,
    lastViolation,
    consentError,
    previewVideoRef,
    devicePreviewReady,
    enableDevicePreview,
    grantConsentAndStart,
    resumeFullscreen,
  };
}
