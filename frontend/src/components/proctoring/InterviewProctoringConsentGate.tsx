"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Camera, CheckCircle2, Clock3, Maximize, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ProctoringPhase } from "@/lib/proctoring/types";

/**
 * Shown BEFORE any interview question is ever revealed — mirrors
 * ProctoringConsentGate (contest proctoring) structurally, with
 * interview-specific copy: no mention of code submission (nothing here
 * auto-submits an answer on lock — see InterviewProctoringService's
 * docblock), the violation-consequence line doesn't presume a TPO/
 * coordinator exists (a company_hiring candidate may have neither), and —
 * unlike contests — the camera stays visible for the whole interview
 * rather than only here (see InterviewSessionHud).
 */
export function InterviewProctoringConsentGate({
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
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md rounded-panel bg-surface border border-border-subtle shadow-card p-6 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-control bg-accent-primary/10 border border-accent-primary/25 flex items-center justify-center text-accent-primary shrink-0">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-primary">This is a proctored AI interview</h2>
            <p className="text-[11px] text-text-muted">Required to take this interview.</p>
          </div>
        </div>

        <div
          className={
            devicePreviewReady
              ? "rounded-control overflow-hidden border border-border-strong bg-black relative"
              : "hidden"
          }
        >
          <video ref={previewVideoRef} muted playsInline className="w-full aspect-video object-cover -scale-x-100" />
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded bg-black/70 text-[10px] font-bold text-white">
            <CheckCircle2 className="w-3 h-3 text-status-success" />
            Make sure your face is clearly visible
          </div>
        </div>

        <ul className="space-y-2.5 text-xs text-text-secondary">
          <li className="flex items-start gap-2.5">
            <Maximize className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            <span>Your screen will switch to fullscreen for the duration of the interview. Exiting it is logged as a violation.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Camera className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            <span>
              Your camera stays on and visible in a small preview the whole time, like a video call — it&apos;s never
              uploaded or stored anywhere.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <Mic className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            <span>Your microphone records alongside the camera, separate from the answer recording you submit per question.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Clock3 className="w-4 h-4 text-accent-primary shrink-0 mt-0.5" />
            <span>Each question gives you a moment to prepare, then a set time to answer — a countdown keeps you on pace, same as a real interview.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
            <span>Switching tabs, exiting fullscreen, or opening developer tools counts as a strike. You get 2 warnings — a 3rd strike ends your attempt. Whoever invited you to this interview can reinstate it if this was a mistake.</span>
          </li>
        </ul>

        {consentError && (
          <div className="p-3 rounded-control bg-status-danger/10 border border-status-danger/25 text-[11px] text-status-danger">
            {consentError}
          </div>
        )}

        {devicePreviewReady ? (
          <Button onClick={onConsent} isLoading={starting} fullWidth>
            {starting ? "Starting..." : "Start Proctored Interview"}
          </Button>
        ) : (
          <Button onClick={onEnableDevices} fullWidth>
            {blocked ? "Try Again" : "Enable Camera & Mic to Continue"}
          </Button>
        )}

        <p className="text-[10px] text-text-muted text-center">
          By continuing you consent to being recorded and monitored for the duration of this interview.
        </p>
      </motion.div>
    </div>
  );
}
