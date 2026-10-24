"use client";

import { Camera, Eye, Fingerprint, Mic, Monitor, ShieldCheck } from "lucide-react";
import { useIntegrityUi } from "@/lib/integrity/store";

/**
 * What is recorded and sent, stated plainly before the student agrees. The numbers come from the server's policy for THIS
 * attempt (the same values the engine runs on), so the screen can never promise one thing while the code does another.
 * Renders nothing when the integrity layer is off — the original consent copy covers that case.
 */
export function IntegrityDisclosure({ interview = false }: { interview?: boolean }) {
  const { policy } = useIntegrityUi();
  if (!policy) return null;

  const every = (s: number) => (s >= 60 ? `${Math.round(s / 60)} minute${Math.round(s / 60) === 1 ? "" : "s"}` : `${s} seconds`);

  return (
    <ul className="space-y-2.5 text-xs text-text-secondary" aria-label="What is recorded">
      {policy.camera !== "off" && (
        <li className="flex items-start gap-2.5">
          <Camera className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
          <span>
            Your camera is on for the whole attempt.{" "}
            {policy.webcam_snapshot > 0 ? (
              <>A still picture is taken about every {every(policy.webcam_snapshot)} — and whenever the software notices something unusual — and sent to AptRun. </>
            ) : (
              <>Pictures are only sent when something unusual is noticed. </>
            )}
            Your video itself is never uploaded.
          </span>
        </li>
      )}
      {policy.screen_share !== "off" && (
        <li className="flex items-start gap-2.5">
          <Monitor className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
          <span>
            You share your <strong>entire screen</strong> with this page.{" "}
            {policy.screen_snapshot > 0 ? <>A reduced-size picture of it is sent about every {every(policy.screen_snapshot)}. </> : <>It is used to confirm you stay on the exam. </>}
            Stopping the share is a strike.
          </span>
        </li>
      )}
      {policy.camera !== "off" && (
        <li className="flex items-start gap-2.5">
          <Mic className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
          <span>
            {interview
              ? "Your microphone records your answers, as in any interview. It is not used for anything else."
              : "Your microphone is only used to notice whether someone is speaking. No audio is recorded or sent."}
          </span>
        </li>
      )}
      {policy.guardian !== "off" && (
        <li className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
          <span>
            The <strong>AptRun Guardian</strong> program on your computer reports which programs and windows are open, how many screens are connected, and your network settings during the attempt. It does not read your files, messages or browsing.
            {policy.guardian === "required" ? " It is required for this attempt." : " It is optional here."}
          </span>
        </li>
      )}
      <li className="flex items-start gap-2.5">
        <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
        <span>Your network address and a device identifier are recorded, and the attempt is tied to this one browser.</span>
      </li>
      <li className="flex items-start gap-2.5">
        <Eye className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" />
        <span>
          Pictures and the activity log are visible only to authorised reviewers (your TPO / section coordinator, or the organisation that set the attempt). They are deleted after {policy.retention_days} days — {Math.round(policy.flagged_retention_days / 30)} months if the attempt was flagged, so a dispute can be settled.
        </span>
      </li>
    </ul>
  );
}
