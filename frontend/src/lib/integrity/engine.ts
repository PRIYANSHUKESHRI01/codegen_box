"use client";

import { api, ApiError } from "@/lib/api";
import { forgetEditorClipboard } from "@/lib/proctoring/editorClipboardGuard";
import type { DeviceInfo, ProctoringPhase, ProctoringSessionState, ViolationType } from "@/lib/proctoring/types";
import { AttentionRules } from "./detectors/attention";
import { CameraHealth, sampleFrame } from "./detectors/cameraHealth";
import { installDevtoolsDetector } from "./detectors/devtools";
import { installDisplayDetector, isExtendedDesktop, monitorCount } from "./detectors/display";
import { installFocusDetector } from "./detectors/focus";
import { installInputDetector } from "./detectors/input";
import {
  attachHiddenVideo,
  detachHiddenVideo,
  isStreamLive,
  MediaError,
  openCameraAndMic,
  stopStream,
  thumbnail,
  watchStream,
  type CameraHandle,
} from "./detectors/media";
import { installConnectivityDetector, startNetworkProbe, type NetView } from "./detectors/network";
import { isChromium, requestEntireScreen, ShareError, supportsScreenShare, type ShareResult } from "./detectors/screenShare";
import { levelDb, SpeechGate } from "./detectors/speech";
import { loadVision, type Delegate, type VisionEngine } from "./detectors/vision";
import { captureStill, EvidenceUploader, jitteredMs } from "./evidence";
import { browserFamily, deviceFingerprint, newInstanceId } from "./fingerprint";
import { claim, discard, park } from "./keeper";
import { findAutomation, findExtensionInjection, findTamper } from "./pristine";
import { checksPass, getIntegrityUi, resetIntegrityUi, setCheck, setIntegrityUi } from "./store";
import { canRunGuardian, isMac } from "./platform";
import { IntegrityTransport } from "./transport";
import type {
  BatchAck,
  GuardianSummary,
  Hold,
  IntegrityBootstrap,
  IntegrityPolicy,
  IntegritySurface,
  PreflightCheck,
  WebEventType,
} from "./types";

/** What the original (pre-integrity) proctoring understood; used when the server has the layer switched off. */
const LEGACY_TYPES: ReadonlySet<string> = new Set(["fullscreen_exit", "tab_switch", "devtools_detected", "paste_attempt", "window_blur", "context_menu_blocked", "tab_close_attempt"]);

/** macOS refuses a browser the right to capture the screen until it is switched on in System Settings (and the browser restarted). */
const MAC_SCREEN_RECORDING_FIX =
  "On a Mac: open System Settings → Privacy & Security → Screen & System Audio Recording, switch on Google Chrome (or Edge), quit the browser completely (⌘Q), reopen it, then press Share screen again.";

/** Used only if the policy request itself cannot be answered; the start call returns the real one. */
const FALLBACK_POLICY: IntegrityPolicy = {
  profile: "standard", beat_interval: 12, stale_after: 50, webcam_snapshot: 45, screen_snapshot: 0, screen_share: "optional", camera: "required",
  guardian: "optional", chromium_only: false, block_multi_monitor: true, focus_loss_strike: 4, ai: true, clipboard: "block_all", stun_servers: [],
  retention_days: 45, flagged_retention_days: 365,
};

export interface EngineHandlers {
  phase(p: ProctoringPhase): void;
  session(s: ProctoringSessionState): void;
  violation(v: { type: ViolationType; count: number; max: number }): void;
  consentError(message: string | null): void;
  camera(stream: MediaStream | null): void;
  previewReady(ready: boolean): void;
}

export interface EngineOptions {
  surface: IntegritySurface;
  /** `${basePath}/proctoring/start` is the surface's own consent endpoint. */
  basePath: string;
  /** Resources for this key survive an in-app page change (see keeper.ts). */
  keepKey: string;
  /** Who is signed in — nothing is ever handed to a different user. */
  userKey: string;
  /** "contest", "test", "interview", "practice sitting" — used in error messages. */
  activityLabel: string;
  /** The contest problem and (with a strike) the code open at that moment. */
  getContext?: (withCode: boolean) => Record<string, unknown> | null;
  handlers: EngineHandlers;
}

interface StartResponse {
  session: ProctoringSessionState;
  integrity?: IntegrityBootstrap | null;
}

const STILL_MIN_GAP_MS = 5000;

/**
 * Everything the browser does for one proctored attempt, behind one object so the five proctored pages share it:
 * the pre-start checklist, the start call, the detectors, the telemetry channel, the evidence stills, the camera
 * analysis, and the blocking "hold" layers. React sees it only through `useIntegrityEngine`.
 *
 * It never decides anything final. It reports; the server counts, gates and locks. The one thing it must do right on
 * its own is to be hard to switch off without the server noticing — silence is a finding, and a patched page is
 * cross-checked against the Guardian and the evidence stills.
 */
export class IntegrityEngine {
  private policy: IntegrityPolicy = FALLBACK_POLICY;
  private policyKnown = false;
  private mode: "unknown" | "integrity" | "legacy" = "unknown";
  private phase: ProctoringPhase = "idle";
  private session: ProctoringSessionState | null = null;
  private boot: IntegrityBootstrap | null = null;

  private camera: CameraHandle | null = null;
  private cameraVideo: HTMLVideoElement | null = null;
  private screen: ShareResult | null = null;
  private screenVideo: HTMLVideoElement | null = null;

  private instance = newInstanceId();
  private ids: { did: string; fp: string } | null = null;
  private net: NetView | null = null;

  private transport: IntegrityTransport | null = null;
  private uploader: EvidenceUploader | null = null;
  private vision: VisionEngine | null = null;

  private cleanups: Array<() => void> = [];
  private timers = new Set<number>();
  private lost = { camera: false, screen: false, superseded: false, signal: false, guardian: false };
  private everHadGuardian = false;
  private lastFlaggedStillAt = 0;
  private legacyLast: Record<string, number> = {};
  private originalTitle: string | null = null;
  private titleObserver: MutationObserver | null = null;
  private reportedTamper = new Set<string>();
  private reportedExtensions = new Set<string>();
  private attached = false;
  private ended = false;
  private starting = false;
  private guardianPollFailures = 0;
  /** Bumped by every init/destroy so an init that is still awaiting the network cannot wire anything up after the page left. */
  private gen = 0;

  constructor(private readonly o: EngineOptions) {}

  // ═══ lifecycle ══════════════════════════════════════════════════════════════════════════════════════════════════════

  /** Starts the consent flow: policy, passive checks, and (when the attempt's streams were carried over) an automatic resume. */
  async init(): Promise<void> {
    if (this.attached) return;
    this.attached = true;
    this.ended = false;
    const gen = ++this.gen;
    setIntegrityUi({
      attached: true,
      actions: { shareScreen: () => void this.shareScreen(), connectGuardian: () => void this.connectGuardian(), resolveHold: () => void this.resolveHold() },
    });
    this.setPhase("consent");

    const kept = claim(this.o.keepKey, this.o.userKey);
    if (kept) {
      this.instance = kept.instance;
      this.ids = kept.deviceId;
      if (isStreamLive(kept.camera)) this.adoptCamera(kept.camera as MediaStream);
      if (isStreamLive(kept.screen)) this.adoptScreen(kept.screen as MediaStream);
    }

    await this.loadPolicy();
    if (gen !== this.gen) return;
    this.buildChecks();
    this.watchPreStart();

    // The camera and screen survived the page change and the browser is still fullscreen: go straight back in.
    if (kept && this.camera && document.fullscreenElement && checksPass(getIntegrityUi().checks)) {
      void this.begin(true);
    }
  }

  /** The page is going away. In-app navigation parks the streams for the next page; anything else releases them. */
  destroy(opts: { keep: boolean }): void {
    if (!this.attached) return;
    this.attached = false;
    this.gen++;

    const keep = opts.keep && this.phase === "active" && !this.ended;
    const camera = keep ? this.camera?.stream ?? null : null;
    const screen = keep ? this.screen?.stream ?? null : null;

    this.stopWork();

    if (keep) {
      // Detach the streams from this engine's helpers so releasing the engine does not stop them.
      detachHiddenVideo(this.cameraVideo);
      detachHiddenVideo(this.screenVideo);
      this.cameraVideo = null;
      this.screenVideo = null;
      this.camera = null;
      this.screen = null;
      park(this.o.keepKey, {
        userKey: this.o.userKey,
        camera,
        screen,
        instance: this.instance,
        deviceId: this.ids,
        release: () => {
          stopStream(camera);
          stopStream(screen);
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        },
        onUnclaimed: () => {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        },
      });
    } else {
      discard(this.o.keepKey);
      this.releaseMedia();
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    }

    this.restoreTitle();
    forgetEditorClipboard();
    resetIntegrityUi();
  }

  // ═══ consent-gate actions (each needs a click) ══════════════════════════════════════════════════════════════════════

  /** Step 1: camera + microphone (and the self-check preview). */
  async enableDevicePreview(): Promise<void> {
    this.o.handlers.consentError(null);
    if (!this.capable()) return;

    if (this.policy.camera === "off") {
      setCheck(this.check("camera", "ok", "Not needed for this attempt."));
      this.o.handlers.previewReady(true);

      return;
    }

    setCheck({ ...this.check("camera", "working"), detail: "Waiting for your permission…" });
    try {
      const handle = await openCameraAndMic({ video: true, audio: true });
      if (handle.virtual) {
        stopStream(handle.stream);
        setCheck({
          ...this.check("camera", "fail"),
          detail: `"${handle.label}" is a software camera.`,
          fix: "Choose your built-in or USB webcam in the browser's camera menu, close the program that provides the virtual camera, and try again.",
        });
        this.o.handlers.consentError(`"${handle.label}" is a software camera and can't be used for a proctored ${this.o.activityLabel}.`);

        return;
      }
      this.adoptCamera(handle.stream, handle.label);
      if (this.phase === "blocked") this.setPhase("consent");
    } catch (err) {
      const message = err instanceof MediaError ? err.message : `Camera and microphone access is required to take a proctored ${this.o.activityLabel}. Please allow access and try again.`;
      setCheck({ ...this.check("camera", "fail"), detail: message });
      this.o.handlers.consentError(message);
      this.setPhase("blocked");
    }
  }

  /** Step 2 (when required): share the entire screen. */
  async shareScreen(): Promise<void> {
    this.o.handlers.consentError(null);
    setCheck({ ...this.check("screen", "working"), detail: "Choose \"Entire screen\", pick your screen and press Share…" });

    try {
      const share = await requestEntireScreen({ requireVerifiableSurface: this.policy.chromium_only });
      this.adoptScreen(share.stream, share.surface);
    } catch (err) {
      const message = err instanceof ShareError ? err.message : "Couldn't start screen sharing. Please try again.";
      setCheck({ ...this.check("screen", "fail"), detail: message, fix: isMac() && !(err instanceof ShareError && err.kind === "wrong_surface") ? MAC_SCREEN_RECORDING_FIX : undefined });
      this.o.handlers.consentError(message);
    }
  }

  /** Step 3 (when wanted): asks the server for a one-time code and starts watching for the Guardian to connect. */
  async connectGuardian(): Promise<void> {
    const ui = getIntegrityUi();
    setIntegrityUi({ guardian: { ...ui.guardian, busy: true, error: null } });

    try {
      const res = await api.post<{ code: string; expires_at: string; ttl?: number; deep_link: string; download_url: string }>("/integrity/guardian/code");
      // Count the lifetime from when the code ARRIVED, not from the server's wall-clock time: a student PC with a wrong clock would otherwise see a fresh code as already expired.
      const expiresAt = typeof res.ttl === "number" && res.ttl > 0 ? new Date(Date.now() + res.ttl * 1000).toISOString() : res.expires_at;
      setIntegrityUi((s) => ({ guardian: { ...s.guardian, busy: false, pairing: { code: res.code, deepLink: res.deep_link, downloadUrl: res.download_url, expiresAt } } }));
    } catch (err) {
      setIntegrityUi((s) => ({ guardian: { ...s.guardian, busy: false, error: err instanceof ApiError ? err.message : "Couldn't get a pairing code. Please try again." } }));
    }
  }

  /** Final step: consent + start. Fullscreen is requested first, while the click's permission to do so is still fresh. */
  async grantConsentAndStart(): Promise<void> {
    await this.begin(false);
  }

  /** Fullscreen was left; this is the click that goes back. */
  resumeFullscreen(): void {
    document.documentElement
      .requestFullscreen()
      .then(() => {
        if (this.phase === "fullscreen_lost") this.setPhase("active");
      })
      .catch(() => undefined);
  }

  /** The hold layer's button: put back whatever was lost. */
  async resolveHold(): Promise<void> {
    const hold = getIntegrityUi().hold;
    if (!hold) return;

    if (hold.kind === "screen_share") await this.reshare();
    else if (hold.kind === "camera" || hold.kind === "microphone") await this.reopenCamera();
  }

  /** The student finished normally. Stops everything and tells the server so the attempt's integrity log gets its closing entry. */
  end(): void {
    if (this.ended) return;
    this.ended = true;
    const id = this.boot?.id;
    this.stopWork();
    this.releaseMedia();
    discard(this.o.keepKey);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    if (id) void api.post(`/integrity/${id}/end`, { reason: "completed" }, { keepalive: true }).catch(() => undefined);
    this.restoreTitle();
    forgetEditorClipboard();
    resetIntegrityUi();
    this.setPhase("completed");
  }

  // ═══ policy & checklist ═════════════════════════════════════════════════════════════════════════════════════════════

  private async loadPolicy(): Promise<void> {
    for (let attempt = 0; attempt < 3 && !this.policyKnown; attempt++) {
      try {
        const res = await api.get<{ enabled: boolean; policy: IntegrityPolicy | null }>(`/integrity/policy?surface=${this.o.surface}`);
        if (res.enabled && res.policy) {
          this.policy = res.policy;
          this.mode = "integrity";
        } else {
          this.mode = "legacy";
          this.policy = { ...FALLBACK_POLICY, screen_share: "off", guardian: "off", ai: false, block_multi_monitor: false, focus_loss_strike: 0, webcam_snapshot: 0, clipboard: this.o.surface === "contest" ? "editor_only" : "block_all" };
        }
        this.policyKnown = true;
      } catch (err) {
        // An old server without the endpoint behaves like the layer being off; any other failure is retried.
        if (err instanceof ApiError && err.status === 404) {
          this.mode = "legacy";
          this.policy = { ...FALLBACK_POLICY, screen_share: "off", guardian: "off", ai: false, focus_loss_strike: 0, webcam_snapshot: 0, clipboard: this.o.surface === "contest" ? "editor_only" : "block_all" };
          this.policyKnown = true;
        } else {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
    }

    setIntegrityUi({
      policy: this.mode === "integrity" ? this.policy : null,
      guardian: { ...getIntegrityUi().guardian, mode: this.mode === "integrity" ? this.policy.guardian : "off" },
    });
  }

  private check(id: PreflightCheck["id"], status: PreflightCheck["status"], detail?: string): PreflightCheck {
    const labels: Record<PreflightCheck["id"], string> = {
      browser: "Browser", tamper: "Browser is unmodified", automation: "No automation tools", camera: "Camera and microphone", mic: "Microphone", display: "One screen only",
      screen: "Entire screen shared", network: "Network", guardian: "AptRun Guardian",
    };
    const required: Record<PreflightCheck["id"], boolean> = {
      browser: true, tamper: true, automation: true, camera: this.policy.camera === "required", mic: false,
      display: this.policy.block_multi_monitor, screen: this.policy.screen_share === "required", network: false, guardian: this.policy.guardian === "required",
    };

    return { id, label: labels[id], status, required: required[id], detail };
  }

  /** The checks this attempt needs, in the order a student can work through them. */
  private buildChecks(): void {
    const integrity = this.mode === "integrity";

    setCheck(this.browserCheck());
    if (integrity) setCheck(this.tamperCheck());
    setCheck(this.automationCheck());
    setCheck(this.check("camera", this.camera ? "ok" : "pending", this.camera ? this.camera.label || "Camera ready" : undefined));
    if (integrity) setCheck(this.displayCheck());
    if (integrity && this.policy.screen_share !== "off") {
      setCheck(this.check("screen", this.screen ? "ok" : "pending", this.screen ? "Your entire screen is being shared." : undefined));
    }
    if (integrity && this.policy.guardian !== "off") {
      // The Guardian is a Windows program. Where it cannot run, an optional one is simply not part of this attempt (the
      // browser checks still apply in full); a required one cannot be met and says so up front instead of nagging.
      setCheck(
        canRunGuardian()
          ? this.check("guardian", "pending", "Install and open the Guardian on this computer.")
          : this.policy.guardian === "required"
            ? { ...this.check("guardian", "fail", "The Guardian only runs on Windows."), fix: "This attempt needs a Windows computer. Ask your college which computer to use." }
            : this.check("guardian", "skipped", isMac() ? "Not needed on a Mac — the other checks still apply." : "Not available on this device — the other checks still apply.")
      );
    }

    // Drop checks the profile does not use.
    setIntegrityUi((s) => ({
      checks: s.checks.filter((c) => (integrity || ["browser", "automation", "camera"].includes(c.id)) && (c.id !== "screen" || this.policy.screen_share !== "off") && (c.id !== "guardian" || this.policy.guardian !== "off")),
    }));
  }

  private browserCheck(): PreflightCheck {
    const ok = !!navigator.mediaDevices?.getUserMedia && !!document.documentElement.requestFullscreen;
    if (!ok) return { ...this.check("browser", "fail"), detail: "This browser lacks camera or fullscreen support.", fix: "Use a recent Chrome or Edge on a computer." };
    if (this.policy.chromium_only && !isChromium()) {
      return {
        ...this.check("browser", "fail"),
        detail: isMac() ? "Safari can't confirm which screen you share, so this attempt needs Chrome or Edge." : "This attempt needs Chrome or Edge.",
        fix: isMac()
          ? "Install Google Chrome (google.com/chrome), open this page in it and sign in again. Your Mac needs nothing else."
          : "Open this page in Google Chrome or Microsoft Edge on a computer.",
      };
    }

    return { ...this.check("browser", "ok"), detail: browserFamily().includes("Edg") ? "Microsoft Edge" : isChromium() ? "Chrome / Chromium" : "Supported" };
  }

  /**
   * Is the page still talking to the real browser? A privacy or "fake camera" extension, or a focus-spoofing userscript,
   * changes the built-ins the proctor listens through. Found BEFORE the attempt starts it is a thing to switch off, with
   * nothing held against the student; found after, it is a strike. So the student gets to find out here.
   */
  private tamperCheck(): PreflightCheck {
    const found = findTamper();
    const injected = findExtensionInjection();
    if (found.length === 0) {
      return { ...this.check("tamper", "ok"), detail: injected.length ? `${injected.length} browser extension${injected.length === 1 ? "" : "s"} add scripts to pages (allowed, but noted).` : undefined };
    }

    return {
      ...this.check("tamper", "fail"),
      detail: found.slice(0, 2).join("; ") + ".",
      fix: "Turn off browser extensions that change how pages behave (privacy, camera, focus or userscript tools), or open this page in a clean browser profile or a private window.",
    };
  }

  private automationCheck(): PreflightCheck {
    const found = findAutomation();

    return found.length
      ? { ...this.check("automation", "fail"), detail: `Detected: ${found.slice(0, 2).join(", ")}.`, fix: "Close any automation or test tooling and use a normal browser window." }
      : this.check("automation", "ok");
  }

  private displayCheck(): PreflightCheck {
    if (!this.policy.block_multi_monitor) return this.check("display", "skipped");
    if (isExtendedDesktop()) {
      return { ...this.check("display", "fail"), detail: "More than one screen is connected.", fix: "Unplug extra monitors or projectors (or set the display to \"Show only on 1\"), then this check turns green." };
    }

    return { ...this.check("display", monitorCount() === null ? "warn" : "ok"), detail: monitorCount() === null ? "This browser can't confirm the number of screens." : undefined };
  }

  /** While the gate is open: keep the live checks (display, Guardian) current. */
  private watchPreStart(): void {
    if (this.mode !== "integrity") return;

    const tick = async () => {
      if (!this.attached || this.phase === "active" || this.ended) return;
      if (this.policy.block_multi_monitor) setCheck(this.displayCheck());
      setCheck(this.tamperCheck());
      if (this.policy.guardian !== "off" && canRunGuardian()) await this.pollGuardian();
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2500);
    this.cleanups.push(() => window.clearInterval(id));
  }

  private async pollGuardian(): Promise<void> {
    try {
      const res = await api.get<{ guardian: GuardianSummary }>(`/integrity/guardian?surface=${this.o.surface}`);
      const g = res.guardian;
      this.guardianPollFailures = 0;
      setIntegrityUi((s) => ({ guardian: { ...s.guardian, summary: g, error: null, pairing: g.connected ? null : s.guardian.pairing } }));

      if (!g.connected) {
        setCheck({ ...this.check("guardian", "pending", "Not connected yet."), fix: "Open the Guardian on this computer and enter the code." });
      } else if (g.outdated) {
        setCheck({ ...this.check("guardian", "fail", "This Guardian is out of date."), fix: "Download the latest Guardian and open it again." });
      } else if (g.blockers.length > 0) {
        const first = g.blockers[0];
        setCheck({ ...this.check("guardian", "fail", `${first.title}${first.detail ? ` — ${first.detail}` : ""}`), fix: first.fix });
      } else {
        setCheck(this.check("guardian", "ok", `Connected${g.version ? ` (v${g.version})` : ""} — your computer looks clean.`));
      }
    } catch (err) {
      // One dropped poll is normal; two in a row means the student is waiting on something that cannot answer — say so.
      if (++this.guardianPollFailures >= 2) {
        const message = err instanceof ApiError && err.message ? err.message : "Can't reach the server to check the Guardian.";
        setIntegrityUi((s) => ({ guardian: { ...s.guardian, error: `${message} The Guardian cannot connect until this is fixed.` } }));
      }
    }
  }

  // ═══ starting the attempt ═══════════════════════════════════════════════════════════════════════════════════════════

  private async begin(auto: boolean): Promise<void> {
    if (this.starting || this.ended || (this.phase !== "consent" && this.phase !== "blocked")) return;
    if (!this.capable()) return;
    this.starting = true;
    this.o.handlers.consentError(null);
    this.setPhase("starting");

    try {
      if (!this.camera && this.policy.camera === "required") {
        await this.enableDevicePreview();
        if (!this.camera) return this.backToGate();
      }

      // Fullscreen first, while the click's user activation is fresh; a slow network must not cost the student the right to ask.
      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          /* the "resume fullscreen" layer is the recovery path */
        }
      }

      this.ids ??= await deviceFingerprint();

      let res: StartResponse;
      try {
        res = await api.post<StartResponse>(`${this.o.basePath}/proctoring/start`, {
          device_info: this.deviceInfo(),
          ...(this.mode === "legacy"
            ? {}
            : {
                integrity: {
                  instance: this.instance,
                  fp: this.ids.fp,
                  did: this.ids.did,
                  preflight: this.preflightSummary(),
                },
              }),
        });
      } catch (err) {
        this.handleStartError(err);

        return;
      }

      this.session = res.session;
      this.o.handlers.session(res.session);

      if (res.integrity) {
        this.mode = "integrity";
        this.boot = res.integrity;
        this.policy = res.integrity.policy;
        setIntegrityUi({ policy: this.policy, assurance: res.integrity.assurance, marker: res.integrity.marker, guardian: { ...getIntegrityUi().guardian, mode: this.policy.guardian, summary: res.integrity.guardian } });
      } else {
        this.mode = "legacy";
      }

      if (res.session.status === "locked") {
        this.ended = true;
        this.stopWork();
        this.releaseMedia();
        this.setPhase("locked");

        return;
      }

      this.activate();
      this.setPhase(document.fullscreenElement || auto ? "active" : "fullscreen_lost");
    } finally {
      this.starting = false;
    }
  }

  private backToGate(): void {
    this.setPhase("consent");
  }

  private handleStartError(err: unknown): void {
    const api = err instanceof ApiError ? err : null;
    const code = api?.code;
    const message = api?.message ?? `Couldn't start the proctoring session. Please try again.`;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);

    if (code === "guardian_required" || code === "preflight_failed") {
      this.o.handlers.consentError(message);
      void this.pollGuardian();
      this.setPhase("consent");

      return;
    }

    if (code === "network_not_allowed" || code === "session_active_elsewhere") {
      this.o.handlers.consentError(message);
      this.setPhase("blocked");

      return;
    }

    this.o.handlers.consentError(message);
    // Anything else (a 500, a dropped connection) is worth another try with the camera and share still in place.
    this.setPhase("consent");
  }

  /** What the pre-flight looked like, kept in the attempt's log so a reviewer can see what the student passed. */
  private preflightSummary(): Record<string, string> {
    return Object.fromEntries(getIntegrityUi().checks.map((c) => [c.id, c.status]));
  }

  private deviceInfo(): DeviceInfo {
    return {
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  private capable(): boolean {
    if (!navigator.mediaDevices?.getUserMedia || !document.documentElement.requestFullscreen) {
      const message = `Your browser doesn't support the camera/fullscreen features required for a proctored ${this.o.activityLabel}. Please use a recent version of Chrome, Firefox, or Edge on desktop.`;
      this.o.handlers.consentError(message);
      this.setPhase("blocked");

      return false;
    }

    return true;
  }

  // ═══ the live attempt ═══════════════════════════════════════════════════════════════════════════════════════════════

  private activate(): void {
    this.ended = false;
    const integrity = this.mode === "integrity" && this.boot !== null;
    const p = this.policy;
    const emit = (type: WebEventType, data?: Record<string, unknown>) => this.emit(type, data);

    // ── the telemetry channel and the evidence uploader ──
    if (integrity && this.boot) {
      this.uploader = new EvidenceUploader(api, this.boot.id, (n) => setIntegrityUi({ stillsSent: n }));
      this.transport = new IntegrityTransport({
        api,
        id: this.boot.id,
        instance: this.instance,
        nonce: this.boot.nonce,
        nextBatchId: this.boot.next_batch_id,
        beatIntervalMs: p.beat_interval * 1000,
        getState: () => this.pageState(),
        getNet: () => this.net,
        getFingerprint: () => this.ids?.fp ?? null,
        getContext: (withCode) => this.o.getContext?.(withCode) ?? null,
        onAck: (ack) => this.onAck(ack),
        onSuperseded: () => {
          this.lost.superseded = true;
          this.recomputeHold();
        },
        onResync: () => this.resync(),
        onFatal: () => {
          this.lost.signal = true;
          this.recomputeHold();
        },
      });
      this.transport.start();
    }

    // ── detectors common to both modes ──
    this.cleanups.push(
      installFocusDetector(emit, { focusLossStrikeSeconds: integrity ? p.focus_loss_strike : 0, onFullscreenExit: () => this.onFullscreenExit() }),
      installDevtoolsDetector(emit),
      installInputDetector(emit, { clipboard: p.clipboard })
    );

    // Last words on the way out: one keep-alive batch carrying whatever was queued.
    const onPageHide = () => this.transport?.flushOnUnload({ type: "tab_close_attempt", t: Date.now() });
    window.addEventListener("pagehide", onPageHide);
    this.cleanups.push(() => window.removeEventListener("pagehide", onPageHide));

    if (!integrity) return;

    // ── integrity-only detectors ──
    this.cleanups.push(installDisplayDetector(emit, { checkMultiMonitor: p.block_multi_monitor }), installConnectivityDetector(emit), startNetworkProbe(p.stun_servers, (view) => (this.net = view)));

    this.guardTitle(this.boot?.marker ?? "");
    this.every(5000, () => this.checkTamper());
    this.every(30_000, () => this.checkExtensions());
    this.every(1000, () => this.watchdog());
    this.checkTamper();
    const automation = findAutomation();
    if (automation.length) emit("automation_detected", { signals: automation.slice(0, 4) });

    // ── media: health, stills, analysis ──
    if (this.camera) this.watchCamera();
    if (this.screen) this.watchScreen();
    this.startStills();
    void this.startVision();
    this.startSpeech();
  }

  private emit(type: WebEventType, data?: Record<string, unknown>): void {
    if (this.ended) return;

    if (this.mode === "integrity") {
      this.transport?.emit(type, data);
    } else if (LEGACY_TYPES.has(type)) {
      void this.legacyReport(type);
    }

    // The student sees a blocked paste at once; strikes are shown when the server confirms them.
    if (type === "paste_attempt") {
      this.o.handlers.violation({ type, count: this.session?.violation_count ?? 0, max: this.session?.max_violations ?? 3 });
    }
  }

  private onAck(ack: BatchAck): void {
    this.session = ack.session;
    this.o.handlers.session(ack.session);

    for (const s of ack.strikes) {
      this.o.handlers.violation({ type: s.type, count: s.count, max: ack.session.max_violations });
    }

    if (ack.guardian) {
      this.everHadGuardian = this.everHadGuardian || ack.guardian.connected;
      this.lost.guardian = this.everHadGuardian && !ack.guardian.fresh && this.policy.guardian === "required";
    }

    if (ack.locked || ack.session.status === "locked") {
      this.lockNow();

      return;
    }

    this.recomputeHold();
  }

  private lockNow(): void {
    if (this.ended) return;
    this.ended = true;
    this.stopWork();
    this.releaseMedia();
    discard(this.o.keepKey);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    this.restoreTitle();
    forgetEditorClipboard();
    this.setPhase("locked");
  }

  private onFullscreenExit(): void {
    if (this.phase === "active") this.setPhase("fullscreen_lost");
  }

  /** The nonce chain broke: asking the server to start again (idempotent) hands back fresh credentials. */
  private async resync(): Promise<{ nonce: string; next_batch_id: number } | null> {
    try {
      const res = await api.post<StartResponse>(`${this.o.basePath}/proctoring/start`, {
        device_info: this.deviceInfo(),
        integrity: { instance: this.instance, fp: this.ids?.fp, did: this.ids?.did },
      });
      if (res.integrity) return { nonce: res.integrity.nonce, next_batch_id: res.integrity.next_batch_id };
    } catch (err) {
      if (err instanceof ApiError && err.code === "session_active_elsewhere") {
        this.lost.superseded = true;
        this.recomputeHold();
      }
    }

    return null;
  }

  // ── legacy reporting (server has the integrity layer off) ──

  private async legacyReport(type: WebEventType): Promise<void> {
    const now = Date.now();
    if (now - (this.legacyLast[type] ?? 0) < 1500) return;
    this.legacyLast[type] = now;

    const ctx = this.o.getContext?.(true) ?? {};
    try {
      const res = await api.post<{ session: ProctoringSessionState; locked: boolean }>(
        `${this.o.basePath}/proctoring/violations`,
        { type, meta: {}, ...(ctx.code ? { current_code: ctx.code } : {}), ...(ctx.language ? { language: ctx.language } : {}) },
        type === "tab_close_attempt" ? { keepalive: true } : undefined
      );
      this.session = res.session;
      this.o.handlers.session(res.session);
      this.o.handlers.violation({ type, count: res.session.violation_count, max: res.session.max_violations });
      if (res.locked) this.lockNow();
    } catch {
      /* a dropped report is not retried; the very next answer re-checks the lock on the server */
    }
  }

  // ═══ camera, screen, stills, analysis ═══════════════════════════════════════════════════════════════════════════════

  private adoptCamera(stream: MediaStream, label?: string): void {
    this.camera = { stream, label: label ?? stream.getVideoTracks()[0]?.label ?? "", virtual: false };
    this.cameraVideo = attachHiddenVideo(stream);
    this.o.handlers.camera(stream);
    this.o.handlers.previewReady(true);
    setCheck({ ...this.check("camera", stream.getAudioTracks().length ? "ok" : "warn"), detail: stream.getAudioTracks().length ? this.camera.label || "Camera and microphone ready" : "Camera ready — no microphone was found." });
    if (this.phase === "active") this.watchCamera();
  }

  private adoptScreen(stream: MediaStream, surface?: string): void {
    this.screen = { stream, surface: (surface as ShareResult["surface"]) ?? "unknown" };
    this.screenVideo = attachHiddenVideo(stream);
    setIntegrityUi({ screenShared: true });
    setCheck(this.check("screen", "ok", "Your entire screen is being shared."));

    // Stopping the share before the attempt starts just un-ticks the check.
    stream.getVideoTracks()[0]?.addEventListener("ended", () => {
      if (this.phase !== "active" && this.phase !== "fullscreen_lost") {
        this.screen = null;
        detachHiddenVideo(this.screenVideo);
        this.screenVideo = null;
        setIntegrityUi({ screenShared: false });
        setCheck(this.check("screen", "pending"));
      }
    });
    if (this.phase === "active") this.watchScreen();
  }

  private watchCamera(): void {
    const stream = this.camera?.stream;
    if (!stream) return;

    const stop = watchStream(stream, {
      onEnded: (kind) => {
        if (this.ended) return;
        if (kind === "video") {
          this.lost.camera = true;
          this.emit("camera_lost");
        } else {
          this.emit("mic_lost");
        }
        this.recomputeHold();
      },
      onMuted: (kind, muted) => {
        if (kind === "video" && muted && !this.ended) this.emit("camera_blocked", { via: "mute" });
      },
    });
    this.cleanups.push(stop);

    const health = new CameraHealth();
    this.every(1000, () => {
      if (!this.cameraVideo || this.lost.camera) return;
      const px = thumbnail(this.cameraVideo);
      if (!px) return;
      const finding = health.feed(sampleFrame(px), Date.now());
      if (finding) this.emit(finding.type, finding.data);
    });
  }

  private watchScreen(): void {
    const track = this.screen?.stream.getVideoTracks()[0];
    if (!track) return;

    const onEnded = () => {
      if (this.ended) return;
      this.lost.screen = true;
      this.emit("screen_share_stopped");
      this.recomputeHold();
    };
    track.addEventListener("ended", onEnded);
    this.cleanups.push(() => track.removeEventListener("ended", onEnded));
  }

  private async reshare(): Promise<void> {
    try {
      const share = await requestEntireScreen({ requireVerifiableSurface: this.policy.chromium_only });
      detachHiddenVideo(this.screenVideo);
      stopStream(this.screen?.stream);
      this.screen = share;
      this.screenVideo = attachHiddenVideo(share.stream);
      this.lost.screen = false;
      this.watchScreen();
      setIntegrityUi({ screenShared: true });
    } catch (err) {
      if (err instanceof ShareError && err.kind === "wrong_surface") this.emit("screen_share_changed", { surface: "window" });
      this.o.handlers.consentError(err instanceof ShareError ? err.message : "Couldn't start screen sharing.");
    }
    this.recomputeHold();
  }

  private async reopenCamera(): Promise<void> {
    try {
      const handle = await openCameraAndMic({ video: true, audio: true });
      if (handle.virtual) {
        stopStream(handle.stream);
        this.emit("virtual_camera", { label: handle.label });

        return;
      }
      detachHiddenVideo(this.cameraVideo);
      stopStream(this.camera?.stream);
      this.camera = handle;
      this.cameraVideo = attachHiddenVideo(handle.stream);
      this.o.handlers.camera(handle.stream);
      this.lost.camera = false;
      this.watchCamera();
    } catch {
      /* the hold stays up; the student can try again */
    }
    this.recomputeHold();
  }

  /** Webcam and screen stills at the server's cadence, jittered, plus one at the start as the reference picture. */
  private startStills(): void {
    const p = this.policy;
    const schedule = (kind: "webcam" | "screen", seconds: number) => {
      if (seconds <= 0) return;
      const tick = () => {
        if (this.ended || !this.attached) return;
        void this.still(kind, {});
        this.timers.delete(handle);
        handle = window.setTimeout(tick, jitteredMs(seconds));
        this.timers.add(handle);
      };
      let handle = window.setTimeout(tick, jitteredMs(Math.min(seconds, 10)));
      this.timers.add(handle);
    };

    schedule("webcam", p.webcam_snapshot);
    schedule("screen", p.screen_snapshot);
  }

  private async still(kind: "webcam" | "screen", opts: { flagged?: boolean; reason?: string; meta?: Record<string, unknown> }): Promise<void> {
    if (!this.uploader || this.ended) return;
    if (opts.flagged) {
      if (Date.now() - this.lastFlaggedStillAt < STILL_MIN_GAP_MS) return;
      this.lastFlaggedStillAt = Date.now();
    }

    const blob = await captureStill(
      kind === "webcam"
        ? { kind, video: this.cameraVideo, maxSide: 480, quality: 0.6 }
        : { kind, video: this.screenVideo, maxSide: 960, quality: 0.5 }
    );
    if (blob) this.uploader.add(blob, kind, opts);
  }

  private async startVision(): Promise<void> {
    if (!this.policy.ai || !this.cameraVideo) {
      setIntegrityUi({ ai: "off" });

      return;
    }

    setIntegrityUi({ ai: "loading" });

    // CPU first (predictable everywhere); the GPU only if the CPU path is too slow on this machine. A software-emulated GPU
    // (a lab PC with no graphics driver) can be a hundred times slower than the CPU, so each is timed before it is trusted.
    const video = this.cameraVideo;
    let chosen: VisionEngine | null = null;
    for (const delegate of ["CPU", "GPU"] as Delegate[]) {
      try {
        const candidate = await loadVision("/integrity", delegate);
        if (this.ended || !this.attached) {
          candidate.close();

          return;
        }
        if (await this.fastEnough(candidate, video)) {
          chosen = candidate;
          break;
        }
        candidate.close();
      } catch {
        /* this delegate does not work here — try the other */
      }
    }

    if (!chosen) {
      setIntegrityUi({ ai: "unavailable" });
      this.emit("ai_unavailable", { reason: "slow_or_unsupported" });

      return;
    }
    this.vision = chosen;
    setIntegrityUi({ ai: "ready" });

    const rules = new AttentionRules();
    let frame = 0;
    let avg = 0;

    const tick = () => {
      if (this.ended || !this.attached || !this.vision) return;
      let delay = 800;

      const video = this.cameraVideo;
      if (video && !document.hidden && !this.lost.camera) {
        const t0 = performance.now();
        let analysis = null;
        try {
          analysis = this.vision.analyse(video, frame++ % 4 === 0);
        } catch {
          analysis = null;
        }
        const dt = performance.now() - t0;
        avg = avg === 0 ? dt : avg * 0.8 + dt * 0.2;

        if (analysis) {
          for (const f of rules.feed({ t: Date.now(), faces: analysis.faces, yaw: analysis.yaw, pitch: analysis.pitch, phone: analysis.phone })) {
            this.emit(f.type, f.data);
            void this.still("webcam", { flagged: true, reason: f.type, meta: f.data });
          }
        }

        // Adapt to the machine: a slow laptop gets fewer looks, and a hopeless one gets none (the stills still go).
        if (avg > 1200) {
          setIntegrityUi({ ai: "unavailable" });
          this.emit("ai_unavailable", { reason: "slow", avg_ms: Math.round(avg) });
          this.vision.close();
          this.vision = null;

          return;
        }
        if (avg > 300) delay = 2000;
      }

      const h = window.setTimeout(tick, delay);
      this.timers.add(h);
    };

    tick();
  }

  /** Median of three timed analyses against the live camera picture; "too slow" is anything over 0.6 s per look. */
  private async fastEnough(engine: VisionEngine, video: HTMLVideoElement): Promise<boolean> {
    const until = Date.now() + 3000;
    while (video.readyState < 2 && Date.now() < until) await new Promise((r) => setTimeout(r, 100));

    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      try {
        engine.analyse(video, false);
      } catch {
        return false;
      }
      times.push(performance.now() - t0);
      await new Promise((r) => setTimeout(r, 50));
    }
    times.sort((a, b) => a - b);

    return times[1] <= 600;
  }

  private startSpeech(): void {
    if (this.o.surface === "interview" || !this.camera || this.camera.stream.getAudioTracks().length === 0) return;

    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(new MediaStream(this.camera.stream.getAudioTracks()));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);

      const gate = new SpeechGate();
      const buf = new Float32Array(analyser.fftSize);
      this.every(100, () => {
        analyser.getFloatTimeDomainData(buf);
        const seconds = gate.feed(levelDb(buf), Date.now());
        if (seconds !== null) this.emit("speech_detected", { seconds });
      });
      this.cleanups.push(() => void ctx.close().catch(() => undefined));
    } catch {
      /* no Web Audio: the camera stills are still there */
    }
  }

  // ═══ integrity of the page itself ═══════════════════════════════════════════════════════════════════════════════════

  private checkTamper(): void {
    for (const finding of findTamper()) {
      if (this.reportedTamper.has(finding)) continue;
      this.reportedTamper.add(finding);
      this.emit("tamper_detected", { what: finding });
    }
  }

  private checkExtensions(): void {
    const fresh = findExtensionInjection().filter((h) => !this.reportedExtensions.has(h));
    if (fresh.length === 0) return;
    fresh.forEach((h) => this.reportedExtensions.add(h));
    this.emit("extension_suspected", { hosts: fresh });
  }

  /** The window title carries a per-attempt marker; the Guardian finds the exam window by it. A route change that rewrites the title is put right. */
  private guardTitle(marker: string): void {
    if (!marker) return;
    this.originalTitle ??= document.title.replace(/^\[AptRun [A-F0-9]{6}\] /, "");
    const apply = () => {
      const wanted = `[AptRun ${marker}] ${this.originalTitle}`;
      if (document.title !== wanted) document.title = wanted;
    };
    apply();

    const titleEl = document.querySelector("title");
    if (titleEl) {
      this.titleObserver = new MutationObserver(() => {
        const current = document.title;
        if (!current.startsWith(`[AptRun ${marker}]`)) {
          this.originalTitle = current;
          apply();
        }
      });
      this.titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
  }

  private restoreTitle(): void {
    this.titleObserver?.disconnect();
    this.titleObserver = null;
    if (this.originalTitle !== null) document.title = this.originalTitle;
    this.originalTitle = null;
  }

  // ═══ holds ══════════════════════════════════════════════════════════════════════════════════════════════════════════

  private watchdog(): void {
    if (!this.transport || this.ended) return;
    const limit = Math.max(15, this.policy.stale_after * 0.5);
    const stale = this.transport.secondsSinceAck() > limit;
    if (stale !== this.lost.signal) {
      this.lost.signal = stale;
      this.recomputeHold();
    }
  }

  private recomputeHold(): void {
    let hold: Hold | null = null;

    if (this.lost.superseded) {
      hold = { kind: "superseded", final: true, title: "This attempt is open somewhere else", message: "Another tab or device has taken over this attempt, so this one has stopped. Close this window." };
    } else if (this.lost.signal) {
      hold = { kind: "signal", title: "Reconnecting…", message: "We can't reach the server. Keep this tab open and stay online — your answers are paused until the connection is back, and it resumes by itself." };
    } else if (this.lost.camera) {
      hold = { kind: "camera", title: "Your camera stopped", message: "The camera was turned off or unplugged. Turn it back on to continue.", action: "Turn camera back on" };
    } else if (this.lost.screen) {
      hold = { kind: "screen_share", title: "Screen sharing stopped", message: "Share your entire screen again to continue. This has been recorded.", action: "Share entire screen" };
    } else if (this.lost.guardian) {
      hold = { kind: "guardian", title: "The Guardian stopped reporting", message: "Reopen the AptRun Guardian on this computer. Your attempt continues as soon as it reconnects." };
    }

    const current = getIntegrityUi().hold;
    if (current?.kind !== hold?.kind) setIntegrityUi({ hold });
  }

  private pageState(): Record<string, unknown> {
    const nav = navigator as Navigator & { deviceMemory?: number };

    return {
      visible: !document.hidden,
      focused: document.hasFocus(),
      fullscreen: !!document.fullscreenElement,
      online: navigator.onLine,
      cam: !!this.camera && !this.lost.camera && isStreamLive(this.camera.stream),
      mic: !!this.camera && this.camera.stream.getAudioTracks().some((t) => t.readyState === "live"),
      share: !!this.screen && !this.lost.screen && isStreamLive(this.screen.stream),
      share_surface: this.screen?.surface ?? "none",
      ai: getIntegrityUi().ai,
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: Math.round(window.devicePixelRatio * 100) / 100,
      sw: window.screen.width,
      sh: window.screen.height,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      lang: navigator.language,
      platform: navigator.platform,
      cores: navigator.hardwareConcurrency ?? 0,
      mem: nav.deviceMemory ?? 0,
      monitors: monitorCount() ?? 0,
      browser: isChromium() ? "chromium" : "other",
      secure: window.isSecureContext,
    };
  }

  // ═══ plumbing ═══════════════════════════════════════════════════════════════════════════════════════════════════════

  private setPhase(p: ProctoringPhase): void {
    this.phase = p;
    this.o.handlers.phase(p);
  }

  private every(ms: number, fn: () => void): void {
    const id = window.setInterval(fn, ms);
    this.cleanups.push(() => window.clearInterval(id));
  }

  /** Stops every detector, timer and loop. Media is released separately (it may be handed to the next page). */
  private stopWork(): void {
    this.transport?.stop();
    this.transport = null;
    this.uploader?.stop();
    this.uploader = null;
    this.vision?.close();
    this.vision = null;
    this.cleanups.splice(0).forEach((fn) => {
      try {
        fn();
      } catch {
        /* a detector that fails to stop must not stop the others */
      }
    });
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers.clear();
  }

  private releaseMedia(): void {
    detachHiddenVideo(this.cameraVideo);
    detachHiddenVideo(this.screenVideo);
    this.cameraVideo = null;
    this.screenVideo = null;
    stopStream(this.camera?.stream);
    stopStream(this.screen?.stream);
    this.camera = null;
    this.screen = null;
    this.o.handlers.camera(null);
    this.o.handlers.previewReady(false);
    setIntegrityUi({ screenShared: false });
  }
}
