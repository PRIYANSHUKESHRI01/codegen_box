"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardX, Maximize, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useIntegrityUi } from "@/lib/integrity/store";
import { AssuranceBadge, IntegrityHoldLayer } from "./IntegrityHoldLayer";
import { violationLabel, type ProctoringPhase, type ProctoringSessionState, type ViolationType } from "@/lib/proctoring/types";

/** Combined recording + strike-count status pill — shared inline or floating across proctored surfaces. */
export function ProctoringStatusPill({
  session,
  className = "",
}: {
  session: ProctoringSessionState;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-1.5 rounded-control bg-surface border border-border-strong shadow-card text-2xs font-bold whitespace-nowrap ${className}`.trim()}
    >
      <span className="flex items-center gap-1.5 text-status-danger" title="Your attempt is being proctored">
        <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" aria-hidden="true" />
        <span className="hidden sm:inline">Recording</span>
      </span>
      <span className="h-3.5 w-px bg-border-subtle" aria-hidden="true" />
      <span className="flex items-center gap-1.5 text-text-secondary">
        <AlertTriangle className={session.violation_count > 0 ? "w-3.5 h-3.5 text-status-warning" : "w-3.5 h-3.5 text-text-muted"} />
        {session.violation_count}/{session.max_violations} strikes
      </span>
      <AssuranceBadge />
    </div>
  );
}

/**
 * Rendered on top of the normal contest problem UI (absolutely positioned,
 * `pointer-events-none` except its own interactive pieces) once proctoring
 * is active — a name/roll-number/timestamp watermark (deters
 * screen-sharing/screenshots — any capture identifies whose screen it
 * was), a combined recording/strike-count status pill, and the
 * violation-warning toast. The camera itself is never shown here — only
 * ProctoringConsentGate's pre-start self-check ever renders a live preview;
 * recording continues invisibly in the background for the whole attempt.
 * When fullscreen is lost, this instead shows a hard blocking "Resume
 * Fullscreen" prompt, since a browser can only re-enter fullscreen from a
 * real user gesture.
 */
export function ProctoringOverlay({
  phase,
  session,
  lastViolation,
  studentName,
  rollNumber,
  onResumeFullscreen,
  hideStatusPill = false,
}: {
  phase: ProctoringPhase;
  session: ProctoringSessionState | null;
  lastViolation: { type: ViolationType; count: number; max: number } | null;
  studentName: string;
  rollNumber: string | null;
  onResumeFullscreen: () => void;
  hideStatusPill?: boolean;
}) {
  const [toast, setToast] = useState<{ type: ViolationType; count: number; max: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const { graceWarning } = useIntegrityUi();

  useEffect(() => {
    if (!lastViolation) return;
    setToast(lastViolation);
    const timeout = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timeout);
  }, [lastViolation]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Watermark — tiled, low-opacity, ignores clicks. Identifies whose
          screen a screenshot/photo/share came from. */}
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden select-none" aria-hidden>
        <div
          className="absolute inset-0 flex flex-wrap content-around justify-around opacity-[0.05] rotate-[-18deg] scale-125"
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="text-primary text-xs font-bold whitespace-nowrap px-8 py-6">
              {studentName} {rollNumber ? `· ${rollNumber}` : ""} · {now.toLocaleTimeString("en-IN")}
            </span>
          ))}
        </div>
      </div>

      {/* Combined recording + strike-count status pill — the camera feed
          itself is never shown here; this is just an honest indicator that
          it's running in the background, plus the always-visible strike
          count (not just at toast time). */}
      {!hideStatusPill && session && <ProctoringStatusPill session={session} className="fixed top-4 right-4 z-50" />}

      {/* Active Vault-AI-style grace countdown warning for multiple people / phone / face mismatch / absent face / looking away */}
      {graceWarning && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-16 sm:top-20 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-[70] max-w-lg w-full rounded-2xl border-2 border-status-danger bg-status-danger/95 text-white p-4 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-white">
                  {graceWarning.type === "phone_detected"
                    ? "PROHIBITED DEVICE DETECTED"
                    : graceWarning.type === "face_mismatch"
                    ? "FACE IDENTITY MISMATCH"
                    : graceWarning.type === "no_face"
                    ? "FACE NOT DETECTED"
                    : graceWarning.type === "face_away"
                    ? "LOOKING AWAY / HEAD TURNED SIDEWAYS"
                    : graceWarning.type === "speech_prohibited"
                    ? "PROHIBITED SPEECH / CONVERSATION DETECTED"
                    : "MULTIPLE PEOPLE DETECTED"}
                </p>
                <span className="rounded-full bg-black/40 px-2.5 py-0.5 font-mono text-xs font-extrabold text-white">
                  {graceWarning.secondsRemaining}s left
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-white/95 leading-snug">
                {graceWarning.message}
              </p>
              <div className="mt-2.5 flex items-center justify-between gap-2 text-2xs text-white/80">
                <span>Session will terminate automatically if not resolved.</span>
                <span className="font-semibold underline">Auto-recovers when resolved</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocked paste — logged, but not a strike, so it must not read like one ("Warning 1/3 … 2 more strikes"). */}
      {toast?.type === "paste_attempt" && (
        <div className="fixed top-16 right-4 z-50 max-w-xs p-3.5 rounded-panel bg-status-warning/10 border border-status-warning/30 shadow-card">
          <p className="text-xs font-bold text-status-warning flex items-center gap-1.5">
            <ClipboardX className="w-3.5 h-3.5" />
            Paste blocked
          </p>
          <p className="text-2xs text-text-secondary mt-1">
            You can only paste code you copied from this editor. Nothing was pasted. This isn&apos;t a strike, but it is
            recorded in your proctoring report.
          </p>
        </div>
      )}

      {/* Violation toast */}
      {toast && toast.type !== "paste_attempt" && (
        <div className="fixed top-16 right-4 z-50 max-w-xs p-3.5 rounded-panel bg-status-danger/10 border border-status-danger/30 shadow-card">
          <p className="text-xs font-bold text-status-danger flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning {toast.count}/{toast.max}
          </p>
          <p className="text-2xs text-text-secondary mt-1">
            {violationLabel(toast.type)}. {toast.max - toast.count > 0 ? `${toast.max - toast.count} more strike${toast.max - toast.count === 1 ? "" : "s"} and your attempt ends.` : ""}
          </p>
        </div>
      )}

      {/* Fullscreen-lost — hard blocking prompt, can't be dismissed except by resuming */}
      {phase === "fullscreen_lost" && (
        // The same card the AI interview shows (InterviewSessionHud), so leaving fullscreen reads the same on every proctored surface.
        <div role="alertdialog" aria-modal="true" aria-label="You left fullscreen" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-md">
          <div className="w-full max-w-sm space-y-5 rounded-[28px] border border-white/10 bg-surface/95 p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-status-danger/30 bg-status-danger/15 text-status-danger">
              <Maximize className="h-7 w-7" aria-hidden />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-primary">You left fullscreen</h3>
              <p className="text-xs leading-relaxed text-text-secondary">
                This was logged as a strike. Resume fullscreen to continue your attempt — leaving it again will count
                toward your 3-strike limit.
              </p>
            </div>
            <Button onClick={onResumeFullscreen} fullWidth>
              Resume Fullscreen
            </Button>
          </div>
        </div>
      )}

      {/* Screen share stopped / camera gone / signal lost / Guardian quiet / attempt open elsewhere. */}
      <IntegrityHoldLayer />
    </>
  );
}
