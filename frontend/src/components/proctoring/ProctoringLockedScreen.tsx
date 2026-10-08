"use client";

import { Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ProctoringSessionState } from "@/lib/proctoring/types";
import { LOCKED_COPY, type ProctoringActivity } from "./proctoringCopy";

/**
 * Replaces the entire problem UI once a student hits 3 strikes — there is
 * no "keep coding" path from here for the student themselves (see
 * ProctoringService::reinstate() on the backend — only their TPO or Section
 * Coordinator can undo this, if it was a false alarm). Whatever code they
 * had open was already auto-submitted server-side before this screen ever
 * renders.
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

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-status-danger/15 border border-status-danger/30 flex items-center justify-center text-status-danger">
          <Ban className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-primary">{copy.title}</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Your session recorded {session?.violation_count ?? 3} proctoring strikes — {copy.body}
        </p>
        <p className="text-xs text-text-muted">{copy.note}</p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button variant="outline" onClick={onBack}>
            {copy.backLabel}
          </Button>
          {secondary && (
            <Button variant="outline" onClick={secondary.onClick}>
              {secondary.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
