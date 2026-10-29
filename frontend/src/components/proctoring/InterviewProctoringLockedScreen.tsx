"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Ban } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { RoomBackdrop } from "@/components/dashboard/interviews/room/RoomBackdrop";
import type { ProctoringSessionState } from "@/lib/proctoring/types";

/**
 * Replaces the entire interview UI once a candidate hits 3 strikes —
 * mirrors ProctoringLockedScreen (contest proctoring), with one real
 * difference: no code/answer was auto-submitted on lock (there's nothing
 * safe to fabricate from a spoken answer mid-recording — see
 * InterviewProctoringService's docblock), so this doesn't claim otherwise.
 * Only whoever owns this interview (TPO or hiring partner) can reinstate it.
 *
 * On the interview's own backdrop, like every other screen of the interview, so being locked out reads as part of the same product and
 * not as the app falling over.
 */
export function InterviewProctoringLockedScreen({ session, onBack }: { session: ProctoringSessionState | null; onBack: () => void }) {
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-background p-6" data-testid="interview-locked">
      <RoomBackdrop />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex max-w-md flex-col items-center space-y-5 text-center"
      >
        <Wordmark className="text-2xl" />
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-status-danger/30 bg-status-danger/15 text-status-danger shadow-lg shadow-status-danger/10">
          <Ban className="h-8 w-8" aria-hidden />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight text-primary">You&apos;ve been locked out of this interview</h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          Your session recorded {session?.violation_count ?? 3} proctoring strikes — leaving the exam window, exiting
          fullscreen, opening developer tools, a stopped camera or screen share, or another proctoring finding.
        </p>
        <p className="text-xs leading-relaxed text-text-muted">
          If you believe this was a mistake, contact whoever invited you to this interview — they can reinstate your
          attempt from their review screen.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/90 px-5 py-3 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-surface-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Interviews
        </button>
      </motion.div>
    </div>
  );
}
