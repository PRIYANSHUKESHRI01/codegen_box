"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Ban } from "lucide-react";
import { Wordmark } from "@/components/brand/Logo";
import { RoomBackdrop } from "@/components/dashboard/interviews/room/RoomBackdrop";
import type { ProctoringSessionState } from "@/lib/proctoring/types";
import { LOCKED_COPY, type ProctoringActivity } from "./proctoringCopy";
import { ProctoringScreenFrame } from "./ProctoringScreenFrame";

/**
 * Replaces the entire problem UI once a student hits 3 strikes — there is
 * no "keep coding" path from here for the student themselves (see
 * ProctoringService::reinstate() on the backend — only their TPO or Section
 * Coordinator can undo this, if it was a false alarm). Whatever code they
 * had open was already auto-submitted server-side before this screen ever
 * renders.
 *
 * Drawn the way the AI interview's locked screen is (InterviewProctoringLockedScreen): over the whole window, on the room's backdrop, so
 * being locked out reads as part of the same product on every proctored surface and not as the app falling over.
 */
export function ProctoringLockedScreen({
  session,
  onBack,
  activity = "contest",
  secondary,
}: {
  session: ProctoringSessionState | null;
  onBack: () => void;
  /** Which kind of attempt ended — only changes the wording (see proctoringCopy.ts). Defaults to the original contest copy. */
  activity?: ProctoringActivity;
  /** Optional second action next to the main button (e.g. "View your result" once a Soft Skills attempt has been graded). */
  secondary?: { label: string; onClick: () => void };
}) {
  const copy = LOCKED_COPY[activity];
  const reduce = useReducedMotion() ?? false;

  return (
    <ProctoringScreenFrame>
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-background p-6" data-testid="proctoring-locked">
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
          <h2 className="text-xl font-extrabold tracking-tight text-primary">{copy.title}</h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            Your session recorded {session?.violation_count ?? 3} proctoring strikes — {copy.body}
          </p>
          <p className="text-xs leading-relaxed text-text-muted">{copy.note}</p>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface/90 px-5 py-3 text-sm font-bold text-primary shadow-sm transition-colors hover:bg-surface-hover"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {copy.backLabel}
            </button>
            {secondary && (
              <button
                type="button"
                onClick={secondary.onClick}
                className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-3 text-sm font-bold text-white shadow-lg shadow-accent-primary/30 transition-colors hover:bg-accent-primary-hover"
              >
                {secondary.label}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </ProctoringScreenFrame>
  );
}
