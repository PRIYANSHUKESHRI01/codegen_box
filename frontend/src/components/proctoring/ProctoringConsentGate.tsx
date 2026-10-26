"use client";

import { AlertTriangle, Camera, ClipboardX, Maximize, Mic } from "lucide-react";
import { useIntegrityUi } from "@/lib/integrity/store";
import type { ProctoringPhase } from "@/lib/proctoring/types";
import { ConsentScreen, type ConsentRule } from "./ConsentScreen";
import { IntegrityDisclosure } from "./IntegrityDisclosure";
import { CONSENT_COPY, type ProctoringActivity } from "./proctoringCopy";

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
 *
 * When the server runs the exam-integrity layer, a system-check list sits between the two: screen sharing,
 * the single-screen check and the Guardian, each with what to do about it — and Start stays disabled until
 * every required row is green. What is recorded and for how long is spelled out from the server's own policy.
 *
 * The layout itself (get ready · what to expect · the pinned Start bar) is ConsentScreen, shared with the interview gate.
 */
export function ProctoringConsentGate({
  phase,
  consentError,
  devicePreviewReady,
  previewVideoRef,
  onEnableDevices,
  onConsent,
  activity = "contest",
}: {
  phase: ProctoringPhase;
  consentError: string | null;
  devicePreviewReady: boolean;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  onEnableDevices: () => void;
  onConsent: () => void;
  /** Which kind of attempt this gates — only changes the wording (see proctoringCopy.ts). Defaults to the original contest copy. */
  activity?: ProctoringActivity;
}) {
  const copy = CONSENT_COPY[activity];
  const integrity = useIntegrityUi().policy !== null;

  const rules: ConsentRule[] = [
    { icon: Maximize, text: "Your screen will switch to fullscreen for the duration of your attempt. Exiting it is logged as a violation." },
    ...(!integrity
      ? [
          {
            icon: Camera,
            text: "Your camera turns on and records for your own attempt only — video stays in your browser and is never uploaded or stored. It won't be shown on screen once your attempt begins.",
          },
          { icon: Mic, text: "Your microphone records alongside the camera, for the same reason." },
        ]
      : []),
    { icon: AlertTriangle, tone: "warn", text: copy.strikes },
    ...(copy.paste ? [{ icon: ClipboardX, text: copy.paste }] : []),
  ];

  return (
    <ConsentScreen
      title={copy.title}
      subtitle={copy.subtitle}
      previewVideoRef={previewVideoRef}
      devicePreviewReady={devicePreviewReady}
      onEnableDevices={onEnableDevices}
      onConsent={onConsent}
      starting={phase === "starting"}
      blocked={phase === "blocked"}
      startLabel="Start Proctored Session"
      consentError={consentError}
      rules={rules}
      disclosure={integrity ? <IntegrityDisclosure /> : null}
      footer={integrity ? copy.footer.replace(" Video stays in your browser.", "") : copy.footer}
    />
  );
}
