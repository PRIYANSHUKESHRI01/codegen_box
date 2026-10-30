"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { StudyReport } from "@/types/studyReport";

/**
 * Downloads the PDF report of one finished sitting. The server keeps the sitting (GET /study-attempts/{id}); the PDF is made here, in the
 * browser, so it is the student's own file and costs nothing to produce. The PDF code is loaded only when the button is pressed.
 */
export function DownloadReportButton({ attemptId, label = "Download report", compact = false, className }: { attemptId: number; label?: string; compact?: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const report = await api.get<StudyReport>(`/study-attempts/${attemptId}`);
      const { downloadStudyReport } = await import("@/lib/studyReportPdf");
      const name = await downloadStudyReport(report);
      toast.success(`Saved ${name}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't make the report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={busy}
      aria-label={compact ? `${label} (PDF)` : undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full border border-accent-primary/40 bg-accent-primary/10 font-bold text-accent-primary transition-colors hover:bg-accent-primary/15 disabled:pointer-events-none disabled:opacity-60",
        compact ? "px-3 py-1.5 text-2xs" : "px-5 py-2.5 text-sm",
        className
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
      {busy ? "Making your report…" : label}
      {!busy && !compact && <span className="text-2xs font-semibold opacity-70">PDF</span>}
    </button>
  );
}
