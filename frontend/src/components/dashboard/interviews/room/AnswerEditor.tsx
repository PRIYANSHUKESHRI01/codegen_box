"use client";

import { Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Read-only spoken answer transcript shown inside the live transcript room after voice capture stops.
 * Paid & Vault AI interviews are strictly voice-verified — candidates cannot manually type or rewrite transcripts,
 * only review what was captured, replay their recording, re-record if needed, and submit.
 */
export function AnswerEditor({
  value,
  disabled = false,
  label,
  placeholder,
  audioUrl,
  isTranscribing = false,
  className,
}: {
  value: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label: string;
  placeholder?: string;
  /** The recording of the spoken answer, offered for playback while reviewing. */
  audioUrl?: string | null;
  /** Whether backend AI transcription is currently processing the audio in the background. */
  isTranscribing?: boolean;
  className?: string;
}) {
  const cleanText = value.trim();
  const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;

  return (
    <div
      role="region"
      aria-label={label}
      data-testid="spoken-transcript-preview"
      className={cn(
        "rounded-2xl border border-accent-primary/40 bg-surface px-4 py-3.5 shadow-sm ring-4 ring-accent-primary/[0.07]",
        disabled && "opacity-75",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-accent-primary">
          <Mic className="h-3 w-3" aria-hidden />
          {label}
        </span>
        <span className="text-3xs font-semibold text-text-muted">
          {wordCount > 0 ? `${wordCount} ${wordCount === 1 ? "word" : "words"} · ` : ""}Voice verified · Read-only
        </span>
      </div>

      {isTranscribing && (
        <div className="mb-2.5 flex items-center gap-2 rounded-lg bg-accent-primary/10 px-3 py-1.5 text-xs font-semibold text-accent-primary animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          <span>{cleanText ? "Refining transcript with AI for accuracy..." : "Transcribing your spoken answer with AI..."}</span>
        </div>
      )}

      {cleanText ? (
        <p className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap text-base leading-relaxed text-primary sm:text-lg">
          {cleanText}
        </p>
      ) : !isTranscribing ? (
        <p className="text-sm italic text-text-muted">
          {placeholder ||
            (audioUrl
              ? "Your spoken audio recording is attached — click Submit answer to finalize transcription, or Re-record."
              : "No speech detected in this recording. Click Re-record to answer again.")}
        </p>
      ) : null}

      {audioUrl && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <p className="mb-1 text-3xs font-bold uppercase tracking-wide text-text-muted">Your recording</p>
          <audio controls src={audioUrl} className="h-9 w-full" />
        </div>
      )}
    </div>
  );
}
