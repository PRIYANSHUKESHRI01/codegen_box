"use client";

import { Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ProctoringSessionState } from "@/lib/proctoring/types";

/**
 * Replaces the entire interview UI once a candidate hits 3 strikes —
 * mirrors ProctoringLockedScreen (contest proctoring), with one real
 * difference: no code/answer was auto-submitted on lock (there's nothing
 * safe to fabricate from a spoken answer mid-recording — see
 * InterviewProctoringService's docblock), so this doesn't claim otherwise.
 * Only whoever owns this interview (TPO or hiring partner) can reinstate it.
 */
export function InterviewProctoringLockedScreen({ session, onBack }: { session: ProctoringSessionState | null; onBack: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-status-danger/15 border border-status-danger/30 flex items-center justify-center text-status-danger">
          <Ban className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-primary">You've been locked out of this interview</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Your session recorded {session?.violation_count ?? 3} proctoring strikes — exiting fullscreen, switching
          tabs, or a detected developer-tools open.
        </p>
        <p className="text-xs text-text-muted">
          If you believe this was a mistake, contact whoever invited you to this interview — they can reinstate your
          attempt from their review screen.
        </p>
        <Button variant="outline" onClick={onBack}>
          Back to Interviews
        </Button>
      </div>
    </div>
  );
}
