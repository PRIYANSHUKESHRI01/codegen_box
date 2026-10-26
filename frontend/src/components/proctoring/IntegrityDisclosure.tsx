"use client";

import type { ReactNode } from "react";
import { Camera, Eye, Fingerprint, Mic, Monitor, ShieldCheck, type LucideIcon } from "lucide-react";
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
    <ul className="space-y-3 text-xs leading-relaxed text-text-secondary" aria-label="What is recorded">
      {policy.camera !== "off" && (
        <Item icon={Camera}>
          <span>
            Your camera is on for the whole attempt.{" "}
            {policy.webcam_snapshot > 0 ? (
              <>A still picture is taken about every {every(policy.webcam_snapshot)} — and whenever the software notices something unusual — and sent to AptRun. </>
            ) : (
              <>Pictures are only sent when something unusual is noticed. </>
            )}
            Your video itself is never uploaded.
          </span>
        </Item>
      )}
      {policy.screen_share !== "off" && (
        <Item icon={Monitor}>
          <span>
            You share your <strong>entire screen</strong> with this page.{" "}
            {policy.screen_snapshot > 0 ? <>A reduced-size picture of it is sent about every {every(policy.screen_snapshot)}. </> : <>It is used to confirm you stay on the exam. </>}
            Stopping the share is a strike.
          </span>
        </Item>
      )}
      {policy.camera !== "off" && (
        <Item icon={Mic}>
          <span>
            {interview
              ? "Your microphone records your answers, as in any interview. It is not used for anything else."
              : "Your microphone is only used to notice whether someone is speaking. No audio is recorded or sent."}
          </span>
        </Item>
      )}
      {policy.guardian !== "off" && (
        <Item icon={ShieldCheck}>
          <span>
            The <strong>AptRun Guardian</strong> program on your computer reports which programs and windows are open, how many screens are connected, and your network settings during the attempt. It does not read your files, messages or browsing.
            {policy.guardian === "required" ? " It is required for this attempt." : " It is optional here."}
          </span>
        </Item>
      )}
      <Item icon={Fingerprint}>
        <span>Your network address and a device identifier are recorded, and the attempt is tied to this one browser.</span>
      </Item>
      <Item icon={Eye}>
        <span>
          Pictures and the activity log are visible only to authorised reviewers (your TPO / section coordinator, or the organisation that set the attempt). They are deleted after {policy.retention_days} days — {Math.round(policy.flagged_retention_days / 30)} months if the attempt was flagged, so a dispute can be settled.
        </span>
      </Item>
    </ul>
  );
}

function Item({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-primary/10 text-accent-primary">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      {children}
    </li>
  );
}
