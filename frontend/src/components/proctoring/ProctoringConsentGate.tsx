"use client";

import { AlertTriangle, Camera, ClipboardX, Maximize, Mic } from "lucide-react";
import { InterviewLobby, type LobbyRule } from "@/components/dashboard/interviews/room/InterviewLobby";
import { useIntegrityUi } from "@/lib/integrity/store";
import type { ProctoringPhase } from "@/lib/proctoring/types";
import { IntegrityDisclosure } from "./IntegrityDisclosure";
import { CONSENT_COPY, type ProctoringActivity } from "./proctoringCopy";
import { ProctoringScreenFrame } from "./ProctoringScreenFrame";

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
 * The screen itself is the AI interview's lobby (InterviewLobby) — full-window, on the room's own backdrop, with the microphone meter —
 * so every proctored surface (contests, Core tests and practice, Soft Skills tests, Skill Drills, interviews) is entered the same way. It
 * is drawn over the whole window by ProctoringScreenFrame, so the page around the gate does not matter.
 */
export function ProctoringConsentGate({
  phase,
  consentError,
  devicePreviewReady,
  previewVideoRef,
  onEnableDevices,
  onConsent,
  activity = "contest",
  cameraStream = null,
  candidateName = "",
  onLeave,
}: {
  phase: ProctoringPhase;
  consentError: string | null;
  devicePreviewReady: boolean;
  previewVideoRef: React.RefObject<HTMLVideoElement>;
  onEnableDevices: () => void;
  onConsent: () => void;
  /** Which kind of attempt this gates — only changes the wording (see proctoringCopy.ts). Defaults to the original contest copy. */
  activity?: ProctoringActivity;
  /** The same stream the attempt will use; the lobby reads it to show the microphone level. Without it the meter simply stays quiet. */
  cameraStream?: MediaStream | null;
  /** For the greeting. Left out, the heading drops the name. */
  candidateName?: string;
  /** Leaves without starting. When given, the lobby shows a "Leave" button. */
  onLeave?: () => void;
}) {
  const copy = CONSENT_COPY[activity];
  const integrity = useIntegrityUi().policy !== null;

  const rules: LobbyRule[] = [
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
    <ProctoringScreenFrame testId="proctoring-lobby">
      <InterviewLobby
        sessionLabel={copy.label}
        candidateName={candidateName}
        badge={copy.badge}
        intro={copy.intro}
        previewVideoRef={previewVideoRef}
        cameraStream={cameraStream}
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
        onLeave={onLeave}
      />
    </ProctoringScreenFrame>
  );
}
