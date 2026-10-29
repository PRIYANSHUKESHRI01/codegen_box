"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Maximize, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useIntegrityUi } from "@/lib/integrity/store";
import { AssuranceBadge, IntegrityHoldLayer } from "./IntegrityHoldLayer";
import { violationLabel, type ProctoringPhase, type ProctoringSessionState, type ViolationType } from "@/lib/proctoring/types";

/** "0/3 strikes" plus what is watching the attempt. Fixed in the corner by the HUD; the interview room places it in its own header. */
export function StrikePill({ session, className }: { session: ProctoringSessionState; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-surface border border-border-strong shadow-card text-2xs font-bold", className)}>
      <ShieldAlert className={session.violation_count > 0 ? "w-3.5 h-3.5 text-status-warning" : "w-3.5 h-3.5 text-text-muted"} />
      <span className="text-text-secondary">
        {session.violation_count}/{session.max_violations} strikes
      </span>
      <AssuranceBadge />
    </div>
  );
}

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
  embedded = false,
}: {
  phase: ProctoringPhase;
  session: ProctoringSessionState | null;
  lastViolation: { type: ViolationType; count: number; max: number } | null;
  candidateName: string;
  cameraStream: MediaStream | null;
  onResumeFullscreen: () => void;
  /**
   * The page lays out its own camera tile and strike counter (the interview room puts them in its header and side column), so
   * the HUD keeps only what has to sit above everything: the watermark, the violation warning, the fullscreen lock and the hold layer.
   */
  embedded?: boolean;
}) {
  const [toast, setToast] = useState<{ type: ViolationType; count: number; max: number } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const marker = useIntegrityUi().marker;
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
      {/* Watermark — tiled, low-opacity, ignores clicks. Still a deterrent: a screenshot or photo of the screen carries the attempt's reference
          (the same short marker the window title carries, which the server maps back to this attempt) and the time, so it can be traced and
          can't be passed off as taken at another moment. It deliberately carries no name — the candidate's identity is never printed on the
          screen — and is sparse enough not to fight the transcript. */}
      <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden select-none" aria-hidden>
        <div className="absolute inset-0 flex flex-wrap content-around justify-around opacity-[0.04] rotate-[-18deg] scale-125">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="text-primary text-xs font-bold whitespace-nowrap px-10 py-9">
              AptRun · {marker ? `#${marker} · ` : ""}
              {now.toLocaleTimeString("en-IN")}
            </span>
          ))}
        </div>
      </div>

      {/* Always-on camera self-view — the one deliberate divergence from
          contest proctoring. Bottom-right, Zoom/Meet-style tile; simply
          isn't rendered if the stream isn't available (denied/unsupported —
          text fallback still lets the interview proceed). */}
      {!embedded && cameraStream && (
        <div className="fixed bottom-5 right-5 z-50 w-[180px] sm:w-[200px] rounded-panel overflow-hidden border border-border-strong shadow-card bg-black">
          <video ref={videoRef} muted playsInline className="w-full aspect-video object-cover -scale-x-100" />
          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-status-danger animate-pulse" aria-hidden="true" />
            <span className="text-3xs font-bold text-white tracking-wide">REC</span>
          </div>
          <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent">
            <span className="text-3xs font-semibold text-white truncate block">{candidateName}</span>
          </div>
        </div>
      )}

      {/* Strike-count pill — the camera tile above already communicates
          "you're on camera," so this drops the redundant "Recording" label
          ProctoringOverlay shows and keeps just the security-relevant count. */}
      {!embedded && session && <StrikePill session={session} className="fixed top-4 right-4 z-50" />}

      {toast && (
        <div className="fixed top-16 right-4 z-50 max-w-xs p-3.5 rounded-panel bg-status-danger/10 border border-status-danger/30 shadow-card">
          <p className="text-xs font-bold text-status-danger flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning {toast.count}/{toast.max}
          </p>
          <p className="text-2xs text-text-secondary mt-1">
            {violationLabel(toast.type)}. {toast.max - toast.count > 0 ? `${toast.max - toast.count} more strike${toast.max - toast.count === 1 ? "" : "s"} and your interview ends.` : ""}
          </p>
        </div>
      )}

      {phase === "fullscreen_lost" && (
        <div role="alertdialog" aria-modal="true" aria-label="You left fullscreen" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-md">
          <div className="w-full max-w-sm space-y-5 rounded-[28px] border border-white/10 bg-surface/95 p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-status-danger/30 bg-status-danger/15 text-status-danger">
              <Maximize className="h-7 w-7" aria-hidden />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-primary">You left fullscreen</h3>
              <p className="text-xs leading-relaxed text-text-secondary">
                This was logged as a strike. Resume fullscreen to continue your interview — leaving it again will count
                toward your 3-strike limit.
              </p>
            </div>
            <Button onClick={onResumeFullscreen} fullWidth>
              Resume Fullscreen
            </Button>
          </div>
        </div>
      )}

      <IntegrityHoldLayer />
    </>
  );
}
