"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The candidate's answer as an editable block inside the transcript — used when they are typing (no microphone) and when they review what
 * was heard before submitting. It grows with the text so the transcript never gets a nested scrollbar, and Ctrl/⌘+Enter submits.
 */
export function AnswerEditor({
  value,
  onChange,
  onSubmit,
  disabled = false,
  autoFocus = false,
  label,
  placeholder,
  audioUrl,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  label: string;
  placeholder?: string;
  /** The recording of the spoken answer, offered for playback while reviewing. */
  audioUrl?: string | null;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Size to content: collapse first so a shrinking answer shrinks the box too.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div className={cn("rounded-2xl border border-accent-primary/40 bg-surface px-4 py-3 shadow-sm ring-4 ring-accent-primary/[0.07] transition-shadow focus-within:ring-accent-primary/20", className)}>
      <textarea
        ref={ref}
        aria-label={label}
        autoFocus={autoFocus}
        rows={3}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (onSubmit && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className="block max-h-[40vh] min-h-[4.5rem] w-full resize-none bg-transparent text-base leading-relaxed text-primary outline-none focus-visible:outline-none placeholder:text-text-muted disabled:opacity-60 sm:text-lg"
      />
      {audioUrl && (
        <div className="mt-3 border-t border-border-subtle pt-3">
          <p className="mb-1 text-3xs font-bold uppercase tracking-wide text-text-muted">Your recording</p>
          <audio controls src={audioUrl} className="h-9 w-full" />
        </div>
      )}
    </div>
  );
}
