"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Maximize } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VIOLATION_LABEL, type ProctoringPhase, type ProctoringSessionState, type ViolationType } from "@/lib/proctoring/types";

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
}: {
  phase: ProctoringPhase;
  session: ProctoringSessionState | null;
  lastViolation: { type: ViolationType; count: number; max: number } | null;
  studentName: string;
  rollNumber: string | null;
  onResumeFullscreen: () => void;
}) {
  const [toast, setToast] = useState<{ type: ViolationType; count: number; max: number } | null>(null);
  const [now, setNow] = useState(() => new Date());

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
      {session && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2.5 px-3 py-1.5 rounded-control bg-surface border border-border-strong shadow-card text-2xs font-bold">
          <span className="flex items-center gap-1.5 text-status-danger" title="Your session is being recorded locally">
            <span className="w-2 h-2 rounded-full bg-status-danger animate-pulse" aria-hidden="true" />
            <span className="hidden sm:inline">Recording</span>
          </span>
          <span className="h-3.5 w-px bg-border-subtle" aria-hidden="true" />
          <span className="flex items-center gap-1.5 text-text-secondary">
            <AlertTriangle className={session.violation_count > 0 ? "w-3.5 h-3.5 text-status-warning" : "w-3.5 h-3.5 text-text-muted"} />
            {session.violation_count}/{session.max_violations} strikes
          </span>
        </div>
      )}

      {/* Violation toast */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 max-w-xs p-3.5 rounded-panel bg-status-danger/10 border border-status-danger/30 shadow-card">
          <p className="text-xs font-bold text-status-danger flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning {toast.count}/{toast.max}
          </p>
          <p className="text-2xs text-text-secondary mt-1">
            {VIOLATION_LABEL[toast.type]}. {toast.max - toast.count > 0 ? `${toast.max - toast.count} more strike${toast.max - toast.count === 1 ? "" : "s"} and your attempt ends.` : ""}
          </p>
        </div>
      )}

      {/* Fullscreen-lost — hard blocking prompt, can't be dismissed except by resuming */}
      {phase === "fullscreen_lost" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="max-w-sm text-center space-y-4 p-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-status-danger/15 border border-status-danger/30 flex items-center justify-center text-status-danger">
              <Maximize className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-primary">You left fullscreen</h3>
            <p className="text-xs text-text-secondary">
              This was logged as a strike. Resume fullscreen to continue your attempt — leaving it again will count
              toward your 3-strike limit.
            </p>
            <Button onClick={onResumeFullscreen} fullWidth>
              Resume Fullscreen
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
