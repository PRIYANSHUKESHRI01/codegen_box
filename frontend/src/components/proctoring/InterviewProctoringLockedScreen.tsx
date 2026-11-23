"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowLeft, Ban, HelpCircle, ShieldAlert } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { RoomBackdrop } from "@/components/dashboard/interviews/room/RoomBackdrop";
import type { ProctoringSessionState } from "@/lib/proctoring/types";

/**
 * Replaces the entire interview UI once a candidate is locked out —
 * due to continuous face mismatch, mobile phone detection, missing face, or 3 strikes.
 * Shows clear rationale and guidance: if it occurred by mistake, they are instructed
 * to contact their administrator for support and reinstatement.
 */
export function InterviewProctoringLockedScreen({
  session,
  onBack,
  reason: propReason,
  sessionId,
}: {
  session: ProctoringSessionState | null;
  onBack: () => void;
  reason?: string;
  sessionId?: number | string;
}) {
  const reduce = useReducedMotion() ?? false;
  const [storedReason, setStoredReason] = useState<string | null>(propReason ?? null);

  useEffect(() => {
    if (propReason) {
      setStoredReason(propReason);
      return;
    }
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("aptrun_proctoring_lock_reason");
        if (stored) setStoredReason(stored);
      } catch {
        /* storage may be unavailable */
      }
    }
  }, [propReason]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-background p-6" data-testid="interview-locked">
      <RoomBackdrop />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex max-w-lg flex-col items-center space-y-5 text-center"
      >
        <Wordmark className="text-2xl" />
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-status-danger/30 bg-status-danger/15 text-status-danger shadow-lg shadow-status-danger/10">
          <Ban className="h-8 w-8" aria-hidden />
        </div>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-primary">You&apos;ve been locked out of this interview</h2>
          <p className="mt-1 text-xs text-text-muted">Proctoring integrity protocol triggered · Session terminated</p>
        </div>

        {storedReason ? (
          <div className="w-full rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-left">
            <div className="flex items-center gap-2 text-2xs font-extrabold uppercase tracking-wider text-status-danger">
              <ShieldAlert className="h-3.5 w-3.5" /> Termination Reason
            </div>
            <p className="mt-1 text-xs leading-relaxed font-medium text-primary">
              {storedReason}
            </p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-text-secondary">
            Your session recorded {session?.violation_count ?? 3} proctoring strikes or a security violation — leaving the
            interview window, prohibited object detection, or facial mismatch.
          </p>
        )}

        <div className="w-full rounded-2xl border border-border-subtle bg-surface/90 p-4 text-left shadow-card">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 shrink-0 text-accent-primary mt-0.5" />
            <div className="space-y-1.5 text-xs">
              <p className="font-bold text-primary">
                If this happened by mistake, please contact your administrator for support.
              </p>
              <p className="text-text-muted leading-relaxed">
                Administrators can review your session telemetry, verify evidence stills, and reinstate your attempt or re-grant access from the SuperAdmin dashboard.
              </p>
              {(sessionId || (session as unknown as { id?: number | string })?.id) && (
                <div className="pt-2 mt-2 border-t border-border-subtle flex items-center justify-between text-3xs font-mono text-text-muted">
                  <span>Reference Session: #{sessionId || (session as unknown as { id?: number | string })?.id}</span>
                  <span>Status: Locked</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/90 px-6 py-3 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-surface-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Interviews
        </button>
      </motion.div>
    </div>
  );
}
