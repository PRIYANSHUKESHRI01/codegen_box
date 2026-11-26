"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Headphones, Loader2, Mic, Pause, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

function formatAudioClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const whole = Math.floor(sec);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const WAVEFORM_WEIGHTS = [
  0.38, 0.62, 0.45, 0.85, 0.72, 0.54, 0.92, 0.66, 0.48, 0.78,
  0.96, 0.64, 0.52, 0.84, 0.7, 0.42, 0.88, 0.74, 0.58, 0.9,
  0.6, 0.46, 0.8, 0.68, 0.5, 0.76, 0.56, 0.4,
];

const SPEEDS = [1, 1.25, 1.5] as const;

/**
 * Studio-grade spoken answer review card shown inside the interview room after voice capture stops.
 * Displays the live/AI-refined read-only transcript alongside an interactive waveform audio review player
 * so candidates can replay and verify their spoken response before submitting.
 */
export function AnswerEditor({
  value,
  disabled = false,
  label,
  placeholder,
  audioUrl,
  recordedSeconds,
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
  /** Recorded duration in seconds from the interview timer (used as fallback if WebM header duration is Infinity). */
  recordedSeconds?: number;
  /** Whether backend AI transcription is currently processing the audio in the background. */
  isTranscribing?: boolean;
  className?: string;
}) {
  const cleanText = value.trim();
  const wordCount = useMemo(() => (cleanText ? cleanText.split(/\s+/).length : 0), [cleanText]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(recordedSeconds ?? 0);
  const [speedIndex, setSpeedIndex] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(recordedSeconds ?? 0);
    setSpeedIndex(0);
  }, [audioUrl, recordedSeconds]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const syncDuration = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setDuration(el.duration);
      }
    };
    const onTime = () => setCurrentTime(el.currentTime || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    el.addEventListener("loadedmetadata", syncDuration);
    el.addEventListener("durationchange", syncDuration);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("loadedmetadata", syncDuration);
      el.removeEventListener("durationchange", syncDuration);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const effectiveDuration = duration > 0 ? duration : (recordedSeconds ?? 0);
  const progress = effectiveDuration > 0 ? Math.min(1, Math.max(0, currentTime / effectiveDuration)) : 0;

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.playbackRate = SPEEDS[speedIndex];
      void el.play().catch(() => setPlaying(false));
    }
  };

  const handleRestart = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    setCurrentTime(0);
    el.playbackRate = SPEEDS[speedIndex];
    void el.play().catch(() => setPlaying(false));
  };

  const handleCycleSpeed = () => {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[next];
    }
  };

  const handleSeekBar = (ratio: number) => {
    const el = audioRef.current;
    if (!el || effectiveDuration <= 0) return;
    const nextTime = Math.max(0, Math.min(effectiveDuration, ratio * effectiveDuration));
    el.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <div
      role="region"
      aria-label={label}
      data-testid="spoken-transcript-preview"
      className={cn(
        "overflow-hidden rounded-2xl border border-accent-primary/35 bg-gradient-to-b from-surface to-surface/95 shadow-lg shadow-accent-primary/[0.06] ring-4 ring-accent-primary/[0.07]",
        disabled && "opacity-75",
        className
      )}
    >
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/80 bg-elevated/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-primary/15 text-accent-primary">
            <Mic className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="text-2xs font-extrabold uppercase tracking-wider text-primary">{label}</span>
        </div>

        <div className="flex items-center gap-2">
          {wordCount > 0 && (
            <span className="rounded-full border border-border-subtle bg-surface px-2.5 py-0.5 text-3xs font-bold tabular-nums text-text-secondary">
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
          )}
          {isTranscribing ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent-primary/30 bg-accent-primary/10 px-2.5 py-0.5 text-3xs font-bold text-accent-primary">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Refining with AI
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-3xs font-bold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3 w-3" aria-hidden />
              Voice verified · Read-only
            </span>
          )}
        </div>
      </div>

      {/* Transcript content */}
      <div className="px-4 py-3.5">
        {isTranscribing && (
          <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-accent-primary/25 bg-accent-primary/[0.08] px-3.5 py-2 text-xs font-semibold text-accent-primary">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            <span>
              {cleanText
                ? "Refining transcript with AI for technical accuracy..."
                : "Transcribing your spoken answer with AI..."}
            </span>
          </div>
        )}

        {cleanText ? (
          <div className="relative rounded-xl border border-border-subtle/70 bg-background/60 px-4 py-3">
            <div aria-hidden className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-cyan-400" />
            <p className="max-h-[36vh] overflow-y-auto pl-2 whitespace-pre-wrap text-[15px] leading-relaxed text-primary sm:text-base">
              {cleanText}
            </p>
          </div>
        ) : !isTranscribing ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-elevated/40 px-4 py-3 text-sm italic text-text-muted">
            {placeholder ||
              (audioUrl
                ? "Your spoken audio recording is attached — click Submit answer to finalize transcription, or Re-record."
                : "No speech detected in this recording. Click Re-record to answer again.")}
          </div>
        ) : null}
      </div>

      {/* Interactive Audio Playback Bar */}
      {audioUrl && (
        <div className="border-t border-border-subtle/80 bg-elevated/50 px-4 py-3">
          <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-3xs font-bold uppercase tracking-wider text-text-secondary">
              <Headphones className="h-3.5 w-3.5 text-accent-primary" aria-hidden />
              Review your recording before submitting
            </span>
            <span className="inline-flex items-center gap-1 text-3xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Audio captured
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-3 py-2 shadow-sm">
            <button
              type="button"
              onClick={togglePlay}
              disabled={disabled}
              aria-label={playing ? "Pause recording" : "Play recording"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-primary text-white shadow-md shadow-accent-primary/25 transition-transform hover:scale-105 hover:bg-accent-primary-hover disabled:opacity-50"
            >
              {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="ml-0.5 h-4 w-4" aria-hidden />}
            </button>

            <div className="min-w-0 flex-1 space-y-1">
              <div
                role="slider"
                tabIndex={0}
                aria-label="Audio playback position"
                aria-valuemin={0}
                aria-valuemax={Math.round(effectiveDuration)}
                aria-valuenow={Math.round(currentTime)}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / Math.max(1, rect.width);
                  handleSeekBar(ratio);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") handleSeekBar(progress + 0.1);
                  if (e.key === "ArrowLeft") handleSeekBar(progress - 0.1);
                }}
                className="flex h-6 cursor-pointer items-center gap-[3px]"
              >
                {WAVEFORM_WEIGHTS.map((w, idx) => {
                  const barRatio = (idx + 0.5) / WAVEFORM_WEIGHTS.length;
                  const active = barRatio <= progress;
                  return (
                    <span
                      key={idx}
                      style={{ height: `${Math.round(w * 100)}%` }}
                      className={cn(
                        "flex-1 rounded-full transition-colors duration-150",
                        active
                          ? "bg-gradient-to-t from-indigo-500 to-cyan-400"
                          : "bg-border-strong/60 hover:bg-text-muted/60"
                      )}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[11px] font-semibold tabular-nums text-text-muted">
                <span>{formatAudioClock(currentTime)}</span>
                <span>{effectiveDuration > 0 ? formatAudioClock(effectiveDuration) : "--:--"}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleCycleSpeed}
                disabled={disabled}
                title="Playback speed"
                className="rounded-lg border border-border-subtle bg-elevated px-2 py-1 text-3xs font-extrabold tabular-nums text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-primary"
              >
                {SPEEDS[speedIndex]}×
              </button>
              <button
                type="button"
                onClick={handleRestart}
                disabled={disabled}
                aria-label="Replay from start"
                title="Replay from start"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle bg-elevated text-text-secondary transition-colors hover:border-accent-primary/40 hover:text-primary"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
