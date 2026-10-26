"use client";

import { AlertTriangle, Camera, Clock3, Maximize, Mic } from "lucide-react";
import { useIntegrityUi } from "@/lib/integrity/store";
import type { ProctoringPhase } from "@/lib/proctoring/types";
import { ConsentScreen, type ConsentRule } from "./ConsentScreen";
import { IntegrityDisclosure } from "./IntegrityDisclosure";

/**
 * Shown BEFORE any interview question is ever revealed — mirrors
 * ProctoringConsentGate (contest proctoring) structurally, with
 * interview-specific copy: no mention of code submission (nothing here
 * auto-submits an answer on lock — see InterviewProctoringService's
 * docblock), the violation-consequence line doesn't presume a TPO/
 * coordinator exists (a company_hiring candidate may have neither), and —
 * unlike contests — the camera stays visible for the whole interview
 * rather than only here (see InterviewSessionHud).
 *
 * The layout is ConsentScreen, the same one every other proctored attempt uses.
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
  const integrity = useIntegrityUi().policy !== null;

  const rules: ConsentRule[] = [
    { icon: Maximize, text: "Your screen will switch to fullscreen for the duration of the interview. Exiting it is logged as a violation." },
    integrity
      ? { icon: Camera, text: "Your camera stays on and visible in a small preview the whole time, like a video call." }
      : { icon: Camera, text: "Your camera stays on and visible in a small preview the whole time, like a video call — it's never uploaded or stored anywhere." },
    ...(!integrity ? [{ icon: Mic, text: "Your microphone records alongside the camera, separate from the answer recording you submit per question." }] : []),
    { icon: Clock3, text: "Each question gives you a moment to prepare, then a set time to answer — a countdown keeps you on pace, same as a real interview." },
    {
      icon: AlertTriangle,
      tone: "warn",
      text: "Leaving this window or tab, exiting fullscreen, opening developer tools, or stopping your camera or screen share counts as a strike. You get 2 warnings — a 3rd strike ends your attempt. Whoever invited you to this interview can reinstate it if this was a mistake.",
    },
  ];

  return (
    <ConsentScreen
      title="This is a proctored AI interview"
      subtitle="Required to take this interview."
      previewVideoRef={previewVideoRef}
      devicePreviewReady={devicePreviewReady}
      mirrored
      onEnableDevices={onEnableDevices}
      onConsent={onConsent}
      starting={phase === "starting"}
      blocked={phase === "blocked"}
      startLabel="Start Proctored Interview"
      consentError={consentError}
      rules={rules}
      disclosure={integrity ? <IntegrityDisclosure interview /> : null}
      footer="By continuing you consent to being recorded and monitored for the duration of this interview."
    />
  );
}
