"use client";

import { AlertTriangle, Camera, CheckCircle2, Maximize, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ProctoringPhase } from "@/lib/proctoring/types";

/**
 * Shown BEFORE any contest problem content is ever rendered — a student
 * cannot see the problem, let alone the editor, without granting camera/mic
 * access and starting fullscreen. This is deliberate: proctoring must be
 * active from the very first moment they could start reading/solving, not
 * bolted on after the fact.
 *
 * Two-step flow: "Enable Camera & Mic" grants access and shows a live
 * self-check preview so the student can confirm positioning/lighting
 * BEFORE committing to the timed, fullscreen attempt. Once that attempt
 * starts, the camera is never shown again — only this pre-start screen
 * ever renders a preview.
 */
export function ProctoringConsentGate({
  phase,
  consentError,
  devicePreviewReady,
  previewVideoRef,
  onEnableDevices,
  onConsent,
}: {
  phase: ProctoringPhase;
  consentError: string | null;
  devicePreviewReady: boolean;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  onEnableDevices: () => void;
  onConsent: () => void;
}) {
  const starting = phase === "starting";
  const blocked = phase === "blocked";

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-primary">This is a proctored contest</h2>
            <p className="text-[11px] text-text-muted">Required for every contest problem — not for practice.</p>
          </div>
        </div>

        {/* Live self-check preview — mounted from the moment this component
            renders (shows black until a stream attaches) so enableDevicePreview
            can attach synchronously with zero ref-timing gymnastics. Only ever
            visible here; nothing during the actual attempt shows it again. */}
        <div
          className={
            devicePreviewReady
              ? "rounded-control overflow-hidden border border-border-strong bg-black relative"
              : "hidden"
          }
        >
          <video ref={previewVideoRef} muted playsInline className="w-full aspect-video object-cover" />
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded bg-black/70 text-[10px] font-bold text-white">
            <CheckCircle2 className="w-3 h-3 text-status-success" />
            Make sure your face is clearly visible
          </div>
        </div>

        <ul className="space-y-2.5 text-xs text-text-secondary">
          <li className="flex items-start gap-2.5">
            <Maximize className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            <span>Your screen will switch to fullscreen for the duration of your attempt. Exiting it is logged as a violation.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Camera className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            <span>
              Your camera turns on and records for your own attempt only — video stays in your browser and is never
              uploaded or stored. It won't be shown on screen once your attempt begins.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Mic className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            <span>Your microphone records alongside the camera, for the same reason.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
            <span>Switching tabs, exiting fullscreen, or opening developer tools counts as a strike. You get 2 warnings — a 3rd strike submits your current code and ends your attempt. This is reported to your TPO and section coordinator.</span>
          </li>
        </ul>

        {consentError && (
          <div className="p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-[11px] text-status-danger">
            {consentError}
          </div>
        )}

        {devicePreviewReady ? (
          <Button onClick={onConsent} isLoading={starting} fullWidth>
            {starting ? "Starting..." : "Start Proctored Session"}
          </Button>
        ) : (
          <Button onClick={onEnableDevices} fullWidth>
            {blocked ? "Try Again" : "Enable Camera & Mic to Continue"}
          </Button>
        )}

        <p className="text-[10px] text-text-muted text-center">
          By continuing you consent to being recorded and monitored for the duration of this contest attempt.
        </p>
      </div>
    </div>
  );
}
