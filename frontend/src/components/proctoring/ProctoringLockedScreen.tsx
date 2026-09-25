"use client";

import { Ban } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ProctoringSessionState } from "@/lib/proctoring/types";

/**
 * Replaces the entire problem UI once a student hits 3 strikes — there is
 * no "keep coding" path from here for the student themselves (see
 * ProctoringService::reinstate() on the backend — only their TPO or Section
 * Coordinator can undo this, if it was a false alarm). Whatever code they
 * had open was already auto-submitted server-side before this screen ever
 * renders.
 */
export function ProctoringLockedScreen({ session, onBack }: { session: ProctoringSessionState | null; onBack: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-status-danger/15 border border-status-danger/30 flex items-center justify-center text-status-danger">
          <Ban className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-primary">You've been locked out of this contest</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          Your session recorded {session?.violation_count ?? 3} proctoring strikes — exiting fullscreen, switching
          tabs, or a detected developer-tools open. Whatever code you had open was submitted for judging before
          access was revoked.
        </p>
        <p className="text-xs text-text-muted">
          This has been reported to your TPO and section coordinator. If you believe this was a mistake, contact
          them directly — they can reinstate your attempt.
        </p>
        <Button variant="outline" onClick={onBack}>
          Back to Contest
        </Button>
      </div>
    </div>
  );
}
