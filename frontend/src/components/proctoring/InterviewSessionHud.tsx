"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Maximize, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { VIOLATION_LABEL, type ProctoringPhase, type ProctoringSessionState, type ViolationType } from "@/lib/proctoring/types";

/**
 * The interview-specific counterpart to ProctoringOverlay (contest
 * proctoring) — same watermark/violation-toast/fullscreen-lost mechanics,
 * reused near-verbatim, PLUS a persistent camera self-view tile. The one
 * deliberate divergence from contest proctoring: a real interview is a
 * video-call-style experience — the candidate's own camera stays visible
 * the entire time they're on camera, never hidden, unlike a contest where
 * showing it would just be a distraction from the code. ProctoringOverlay
 * itself is untouched; contests keep their original "camera never shown
 * once active" behavior.
 */
export function InterviewSessionHud({
  phase,
  session,
  lastViolation,
  candidateName,
  cameraStream,
  onResumeFullscreen,
}: {
  phase: ProctoringPhase;
  session: ProctoringSessionState | null;
  lastViolation: { type: ViolationType; count: number; max: number } | null;
  candidateName: string;
  cameraStream: MediaStream | null;
  onResumeFullscreen: () => void;
}) {
  const [toast, setToast] = useState<{ type: ViolationType; count: number; max: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const videoRef = useRef<HTMLVideoElement>(null);

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

  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== cameraStream) {
      videoRef.current.srcObject = cameraStream;
      if (cameraStream) videoRef.current.play().catch(() => {});
    }
  }, [cameraStream]);

  return (
    <>
      {/* Watermark — tiled, low-opacity, ignores clicks. Same deterrent as contest proctoring: identifies whose screen a screenshot/photo/share came from. */}
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden select-none" aria-hidden>
        <div className="absolute inset-0 flex flex-wrap content-around justify-around opacity-[0.05] rotate-[-18deg] scale-125">
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} className="text-primary text-xs font-bold whitespace-nowrap px-8 py-6">
              {candidateName} · {now.toLocaleTimeString("en-IN")}
            </span>
          ))}
        </div>
      </div>

      {/* Always-on camera self-view — the one deliberate divergence from
          contest proctoring. Bottom-right, Zoom/Meet-style tile; simply
          isn't rendered if the stream isn't available (denied/unsupported —
          text fallback still lets the interview proceed). */}
      {cameraStream && (
        <div className="fixed bottom-5 right-5 z-50 w-[180px] sm:w-[200px] rounded-panel overflow-hidden border border-border-strong shadow-card bg-black">
          <video ref={videoRef} muted playsInline className="w-full aspect-video object-cover -scale-x-100" />
          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-status-danger animate-pulse" aria-hidden="true" />
            <span className="text-[9px] font-bold text-white tracking-wide">REC</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
            <span className="text-[9px] font-semibold text-white truncate block">{candidateName}</span>
          </div>
        </div>
      )}

      {/* Strike-count pill — the camera tile above already communicates
          "you're on camera," so this drops the redundant "Recording" label
          ProctoringOverlay shows and keeps just the security-relevant count. */}
      {session && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface border border-border-strong shadow-card text-[11px] font-bold">
          <ShieldAlert className={session.violation_count > 0 ? "w-3.5 h-3.5 text-status-warning" : "w-3.5 h-3.5 text-text-muted"} />
          <span className="text-text-secondary">
            {session.violation_count}/{session.max_violations} strikes
          </span>
        </div>
      )}

      {toast && (
        <div className="fixed top-16 right-4 z-50 max-w-xs p-3.5 rounded-panel bg-status-danger/10 border border-status-danger/30 shadow-card">
          <p className="text-xs font-bold text-status-danger flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning {toast.count}/{toast.max}
          </p>
          <p className="text-[11px] text-text-secondary mt-1">
            {VIOLATION_LABEL[toast.type]}. {toast.max - toast.count > 0 ? `${toast.max - toast.count} more strike${toast.max - toast.count === 1 ? "" : "s"} and your interview ends.` : ""}
          </p>
        </div>
      )}

      {phase === "fullscreen_lost" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="max-w-sm text-center space-y-4 p-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-status-danger/15 border border-status-danger/30 flex items-center justify-center text-status-danger">
              <Maximize className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-primary">You left fullscreen</h3>
            <p className="text-xs text-text-secondary">
              This was logged as a strike. Resume fullscreen to continue your interview — leaving it again will count
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
